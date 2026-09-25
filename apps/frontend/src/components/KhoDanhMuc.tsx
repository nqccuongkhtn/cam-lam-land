'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// KHO DANH MỤC HỒ SƠ (dùng tạm — dễ gỡ): thư mục cất các file danh mục Excel đã lập.
// Nằm trong trang /lap-danh-muc ở tab thứ hai — KHÔNG còn trang riêng, nên ở đây không vẽ tiêu đề.
// Có sẵn thư mục "Phòng Kinh tế", tạo thêm thư mục khác được.
// Sắp xếp MẶC ĐỊNH theo SỐ ĐÁNH Ở ĐẦU TÊN FILE (0490, 0489…) — đúng thứ tự bạn tự đánh khi đặt tên.
// Chọn nhiều dòng → tải một lượt về thành 1 file nén; mỗi dòng cũng có nút tải riêng.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, laAdmin, coVaiTro } from '@/lib/auth';
import { apiBase } from '@/lib/api';
import { getToken } from '@/lib/token';
import { toast } from '@/lib/toast';

const NAVY = '#0B4045', GOLD = '#C8A14B';
const authHead = () => ({ Authorization: `Bearer ${getToken() || ''}` });

type ThuMuc = { slug: string; ten: string; icon: string; so_file: number; tong_bytes: number };
type FileKho = { id: number; thu_muc: string; so_tt: number | null; ten: string; mime: string; co_bytes: number; ghi_chu: string | null; created_at: string };

const coFile = (n: number) => (n < 1024 ? n + ' B' : n < 1024 * 1024 ? (n / 1024).toFixed(0) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB');
const ngayVN = (s: string) => { try { return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
// Biểu tượng theo đuôi file để nhìn phát biết ngay loại gì.
const iconFile = (ten: string) => /\.(xlsx|xls|csv)$/i.test(ten) ? '📊' : /\.pdf$/i.test(ten) ? '📕' : /\.(docx?|rtf)$/i.test(ten) ? '📘' : /\.(jpe?g|png|webp)$/i.test(ten) ? '🖼️' : /\.zip$/i.test(ten) ? '🗜️' : '📄';

// Mỗi lần hiện 20 file: chế độ chia trang = 20 file/trang · chế độ cuộn = mỗi lần kéo tới đáy hiện thêm 20.
const MOI_TRANG = 20;

// ── THANH CHUYỂN TRANG ──
// Hiện trang đang xem cùng vài trang liền kề trước/sau, kèm nút về trang đầu và tới trang cuối.
// Nhiều trang quá thì chèn dấu … cho gọn, khỏi tràn màn hình.
function ThanhTrang({ trang, soTrang, doi }: { trang: number; soTrang: number; doi: (t: number) => void }) {
  const canh = 2;                                   // hiện 2 trang trước và 2 trang sau trang đang xem
  const ds: (number | '…')[] = [];
  for (let i = 1; i <= soTrang; i++) {
    if (i === 1 || i === soTrang || (i >= trang - canh && i <= trang + canh)) ds.push(i);
    else if (ds[ds.length - 1] !== '…') ds.push('…');
  }
  const nut = 'min-w-[30px] h-[30px] px-2 rounded-lg border text-[13px] font-bold transition disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
      <button onClick={() => doi(1)} disabled={trang === 1} className={nut} style={{ borderColor: '#dfe4ec', color: NAVY, background: '#fff' }} title="Về trang đầu">«</button>
      <button onClick={() => doi(trang - 1)} disabled={trang === 1} className={nut} style={{ borderColor: '#dfe4ec', color: NAVY, background: '#fff' }} title="Trang trước">‹</button>
      {ds.map((x, i) => x === '…'
        ? <span key={'d' + i} className="px-1 text-slate-400">…</span>
        : (
          <button key={x} onClick={() => doi(x)} className={nut}
            style={x === trang
              ? { borderColor: NAVY, background: NAVY, color: '#fff' }
              : { borderColor: '#dfe4ec', background: '#fff', color: NAVY }}>
            {x}
          </button>
        ))}
      <button onClick={() => doi(trang + 1)} disabled={trang === soTrang} className={nut} style={{ borderColor: '#dfe4ec', color: NAVY, background: '#fff' }} title="Trang sau">›</button>
      <button onClick={() => doi(soTrang)} disabled={trang === soTrang} className={nut} style={{ borderColor: '#dfe4ec', color: NAVY, background: '#fff' }} title="Tới trang cuối">»</button>
    </div>
  );
}

export default function KhoDanhMuc() {
  const { user } = useAuth();
  // Ai đăng nhập cũng LƯỚT được cho biết kho có gì. Nhưng chỉ vai trò được cấp mới thấy tên thật,
  // mở xem và tải file — máy chủ tự che 2/3 tên với người chưa được cấp (routes/khoHoSo.ts).
  const duocVao = !!user;
  const dayDuMacDinh = laAdmin(user) || coVaiTro(user, 'danhmuc');   // quản lý văn bản là vai trò KHÁC, không tự động vào kho
  const [dayDu, setDayDu] = useState(dayDuMacDinh);   // máy chủ trả về kèm danh sách file, lấy đó làm chuẩn
  const [xem, setXem] = useState<FileKho | null>(null); // file đang mở cửa sổ xem

  const [thuMucs, setThuMucs] = useState<ThuMuc[]>([]);
  const [thuMuc, setThuMuc] = useState('phong-kinh-te');
  const [files, setFiles] = useState<FileKho[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'stt' | 'stt_giam' | 'ten' | 'moi'>('stt');
  const [chon, setChon] = useState<Set<number>>(new Set());
  const [trang, setTrang] = useState(1);            // đang xem trang thứ mấy (20 file/trang)
  // ── HAI KIỂU XEM DANH SÁCH, người dùng tự chọn ──
  // 'trang' = chia trang, bấm số trang như cũ · 'cuon' = kéo xuống tới đáy là tự hiện thêm 20 file.
  // Máy nhớ lựa chọn này trong trình duyệt nên lần sau mở lại vẫn đúng kiểu quen dùng.
  const [kieuXem, setKieuXem] = useState<'trang' | 'cuon'>('trang');
  const [soHien, setSoHien] = useState(MOI_TRANG);  // chế độ cuộn: đang hiện bao nhiêu file
  const mocCuoi = useRef<HTMLDivElement | null>(null);   // vạch mốc cuối danh sách, kéo tới đây thì nạp thêm
  const neoChon = useRef<number | null>(null);     // dòng bấm gần nhất, làm mốc khi giữ Shift chọn cả dải
  // ── TẢI THEO KHOẢNG SỐ THỨ TỰ (ví dụ từ 528 đến 538) ──
  const [ttDau, setTtDau] = useState('');
  const [ttCuoi, setTtCuoi] = useState('');
  // Khi trong khoảng có số thứ tự chưa có file thì mở hộp thoại hỏi lại chứ không tải lặng lẽ.
  const [hoiThieu, setHoiThieu] = useState<{ dau: number; cuoi: number; ds: FileKho[]; thieu: number[] } | null>(null);
  const [dangTai, setDangTai] = useState(false);
  const [tienDo, setTienDo] = useState('');
  const [keo, setKeo] = useState(false);
  const [dangDoc, setDangDoc] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ── Nạp danh sách thư mục ──
  const napThuMuc = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/kho-ho-so/thu-muc`, { headers: authHead() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không đọc được thư mục');
      setThuMucs((await r.json()).thuMuc || []);
    } catch (e: any) { toast.error(e?.message || 'Không đọc được danh sách thư mục'); }
  }, []);

  // ── Nạp danh sách file trong thư mục đang mở ──
  const napFile = useCallback(async () => {
    setDangDoc(true);
    try {
      const u = new URLSearchParams({ thu_muc: thuMuc, sort });
      if (q.trim()) u.set('q', q.trim());
      const r = await fetch(`${apiBase}/kho-ho-so?${u}`, { headers: authHead() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không đọc được danh sách file');
      const kq = await r.json();
      setFiles(kq.files || []);
      setDayDu(!!kq.dayDu);
    } catch (e: any) { toast.error(e?.message || 'Không đọc được danh sách file'); }
    finally { setDangDoc(false); }
  }, [thuMuc, sort, q]);

  // Đổi thư mục, gõ tìm, đổi sắp xếp → xem lại từ đầu danh sách và quên mốc chọn cũ đi.
  useEffect(() => { setTrang(1); setSoHien(MOI_TRANG); neoChon.current = null; }, [thuMuc, q, sort]);
  // Lấy lại kiểu xem người dùng đã chọn lần trước (lưu ngay trong trình duyệt, không đụng máy chủ).
  useEffect(() => {
    try { const v = localStorage.getItem('kho_kieu_xem'); if (v === 'cuon' || v === 'trang') setKieuXem(v); } catch { /* trình duyệt chặn thì thôi */ }
  }, []);
  const doiKieuXem = (k: 'trang' | 'cuon') => {
    setKieuXem(k); setTrang(1); setSoHien(MOI_TRANG); neoChon.current = null;
    try { localStorage.setItem('kho_kieu_xem', k); } catch { /* bỏ qua */ }
  };
  useEffect(() => { if (duocVao) napThuMuc(); }, [duocVao, napThuMuc]);
  // Gõ tìm kiếm thì đợi 350ms mới hỏi máy chủ — gõ tới đâu hỏi tới đó là làm nặng máy chủ vô ích.
  useEffect(() => { if (!duocVao) return; const t = setTimeout(() => { napFile(); setChon(new Set()); }, 350); return () => clearTimeout(t); }, [duocVao, napFile]);

  // ── TỰ LÀM MỚI: 30 giây một lần, chỉ trong GIỜ HÀNH CHÍNH 8h–17h ──
  // Để máy tự đẩy file lên là thấy ngay, khỏi bấm F5. Ngoài giờ đó thì thôi cho nhẹ máy chủ.
  // Bỏ qua lượt làm mới khi: đang tải file lên (sợ nhảy số giữa chừng) hoặc đang xem tab khác.
  const trongGioLamViec = () => { const g = new Date().getHours(); return g >= 8 && g < 17; };
  const [tuLamMoi, setTuLamMoi] = useState(true);
  useEffect(() => {
    if (!duocVao || !tuLamMoi) return;
    const iv = setInterval(() => {
      if (!trongGioLamViec()) return;
      if (dangTai || document.visibilityState !== 'visible') return;
      napFile(); napThuMuc();
    }, 30_000);
    return () => clearInterval(iv);
  }, [duocVao, tuLamMoi, dangTai, napFile, napThuMuc]);

  // ── Tải file LÊN kho ──
  async function taiLen(ds: FileList | File[]) {
    const arr = Array.from(ds); if (!arr.length) return;
    setDangTai(true);
    try {
      // Chia thành từng lô 20 file cho khỏi nghẽn khi chọn cả trăm file một lúc.
      let xong = 0;
      for (let i = 0; i < arr.length; i += 20) {
        const lo = arr.slice(i, i + 20);
        setTienDo(`Đang tải lên ${xong + 1}–${xong + lo.length} / ${arr.length} file…`);
        const fd = new FormData();
        fd.append('thu_muc', thuMuc);
        lo.forEach((f) => fd.append('files', f, f.name));
        const r = await fetch(`${apiBase}/kho-ho-so`, { method: 'POST', headers: authHead(), body: fd });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Tải lên thất bại');
        const kq = await r.json();
        xong += kq.daTai || 0;
        (kq.boQua || []).forEach((b: any) => toast.info(`Bỏ qua "${b.ten}": ${b.vi_sao}`));
      }
      toast.success(`Đã tải lên ${xong} file vào thư mục này`);
      await Promise.all([napFile(), napThuMuc()]);
    } catch (e: any) { toast.error(e?.message || 'Tải lên thất bại'); }
    finally { setDangTai(false); setTienDo(''); }
  }

  // ── Tải MỘT file về máy (nút ⬇ ở từng dòng) ──
  // Phải gọi kèm thẻ đăng nhập nên không dùng thẻ <a> thường được — tải về bộ nhớ rồi mới lưu.
  async function taiMot(f: FileKho) {
    try {
      const r = await fetch(`${apiBase}/kho-ho-so/${f.id}/tai`, { headers: authHead() });
      if (!r.ok) throw new Error('Không tải được file');
      luuFile(await r.blob(), f.ten);
    } catch (e: any) { toast.error(e?.message || 'Không tải được file'); }
  }

  function luuFile(blob: Blob, ten: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = ten;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ── Tải NHIỀU file đã chọn → gộp thành 1 file nén cho gọn ──
  async function taiNhieu() {
    const ds = files.filter((f) => chon.has(f.id));
    if (!ds.length) { toast.info('Chưa chọn file nào'); return; }
    const tenTM = thuMucs.find((t) => t.slug === thuMuc)?.ten || thuMuc;
    await taiGoi(ds, `${tenTM} - ${ds.length} file.zip`);
  }

  // Gom một danh sách file thành 1 file nén rồi lưu về máy (dùng cho cả "tải file đã chọn"
  // lẫn "tải theo khoảng số thứ tự"). Nén hỏng thì tự chuyển sang tải lần lượt từng file.
  async function taiGoi(ds: FileKho[], tenZip: string) {
    if (!ds.length) return;
    setDangTai(true);
    try {
      const JSZip = (await import(/* webpackIgnore: true */ 'https://esm.sh/jszip@3.10.1' as any)).default;
      const zip = new JSZip();
      for (let i = 0; i < ds.length; i++) {
        setTienDo(`Đang gom ${i + 1}/${ds.length} file…`);
        const r = await fetch(`${apiBase}/kho-ho-so/${ds[i].id}/tai`, { headers: authHead() });
        if (!r.ok) continue;
        zip.file(ds[i].ten, await r.blob());
      }
      setTienDo('Đang nén lại…');
      const blob = await zip.generateAsync({ type: 'blob' });
      luuFile(blob, tenZip);
      toast.success(`Đã tải ${ds.length} file về máy`);
    } catch {
      // Nén hỏng thì tải lần lượt từng file — chậm hơn nhưng chắc chắn được việc.
      toast.info('Không gom nén được — chuyển sang tải lần lượt từng file');
      for (const f of ds) { await taiMot(f); await new Promise((r) => setTimeout(r, 400)); }
    } finally { setDangTai(false); setTienDo(''); }
  }

  // ── TẢI TỪ SỐ THỨ TỰ … ĐẾN SỐ THỨ TỰ … ──
  // Dò trong thư mục đang mở xem khoảng đó có đủ file chưa. Thiếu số nào thì mở hộp thoại
  // liệt kê rõ ra, người dùng tự quyết: tải phần đang có, hay để đó chờ làm đủ rồi tải lại.
  function timTheoDai() {
    const a = parseInt(ttDau.replace(/\D/g, ''), 10), b = parseInt(ttCuoi.replace(/\D/g, ''), 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) { toast.info('Nhập số thứ tự đầu và số thứ tự cuối'); return; }
    const dau = Math.min(a, b), cuoi = Math.max(a, b);          // gõ ngược cũng không sao, máy tự đảo lại
    if (cuoi - dau > 500) { toast.info('Mỗi lần tải nhiều nhất 500 số thứ tự cho nhẹ máy'); return; }
    const ds = files
      .filter((f) => f.so_tt != null && f.so_tt >= dau && f.so_tt <= cuoi)
      .sort((x, y) => (x.so_tt! - y.so_tt!) || x.ten.localeCompare(y.ten, 'vi'));
    const daCo = new Set(ds.map((f) => f.so_tt as number));
    const thieu: number[] = [];
    for (let i = dau; i <= cuoi; i++) if (!daCo.has(i)) thieu.push(i);
    if (thieu.length) { setHoiThieu({ dau, cuoi, ds, thieu }); return; }   // thiếu → hỏi lại đã
    taiDai(dau, cuoi, ds);
  }
  function taiDai(dau: number, cuoi: number, ds: FileKho[]) {
    const tenTM = thuMucs.find((t) => t.slug === thuMuc)?.ten || thuMuc;
    taiGoi(ds, `${tenTM} - STT ${dau}-${cuoi} (${ds.length} file).zip`);
  }

  async function xoaNhieu() {
    const ids = [...chon]; if (!ids.length) return;
    if (!confirm(`Xoá hẳn ${ids.length} file khỏi kho? Không lấy lại được.`)) return;
    try {
      const r = await fetch(`${apiBase}/kho-ho-so/xoa-nhieu`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHead() }, body: JSON.stringify({ ids }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Xoá thất bại');
      toast.success(`Đã xoá ${ids.length} file`); setChon(new Set());
      await Promise.all([napFile(), napThuMuc()]);
    } catch (e: any) { toast.error(e?.message || 'Xoá thất bại'); }
  }

  // ── SỬA TÊN MỘT FILE ── tải nhầm tên hay gõ sai số thứ tự thì sửa tại chỗ, khỏi xoá đi tải lại.
  async function suaTenFile(f: FileKho) {
    const ten = prompt('Sửa tên file (giữ nguyên đuôi .xlsx/.pdf… cho đúng loại):', f.ten);
    if (!ten?.trim() || ten.trim() === f.ten) return;
    try {
      const r = await fetch(`${apiBase}/kho-ho-so/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHead() }, body: JSON.stringify({ ten: ten.trim() }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Sửa tên thất bại');
      toast.success('Đã đổi tên file');
      await napFile();
    } catch (e: any) { toast.error(e?.message || 'Sửa tên thất bại'); }
  }

  // ── XOÁ MỘT FILE ── ngay trên dòng đó, khỏi phải tích chọn rồi mới xoá được.
  async function xoaMot(f: FileKho) {
    if (!confirm(`Xoá hẳn file "${f.ten}" khỏi kho?

Không lấy lại được.`)) return;
    try {
      const r = await fetch(`${apiBase}/kho-ho-so/${f.id}`, { method: 'DELETE', headers: authHead() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Xoá thất bại');
      toast.success('Đã xoá file');
      setChon((p) => { const n = new Set(p); n.delete(f.id); return n; });
      await Promise.all([napFile(), napThuMuc()]);
    } catch (e: any) { toast.error(e?.message || 'Xoá thất bại'); }
  }

  // ── XOÁ CẢ THƯ MỤC ── thư mục còn file thì chỉ ADMIN mới xoá được (xoá luôn file bên trong).
  async function xoaThuMucDangMo() {
    const tm = thuMucs.find((x) => x.slug === thuMuc);
    if (!tm) return;
    if (tm.slug === 'phong-kinh-te') { toast.error('Thư mục Phòng Kinh tế là thư mục gốc, không xoá được'); return; }
    const so = tm.so_file || 0;
    const admin = laAdmin(user);
    if (so > 0 && !admin) { toast.error(`Thư mục còn ${so} file — xoá hết file rồi mới xoá được thư mục`); return; }
    const hoi = so > 0
      ? `Xoá thư mục "${tm.ten}" VÀ CẢ ${so} file bên trong?

Không lấy lại được.`
      : `Xoá thư mục "${tm.ten}"?`;
    if (!confirm(hoi)) return;
    if (so > 0 && !confirm(`Chắc chắn xoá ${so} file chứ? Bấm OK là mất hẳn.`)) return;
    try {
      const r = await fetch(`${apiBase}/kho-ho-so/thu-muc/${tm.slug}${so > 0 ? '?ca=1' : ''}`, { method: 'DELETE', headers: authHead() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Xoá thư mục thất bại');
      toast.success('Đã xoá thư mục' + (so > 0 ? ` và ${so} file` : ''));
      setThuMuc('phong-kinh-te'); setChon(new Set());
      await Promise.all([napThuMuc(), napFile()]);
    } catch (e: any) { toast.error(e?.message || 'Xoá thư mục thất bại'); }
  }

  async function themThuMuc() {
    const ten = prompt('Tên thư mục mới (ví dụ: Phòng Tài nguyên, Hồ sơ năm 2026):');
    if (!ten?.trim()) return;
    try {
      const r = await fetch(`${apiBase}/kho-ho-so/thu-muc`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHead() }, body: JSON.stringify({ ten: ten.trim() }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không tạo được thư mục');
      const tm = await r.json(); toast.success('Đã tạo thư mục ' + tm.ten);
      await napThuMuc(); setThuMuc(tm.slug);
    } catch (e: any) { toast.error(e?.message || 'Không tạo được thư mục'); }
  }

  // ── DANH SÁCH ĐANG HIỆN TRÊN MÀN HÌNH ──
  // Kiểu 'trang': cắt đúng 20 file của trang đang xem · Kiểu 'cuon': lấy từ đầu tới số file đang hiện.
  const soTrang = Math.max(1, Math.ceil(files.length / MOI_TRANG));
  const trangHienTai = Math.min(trang, soTrang);        // xoá file làm hụt trang cuối → lùi về trang còn dữ liệu
  const filesTrang = kieuXem === 'cuon'
    ? files.slice(0, soHien)
    : files.slice((trangHienTai - 1) * MOI_TRANG, trangHienTai * MOI_TRANG);
  const conNua = kieuXem === 'cuon' && soHien < files.length;   // còn file chưa hiện ra

  // Kéo xuống gần đáy danh sách thì tự hiện thêm 20 file nữa (chỉ ở kiểu 'cuon').
  // Dùng "mắt canh" của trình duyệt (IntersectionObserver) nên không phải nghe sự kiện cuộn liên tục.
  useEffect(() => {
    if (kieuXem !== 'cuon') return;
    const el = mocCuoi.current; if (!el) return;
    const mat = new IntersectionObserver((es) => {
      if (es[0]?.isIntersecting) setSoHien((n) => (n < files.length ? Math.min(n + MOI_TRANG, files.length) : n));
    }, { rootMargin: '300px' });                       // thấy trước 300px là nạp sẵn, kéo tới nơi đã có sẵn file
    mat.observe(el);
    return () => mat.disconnect();
  }, [kieuXem, files.length, soHien]);

  const doiChon = (id: number) => setChon((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // Bấm vào ô vuông: bấm thường = chọn/bỏ chọn một dòng.
  // GIỮ PHÍM SHIFT rồi bấm = chọn luôn CẢ DẢI từ dòng bấm lần trước tới dòng vừa bấm (như trong Windows).
  const bamChon = (id: number, giuShift: boolean) => {
    const dsId = filesTrang.map((f) => f.id);
    const neo = neoChon.current;
    if (giuShift && neo != null && neo !== id) {
      const a = dsId.indexOf(neo), b = dsId.indexOf(id);
      if (a >= 0 && b >= 0) {                           // cả hai dòng đều đang hiện thì mới chọn theo dải
        const dau = Math.min(a, b), cuoi = Math.max(a, b);
        setChon((p) => { const n = new Set(p); for (let i = dau; i <= cuoi; i++) n.add(dsId[i]); return n; });
        neoChon.current = id;
        return;
      }
    }
    neoChon.current = id;
    doiChon(id);
  };
  // Chọn tất cả = chọn hết file ĐANG HIỆN (không gom cả kho, tránh tải nhầm hàng trăm file).
  const chonHet = () => setChon((p) => {
    const idTrang = filesTrang.map((f) => f.id);
    const duHet = idTrang.length > 0 && idTrang.every((id) => p.has(id));
    const n = new Set(p);
    idTrang.forEach((id) => (duHet ? n.delete(id) : n.add(id)));
    return n;
  });

  if (!user) return <Khung><p className="text-sm text-slate-600">Bạn cần <b>đăng nhập</b> để mở kho danh mục hồ sơ.</p></Khung>;

  return (
    <Khung>
      <div className="grid gap-3 md:grid-cols-[210px_1fr]">
        {/* ── CỘT TRÁI: danh sách thư mục ── */}
        <aside className="rounded-xl border bg-white p-2" style={{ borderColor: '#e5e7eb' }}>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-xs font-bold" style={{ color: NAVY }}>THƯ MỤC</span>
            {dayDu && <button onClick={themThuMuc} title="Tạo thư mục mới" className="rounded px-1.5 text-lg leading-none" style={{ color: GOLD }}>＋</button>}
          </div>
          <div className="space-y-0.5">
            {thuMucs.map((t) => (
              <div key={t.slug} className="group flex items-center gap-1">
                <button onClick={() => { setThuMuc(t.slug); setChon(new Set()); }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
                  style={thuMuc === t.slug ? { background: NAVY, color: '#fff' } : { color: NAVY }}>
                  <span>{t.icon}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.ten}</span>
                  <span className="text-[11px] opacity-70">{t.so_file}</span>
                </button>
                {/* Xoá thư mục: hiện khi thư mục đang mở. Còn file bên trong thì chỉ admin xoá được. */}
                {dayDu && thuMuc === t.slug && t.slug !== 'phong-kinh-te' && (
                  <button onClick={xoaThuMucDangMo} title={t.so_file > 0
                    ? (laAdmin(user) ? `Xoá thư mục này VÀ cả ${t.so_file} file bên trong` : `Thư mục còn ${t.so_file} file — xoá hết file rồi mới xoá được thư mục`)
                    : 'Xoá thư mục rỗng này'}
                    className="shrink-0 rounded-lg px-1.5 py-1.5 text-xs font-bold"
                    style={{ background: '#fee2e2', color: '#9b1c1c' }}>🗑</button>
                )}
              </div>
            ))}
            {!thuMucs.length && <div className="px-2 py-3 text-[11px] text-slate-400">Đang tải…</div>}
          </div>
        </aside>

        {/* ── CỘT PHẢI: thanh công cụ + bảng file ── */}
        <section className="min-w-0">
          {/* Người chưa được cấp quyền: nói rõ đang xem hạn chế, khỏi tưởng web hỏng */}
          {!dayDu && (
            <div className="mb-2 rounded-lg px-3 py-2 text-[12.5px] leading-snug" style={{ background: '#fff7e6', color: '#7a5b13' }}>
              🔒 Bạn đang xem ở <b>chế độ hạn chế</b>: chỉ thấy kho có những file nào, <b>tên file bị che bớt</b>,
              không mở xem / tải về / xoá được. Cần xem đầy đủ thì nhờ quản trị cấp quyền <b>Kho danh mục hồ sơ</b> cho tài khoản của bạn.
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={dayDu ? 'Tìm theo tên hoặc số thứ tự (gõ 490)…' : 'Tìm theo số thứ tự (gõ 490)…'}
              className="min-w-[190px] flex-1 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: '#d8dee7' }} />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: '#d8dee7' }}>
              <option value="stt">Số thứ tự tăng dần</option>
              <option value="stt_giam">Số thứ tự giảm dần</option>
              <option value="ten">Theo tên A→Z</option>
              <option value="moi">Mới tải lên trước</option>
            </select>
            {/* Chọn cách xem danh sách: chia trang bấm số, hay kéo xuống tự hiện thêm */}
            <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: '#d8dee7' }}>
              <button onClick={() => doiKieuXem('trang')} title="Chia thành từng trang 20 file, bấm số trang để đi tới"
                className="px-2.5 py-1.5 text-[12.5px] font-semibold transition"
                style={kieuXem === 'trang' ? { background: NAVY, color: '#fff' } : { background: '#fff', color: '#64748b' }}>📄 Chia trang</button>
              <button onClick={() => doiKieuXem('cuon')} title="Kéo xuống cuối là tự hiện thêm 20 file nữa"
                className="border-l px-2.5 py-1.5 text-[12.5px] font-semibold transition" 
                style={kieuXem === 'cuon' ? { background: NAVY, color: '#fff', borderColor: '#d8dee7' } : { background: '#fff', color: '#64748b', borderColor: '#d8dee7' }}>⬇ Kéo xuống</button>
            </div>
            {dayDu && <button onClick={() => inputRef.current?.click()} disabled={dangTai}
              className="rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-60" style={{ background: GOLD, color: NAVY }}>⬆ Tải file lên</button>}
            <input ref={inputRef} type="file" multiple hidden accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.zip"
              onChange={(e) => { if (e.target.files?.length) taiLen(e.target.files); (e.target as HTMLInputElement).value = ''; }} />
          </div>

          {/* Tải cả một khoảng số thứ tự, khỏi phải bấm chọn từng dòng */}
          {dayDu && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: '#f6f8fb' }}>
              <span className="text-[13px] font-bold" style={{ color: NAVY }}>⬇ Tải theo số thứ tự:</span>
              <span className="text-[13px] text-slate-500">từ</span>
              <input value={ttDau} onChange={(e) => setTtDau(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') timTheoDai(); }}
                inputMode="numeric" placeholder="528" className="w-[74px] rounded-lg border px-2 py-1 text-center text-[13px]" style={{ borderColor: '#d8dee7' }} />
              <span className="text-[13px] text-slate-500">đến</span>
              <input value={ttCuoi} onChange={(e) => setTtCuoi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') timTheoDai(); }}
                inputMode="numeric" placeholder="538" className="w-[74px] rounded-lg border px-2 py-1 text-center text-[13px]" style={{ borderColor: '#d8dee7' }} />
              <button onClick={timTheoDai} disabled={dangTai}
                className="rounded-lg px-3 py-1 text-[13px] font-bold disabled:opacity-60" style={{ background: NAVY, color: '#fff' }}>Tải khoảng này</button>
              <span className="text-[11.5px] text-slate-500">Thiếu số nào máy báo trước, không tải lén.</span>
            </div>
          )}

          {/* Thanh hiện ra khi đã chọn dòng nào đó */}
          {dayDu && chon.size > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: '#eef4ff' }}>
              <b style={{ color: NAVY }}>Đã chọn {chon.size} file</b>
              <button onClick={taiNhieu} disabled={dangTai} className="rounded-lg px-3 py-1 text-sm font-bold disabled:opacity-60" style={{ background: NAVY, color: '#fff' }}>⬇ Tải {chon.size} file về (1 file nén)</button>
              <button onClick={xoaNhieu} disabled={dangTai} className="rounded-lg px-2.5 py-1 text-sm font-semibold" style={{ background: '#fee2e2', color: '#9b1c1c' }}>🗑 Xoá</button>
              <button onClick={() => setChon(new Set())} className="text-sm underline text-slate-500">bỏ chọn</button>
            </div>
          )}
          {tienDo && <div className="mb-2 rounded-lg px-3 py-1.5 text-sm" style={{ background: '#fff7e6', color: '#7a5b13' }}>⏳ {tienDo}</div>}

          {/* Vùng kéo-thả: kéo file từ máy thả vào đây là tải lên luôn */}
          <div
            onDragOver={(e) => { if (!dayDu) return; e.preventDefault(); setKeo(true); }}
            onDragLeave={() => setKeo(false)}
            onDrop={(e) => { if (!dayDu) return; e.preventDefault(); setKeo(false); if (e.dataTransfer.files?.length) taiLen(e.dataTransfer.files); }}
            className="overflow-x-auto rounded-xl border bg-white transition"
            style={{ borderColor: keo ? GOLD : '#e5e7eb', boxShadow: keo ? `0 0 0 3px ${GOLD}33` : 'none' }}>
            {/* table-fixed = cột nào rộng bao nhiêu là do mình đặt, tên file dài thì tự thu lại thành "…".
                Trước đây tên file dài đẩy bảng phình ra làm mất luôn nút 🗑 Xoá ở cột cuối. */}
            <table className="w-full min-w-[460px] table-fixed text-sm">
              <thead>
                <tr className="text-left" style={{ background: '#f6f8fb', color: NAVY }}>
                  {dayDu && <th className="w-9 px-2 py-2"><input type="checkbox" checked={!!filesTrang.length && filesTrang.every((f) => chon.has(f.id))} onChange={chonHet} title="Chọn tất cả file đang hiện" /></th>}
                  <th className="w-14 px-1 py-2 text-[12px]">STT</th>
                  <th className="min-w-0 px-2 py-2 text-[12px]">Tên file</th>
                  <th className="hidden w-20 px-2 py-2 text-[12px] sm:table-cell">Cỡ</th>
                  <th className="hidden w-32 px-2 py-2 text-[12px] sm:table-cell">Ngày tải lên</th>
                  {dayDu && <th className="w-[128px] px-2 py-2 text-center text-[12px]">Tải · Sửa · Xoá</th>}
                </tr>
              </thead>
              <tbody>
                {filesTrang.map((f) => (
                  <tr key={f.id} className="border-t transition hover:bg-slate-50" style={{ borderColor: '#eef1f5', background: chon.has(f.id) ? '#f2f7ff' : undefined }}>
                    {dayDu && <td className="px-2 py-1.5"><input type="checkbox" checked={chon.has(f.id)}
                      title="Bấm để chọn · giữ phím Shift rồi bấm để chọn cả dải nhiều dòng"
                      onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
                      onClick={(e) => bamChon(f.id, e.shiftKey)}
                      onChange={() => { /* việc chọn đã làm ở onClick để biết có giữ Shift hay không */ }} /></td>}
                    <td className="px-1 py-1.5 text-center font-bold tabular-nums" style={{ color: f.so_tt == null ? '#9aa7b6' : GOLD }}>{f.so_tt ?? '—'}</td>
                    <td className="min-w-0 px-2 py-1.5">
                      {dayDu ? (
                        // Bấm vào tên là MỞ XEM ngay trên web (không phải tải về).
                        <button onClick={() => setXem(f)} className="flex w-full items-center gap-1.5 text-left hover:underline" title="Bấm để mở xem file này">
                          <span>{iconFile(f.ten)}</span><span className="min-w-0 flex-1 truncate" style={{ color: NAVY }}>{f.ten}</span>
                        </button>
                      ) : (
                        // Chưa được cấp quyền: tên đã bị máy chủ che sẵn, bấm vào cũng không mở được.
                        <div className="flex w-full items-center gap-1.5 text-left" title="Bạn chưa được cấp quyền xem tên đầy đủ">
                          <span>{iconFile(f.ten)}</span><span className="min-w-0 flex-1 truncate text-slate-400">{f.ten}</span><span className="shrink-0 text-[11px]">🔒</span>
                        </div>
                      )}
                    </td>
                    <td className="hidden px-2 py-1.5 text-[12px] text-slate-500 sm:table-cell">{coFile(f.co_bytes)}</td>
                    <td className="hidden px-2 py-1.5 text-[12px] text-slate-500 sm:table-cell">{ngayVN(f.created_at)}</td>
                    {dayDu && (
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">
                        <span className="inline-flex shrink-0 gap-1">
                          <button onClick={() => taiMot(f)} title={'Tải "' + f.ten + '" về máy'} className="rounded-lg px-2 py-1 font-bold" style={{ background: '#eef4ff', color: NAVY }}>⬇</button>
                          <button onClick={() => suaTenFile(f)} title="Sửa tên file (tải nhầm tên thì sửa ở đây)" className="rounded-lg px-2 py-1 font-bold" style={{ background: '#fff7e6', color: '#92400e' }}>✏️</button>
                          <button onClick={() => xoaMot(f)} title="Xoá hẳn file này khỏi kho" className="rounded-lg px-2 py-1 font-bold" style={{ background: '#fee2e2', color: '#9b1c1c' }}>🗑</button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
                {!filesTrang.length && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                    {dangDoc ? 'Đang đọc kho…' : q ? `Không có file nào khớp "${q}"` : dayDu ? 'Thư mục này chưa có file. Bấm ⬆ Tải file lên, hoặc kéo thẳng file từ máy thả vào đây.' : 'Thư mục này chưa có file.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {kieuXem === 'trang'
            ? (soTrang > 1 && <ThanhTrang trang={trangHienTai} soTrang={soTrang} doi={setTrang} />)
            : (
              // Vạch mốc cuối danh sách: kéo tới gần đây là tự hiện thêm. Kèm nút bấm tay phòng khi
              // trình duyệt cũ không hỗ trợ, hoặc người dùng thích tự bấm hơn.
              <div ref={mocCuoi} className="mt-2 text-center">
                {conNua ? (
                  <button onClick={() => setSoHien((n) => Math.min(n + MOI_TRANG, files.length))}
                    className="rounded-lg border px-3 py-1.5 text-[13px] font-bold" style={{ borderColor: '#dfe4ec', color: NAVY, background: '#fff' }}>
                    ⬇ Hiện thêm {Math.min(MOI_TRANG, files.length - soHien)} file nữa
                  </button>
                ) : files.length > MOI_TRANG ? (
                  <span className="text-[12px] text-slate-400">— đã hết danh sách —</span>
                ) : null}
              </div>
            )}
          <div className="mt-1.5 text-[11px] leading-snug text-slate-500">
            {!files.length ? '0 file'
              : kieuXem === 'cuon'
                ? <>Đang hiện <b>{filesTrang.length}</b> trong tổng <b>{files.length}</b> file</>
                : <>Đang xem <b>{(trangHienTai - 1) * MOI_TRANG + 1}–{Math.min(trangHienTai * MOI_TRANG, files.length)}</b> trong tổng <b>{files.length}</b> file</>} · Sắp xếp theo <b>số bạn đánh ở đầu tên file</b> (0490, 0489…).
            {dayDu && <> Bấm vào <b>tên file</b> để mở xem ngay trên web. Chọn nhiều file: bấm ô vuông đầu dòng, <b>giữ phím Shift</b> rồi bấm ô vuông ở dòng khác là chọn hết cả dải. Tải lại file <b>trùng tên</b> thì đè lên bản cũ chứ không tạo bản thứ hai.</>}
          </div>
          {/* Công tắc tự làm mới — để người dùng tắt được khi thấy phiền */}
          <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500">
            <input type="checkbox" checked={tuLamMoi} onChange={(e) => setTuLamMoi(e.target.checked)} />
            Tự xem file mới <b>30 giây một lần</b> trong giờ làm việc (8h–17h)
            {tuLamMoi && !trongGioLamViec() && <span className="text-slate-400">— ngoài giờ, đang tạm nghỉ</span>}
          </label>
        </section>
      </div>

      {/* Cửa sổ xem file — chỉ mở được với tài khoản đã được cấp quyền */}
      {xem && dayDu && <CuaSoXem file={xem} onClose={() => setXem(null)} onTai={() => taiMot(xem)} />}

      {/* Hộp thoại báo trong khoảng vừa chọn còn số thứ tự chưa có file */}
      {hoiThieu && (
        <HopThoaiThieu
          dl={hoiThieu}
          dangLoc={!!q.trim()}
          onDong={() => setHoiThieu(null)}
          onDongY={() => { const h = hoiThieu; setHoiThieu(null); taiDai(h.dau, h.cuoi, h.ds); }}
        />
      )}
    </Khung>
  );
}

// ══════════════════════════════════════════════════════════════════════
// HỘP THOẠI "TRONG KHOẢNG NÀY CÒN THIẾU FILE"
// Hiện khi bấm "Tải khoảng này" mà có số thứ tự chưa có file nào.
// Liệt kê rõ thiếu những số nào (số liền nhau gom lại cho gọn: 530, 533–535).
//   · Đồng ý → tải luôn phần đang có, theo đúng thứ tự số
//   · Đóng   → dừng lại, để làm nốt cho đủ rồi quay ra bấm tải lại
// ══════════════════════════════════════════════════════════════════════
// Gom dãy số liền nhau thành đoạn cho dễ đọc: [530,533,534,535] → "530, 533–535"
function gomSo(ds: number[]): string {
  const doan: string[] = [];
  for (let i = 0; i < ds.length;) {
    let j = i;
    while (j + 1 < ds.length && ds[j + 1] === ds[j] + 1) j++;
    doan.push(j > i + 1 ? `${ds[i]}–${ds[j]}` : j === i + 1 ? `${ds[i]}, ${ds[j]}` : `${ds[i]}`);
    i = j + 1;
  }
  return doan.join(', ');
}

function HopThoaiThieu({ dl, dangLoc, onDong, onDongY }:
  { dl: { dau: number; cuoi: number; ds: FileKho[]; thieu: number[] }; dangLoc: boolean; onDong: () => void; onDongY: () => void }) {
  const tong = dl.cuoi - dl.dau + 1;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3" onClick={onDong}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 text-white" style={{ background: NAVY }}>
          <div className="text-[15px] font-bold">⚠️ Khoảng {dl.dau} – {dl.cuoi} còn thiếu file</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[13.5px] leading-relaxed text-slate-700">
            Trong {tong} số thứ tự bạn chọn, kho mới có <b style={{ color: NAVY }}>{dl.ds.length} file</b>.
            <b> Chưa có file</b> ở {dl.thieu.length} số thứ tự sau:
          </div>
          <div className="mt-2 max-h-40 overflow-auto rounded-lg px-3 py-2 text-[13.5px] font-semibold leading-relaxed"
            style={{ background: '#fff5f5', color: '#9b1c1c' }}>
            {gomSo(dl.thieu)}
          </div>
          {dangLoc && (
            <div className="mt-2 rounded-lg px-3 py-2 text-[12.5px] leading-snug" style={{ background: '#fff7e6', color: '#7a5b13' }}>
              Lưu ý: ô <b>tìm kiếm</b> đang có chữ nên máy chỉ dò trong phần đang lọc. Muốn dò cả thư mục thì xoá ô tìm kiếm rồi thử lại.
            </div>
          )}
          <div className="mt-2 text-[12.5px] leading-snug text-slate-500">
            Bấm <b>Đồng ý</b> để tải {dl.ds.length} file đang có (theo đúng thứ tự số).
            Hoặc bấm <b>Đóng</b>, làm nốt mấy hồ sơ còn thiếu, xong quay ra bấm tải lại là đủ bộ.
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3" style={{ borderColor: '#eef1f5' }}>
          <button onClick={onDong} className="rounded-lg border px-3.5 py-1.5 text-sm font-semibold text-slate-600"
            style={{ borderColor: '#d8dee7', background: '#fff' }}>Đóng</button>
          <button onClick={onDongY} disabled={!dl.ds.length}
            className="rounded-lg px-3.5 py-1.5 text-sm font-bold text-white disabled:opacity-40" style={{ background: NAVY }}>
            ✔ Đồng ý — tải {dl.ds.length} file đang có
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// CỬA SỔ XEM FILE — mở nội dung ngay trên web, khỏi phải tải về mới coi được.
//   · Excel (.xlsx/.xls/.csv) → dựng thành bảng, nhiều sheet thì có nút chọn sheet
//   · PDF                     → xem thẳng trong khung
//   · Ảnh                     → hiện ảnh
//   · Loại khác (Word, ZIP…)  → không xem trực tiếp được, mời tải về
// File tải về bộ nhớ trình duyệt (phải kèm thẻ đăng nhập nên không dùng thẻ <a> thường được),
// xem xong đóng cửa sổ là dọn sạch.
// ══════════════════════════════════════════════════════════════════════
function CuaSoXem({ file, onClose, onTai }: { file: FileKho; onClose: () => void; onTai: () => void }) {
  const [dangDoc, setDangDoc] = useState(true);
  const [loi, setLoi] = useState('');
  const [url, setUrl] = useState('');                       // dùng cho PDF / ảnh
  const [sheets, setSheets] = useState<{ ten: string; hang: any[][] }[]>([]);
  const [sheet, setSheet] = useState(0);

  const laExcel = /\.(xlsx|xls|csv)$/i.test(file.ten);
  const laPdf = /\.pdf$/i.test(file.ten);
  const laAnh = /\.(jpe?g|png|webp|gif)$/i.test(file.ten);

  useEffect(() => {
    let huy = false; let urlTao = '';
    (async () => {
      setDangDoc(true); setLoi('');
      try {
        const r = await fetch(`${apiBase}/kho-ho-so/${file.id}/tai`, { headers: authHead() });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không mở được file');
        const blob = await r.blob();
        if (huy) return;
        if (laExcel) {
          // Đọc file Excel ngay trong trình duyệt — không gửi nội dung đi đâu cả.
          const XLSX: any = await import(/* webpackIgnore: true */ 'https://esm.sh/xlsx@0.18.5' as any);
          const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
          const ds = (wb.SheetNames || []).map((ten: string) => ({
            ten,
            hang: XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, defval: '', blankrows: false }) as any[][],
          }));
          if (huy) return;
          setSheets(ds); setSheet(0);
        } else if (laPdf || laAnh) {
          urlTao = URL.createObjectURL(blob);
          if (huy) { URL.revokeObjectURL(urlTao); return; }
          setUrl(urlTao);
        }
      } catch (e: any) { if (!huy) setLoi(e?.message || 'Không mở được file này'); }
      finally { if (!huy) setDangDoc(false); }
    })();
    return () => { huy = true; if (urlTao) URL.revokeObjectURL(urlTao); };
  }, [file.id, laExcel, laPdf, laAnh]);

  // Bấm phím Esc là đóng cho nhanh.
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);

  const hang = sheets[sheet]?.hang || [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5" style={{ background: 'rgba(11,64,69,.55)' }} onClick={onClose}>
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Thanh trên: tên file + nút tải về + nút đóng */}
        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: '#e9edf3' }}>
          <span className="text-lg">{iconFile(file.ten)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{file.ten}</div>
            <div className="text-[11px] text-slate-500">{coFile(file.co_bytes)} · tải lên {ngayVN(file.created_at)}</div>
          </div>
          <button onClick={onTai} className="rounded-lg px-3 py-1.5 text-[13px] font-bold" style={{ background: '#eef4ff', color: NAVY }}>⬇ Tải về máy</button>
          <button onClick={onClose} title="Đóng (phím Esc)" className="rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        {/* Nút chọn sheet khi file Excel có nhiều trang tính */}
        {sheets.length > 1 && (
          <div className="flex flex-wrap gap-1 border-b px-3 py-1.5" style={{ borderColor: '#e9edf3', background: '#f8fafc' }}>
            {sheets.map((s, i) => (
              <button key={s.ten} onClick={() => setSheet(i)} className="rounded-md px-2.5 py-1 text-[12px] font-semibold transition"
                style={i === sheet ? { background: NAVY, color: '#fff' } : { color: NAVY, background: '#fff', border: '1px solid #e2e8f0' }}>{s.ten}</button>
            ))}
          </div>
        )}

        {/* Phần thân: nội dung file */}
        <div className="min-h-0 flex-1 overflow-auto" style={{ background: laPdf || laAnh ? '#f1f5f9' : '#fff' }}>
          {dangDoc && <div className="px-4 py-16 text-center text-sm text-slate-400">Đang mở file…</div>}
          {!dangDoc && loi && (
            <div className="px-4 py-14 text-center">
              <p className="text-sm text-slate-600">{loi}</p>
              <button onClick={onTai} className="mt-3 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: NAVY }}>⬇ Tải về máy để mở</button>
            </div>
          )}
          {!dangDoc && !loi && laExcel && (
            hang.length ? (
              <table className="w-full border-collapse text-[12.5px]">
                <tbody>
                  {hang.map((r, i) => (
                    <tr key={i} style={i === 0 ? { background: '#f6f8fb' } : undefined}>
                      {/* Cột số dòng cho dễ dò, giống Excel */}
                      <td className="border px-1.5 py-1 text-center text-[10px] text-slate-400" style={{ borderColor: '#eef1f5', background: '#fafbfc' }}>{i + 1}</td>
                      {r.map((o, j) => (
                        <td key={j} className="border px-2 py-1 align-top" style={{ borderColor: '#eef1f5', fontWeight: i === 0 ? 700 : 400, color: i === 0 ? NAVY : '#334155', whiteSpace: 'pre-wrap' }}>{String(o ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="px-4 py-16 text-center text-sm text-slate-400">Trang tính này trống.</div>
          )}
          {!dangDoc && !loi && laPdf && url && <iframe src={url} title={file.ten} className="h-[75vh] w-full" style={{ border: 0 }} />}
          {!dangDoc && !loi && laAnh && url && (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="grid place-items-center p-3"><img src={url} alt={file.ten} className="max-h-[75vh] max-w-full rounded-lg" /></div>
          )}
          {!dangDoc && !loi && !laExcel && !laPdf && !laAnh && (
            <div className="px-4 py-14 text-center">
              <p className="text-sm text-slate-600">Loại file này không xem thẳng trên web được (Word, ZIP…).</p>
              <button onClick={onTai} className="mt-3 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: NAVY }}>⬇ Tải về máy để mở</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Khung mỏng — tiêu đề lớn đã nằm ở phần đầu trang Lập danh mục nên ở đây chỉ ghi một dòng mô tả.
function Khung({ children }: { children: any }) {
  return (
    <div className="mt-4">
      <p className="mb-3 text-[12.5px] text-slate-500">Kho lưu trữ file danh mục đã lập.</p>
      {children}
    </div>
  );
}
