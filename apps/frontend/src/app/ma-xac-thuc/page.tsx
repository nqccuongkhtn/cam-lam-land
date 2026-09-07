'use client';
// TRA MÃ XÁC THỰC 2 LỚP (Google Authenticator) CHO CÁC TÀI KHOẢN DÙNG CHUNG CỦA CƠ QUAN.
// Chỉ mở cho quản trị viên và tài khoản được cấp quyền "Tra mã xác thực".
//
// Chuỗi bí mật KHÔNG bao giờ được gửi xuống trình duyệt — máy chủ tự sinh mã 6 số rồi mới gửi.
// Trang này chỉ hiện mã và đếm ngược, hết 30 giây thì hỏi máy chủ lấy mã mới.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth, coVaiTro, laAdmin } from '@/lib/auth';

type TaiKhoan = { id: number; ten: string; heThong: string; ghiChu: string; ma: string; conLai: number };

export default function MaXacThucPage() {
  const { user, loading: dangTaiUser } = useAuth() as any;
  const duocXem = coVaiTro(user, 'admin', 'xacthuc');
  const quanTri = laAdmin(user);

  const [ds, setDs] = useState<TaiKhoan[]>([]);
  const [conLai, setConLai] = useState(30);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState('');
  const [daChep, setDaChep] = useState<number | null>(null);
  const [moThem, setMoThem] = useState(false);
  const [oThem, setOThem] = useState('');
  const [dangLuu, setDangLuu] = useState(false);
  const hen = useRef<number | null>(null);

  const tai = useCallback(async () => {
    try {
      const r = await api<{ danhSach: TaiKhoan[]; conLai: number }>('/totp/ma');
      setDs(r.danhSach || []);
      setConLai(r.conLai ?? 30);
      setLoi('');
    } catch (e: any) {
      setLoi(e?.message || 'Không lấy được mã. Thử tải lại trang.');
    } finally { setDangTai(false); }
  }, []);

  // Lấy mã lần đầu, rồi HẸN GIỜ đúng lúc mã đổi mới hỏi lại — không hỏi liên tục cho đỡ tốn.
  useEffect(() => {
    if (!duocXem) { setDangTai(false); return; }
    tai();
    return () => { if (hen.current) window.clearTimeout(hen.current); };
  }, [duocXem, tai]);

  // Đồng hồ đếm ngược mỗi giây; về 0 thì xin mã mới.
  useEffect(() => {
    if (!duocXem) return;
    const t = window.setInterval(() => {
      setConLai((c) => {
        if (c <= 1) { tai(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [duocXem, tai]);

  async function chep(t: TaiKhoan) {
    try {
      await navigator.clipboard.writeText(t.ma);
      setDaChep(t.id);
      window.setTimeout(() => setDaChep((x) => (x === t.id ? null : x)), 1500);
    } catch { /* trình duyệt không cho chép thì thôi, người dùng tự gõ */ }
  }

  async function themTaiKhoan() {
    if (!oThem.trim()) return;
    setDangLuu(true);
    try {
      const r = await api<{ daThem: number; loi?: string[] }>('/totp', { method: 'POST', body: JSON.stringify({ danhSach: oThem.split(/\r?\n/) }) });
      setOThem(''); setMoThem(false);
      await tai();
      if (r.loi?.length) alert(`Đã thêm ${r.daThem} tài khoản. ${r.loi.length} dòng không đọc được.`);
    } catch (e: any) { alert(e?.message || 'Không thêm được.'); }
    finally { setDangLuu(false); }
  }

  async function xoa(t: TaiKhoan) {
    if (!confirm(`Xoá tài khoản "${t.ten}" khỏi danh sách tra mã?`)) return;
    try { await api(`/totp/${t.id}`, { method: 'DELETE' }); await tai(); }
    catch (e: any) { alert(e?.message || 'Không xoá được.'); }
  }

  if (dangTaiUser) return <div className="p-8 text-center text-slate-400">Đang tải…</div>;

  if (!duocXem) return (
    <div className="max-w-lg mx-auto p-6 mt-10 text-center">
      <div className="text-5xl mb-3">🔒</div>
      <h1 className="text-xl font-bold text-[#0A2540] mb-2">Trang dành riêng cho người được cấp quyền</h1>
      <p className="text-slate-500 mb-5">
        Đây là mã xác thực 2 lớp của các tài khoản dùng chung trong cơ quan. Muốn xem, nhờ quản trị viên
        cấp quyền <b>“Tra mã xác thực”</b> cho tài khoản của bạn.
      </p>
      <Link href="/" className="inline-block px-4 py-2 rounded-lg bg-[#0A2540] text-white font-semibold">Về trang chủ</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[#0A2540]">🔐 Mã xác thực 2 lớp</h1>
        {quanTri && (
          <button onClick={() => setMoThem((v) => !v)} className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            {moThem ? 'Đóng' : '＋ Thêm tài khoản'}
          </button>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-4">
        Mã tự đổi sau mỗi 30 giây, giống hệt ứng dụng Google Authenticator trên điện thoại.
        Bấm vào mã là chép được ngay.
      </p>

      {quanTri && moThem && (
        <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-[13px] text-slate-600 mb-2">
            Dán chuỗi lấy từ mã QR (dạng <code className="text-[12px]">otpauth://totp/…</code>), mỗi dòng một tài khoản:
          </p>
          <textarea value={oThem} onChange={(e) => setOThem(e.target.value)} rows={4}
            placeholder="otpauth://totp/VBDLIS:tentaikhoan?secret=XXXXXXXX&issuer=VBDLIS"
            className="w-full rounded-lg border border-slate-200 p-2 text-[13px] font-mono" />
          <div className="mt-2 flex gap-2">
            <button onClick={themTaiKhoan} disabled={dangLuu || !oThem.trim()}
              className="px-4 py-2 rounded-lg bg-[#0A2540] text-white text-sm font-semibold disabled:opacity-50">
              {dangLuu ? 'Đang lưu…' : 'Lưu'}
            </button>
            <span className="text-[12px] text-slate-400 self-center">Chuỗi bí mật được mã hoá trước khi lưu.</span>
          </div>
        </div>
      )}

      {/* Vạch thời gian chung: chạy ĐẦY DẦN, đầy hết vạch là cả bảng đổi mã mới. */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[12px] text-slate-400 mb-1">
          <span>Mã đổi sau</span><span className="font-bold text-slate-600">{conLai}s</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          {/* Vạch vừa đầy tới đích thì nhảy về 0 — bỏ hiệu ứng trượt ở đúng nhịp đó cho khỏi
              nhìn thấy nó "chạy giật lùi" về đầu. */}
          <div className={`h-full bg-[#00a2ff] ${conLai >= 29 ? '' : 'transition-[width] duration-1000 ease-linear'}`}
            style={{ width: `${((30 - conLai) / 30) * 100}%` }} />
        </div>
      </div>

      {loi && <div className="p-3 mb-3 rounded-lg bg-red-50 text-red-600 text-sm">{loi}</div>}
      {dangTai && <div className="p-6 text-center text-slate-400">Đang lấy mã…</div>}
      {!dangTai && !ds.length && !loi && (
        <div className="p-6 text-center text-slate-400">
          Chưa có tài khoản nào.{quanTri ? ' Bấm “＋ Thêm tài khoản” để dán chuỗi từ mã QR.' : ' Nhờ quản trị viên thêm vào.'}
        </div>
      )}

      <div className="space-y-2">
        {ds.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[#0A2540] truncate">{t.ten}</div>
              <div className="text-[12px] text-slate-400 truncate">{[t.heThong, t.ghiChu].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <button onClick={() => chep(t)} title="Bấm để chép mã"
              className="shrink-0 font-mono text-2xl sm:text-3xl font-bold tracking-[0.15em] text-[#0A2540] hover:text-[#00a2ff]">
              {t.ma ? `${t.ma.slice(0, 3)} ${t.ma.slice(3)}` : '——— ———'}
            </button>
            <span className={`shrink-0 w-14 text-[11px] font-semibold ${daChep === t.id ? 'text-green-600' : 'text-slate-300'}`}>
              {daChep === t.id ? '✓ Đã chép' : ''}
            </span>
            {quanTri && (
              <button onClick={() => xoa(t)} title="Xoá khỏi danh sách"
                className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50">✕</button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-5 text-[12px] text-slate-400 leading-relaxed">
        ⚠️ Mã này thay cho điện thoại của người giữ tài khoản — ai xem được trang này là đăng nhập được
        vào hệ thống kia. Chỉ cấp quyền cho người thật sự cần, và thu hồi ngay khi họ chuyển việc.
      </p>
    </div>
  );
}
