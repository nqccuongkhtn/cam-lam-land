import { Router } from 'express';
import { query } from '../lib/db.ts';
import { vnNoAccent } from '../lib/vn.ts';
import { authRequired, vanBanRequired, type AuthedRequest } from '../middleware/auth.ts';
import { kiemTimCongKhai } from '../lib/chongCaoVb.ts';
import { laNguoiThat, capVe, veHopLe } from '../lib/turnstile.ts';
import { coVaiTro } from '../lib/auth.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';

export const vanBanRouter = Router();
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; CamLamLand/1.0)' };
const tim = (kw: string) => `https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=${encodeURIComponent(kw)}`;
const CAMLAM = 'https://camlam.khanhhoa.gov.vn/module/document';

type Seed = { so: string; ngay: string; ty: string; chuDe: string; lv: string; cq: string; nguon: string; url: string; luot?: number; nb?: boolean };
const SEED: Seed[] = [
  { so: '893/QĐ-UBND', ngay: '2026-04-04', ty: 'Phê duyệt Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 và Kế hoạch sử dụng đất năm đầu của điều chỉnh quy hoạch sử dụng đất huyện Cam Lâm.', chuDe: 'Quy hoạch', lv: 'Quy hoạch', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Công báo Khánh Hòa', url: 'https://congbaokhanhhoa.gov.vn/vi-vn/noi-dung-van-ban/vanbanid/22060', luot: 7823, nb: true },
  { so: '757/QĐ-TTg', ngay: '2026-04-28', ty: 'Phê duyệt Nhiệm vụ Quy hoạch chung đô thị Khánh Hòa đến năm 2050, tầm nhìn đến năm 2075.', chuDe: 'Quy hoạch', lv: 'Quy hoạch', cq: 'Thủ tướng Chính phủ', nguon: 'Pháp luật', url: 'https://luatvietnam.vn/dat-dai/quyet-dinh-757-qd-ttg-2026-phe-duyet-quy-hoach-chung-do-thi-khanh-hoa-den-2050-433391-d1.html', luot: 5337, nb: true },
  { so: '205/QĐ-TTg', ngay: '2024-02-28', ty: 'Phê duyệt Quy hoạch chung đô thị mới Cam Lâm, tỉnh Khánh Hòa đến năm 2045.', chuDe: 'Quy hoạch', lv: 'Quy hoạch', cq: 'Thủ tướng Chính phủ', nguon: 'Pháp luật', url: 'https://thuvienphapluat.vn/van-ban/Xay-dung-Do-thi/Quyet-dinh-205-QD-TTg-2024-phe-duyet-Quy-hoach-chung-do-thi-moi-Cam-Lam-Khanh-Hoa-den-2045-600262.aspx', nb: true },
  { so: '2279/QĐ-UBND', ngay: '2026-06-26', ty: 'Phê duyệt điều chỉnh Quy hoạch tỉnh Khánh Hòa thời kỳ 2021 - 2030, tầm nhìn đến năm 2050.', chuDe: 'Quy hoạch', lv: 'Quy hoạch', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Công báo Khánh Hòa', url: tim('2279/QĐ-UBND Khánh Hòa quy hoạch tỉnh 2021 2030'), luot: 2921, nb: true },
  { so: '30/QĐ-UBND', ngay: '2026-01-15', ty: 'Phê duyệt quy hoạch phân khu (tỷ lệ 1/2000) phân khu sinh thái núi Cù Hin, đô thị mới Cam Lâm.', chuDe: 'Quy hoạch', lv: 'Quy hoạch', cq: 'UBND xã Suối Dầu', nguon: 'Cổng Cam Lâm', url: CAMLAM, luot: 680, nb: true },
  { so: '1525/UBND', ngay: '2025-04-22', ty: 'Triển khai thực hiện Kế hoạch sử dụng đất năm 2025 của huyện Cam Lâm đã được UBND tỉnh phê duyệt.', chuDe: 'Quy hoạch', lv: 'Đất đai', cq: 'UBND huyện Cam Lâm', nguon: 'Cổng Cam Lâm', url: CAMLAM },
  { so: '102/2024/NĐ-CP', ngay: '2024-07-30', ty: 'Quy định chi tiết thi hành một số điều của Luật Đất đai (quy hoạch – kế hoạch sử dụng đất, giao đất, cho thuê đất).', chuDe: 'Quy hoạch', lv: 'Đất đai', cq: 'Chính phủ', nguon: 'Pháp luật', url: 'https://thuvienphapluat.vn/van-ban/Bat-dong-san/Nghi-dinh-102-2024-ND-CP-huong-dan-Luat-Dat-dai-603982.aspx' },
  { so: '8757/KH-UBND', ngay: '2026-07-09', ty: 'Kế hoạch phát triển Hệ thống cảng biển Khánh Hòa giai đoạn 2026 – 2030.', chuDe: 'Quy hoạch', lv: 'Quy hoạch', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Công báo Khánh Hòa', url: 'https://congbaokhanhhoa.gov.vn/noi-dung-van-ban/vanbanid/23238' },
  { so: '46/2026/TT-BXD', ngay: '2026-06-30', ty: 'Ban hành Quy chuẩn kỹ thuật quốc gia về quy hoạch đô thị và nông thôn.', chuDe: 'Quy hoạch', lv: 'Xây dựng', cq: 'Bộ Xây dựng', nguon: 'Cổng Cam Lâm', url: tim('46/2026/TT-BXD Quy chuẩn quy hoạch đô thị nông thôn'), luot: 854 },
  { so: 'QCVN 01:2026/BXD', ngay: '2026-07-06', ty: 'Quy chuẩn kỹ thuật quốc gia về quy hoạch đô thị và nông thôn 2026.', chuDe: 'Quy hoạch', lv: 'Xây dựng', cq: 'Bộ Xây dựng', nguon: 'Cổng Cam Lâm', url: tim('QCVN 01:2026/BXD quy hoạch đô thị nông thôn'), luot: 510 },
  { so: '2958/KH-UBND', ngay: '2026-07-06', ty: 'Kế hoạch triển khai Chương trình 90 ngày cao điểm giải phóng mặt bằng các dự án động lực, trọng điểm.', chuDe: 'Bồi thường', lv: 'Bồi thường - GPMB', cq: 'UBND phường Bắc Cam Ranh', nguon: 'Cổng Cam Lâm', url: CAMLAM, luot: 5671 },
  { so: '15/2025/NQ-HĐND', ngay: '2025-07-01', ty: 'Bảng giá đất tỉnh Khánh Hòa (lần đầu theo Luật Đất đai 2024), áp dụng từ 01/01/2026 — căn cứ tính bồi thường.', chuDe: 'Bồi thường', lv: 'Giá đất', cq: 'HĐND tỉnh Khánh Hòa', nguon: 'Pháp luật', url: 'https://thuvienphapluat.vn/van-ban/Bat-dong-san/Nghi-quyet-15-2025-NQ-HDND-Bang-gia-dat-lan-dau-Khanh-Hoa-tu-01-01-2026-688194.aspx' },
  { so: '23/2025/QĐ-UBND', ngay: '2025-04-10', ty: 'Sửa đổi, bổ sung bảng giá các loại đất tỉnh Khánh Hòa, áp dụng từ 11/4/2025.', chuDe: 'Bồi thường', lv: 'Giá đất', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Pháp luật', url: 'https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/bat-dong-san/83020/bang-gia-dat-khanh-hoa-ap-dung-tu-ngay-11-4-2025' },
  { so: '71/2024/NĐ-CP', ngay: '2024-06-27', ty: 'Quy định về giá đất — phương pháp định giá, xây dựng và điều chỉnh bảng giá đất, giá đất cụ thể.', chuDe: 'Bồi thường', lv: 'Giá đất', cq: 'Chính phủ', nguon: 'Pháp luật', url: tim('71/2024/NĐ-CP') },
  { so: '88/2024/NĐ-CP', ngay: '2024-07-15', ty: 'Bồi thường, hỗ trợ, tái định cư khi Nhà nước thu hồi đất (nghị định gốc của Trung ương).', chuDe: 'Tái định cư', lv: 'Bồi thường - TĐC', cq: 'Chính phủ', nguon: 'Pháp luật', url: tim('88/2024/NĐ-CP bồi thường hỗ trợ tái định cư') },
  // ── Bổ sung: bồi thường & tái định cư từ cấp cao tới cấp thấp ──
  { so: '35/2026/QĐ-UBND', ngay: '2026-05-14', ty: 'Quy định đơn giá bồi thường, hỗ trợ thiệt hại đối với cây trồng, vật nuôi khi Nhà nước thu hồi đất trên địa bàn tỉnh Khánh Hòa (hiệu lực 14/5/2026, thay QĐ 32/2024).', chuDe: 'Bồi thường', lv: 'Đơn giá bồi thường', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Công báo Khánh Hòa', url: 'https://congbaokhanhhoa.gov.vn/Portals/0/FileVanBans/35_2026_Q%C4%90_UBND.signed.pdf' },
  { so: '32/2024/QĐ-UBND', ngay: '2024-10-01', ty: 'Quy định đơn giá bồi thường, hỗ trợ thiệt hại đối với cây trồng, vật nuôi khi Nhà nước thu hồi đất (Khánh Hòa) — nay được thay bằng QĐ 35/2026.', chuDe: 'Bồi thường', lv: 'Đơn giá bồi thường', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Pháp luật', url: tim('32/2024/QĐ-UBND Khánh Hòa đơn giá bồi thường cây trồng vật nuôi') },
  { so: '17/2024/QĐ-UBND', ngay: '2024-08-29', ty: 'Quy định chi tiết một số nội dung về bồi thường, hỗ trợ, tái định cư khi Nhà nước thu hồi đất trên địa bàn tỉnh Khánh Hòa (hiệu lực 01/9/2024).', chuDe: 'Tái định cư', lv: 'Bồi thường - TĐC', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Công báo Khánh Hòa', url: 'https://congbaokhanhhoa.gov.vn/vi-vn/noi-dung-van-ban/vanbanid/21084' },
  { so: '14/2025/QĐ-UBND', ngay: '2025-08-07', ty: 'Sửa đổi, bổ sung Quyết định 17/2024/QĐ-UBND về bồi thường, hỗ trợ, tái định cư khi Nhà nước thu hồi đất tại Khánh Hòa (hiệu lực 01/8/2025).', chuDe: 'Tái định cư', lv: 'Bồi thường - TĐC', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Pháp luật', url: 'https://luatvietnam.vn/chinh-sach/quyet-dinh-14-2025-qd-ubnd-407929-d2.html' },
  { so: '2436/QĐ-UBND', ngay: '2024-10-15', ty: 'Đính chính Quy định về bồi thường, hỗ trợ, tái định cư khi Nhà nước thu hồi đất trên địa bàn tỉnh Khánh Hòa (đính chính QĐ 17/2024).', chuDe: 'Tái định cư', lv: 'Bồi thường - TĐC', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Pháp luật', url: tim('2436/QĐ-UBND Khánh Hòa đính chính bồi thường hỗ trợ tái định cư') },
  { so: '27/2023/QH15', ngay: '2023-11-27', ty: 'Luật Nhà ở 2023 — sở hữu, phát triển, quản lý nhà ở; chính sách nhà ở xã hội, nhà chung cư.', chuDe: 'Nhà ở xã hội', lv: 'Nhà ở - BĐS', cq: 'Quốc hội', nguon: 'Pháp luật', url: tim('27/2023/QH15 Luật Nhà ở') },
  { so: '2180/QĐ-UBND', ngay: '2026-06-18', ty: 'Giao đất (đợt 1) cho Công ty CP Đầu tư và Phát triển Nhà ở KVG thực hiện dự án Nhà ở cho gia đình lực lượng vũ trang tại phường Nam Nha Trang.', chuDe: 'Nhà ở xã hội', lv: 'Nhà ở', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Công báo Khánh Hòa', url: 'https://congbaokhanhhoa.gov.vn/noi-dung-van-ban/vanbanid/23226' },
  { so: '2302/QĐ-UBND', ngay: '2026-07-04', ty: 'Cho Công ty CP Phát triển BĐS Biển Trần Phú thuê đất thực hiện dự án Tổ hợp thương mại, dịch vụ du lịch cao cấp 48-48A Trần Phú, Nha Trang.', chuDe: 'Khác', lv: 'Đất đai', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Công báo Khánh Hòa', url: 'https://congbaokhanhhoa.gov.vn/noi-dung-van-ban/vanbanid/23232' },
  { so: '2295/QĐ-UBND', ngay: '2026-07-03', ty: 'Điều chỉnh, bổ sung QĐ 658/QĐ-UBND về thuê đất tại dự án Công ty TNHH Bia San Miguel Việt Nam, xã Suối Hiệp.', chuDe: 'Khác', lv: 'Đất đai', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Công báo Khánh Hòa', url: 'https://congbaokhanhhoa.gov.vn/noi-dung-van-ban/vanbanid/23245' },
  { so: '2161/QĐ-UBND', ngay: '2026-06-17', ty: 'Đính chính QĐ 09/2026/QĐ-UBND về trình tự, thủ tục cho thuê quỹ đất ngắn hạn trên địa bàn tỉnh Khánh Hòa.', chuDe: 'Khác', lv: 'Đất đai', cq: 'UBND tỉnh Khánh Hòa', nguon: 'Công báo Khánh Hòa', url: 'https://congbaokhanhhoa.gov.vn/noi-dung-van-ban/vanbanid/23229' },
  { so: '31/2024/QH15', ngay: '2024-01-18', ty: 'Luật Đất đai 2024 — quản lý, sử dụng đất; thu hồi, bồi thường, định giá, cấp Giấy chứng nhận.', chuDe: 'Khác', lv: 'Đất đai', cq: 'Quốc hội', nguon: 'Pháp luật', url: 'https://thuvienphapluat.vn/van-ban/Bat-dong-san/Luat-Dat-dai-2024-31-2024-QH15-523642.aspx' },
  { so: '29/2023/QH15', ngay: '2023-11-28', ty: 'Luật Kinh doanh bất động sản 2023 — điều kiện kinh doanh, chuyển nhượng dự án, môi giới, sàn giao dịch.', chuDe: 'Khác', lv: 'Nhà ở - BĐS', cq: 'Quốc hội', nguon: 'Pháp luật', url: tim('29/2023/QH15 Luật Kinh doanh bất động sản') },
  { so: '101/2024/NĐ-CP', ngay: '2024-07-15', ty: 'Điều tra cơ bản đất đai; đăng ký, cấp Giấy chứng nhận quyền sử dụng đất; hệ thống thông tin đất đai.', chuDe: 'Khác', lv: 'Đất đai', cq: 'Chính phủ', nguon: 'Pháp luật', url: tim('101/2024/NĐ-CP') },
  { so: '103/2024/NĐ-CP', ngay: '2024-07-30', ty: 'Quy định về tiền sử dụng đất, tiền thuê đất theo Luật Đất đai 2024.', chuDe: 'Khác', lv: 'Đất đai', cq: 'Chính phủ', nguon: 'Pháp luật', url: tim('103/2024/NĐ-CP') },
  { so: '27/NQ-HĐND', ngay: '2026-06-15', ty: 'Nghị quyết về việc sắp xếp lại thôn và tên gọi các thôn sau sắp xếp trên địa bàn xã Cam Lâm.', chuDe: 'Khác', lv: 'Nội chính', cq: 'HĐND xã Cam Lâm', nguon: 'Cổng Cam Lâm', url: CAMLAM, luot: 808 },
  { so: '25/QĐ-UBND', ngay: '2025-01-16', ty: 'Công nhận đạt chuẩn "Đô thị văn minh" đối với thị trấn Cam Đức, huyện Cam Lâm.', chuDe: 'Khác', lv: 'Văn hóa - Xã hội', cq: 'UBND huyện Cam Lâm', nguon: 'Cổng Cam Lâm', url: CAMLAM },
];

export async function seedVanBan(): Promise<void> {
  try {
    // DỌN RÁC cũ: xoá các bản ghi dính thẻ HTML/mã QR base64 do phiên bản crawler trước để lại
    // (số ký hiệu/trích yếu chứa <img ... data:image;base64 ... qr_download>). Crawl sau sẽ thêm lại bản sạch.
    await query(`DELETE FROM van_ban WHERE nguon <> 'Admin' AND (
        so_hieu LIKE '%<%' OR so_hieu LIKE '%data:%' OR so_hieu LIKE '%base64%' OR so_hieu LIKE '%qr_download%'
        OR trich_yeu LIKE '%data:image%' OR trich_yeu LIKE '%base64%' OR trich_yeu LIKE '%qr_download%' OR trich_yeu LIKE '%<img%')`).catch(() => {});
    // Upsert idempotent MỖI lần khởi động: thêm văn bản mới trong SEED mà KHÔNG đụng dữ liệu đã có
    // (admin sửa / crawler thêm đều được giữ nguyên nhờ ON CONFLICT DO NOTHING).
    for (const s of SEED) {
      await query(
        `INSERT INTO van_ban (so_hieu, trich_yeu, ngay_ban_hanh, co_quan, chu_de, linh_vuc, nguon, link_goc, luot_tai, noi_bat)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (so_hieu, ngay_ban_hanh) DO NOTHING`,
        [s.so, s.ty, s.ngay, s.cq, s.chuDe, s.lv, s.nguon, s.url, s.luot ?? 0, s.nb ?? false]).catch(() => {});
    }
    console.log('[van-ban] seed/upsert', SEED.length, 'văn bản');
  } catch (e: any) { console.error('[van-ban] seed lỗi:', e?.message || e); }
}

// Phân loại chủ đề theo từ khóa trong trích yếu. KW rộng để lấy nhiều văn bản nhà đất/xây dựng/đầu tư.
const KW = /(đất|quy hoạch|bồi thường|đền bù|hỗ trợ|tái định cư|nhà ở|căn hộ|chung cư|giá đất|thu hồi|giao đất|cho thuê đất|thuê đất|giải phóng mặt bằng|GPMB|phân khu|kế hoạch sử dụng đất|giấy chứng nhận|GCN|sổ đỏ|sổ hồng|chuyển nhượng|chuyển mục đích|tách thửa|hợp thửa|đấu giá|xây dựng|công trình|dự án|đầu tư|hạ tầng|đô thị|nông thôn mới|khu công nghiệp|cụm công nghiệp|khu kinh tế|du lịch|resort|sân bay|cảng|tài nguyên|khoáng sản|thủy lợi|định giá|cấp phép)/i;
function classify(t: string): string {
  if (/tái định cư/i.test(t)) return 'Tái định cư';
  if (/(nhà ở xã hội|NOXH)/i.test(t)) return 'Nhà ở xã hội';
  if (/(bồi thường|đền bù|hỗ trợ|giải phóng mặt bằng|GPMB|thu hồi)/i.test(t)) return 'Bồi thường';
  if (/(quy hoạch|phân khu|kế hoạch sử dụng đất)/i.test(t)) return 'Quy hoạch';
  if (/(giao đất|cho thuê đất|thuê đất|đấu giá|chuyển mục đích|tách thửa|hợp thửa)/i.test(t)) return 'Giao & thuê đất';
  if (/(giấy chứng nhận|GCN|sổ đỏ|sổ hồng|cấp giấy|đăng ký đất đai)/i.test(t)) return 'Giấy chứng nhận';
  if (/(định giá|giá đất|bảng giá)/i.test(t)) return 'Định giá đất';
  return 'Khác';
}
const clean = (s: string) => String(s || '')
  .replace(/data:[^\s"'<>]+/gi, ' ')                 // xoá chuỗi data:image;base64,... (mã QR/ảnh nhúng)
  .replace(/<[^>]*>/g, ' ')                          // lột thẻ HTML hoàn chỉnh
  .replace(/[<>]/g, ' ')                             // dọn ký tự < > lẻ còn sót (do thuộc tính lồng nhau)
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();
// Trích đúng SỐ KÝ HIỆU (vd 185/NQ-HĐND, 2549/QĐ-UBND) từ chuỗi đã làm sạch — tránh dính đuôi rác/lặp.
const soOf = (s: string) => {
  const c = clean(s);
  const m = c.match(/\d+\s*\/\s*[A-Za-zĐđ][A-Za-zĐđ0-9.\/-]*/);
  return m ? m[0].replace(/\s+/g, '') : (c.split(/["\s]/)[0] || '');
};

// Kho Công báo tổng hợp (tracuucongbao): danh sách /trang-chu/pg/N phân trang bằng GET (853 trang, 2005→nay),
// sắp MỚI→CŨ → duyệt tin cậy từ 2021 tới nay rồi tự dừng khi qua mốc 2021. Không cần postback.
const DOMAIN = 'https://tracuucongbao.khanhhoa.gov.vn';
const H1 = (re: RegExp, s: string) => (s.match(re) || [])[1] || '';
const absol = (p: string) => (p.startsWith('http') ? p : DOMAIN + '/' + p.replace(/^\/+/, ''));

function parseRows(html: string): { so: string; ngay: string; coQuan: string; trichYeu: string; pdfPath: string; id: string }[] {
  const out: any[] = [];
  for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const id = H1(/vanbanid\/(\d+)/, tr);
    if (!id) continue;
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((mm) => clean(mm[1].replace(/<[^>]+>/g, ' ')));
    if (tds.length < 3) continue;
    const so = soOf(H1(/vanbanid\/\d+[^>]*>([^<]+)</, tr) || tds[0]);
    const d = tr.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    const ngay = d ? `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}` : '';
    const cells = tds.slice(1);
    const trichYeu = cells.reduce((a, b) => (b.length > a.length ? b : a), '');
    const coQuan = cells.find((c) => /^(UBND|HĐND|Xã |Phường |Chủ tịch|Thành phố|Huyện |Thị xã)/i.test(c) && c.length < 45) || 'UBND tỉnh Khánh Hòa';
    const pdfPath = H1(/(Portals\/0\/FileVanBans[^"'\s]+\.pdf)/i, tr).replace(/\\/g, '/');
    out.push({ so, ngay, coQuan, trichYeu, pdfPath, id });
  }
  return out;
}

let lastCrawl = 0;
export async function crawlCongBao(force = false, deep = false, onAdd?: (isNew: boolean) => void): Promise<number> {
  if (!force && Date.now() - lastCrawl < 55 * 60 * 1000) return 0; // chốt 55 phút → lịch mỗi giờ luôn cào được "gần đây", tránh cào trùng dồn dập
  lastCrawl = Date.now();
  const MAX_PAGES = deep ? 950 : 15;    // sâu: cào TRỌN kho (2005→nay, ~853 trang) · gần đây: 15 trang mới nhất (mỗi giờ)
  const seen = new Set<string>();       // CHỐNG ĐẾM TRÙNG trong 1 lần chạy: mục "Mục lục"/"Văn bản được quan tâm" lặp trên MỌI trang
  let n = 0, empty = 0;
  for (let pg = 1; pg <= MAX_PAGES; pg++) {
    let rows: any[];
    try {
      const r = await fetch(`${DOMAIN}/trang-chu/pg/${pg}`, { headers: UA, signal: AbortSignal.timeout(15000) });
      if (!r.ok) break;
      rows = parseRows(await r.text());
    } catch { break; }
    if (!rows.length) { if (++empty >= 3) break; continue; } // chỉ dừng khi 3 trang RỖNG liên tiếp = hết kho (KHÔNG dừng sớm vì trang ít văn bản đất)
    empty = 0;
    for (const row of rows) {
      const year = Number((row.ngay || '').slice(0, 4));
      if (!year || !row.trichYeu || !row.so || !KW.test(`${row.trichYeu} ${row.so}`)) continue; // lấy MỌI năm (2005→nay), miễn khớp từ khoá nhà đất/quy hoạch
      const key = `${row.so}|${row.ngay}`;
      if (seen.has(key)) continue;       // đã xử lý trong lần chạy này → KHÔNG upsert lại (tránh cộng dồn ảo)
      seen.add(key);
      const link = row.pdfPath ? absol(row.pdfPath) : `${DOMAIN}/noi-dung-van-ban/vanbanid/${row.id}`;
      await query(
        `INSERT INTO van_ban (so_hieu, trich_yeu, ngay_ban_hanh, co_quan, chu_de, linh_vuc, nguon, link_goc)
         VALUES ($1,$2,$3,$4,$5,'Đất đai','Công báo Khánh Hòa',$6)
         ON CONFLICT (so_hieu, ngay_ban_hanh) DO UPDATE SET trich_yeu=EXCLUDED.trich_yeu,
           chu_de=EXCLUDED.chu_de,
           -- ĐÃ CÓ FILE THẬT (gắn tay / tự tìm được) thì GIỮ, không ghi đè bằng link trang chi tiết Công báo (6/10/2026: 198/QĐ-UBND bị ghi đè)
           link_goc=CASE WHEN van_ban.link_goc ~* '(LawDocumentRender|FileVanBans|\\.pdf(\\?|$)|drive\\.google\\.com/open\\?id=)' THEN van_ban.link_goc ELSE COALESCE(EXCLUDED.link_goc, van_ban.link_goc) END
         RETURNING (xmax = 0) AS inserted`,
        [row.so, row.trichYeu, row.ngay, row.coQuan, classify(`${row.trichYeu} ${row.so}`), link])
        .then((rs: any) => { n++; onAdd?.(!!(rs && rs[0] && rs[0].inserted)); }).catch(() => {});
    }
    await new Promise((z) => setTimeout(z, 300)); // lịch sự với máy chủ nguồn giữa các trang
  }
  console.log(`[van-ban] crawl Công báo (${deep ? 'sâu toàn kho' : 'gần đây'}): ${n} văn bản không trùng`);
  return n;
}

// ── Cổng TTĐT tỉnh Khánh Hòa: quét trang tra cứu văn bản /module/document của từng cổng ──
// Các cổng dùng chung nền tảng PSC Portal; GridView trang 1 hiển thị ~10 văn bản MỚI NHẤT (đủ để cập nhật hằng ngày).
// Số văn bản đất đai mỗi cổng ít — đây là NGUỒN BỔ SUNG; Công báo mới là kho tổng hợp đầy đủ.
const PORTALS_DOC: { ten: string; base: string }[] = [
  { ten: 'Cổng tỉnh Khánh Hòa', base: 'https://khanhhoa.gov.vn' },
  { ten: 'Sở Xây dựng', base: 'https://sxd.khanhhoa.gov.vn' },
  { ten: 'Sở Nông nghiệp & Môi trường', base: 'https://snnmt.khanhhoa.gov.vn' },
  { ten: 'Cam Lâm', base: 'https://camlam.khanhhoa.gov.vn' },
  { ten: 'Cam An', base: 'https://caman.khanhhoa.gov.vn' },
  { ten: 'Cam Hiệp', base: 'https://camhiep.khanhhoa.gov.vn' },
  { ten: 'Suối Dầu', base: 'https://suoidau.khanhhoa.gov.vn' },
  { ten: 'Suối Hiệp', base: 'https://suoihiep.khanhhoa.gov.vn' },
  { ten: 'Cam Ranh', base: 'https://camranh.khanhhoa.gov.vn' },
  { ten: 'Bắc Cam Ranh', base: 'https://baccamranh.khanhhoa.gov.vn' },
  { ten: 'Nam Cam Ranh', base: 'https://namcamranh.khanhhoa.gov.vn' },
  { ten: 'Cam Linh', base: 'https://camlinh.khanhhoa.gov.vn' },
  { ten: 'Ba Ngòi', base: 'https://bangoi.khanhhoa.gov.vn' },
  { ten: 'Nha Trang', base: 'https://nhatrang.khanhhoa.gov.vn' },
  { ten: 'Bắc Nha Trang', base: 'https://bacnhatrang.khanhhoa.gov.vn' },
  { ten: 'Tây Nha Trang', base: 'https://taynhatrang.khanhhoa.gov.vn' },
  { ten: 'Nam Nha Trang', base: 'https://namnhatrang.khanhhoa.gov.vn' },
  { ten: 'Diên Khánh', base: 'https://dienkhanh.khanhhoa.gov.vn' },
  { ten: 'Diên Lạc', base: 'https://dienlac.khanhhoa.gov.vn' },
  { ten: 'Diên Điền', base: 'https://diendien.khanhhoa.gov.vn' },
  { ten: 'Diên Lâm', base: 'https://dienlam.khanhhoa.gov.vn' },
  { ten: 'Diên Thọ', base: 'https://dientho.khanhhoa.gov.vn' },
];

// RadGrid nạp RỖNG rồi gọi web service JSON (ASMX ScriptService) để lấy dữ liệu — ta gọi thẳng service đó cho chuẩn.
// POST {base}/Services/DMSSearch.asmx/Search  (Content-Type: application/json)
//   body: {notation,subject,content,idField,idCategory,idCategories,dateBegin,dateEnd,isCopy,starIndex,endIndex}
//   trả:  {"d":"<mảng JSON>_<tổng>"} — mỗi phần tử: {Notation, CreatedDate:"/Date(ms)/", Subject, LuotXem, Id}
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
function parseAspDate(v: any): string {
  if (v == null) return '';
  const s = String(v);
  const m = s.match(/\/Date\((-?\d+)/);                 // định dạng .NET: /Date(1712...)/
  // +7 giờ: ngày của cổng là 0 giờ giờ VN = 17 giờ hôm trước giờ quốc tế → trước đây ghi LÙI 1 NGÀY (sửa 6/10/2026)
  if (m) { const d = new Date(Number(m[1]) + 7 * 3600e3); return isNaN(+d) ? '' : d.toISOString().slice(0, 10); }
  const dmy = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : '';
}

// Gọi API DMSSearch của 1 cổng → danh sách văn bản mới nhất (tối đa 150).
// ĐỌC HẾT KHO của cổng theo từng lượt 200 (6/10/2026 — trước chỉ 150 văn bản mới nhất, cổng Cam Lâm có 1.054 → sót phần lớn).
// sau = true: chỉ đọc lượt đầu (lịch 6 giờ chỉ cần văn bản mới).
async function fetchPortalDocs(base: string, sau = false) {
  const tat: Awaited<ReturnType<typeof fetchPortalLuot>> = [];
  for (let tu = 0; tu < 6000; tu += 200) {
    const l = await fetchPortalLuot(base, tu, tu + 200);
    tat.push(...l);
    if (l.length < 200 || sau) break;
    await new Promise((z) => setTimeout(z, 300));
  }
  return tat;
}
async function fetchPortalLuot(base: string, tu: number, den: number): Promise<{ so: string; ngay: string; trichYeu: string; luot: number; id: string; link: string }[]> {
  const body = JSON.stringify({ notation: '', subject: '', content: '', idField: EMPTY_GUID, idCategory: EMPTY_GUID, idCategories: EMPTY_GUID, dateBegin: '', dateEnd: '', isCopy: false, starIndex: tu, endIndex: den });
  const r = await fetch(`${base}/Services/DMSSearch.asmx/Search`, {
    method: 'POST', body,
    headers: { ...UA, 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) return [];
  const j: any = await r.json().catch(() => null);
  let s: string = j && typeof j.d === 'string' ? j.d : '';
  if (!s) return [];
  const i = s.lastIndexOf('_');                          // service nối "<mảng JSON>_<tổng>"
  if (i > 0) s = s.slice(0, i);
  let arr: any[]; try { arr = JSON.parse(s); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.map((o: any) => {
    let link = '';                                       // nếu service có trả trường file/URL thì dùng làm link tải
    for (const k of Object.keys(o || {})) {
      const v = o[k];
      if (typeof v !== 'string') continue;
      if (/\.(pdf|docx?)($|\?)/i.test(v)) { link = v; break; }
      if (/^https?:\/\//i.test(v) && /(file|download|document|upload|attach)/i.test(v)) link = v;
    }
    if (link && !/^https?:/i.test(link)) { try { link = new URL(link, base).href; } catch { link = ''; } }
    // Cổng TTĐT luôn có FILE PDF THẬT theo mã văn bản (trình xem PDF của cổng đọc từ đây) — tải thẳng, không cần mở trang
    if (!link && /^[0-9a-f-]{36}$/i.test(String(o.Id || ''))) link = `${base}/Temp/LawDocument/LawDocumentRender/${o.Id}.pdf`;
    return { so: soOf(String(o.Notation || '')), ngay: parseAspDate(o.CreatedDate), trichYeu: clean(String(o.Subject || '')), luot: Number(o.LuotXem) || 0, id: String(o.Id || ''), link };
  });
}

// Quét toàn bộ cổng TTĐT qua API (best-effort): cổng nào lỗi/không có service thì bỏ qua, không ảnh hưởng cổng khác.
export async function crawlPortals(onAdd?: (isNew: boolean) => void, sau = false): Promise<number> {
  let n = 0; const seen = new Set<string>();
  for (const p of PORTALS_DOC) {
    try {
      const docs = await fetchPortalDocs(p.base, sau);
      for (const d of docs) {
        const year = Number((d.ngay || '').slice(0, 4));
        const text = `${d.trichYeu} ${d.so}`;
        if (!d.so || d.trichYeu.length < 8 || !year || !KW.test(text)) continue;  // lấy đất đai/dự án MỌI năm, có số ký hiệu
        const key = `${d.so}|${d.ngay}`;
        if (seen.has(key)) continue;          // chống đếm trùng (cùng văn bản ở nhiều cổng)
        seen.add(key);
        await query(
          `INSERT INTO van_ban (so_hieu, trich_yeu, ngay_ban_hanh, co_quan, chu_de, linh_vuc, nguon, link_goc, luot_tai)
           VALUES ($1,$2,$3,$4,$5,'Đất đai',$6,$7,$8)
           ON CONFLICT (so_hieu, ngay_ban_hanh) DO UPDATE SET
             link_goc = CASE WHEN COALESCE(van_ban.link_goc, '') = '' OR van_ban.link_goc LIKE '%/module/document' THEN EXCLUDED.link_goc ELSE van_ban.link_goc END
           RETURNING (xmax = 0) AS inserted`,
          [d.so, d.trichYeu, d.ngay, p.ten.startsWith('Cổng') ? p.ten : `Cổng ${p.ten}`, classify(text), p.ten.startsWith('Cổng') ? p.ten : `Cổng ${p.ten}`, // tên đã có chữ "Cổng" thì không chắp thêm (từng ra "Cổng Cổng tỉnh…")
           d.link || `${p.base}/module/document`, d.luot]
        ).then((rs: any) => { n++; onAdd?.(!!(rs && rs[0] && rs[0].inserted)); }).catch(() => {});
      }
    } catch { /* cổng lỗi/timeout → bỏ qua */ }
    await new Promise((z) => setTimeout(z, 300));
  }
  console.log(`[van-ban] crawl ${PORTALS_DOC.length} cổng TTĐT (DMS API): ${n} văn bản`);
  return n;
}

// ── NGUỒN BỔ SUNG: camhomes.vn/van-ban (6/10/2026) ──
// Chủ dự án: "nguồn văn bản chất lượng, có chọn lọc" — văn bản địa phương Cam Lâm / Cam Ranh mà Công báo và cổng
// TTĐT ít có: thông báo kiểm kê, niêm yết phương án bồi thường từng đợt, của Chi nhánh Phát triển quỹ đất, UBND các xã…
// Dùng CHUNG nền tảng với các bộ lấy ở trên: cùng bảng, cùng khoá chống trùng (số ký hiệu + ngày), cùng lịch chạy,
// cùng nút "Cập nhật" trong trang quản lý văn bản. KHÔNG lọc từ khoá như Công báo vì nguồn này đã chọn lọc sẵn.
//   · Danh sách: /van-ban/ (trang 1) và /van-ban/page-N/ (trang sau) — 50 văn bản/trang, mới → cũ.
//     (Đường /van-ban/?page=N hiện trên trang KHÔNG chạy với máy, luôn trả trang 1.)
//   · File PDF: trang chi tiết nhúng trình xem PDF.js, file thật ở
//     /index.php?language=vi&nv=van-ban&op=detail/<đường-dẫn>&download=1&id=0  (trả thẳng application/pdf).
//   · Văn bản trùng với Công báo / cổng TTĐT thì GIỮ link cũ (nguồn nhà nước), chỉ bổ sung khi chưa có link.
//   · Văn bản không có số ký hiệu (niêm yết, thông báo danh sách…) ghi "Không số (mã)" để khoá chống trùng vẫn chạy.
//   · Lượt tải của họ KHÔNG chép sang (đó là số liệu của web khác).
const CAMHOMES = 'https://camhomes.vn';
const coQuanCH = (s: string) => {
  const t = clean(s);
  if (!t || /^khác$/i.test(t)) return 'Khác';
  return t.toLocaleLowerCase('vi')
    .replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toLocaleUpperCase('vi'))
    .replace(/(^|\s)Ubnd(?=\s|$)/g, '$1UBND').replace(/(^|\s)Hđnd(?=\s|$)/g, '$1HĐND')
    .replace(/(^|\s)(Xã|Phường|Tỉnh|Huyện|Thị Trấn|Khu Vực|Thành Phố)(?=\s)/g, (_m, a, w) => a + w.toLocaleLowerCase('vi'))
    // Tên riêng của cơ quan viết đúng chính tả (nguồn ghi IN HOA hết, tự đổi chữ thường thì sai mấy chỗ này)
    .replace('Thủ Tướng Chính Phủ', 'Thủ tướng Chính phủ').replace('Bộ Xây Dựng', 'Bộ Xây dựng')
    .replace(/^(Chi Nhánh|Cn) Phát Triển Quỹ Đất/, 'Chi nhánh Phát triển quỹ đất').replace('Nn&mt', 'NN&MT')
    .replace('Sở Tài Chính', 'Sở Tài chính').replace('Sở Giao Thông Vận Tải', 'Sở Giao thông vận tải')
    .replace('Sở Tài Nguyên Và Môi Trường', 'Sở Tài nguyên và Môi trường').replace('Sở Nông Nghiệp Và Môi Trường', 'Sở Nông nghiệp và Môi trường');
};
function parseCamhomes(html: string) {
  const out: { id: string; so: string; ngay: string; coQuan: string; trichYeu: string; slug: string }[] = [];
  for (const tr of html.match(/<tr>[\s\S]*?<\/tr>/gi) || []) {
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (tds.length < 7) continue;
    const a = tds[1].match(/href="\/van-ban\/detail\/([^"]+?)-(\d+)\/"[^>]*title="([^"]*)"[^>]*>([^<]*)</i);
    if (!a) continue;
    const d = tds[3].match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    out.push({
      slug: `${a[1]}-${a[2]}`, id: a[2],
      so: clean(a[4]).replace(/^Số[:\s]*/i, ''),
      ngay: d ? `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}` : '',
      coQuan: coQuanCH(tds[4]),
      trichYeu: clean(a[3]) || clean(tds[5]),
    });
  }
  return out;
}
/** Link có trả về FILE PDF thật không (chỉ đọc 4 byte đầu). */
async function laPdf(u: string): Promise<boolean> {
  try {
    const r = await fetch(u, { headers: { ...UA, Range: 'bytes=0-3' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return false;
    if (/pdf/i.test(r.headers.get('content-type') || '')) return true;
    return Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString() === '%PDF';
  } catch { return false; }
}
let lastCamhomes = 0;
/** deep = duyệt hết các trang (lúc khởi động / bấm Cập nhật); thường = 3 trang mới nhất. */
export async function crawlCamhomes(deep = false, onAdd?: (isNew: boolean) => void): Promise<number> {
  if (!deep && Date.now() - lastCamhomes < 5 * 3600 * 1000) return 0; // lịch 6 giờ/lần, chặn chạy dồn
  lastCamhomes = Date.now();
  const MAX = deep ? 40 : 3;
  const seen = new Set<string>();
  let n = 0;
  for (let pg = 1; pg <= MAX; pg++) {
    let rows: ReturnType<typeof parseCamhomes>;
    try {
      const r = await fetch(pg === 1 ? `${CAMHOMES}/van-ban/` : `${CAMHOMES}/van-ban/page-${pg}/`, { headers: UA, signal: AbortSignal.timeout(15000) });
      if (!r.ok) break;
      rows = parseCamhomes(await r.text());
    } catch { break; }
    const moi = rows.filter((x) => !seen.has(x.id));
    if (!moi.length) break;                              // hết trang (máy chủ trả lại trang cũ) → dừng
    for (const x of moi) {
      seen.add(x.id);
      if (!x.ngay || x.trichYeu.length < 8) continue;
      const so = x.so || `Không số (${x.id})`;
      const taiVe = `${CAMHOMES}/index.php?language=vi&nv=van-ban&op=detail/${x.slug}&download=1&id=0`;
      // Một số văn bản camhomes CHỈ cho thành viên của họ tải: link trả về trang ĐĂNG NHẬP camhomes thay vì PDF
      // (chủ dự án bấm tải bị đưa sang trang đăng nhập của họ, 6/10/2026). Thử trước — không phải PDF thì KHÔNG ghi link
      // → web hiện "—", không bao giờ dẫn khách sang trang đăng nhập web khác.
      const link = await laPdf(taiVe) ? taiVe : null;
      await query(
        `INSERT INTO van_ban (so_hieu, trich_yeu, ngay_ban_hanh, co_quan, chu_de, linh_vuc, nguon, link_goc)
         VALUES ($1,$2,$3,$4,$5,'Đất đai','camhomes.vn',$6)
         ON CONFLICT (so_hieu, ngay_ban_hanh) DO UPDATE SET
           link_goc = CASE WHEN COALESCE(van_ban.link_goc, '') = '' OR van_ban.link_goc LIKE 'https://camhomes.vn/%'
                           THEN EXCLUDED.link_goc ELSE van_ban.link_goc END
         RETURNING (xmax = 0) AS inserted`,
        [so, x.trichYeu, x.ngay, x.coQuan, classify(x.trichYeu), link])
        .then((rs: any) => { n++; onAdd?.(!!(rs && rs[0] && rs[0].inserted)); }).catch(() => {});
    }
    await new Promise((z) => setTimeout(z, 800)); // lịch sự với máy chủ nguồn (web nhỏ)
  }
  console.log(`[van-ban] crawl camhomes.vn: ${n} văn bản (${seen.size} mục đã duyệt)`);
  return n;
}

// ── NGUỒN BỔ SUNG: 2 BẢNG GOOGLE chủ dự án gửi (6/10/2026) — văn bản dự án Khu đô thị mới Cam Lâm ──
//   1. "Danh sách quyết định thu hồi đất đô thị mới Cam Lâm 2026" (Google Sheets): Số ký hiệu · Ngày ký · Nội dung.
//      Số dạng 735/QĐ-UBND (có chỗ ghi "QĐ UBND") — của UBND xã Cam Lâm. Bảng không kèm file.
//   2. "Niêm yết dự thảo phương án chi tiết về bồi thường, hỗ trợ, TĐC dự án KĐT mới Cam Lâm" (file Excel trên Drive):
//      cột B "3363/CNKVCL 24/9/2026", cột C nội dung + LIÊN KẾT tới file/thư mục Google Drive (đọc công khai).
//      Số ghi lại thành "3363/TB-CNKVCL" cho trùng cách ghi của camhomes.vn → cùng số + ngày thì không nhân đôi.
// Tải dạng xlsx (CSV làm mất liên kết), đọc bằng exceljs. Chạy cùng lịch 6 giờ với cổng TTĐT + nút "Cập nhật".
// Liên kết Drive dạng "open?id=…" phần lớn là THƯ MỤC (mỗi văn bản một thư mục, trong có 1–3 file PDF).
// Trước đây ghi nhầm thành trang XEM FILE (file/d/<id>/view) → Drive báo "Không có bản xem trước" (6/10/2026).
// Nay máy chủ tự mở thư mục, tải các file PDF bên trong, ghép thành MỘT file rồi đưa người xem (xem layPdfDrive).
const SHEETS = [
  { ten: 'thu-hoi', url: 'https://docs.google.com/spreadsheets/d/1rHOtnGclptr637qY7elA46Jfs3oirt954t14grglJ1w/export?format=xlsx', xem: 'https://docs.google.com/spreadsheets/d/1rHOtnGclptr637qY7elA46Jfs3oirt954t14grglJ1w/edit' },
  { ten: 'niem-yet', url: 'https://docs.google.com/spreadsheets/d/1Ie7ddfiDybzNDk_JWdiXmeCK2Rjk9BFt/export?format=xlsx', xem: 'https://docs.google.com/spreadsheets/d/1Ie7ddfiDybzNDk_JWdiXmeCK2Rjk9BFt/preview' },
];
const giaTri = (v: any): any => (v && typeof v === 'object' ? (v.result ?? v.text ?? (v.richText ? v.richText.map((t: any) => t.text).join('') : v)) : v);
const ngayIso = (v: any): string => {
  v = giaTri(v);
  if (v instanceof Date) return new Date(v.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  const m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};
// ── GOOGLE DRIVE: lấy PDF từ thư mục/file công khai (không cần khoá API) ──
//   · Thư mục: trang "embeddedfolderview" liệt kê file công khai → lấy mã + tên từng file.
//   · File: drive.usercontent.google.com/download?id=…&confirm=t trả thẳng nội dung (confirm=t để qua bước hỏi quét virus của file lớn).
// Thư mục có nhiều PDF (vd …-001 thông báo, …-002 phụ lục) → ghép theo thứ tự tên bằng qpdf thành MỘT file.
// Giữ bản đã ghép ở /app/.kho-van-ban (ổ bền, không mất khi dựng lại) — xem thêm taiSanFile().
const idDrive = (u: string) => (u.match(/[?&]id=([\w-]{20,})/) || u.match(/\/(?:folders|d)\/([\w-]{20,})/) || [])[1] || '';
async function dsFileDrive(id: string): Promise<{ id: string; ten: string }[] | null> {
  try {
    const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { headers: UA, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;                                  // không phải thư mục (hoặc không công khai)
    const html = await r.text(); const ra: { id: string; ten: string }[] = [];
    const re = /\/file\/d\/([\w-]{20,})[^"]*"[\s\S]*?flip-entry-title">([^<]+)</g; let m;
    while ((m = re.exec(html))) ra.push({ id: m[1], ten: m[2].trim() });
    return ra;
  } catch { return null; }
}
async function taiDrive(id: string): Promise<Buffer | null> {
  try {
    const r = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { headers: UA, signal: AbortSignal.timeout(120000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.subarray(0, 4).toString() === '%PDF' ? b : null;
  } catch { return null; }
}
const KHO_DRIVE = process.env.VAN_BAN_KHO || '/app/.kho-van-ban';
// TẢI SẴN (chủ dự án 6/10/2026 "tải văn bản hơi lâu"): lần đầu mở một văn bản Drive phải tải 2–8 MB rồi ghép → 5–10 giây.
// Nên sau mỗi lượt lấy văn bản, máy tự tải sẵn MỌI văn bản Drive chưa có trong kho, từng cái một (nhẹ cho mạng nhà).
let dangTaiSan = false;
// CHỈ LƯU KHI CÓ NGƯỜI MỞ (chủ dự án 6/10/2026: "đừng tải văn bản về sever vội, người dùng đầu tiên tải về thì lưu luôn")
// → KHÔNG tải sẵn hàng loạt nữa. Văn bản nào có người mở lần đầu thì layFileVb() tải + gắn dấu + nén + lưu; người sau mở ngay.
// Văn bản không ai xem thì không tốn chỗ. Hàm này giờ chỉ DỌN các bản của phiên xử lý cũ (đổi PHIEN_BAN_FILE) + file tạm sót lại.
export async function taiSanFile(): Promise<number> {
  if (dangTaiSan) return 0; dangTaiSan = true; let n = 0;
  try {
    for (const f of await readdir(KHO_DRIVE).catch(() => [] as string[])) {
      const cu = /^vb-/.test(f) && !f.startsWith(`vb-${PHIEN_BAN_FILE}-`);
      const tam = /^(nen-|tam-)/.test(f) || /^[\w-]{20,}\.pdf$/.test(f);   // file tạm + bản Drive chưa nén của bản đầu
      if (cu || tam) { await rm(`${KHO_DRIVE}/${f}`, { force: true }); n++; }
    }
    if (n) console.log(`[van-ban] dọn kho file văn bản: xoá ${n} file cũ`);
  } catch (e: any) { console.error('[van-ban] dọn kho lỗi:', e?.message || e); } finally { dangTaiSan = false; }
  return n;
}
/** Tải + ghép PDF trong thư mục/file Drive. KHÔNG tự lưu — việc lưu (bản đã nén) do layFileVb() lo. */
export async function layPdfDrive(link: string): Promise<Buffer | null> {
  const id = idDrive(link); if (!id) return null;
  const cu = `${KHO_DRIVE}/${id}.pdf`;                 // bản chưa nén của lần chạy trước (6/10/2026) → dùng làm nguồn, đỡ tải lại
  try { const b = await readFile(cu); rm(cu, { force: true }).catch(() => {}); return b; } catch { /* không có → tải */ }
  const ds = await dsFileDrive(id);
  const pdfs = ds && ds.length ? ds.filter((x) => /\.pdf$/i.test(x.ten)).sort((a, b) => a.ten.localeCompare(b.ten)) : [{ id, ten: '' }];
  const bufs: Buffer[] = [];
  for (const x of pdfs) { const b = await taiDrive(x.id); if (b) bufs.push(b); }
  if (!bufs.length) return null;
  if (bufs.length === 1) return bufs[0];
  await mkdir(KHO_DRIVE, { recursive: true });
  const tam = bufs.map((_, i) => `${KHO_DRIVE}/tam-${id}-${i}.pdf`), ra = `${KHO_DRIVE}/tam-${id}.pdf`;
  try {
    await Promise.all(bufs.map((b, i) => writeFile(tam[i], b)));
    await promisify(execFile)('qpdf', ['--empty', '--pages', ...tam, '--', ra], { timeout: 60000 }).catch((e: any) => { if (e?.code !== 3) throw e; }); // mã 3 = cảnh báo, file vẫn ra
    return await readFile(ra);
  } catch { return bufs[0]; } finally { await Promise.all([...tam, ra].map((t) => rm(t, { force: true }))); }
}

// ── DẤU BẢN QUYỀN + NÉN + LƯU FILE VĂN BẢN (chủ dự án 6/10/2026) ──
// 1) DẤU BẢN QUYỀN: file tải về bị chia sẻ đi đâu cũng thành quảng cáo cho web → mỗi trang thêm
//    · chữ "CAM LÂM LAND" chéo giữa trang, rất mờ (không che nội dung văn bản);
//    · một dòng nhỏ ở mép dưới: "Tải miễn phí tại batdongsancamlam.vn — Cam Lâm Land · …".
//    Phông DejaVu (có sẵn trong máy chủ, đủ dấu tiếng Việt). Gắn TRƯỚC khi nén để Ghostscript cắt gọn phông.
// 2) NÉN SÂU — đã đo trên 12 file thật (31,3 MB → 4,3 MB, nhẹ 86%):
//    · thủ phạm chính KHÔNG phải ảnh mà là PHÔNG CHỮ nhúng nguyên bộ (Times New Roman vài MB/file) → cắt gọn chỉ giữ chữ dùng;
//    · ảnh màu/xám (dấu đỏ, chữ ký) hạ 100 điểm ảnh/inch, ảnh đen trắng 200; ảnh trùng nhau chỉ giữ 1 bản;
//    · qpdf gom các mảnh nhỏ thành luồng nén chung, nén lại mức cao nhất.
//    Ép JPEG mạnh hơn chỉ bớt thêm ~1% mà làm dấu đỏ nhoè → không dùng.
// Kho CHỈ giữ bản đã xử lý (vb-<phiên bản>-<mã>.pdf); đổi cách xử lý thì tăng PHIEN_BAN_FILE để làm lại.
const PHIEN_BAN_FILE = 'v9';   // v9 (7/10/2026): chữ chéo nghiêng ít hơn (30° thay vì theo đường chéo); v8 (6/10/2026): chèn thêm trang 2 trắng có dấu bản quyền; v7: dấu bản quyền ghi tên miền mới batdongsancamlam.vn; v6: chữ chéo nhỏ lại; v4: chữ chéo 2 dòng (thêm link + SĐT) vẽ bằng xoay hệ toạ độ — không đè nhau; gắn cho MỌI văn bản
const PHONG_DAU = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
async function ganDauBanQuyen(buf: Buffer): Promise<Buffer> {
  try {
    const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix } = (await import('pdf-lib')) as any;
    const fontkit = ((await import('@pdf-lib/fontkit')) as any).default;
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(await readFile(PHONG_DAU), { subset: true });
    const chan = 'Tải miễn phí tại batdongsancamlam.vn · Hotline/Zalo 0988 888 888 — Cam Lâm Land · Nhà đất & bản đồ quy hoạch Cam Lâm';
    const chu1 = 'CAM LÂM LAND', chu2 = 'batdongsancamlam.vn  ·  0988 888 888';
    // TRANG 2 CHÈN THÊM (chủ dự án 6/10/2026, gửi hình mẫu): một trang trắng cùng khổ với trang 1 (theo mắt người đọc),
    // chỉ có chữ chéo + dòng chân trang như mọi trang khác — chèn vào sau trang 1 (file 1 trang thì thành trang cuối).
    // Tạo TRƯỚC vòng lặp để trang này cũng được vẽ dấu y hệt các trang khác.
    {
      const p1 = doc.getPage(0); const { width: W1, height: H1 } = p1.getSize();
      const x1 = ((p1.getRotation()?.angle || 0) % 360 + 360) % 360;
      const kho: [number, number] = x1 === 90 || x1 === 270 ? [H1, W1] : [W1, H1];
      doc.insertPage(Math.min(1, doc.getPageCount()), kho);
    }
    for (const page of doc.getPages()) {
      const { width: W, height: H } = page.getSize();
      const xoay = ((page.getRotation()?.angle || 0) % 360 + 360) % 360;
      const ngang = xoay === 90 || xoay === 270;
      const w = ngang ? H : W, h = ngang ? W : H;       // khổ trang THEO MẮT NGƯỜI ĐỌC
      // Ma trận đổi toạ độ "theo mắt người đọc" → toạ độ thật của trang (trang có thể bị đặt xoay 90/180/270)
      const M = xoay === 90 ? [0, 1, -1, 0, W, 0] : xoay === 180 ? [-1, 0, 0, -1, W, H] : xoay === 270 ? [0, -1, 1, 0, 0, H] : [1, 0, 0, 1, 0, 0];
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...M));
      // CHỮ CHÉO GIỮA TRANG — 2 dòng: "CAM LÂM LAND" + link web & SĐT (chủ dự án 6/10/2026: chân trang dễ bị xén mất
      // "thì công cốc" → link + SĐT phải nằm cả giữa trang). Xoay hệ toạ độ quanh tâm trang theo đường chéo rồi viết 2 dòng
      // như viết ngang bình thường → khoảng cách 2 dòng luôn đúng (bản tính tay từng điểm bị đè dòng).
      // Góc nghiêng: trước chạy theo đường chéo trang (~55° với trang dọc) → chủ dự án 7/10/2026 "nghiêng ít hơn" → cố định 30°
      const goc = Math.PI / 6, c = Math.cos(goc), sn = Math.sin(goc), cheo = Math.hypot(w, h);
      // Cỡ chữ chéo: bản đầu to quá (chủ dự án 6/10/2026 "hơi to") → chữ lớn ~7% cạnh ngắn, dài tối đa 45% đường chéo
      // và không tràn quá 85% bề ngang trang (nghiêng ít thì chữ chiếm bề ngang nhiều hơn)
      const dai = Math.min(cheo * 0.45, w * 0.85 / c);
      let to = Math.min(w, h) * 0.07; while (font.widthOfTextAtSize(chu1, to) > dai) to *= 0.92;
      let nho = to * 0.42; while (font.widthOfTextAtSize(chu2, nho) > dai) nho *= 0.92;
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(c, sn, -sn, c, w / 2, h / 2));
      page.drawText(chu1, { x: -font.widthOfTextAtSize(chu1, to) / 2, y: to * 0.35, size: to, font, color: rgb(0.78, 0.6, 0.22), opacity: 0.15 });
      page.drawText(chu2, { x: -font.widthOfTextAtSize(chu2, nho) / 2, y: -to * 0.75, size: nho, font, color: rgb(0.04, 0.15, 0.25), opacity: 0.22 });
      page.pushOperators(popGraphicsState());
      // DÒNG CHÂN TRANG (giữ như cũ, thêm số điện thoại)
      let co = 7.5; while (co > 4.5 && font.widthOfTextAtSize(chan, co) > w - 24) co -= 0.5;
      page.drawText(chan, { x: (w - font.widthOfTextAtSize(chan, co)) / 2, y: 6, size: co, font, color: rgb(0.04, 0.15, 0.25), opacity: 0.7 });
      page.pushOperators(popGraphicsState());
    }
    doc.setProducer('Cam Lâm Land — batdongsancamlam.vn');
    return Buffer.from(await doc.save({ useObjectStreams: true }));
  } catch (e: any) { console.error('[van-ban] gắn dấu bản quyền lỗi:', e?.message || e); return buf; }
}
async function nenPdf(buf: Buffer): Promise<Buffer> {
  await mkdir(KHO_DRIVE, { recursive: true });
  const k = `${KHO_DRIVE}/nen-${Date.now()}-${Math.random().toString(36).slice(2)}`, vao = `${k}-a.pdf`, giua = `${k}-b.pdf`, ra = `${k}-c.pdf`;
  try {
    await writeFile(vao, buf);
    await promisify(execFile)('gs', ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dNOPAUSE', '-dBATCH', '-dQUIET',
      '-dDetectDuplicateImages=true', '-dCompressFonts=true', '-dSubsetFonts=true',
      '-dDownsampleColorImages=true', '-dColorImageResolution=100', '-dDownsampleGrayImages=true', '-dGrayImageResolution=100',
      '-dDownsampleMonoImages=true', '-dMonoImageResolution=200',
      '-dColorImageDownsampleThreshold=1.0', '-dGrayImageDownsampleThreshold=1.0', '-dMonoImageDownsampleThreshold=1.0',
      `-sOutputFile=${giua}`, vao], { timeout: 240000 });
    await promisify(execFile)('qpdf', ['--object-streams=generate', '--recompress-flate', '--compression-level=9', giua, ra], { timeout: 60000 })
      .catch((e: any) => { if (e?.code !== 3) throw e; });
    const b = await readFile(ra);
    return b.subarray(0, 4).toString() === '%PDF' && b.length < buf.length ? b : buf; // nén không lợi thì giữ nguyên
  } catch { return buf; } finally { await Promise.all([vao, giua, ra].map((t) => rm(t, { force: true }))); }
}
/** Lấy file GỐC của văn bản từ nguồn (Drive / cổng TTĐT / Công báo / camhomes). */
async function layFileGoc(link: string | null): Promise<Buffer | null> {
  if (!link) return null;
  if (/drive\.google\.com/.test(link)) return layPdfDrive(link);
  const pdf = await resolvePdf(link); if (!pdf) return null;
  let ref = ''; try { ref = new URL(link).origin + '/'; } catch { /* bỏ qua */ }
  try {
    const r = await fetch(pdf, { headers: { ...UA, ...(ref ? { Referer: ref } : {}) }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.subarray(0, 4).toString() === '%PDF' ? b : null;
  } catch (e: any) {
    // Cổng nhà nước để CHỨNG CHỈ HẾT HẠN (vd camranh.khanhhoa.gov.vn, 7/10/2026) → tải lại bỏ qua kiểm chứng chỉ.
    // Chỉ cho tên miền .gov.vn, và file vẫn phải đúng PDF mới nhận.
    const ma = String(e?.cause?.code || '');
    if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(ma) && /\.gov\.vn$/i.test(new URL(pdf).hostname)) return taiBoQuaChungChi(pdf, ref);
    return null;
  }
}
async function taiBoQuaChungChi(u: string, ref: string, lan = 0): Promise<Buffer | null> {
  const https = await import('node:https');
  return new Promise((xong) => {
    const rq = https.get(u, { rejectUnauthorized: false, headers: { ...UA, ...(ref ? { Referer: ref } : {}) }, timeout: 60000 }, (r) => {
      if (r.statusCode && r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && lan < 3) {
        r.resume(); xong(taiBoQuaChungChi(new URL(r.headers.location, u).href, ref, lan + 1)); return;
      }
      if (r.statusCode !== 200) { r.resume(); xong(null); return; }
      const ds: Buffer[] = []; r.on('data', (c) => ds.push(c)); r.on('error', () => xong(null));
      r.on('end', () => { const b = Buffer.concat(ds); xong(b.subarray(0, 4).toString() === '%PDF' ? b : null); });
    });
    rq.on('timeout', () => rq.destroy()); rq.on('error', () => xong(null));
  });
}
const dangLay = new Map<number, Promise<Buffer | null>>();   // nhiều người bấm cùng lúc một văn bản → chỉ tải 1 lần
export function layFileVb(id: number, link: string | null): Promise<Buffer | null> {
  const f = `${KHO_DRIVE}/vb-${PHIEN_BAN_FILE}-${id}.pdf`;
  if (dangLay.has(id)) return dangLay.get(id)!;
  const p = (async () => {
    try { return await readFile(f); } catch { /* chưa có */ }
    const goc = await layFileGoc(link); if (!goc) return null;
    const nen = await nenPdf(await ganDauBanQuyen(goc));
    await mkdir(KHO_DRIVE, { recursive: true }); await writeFile(f, nen).catch(() => {});
    return nen;
  })().finally(() => dangLay.delete(id));
  dangLay.set(id, p); return p;
}

// ── FILE GỐC CỦA BẢNG "QUYẾT ĐỊNH THU HỒI ĐẤT" (tìm ra 6/10/2026) ──
// Cổng xã Cam Lâm có trang "Quyết định thu hồi đất đô thị mới Cam Lâm" nhúng thư mục Drive công khai chứa bản PDF
// đã ký số của từng quyết định; tên file bắt đầu bằng số quyết định ("1000.signed thu hồi đất của ông …").
// Đọc trang đó → mọi thư mục Drive trong trang → map số quyết định → các file. Một số có 2 file (2 thửa khác nơi)
// thì chọn file có tên khớp nhiều chữ nhất với trích yếu.
const TRANG_QD_THU_HOI = ['https://camlam.khanhhoa.gov.vn/vi/dat-dai/quyet-dinh-thu-hoi-dat-do-thi-moi-cam-lam'];
async function fileThuHoiCongXa(): Promise<Map<string, { id: string; ten: string }[]>> {
  const map = new Map<string, { id: string; ten: string }[]>();
  for (const trang of TRANG_QD_THU_HOI) {
    try {
      const html = await (await fetch(trang, { headers: UA, signal: AbortSignal.timeout(20000) })).text();
      const thuMuc = new Set([...html.matchAll(/drive\.google\.com\/(?:drive\/folders\/|embeddedfolderview\?id=)([\w-]{20,})/g)].map((x) => x[1]));
      for (const tm of thuMuc) for (const f of (await dsFileDrive(tm)) || []) {
        const so = (f.ten.match(/^\s*(\d+)/) || [])[1];
        if (so && /\.pdf$/i.test(f.ten)) map.set(so, [...(map.get(so) || []), f]);
      }
    } catch (e: any) { console.error('[van-ban] đọc trang QĐ thu hồi đất lỗi:', e?.message || e); }
  }
  console.log(`[van-ban] file QĐ thu hồi đất trên cổng xã: ${map.size} số quyết định`);
  return map;
}
function chonFileQd(ds: { id: string; ten: string }[] | undefined, ty: string): string {
  if (!ds?.length) return '';
  const tu = new Set(vnNoAccentLite(ty.replace(/\.\.\.$/, '')).split(/\s+/).filter((w) => w.length > 1));
  const diem = (t: string) => vnNoAccentLite(t).split(/\s+/).filter((w) => tu.has(w)).length;
  const tot = [...ds].sort((a, b) => diem(b.ten) - diem(a.ten))[0];
  return `https://drive.google.com/open?id=${tot.id}`;
}

let lastSheets = 0;
export async function crawlSheets(force = false, onAdd?: (isNew: boolean) => void): Promise<number> {
  if (!force && Date.now() - lastSheets < 5 * 3600 * 1000) return 0;
  lastSheets = Date.now();
  const ExcelJS = (await import('exceljs')).default;
  let n = 0;
  const fileQd = await fileThuHoiCongXa();
  for (const sh of SHEETS) {
    try {
      const r = await fetch(sh.url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (!r.ok) continue;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(Buffer.from(await r.arrayBuffer()) as any);
      const ws = wb.worksheets[0];
      const rows: { so: string; ngay: string; ty: string; link: string; cq: string }[] = [];
      ws.eachRow((row) => {
        const b = String(giaTri(row.getCell(2).value) ?? '').trim();
        if (sh.ten === 'thu-hoi') {
          const m = b.match(/^(\d+)\s*\/\s*QĐ[\s-]*UBND$/i);
          const ty = clean(String(giaTri(row.getCell(4).value) ?? ''));
          // Bảng không kèm file → lấy file từ thư mục Drive mà CỔNG XÃ CAM LÂM công bố (tên file bắt đầu bằng số quyết định)
          if (m && ty) rows.push({ so: `${m[1]}/QĐ-UBND`, ngay: ngayIso(row.getCell(3).value), ty, link: chonFileQd(fileQd.get(m[1]), ty), cq: 'UBND xã Cam Lâm' });
        } else {
          const m = b.match(/^(\d+)\s*\/\s*CNKVCL\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
          const c: any = row.getCell(3);
          const ty = clean(String(giaTri(c.value) ?? ''));
          const id = idDrive(String(c.hyperlink || c.value?.hyperlink || row.getCell(2).hyperlink || ''));
          if (m && ty.length > 8) rows.push({ so: `${m[1]}/TB-CNKVCL`, ngay: ngayIso(m[2]), ty, link: id ? `https://drive.google.com/open?id=${id}` : '', cq: 'Chi nhánh Phát triển quỹ đất khu vực Cam Lâm' });
        }
      });
      for (const x of rows) {
        if (!x.ngay) continue;
        await query(
          `INSERT INTO van_ban (so_hieu, trich_yeu, ngay_ban_hanh, co_quan, chu_de, linh_vuc, nguon, link_goc)
           VALUES ($1,$2,$3,$4,$5,'Bồi thường - TĐC','Bảng tổng hợp KĐT mới Cam Lâm',$6)
           ON CONFLICT (so_hieu, ngay_ban_hanh) DO UPDATE SET
             link_goc = CASE WHEN EXCLUDED.link_goc <> '' AND (van_ban.link_goc IS NULL OR van_ban.link_goc = '' OR van_ban.link_goc LIKE '%drive.google.com%')
                             THEN EXCLUDED.link_goc ELSE van_ban.link_goc END
           RETURNING (xmax = 0) AS inserted`,
          [x.so, x.ty, x.ngay, x.cq, classify(x.ty), x.link])
          .then((rs: any) => { n++; onAdd?.(!!(rs && rs[0] && rs[0].inserted)); }).catch(() => {});
      }
      console.log(`[van-ban] bảng ${sh.ten}: ${rows.length} dòng`);
    } catch (e: any) { console.error(`[van-ban] bảng ${sh.ten} lỗi:`, e?.message || e); }
  }
  return n;
}

// ══ TỰ TÌM FILE Ở NGUỒN CHÍNH THỐNG (chủ dự án 6/10/2026) ══════════════════════════════════════════════
// Văn bản nào CHƯA mở được file (không link, link trang chung "/module/document", link trang tìm kiếm thuvienphapluat,
// link camhomes bị khoá đăng nhập, bảng tổng hợp không kèm file) thì máy TỰ tìm trên các cổng TTĐT của tỉnh/xã:
//   · có số ký hiệu → tìm theo SỐ (DMSSearch notation), khớp số + ngày lệch ≤ 3 ngày;
//   · "Không số"   → tìm theo TRÍCH YẾU (6 từ đầu), khớp ngày lệch ≤ 3 ngày.
// Tìm thấy → gắn link FILE PDF THẬT của cổng (Temp/LawDocument/LawDocumentRender/<mã>.pdf), đã thử tải được mới gắn.
// KHÔNG BAO GIỜ trỏ người dùng sang trang khác để tự tìm. Văn bản đã thử mà chưa thấy thì 3 ngày sau mới thử lại
// (cột tim_file_luc) cho đỡ tải cổng. Chạy sau mỗi lượt lấy văn bản (khởi động + lịch 6 giờ + nút Cập nhật).
// Drive (thư mục/file công khai) TÍNH là có file — máy chủ tự tải + ghép PDF (layPdfDrive)
// /VanBan/Download/<số> = link tải thẳng của cổng phường/xã kiểu mới (camranh, nhatrang…), trả về PDF
const coFileThat = (link: string | null) => !!link && (/LawDocumentRender|FileVanBans|\.pdf(\?|$)|drive\.google\.com\/open\?id=|\/VanBan\/Download\/\d+$/i.test(link) || /[?&]download=1(&|$)/i.test(link));
// Cổng KHÔNG lọc thật khi tìm theo trích yếu (trả văn bản bất kỳ) → phải tự so: ≥ 70% từ đầu trích yếu có trong kết quả
const khopTrichYeu = (a: string, b: string) => { const bo = (x: string) => vnNoAccentLite(x).split(/\s+/).filter((w) => w.length > 1); const ta = bo(a).slice(0, 10), tb = new Set(bo(b)); return ta.length >= 4 && ta.filter((w) => tb.has(w)).length / ta.length >= 0.7; };
const vnNoAccentLite = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
async function timTrenCong(base: string, notation: string, subject: string) {
  const body = JSON.stringify({ notation, subject, content: '', idField: EMPTY_GUID, idCategory: EMPTY_GUID, idCategories: EMPTY_GUID, dateBegin: '', dateEnd: '', isCopy: false, starIndex: 0, endIndex: 10 });
  try {
    const r = await fetch(`${base}/Services/DMSSearch.asmx/Search`, { method: 'POST', body, headers: { ...UA, 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const j: any = await r.json().catch(() => null); let s: string = j && typeof j.d === 'string' ? j.d : '';
    const i = s.lastIndexOf('_'); if (i > 0) s = s.slice(0, i);
    const arr = JSON.parse(s || '[]');
    return Array.isArray(arr) ? arr.map((o: any) => ({ id: String(o.Id || ''), so: soOf(String(o.Notation || '')), ngay: parseAspDate(o.CreatedDate), ty: clean(String(o.Subject || '')) })) : [];
  } catch { return []; }
}
const lechNgay = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 864e5);
const chuanSo = (s: string) => s.toUpperCase().replace(/\s+/g, '').replace(/Đ/g, 'D');
let dangTim = false;
export async function timFileThieu(onAdd?: (isNew: boolean) => void): Promise<number> {
  if (dangTim) return 0; dangTim = true;
  let n = 0;
  try {
    const ds = await query<any>(`SELECT id, so_hieu, trich_yeu, to_char(ngay_ban_hanh,'YYYY-MM-DD') AS ngay, nguon, link_goc FROM van_ban
      WHERE (tim_file_luc IS NULL OR tim_file_luc < now() - interval '3 days') ORDER BY ngay_ban_hanh DESC NULLS LAST`);
    const thieu = ds.filter((d) => !coFileThat(d.link_goc));
    // Cổng nguồn của chính văn bản thử trước, rồi Cổng tỉnh, rồi các cổng còn lại
    const thuTu = (nguon: string) => { const goc = PORTALS_DOC.find((p) => `Cổng ${p.ten}` === nguon || p.ten === nguon); return [...(goc ? [goc] : []), ...PORTALS_DOC.filter((p) => p !== goc).sort((a, b) => (a.ten.includes('tỉnh') ? -1 : b.ten.includes('tỉnh') ? 1 : 0))]; };
    for (const d of thieu) {
      const khongSo = /^Không số/.test(d.so_hieu || '');
      const tuKhoa = khongSo ? String(d.trich_yeu || '').split(/\s+/).slice(0, 6).join(' ') : '';
      let link = '';
      for (const p of thuTu(d.nguon)) {
        const kq = await timTrenCong(p.base, khongSo ? '' : d.so_hieu, tuKhoa);
        const hop = kq.find((k) => k.id && (!d.ngay || !k.ngay || lechNgay(k.ngay, d.ngay) <= 3) && (khongSo ? khopTrichYeu(d.trich_yeu || '', k.ty) : chuanSo(k.so) === chuanSo(d.so_hieu)));
        if (hop) {
          const u = `${p.base}/Temp/LawDocument/LawDocumentRender/${hop.id}.pdf`;
          try { const r = await fetch(u, { headers: { ...UA, Range: 'bytes=0-3' }, signal: AbortSignal.timeout(15000) }); if (r.ok && Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString() === '%PDF') link = u; } catch { /* thử cổng khác */ }
          if (link) break;
        }
        await new Promise((z) => setTimeout(z, 150));
      }
      await query(`UPDATE van_ban SET tim_file_luc = now()${link ? ', link_goc = $2' : ''} WHERE id = $1`, link ? [d.id, link] : [d.id]).catch(() => {});
      if (link) { n++; onAdd?.(false); }
    }
    console.log(`[van-ban] tự tìm file: thử ${thieu.length} văn bản thiếu file, tìm được ${n}`);
  } finally { dangTim = false; }
  return n;
}

// Crawl NỀN: /refresh khởi động rồi trả lời NGAY (tránh 524 — Cloudflare cắt kết nối ở ~100s khi crawl sâu).
// Client hỏi tiến độ qua /refresh-status tới khi running=false. Chặn chạy trùng bằng cờ running.
const crawlState = { running: false, added: 0, updated: 0, startedAt: 0, finishedAt: 0, error: '' };
function startCrawlBg(): boolean {
  if (crawlState.running) return false;
  crawlState.running = true; crawlState.added = 0; crawlState.updated = 0; crawlState.startedAt = Date.now(); crawlState.finishedAt = 0; crawlState.error = '';
  const cb = (isNew: boolean) => { if (isNew) crawlState.added++; else crawlState.updated++; };
  (async () => {
    try { await crawlCongBao(true, true, cb); await crawlPortals(cb); await crawlCamhomes(true, cb); await crawlSheets(true, cb); await timFileThieu(cb); taiSanFile().catch(() => {}); }
    catch (e: any) { crawlState.error = e?.message || 'Lỗi crawl'; }
    finally { crawlState.running = false; crawlState.finishedAt = Date.now(); }
  })();
  return true;
}

// Lấy URL PDF trực tiếp từ trang chi tiết. Công báo nhúng PDF qua Google Docs viewer:
//   viewer?url=https://.../Portals/0/FileVanBans\<Ten>.pdf&embedded=true   (đường dẫn dùng dấu '\')
// Chuẩn hoá '\'→'/', mã hoá ký tự tiếng Việt, chấp nhận nhiều dạng.
function normPdf(raw: string, base: string): string | null {
  try {
    let u = decodeURIComponent(raw.trim()).replace(/&amp;/gi, '&').replace(/\\/g, '/');
    if (!/^https?:/i.test(u)) u = new URL(u, base).href;
    return new URL(u).href;        // new URL tự mã hoá ký tự non-ASCII trong path
  } catch { try { return new URL(raw.replace(/\\/g, '/'), base).href; } catch { return null; } }
}
export async function resolvePdf(link: string): Promise<string | null> {
  if (!link) return null;
  if (/\.pdf(\?|$)/i.test(link)) return normPdf(link, link);
  if (/\/VanBan\/Download\/\d+$/i.test(link)) return link; // cổng phường/xã kiểu mới: link tải trả thẳng PDF
  if (/[?&]download=1(&|$)/i.test(link)) return link; // trang nền NukeViet (camhomes, bqlnngt.khanhhoa.gov.vn…): link tải trả thẳng PDF
  try {
    const r = await fetch(link, { headers: UA, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/viewer\?url=([^"'&\s]+\.pdf)/i)                              // 1) Google Docs viewer
      || html.match(/(https?:\/\/[^"'<>\s]*FileVanBans[\\/][^"'<>\s]+\.pdf)/i)          // 2) FileVanBans (\ hoặc /)
      || html.match(/["'(]\s*([^"'()<>\s]+\.pdf)\s*["')]/i);                            // 3) .pdf bất kỳ trong href/src
    if (!m) return null;
    return normPdf(m[1] || m[0], link);
  } catch { return null; }
}

// ── GET / (danh sách) — PHẢI ĐĂNG NHẬP (tiện ích lớp 1, 30/9/2026; trước đây công khai) ──
vanBanRouter.get('/', authRequired, async (req: AuthedRequest, res) => {
  try {
    const rows = await query(`
      SELECT id, so_hieu AS "soKyHieu", trich_yeu AS "trichYeu",
             to_char(ngay_ban_hanh,'YYYY-MM-DD') AS ngay, co_quan AS "coQuan",
             chu_de AS "chuDe", linh_vuc AS "linhVuc", nguon,
             luot_tai AS "luotTai", noi_bat AS "noiBat",
             (link_goc IS NOT NULL AND link_goc <> '') AS "coFile"
      FROM van_ban ORDER BY ngay_ban_hanh DESC NULLS LAST, id DESC LIMIT 8000`);
    res.set('Cache-Control', 'private, max-age=300'); // chỉ trình duyệt của chính người đã đăng nhập giữ — không cho CDN/nginx phát cho người khác
    res.json({ docs: rows });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi' }); }
});

// ── GET /moi-nhat — 4 văn bản mới ban hành cho khối "Tra cứu văn bản" ở TRANG CHỦ (mẫu 105, 7/10/2026) ──
// CÔNG KHAI nhưng chỉ có số hiệu · ngày · cơ quan · trích yếu của 4 văn bản (thông tin công bố công khai của
// nhà nước), không có link file; xem toàn kho + mở file vẫn phải đăng nhập. Chỉ lấy văn bản có file thật.
vanBanRouter.get('/moi-nhat', async (_req, res) => {
  try {
    const rows = await query(`
      SELECT id, so_hieu AS "soKyHieu", trich_yeu AS "trichYeu",
             to_char(ngay_ban_hanh,'YYYY-MM-DD') AS ngay, co_quan AS "coQuan", link_goc
      FROM van_ban WHERE link_goc IS NOT NULL AND link_goc <> '' AND can_kiem_tra IS NULL
      ORDER BY ngay_ban_hanh DESC NULLS LAST, id DESC LIMIT 40`);
    const docs = rows.filter((d: any) => coFileThat(d.link_goc)).slice(0, 4).map(({ link_goc, ...d }: any) => d);
    res.set('Cache-Control', 'public, max-age=600');
    res.json({ docs });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi' }); }
});

// ── GET /tim?q= — Ô TÌM ở trang chủ: tìm ngay tại chỗ, kết quả đẩy lên cột phải (chủ dự án 7/10/2026) ──
// CÔNG KHAI giống /moi-nhat: chỉ số hiệu · ngày · cơ quan · trích yếu + cờ coFile, TỐI ĐA 6 văn bản, không link file.
// Xem toàn kho + mở file vẫn phải đăng nhập. Gõ không dấu vẫn ra (vn_unaccent).
// Nhiều chữ thì MỖI chữ phải có mặt (không cần đúng thứ tự). Trùng số hiệu xếp lên trước.
// Từ dân gian → từ trong văn bản: khách gõ "đền bù" nhưng văn bản ghi "bồi thường" (thử 7/10/2026: ra 0 kết quả).
const TU_DONG_NGHIA: [RegExp, string][] = [[/\bden bu\b/g, 'boi thuong'], [/\bso do\b|\bso hong\b/g, 'giay chung nhan'], [/\bnoxh\b/g, 'nha o xa hoi']];
vanBanRouter.get('/tim', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q.length < 2) return res.json({ docs: [] });
    const chan = kiemTimCongKhai(req); if (chan) { res.set('Cache-Control', 'no-store'); return res.status(429).json({ error: chan }); }   // chống cào (lib/chongCaoVb.ts) — no-store để nginx không lưu câu chặn phát cho người khác
    let kd = vnNoAccent(q.toLowerCase()).replace(/\s+/g, ' ');
    for (const [re, thay] of TU_DONG_NGHIA) kd = kd.replace(re, thay);
    const tu = kd.split(' ').filter(Boolean).slice(0, 8).map((w) => '%' + w.replace(/[\\%_]/g, (c) => '\\' + c) + '%');
    const goc = `vn_unaccent(lower(coalesce(so_hieu,'') || ' ' || coalesce(trich_yeu,'') || ' ' || coalesce(co_quan,'')))`;
    const rows = await query(`
      SELECT id, so_hieu AS "soKyHieu", trich_yeu AS "trichYeu",
             to_char(ngay_ban_hanh,'YYYY-MM-DD') AS ngay, co_quan AS "coQuan", link_goc
      FROM van_ban
      WHERE can_kiem_tra IS NULL AND ${goc} LIKE ALL($1::text[])
      ORDER BY (vn_unaccent(lower(coalesce(so_hieu,''))) LIKE $2) DESC, ngay_ban_hanh DESC NULLS LAST, id DESC
      LIMIT 6`, [tu, '%' + kd.replace(/[\\%_]/g, (c) => '\\' + c) + '%']);
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ docs: rows.map(({ link_goc, ...d }: any) => ({ ...d, coFile: coFileThat(link_goc) })) });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi' }); }
});

// ── GET /manage — danh sách đầy đủ (có link gốc) cho người quản lý văn bản ──
vanBanRouter.get('/manage', vanBanRequired, async (_req, res) => {
  try {
    const rows = await query(`
      SELECT id, so_hieu AS "soKyHieu", trich_yeu AS "trichYeu",
             to_char(ngay_ban_hanh,'YYYY-MM-DD') AS ngay, co_quan AS "coQuan",
             chu_de AS "chuDe", linh_vuc AS "linhVuc", nguon, link_goc AS "linkGoc",
             luot_tai AS "luotTai", noi_bat AS "noiBat", can_kiem_tra AS "canKiemTra"
      FROM van_ban ORDER BY ngay_ban_hanh DESC NULLS LAST, id DESC LIMIT 8000`);
    // coFile = có FILE THẬT xem được (không phải trang chung / trang tìm kiếm / link bị khoá) → admin lọc ra để tự tìm bằng tay
    res.json({ docs: rows.map((d: any) => ({ ...d, coFile: coFileThat(d.linkGoc) })) });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi' }); }
});

// ── GET /:id/pdf — proxy tải PDF qua server (đếm lượt) — CHỈ người đăng nhập ──
// ── POST /ve-nguoi-that {token} — đổi mã Turnstile lấy "vé người thật" 2 giờ để mở văn bản (chống cào) ──
vanBanRouter.post('/ve-nguoi-that', authRequired, async (req: AuthedRequest, res) => {
  if (!(await laNguoiThat(req.body?.token, req))) return res.status(403).json({ error: 'Không xác nhận được bạn là người thật. Vui lòng tải lại trang rồi thử lại.' });
  res.set('Cache-Control', 'no-store');
  res.json({ ve: capVe(req.user!.id, req) });
});

vanBanRouter.get('/:id/pdf', authRequired, async (req: AuthedRequest, res) => {
  try {
    const [row] = await query<any>('SELECT id, so_hieu, link_goc FROM van_ban WHERE id=$1', [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy văn bản' });
    // CHỐNG CÀO: phải có "vé người thật" (đã qua Cloudflare Turnstile) — lib/turnstile.ts. Chưa điền khoá thì bỏ qua.
    // Admin + người quản lý văn bản không cần vé.
    if (!coVaiTro(req.user, 'admin', 'vanban') && !veHopLe(req.headers['x-ve-nguoi-that'], req.user!.id, req)) {
      res.set('Cache-Control', 'no-store');
      return res.status(403).json({ error: 'Cần xác nhận bạn là người thật trước khi xem văn bản.', canVe: true });
    }
    query('UPDATE van_ban SET luot_tai = luot_tai + 1 WHERE id=$1', [row.id]).catch(() => {});
    const tenFile = `${String(row.so_hieu || 'van-ban').replace(/[^\w.-]/g, '_')}.pdf`;
    // Bản đã gắn dấu bản quyền + nén, lưu sẵn trong kho (mở nhanh, nhẹ)
    const buf = await layFileVb(row.id, row.link_goc);
    if (buf) {
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="${tenFile}"`);
      // CACHE THEO PHIÊN BẢN (chủ dự án 6/10/2026: vẫn phải cho trình duyệt giữ file để máy chủ nhẹ):
      // · đường dẫn mang đúng phiên bản hiện tại (?v=7 ↔ PHIEN_BAN_FILE 'v7') → trình duyệt giữ 30 ngày, mở lại không hỏi máy chủ;
      // · đổi dấu bản quyền/cách nén thì tăng PHIEN_BAN_FILE + số ?v= bên giao diện → đường dẫn mới, trình duyệt tự lấy bản mới.
      // · đường dẫn cũ / không có ?v= → bắt hỏi lại (ETag → 304 nếu không đổi), để không ai kẹt bản cũ không dấu như trước.
      res.set('Cache-Control', String(req.query.v || '') === PHIEN_BAN_FILE.slice(1) ? 'private, max-age=2592000, immutable' : 'private, no-cache');
      res.set('X-Phien-Ban-File', PHIEN_BAN_FILE);
      return res.send(buf);
    }
    return res.json({ redirect: null }); // không lấy được PDF → báo chưa có file, KHÔNG đưa người dùng sang trang khác
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi tải' }); }
});

// ── Admin: thêm / sửa / xoá / làm mới ──
vanBanRouter.post('/', vanBanRequired, async (req, res) => {
  try {
    const b = req.body || {};
    const [r] = await query(
      `INSERT INTO van_ban (so_hieu, trich_yeu, ngay_ban_hanh, co_quan, chu_de, linh_vuc, nguon, link_goc, noi_bat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (so_hieu, ngay_ban_hanh) DO UPDATE SET trich_yeu=EXCLUDED.trich_yeu, co_quan=EXCLUDED.co_quan,
         chu_de=EXCLUDED.chu_de, linh_vuc=EXCLUDED.linh_vuc, nguon=EXCLUDED.nguon, link_goc=EXCLUDED.link_goc, noi_bat=EXCLUDED.noi_bat
       RETURNING id`,
      [b.soKyHieu || null, b.trichYeu, b.ngay || null, b.coQuan || null, b.chuDe || 'Khác', b.linhVuc || null, b.nguon || 'Admin', b.linkGoc || null, !!b.noiBat]);
    res.json({ ok: true, id: r?.id });
  } catch (e: any) { res.status(400).json({ error: e?.message || 'Lỗi thêm' }); }
});
vanBanRouter.put('/:id', vanBanRequired, async (req, res) => {
  try {
    const b = req.body || {};
    // Sửa số/ngày → nhớ số + ngày GỐC (chỉ lần sửa đầu) để máy lấy văn bản không thêm lại bản cũ thành bản trùng (cò chặn trong migrate.ts)
    await query(`UPDATE van_ban SET so_goc = so_hieu, ngay_goc = ngay_ban_hanh WHERE id=$1 AND so_goc IS NULL
      AND (so_hieu IS DISTINCT FROM $2 OR ngay_ban_hanh IS DISTINCT FROM $3::date)`, [Number(req.params.id), b.soKyHieu || null, b.ngay || null]);
    await query(
      `UPDATE van_ban SET so_hieu=$2, trich_yeu=$3, ngay_ban_hanh=$4, co_quan=$5, chu_de=$6, linh_vuc=$7, nguon=$8, link_goc=$9, noi_bat=$10 WHERE id=$1`,
      [Number(req.params.id), b.soKyHieu || null, b.trichYeu, b.ngay || null, b.coQuan || null, b.chuDe || 'Khác', b.linhVuc || null, b.nguon || null, b.linkGoc || null, !!b.noiBat]);
    await rm(`${KHO_DRIVE}/vb-${PHIEN_BAN_FILE}-${Number(req.params.id)}.pdf`, { force: true }); // link có thể đã đổi → làm lại file
    res.json({ ok: true });
  } catch (e: any) { res.status(400).json({ error: e?.message || 'Lỗi sửa' }); }
});
// ── Admin dán LINK FILE tìm được bằng tay (khung "Văn bản chưa có file", 6/10/2026) ──
// Thử tải ngay: phải ra đúng file PDF (link Drive thư mục/file cũng được) mới lưu → không lưu nhầm link trang web.
// Lưu xong xoá bản cũ trong kho rồi tự tải + gắn dấu bản quyền + nén ở nền.
vanBanRouter.patch('/:id/link', vanBanRequired, async (req, res) => {
  try {
    const id = Number(req.params.id); const link = String(req.body?.linkGoc || '').trim();
    if (!/^https?:\/\//i.test(link)) return res.status(400).json({ error: 'Link phải bắt đầu bằng http:// hoặc https://' });
    const goc = await layFileGoc(link);
    if (!goc) return res.status(400).json({ error: 'Link này không tải được file PDF. Hãy dán link TẢI TRỰC TIẾP file (đuôi .pdf, hoặc link Google Drive công khai), không phải link trang web.' });
    await query('UPDATE van_ban SET link_goc=$2, tim_file_luc=now() WHERE id=$1', [id, link]);
    await rm(`${KHO_DRIVE}/vb-${PHIEN_BAN_FILE}-${id}.pdf`, { force: true });
    layFileVb(id, link).catch(() => {});
    res.json({ ok: true, kb: Math.round(goc.length / 1024) });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi lưu link' }); }
});
// ── Admin bấm "Đã kiểm tra" trong khung "Văn bản cần kiểm tra" → bỏ ghi chú nghi vấn ──
vanBanRouter.patch('/:id/kiem-tra', vanBanRequired, async (req, res) => {
  try { await query('UPDATE van_ban SET can_kiem_tra = NULL WHERE id=$1', [Number(req.params.id)]); res.json({ ok: true }); }
  catch (e: any) { res.status(500).json({ error: e?.message || 'Lỗi' }); }
});
vanBanRouter.delete('/:id', vanBanRequired, async (req, res) => {
  try { await query('DELETE FROM van_ban WHERE id=$1', [Number(req.params.id)]); res.json({ ok: true }); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'Lỗi xoá' }); }
});
// Khởi động đồng bộ NỀN rồi trả lời NGAY (không chờ crawl xong → không còn 524).
vanBanRouter.post('/refresh', vanBanRequired, (_req, res) => {
  const started = startCrawlBg();
  res.json({ ok: true, started, running: crawlState.running, added: crawlState.added });
});
// Tiến độ đồng bộ để client hỏi định kỳ.
vanBanRouter.get('/refresh-status', vanBanRequired, (_req, res) => {
  res.json({ running: crawlState.running, added: crawlState.added, updated: crawlState.updated, error: crawlState.error, finishedAt: crawlState.finishedAt });
});
