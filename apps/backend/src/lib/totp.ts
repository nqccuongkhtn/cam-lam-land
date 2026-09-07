// SINH MÃ XÁC THỰC 6 SỐ KIỂU GOOGLE AUTHENTICATOR (chuẩn TOTP — RFC 6238).
// Cách hoạt động: lấy ĐỒNG HỒ chia cho 30 giây ra một con số, trộn con số đó với chuỗi bí mật
// của tài khoản bằng thuật toán HMAC-SHA1, rồi rút ra 6 chữ số. Ai có cùng chuỗi bí mật và
// đồng hồ đúng giờ thì ra cùng một mã — nên KHÔNG cần liên lạc gì với hệ thống kia.
//
// ⚠️ ĐỒNG HỒ MÁY CHỦ PHẢI ĐÚNG GIỜ. Lệch quá 30 giây là mã sinh ra bị từ chối. Máy chạy Docker
// trên Windows thỉnh thoảng bị trôi giờ sau khi máy ngủ dậy — thấy mã báo sai thì kiểm tra giờ trước.
import { createHmac } from 'node:crypto';

const CHU_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Đổi chuỗi bí mật kiểu base32 (thứ in trong mã QR) thành dãy byte. */
export function doiBase32(s: string): Buffer {
  const sach = String(s).toUpperCase().replace(/[^A-Z2-7]/g, '');   // bỏ dấu '=' và khoảng trắng
  let bit = 0, so = 0;
  const ra: number[] = [];
  for (const c of sach) {
    const v = CHU_BASE32.indexOf(c);
    if (v < 0) continue;
    so = (so << 5) | v; bit += 5;
    if (bit >= 8) { bit -= 8; ra.push((so >> bit) & 0xff); }
  }
  return Buffer.from(ra);
}

/**
 * Sinh mã cho một chuỗi bí mật.
 * Trả về { ma: '123456', conLai: số giây nữa thì đổi mã }.
 * Tham số `luc` (mốc thời gian, mili-giây) chỉ dùng khi cần KIỂM TRA lại thuật toán bằng
 * bộ số chuẩn của RFC 6238 — bình thường cứ để trống, hàm tự lấy giờ hiện tại.
 */
export function sinhMa(secret: string, soChuSo = 6, chuKy = 30, luc = Date.now()): { ma: string; conLai: number } {
  const khoa = doiBase32(secret);
  if (!khoa.length) return { ma: '', conLai: 0 };
  const giay = Math.floor(luc / 1000);
  const buoc = Math.floor(giay / chuKy);

  // Số bước ghi thành 8 byte (big-endian) — chuẩn bắt buộc của TOTP.
  const dem = Buffer.alloc(8);
  dem.writeUInt32BE(Math.floor(buoc / 2 ** 32), 0);
  dem.writeUInt32BE(buoc >>> 0, 4);

  const bam = createHmac('sha1', khoa).update(dem).digest();
  const lech = bam[bam.length - 1] & 0x0f;                 // lấy 4 bit cuối làm vị trí bắt đầu
  const so = ((bam[lech] & 0x7f) << 24) | (bam[lech + 1] << 16) | (bam[lech + 2] << 8) | bam[lech + 3];
  const ma = String(so % 10 ** soChuSo).padStart(soChuSo, '0');
  return { ma, conLai: chuKy - (giay % chuKy) };
}

/**
 * Đọc dòng `otpauth://totp/VBDLIS:tenaccount?secret=XXXX&issuer=VBDLIS`
 * (chính là chuỗi nằm trong mã QR của Google Authenticator).
 * Trả { ten, secret } — không đọc được thì trả null.
 */
export function docOtpauth(chuoi: string): { ten: string; secret: string } | null {
  const s = String(chuoi || '').trim();
  try {
    if (/^otpauth:\/\//i.test(s)) {
      const u = new URL(s);
      const secret = u.searchParams.get('secret') || '';
      // Phần nhãn nằm sau dấu '/', dạng "Nhà cung cấp:tên tài khoản" → lấy phần tên cho gọn.
      const nhan = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
      const ten = (nhan.includes(':') ? nhan.split(':').slice(1).join(':') : nhan) || u.searchParams.get('issuer') || '';
      if (!secret) return null;
      return { ten: ten.trim(), secret: secret.trim() };
    }
    // Không phải otpauth thì coi cả dòng là chuỗi bí mật trần.
    if (doiBase32(s).length >= 10) return { ten: '', secret: s.replace(/\s+/g, '') };
  } catch { /* chuỗi hỏng */ }
  return null;
}
