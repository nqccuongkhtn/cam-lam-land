// BÀI THỬ GỘP / TÁCH THIẾT BỊ (13/10/2026) — apps/backend/src/lib/thietBi.ts (bacCungMay, ghiDangNhap, gopMayTrungCu, gopHaiMay,
// tachMaPhu). Tự dựng BẢN SAO RỖNG các bảng trong schema riêng `thu_gop`, chạy trên dữ liệu GIẢ của tài khoản 999999, xong tự xoá
// schema — bảng thật không bị đụng. Sửa luật gộp máy thì chạy lại, phải ra "TẤT CẢ ĐẠT":
//   set -a; . ./.env; set +a; POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5433 apps/backend/node_modules/.bin/tsx scripts/thu-gop-thiet-bi.mts
import pg from '../apps/backend/node_modules/pg/lib/index.js';
const ketNoi = () => new pg.Client({ host: process.env.POSTGRES_HOST || '127.0.0.1', port: Number(process.env.POSTGRES_PORT || 5433),
  user: process.env.POSTGRES_USER || 'camlam', password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB || 'camlam_gis' });
const dung = ketNoi(); await dung.connect();
await dung.query(`DROP SCHEMA IF EXISTS thu_gop CASCADE; CREATE SCHEMA thu_gop;
  CREATE TABLE thu_gop.thiet_bi (LIKE public.thiet_bi INCLUDING ALL);
  CREATE TABLE thu_gop.tra_cuu_gan_day (LIKE public.tra_cuu_gan_day INCLUDING ALL);
  CREATE TABLE thu_gop.thiet_bi_dang_nhap (LIKE public.thiet_bi_dang_nhap INCLUDING ALL);
  CREATE TABLE thu_gop.webauthn_credentials (LIKE public.webauthn_credentials INCLUDING ALL);
  ALTER TABLE thu_gop.thiet_bi ADD COLUMN IF NOT EXISTS ma_phu text[] NOT NULL DEFAULT '{}';          -- phòng khi bảng thật chưa vá
  ALTER TABLE thu_gop.webauthn_credentials ADD COLUMN IF NOT EXISTS thiet_bi_ids int[] NOT NULL DEFAULT '{}';`);
// (lần chạy trước hỏng giữa chừng để sót schema thu_gop thì dòng DROP ở trên tự dọn)
await dung.end();
process.env.PGOPTIONS = '-c search_path=thu_gop,public';               // mọi câu lệnh của thư viện chạy vào BẢN SAO
process.env.JWT_SECRET ||= 'chi-de-thu';
const tb = await import('../apps/backend/src/lib/thietBi.ts');
const { query, pool } = await import('../apps/backend/src/lib/db.ts');
let hong = 0;
const kiem = (dk: boolean, ten: string) => { console.log((dk ? 'ĐẠT  ' : 'HỎNG ') + ten); if (!dk) hong++; };
const U = 999999;
const [sp] = await query('SHOW search_path'); kiem(String(sp.search_path).startsWith('thu_gop'), 'đang chạy trên bản sao (search_path thu_gop)');

const PC = { manHinh: '1920×1080', tiLe: 1, muiGio: 'Asia/Saigon', nhanCpu: 8, ram: 16, cham: 0, nenTang: 'Windows', banNenTang: '19.0.0' };
const IP = { manHinh: '390×844', tiLe: 3, muiGio: 'Asia/Saigon', nhanCpu: 4, cham: 5 };
const them = async (ma: string, ten: string, loai: string, hdh: string, td: string, ct: any, ip: string, lanDau: string) =>
  (await query(`INSERT INTO thiet_bi (user_id, ma, ten, loai, he_dieu_hanh, trinh_duyet, chi_tiet, ip_dau, ip_cuoi, ip_dn_cuoi, lan_dau, lan_cuoi, so_lan_dang_nhap)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$8,$9,$9,1) RETURNING id`, [U, ma, ten, loai, hdh, td, JSON.stringify(ct), ip, lanDau]))[0].id;
await query('DELETE FROM thiet_bi WHERE user_id=$1', [U]);
const P = await them('maPPPPPPPPPPPPPPPP', 'Máy tính Windows · Chrome 155', 'Máy tính', 'Windows 10/11', 'Chrome 155', { ...PC, gpu: 'ANGLE (Intel UHD 630)', phongChu: '41:abc' }, '1.1.1.1', '2026-10-01');
const Q = await them('maQQQQQQQQQQQQQQQQ', 'Máy tính Windows · Edge 154', 'Máy tính', 'Windows 10/11', 'Edge 154', { ...PC, gpu: 'ANGLE (Intel UHD 630)', phongChu: '41:abc' }, '2.2.2.2', '2026-10-02');
const R = await them('maRRRRRRRRRRRRRRRR', 'Máy tính Windows · Firefox 140', 'Máy tính', 'Windows 10/11', 'Firefox 140', { ...PC, ram: undefined, gpu: 'Intel(R) HD Graphics, or similar', phongChu: '12:fff' }, '1.1.1.1', '2026-10-03');
const S = await them('maSSSSSSSSSSSSSSSS', 'iPhone · Safari 18.7', 'Điện thoại', 'iOS 18.7', 'Safari 18.7', IP, '3.3.3.3', '2026-10-04');
const T = await them('maTTTTTTTTTTTTTTTT', 'iPhone · Safari 18.7', 'Điện thoại', 'iOS 18.7', 'Safari 18.7', IP, '4.4.4.4', '2026-10-05');
await query(`INSERT INTO webauthn_credentials (user_id, cred_id, public_key, counter, thiet_bi_ids) VALUES ($1,'khoa-thu-T','\\x00',0,$2)`, [U, [T]]);

const n = await tb.gopMayTrungCu();
const con = async () => (await query('SELECT id, ma, ma_phu, chi_tiet FROM thiet_bi WHERE user_id=$1 ORDER BY lan_dau', [U]));
let ds = await con();
const dongP = ds.find((x: any) => x.id === P);
kiem(n === 2, `tự gộp lúc khởi động: gộp ${n} dòng (phải 2: Edge khác mạng + Firefox cùng mạng)`);
kiem(dongP?.ma_phu?.includes('maQQQQQQQQQQQQQQQQ') && dongP?.chi_tiet?.phu?.maQQQQQQQQQQQQQQQQ?.bac === 'van-tay', 'Edge cùng máy, KHÁC MẠNG → gộp nhờ card đồ hoạ + bộ phông (bậc van-tay)');
kiem(dongP?.ma_phu?.includes('maRRRRRRRRRRRRRRRR') && dongP?.chi_tiet?.phu?.maRRRRRRRRRRRRRRRR?.bac === 'mang', 'Firefox cùng máy, cùng mạng → gộp (card / phông khác nhân trình duyệt nên không so)');
kiem(ds.some((x: any) => x.id === S) && ds.some((x: any) => x.id === T), 'hai iPhone giống hệt ở HAI MẠNG khác nhau → vẫn là 2 máy');

// đăng nhập: tab ẩn danh iPhone ở mạng khác, độ phân giải bị Safari giấu, nhưng dùng khoá Face ID đã dùng trên máy S
const req = (ma: string, ip: string, ua: string, info: any) => ({ headers: { 'x-thiet-bi': ma, 'cf-connecting-ip': ip, 'user-agent': ua,
  'x-thiet-bi-info': encodeURIComponent(JSON.stringify(info)) }, ip } as any);
const UA_IP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';
let kq: any = await tb.ghiDangNhap({ id: U, role: 'user' }, req('maAnDanhIPhone0001', '5.5.5.5', UA_IP, { ...IP, manHinh: '390×664' }), 'van-tay', { mayKhoa: [S] });
kiem(kq.ok && kq.mayId === S, 'tab ẩn danh iPhone, mạng khác, màn hình bị giấu + cùng khoá Face ID → gộp vào đúng máy S (bậc khoa)');
kq = await tb.ghiDangNhap({ id: U, role: 'user' }, req('maAnDanhIPhone0002', '6.6.6.6', UA_IP, IP), 'mat-khau');
kiem(kq.ok && kq.mayId !== S && kq.mayId !== T, 'iPhone lạ, mạng lạ, đăng nhập mật khẩu (không có khoá) → máy mới');
const UA_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0';
kq = await tb.ghiDangNhap({ id: U, role: 'user' }, req('maInPrivateQuan001', '7.7.7.7', UA_EDGE, { ...PC, gpu: 'ANGLE (Intel UHD 630)', phongChu: '41:abc' }), 'mat-khau');
kiem(kq.ok && kq.mayId === P, 'InPrivate máy tính ngoài quán (mạng khác), cùng card + phông → gộp vào máy P');
kq = await tb.ghiDangNhap({ id: U, role: 'user' }, req('maMayCtyKhac000001', '7.7.7.7', UA_EDGE, { ...PC, gpu: 'ANGLE (Intel UHD 630)', phongChu: '57:999' }), 'mat-khau');
kiem(kq.ok && kq.mayId !== P, 'máy tính cùng đời nhưng bộ phông khác → máy mới');

// admin tách / gộp tay
let loi = await tb.tachMaPhu(P, 'maQQQQQQQQQQQQQQQQ');
ds = await con();
const dongQ = ds.find((x: any) => x.ma === 'maQQQQQQQQQQQQQQQQ');
kiem(!loi && !!dongQ && dongQ.chi_tiet?.khongGop === true && dongQ.chi_tiet?.gpu === 'ANGLE (Intel UHD 630)', 'admin TÁCH mã Edge → thành máy riêng, giữ đúng thông số, đánh dấu không tự gộp');
kiem(!ds.find((x: any) => x.id === P).ma_phu.includes('maQQQQQQQQQQQQQQQQ'), 'máy P không còn mã Edge');
kiem((await tb.gopMayTrungCu()) === 0, 'chạy tự gộp lại: KHÔNG gộp lại máy vừa tách');
loi = await tb.gopHaiMay(T, S);
ds = await con();
const [k] = await query(`SELECT thiet_bi_ids FROM webauthn_credentials WHERE cred_id='khoa-thu-T'`);
kiem(!loi && !ds.some((x: any) => x.id === T) && ds.find((x: any) => x.id === S).ma_phu.includes('maTTTTTTTTTTTTTTTT'), 'admin GỘP iPhone T vào S');
kiem(JSON.stringify(k.thiet_bi_ids) === JSON.stringify([S]), 'khoá Face ID của T chuyển sang trỏ máy S');
kiem((await tb.gopHaiMay(S, S)) !== null, 'gộp một máy vào chính nó → báo lỗi');

await pool.end();
const don = ketNoi(); await don.connect(); await don.query('DROP SCHEMA thu_gop CASCADE'); await don.end();   // xoá bản sao
console.log(hong ? `\n${hong} mục HỎNG` : '\nTẤT CẢ ĐẠT');
process.exit(hong ? 1 : 0);
