// CHỐNG CÀO KHO VĂN BẢN (chủ dự án 7/10/2026: "chống người ta cào của mình").
//
// Thứ đáng giá nhất là FILE PDF đã gom + gắn dấu bản quyền (/api/van-ban/:id/pdf). Người xem thật chỉ mở vài văn bản
// mỗi lần; máy cào thì mở HÀNG LOẠT văn bản KHÁC NHAU. Nên đếm SỐ VĂN BẢN KHÁC NHAU mà mỗi tài khoản / mỗi địa chỉ
// máy đã mở trong 1 giờ và 1 ngày (mở lại cùng văn bản không tính thêm). Vượt mức → khoá tạm, ghi nhật ký lỗi.
// Ngoài ra giới hạn số lần gọi danh sách đầy đủ (GET /) và ô tìm công khai ở trang chủ (/tim).
//
// Mọi con số chỉnh trong .env (VB_*). Admin và vai trò "vanban" (người quản lý văn bản) không bị giới hạn.
// Bộ đếm nằm trong bộ nhớ: khởi động lại backend là đếm lại từ đầu (đủ dùng — máy chủ chạy 1 tiến trình).
import type { Request } from 'express';
import { coVaiTro } from './auth.ts';
import { logError } from './logger.ts';

const so = (k: string, md: number) => { const n = Number(process.env[k]); return Number.isFinite(n) && n > 0 ? n : md; };
const PDF_GIO = so('VB_PDF_GIO', 30);          // văn bản KHÁC NHAU / 1 giờ / tài khoản
const PDF_NGAY = so('VB_PDF_NGAY', 100);       // văn bản KHÁC NHAU / 1 ngày / tài khoản
const PDF_IP_NHAN = so('VB_PDF_IP_NHAN', 2);   // 1 địa chỉ máy được gấp mấy lần (nhiều người chung mạng quán cà phê, công ty)
const KHOA_GIO = so('VB_KHOA_GIO', 12);        // khoá bao nhiêu giờ khi vượt mức ngày
const DS_GIO = so('VB_DS_GIO', 40);            // số lần tải danh sách đầy đủ / 1 giờ / tài khoản
const TIM_5P = so('VB_TIM_5P', 40);            // số lần tìm ở trang chủ / 5 phút / địa chỉ máy
const TIM_NGAY = so('VB_TIM_NGAY', 400);       // số lần tìm ở trang chủ / ngày / địa chỉ máy
const TAT = process.env.VB_TAT_CHONG_CAO === 'true';   // chỉ dùng khi thử nghiệm

const GIO = 3600_000, NGAY = 24 * GIO;
// Địa chỉ máy thật: nginx đã ghi đè CF-Connecting-IP bằng địa chỉ thật (xem nginx.conf), người dùng không giả được.
export const ipCua = (req: Request) => String(req.headers['cf-connecting-ip'] || req.ip || '').slice(0, 64) || 'khong-ro';
export const khongGioiHan = (u: any) => TAT || coVaiTro(u, 'admin', 'vanban');

// mở văn bản: khoá → (id văn bản → lần mở gần nhất)
const daMo = new Map<string, Map<number, number>>();
const biKhoa = new Map<string, number>();          // khoá → khoá đến lúc nào
// đếm số lần gọi: khoá → các mốc thời gian
const lanGoi = new Map<string, number[]>();

setInterval(() => {   // dọn bộ nhớ mỗi 10 phút
  const now = Date.now();
  for (const [k, m] of daMo) { for (const [id, t] of m) if (now - t > NGAY) m.delete(id); if (!m.size) daMo.delete(k); }
  for (const [k, t] of biKhoa) if (t < now) biKhoa.delete(k);
  for (const [k, a] of lanGoi) { const g = a.filter((t) => now - t < NGAY); if (g.length) lanGoi.set(k, g); else lanGoi.delete(k); }
}, 10 * 60_000).unref?.();

const conKhoa = (k: string) => { const t = biKhoa.get(k); return t && t > Date.now() ? t : 0; };
const gioVn = (t: number) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/** Gọi trước khi phát file PDF. Trả về câu báo lỗi (tiếng Việt) nếu phải chặn, null nếu cho qua. */
export function kiemMoVanBan(req: Request, user: any, idVb: number): string | null {
  if (khongGioiHan(user)) return null;
  const now = Date.now();
  const khoa: [string, number][] = [[`tk:${user?.id}`, 1], [`ip:${ipCua(req)}`, PDF_IP_NHAN]];
  for (const [k] of khoa) {
    const t = conKhoa(k);
    if (t) return `Tài khoản hoặc máy của bạn đã mở quá nhiều văn bản nên tạm bị khoá xem đến ${gioVn(t)}. Cần xem gấp, vui lòng gọi 0988 888 888.`;
  }
  for (const [k, nhan] of khoa) {
    const m = daMo.get(k) || new Map<number, number>();
    if (m.has(idVb)) continue;                       // mở lại văn bản đã mở → không tính thêm
    let gio = 0, ngay = 0;
    for (const t of m.values()) { if (now - t < GIO) gio++; if (now - t < NGAY) ngay++; }
    if (ngay >= PDF_NGAY * nhan) {
      biKhoa.set(k, now + KHOA_GIO * GIO);
      logError(`[chong-cao-van-ban] KHOÁ ${k} (user ${user?.id} · ${user?.email || ''} · ip ${ipCua(req)}): đã mở ${ngay} văn bản khác nhau trong 24 giờ`);
      return `Bạn đã mở quá nhiều văn bản trong hôm nay nên tạm bị khoá xem ${KHOA_GIO} giờ. Cần xem gấp, vui lòng gọi 0988 888 888.`;
    }
    if (gio >= PDF_GIO * nhan) return `Bạn mở văn bản hơi nhanh — vui lòng nghỉ ít phút rồi xem tiếp (tối đa ${PDF_GIO} văn bản mỗi giờ).`;
  }
  for (const [k] of khoa) { const m = daMo.get(k) || new Map(); m.set(idVb, now); daMo.set(k, m); }
  return null;
}

/** Đếm số lần gọi trong các khung thời gian; vượt → câu báo lỗi. */
function demLan(k: string, khung: [number, number][], loi: string): string | null {
  const now = Date.now();
  const a = (lanGoi.get(k) || []).filter((t) => now - t < NGAY);
  for (const [ms, toiDa] of khung) if (a.filter((t) => now - t < ms).length >= toiDa) { lanGoi.set(k, a); return loi; }
  a.push(now); lanGoi.set(k, a);
  return null;
}
export const kiemDanhSach = (user: any) => (khongGioiHan(user) ? null
  : demLan(`ds:${user?.id}`, [[GIO, DS_GIO]], 'Bạn tải danh sách văn bản quá nhiều lần — vui lòng thử lại sau ít phút.'));
export const kiemTimCongKhai = (req: Request) => (TAT ? null
  : demLan(`tim:${ipCua(req)}`, [[5 * 60_000, TIM_5P], [NGAY, TIM_NGAY]], 'Bạn tìm hơi nhiều — vui lòng thử lại sau ít phút, hoặc đăng nhập để dùng trang tra cứu đầy đủ.'));
