// ── QUẢN LÝ THIẾT BỊ ĐĂNG NHẬP (10/10/2026) — xem lib/thietBi.ts ──
// Người dùng: CHỈ XEM máy của mình (không tự gỡ — tự gỡ được là lách phí reset).
// Admin: tổng quan mọi tài khoản · chi tiết từng tài khoản (từng máy, từng lần đăng nhập, những ngày đã dùng) ·
//        gỡ 1 máy · reset hết (ghi sổ phí) · đổi giới hạn riêng · bật/tắt giới hạn (cờ gioi_han_thiet_bi qua /api/flags).
import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, adminRequired, type AuthedRequest } from '../middleware/auth.ts';
import { isFlagOn } from '../lib/flags.ts';
import { CO_GIOI_HAN, TOI_DA_MAC_DINH, ZALO_ADMIN, PHI_RESET, maThietBi, quenMayCuaUser, quenCo } from '../lib/thietBi.ts';

export const thietBiRouter = Router();

const MAY_COT = `id, ten, loai, he_dieu_hanh "heDieuHanh", trinh_duyet "trinhDuyet", chi_tiet "chiTiet", ip_dau "ipDau", ip_cuoi "ipCuoi",
  quoc_gia "quocGia", lan_dau "lanDau", lan_cuoi "lanCuoi", so_lan_dang_nhap "soLanDangNhap"`;

async function dsMay(userId: number) {
  const may = await query<any>(`SELECT ${MAY_COT}, ma, ua,
      (SELECT count(*)::int FROM thiet_bi_ngay n WHERE n.thiet_bi_id=t.id) "soNgayDung",
      (SELECT COALESCE(sum(so_lan),0)::int FROM thiet_bi_ngay n WHERE n.thiet_bi_id=t.id) "soLanDung"
    FROM thiet_bi t WHERE user_id=$1 ORDER BY lan_dau`, [userId]);
  return may;
}

// ── Người dùng: máy của tôi ──
thietBiRouter.get('/cua-toi', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const [u] = await query<any>('SELECT thiet_bi_toi_da FROM users WHERE id=$1', [req.user!.id]);
    const ma = maThietBi(req);
    const may = (await dsMay(req.user!.id)).map(({ ma: m, ua, ...o }: any) => ({ ...o, mayNay: m === ma }));
    res.json({ may, toiDa: u?.thiet_bi_toi_da ?? TOI_DA_MAC_DINH, batGioiHan: await isFlagOn(CO_GIOI_HAN), zalo: ZALO_ADMIN, phi: PHI_RESET });
  } catch (e) { next(e); }
});

// ── Admin: tổng quan — tài khoản nhiều máy / nhiều IP lên đầu ──
thietBiRouter.get('/admin/tong-quan', adminRequired, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const ds = await query<any>(`
      SELECT u.id, u.email, u.full_name "ten", u.phone, u.role, u.roles, u.thiet_bi_toi_da "toiDaRieng",
        count(t.id)::int "soMay", max(t.lan_cuoi) "lanCuoi",
        (SELECT count(DISTINCT d.ip)::int FROM thiet_bi_dang_nhap d WHERE d.user_id=u.id AND d.luc > now() - interval '30 days') "soIp30",
        (SELECT count(*)::int FROM thiet_bi_dang_nhap d WHERE d.user_id=u.id AND d.ket_qua='bi-chan') "soLanBiChan",
        (SELECT count(*)::int FROM thiet_bi_reset r WHERE r.user_id=u.id) "soLanReset"
      FROM users u JOIN thiet_bi t ON t.user_id=u.id
      WHERE ($1 = '' OR lower(u.email) LIKE '%'||$1||'%' OR lower(coalesce(u.full_name,'')) LIKE '%'||$1||'%' OR coalesce(u.phone,'') LIKE '%'||$1||'%')
      GROUP BY u.id ORDER BY count(t.id) DESC, max(t.lan_cuoi) DESC LIMIT 300`, [q]);
    res.set('Cache-Control', 'private, no-store');
    res.json({ ds, toiDaMacDinh: TOI_DA_MAC_DINH, batGioiHan: await isFlagOn(CO_GIOI_HAN), zalo: ZALO_ADMIN, phi: PHI_RESET });
  } catch (e) { next(e); }
});

// ── Admin: chi tiết một tài khoản ──
thietBiRouter.get('/admin/tai-khoan/:id', adminRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [u] = await query<any>(`SELECT id, email, full_name "ten", phone, role, roles, created_at "taoLuc", thiet_bi_toi_da "toiDaRieng" FROM users WHERE id=$1`, [id]);
    if (!u) return res.status(404).json({ error: 'Không có tài khoản này' });
    const may = await dsMay(id);
    const ngay = may.length ? await query<any>(`SELECT thiet_bi_id "may", to_char(ngay,'YYYY-MM-DD') ngay, so_lan "soLan", ip_cuoi "ip"
      FROM thiet_bi_ngay WHERE thiet_bi_id = ANY($1) ORDER BY ngay DESC LIMIT 2000`, [may.map((m: any) => m.id)]) : [];
    const dangNhap = await query<any>(`SELECT id, thiet_bi_id "may", ma, luc, ip, quoc_gia "quocGia", ten, ua, cach, ket_qua "ketQua"
      FROM thiet_bi_dang_nhap WHERE user_id=$1 ORDER BY luc DESC LIMIT 500`, [id]);
    const reset = await query<any>(`SELECT r.id, r.luc, r.so_may "soMay", r.ds_may "dsMay", r.phi, r.ghi_chu "ghiChu", a.email "admin"
      FROM thiet_bi_reset r LEFT JOIN users a ON a.id=r.admin_id WHERE r.user_id=$1 ORDER BY r.luc DESC`, [id]);
    res.set('Cache-Control', 'private, no-store');
    res.json({ taiKhoan: u, toiDa: u.toiDaRieng ?? TOI_DA_MAC_DINH, may, ngay, dangNhap, reset, batGioiHan: await isFlagOn(CO_GIOI_HAN), phi: PHI_RESET });
  } catch (e) { next(e); }
});

// Gỡ máy: lưu lại thông tin máy bị gỡ vào sổ reset (để sau này vẫn còn bằng chứng máy đó từng đăng nhập).
async function goMay(userId: number, adminId: number, ids: number[] | null, phi: number, ghiChu: string) {
  const may = await query<any>(`SELECT ${MAY_COT} FROM thiet_bi WHERE user_id=$1 ${ids ? 'AND id = ANY($2)' : ''}`, ids ? [userId, ids] : [userId]);
  if (!may.length) return 0;
  await query(`INSERT INTO thiet_bi_reset (user_id, admin_id, so_may, ds_may, phi, ghi_chu) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, adminId, may.length, JSON.stringify(may), phi, ghiChu || null]);
  await query(`DELETE FROM thiet_bi WHERE id = ANY($1)`, [may.map((m: any) => m.id)]);
  quenMayCuaUser(userId);
  return may.length;
}

thietBiRouter.delete('/admin/may/:mayId', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const [m] = await query<any>('SELECT user_id FROM thiet_bi WHERE id=$1', [Number(req.params.mayId)]);
    if (!m) return res.status(404).json({ error: 'Không có thiết bị này' });
    const n = await goMay(m.user_id, req.user!.id, [Number(req.params.mayId)], Math.max(0, Number(req.body?.phi) || 0), String(req.body?.ghiChu || 'Gỡ 1 thiết bị').slice(0, 500));
    res.json({ ok: true, daGo: n });
  } catch (e) { next(e); }
});

thietBiRouter.post('/admin/tai-khoan/:id/reset', adminRequired, async (req: AuthedRequest, res, next) => {
  try {
    const n = await goMay(Number(req.params.id), req.user!.id, null, Math.max(0, Number(req.body?.phi) || 0), String(req.body?.ghiChu || 'Reset toàn bộ thiết bị').slice(0, 500));
    res.json({ ok: true, daGo: n });
  } catch (e) { next(e); }
});

thietBiRouter.patch('/admin/tai-khoan/:id/gioi-han', adminRequired, async (req, res, next) => {
  try {
    const v = req.body?.toiDa;
    const toiDa = v === null || v === '' || v === undefined ? null : Math.max(1, Math.min(50, Math.round(Number(v)) || TOI_DA_MAC_DINH));
    await query('UPDATE users SET thiet_bi_toi_da=$2 WHERE id=$1', [Number(req.params.id), toiDa]);
    res.json({ ok: true, toiDa });
  } catch (e) { next(e); }
});

// bật/tắt cờ đi qua /api/flags; gọi đây để máy chủ áp dụng NGAY (không chờ 30 giây nhớ tạm)
thietBiRouter.post('/admin/ap-dung-co', adminRequired, (_req, res) => { quenCo(); res.json({ ok: true }); });
