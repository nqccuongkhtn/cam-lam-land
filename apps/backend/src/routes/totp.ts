// TRA CỨU MÃ XÁC THỰC 6 SỐ (Google Authenticator) CHO CÁC TÀI KHOẢN DÙNG CHUNG.
// ─────────────────────────────────────────────────────────────────────────────
// Cơ quan có nhiều tài khoản trên hệ thống ngoài (vd VBDLIS), mỗi tài khoản bật xác thực 2 lớp.
// Trước đây phải cầm điện thoại của người giữ máy mới lấy được mã. Trang này cho người ĐƯỢC CẤP
// QUYỀN tự xem mã, khỏi phải hỏi ai.
//
// ⚠️ BA NGUYÊN TẮC AN TOÀN — đừng sửa mất:
//  1. CHUỖI BÍ MẬT KHÔNG BAO GIỜ RỜI MÁY CHỦ. Trình duyệt chỉ nhận mã 6 số + số giây còn lại.
//     Lộ chuỗi bí mật = người ta cài được vào điện thoại riêng, coi như mất luôn lớp bảo vệ thứ 2.
//  2. Lưu trong database đã MÃ HOÁ (lib/matMa.ts). Mở database ra cũng không đọc được.
//  3. Chỉ 'admin' và vai trò 'xacthuc' xem được. THÊM / SỬA / XOÁ thì CHỈ admin.
import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, canVaiTro } from '../middleware/auth.ts';
import { laAdmin } from '../lib/auth.ts';
import { maHoa, giaiMa } from '../lib/matMa.ts';
import { sinhMa, docOtpauth } from '../lib/totp.ts';

export const totpRouter = Router();

// Ai cũng phải đăng nhập, và phải có vai trò 'xacthuc' (admin thì đương nhiên qua).
totpRouter.use(authRequired, canVaiTro('Cần quyền tra cứu mã xác thực (admin hoặc được cấp quyền)', 'xacthuc'));

// GET /api/totp/ma — danh sách tài khoản kèm MÃ ĐANG DÙNG.
// Trả thêm `conLai` (giây) để trang web biết khi nào hỏi lại, khỏi hỏi liên tục.
totpRouter.get('/ma', async (_req, res, next) => {
  try {
    const rows = await query<any>('SELECT id, ten, he_thong, ghi_chu, bi_mat FROM totp_tai_khoan ORDER BY thu_tu, he_thong, ten');
    const ds = rows.map((r) => {
      const { ma, conLai } = sinhMa(giaiMa(r.bi_mat));
      return { id: r.id, ten: r.ten, heThong: r.he_thong, ghiChu: r.ghi_chu, ma, conLai };
    });
    // Mã đổi 30 giây/lần nên tuyệt đối không cho cache ở bất kỳ tầng nào.
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ danhSach: ds, conLai: ds[0]?.conLai ?? 30 });
  } catch (e) { next(e); }
});

// ── Từ đây trở xuống: CHỈ ADMIN ────────────────────────────────────────────────
const chiAdmin = (req: any, res: any, next: any) =>
  laAdmin(req.user) ? next() : res.status(403).json({ error: 'Chỉ quản trị viên mới được sửa danh sách này.' });

// GET /api/totp — danh sách tài khoản để quản lý (KHÔNG kèm mã, KHÔNG kèm chuỗi bí mật).
totpRouter.get('/', chiAdmin, async (_req, res, next) => {
  try {
    const rows = await query<any>('SELECT id, ten, he_thong AS "heThong", ghi_chu AS "ghiChu", thu_tu AS "thuTu", tao_luc AS "taoLuc" FROM totp_tai_khoan ORDER BY thu_tu, he_thong, ten');
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ danhSach: rows });
  } catch (e) { next(e); }
});

// POST /api/totp — thêm tài khoản. Dán thẳng dòng otpauth:// lấy từ mã QR là được.
//   { chuoi: 'otpauth://totp/VBDLIS:tenaccount?secret=...&issuer=VBDLIS' }
//   hoặc { ten, secret, heThong, ghiChu }
// Dán NHIỀU dòng một lúc cũng được (mỗi dòng một tài khoản).
totpRouter.post('/', chiAdmin, async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const dong: string[] = Array.isArray(b.danhSach) ? b.danhSach.map(String)
      : String(b.chuoi || b.secret || '').split(/\r?\n/);
    const them: any[] = [];
    const loi: string[] = [];
    for (const d of dong) {
      const s = d.trim();
      if (!s) continue;
      const doc = docOtpauth(s);
      if (!doc) { loi.push(s.slice(0, 40)); continue; }
      const ten = String(b.ten || doc.ten || '').trim() || 'Không tên';
      const heThong = String(b.heThong || '').trim()
        || (/^otpauth:/i.test(s) ? (new URL(s).searchParams.get('issuer') || '') : '');
      // Sinh thử một mã: chuỗi bí mật hỏng thì chặn ngay, đừng để lưu vào rồi mới biết.
      if (!sinhMa(doc.secret).ma) { loi.push(ten); continue; }
      const [row] = await query<any>(
        `INSERT INTO totp_tai_khoan (ten, he_thong, bi_mat, ghi_chu)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (he_thong, ten) DO UPDATE SET bi_mat=EXCLUDED.bi_mat, ghi_chu=EXCLUDED.ghi_chu
         RETURNING id, ten, he_thong AS "heThong"`,
        [ten, heThong, maHoa(doc.secret), String(b.ghiChu || '').trim()]);
      them.push(row);
    }
    if (!them.length) return res.status(400).json({ error: 'Không đọc được dòng nào. Cần dán chuỗi dạng otpauth://totp/… hoặc chuỗi bí mật.', loi });
    res.json({ daThem: them.length, danhSach: them, loi });
  } catch (e) { next(e); }
});

// PATCH /api/totp/:id — đổi tên hiển thị / ghi chú / thứ tự (KHÔNG đụng chuỗi bí mật).
totpRouter.patch('/:id', chiAdmin, async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const [row] = await query<any>(
      `UPDATE totp_tai_khoan SET ten=COALESCE($2,ten), he_thong=COALESCE($3,he_thong), ghi_chu=COALESCE($4,ghi_chu), thu_tu=COALESCE($5,thu_tu)
       WHERE id=$1 RETURNING id, ten, he_thong AS "heThong", ghi_chu AS "ghiChu", thu_tu AS "thuTu"`,
      [Number(req.params.id), b.ten ?? null, b.heThong ?? null, b.ghiChu ?? null,
       b.thuTu == null ? null : Number(b.thuTu)]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy tài khoản này.' });
    res.json({ taiKhoan: row });
  } catch (e) { next(e); }
});

// DELETE /api/totp/:id — xoá hẳn.
totpRouter.delete('/:id', chiAdmin, async (req, res, next) => {
  try {
    await query('DELETE FROM totp_tai_khoan WHERE id=$1', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
