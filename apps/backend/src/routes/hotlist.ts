// ROUTE "DANH SÁCH NÓNG" — bản ghi THÊM MỚI (bổ sung cho danh sách gốc /public/danh-sach-nong.json).
// CÔ LẬP để sau tách web dễ gỡ: xoá file này + 1 dòng đăng ký index.ts + DROP TABLE hot_records.
// Quyền: XEM (file gốc + bản ghi) + THÊM + SỬA + đánh dấu HẾT HIỆU LỰC + TẠO sheet = admin HOẶC 'hotlist'. XOÁ vĩnh viễn (bản ghi & sheet) = CHỈ admin (sheet chỉ xoá được khi đã rỗng).
// Trường công văn đến theo NĐ 30/2020 (Sổ đăng ký văn bản đến): số đến, ngày đến, số/ký hiệu, ngày văn bản, đơn vị gửi (tác giả).
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { laAdmin, coVaiTro } from '../lib/auth.ts';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { kyTep } from '../lib/kyTep.ts';

export const hotlistRouter = Router();
const canManage = (req: AuthedRequest) => coVaiTro(req.user, 'admin', 'hotlist');

// ── TỆP CÔNG VĂN ĐÍNH KÈM LÀ TỆP RIÊNG (11/10/2026 — rà soát bảo mật) ──
// Tệp tải lên ở hộp "Thêm/Sửa bản ghi" nằm chung kho /api/images với ảnh tin rao (công khai, số tệp tăng dần 1, 2, 3…
// ai cũng đoán được). Công văn có tên, CCCD, địa chỉ người dân → lưu bản ghi xong thì đánh dấu tệp đó là RIÊNG:
// từ đó chỉ mở được bằng link có chữ ký 2 giờ do đường /ky-tep bên dưới cấp (lib/kyTep.ts, routes/images.ts).
const soTepCuaLink = (link: unknown): number | null => {
  const m = /\/api\/images\/(\d{1,9})(?!\d)/.exec(String(link || ''));
  return m ? Number(m[1]) : null;
};
async function danhDauTepRieng(link: unknown): Promise<void> {
  const id = soTepCuaLink(link);
  if (id) await query('UPDATE listing_images SET rieng = true WHERE id = $1 AND NOT rieng', [id]).catch(() => {});
}

let ensured = false;
async function ensure() {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS hot_records (
    id SERIAL PRIMARY KEY, nguon TEXT, ten TEXT, so_thua TEXT, so_to TEXT, xa TEXT,
    noi_dung TEXT, ghi_chu TEXT, link TEXT, muc_do TEXT, nguoi_them TEXT,
    created_at TIMESTAMPTZ DEFAULT now())`);
  for (const c of ['link', 'so_den', 'ngay_den', 'so_ky_hieu', 'ngay_vb', 'don_vi_gui', 'loai_vb', 'so_vb_goc', 'so_giay_to', 'nam_sinh', 'dia_chi', 'so_phat_hanh', 'so_vao_so', 'ngay_cap', 'het_hieu_luc_boi']) // bảng cũ bổ sung cột mới
    await query(`ALTER TABLE hot_records ADD COLUMN IF NOT EXISTS ${c} TEXT`);
  await query(`ALTER TABLE hot_records ADD COLUMN IF NOT EXISTS het_hieu_luc_at TIMESTAMPTZ`); // thời điểm đánh dấu hết hiệu lực (NULL = còn hiệu lực)
  await query(`CREATE TABLE IF NOT EXISTS hot_sheets (name TEXT PRIMARY KEY, created_by TEXT, created_at TIMESTAMPTZ DEFAULT now())`); // sheet (nguồn) tồn tại ĐỘC LẬP với bản ghi — xoá hết bản ghi KHÔNG làm mất sheet
  await query(`CREATE INDEX IF NOT EXISTS hot_records_nguon_idx ON hot_records (nguon)`); // lọc/xoá theo nguồn (sheet) nhanh hơn
  await query(`INSERT INTO hot_sheets (name, created_by) SELECT DISTINCT nguon, 'backfill' FROM hot_records WHERE COALESCE(TRIM(nguon), '') <> '' ON CONFLICT (name) DO NOTHING`); // đăng ký các nguồn đã có sẵn (tương thích ngược) để sheet cũ không mất khi xoá hết bản ghi
  ensured = true;
}
const SEL = `id, nguon, ten, so_thua AS "soThua", so_to AS "soTo", xa,
  noi_dung AS "noiDung", ghi_chu AS "ghiChu", link, muc_do AS "mucDo",
  so_den AS "soDen", ngay_den AS "ngayDen", so_ky_hieu AS "soKyHieu", ngay_vb AS "ngayVb", don_vi_gui AS "donViGui",
  loai_vb AS "loaiVb", so_vb_goc AS "soVbGoc", so_giay_to AS "soGiayTo", nam_sinh AS "namSinh", dia_chi AS "diaChi",
  so_phat_hanh AS "soPhatHanh", so_vao_so AS "soVaoSo", ngay_cap AS "ngayCap",
  het_hieu_luc_at AS "hetHieuLucAt", het_hieu_luc_boi AS "hetHieuLucBoi",
  nguoi_them AS "nguoiThem", created_at AS "createdAt"`;
const clip = (v: any, n: number) => String(v ?? '').slice(0, n);
const SHEETSEL = `name, created_by AS "createdBy", created_at AS "createdAt"`;
// Đăng ký 1 sheet (nguồn) vào bảng hot_sheets — để sheet tồn tại kể cả khi chưa/không còn bản ghi nào.
async function registerSheet(name: any, by: string) {
  const n = String(name ?? '').trim(); if (!n) return;
  await query(`INSERT INTO hot_sheets (name, created_by) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, [n, by || '']);
}

// ⛔ 29/9/2026 (rà soát bảo mật): TOÀN BỘ danh sách nóng chỉ dành cho ADMIN hoặc tài khoản được cấp vai trò
//    "hotlist" (trang quản trị → "🔥 Tra cứu danh sách nóng") — ĐÚNG quyền mà trang /tra-cuu đang dùng để hiện
//    màn khoá 🔒. Trước đây màn khoá chỉ CHE Ở GIAO DIỆN: file gốc /danh-sach-nong.json (CMND/CCCD, ngày sinh,
//    địa chỉ người dân) và GET /api/hotlist vẫn ai cũng tải thẳng được. Nay máy chủ chặn thật.
const khongCoQuyen = (res: any) => res.status(403).json({ error: 'Tài khoản chưa được cấp quyền xem danh sách nóng.' });

// GET /api/hotlist/goc — FILE GỐC danh sách nóng (trước nằm công khai ở public/danh-sach-nong.json).
// File nằm ở apps/backend/du-lieu-rieng/ (đã loại khỏi git). Không lưu đệm ở đâu cả (no-store).
const TEP_GOC = path.resolve(process.cwd(), 'du-lieu-rieng', 'danh-sach-nong.json');
hotlistRouter.get('/goc', authRequired, (req: AuthedRequest, res) => {
  if (!canManage(req)) return khongCoQuyen(res);
  res.set('Cache-Control', 'private, no-store');
  if (!fs.existsSync(TEP_GOC)) return res.status(404).json({ error: 'Chưa có file danh sách nóng trên máy chủ.' });
  res.type('application/json').sendFile(TEP_GOC);
});

// GET /api/hotlist — bản ghi thêm mới + danh sách sheet. CHỈ admin / vai trò hotlist.
hotlistRouter.get('/', authRequired, async (req: AuthedRequest, res, next) => {
  if (!canManage(req)) return khongCoQuyen(res);
  res.set('Cache-Control', 'private, no-store');
  try {
    await ensure();
    const records = await query(`SELECT ${SEL} FROM hot_records ORDER BY id DESC LIMIT 5000`);
    const sheets = await query(`SELECT ${SHEETSEL} FROM hot_sheets ORDER BY created_at`);
    res.json({ records, sheets });
  } catch (e) { next(e); }
});

// POST /api/hotlist/ky-tep { id } — cấp CHỮ KÝ 2 giờ để mở tệp công văn riêng (khung xem / thẻ mới không gửi được thẻ
// đăng nhập nên phải dùng link có chữ ký). CHỈ admin / vai trò hotlist, và CHỈ cho tệp đang gắn vào một bản ghi danh sách
// nóng — không thành chỗ "xin chữ ký" cho tệp bất kỳ. Đặt TRƯỚC /:id.
hotlistRouter.post('/ky-tep', authRequired, async (req: AuthedRequest, res, next) => {
  if (!canManage(req)) return khongCoQuyen(res);
  try {
    await ensure();
    const id = Number((req.body as any)?.id);
    if (!Number.isInteger(id) || id <= 0 || id >= 2 ** 31) return res.status(400).json({ error: 'Thiếu số tệp.' });
    const ds = await query<{ link: string }>(`SELECT link FROM hot_records WHERE link LIKE $1`, [`%/api/images/${id}%`]);
    if (!ds.some((r) => soTepCuaLink(r.link) === id)) return res.status(404).json({ error: 'Tệp này không thuộc danh sách nóng.' });
    res.set('Cache-Control', 'private, no-store');
    res.json(kyTep(id));
  } catch (e) { next(e); }
});

// POST /api/hotlist — thêm bản ghi. CHỈ admin / vai trò hotlist (trước đây ai đăng nhập cũng thêm được;
// nay người không có quyền cũng không thấy trang để thêm, nên khoá theo đúng quyền xem).
hotlistRouter.post('/', authRequired, async (req: AuthedRequest, res, next) => {
  if (!canManage(req)) return khongCoQuyen(res);
  try {
    await ensure(); const b: any = req.body ?? {};
    // Đã BỎ ràng buộc bắt buộc nhập (theo yêu cầu): cho lưu kể cả khi để trống / chỉ đính kèm tệp.
    const [row] = await query(
      `INSERT INTO hot_records (nguon, ten, so_thua, so_to, xa, noi_dung, ghi_chu, link, muc_do, so_den, ngay_den, so_ky_hieu, ngay_vb, don_vi_gui, loai_vb, so_vb_goc, so_giay_to, nam_sinh, dia_chi, so_phat_hanh, so_vao_so, ngay_cap, nguoi_them)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING ${SEL}`,
      [clip(b.nguon || 'Thêm mới', 120), clip(b.ten, 300), clip(b.soThua, 300), clip(b.soTo, 120), clip(b.xa, 120),
       clip(b.noiDung, 2000), clip(b.ghiChu, 2000), clip(b.link, 500), clip(b.mucDo || 'canh-bao', 30),
       clip(b.soDen, 60), clip(b.ngayDen, 40), clip(b.soKyHieu, 120), clip(b.ngayVb, 40), clip(b.donViGui, 300),
       clip(b.loaiVb, 120), clip(b.soVbGoc, 120), clip(b.soGiayTo, 60), clip(b.namSinh, 12), clip(b.diaChi, 400),
       clip(b.soPhatHanh, 120), clip(b.soVaoSo, 120), clip(b.ngayCap, 40), req.user?.email || 'admin']);
    await registerSheet(row.nguon, req.user?.email || 'admin'); // đăng ký sheet (nguồn) để tồn tại độc lập với bản ghi
    await danhDauTepRieng(row.link);                             // tệp công văn đính kèm → tệp riêng
    res.json({ ok: true, record: row });
  } catch (e) { next(e); }
});

// POST /api/hotlist/sheets — TẠO / đăng ký sheet (nguồn), kể cả sheet rỗng (admin / hotlist). Đặt TRƯỚC /:id để không bị nuốt param.
hotlistRouter.post('/sheets', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    await ensure(); if (!canManage(req)) return res.status(403).json({ error: 'Chỉ admin hoặc người quản lý mới được tạo sheet.' });
    const name = String((req.body as any)?.name ?? '').trim(); if (!name) return res.status(400).json({ error: 'Thiếu tên sheet.' });
    await registerSheet(name, req.user?.email || 'admin');
    const [sheet] = await query(`SELECT ${SHEETSEL} FROM hot_sheets WHERE name=$1`, [name]);
    res.json({ ok: true, sheet });
  } catch (e) { next(e); }
});

// DELETE /api/hotlist/sheets — XOÁ sheet (CHỈ admin, và CHỈ khi sheet đã rỗng — 0 bản ghi). Đặt TRƯỚC /:id.
hotlistRouter.delete('/sheets', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    await ensure(); if (!req.user || !laAdmin(req.user)) return res.status(403).json({ error: 'Chỉ admin mới được xoá sheet.' });
    const name = String((req.body as any)?.name ?? '').trim(); if (!name) return res.status(400).json({ error: 'Thiếu tên sheet.' });
    const [{ c }] = await query(`SELECT count(*)::int AS c FROM hot_records WHERE nguon=$1`, [name]);
    if (Number(c) > 0) return res.status(409).json({ error: `Sheet còn ${c} bản ghi — hãy xoá/chuyển hết bản ghi trước khi xoá sheet.` });
    await query(`DELETE FROM hot_sheets WHERE name=$1`, [name]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PUT /api/hotlist/:id — SỬA (chỉ admin / hotlist).
hotlistRouter.put('/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    await ensure(); if (!canManage(req)) return res.status(403).json({ error: 'Chỉ admin hoặc người quản lý danh sách nóng mới được sửa.' });
    const b: any = req.body ?? {};
    const [row] = await query(
      `UPDATE hot_records SET nguon=$1, ten=$2, so_thua=$3, so_to=$4, xa=$5, noi_dung=$6, ghi_chu=$7, link=$8, muc_do=$9,
        so_den=$10, ngay_den=$11, so_ky_hieu=$12, ngay_vb=$13, don_vi_gui=$14, loai_vb=$15, so_vb_goc=$16, so_giay_to=$17, nam_sinh=$18, dia_chi=$19, so_phat_hanh=$20, so_vao_so=$21, ngay_cap=$22 WHERE id=$23 RETURNING ${SEL}`,
      [clip(b.nguon || 'Thêm mới', 120), clip(b.ten, 300), clip(b.soThua, 300), clip(b.soTo, 120), clip(b.xa, 120),
       clip(b.noiDung, 2000), clip(b.ghiChu, 2000), clip(b.link, 500), clip(b.mucDo || 'canh-bao', 30),
       clip(b.soDen, 60), clip(b.ngayDen, 40), clip(b.soKyHieu, 120), clip(b.ngayVb, 40), clip(b.donViGui, 300),
       clip(b.loaiVb, 120), clip(b.soVbGoc, 120), clip(b.soGiayTo, 60), clip(b.namSinh, 12), clip(b.diaChi, 400),
       clip(b.soPhatHanh, 120), clip(b.soVaoSo, 120), clip(b.ngayCap, 40), Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    await registerSheet(row.nguon, req.user?.email || 'admin'); // sheet (nguồn) có thể đổi khi sửa → đăng ký lại
    await danhDauTepRieng(row.link);                             // tệp công văn đính kèm → tệp riêng
    res.json({ ok: true, record: row });
  } catch (e) { next(e); }
});

// PATCH /api/hotlist/:id/het-hieu-luc — ĐÁNH DẤU / KHÔI PHỤC hết hiệu lực (admin / hotlist). body { off:true } = khôi phục.
hotlistRouter.patch('/:id/het-hieu-luc', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    await ensure(); if (!canManage(req)) return res.status(403).json({ error: 'Chỉ admin hoặc người quản lý danh sách nóng mới được đánh dấu hết hiệu lực.' });
    const off = (req.body as any)?.off === true; // off=true → khôi phục (còn hiệu lực trở lại)
    const [row] = off
      ? await query(`UPDATE hot_records SET het_hieu_luc_at = NULL, het_hieu_luc_boi = NULL WHERE id=$1 RETURNING ${SEL}`, [Number(req.params.id)])
      : await query(`UPDATE hot_records SET het_hieu_luc_at = now(), het_hieu_luc_boi = $1 WHERE id=$2 RETURNING ${SEL}`, [req.user?.email || 'admin', Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    res.json({ ok: true, record: row });
  } catch (e) { next(e); }
});

// DELETE /api/hotlist/:id — XOÁ VĨNH VIỄN (CHỈ admin).
hotlistRouter.delete('/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try { await ensure(); if (!req.user || !laAdmin(req.user)) return res.status(403).json({ error: 'Chỉ admin mới được xoá vĩnh viễn bản ghi.' }); await query('DELETE FROM hot_records WHERE id=$1', [Number(req.params.id)]); res.json({ ok: true }); } catch (e) { next(e); }
});
