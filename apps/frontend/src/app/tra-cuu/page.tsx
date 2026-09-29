'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
// TRA CỨU "DANH SÁCH NÓNG" (dùng tạm). Gỡ: xoá thư mục app/tra-cuu + public/danh-sach-nong.json + routes/hotlist.ts + dòng đăng ký + DROP TABLE hot_records.
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, laAdmin, coVaiTro } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import { type Added, norm, digits, SHORT, sevOf, chipCls, chipSoft } from './parts';
import { EditModal } from './EditModal';
import { GuideModal } from './GuideModal';
import { ResultTable } from './ResultTable';
import { ConfirmModal, Toast } from './ConfirmModal';

type Rec = { gi: number; ri: number; src: string; thk: string[]; tok: string[]; xa: string; blob: string; blobNS: string };
const STEP = 60;

export default function TraCuuPage() {
  const { user, loading: authLoading } = useAuth();
  const { openLogin } = useLoginGate();
  const canManage = !!user && (laAdmin(user) || coVaiTro(user, 'hotlist')); // admin/hotlist: xem + sửa + đánh dấu hết hiệu lực
  const isAdmin = !!user && laAdmin(user); // CHỈ admin: xoá vĩnh viễn
  const [data, setData] = useState<any>(null); const [recs, setRecs] = useState<Rec[]>([]); const [added, setAdded] = useState<Added[]>([]); const [sheets, setSheets] = useState<{ name: string; createdBy?: string; createdAt?: string }[]>([]);
  const [err, setErr] = useState<string | null>(null); const [loading, setLoading] = useState('Đang tải dữ liệu…');
  const [q, setQ] = useState(''); const [qth, setQth] = useState(''); const [qto, setQto] = useState(''); const [qxa, setQxa] = useState(''); const [qsrc, setQsrc] = useState('');
  const [qten, setQten] = useState(''); const [qskh, setQskh] = useState(''); const [qcq, setQcq] = useState(''); const [qgt, setQgt] = useState(''); const [qns, setQns] = useState(''); const [qdc, setQdc] = useState(''); const [qgcn, setQgcn] = useState('');
  const [dq, setDq] = useState(''); const [limit, setLimit] = useState(STEP);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Added> | null>(null); const [guide, setGuide] = useState(false);
  const [delId, setDelId] = useState<number | null>(null); const [delBusy, setDelBusy] = useState(false); const [toast, setToast] = useState('');
  const [delSheet, setDelSheet] = useState<string | null>(null); const [delSheetBusy, setDelSheetBusy] = useState(false);
  const [mobile, setMobile] = useState(false); const [embedded, setEmbedded] = useState(false); const [advOpen, setAdvOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 220); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setLimit(STEP); }, [dq, qth, qto, qxa, qsrc, qten, qskh, qcq, qgt, qns, qdc, qgcn]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { const f = () => setMobile(window.innerWidth < 640); f(); window.addEventListener('resize', f); setEmbedded(new URLSearchParams(window.location.search).get('embed') === '1' || document.documentElement.classList.contains('embed')); return () => window.removeEventListener('resize', f); }, []);

  // ⛔ 29/9/2026: CHỈ tải dữ liệu khi đã biết là tài khoản CÓ QUYỀN (admin / hotlist). Trước đây tải file gốc
  //    công khai /danh-sach-nong.json cho MỌI người rồi mới che bằng màn khoá 🔒. Nay file gốc nằm sau
  //    GET /api/hotlist/goc (máy chủ kiểm quyền, gửi kèm thẻ đăng nhập).
  useEffect(() => { if (authLoading || !canManage) return; (async () => {
    try {
      const j = await api<any>('/hotlist/goc');
      setData(j); setLoading('Đang dựng chỉ mục…'); await new Promise((r) => setTimeout(r, 10));
      const out: Rec[] = [];
      j.g.forEach((grp: any, gi: number) => { const mg = j.meta.groups[gi]; for (let ri = 0; ri < grp.r.length; ri++) { const row = grp.r[ri]; const nb = norm(row.join(' ')).replace(/\s+/g, ' '); out.push({ gi, ri, src: mg.s, thk: mg.th >= 0 ? digits(row[mg.th]) : [], tok: mg.to >= 0 ? digits(row[mg.to]) : [], xa: mg.xa >= 0 ? String(row[mg.xa] || '') : '', blob: nb, blobNS: nb.replace(/\s+/g, '') }); } });
      setRecs(out);
      try { const r = await api<{ records: Added[]; sheets: any[] }>('/hotlist'); setAdded(r.records || []); setSheets(r.sheets || []); } catch { /* */ }
      setLoading('');
    } catch (e: any) { setErr(e?.message || 'Lỗi tải'); setLoading(''); }
  })(); }, [authLoading, canManage]);

  const xaList = useMemo(() => { const tc = (v: string) => v.split(' ').map((w) => (w ? w.charAt(0).toLocaleUpperCase('vi') + w.slice(1).toLocaleLowerCase('vi') : w)).join(' '); const m = new Map<string, string>(); const add = (raw: any) => { const v = String(raw ?? '').split('\n')[0].trim().replace(/\s+/g, ' '); if (v) { const k = v.toLowerCase(); if (!m.has(k)) m.set(k, tc(v)); } }; recs.forEach((r) => add(r.xa)); added.forEach((a) => add(a.xa)); return [...m.values()].sort((a, b) => a.localeCompare(b, 'vi')); }, [recs, added]);
  const groups = data ? data.meta.groups : []; const counts = data ? data.meta.counts : {};
  const advActive = !!(qth || qto || qxa || qten || qskh || qcq || qgt || qns || qdc || qgcn); // có bộ lọc nâng cao nào đang bật
  const hasFilter = !!(dq || qsrc || advActive);
  // Sheet (nguồn) tuỳ biến = sheet đã đăng ký ở backend (kể cả RỖNG) ∪ nguồn có trong bản ghi mà chưa đăng ký (tương thích ngược); kèm số bản ghi (0 = rỗng).
  const customSheets = useMemo(() => {
    const base = new Set(groups.map((g: any) => g.s));
    const cnt: Record<string, number> = {}; added.forEach((a) => { if (a.nguon) cnt[a.nguon] = (cnt[a.nguon] || 0) + 1; });
    const names = new Set<string>();
    sheets.forEach((s: any) => { if (s?.name && !base.has(s.name)) names.add(s.name); });
    added.forEach((a) => { if (a.nguon && !base.has(a.nguon)) names.add(a.nguon); });
    return [...names].map((s) => [s, cnt[s] || 0] as [string, number]);
  }, [sheets, added, groups]);

  const rowOfBase = (r: Rec): any => {
    const cols = data.g[r.gi].c as string[]; const vals = data.g[r.gi].r[r.ri] as string[]; const mg = data.meta.groups[r.gi];
    const keySet = new Set<number>([mg.ten, mg.th, mg.to, mg.xa]); cols.forEach((c, i) => { if (norm(c) === 'stt') keySet.add(i); });
    const pairs = cols.map((c, i) => [c, vals[i]]).filter(([, v]) => v);
    const detail = cols.map((c, i) => (!keySet.has(i) && vals[i] ? `${c}: ${vals[i]}` : '')).filter(Boolean).join('   ·   ');
    const sv = sevOf(r.src);
    return { key: r.gi + '_' + r.ri, sev: sv.c, badge: sv.label, srcShort: SHORT[r.src] || r.src, ten: mg.ten >= 0 ? vals[mg.ten] || '' : '', thua: mg.th >= 0 ? vals[mg.th] || '' : '', to: mg.to >= 0 ? vals[mg.to] || '' : '', xa: mg.xa >= 0 ? vals[mg.xa] || '' : '', detail, pairs };
  };
  const rowOfAdded = (a: Added): any => { const sv = sevOf(a.nguon, a.mucDo); const pairs = ([['Đơn vị gửi', a.donViGui], ['Số, ký hiệu', a.soKyHieu], ['Ngày văn bản', a.ngayVb], ['Số đến', a.soDen], ['Ngày đến', a.ngayDen], ['Loại VB ngăn chặn', a.loaiVb], ['Số văn bản gốc', a.soVbGoc], ['Số giấy tờ', a.soGiayTo], ['Năm sinh', a.namSinh], ['Địa chỉ', a.diaChi], ['Số phát hành', a.soPhatHanh], ['Số vào sổ', a.soVaoSo], ['Ngày cấp', a.ngayCap], ['Nội dung', a.noiDung], ['Ghi chú', a.ghiChu], ['Nguồn', a.nguon], ['Người thêm', a.nguoiThem]] as any).filter(([, v]: any) => v); const detail = [a.soKyHieu ? `Số/KH: ${a.soKyHieu}` : '', a.noiDung].filter(Boolean).join('   ·   '); return { key: 'a' + a.id, sev: sv.c, badge: sv.label || 'MỚI', srcShort: SHORT[a.nguon] || a.nguon || 'Thêm mới', ten: a.ten, thua: String(a.soThua || '').replace(/,\s*/g, '\n'), to: String(a.soTo || '').replace(/,\s*/g, '\n'), xa: a.xa, detail, pairs, link: a.link, added: a, expired: !!a.hetHieuLucAt, expiredAt: a.hetHieuLucAt || '', expiredBy: a.hetHieuLucBoi || '' }; };

  const filtered = useMemo(() => {
    if (!data) return { addRows: [] as any[], baseRecs: [] as Rec[] };
    const phrase = norm(dq).replace(/\s+/g, ' ').trim(); const phraseNS = phrase.replace(/\s+/g, ''); const hit = (s: string) => s.includes(phrase) || s.replace(/\s+/g, '').includes(phraseNS); const th = qth.trim(), to = qto.trim(), xa = norm(qxa); // KHỚP CỤM: có/không dấu cách đều tra ra
    const ten = norm(qten), skh = norm(qskh), cq = norm(qcq), gt = norm(qgt), ns = qns.trim(), dc = norm(qdc), gcn = norm(qgcn); // bộ lọc nâng cao (khớp chuỗi con, cộng dồn AND)
    const okAdd = (a: Added) => (!qsrc || qsrc === a.nguon) && (!th || digits(a.soThua).includes(th)) && (!to || digits(a.soTo).includes(to)) && (!xa || norm(a.xa).includes(xa))
      && (!ten || norm(a.ten).includes(ten)) && (!skh || norm(a.soKyHieu).includes(skh)) && (!cq || norm(a.donViGui).includes(cq)) && (!gt || norm(a.soGiayTo).includes(gt)) && (!ns || String(a.namSinh || '').includes(ns)) && (!dc || norm([a.diaChi, a.xa].join(' ')).includes(dc)) && (!gcn || norm([a.soPhatHanh, a.soVaoSo].join(' ')).includes(gcn))
      && (!phrase || hit(norm([a.ten, a.soThua, a.soTo, a.xa, a.noiDung, a.ghiChu, a.nguon, a.soKyHieu, a.donViGui, a.soDen, a.ngayVb, a.ngayDen, a.loaiVb, a.soVbGoc, a.soGiayTo, a.namSinh, a.diaChi, a.soPhatHanh, a.soVaoSo, a.ngayCap].join(' ')).replace(/\s+/g, ' ')));
    const okBase = (r: Rec) => (!qsrc || r.src === qsrc) && (!th || r.thk.includes(th)) && (!to || r.tok.includes(to)) && (!xa || norm(r.xa).includes(xa))
      && (!ten || r.blob.includes(ten)) && (!skh || r.blob.includes(skh)) && (!cq || r.blob.includes(cq)) && (!gt || r.blob.includes(gt)) && (!ns || r.blob.includes(norm(ns))) && (!dc || r.blob.includes(dc)) && (!gcn || r.blob.includes(gcn))
      && (!phrase || r.blob.includes(phrase) || r.blobNS.includes(phraseNS));
    const addRows = added.filter(okAdd).map(rowOfAdded);
    let baseRecs = hasFilter ? recs.filter(okBase) : recs;
    if (hasFilter) baseRecs = [...baseRecs].sort((a, b) => (sevOf(b.src).c === 'red' ? 1 : 0) - (sevOf(a.src).c === 'red' ? 1 : 0));
    return { addRows, baseRecs };
  }, [data, recs, added, dq, qth, qto, qxa, qsrc, qten, qskh, qcq, qgt, qns, qdc, qgcn, hasFilter]);

  const { addRows, baseRecs } = filtered; const total = addRows.length + baseRecs.length;
  const activeAdd = useMemo(() => addRows.filter((r: any) => !r.expired), [addRows]);
  const expiredAdd = useMemo(() => addRows.filter((r: any) => r.expired), [addRows]);
  // Thứ tự: bản thêm CÒN hiệu lực → danh sách gốc → bản thêm ĐÃ HẾT hiệu lực (dồn xuống cuối).
  const shownRows = useMemo(() => { if (!data) return []; const nA = activeAdd.length, nB = baseRecs.length, n = Math.min(limit, total); const out: any[] = []; for (let i = 0; i < n; i++) out.push(i < nA ? activeAdd[i] : i < nA + nB ? rowOfBase(baseRecs[i - nA]) : expiredAdd[i - nA - nB]); return out; }, [data, activeAdd, expiredAdd, baseRecs, limit, total]);
  const hasRed = hasFilter && baseRecs.some((r) => sevOf(r.src).c === 'red');
  const doDel = async () => { if (delId == null) return; setDelBusy(true); try { await api(`/hotlist/${delId}`, { method: 'DELETE' }); setAdded((x) => x.filter((y) => y.id !== delId)); setDelId(null); setToast('Đã xoá bản ghi.'); } catch (e: any) { setToast(e?.message || 'Lỗi xoá'); } finally { setDelBusy(false); } };
  const doExpire = async (id: number, off: boolean) => { try { const r = await api<{ record: Added }>(`/hotlist/${id}/het-hieu-luc`, { method: 'PATCH', body: JSON.stringify({ off }) }); setAdded((x) => x.map((y) => (y.id === id ? r.record : y))); setToast(off ? 'Đã khôi phục hiệu lực.' : 'Đã đánh dấu hết hiệu lực.'); } catch (e: any) { setToast(e?.message || 'Lỗi cập nhật'); } };
  const doDelSheet = async () => { if (!delSheet) return; setDelSheetBusy(true); try { await api('/hotlist/sheets', { method: 'DELETE', body: JSON.stringify({ name: delSheet }) }); setSheets((x) => x.filter((s: any) => s.name !== delSheet)); if (qsrc === delSheet) setQsrc(''); setToast('Đã xoá sheet.'); setDelSheet(null); } catch (e: any) { setToast(e?.message || 'Lỗi xoá sheet'); } finally { setDelSheetBusy(false); } };
  const onSaved = (rec: Added) => { setAdded((x) => { const i = x.findIndex((y) => y.id === rec.id); if (i >= 0) { const n = [...x]; n[i] = rec; return n; } return [rec, ...x]; }); if (rec.nguon) setSheets((s) => (s.some((y: any) => y.name === rec.nguon) ? s : [...s, { name: rec.nguon }])); setEdit(null); };

  if (authLoading) return <div style={{ height: 'calc(100dvh - var(--chrome-h, 56px))' }} className="grid place-items-center bg-white text-slate-400">Đang kiểm tra quyền truy cập…</div>;
  if (!canManage) return <div style={{ height: 'calc(100dvh - var(--chrome-h, 56px))' }} className="grid place-items-center bg-white p-8 text-center"><div className="max-w-sm"><div className="mb-2 text-5xl">🔒</div><p className="text-lg font-bold text-[#0A2540]">Danh sách nóng</p><p className="mt-1.5 text-sm leading-relaxed text-slate-500">Mục nội bộ, chỉ dành cho tài khoản đã được cấp quyền.{user ? ' Tài khoản của bạn chưa có quyền — vui lòng liên hệ quản trị viên.' : ' Vui lòng đăng nhập bằng tài khoản có quyền, hoặc liên hệ quản trị viên.'}</p><div className="mt-4 flex justify-center gap-2">{!user && <button onClick={() => openLogin()} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700">Đăng nhập</button>}<a href="/" target="_top" className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Về trang chủ</a></div></div></div>;
  if (err) return <div style={{ height: 'calc(100dvh - var(--chrome-h, 56px))' }} className="grid place-items-center bg-white p-8 text-center text-red-600 font-semibold">{err}</div>;

  return (
    <div className="flex flex-col bg-slate-100" style={{ height: 'calc(100dvh - var(--chrome-h, 56px))' }}>
      <div className="border-b bg-white px-3 py-2 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          {!embedded && <button onClick={() => { window.location.href = '/'; }} aria-label="Đóng" className="shrink-0 rounded px-2 py-1.5 text-sm hover:bg-slate-100">✕</button>}
          <b className="min-w-0 flex-1 truncate text-[#0A2540]">🔥 Danh sách nóng</b>
          <button onClick={() => setGuide(true)} aria-label="Hướng dẫn" title="Hướng dẫn" className="shrink-0 rounded border px-2.5 py-1.5 text-sm hover:bg-slate-50">❓<span className="hidden sm:inline"> Hướng dẫn</span></button>
          <button onClick={() => setEdit({})} className="shrink-0 rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">+ Thêm<span className="hidden sm:inline"> vào danh sách nóng</span></button>
        </div>
        <div className="mb-2 flex items-center gap-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ tên chủ / nội dung… (không cần dấu)" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
          <button onClick={() => setAdvOpen((v) => !v)} className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${advOpen || advActive ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>⚙<span className="hidden sm:inline"> Nâng cao</span>{advActive ? ' •' : ''}</button>
          {hasFilter && <button onClick={() => { setQ(''); setQth(''); setQto(''); setQxa(''); setQsrc(''); setQten(''); setQskh(''); setQcq(''); setQgt(''); setQns(''); setQdc(''); setQgcn(''); }} className="shrink-0 rounded-lg border px-2 py-2 text-sm text-slate-500">Xoá lọc</button>}
        </div>
        {(advOpen || advActive) && <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Tra cứu nâng cao <span className="font-normal normal-case text-slate-400">— lọc cộng dồn (thoả tất cả điều kiện)</span></p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <label className="text-xs font-medium text-slate-500">Tên / chủ sử dụng<input value={qten} onChange={(e) => setQten(e.target.value)} placeholder="Họ tên chủ" className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800" /></label>
            <label className="text-xs font-medium text-slate-500">Thửa<input value={qth} onChange={(e) => setQth(e.target.value)} placeholder="Số thửa" className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800" /></label>
            <label className="text-xs font-medium text-slate-500">Tờ<input value={qto} onChange={(e) => setQto(e.target.value)} placeholder="Số tờ" className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800" /></label>
            <label className="text-xs font-medium text-slate-500">Xã / phường<select value={qxa} onChange={(e) => setQxa(e.target.value)} className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800"><option value="">— Tất cả —</option>{xaList.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-500">Số, ký hiệu VB<input value={qskh} onChange={(e) => setQskh(e.target.value)} placeholder="VD: 1234/QĐ" className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800" /></label>
            <label className="text-xs font-medium text-slate-500">Cơ quan ban hành<input value={qcq} onChange={(e) => setQcq(e.target.value)} placeholder="Đơn vị gửi" className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800" /></label>
            <label className="text-xs font-medium text-slate-500">Số giấy tờ (CCCD)<input value={qgt} onChange={(e) => setQgt(e.target.value)} placeholder="Số CCCD/CMND" className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800" /></label>
            <label className="text-xs font-medium text-slate-500">Năm sinh<input value={qns} onChange={(e) => setQns(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="VD: 1985" inputMode="numeric" maxLength={4} className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800" /></label>
            <label className="text-xs font-medium text-slate-500">Số GCN<input value={qgcn} onChange={(e) => setQgcn(e.target.value)} placeholder="Số giấy chứng nhận" className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800" /></label>
            <label className="col-span-2 text-xs font-medium text-slate-500 lg:col-span-2">Địa chỉ<input value={qdc} onChange={(e) => setQdc(e.target.value)} placeholder="Địa chỉ chủ / thửa đất" className="mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-normal text-slate-800" /></label>
          </div>
        </div>}
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 no-scrollbar">
          <button onClick={() => setQsrc('')} className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${!qsrc ? 'bg-[#0A2540] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Tất cả · {counts['TỔNG']?.toLocaleString('vi')}</button>
          {groups.map((g: any) => { const sv = sevOf(g.s); const active = qsrc === g.s; return <button key={g.s} onClick={() => setQsrc(active ? '' : g.s)} className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${active ? chipCls[sv.c] : chipSoft[sv.c] + ' hover:brightness-95'}`}>{SHORT[g.s] || g.s} · {(counts[g.s] || 0).toLocaleString('vi')}</button>; })}
          {customSheets.map(([s, n]: any) => { const active = qsrc === s; return (
            <span key={s} className="relative shrink-0">
              <button onClick={() => setQsrc(active ? '' : s)} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${active ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 hover:brightness-95'} ${isAdmin && n === 0 ? 'pr-6' : ''}`}>🆕 {s} · {n}</button>
              {isAdmin && n === 0 && <button onClick={(e) => { e.stopPropagation(); setDelSheet(s); }} title="Xoá sheet rỗng" className={`absolute right-0.5 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold ${active ? 'text-white hover:bg-white/25' : 'text-emerald-700 hover:bg-emerald-200'}`}>✕</button>}
            </span>
          ); })}
        </div>
      </div>

      {loading ? <div className="grid flex-1 place-items-center text-slate-500">{loading}</div> : (
        <>
          <div className="flex items-center gap-3 border-b bg-white px-3 py-1.5 text-sm">
            {hasFilter ? <span>Tìm thấy <b className="text-[#0A2540]">{total.toLocaleString('vi')}</b> kết quả</span> : <span>Toàn bộ <b className="text-[#0A2540]">{total.toLocaleString('vi')}</b> bản ghi{qsrc ? ` · ${SHORT[qsrc] || qsrc}` : ''}</span>}
            {hasRed && <span className="font-bold text-red-600">⚠ Có NGĂN CHẶN giao dịch!</span>}
            <span className="ml-auto text-xs text-slate-400">Đã hiện {Math.min(limit, total).toLocaleString('vi')}<span className="hidden sm:inline"> — cuộn để xem tiếp</span></span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto" onScroll={(ev) => { const el = ev.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 800) setLimit((l) => (l < total ? l + STEP : l)); }}>
            <ResultTable shownRows={shownRows} total={total} limit={limit} openKey={openKey} setOpenKey={setOpenKey} canManage={canManage} isAdmin={isAdmin} onEdit={(a: Added) => setEdit(a)} onDel={(id: number) => setDelId(id)} onExpire={doExpire} mobile={mobile} />
          </div>
        </>
      )}

      {edit && <EditModal initial={edit} onClose={() => setEdit(null)} canManage={canManage} loggedIn={!!user} srcList={groups.map((g: any) => g.s)} newSources={customSheets.map(([s]: any) => s)} onSaved={onSaved} />}
      {guide && <GuideModal onClose={() => setGuide(false)} />}
      {delId != null && <ConfirmModal title="Xoá bản ghi" message="Bạn có chắc muốn xoá bản ghi này khỏi danh sách nóng? Hành động không thể hoàn tác." confirmLabel="Xoá" busy={delBusy} onConfirm={doDel} onCancel={() => setDelId(null)} />}
      {delSheet != null && <ConfirmModal title="Xoá sheet" message={`Xoá sheet "${delSheet}" khỏi danh sách? Sheet đang rỗng (không còn bản ghi nào). Hành động không thể hoàn tác.`} confirmLabel="Xoá sheet" busy={delSheetBusy} onConfirm={doDelSheet} onCancel={() => setDelSheet(null)} />}
      <Toast text={toast} onClose={() => setToast('')} />
    </div>
  );
}
