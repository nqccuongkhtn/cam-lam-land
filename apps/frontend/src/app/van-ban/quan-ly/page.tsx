'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth, laAdmin, coVaiTro } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import { api, apiBase as API_BASE } from '@/lib/api';
import { getToken } from '@/lib/token';
import { deEnt } from '@/lib/deEnt';   // làm sạch + giải mã chữ HTML — dùng chung với trang chủ
import { CHUDE_LIST, CHUDE_META, type ChuDeNhom } from '../data';

type Doc = { id: number; soKyHieu: string; trichYeu: string; ngay: string; coQuan: string; chuDe: string; linhVuc: string; nguon: string; linkGoc: string; luotTai: number; noiBat: boolean; coFile?: boolean; canKiemTra?: string | null };
type Form = { id?: number; soKyHieu: string; trichYeu: string; ngay: string; coQuan: string; chuDe: string; linhVuc: string; linkGoc: string; noiBat: boolean };
const CHUDE = ['Quy hoạch', 'Bồi thường', 'Tái định cư', 'Nhà ở xã hội', 'Khác'];
const empty: Form = { soKyHieu: '', trichYeu: '', ngay: '', coQuan: '', chuDe: 'Quy hoạch', linhVuc: '', linkGoc: '', noiBat: false };
const PER = 15;
const CHUDE_COLOR: Record<string, string> = { 'Quy hoạch': 'bg-emerald-50 text-emerald-700', 'Bồi thường': 'bg-amber-50 text-amber-700', 'Tái định cư': 'bg-violet-50 text-violet-700', 'Nhà ở xã hội': 'bg-sky-50 text-sky-700', 'Khác': 'bg-slate-100 text-slate-600' };
const kd = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const fmtNgay = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const pageWindow = (cur: number, total: number): (number | '…')[] => {
  const out: (number | '…')[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - cur) <= 1) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
};
const DB_ORDER = ['Cam Lâm', 'Cam An', 'Cam Hiệp', 'Suối Dầu', 'Suối Hiệp', 'Cam Ranh', 'Bắc Cam Ranh', 'Nam Cam Ranh', 'Cam Linh', 'Ba Ngòi', 'Nha Trang', 'Bắc Nha Trang', 'Tây Nha Trang', 'Nam Nha Trang', 'Diên Khánh', 'Diên Lạc', 'Diên Điền', 'Diên Lâm', 'Diên Thọ', 'Tỉnh Khánh Hòa', 'Trung ương', 'Khác'];
const AREA_RULES: [RegExp, string][] = [
  [/Bắc Cam Ranh/i, 'Bắc Cam Ranh'], [/Nam Cam Ranh/i, 'Nam Cam Ranh'],
  [/Bắc Nha Trang/i, 'Bắc Nha Trang'], [/Tây Nha Trang/i, 'Tây Nha Trang'], [/Nam Nha Trang/i, 'Nam Nha Trang'],
  [/(Cam Lâm|Cam Đức|Cù Hin)/i, 'Cam Lâm'], [/Cam An/i, 'Cam An'], [/Cam Hiệp/i, 'Cam Hiệp'],
  [/Suối Dầu/i, 'Suối Dầu'], [/Suối Hiệp/i, 'Suối Hiệp'], [/Cam Linh/i, 'Cam Linh'], [/Ba Ngòi/i, 'Ba Ngòi'],
  [/Cam Ranh/i, 'Cam Ranh'], [/Nha Trang/i, 'Nha Trang'],
  [/Diên Khánh/i, 'Diên Khánh'], [/Diên Lạc/i, 'Diên Lạc'], [/Diên Điền/i, 'Diên Điền'], [/Diên Lâm/i, 'Diên Lâm'], [/Diên Thọ/i, 'Diên Thọ'],
];
function diaBanOf(d: { coQuan?: string; trichYeu?: string }): string {
  const t = `${d.coQuan || ''} ${d.trichYeu || ''}`;
  for (const [re, name] of AREA_RULES) if (re.test(t)) return name;
  if (/(Quốc hội|Chính phủ|Thủ tướng|Bộ )/i.test(d.coQuan || '')) return 'Trung ương';
  if (/tỉnh Khánh Hòa/i.test(d.coQuan || '')) return 'Tỉnh Khánh Hòa';
  return 'Khác';
}

export default function QuanLyVanBan() {
  const { user, loading } = useAuth();
  const { openLogin } = useLoginGate();
  const canManage = user && (laAdmin(user) || coVaiTro(user, 'vanban'));
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [q, setQ] = useState('');
  const [chuDe, setChuDe] = useState<ChuDeNhom | 'all'>('all');
  const [nam, setNam] = useState('all');
  const [diaBan, setDiaBan] = useState('all');
  const [sort, setSort] = useState<'moi' | 'tai'>('moi');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const reset = () => setPage(1);

  const load = () => api<{ docs: Doc[] }>('/van-ban/manage').then((r) => setDocs((r.docs || []).map((d) => ({ ...d, soKyHieu: deEnt(d.soKyHieu), trichYeu: deEnt(d.trichYeu), coQuan: deEnt(d.coQuan) })))).catch((e) => setMsg(e?.message || 'Lỗi tải'));
  useEffect(() => { if (canManage) load(); }, [canManage]);

  const YEARS = useMemo(() => Array.from(new Set((docs || []).map((d) => (d.ngay || '').slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [docs]);
  const DIA_BAN = useMemo(() => { const s = new Set((docs || []).map(diaBanOf)); return DB_ORDER.filter((x) => s.has(x)); }, [docs]);
  const filtered = useMemo(() => {
    const kw = kd(q.trim());
    return (docs || [])
      .filter((d) =>
        (chuDe === 'all' || (CHUDE_META[chuDe].match as string[]).includes(d.chuDe)) &&
        (nam === 'all' || (d.ngay || '').slice(0, 4) === nam) &&
        (diaBan === 'all' || diaBanOf(d) === diaBan) &&
        (!kw || kd(d.soKyHieu || '').includes(kw) || kd(d.trichYeu || '').includes(kw) || kd(d.coQuan || '').includes(kw) || kd(d.linhVuc || '').includes(kw)))
      .sort((a, b) => sort === 'tai' ? (b.luotTai || 0) - (a.luotTai || 0) : (b.ngay || '').localeCompare(a.ngay || ''));
  }, [docs, q, chuDe, nam, diaBan, sort]);

  async function save() {
    if (!form) return;
    if (!form.trichYeu.trim()) { setMsg('Nhập trích yếu'); return; }
    setBusy(true); setMsg('');
    try {
      const body = JSON.stringify(form);
      if (form.id) await api(`/van-ban/${form.id}`, { method: 'PUT', body });
      else await api('/van-ban', { method: 'POST', body });
      setForm(null); await load(); setMsg('Đã lưu ✓');
    } catch (e: any) { setMsg(e?.message || 'Lỗi lưu'); }
    finally { setBusy(false); }
  }
  async function del(d: Doc) {
    if (!confirm(`Xoá văn bản "${d.soKyHieu || d.trichYeu.slice(0, 40)}"?`)) return;
    try { await api(`/van-ban/${d.id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { alert(e?.message || 'Lỗi xoá'); }
  }
  async function sync() {
    setBusy(true); setMsg('Đang đồng bộ từ Công báo Khánh Hòa ở chế độ nền… (1–3 phút). Cứ để chạy, danh sách sẽ tự cập nhật.');
    try {
      await api('/van-ban/refresh', { method: 'POST' }); // trả về NGAY, crawl chạy nền (không còn 524)
      const poll = async () => {
        try {
          const s = await api<{ running: boolean; added: number; updated: number; error: string }>('/van-ban/refresh-status');
          if (s.running) { setMsg(`Đang đồng bộ nền… thêm mới ${s.added}, cập nhật ${s.updated} văn bản…`); setTimeout(poll, 4000); return; }
          await load();
          setMsg(s.error ? `Đồng bộ xong (cảnh báo: ${s.error}). Thêm mới ${s.added}, cập nhật ${s.updated}.` : `Đã đồng bộ xong: thêm mới ${s.added}, cập nhật ${s.updated} văn bản ✓`);
          setBusy(false);
        } catch { setTimeout(poll, 5000); } // lỗi mạng tạm thời → thử lại
      };
      setTimeout(poll, 3000);
    } catch (e: any) { setMsg(e?.message || 'Lỗi đồng bộ'); setBusy(false); }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-400">Đang tải…</div>;
  if (!canManage) return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <p className="font-extrabold text-[#0A2540] text-lg">Chỉ dành cho người quản lý văn bản</p>
      <p className="text-sm text-slate-500 mt-1.5">Trang này chỉ dành cho tài khoản có quyền <b>Quản lý văn bản</b> hoặc <b>Quản trị</b>.</p>
      {!user && <button onClick={() => openLogin()} className="mt-5 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg">Đăng nhập</button>}
      <div className="mt-4"><Link href="/van-ban" className="text-[#C8A14B] font-semibold">← Về trang tra cứu văn bản</Link></div>
    </div>
  );

  const F = (k: keyof Form, v: any) => setForm((f) => f ? { ...f, [k]: v } : f);
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#C8A14B]';
  const openEdit = (d: Doc) => { setForm({ id: d.id, soKyHieu: d.soKyHieu || '', trichYeu: d.trichYeu || '', ngay: d.ngay || '', coQuan: d.coQuan || '', chuDe: d.chuDe || 'Khác', linhVuc: d.linhVuc || '', linkGoc: d.linkGoc || '', noiBat: !!d.noiBat }); setMsg(''); setTimeout(() => document.getElementById('khung-sua-vb')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }; // cuộn tới đúng khung sửa (nó nằm dưới 2 khung kiểm tra, cuộn lên đầu trang là không thấy)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const cur = Math.min(page, totalPages);
  const vis = filtered.slice((cur - 1) * PER, cur * PER);
  const hasFilter = q || chuDe !== 'all' || nam !== 'all' || diaBan !== 'all';
  const th = 'px-2.5 sm:px-3 py-3 font-semibold text-left whitespace-nowrap';
  const td = 'px-2.5 sm:px-3 py-3.5 align-top';
  const COUNT = (c: ChuDeNhom) => (docs || []).filter((d) => (CHUDE_META[c].match as string[]).includes(d.chuDe)).length;

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6 py-5 sm:py-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0A2540]">Quản lý văn bản</h1>
          <p className="text-sm text-slate-500 mt-1">Thêm, sửa, xoá văn bản và link tải. <Link href="/van-ban" className="text-[#C8A14B] font-semibold">Xem trang tra cứu →</Link></p>
        </div>
        <div className="flex gap-2">
          <button onClick={sync} disabled={busy} className="border border-slate-300 text-[#0A2540] font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50">🔄 Đồng bộ Công báo</button>
          <button onClick={() => { setForm({ ...empty }); setMsg(''); }} className="bg-[#0A2540] hover:bg-[#0d3a6b] text-white font-bold px-4 py-2.5 rounded-lg text-sm">＋ Thêm văn bản</button>
        </div>
      </div>

      {docs && <VanBanCanKiemTra docs={docs} onXong={load} />}
      {docs && <VanBanThieuFile docs={docs} onDaLuu={load} />}

      {msg && <div className="mt-4 text-sm font-semibold text-[#0A2540] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{msg}</div>}

      {form && (
        <div id="khung-sua-vb" className="mt-4 scroll-mt-20 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          <p className="font-bold text-[#0A2540] mb-3">{form.id ? 'Sửa văn bản' : 'Thêm văn bản mới'}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Số ký hiệu<input className={inp} value={form.soKyHieu} onChange={(e) => F('soKyHieu', e.target.value)} placeholder="VD: 893/QĐ-UBND" /></label>
            <label className="text-sm">Ngày ban hành<input type="date" className={inp} value={form.ngay} onChange={(e) => F('ngay', e.target.value)} /></label>
            <label className="text-sm">Cơ quan ban hành<input className={inp} value={form.coQuan} onChange={(e) => F('coQuan', e.target.value)} placeholder="VD: UBND tỉnh Khánh Hòa" /></label>
            <label className="text-sm">Chủ đề
              <select className={inp} value={form.chuDe} onChange={(e) => F('chuDe', e.target.value)}>{CHUDE.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </label>
            <label className="text-sm sm:col-span-2">Trích yếu (nội dung)<textarea className={inp} rows={2} value={form.trichYeu} onChange={(e) => F('trichYeu', e.target.value)} placeholder="Tóm tắt nội dung văn bản" /></label>
            <label className="text-sm sm:col-span-2">Link tải / trang gốc (PDF hoặc trang chi tiết)<input className={inp} value={form.linkGoc} onChange={(e) => F('linkGoc', e.target.value)} placeholder="https://…/vanban.pdf" /></label>
            <label className="text-sm">Lĩnh vực<input className={inp} value={form.linhVuc} onChange={(e) => F('linhVuc', e.target.value)} placeholder="VD: Đất đai" /></label>
            <label className="text-sm flex items-center gap-2 mt-6"><input type="checkbox" checked={form.noiBat} onChange={(e) => F('noiBat', e.target.checked)} /> Văn bản nổi bật</label>
          </div>
          <div className="flex gap-2 mt-4">
            <button disabled={busy} onClick={save} className="bg-[#C8A14B] hover:bg-[#b8923f] text-[#0A2540] font-bold px-5 py-2.5 rounded-lg text-sm disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu'}</button>
            <button onClick={() => setForm(null)} className="border border-slate-300 text-slate-600 font-semibold px-4 py-2.5 rounded-lg text-sm">Huỷ</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-4 sm:mt-5">
        <button onClick={() => { setChuDe('all'); reset(); }}
          className={`text-left rounded-2xl border p-3 sm:p-4 transition ${chuDe === 'all' ? 'border-[#C8A14B] bg-[#C8A14B]/10 ring-1 ring-[#C8A14B]/30' : 'border-slate-200 bg-white hover:border-[#C8A14B] hover:shadow-sm'}`}>
          <div className="text-2xl leading-none">🗂️</div>
          <div className="font-bold text-[#0A2540] mt-2 leading-tight">Văn bản chung</div>
          <div className="text-[12px] text-slate-500 mt-1 leading-snug">Tất cả văn bản đất đai & dự án — tỉnh và cả nước</div>
          <div className="text-[11px] font-semibold text-[#C8A14B] mt-2">{(docs || []).length} văn bản →</div>
        </button>
        {CHUDE_LIST.map((c) => {
          const on = chuDe === c;
          return (
            <button key={c} onClick={() => { setChuDe(on ? 'all' : c); reset(); }}
              className={`text-left rounded-2xl border p-3 sm:p-4 transition ${on ? 'border-[#C8A14B] bg-[#C8A14B]/10 ring-1 ring-[#C8A14B]/30' : 'border-slate-200 bg-white hover:border-[#C8A14B] hover:shadow-sm'}`}>
              <div className="text-2xl leading-none">{CHUDE_META[c].icon}</div>
              <div className="font-bold text-[#0A2540] mt-2 leading-tight">{c}</div>
              <div className="text-[12px] text-slate-500 mt-1 leading-snug">{CHUDE_META[c].desc}</div>
              <div className="text-[11px] font-semibold text-[#C8A14B] mt-2">{COUNT(c)} văn bản →</div>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm mt-4">
        <div className="relative">
          <svg viewBox="0 0 24 24" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Tìm theo số ký hiệu, trích yếu, cơ quan…" className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:border-[#C8A14B] text-sm" />
        </div>
        <div className="flex flex-wrap gap-2 mt-2 items-center">
          <select value={diaBan} onChange={(e) => { setDiaBan(e.target.value); reset(); }} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#C8A14B]">
            <option value="all">Tất cả địa giới hành chính</option>
            {DIA_BAN.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={nam} onChange={(e) => { setNam(e.target.value); reset(); }} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#C8A14B]">
            <option value="all">Tất cả các năm</option>
            {YEARS.map((y) => <option key={y} value={y}>Năm {y}</option>)}
          </select>
          {hasFilter && <button onClick={() => { setQ(''); setChuDe('all'); setNam('all'); setDiaBan('all'); reset(); }} className="text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg px-3 py-2">✕ Xóa lọc</button>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 mb-3">
        <p className="text-sm text-slate-500"><b className="text-[#0A2540]">{filtered.length}</b> văn bản{chuDe !== 'all' ? ` · ${chuDe}` : ''}</p>
        <div className="flex items-center gap-1 text-[13px]">
          <span className="text-slate-400 hidden sm:inline">Sắp xếp:</span>
          <button onClick={() => { setSort('moi'); reset(); }} className={`px-2.5 py-1 rounded-lg font-semibold ${sort === 'moi' ? 'bg-slate-100 text-[#0A2540]' : 'text-slate-400 hover:text-[#0A2540]'}`}>Mới nhất</button>
          <button onClick={() => { setSort('tai'); reset(); }} className={`px-2.5 py-1 rounded-lg font-semibold ${sort === 'tai' ? 'bg-slate-100 text-[#0A2540]' : 'text-slate-400 hover:text-[#0A2540]'}`}>Tải nhiều</button>
        </div>
      </div>

      {docs === null ? (
        <div className="text-center py-14 text-slate-400 border border-slate-200 rounded-2xl">Đang tải…</div>
      ) : vis.length === 0 ? (
        <div className="text-center py-14 text-slate-400 border border-slate-200 rounded-2xl">
          <div className="text-4xl mb-2">🔍</div>
          <p className="font-semibold text-slate-500">Không có văn bản phù hợp</p>
          <p className="text-sm mt-1">Thử chủ đề/từ khóa khác, hoặc bấm “＋ Thêm văn bản”.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0A2540] text-white">
                <th className={`${th} w-10 text-center hidden sm:table-cell`}>STT</th>
                <th className={th}>Số ký hiệu</th>
                <th className={`${th} hidden sm:table-cell`}>Ngày</th>
                <th className={`${th} hidden md:table-cell`}>Chủ đề</th>
                <th className={`${th} hidden lg:table-cell`}>Cơ quan</th>
                <th className={th}>Trích yếu</th>
                <th className={`${th} text-center w-24`}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {vis.map((d, i) => (
                <tr key={d.id} className="border-t border-slate-100 even:bg-slate-50/60 hover:bg-amber-50/50 transition-colors">
                  <td className={`${td} text-center text-slate-400 hidden sm:table-cell`}>{(cur - 1) * PER + i + 1}</td>
                  <td className={td}>
                    <span className="font-mono font-semibold text-[#0A2540] whitespace-nowrap">{d.soKyHieu || '—'}</span>
                    {d.noiBat && <span className="ml-1 text-[#C8A14B]" title="Nổi bật">★</span>}
                    {d.linkGoc && <a href={d.linkGoc} target="_blank" rel="noreferrer" className="ml-1 text-[#C8A14B] text-xs align-middle" title="Mở nguồn">↗</a>}
                  </td>
                  <td className={`${td} text-slate-500 whitespace-nowrap hidden sm:table-cell`}>{fmtNgay(d.ngay)}</td>
                  <td className={`${td} hidden md:table-cell`}><span className={`text-[11px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap ${CHUDE_COLOR[d.chuDe] || CHUDE_COLOR['Khác']}`}>{d.chuDe}</span></td>
                  <td className={`${td} text-slate-500 hidden lg:table-cell`}>{d.coQuan}</td>
                  <td className={td}>
                    <span className="text-[#0A2540] leading-snug">{d.trichYeu}</span>
                    <span className="block text-[11px] text-slate-400 mt-1 md:hidden">{[fmtNgay(d.ngay), d.coQuan, d.chuDe].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className={`${td} text-center`}>
                    <div className="inline-flex flex-col gap-1">
                      <button onClick={() => openEdit(d)} className="text-[12px] font-semibold text-[#0A2540] border border-slate-200 hover:bg-slate-50 rounded-md px-2.5 py-1">Sửa</button>
                      <button onClick={() => del(d)} className="text-[12px] font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-md px-2.5 py-1">Xoá</button>
                    </div>
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
    </div>
  );
}

// ── KHUNG "VĂN BẢN CHƯA CÓ FILE" (chủ dự án 6/10/2026: liệt kê để admin tự tìm bằng tay) ──
// Máy đã tự tìm ở cổng TTĐT / Công báo / Google mà không ra → admin bấm "Tìm trên Google" (câu tìm soạn sẵn theo số + trích yếu),
// thấy file thì dán link vào ô rồi Lưu. Máy chủ thử tải ngay — phải ra đúng file PDF mới nhận, rồi tự gắn dấu bản quyền + nén.
function VanBanThieuFile({ docs, onDaLuu }: { docs: Doc[]; onDaLuu: () => void }) {
  const thieu = docs.filter((d) => d.coFile === false);
  const [mo, setMo] = useState(true);
  const [link, setLink] = useState<Record<number, string>>({});
  const [dang, setDang] = useState<number | null>(null);
  const [bao, setBao] = useState<Record<number, { ok: boolean; m: string }>>({});
  const [loc, setLoc] = useState('all');
  const nguonDs = Array.from(new Set(thieu.map((d) => d.nguon || 'Khác')));
  const ds = loc === 'all' ? thieu : thieu.filter((d) => (d.nguon || 'Khác') === loc);
  if (!thieu.length) return <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">✓ Mọi văn bản đều đã có file để người dùng xem.</div>;
  const timGoogle = (d: Doc) => {
    const so = /^Không số/.test(d.soKyHieu || '') ? '' : `"${d.soKyHieu}" `;
    const ty = (d.trichYeu || '').replace(/^(Quyết định|Thông báo|Nghị quyết|Kế hoạch|Phương án)\s*:\s*/i, '').split(/\s+/).slice(0, 12).join(' ');
    return `https://www.google.com/search?q=${encodeURIComponent(`${so}${ty} filetype:pdf`)}`;
  };
  async function luu(d: Doc) {
    const u = (link[d.id] || '').trim(); if (!u) return;
    setDang(d.id); setBao((b) => ({ ...b, [d.id]: { ok: true, m: 'Đang thử tải file…' } }));
    try {
      const r = await api<{ ok: boolean; kb: number }>(`/van-ban/${d.id}/link`, { method: 'PATCH', body: JSON.stringify({ linkGoc: u }) });
      setBao((b) => ({ ...b, [d.id]: { ok: true, m: `Đã lưu ✓ (file ${r.kb.toLocaleString('vi-VN')} KB)` } }));
      setTimeout(onDaLuu, 1200);
    } catch (e: any) { setBao((b) => ({ ...b, [d.id]: { ok: false, m: e?.message || 'Không lưu được' } })); }
    finally { setDang(null); }
  }
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
      <button type="button" onClick={() => setMo((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className="text-[15px] font-extrabold text-[#0A2540]">Văn bản chưa có file</span>
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[12px] font-bold text-white">{thieu.length}</span>
        <span className="hidden text-[12px] text-slate-500 sm:inline">— máy đã tự tìm ở cổng TTĐT, Công báo, Google nhưng chưa ra. Tìm tay rồi dán link vào.</span>
        <span className="ml-auto text-slate-400">{mo ? '▲' : '▼'}</span>
      </button>
      {mo && (
        <>
          {nguonDs.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {['all', ...nguonDs].map((n) => (
                <button key={n} type="button" onClick={() => setLoc(n)} className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${loc === n ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-[#0A2540]'}`}>
                  {n === 'all' ? `Tất cả (${thieu.length})` : `${n} (${thieu.filter((d) => (d.nguon || 'Khác') === n).length})`}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {ds.map((d) => (
              <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] text-slate-500">
                  <b className="font-mono text-[13px] text-[#0A2540]">{(d.soKyHieu || '').replace(/^Không số \(\d+\)$/, 'Không số')}</b>
                  <span>{fmtNgay(d.ngay)}</span><span>· {d.coQuan || '—'}</span><span>· nguồn: {d.nguon}</span>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-[#0A2540]">{d.trichYeu}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <a href={timGoogle(d)} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[13px] font-semibold text-[#0A2540] hover:bg-slate-50">🔎 Tìm trên Google</a>
                  {d.linkGoc && <a href={d.linkGoc} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 px-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-50" title={d.linkGoc}>Trang nguồn ↗</a>}
                  <input value={link[d.id] || ''} onChange={(e) => setLink((l) => ({ ...l, [d.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') luu(d); }}
                    placeholder="Dán link file PDF (hoặc link Google Drive) vào đây…" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-[13px] outline-none focus:border-[#C8A14B]" />
                  <button type="button" onClick={() => luu(d)} disabled={dang === d.id || !(link[d.id] || '').trim()} className="h-9 shrink-0 rounded-lg bg-[#0A2540] px-4 text-[13px] font-bold text-white hover:bg-[#13365c] disabled:opacity-40">{dang === d.id ? 'Đang thử…' : 'Lưu link'}</button>
                </div>
                {bao[d.id] && <p className={`mt-1.5 text-[12px] font-semibold ${bao[d.id].ok ? 'text-emerald-700' : 'text-red-600'}`}>{bao[d.id].m}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── KHUNG "VĂN BẢN CẦN KIỂM TRA" (chủ dự án 7/10/2026: "cái nào nghi ngờ thì để trong phần quản lý để tôi kiểm tra") ──
// Máy KHÔNG tự sửa số/ngày khi nghi sai — chỉ ghi chú lý do (cột can_kiem_tra). Admin mở file đối chiếu, sai thì bấm "Sửa"
// (sửa số/ngày xong máy tự nhớ bản gốc, không lấy về thêm lại thành bản trùng), đúng rồi thì bấm "Đã kiểm tra" cho khỏi hiện nữa.
function VanBanCanKiemTra({ docs, onXong }: { docs: Doc[]; onXong: () => void }) {
  const ds = docs.filter((d) => d.canKiemTra);
  const [mo, setMo] = useState(true);
  const [dang, setDang] = useState<number | null>(null);
  // Sửa NGAY TRONG THẺ (trước đây khung sửa nằm khuất dưới cả danh sách → bấm như không có gì xảy ra)
  const [sua, setSua] = useState<{ id: number; so: string; ngay: string; coQuan: string } | null>(null);
  const [loi, setLoi] = useState('');
  if (!ds.length) return null;
  async function luuSua(d: Doc) {
    if (!sua) return;
    setDang(d.id); setLoi('');
    try {
      await api(`/van-ban/${d.id}`, { method: 'PUT', body: JSON.stringify({ soKyHieu: sua.so.trim(), ngay: sua.ngay, coQuan: sua.coQuan.trim(), trichYeu: d.trichYeu, chuDe: d.chuDe, linhVuc: d.linhVuc, nguon: d.nguon, linkGoc: d.linkGoc, noiBat: d.noiBat }) });
      await api(`/van-ban/${d.id}/kiem-tra`, { method: 'PATCH' }); // đã sửa theo file gốc = đã kiểm tra xong
      setSua(null); onXong();
    } catch (e: any) { setLoi(e?.message || 'Lỗi lưu'); }
    finally { setDang(null); }
  }
  async function xemFile(d: Doc) {
    // File qua máy chủ cần thẻ đăng nhập → tải về rồi mở ở tab mới (mở tab trước cho khỏi bị chặn cửa sổ bật lên)
    const w = window.open('', '_blank');
    try {
      const r = await fetch(`${API_BASE}/van-ban/${d.id}/pdf`, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
      if (!(r.headers.get('content-type') || '').includes('pdf')) throw new Error();
      const u = URL.createObjectURL(await r.blob());
      if (w) w.location.href = u; else window.open(u, '_blank');
    } catch { w?.close(); alert('Văn bản này chưa có file để xem.'); }
  }
  async function daKiemTra(d: Doc) {
    setDang(d.id);
    try { await api(`/van-ban/${d.id}/kiem-tra`, { method: 'PATCH' }); onXong(); } finally { setDang(null); }
  }
  const o = 'mt-0.5 block h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-[#0A2540] outline-none focus:border-[#C8A14B]';
  const nut = 'inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 px-3 text-[13px] font-semibold text-[#0A2540] hover:bg-slate-50';
  return (
    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/50 p-3 sm:p-4">
      <button type="button" onClick={() => setMo((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className="text-[15px] font-extrabold text-[#0A2540]">Văn bản cần kiểm tra</span>
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[12px] font-bold text-white">{ds.length}</span>
        <span className="hidden text-[12px] text-slate-500 sm:inline">— máy nghi số/ngày/nguồn có chỗ sai, chưa tự sửa. Mở file đối chiếu rồi sửa hoặc bấm "Đã kiểm tra".</span>
        <span className="ml-auto text-slate-400">{mo ? '▲' : '▼'}</span>
      </button>
      {mo && (
        <div className="mt-3 space-y-2">
          {ds.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] text-slate-500">
                <b className="font-mono text-[13px] text-[#0A2540]">{(d.soKyHieu || '').replace(/^Không số \(\d+\)$/, 'Không số')}</b>
                <span>{fmtNgay(d.ngay)}</span><span>· {d.coQuan || '—'}</span><span>· nguồn: {d.nguon}</span>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-[#0A2540]">{d.trichYeu}</p>
              <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[13px] leading-snug text-amber-900">⚠️ {d.canKiemTra}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {d.coFile !== false && <button type="button" onClick={() => xemFile(d)} className={nut}>📄 Xem file</button>}
                {d.linkGoc && <a href={d.linkGoc} target="_blank" rel="noreferrer" className={nut} title={d.linkGoc}>Trang nguồn ↗</a>}
                <button type="button" onClick={() => { setLoi(''); setSua(sua?.id === d.id ? null : { id: d.id, so: d.soKyHieu || '', ngay: d.ngay || '', coQuan: d.coQuan || '' }); }} className={nut}>✏️ Sửa số / ngày</button>
                <button type="button" onClick={() => daKiemTra(d)} disabled={dang === d.id} className="h-9 shrink-0 rounded-lg bg-emerald-600 px-4 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40">{dang === d.id ? 'Đang lưu…' : '✓ Đã kiểm tra'}</button>
              </div>
              {sua?.id === d.id && (
                <div className="mt-2 rounded-lg border border-[#C8A14B]/50 bg-[#C8A14B]/5 p-2.5">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="text-[12px] text-slate-600">Số ký hiệu<input autoFocus value={sua.so} onChange={(e) => setSua({ ...sua, so: e.target.value })} className={o} placeholder="VD: 199/TB-UBND" /></label>
                    <label className="text-[12px] text-slate-600">Ngày ban hành<input type="date" value={sua.ngay} onChange={(e) => setSua({ ...sua, ngay: e.target.value })} className={o} /></label>
                    <label className="text-[12px] text-slate-600">Cơ quan ban hành<input value={sua.coQuan} onChange={(e) => setSua({ ...sua, coQuan: e.target.value })} className={o} placeholder="VD: UBND xã Cam Lâm" /></label>
                  </div>
                  {loi && <p className="mt-1.5 text-[12px] font-semibold text-red-600">{loi}</p>}
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => luuSua(d)} disabled={dang === d.id} className="h-9 rounded-lg bg-[#0A2540] px-4 text-[13px] font-bold text-white hover:bg-[#0d3a6b] disabled:opacity-40">{dang === d.id ? 'Đang lưu…' : 'Lưu'}</button>
                    <button type="button" onClick={() => setSua(null)} className={nut}>Huỷ</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
