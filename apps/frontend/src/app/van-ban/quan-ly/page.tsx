'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import { api } from '@/lib/api';
import { CHUDE_LIST, CHUDE_META, type ChuDeNhom } from '../data';

type Doc = { id: number; soKyHieu: string; trichYeu: string; ngay: string; coQuan: string; chuDe: string; linhVuc: string; nguon: string; linkGoc: string; luotTai: number; noiBat: boolean };
type Form = { id?: number; soKyHieu: string; trichYeu: string; ngay: string; coQuan: string; chuDe: string; linhVuc: string; linkGoc: string; noiBat: boolean };
const CHUDE = ['Quy hoạch', 'Bồi thường', 'Tái định cư', 'Nhà ở xã hội', 'Khác'];
const empty: Form = { soKyHieu: '', trichYeu: '', ngay: '', coQuan: '', chuDe: 'Quy hoạch', linhVuc: '', linkGoc: '', noiBat: false };
const PER = 15;
const CHUDE_COLOR: Record<string, string> = { 'Quy hoạch': 'bg-emerald-50 text-emerald-700', 'Bồi thường': 'bg-amber-50 text-amber-700', 'Tái định cư': 'bg-violet-50 text-violet-700', 'Nhà ở xã hội': 'bg-sky-50 text-sky-700', 'Khác': 'bg-slate-100 text-slate-600' };
const kd = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const deEnt = (s: string) => (s || '')
  .replace(/data:[^\s"'<>]+/gi, ' ')                 // xoá chuỗi data:image;base64,... (mã QR nhúng)
  .replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ')    // lột thẻ HTML + ký tự lẻ
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
  .replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();
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
  const canManage = user && (user.role === 'admin' || user.role === 'vanban');
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
  const openEdit = (d: Doc) => { setForm({ id: d.id, soKyHieu: d.soKyHieu || '', trichYeu: d.trichYeu || '', ngay: d.ngay || '', coQuan: d.coQuan || '', chuDe: d.chuDe || 'Khác', linhVuc: d.linhVuc || '', linkGoc: d.linkGoc || '', noiBat: !!d.noiBat }); setMsg(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
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

      {msg && <div className="mt-4 text-sm font-semibold text-[#0A2540] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{msg}</div>}

      {form && (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
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
