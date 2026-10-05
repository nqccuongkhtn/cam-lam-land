// ════════════════════════════════════════════════════════════════════════════════════════════
//  MÔI GIỚI CHUYÊN NGHIỆP (5/10/2026) — giống batdongsan.com.vn: phải XIN và được ADMIN DUYỆT mới có nhãn.
//  Người đã duyệt: trang xem tin hiện khung xanh ngọc "Môi giới chuyên nghiệp"; người thường: khung trắng.
//
//  Được bấm "Xin duyệt" khi đủ CẢ 4 điều kiện (chủ dự án chốt):
//    1. Tài khoản tạo trên 3 tháng
//    2. Đã đăng từ 30 tin trở lên (tính mọi tin đã được duyệt đăng, kể cả tin đã ẩn / đã bán)
//    3. Số điện thoại đã được xác minh
//    4. Đã từng mua gói (có đơn thanh toán thành công, hoặc từng được cấp gói đăng tin / đẩy tin)
//  Máy chủ TỰ KIỂM lại cả 4 điều kiện lúc xin — không tin giao diện.
//
//  Xác minh số điện thoại: web CHƯA có cổng gửi SMS (SMS_* trong .env trống) nên chưa gửi mã tự động được.
//  Tạm thời: người dùng bấm "Nhờ xác minh số" → admin gọi điện kiểm tra → bấm "Đã xác minh".
//  Lưu SỐ đã xác minh chứ không lưu đúng/sai → người dùng đổi số là tự mất xác minh.
// ════════════════════════════════════════════════════════════════════════════════════════════
import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, adminRequired, type AuthedRequest } from '../middleware/auth.ts';

export const moiGioiCnRouter = Router();

const SO_TIN_CAN = 30;
const chuSo = (s: any) => String(s || '').replace(/\D/g, '');

// Các cột cần để tính điều kiện — dùng chung cho người dùng và trang duyệt của admin
const COT = `u.id, u.email, u.full_name AS "ten", u.phone, u.avatar, u.created_at AS "taoLuc",
  u.sdt_da_xac_minh AS "sdtDaXacMinh", u.sdt_xin_luc AS "sdtXinLuc",
  u.cn_trang_thai AS "trangThai", u.cn_xin_luc AS "xinLuc", u.cn_duyet_luc AS "duyetLuc", u.cn_ghi_chu AS "ghiChu",
  (u.created_at <= now() - interval '3 months') AS "du3Thang",
  (now()::date - u.created_at::date) AS "soNgay",
  (SELECT count(*) FROM listings l WHERE l.created_by = u.id AND l.status <> 'pending')::int AS "soTin",
  (EXISTS (SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status = 'paid')
     OR u.pkg_expires_at IS NOT NULL OR u.post_expires_at IS NOT NULL OR u.boost_expires_at IS NOT NULL) AS "daMuaGoi"`;

function dieuKien(r: any) {
  const sdtOk = !!r.phone && !!r.sdtDaXacMinh && chuSo(r.phone) === chuSo(r.sdtDaXacMinh);
  const ds = [
    { ma: 'tuoi', ten: 'Tài khoản trên 3 tháng', dat: !!r.du3Thang, chiTiet: `Đã tham gia ${r.soNgay} ngày` },
    { ma: 'tin', ten: `Đã đăng từ ${SO_TIN_CAN} tin trở lên`, dat: r.soTin >= SO_TIN_CAN, chiTiet: `Đã đăng ${r.soTin} tin` },
    { ma: 'sdt', ten: 'Đã xác minh số điện thoại', dat: sdtOk,
      chiTiet: !r.phone ? 'Chưa khai số điện thoại' : sdtOk ? `Số ${r.phone} đã xác minh` : r.sdtXinLuc ? 'Đang chờ admin gọi xác minh' : 'Chưa xác minh' },
    { ma: 'goi', ten: 'Đã từng mua gói', dat: !!r.daMuaGoi, chiTiet: r.daMuaGoi ? 'Đã mua gói' : 'Chưa mua gói nào' },
  ];
  return { dieuKien: ds, duDieuKien: ds.every((d) => d.dat), sdtOk };
}
const goi = (r: any) => {
  const { du3Thang, soNgay, daMuaGoi, ...con } = r;
  return { ...con, ...dieuKien(r) };
};
async function docMot(id: number) {
  const [r] = await query(`SELECT ${COT} FROM users u WHERE u.id = $1`, [id]);
  return r ? goi(r) : null;
}

// ── Người dùng: xem tình trạng của mình ──
moiGioiCnRouter.get('/cua-toi', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const r = await docMot(req.user!.id);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    res.set('Cache-Control', 'private, no-store');
    res.json(r);
  } catch (e) { next(e); }
});

// ── Người dùng: nhờ admin xác minh số điện thoại ──
moiGioiCnRouter.post('/nho-xac-minh-sdt', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const r = await docMot(req.user!.id);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    if (!r.phone) return res.status(400).json({ error: 'Bạn chưa khai số điện thoại. Hãy điền số ở mục thông tin tài khoản trước.' });
    if (r.sdtOk) return res.status(400).json({ error: 'Số điện thoại của bạn đã được xác minh.' });
    await query(`UPDATE users SET sdt_xin_luc = now() WHERE id = $1`, [req.user!.id]);
    res.json(await docMot(req.user!.id));
  } catch (e) { next(e); }
});

// ── Người dùng: xin duyệt môi giới chuyên nghiệp ──
moiGioiCnRouter.post('/xin-duyet', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const r = await docMot(req.user!.id);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    if (r.trangThai === 'duyet') return res.status(400).json({ error: 'Bạn đã là môi giới chuyên nghiệp.' });
    if (r.trangThai === 'cho') return res.status(400).json({ error: 'Yêu cầu của bạn đang chờ admin duyệt.' });
    if (!r.duDieuKien) {
      const thieu = r.dieuKien.filter((d: any) => !d.dat).map((d: any) => d.ten.toLowerCase()).join(', ');
      return res.status(400).json({ error: `Chưa đủ điều kiện: còn thiếu ${thieu}.` });
    }
    await query(`UPDATE users SET cn_trang_thai = 'cho', cn_xin_luc = now(), cn_ghi_chu = NULL WHERE id = $1`, [req.user!.id]);
    res.json(await docMot(req.user!.id));
  } catch (e) { next(e); }
});

// ── Admin: danh sách cần xử lý ──
//   loc=cho  → đang xin duyệt + đang nhờ xác minh số (mặc định)
//   loc=duyet → đã là môi giới chuyên nghiệp
//   q=...    → tìm bất kỳ tài khoản nào theo tên / email / số (để xác minh số hoặc duyệt tay)
moiGioiCnRouter.get('/admin/ds', adminRequired, async (req, res, next) => {
  try {
    const loc = String(req.query.loc || 'cho');
    const q = String(req.query.q || '').trim();
    let where = `u.cn_trang_thai = 'cho' OR (u.sdt_xin_luc IS NOT NULL AND u.phone IS NOT NULL
                  AND regexp_replace(u.phone, '\\D', '', 'g') IS DISTINCT FROM regexp_replace(COALESCE(u.sdt_da_xac_minh, ''), '\\D', '', 'g'))`;
    const params: any[] = [];
    if (q) { where = `u.full_name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1`; params.push(`%${q}%`); }
    else if (loc === 'duyet') where = `u.cn_trang_thai = 'duyet'`;
    const rows = await query(`SELECT ${COT} FROM users u WHERE ${where}
      ORDER BY COALESCE(u.cn_xin_luc, u.sdt_xin_luc, u.cn_duyet_luc, u.created_at) DESC LIMIT 100`, params);
    res.set('Cache-Control', 'private, no-store');
    res.json({ ds: rows.map(goi) });
  } catch (e) { next(e); }
});

// ── Admin: duyệt / từ chối / thu hồi ──
moiGioiCnRouter.post('/admin/:id/quyet', adminRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const hd = String(req.body?.hanhDong || '');
    const ghiChu = String(req.body?.ghiChu || '').trim().slice(0, 300) || null;
    if (hd === 'duyet') await query(`UPDATE users SET cn_trang_thai = 'duyet', cn_duyet_luc = now(), cn_ghi_chu = $2 WHERE id = $1`, [id, ghiChu]);
    else if (hd === 'tu-choi') await query(`UPDATE users SET cn_trang_thai = 'tu_choi', cn_ghi_chu = $2 WHERE id = $1`, [id, ghiChu]);
    else if (hd === 'thu-hoi') await query(`UPDATE users SET cn_trang_thai = 'khong', cn_duyet_luc = NULL, cn_ghi_chu = $2 WHERE id = $1`, [id, ghiChu]);
    else return res.status(400).json({ error: 'Thao tác không hợp lệ' });
    const r = await docMot(id);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    res.json(r);
  } catch (e) { next(e); }
});

// ── Admin: đánh dấu đã / bỏ xác minh số điện thoại (sau khi gọi kiểm tra) ──
moiGioiCnRouter.post('/admin/:id/sdt', adminRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (req.body?.xacMinh) await query(`UPDATE users SET sdt_da_xac_minh = phone, sdt_xin_luc = NULL WHERE id = $1 AND phone IS NOT NULL`, [id]);
    else await query(`UPDATE users SET sdt_da_xac_minh = NULL WHERE id = $1`, [id]);
    const r = await docMot(id);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    res.json(r);
  } catch (e) { next(e); }
});
