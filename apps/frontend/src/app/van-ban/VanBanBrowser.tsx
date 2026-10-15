'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, laAdmin, coVaiTro, coGoiChung } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import { api, apiBase } from '@/lib/api';
import { getToken } from '@/lib/token';
import { deEnt } from '@/lib/deEnt';   // làm sạch + giải mã chữ HTML — dùng chung với trang chủ
import { CHUDE_LIST, CHUDE_META, type ChuDeNhom, type VanBan } from './data';
import XemVanBan, { type MoVanBan } from './XemVanBan';
import { toast } from '@/lib/toast';
import HopTraPhi from '@/components/HopTraPhi';

const PER = 10;
const kd = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
// Giải mã HTML entity (kể cả dạng số &#233; và dạng tên &aacute;) cho trích yếu/cơ quan lấy từ nguồn — hàm dùng chung ở lib/deEnt.ts.
const fmtNgay = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const pageWindow = (cur: number, total: number): (number | '…')[] => {
  const out: (number | '…')[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - cur) <= 1) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
};
// Địa giới hành chính — suy từ cơ quan ban hành + trích yếu (ưu tiên xã/phường cụ thể, rồi tỉnh/trung ương).
const DB_ORDER = ['Cam Lâm', 'Cam An', 'Cam Hiệp', 'Suối Dầu', 'Suối Hiệp', 'Cam Ranh', 'Bắc Cam Ranh', 'Nam Cam Ranh', 'Cam Linh', 'Ba Ngòi', 'Nha Trang', 'Bắc Nha Trang', 'Tây Nha Trang', 'Nam Nha Trang', 'Diên Khánh', 'Diên Lạc', 'Diên Điền', 'Diên Lâm', 'Diên Thọ', 'Tỉnh Khánh Hòa', 'Trung ương', 'Khác'];
const AREA_RULES: [RegExp, string][] = [
  [/Bắc Cam Ranh/i, 'Bắc Cam Ranh'], [/Nam Cam Ranh/i, 'Nam Cam Ranh'],
  [/Bắc Nha Trang/i, 'Bắc Nha Trang'], [/Tây Nha Trang/i, 'Tây Nha Trang'], [/Nam Nha Trang/i, 'Nam Nha Trang'],
  [/(Cam Lâm|Cam Đức|Cù Hin)/i, 'Cam Lâm'], [/Cam An/i, 'Cam An'], [/Cam Hiệp/i, 'Cam Hiệp'],
  [/Suối Dầu/i, 'Suối Dầu'], [/Suối Hiệp/i, 'Suối Hiệp'], [/Cam Linh/i, 'Cam Linh'], [/Ba Ngòi/i, 'Ba Ngòi'],
  [/Cam Ranh/i, 'Cam Ranh'], [/Nha Trang/i, 'Nha Trang'],
  [/Diên Khánh/i, 'Diên Khánh'], [/Diên Lạc/i, 'Diên Lạc'], [/Diên Điền/i, 'Diên Điền'], [/Diên Lâm/i, 'Diên Lâm'], [/Diên Thọ/i, 'Diên Thọ'],
];
function diaBanOf(d: VanBan): string {
  const t = `${d.coQuan || ''} ${d.trichYeu || ''}`;
  for (const [re, name] of AREA_RULES) if (re.test(t)) return name;
  if (/(Quốc hội|Chính phủ|Thủ tướng|Bộ )/i.test(d.coQuan || '')) return 'Trung ương';
  if (/tỉnh Khánh Hòa/i.test(d.coQuan || '')) return 'Tỉnh Khánh Hòa';
  return 'Khác';
}

function PdfIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" /></svg>;
}

// Ô CHỌN LUÔN SỔ XUỐNG (6/10/2026): ô <select> mặc định của trình duyệt tự lật LÊN TRÊN khi gần đáy màn hình,
// che mất các ô chủ đề — chủ dự án: "cho địa giới hành chính sổ xuống chứ". Ô này luôn mở xuống dưới, cuộn trong khung.
function SoXuong({ value, onChange, opts, w = '' }: { value: string; onChange: (v: string) => void; opts: [string, string][]; w?: string }) {
  const [mo, setMo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mo) return;
    const dong = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMo(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMo(false); };
    document.addEventListener('mousedown', dong); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', dong); document.removeEventListener('keydown', esc); };
  }, [mo]);
  const nhan = opts.find(([v]) => v === value)?.[1] ?? opts[0]?.[1];
  return (
    <div ref={ref} className={`relative ${w}`}>
      <button type="button" onClick={() => setMo((x) => !x)} aria-haspopup="listbox" aria-expanded={mo}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm outline-none ${mo ? 'border-[#C8A14B]' : 'border-slate-200'}`}>
        <span className="min-w-0 flex-1 truncate">{nhan}</span>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-slate-400 transition ${mo ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {mo && (
        <ul role="listbox" className="absolute left-0 top-full z-30 mt-1 max-h-72 min-w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:w-max sm:max-w-[360px]">
          {opts.map(([v, t]) => (
            <li key={v} role="option" aria-selected={v === value}>
              <button type="button" onClick={() => { onChange(v); setMo(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${v === value ? 'font-semibold text-[#0A2540]' : 'text-slate-700'}`}>
                <span className="w-3 shrink-0 text-[#C8A14B]">{v === value ? '✓' : ''}</span>{t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function VanBanBrowser() {
  const { user } = useAuth();
  // Quyền tra cứu văn bản (TÍNH NĂNG TRẢ PHÍ, 15/10/2026): admin · người quản lý văn bản · khách có GÓI CHỨC NĂNG CHUNG còn hạn.
  const coQuyenVb = coVaiTro(user as any, 'admin', 'vanban') || coGoiChung(user);
  const [hopTraPhi, setHopTraPhi] = useState(false);
  const { openLogin } = useLoginGate();
  const [docs, setDocs] = useState<VanBan[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [chuDe, setChuDe] = useState<ChuDeNhom | 'all'>('all');
  const [diaBan, setDiaBan] = useState('all');
  // Lọc theo CƠ QUAN BAN HÀNH — học camhomes.vn/van-ban (6/10/2026)
  const [coQuan, setCoQuan] = useState('all');
  // THỜI GIAN BAN HÀNH = gộp Năm + Tháng làm MỘT ô (chủ dự án 7/10/2026): 'all' | 'YYYY' (cả năm) | 'YYYY-MM' (một tháng)
  const [thoiGian, setThoiGian] = useState('all');
  const [sort, setSort] = useState<'moi' | 'tai'>('moi');
  const [page, setPage] = useState(1);
  const [taiId] = useState<number | null>(null);
  const [dangXem, setDangXem] = useState<MoVanBan | null>(null);   // văn bản đang mở trong khung xem
  const reset = () => setPage(1);

  // Nhận từ khoá / chủ đề từ đường dẫn (?q=…&chude=…) — ô tìm văn bản ở trang chủ gửi sang đây (7/10/2026).
  // Kèm CUỘN THẲNG xuống ô tìm + kết quả: trước đó trang mở ở đầu, 8 thẻ chủ đề che kín màn hình điện thoại
  // nên khách tưởng "tìm ngoài trang chủ chưa được" (chủ dự án 7/10/2026).
  const oTimRef = useRef<HTMLDivElement>(null);
  const [canCuon, setCanCuon] = useState(false);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const q0 = sp.get('q'); if (q0) setQ(q0);
      const c0 = sp.get('chude') as ChuDeNhom | null; if (c0 && c0 in CHUDE_META) setChuDe(c0);
      if (q0 || c0) setCanCuon(true);
    } catch {}
  }, []);
  useEffect(() => {
    if (!canCuon || !docs) return;   // chờ có danh sách rồi mới cuộn, không thì trang còn ngắn, cuộn hụt
    setCanCuon(false);
    requestAnimationFrame(() => oTimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [canCuon, docs]);

  // Tải lại danh sách mỗi khi ĐỔI TÀI KHOẢN / đổi quyền (15/10/2026): trước chỉ tải một lần lúc mở trang → đăng xuất admin, vào tài khoản
  // thường mà trang (nhất là trong khung Tiện ích) chưa tải lại thì vẫn giữ danh sách KHÔNG CHE của admin.
  const khoaNguoiXem = `${user?.id ?? 0}|${coQuyenVb ? 1 : 0}|${laAdmin(user as any) ? 1 : 0}`;
  useEffect(() => {
    setErr('');
    let con = true;
    api<{ docs: VanBan[] }>('/van-ban').then((r) => { if (con) setDocs((r.docs || []).map((d) => ({ ...d, soKyHieu: deEnt(d.soKyHieu), trichYeu: deEnt(d.trichYeu), coQuan: deEnt(d.coQuan) }))); }).catch((e) => { if (con) setErr(e?.message || 'Lỗi tải văn bản'); });
    return () => { con = false; };
  }, [khoaNguoiXem]);

  // Danh sách chọn thời gian: mỗi năm có 1 dòng "Năm 2026" rồi tới các tháng CÓ văn bản của năm đó (mới nhất trước)
  const THOI_GIAN = useMemo(() => {
    const thang = Array.from(new Set((docs || []).map((d) => (d.ngay || '').slice(0, 7)).filter((x) => /^\d{4}-\d{2}$/.test(x)))).sort((a, b) => b.localeCompare(a));
    const ra: [string, string][] = [];
    for (const t of thang) {
      const [y, m] = t.split('-');
      if (!ra.some(([v]) => v === y)) ra.push([y, `Năm ${y}`]);
      ra.push([t, `Tháng ${Number(m)}/${y}`]);
    }
    return ra;
  }, [docs]);
  const CO_QUAN = useMemo(() => { const m = new Map<string, number>(); (docs || []).forEach((d) => { const c = (d.coQuan || '').trim(); if (c) m.set(c, (m.get(c) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [docs]);
  const DIA_BAN = useMemo(() => { const s = new Set((docs || []).map(diaBanOf)); return DB_ORDER.filter((x) => s.has(x)); }, [docs]);
  const filtered = useMemo(() => {
    const kw = kd(q.trim());
    return (docs || [])
      .filter((d) =>
        (chuDe === 'all' || CHUDE_META[chuDe].match.includes(d.chuDe)) &&
        (thoiGian === 'all' || (d.ngay || '').startsWith(thoiGian)) &&
        (diaBan === 'all' || diaBanOf(d) === diaBan) &&
        (coQuan === 'all' || (d.coQuan || '').trim() === coQuan) &&
        (!kw || kd(d.soKyHieu || '').includes(kw) || kd(d.trichYeu || '').includes(kw) || kd(d.coQuan || '').includes(kw) || kd(d.linhVuc || '').includes(kw)))
      .sort((a, b) => sort === 'tai' ? (b.luotTai || 0) - (a.luotTai || 0) : (b.ngay || '').localeCompare(a.ngay || ''));
  }, [docs, q, chuDe, thoiGian, diaBan, coQuan, sort]);

  // Mở KHUNG XEM ngay trong trang (không mở tab mới nữa — chủ dự án 6/10/2026)
  function taiPdf(d: VanBan) {
    if (!user) { openLogin(); return; }          // chưa đăng nhập → mở popup đăng nhập
    if (!coQuyenVb) { setHopTraPhi(true); return; }   // TÍNH NĂNG TRẢ PHÍ (15/10/2026) — máy chủ cũng chặn tệp (403)
    if (!d.coFile) return;
    setDangXem({ id: d.id, ten: `${(d.soKyHieu || '').replace(/^Không số \(\d+\)$/, 'Không số')} · ${d.trichYeu}`,
      tenFile: `${String(d.soKyHieu || 'van-ban').replace(/[^\w.-]/g, '_')}.pdf`, url: `${apiBase}/van-ban/${d.id}/pdf?v=13` /* v=13 PHẢI khớp PHIEN_BAN_FILE bên máy chủ (routes/vanBan.ts) mới được giữ 30 ngày */, token: getToken() || '' });
    // admin thấy số thật (+1); người khác thấy số hiển thị — máy chủ cộng ngẫu nhiên 2–5 mỗi lượt mở (routes/vanBan.ts LUOT_HIEN)
    setDocs((ds) => (ds || []).map((x) => x.id === d.id ? { ...x, luotTai: (x.luotTai || 0) + (laAdmin(user as any) ? 1 : 2 + Math.floor(Math.random() * 4)) } : x));
    doiDiaChi(d.id);
  }
  // ĐƯỜNG DẪN MỞ THẲNG MỘT VĂN BẢN: /van-ban?vb=<mã> (15/10/2026 — nút "Chia sẻ" trong khung xem gửi đường dẫn này). Mở / đóng văn bản thì
  // địa chỉ trang đổi theo (chép địa chỉ trình duyệt cũng gửi được đúng văn bản đó). replaceState: không thêm bước "quay lại".
  const doiDiaChi = (id: number | null) => {
    try {
      const u = new URL(window.location.href);
      if (id) u.searchParams.set('vb', String(id)); else u.searchParams.delete('vb');
      window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
    } catch { /* bỏ qua */ }
  };
  const dongXem = useCallback(() => { setDangXem(null); doiDiaChi(null); }, []);
  // Có ?vb=<mã>: chờ danh sách văn bản về rồi tự mở. Chưa đăng nhập → hộp đăng nhập (một lần), đăng nhập xong tự mở tiếp.
  const [vbCho, setVbCho] = useState<number | null>(null);
  const daHoiDangNhap = useRef(false);
  useEffect(() => {
    try { const v = Number(new URLSearchParams(window.location.search).get('vb')); if (Number.isInteger(v) && v > 0) setVbCho(v); } catch { /* */ }
  }, []);
  useEffect(() => {
    if (!vbCho || !docs) return;
    const d = docs.find((x) => x.id === vbCho);
    if (!d || !d.coFile) { setVbCho(null); toast.error('Văn bản trong đường dẫn không còn trên trang hoặc chưa có file.', 'Chưa mở được văn bản'); doiDiaChi(null); return; }
    if (!user) { if (!daHoiDangNhap.current) { daHoiDangNhap.current = true; openLogin(); } return; }
    if (!coQuyenVb) { setVbCho(null); setHopTraPhi(true); return; }   // đường dẫn chia sẻ mà chưa có quyền → hộp "tính năng trả phí"
    setVbCho(null); taiPdf(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vbCho, docs, user]);
  // Hộp báo của web (tiếng Việt, kiểu thông báo iPhone) thay cho hộp alert trơn của trình duyệt.
  const loiXem = useCallback((m: string) => { toast.error(m, 'Chưa mở được văn bản'); }, []);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const cur = Math.min(page, totalPages);
  const vis = filtered.slice((cur - 1) * PER, cur * PER);
  const hasFilter = q || chuDe !== 'all' || thoiGian !== 'all' || diaBan !== 'all' || coQuan !== 'all';
  const th = 'px-2.5 sm:px-3 py-3 font-semibold text-left whitespace-nowrap';
  const td = 'px-2.5 sm:px-3 py-3.5 align-top';
  const COUNT = (c: ChuDeNhom) => (docs || []).filter((d) => CHUDE_META[c].match.includes(d.chuDe)).length;

  return (
    <div>
      {/* MẪU 34 (chủ dự án chọn 7/10/2026, trang 100 mẫu phần đầu): chủ đề = THANH THẺ CHUYỂN gạch chân đỏ có số
          (điện thoại lướt ngang); ô tìm = THANH TÌM TO viền xanh đậm + nút "Tìm" đỏ, bộ lọc gọn bên dưới. */}
      {/* Điện thoại (kiểu Đ1): thanh lướt ngang, MÉP PHẢI MỜ DẦN để khách biết còn chủ đề phía sau */}
      <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 -right-3 z-10 w-10 bg-gradient-to-l from-[#f8fafc] to-transparent sm:hidden" />
      <div className="-mx-3 flex gap-5 overflow-x-auto border-b border-slate-200 px-3 pr-10 [scrollbar-width:none] sm:mx-0 sm:px-0 sm:pr-0 [&::-webkit-scrollbar]:hidden">
        {([['all', 'Văn bản chung', (docs || []).length], ...CHUDE_LIST.map((c) => [c, c, COUNT(c)])] as [ChuDeNhom | 'all', string, number][]).map(([ma, ten, n]) => {
          const on = chuDe === ma;
          return (
            <button key={ma} type="button" onClick={() => { setChuDe(ma); reset(); }}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2.5 text-[14px] font-bold transition ${on ? 'border-red-600 text-[#0A2540]' : 'border-transparent text-slate-500 hover:text-[#0A2540]'}`}>
              {ten} <span className={`font-semibold ${on ? 'text-red-600' : 'text-slate-400'}`}>{n.toLocaleString('vi-VN')}</span>
            </button>
          );
        })}
      </div>
      </div>

      <div ref={oTimRef} className="mt-4 scroll-mt-20">
        <form onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }}
          className="flex overflow-hidden rounded-lg border-2 border-[#0A2540] bg-white">
          <span className="grid w-11 shrink-0 place-items-center text-slate-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </span>
          <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Số hiệu, trích yếu, cơ quan…" enterKeyHint="search"
            className="h-12 min-w-0 flex-1 bg-transparent pr-2 text-[14px] text-slate-800 outline-none placeholder:text-slate-400" />
          {/* Danh sách tự lọc ngay khi gõ — nút "Tìm" để quen tay khách (và cụp bàn phím trên điện thoại) */}
          <button type="submit" className="shrink-0 bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700">Tìm</button>
        </form>
        {/* KIỂU Đ1 (điện thoại, chủ dự án chốt 7/10/2026): 3 ô lọc — "Địa giới hành chính" một hàng riêng,
            "Thời gian ban hành" (gộp năm + tháng) và "Cơ quan ban hành" chung một hàng. Máy tính xếp 3 ô trên một hàng. */}
        <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <SoXuong value={diaBan} onChange={(v) => { setDiaBan(v); reset(); }} w="col-span-2 w-full sm:w-auto sm:min-w-[220px]" opts={[['all', 'Địa giới hành chính'], ...DIA_BAN.map((x): [string, string] => [x, x])]} />
          <SoXuong value={thoiGian} onChange={(v) => { setThoiGian(v); reset(); }} w="w-full sm:w-auto sm:min-w-[190px]" opts={[['all', 'Thời gian ban hành'], ...THOI_GIAN]} />
          <SoXuong value={coQuan} onChange={(v) => { setCoQuan(v); reset(); }} w="w-full sm:w-[260px]" opts={[['all', 'Cơ quan ban hành'], ...CO_QUAN.map(([c, n]): [string, string] => [c, `${c} (${n})`])]} />
          {hasFilter && <button onClick={() => { setQ(''); setChuDe('all'); setThoiGian('all'); setDiaBan('all'); setCoQuan('all'); reset(); }} className="col-span-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 sm:col-span-1">✕ Xóa lọc</button>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 mb-3">
        <p className="text-sm text-slate-500"><b className="text-[#0A2540]">{filtered.length}</b> văn bản{chuDe !== 'all' ? ` · ${chuDe}` : ''}</p>
        <div className="flex items-center gap-1 text-[13px]">
          <span className="text-slate-400 hidden sm:inline">Sắp xếp:</span>
          <button onClick={() => { setSort('moi'); reset(); }} className={`px-2.5 py-1 rounded-lg font-semibold ${sort === 'moi' ? 'bg-slate-100 text-[#0A2540]' : 'text-slate-400 hover:text-[#0A2540]'}`}>Mới nhất</button>
          <button onClick={() => { setSort('tai'); reset(); }} className={`px-2.5 py-1 rounded-lg font-semibold ${sort === 'tai' ? 'bg-slate-100 text-[#0A2540]' : 'text-slate-400 hover:text-[#0A2540]'}`}>{laAdmin(user as any) ? 'Tải nhiều' : 'Xem nhiều'}</button>
        </div>
      </div>

      {docs === null ? (
        <div className="text-center py-14 text-slate-400 border border-slate-200 rounded-2xl">Đang tải văn bản…</div>
      ) : err ? (
        <div className="text-center py-10 text-red-500 border border-red-200 bg-red-50 rounded-2xl">{err}</div>
      ) : vis.length === 0 ? (
        <div className="text-center py-14 text-slate-400 border border-slate-200 rounded-2xl">
          <div className="text-4xl mb-2">🔍</div>
          <p className="font-semibold text-slate-500">Chưa có văn bản trong mục này</p>
          <p className="text-sm mt-1">Thử chủ đề/từ khóa khác, hoặc xem trực tiếp tại các cổng bên dưới.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0A2540] text-white">
                <th className={`${th} w-10 text-center hidden sm:table-cell`}>STT</th>
                <th className={th}>Số ký hiệu</th>
                <th className={`${th} text-center hidden md:table-cell`}>Lượt tải</th>
                <th className={`${th} hidden sm:table-cell`}>Ngày</th>
                <th className={`${th} hidden lg:table-cell`}>Cơ quan</th>
                <th className={th}>Trích yếu</th>
                <th className={`${th} text-center w-16`}>{laAdmin(user as any) ? 'Tải' : 'Xem'}</th>
              </tr>
            </thead>
            <tbody>
              {vis.map((d, i) => (
                <tr key={d.id} className="border-t border-slate-100 even:bg-slate-50/60 hover:bg-amber-50/50 transition-colors">
                  <td className={`${td} text-center text-slate-400 hidden sm:table-cell`}>{(cur - 1) * PER + i + 1}</td>
                  <td className={td}><span className={`font-mono font-semibold text-[#0A2540] whitespace-nowrap ${d.an ? 'blur-[3px] select-none' : ''}`} title={/^Không số/.test(d.soKyHieu || '') ? 'Văn bản không ghi số ký hiệu (danh sách, thông báo niêm yết…)' : undefined}>{(d.soKyHieu || '').replace(/^Không số \(\d+\)$/, 'Không số')}</span></td>
                  <td className={`${td} text-center text-slate-500 hidden md:table-cell whitespace-nowrap`}>{d.luotTai != null ? d.luotTai.toLocaleString('vi-VN') : '—'}</td>
                  <td className={`${td} text-slate-500 whitespace-nowrap hidden sm:table-cell`}>{d.an ? <span className="blur-[3px] select-none">••/••/••••</span> : fmtNgay(d.ngay)}</td>
                  <td className={`${td} text-slate-500 hidden lg:table-cell`}>{d.coQuan}</td>
                  <td className={td}>
                    {d.coFile
                      ? <button onClick={() => taiPdf(d)} className="text-left text-[#0A2540] hover:text-[#C8A14B] font-medium leading-snug">{d.trichYeu}</button>
                      : <span className="text-[#0A2540] leading-snug">{d.trichYeu}</span>}
                    <span className="block text-[11px] text-slate-400 mt-1 sm:hidden">{d.an ? <span className="blur-[3px] select-none">••/••/••••</span> : fmtNgay(d.ngay)} · {d.coQuan}{d.luotTai != null ? ` · ${d.luotTai.toLocaleString('vi-VN')} ${laAdmin(user as any) ? 'lượt tải' : 'lượt xem'}` : ''}</span>
                  </td>
                  <td className={`${td} text-center`}>
                    {d.coFile
                      ? <button onClick={() => taiPdf(d)} disabled={taiId === d.id} title={laAdmin(user as any) ? 'Xem / Tải văn bản' : 'Xem văn bản'} className="inline-grid place-items-center w-9 h-9 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50">{taiId === d.id ? <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" /> : <PdfIcon />}</button>
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1.5 mt-6 flex-wrap" aria-label="Phân trang">
          <button onClick={() => setPage(cur - 1)} disabled={cur === 1} className="min-w-9 h-9 px-2 grid place-items-center rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:border-[#C8A14B] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200">‹</button>
          {pageWindow(cur, totalPages).map((p, i) => p === '…'
            ? <span key={'e' + i} className="px-1 text-slate-400">…</span>
            : <button key={p} onClick={() => setPage(p as number)} className={`min-w-9 h-9 px-2 grid place-items-center rounded-lg text-sm font-semibold border ${p === cur ? 'bg-[#0A2540] text-white border-[#0A2540]' : 'border-slate-200 text-slate-600 hover:border-[#C8A14B]'}`}>{p}</button>)}
          <button onClick={() => setPage(cur + 1)} disabled={cur === totalPages} className="min-w-9 h-9 px-2 grid place-items-center rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:border-[#C8A14B] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200">›</button>
        </nav>
      )}
      {dangXem && <XemVanBan vb={dangXem} onDong={dongXem} onLoi={loiXem} />}
      {hopTraPhi && <HopTraPhi ten="Tra cứu văn bản" onDong={() => setHopTraPhi(false)} />}
    </div>
  );
}
