'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import {
  listCustomers, getCustomer, addCustomer, updateCustomer, removeCustomer,
  addNeed, updateNeed, removeNeed, updateInterest, removeInterest, getMatch, addInterest, addActivity, removeActivity, updateActivity, clearActivities,
  addAppointment, updateAppointment, removeAppointment,
  type Customer, type CustomerNeed, type Interest, type MatchGroup, type Activity, type Appointment,
} from '@/lib/crm';

const inpc = 'w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-[#7c3aed]';
const dealColor = (s?: string | null) => s === 'Đã chốt' ? '#16a34a' : s === 'Thương lượng' ? '#ea580c' : s === 'Đang tư vấn' ? '#0891b2' : s === 'Không thành' ? '#9ca3af' : '#7c3aed';
const AV_COLORS = ['#0A2540', '#475569', '#7c3aed'];
const avatarColor = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };
const initials = (name: string) => { const p = (name || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase(); };
const STAGE_ORDER = ['Không thành', 'Mới', 'Đang tư vấn', 'Thương lượng', 'Đã chốt'];
const custStage = (its: { dealStatus?: string | null }[]) => { let b = '', r = -1; for (const it of its) { const s = it.dealStatus || 'Mới'; const k = STAGE_ORDER.indexOf(s); if (k > r) { r = k; b = s; } } return b; };
const actStyle = (k: string) => ({ ic: k === 'Gọi' ? '📞' : k === 'Nhắn' ? '💬' : k === 'Gặp' ? '🤝' : '📝', bg: '#f1f5f9' });
const fmtWhen = (s?: string | null) => { if (!s) return ''; const diff = (Date.now() - new Date(s).getTime()) / 1000; if (diff < 60) return 'vừa xong'; if (diff < 3600) return Math.floor(diff / 60) + ' phút trước'; if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước'; if (diff < 604800) return Math.floor(diff / 86400) + ' ngày trước'; return Math.floor(diff / 604800) + ' tuần trước'; };
const fmtDateTime = (s?: string | null) => s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export default function CrmKhachPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Customer[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [tab, setTab] = useState<'overview' | 'needs' | 'interests' | 'activity' | 'appt'>('overview');
  const [detail, setDetail] = useState<{ customer: Customer; needs: CustomerNeed[]; interests: Interest[]; activities: Activity[]; appointments: Appointment[] } | null>(null);
  const [matches, setMatches] = useState<MatchGroup[]>([]);
  const [adminAll, setAdminAll] = useState(false);
  const [actNote, setActNote] = useState('');
  const [editAct, setEditAct] = useState<{ id: number; note: string } | null>(null);
  const [showAp, setShowAp] = useState(false);
  const [ap, setAp] = useState({ appointAt: '', location: '', note: '', smsReminder: false });
  const [q, setQ] = useState('');
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [cf, setCf] = useState({ name: '', phone: '', source: '', note: '' });
  const [editCustId, setEditCustId] = useState<number | null>(null); // null = thêm mới, có id = đang sửa khách
  const [showNeed, setShowNeed] = useState(false);
  const [editNeedId, setEditNeedId] = useState<number | null>(null); // null = thêm mới, có id = đang sửa nhu cầu
  const [nf, setNf] = useState({ dealType: '', propType: '', budget: '', areaNeed: '', location: '', status: '', note: '' });

  const load = () => listCustomers(adminAll).then(setList).catch(() => setList([]));
  useEffect(() => { if (user) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, adminAll]);

  async function openCust(id: number) {
    setSel(id); setShowNeed(false); setShowAdd(false); setTab('overview');
    if (typeof window !== 'undefined' && window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' });
    try { setDetail(await getCustomer(id)); } catch { setDetail(null); }
    getMatch(id).then(setMatches).catch(() => setMatches([]));
  }
  async function attach(placeId: number) {
    if (!sel) return;
    try { await addInterest({ placeId, customerId: sel, dealStatus: 'Mới' }); openCust(sel); load(); }
    catch (e: any) { alert('Lỗi: ' + (e?.message || e)); }
  }
  async function logAct(kind: string) {
    if (!sel) return;
    try { await addActivity(sel, { kind, note: actNote.trim() || undefined }); setActNote(''); openCust(sel); } catch (e: any) { alert(e.message); }
  }
  async function delAct(id: number) {
    if (!sel) return;
    try { await removeActivity(id); openCust(sel); } catch (e: any) { alert(e.message); }
  }
  async function saveActNote() {
    if (!editAct || !sel) return;
    try { await updateActivity(editAct.id, { note: editAct.note.trim() }); setEditAct(null); openCust(sel); } catch (e: any) { alert(e.message); }
  }
  async function clearAllAct() {
    if (!sel || !confirm('Xoá TẤT CẢ lịch sử chăm sóc của khách này? (không khôi phục được)')) return;
    try { await clearActivities(sel); openCust(sel); } catch (e: any) { alert(e.message); }
  }
  async function saveAppt() {
    if (!sel || !ap.appointAt) { alert('Chọn ngày giờ hẹn công chứng.'); return; }
    try { await addAppointment({ customerId: sel, appointAt: new Date(ap.appointAt).toISOString(), location: ap.location || undefined, note: ap.note || undefined, smsReminder: ap.smsReminder }); setAp({ appointAt: '', location: '', note: '', smsReminder: false }); setShowAp(false); openCust(sel); }
    catch (e: any) { alert(e.message); }
  }
  async function setApStatus(id: number, status: string) { try { await updateAppointment(id, { status }); if (sel) openCust(sel); } catch (e: any) { alert(e.message); } }
  async function toggleApSms(a: Appointment) { try { await updateAppointment(a.id, { smsReminder: !a.smsReminder }); if (sel) openCust(sel); } catch (e: any) { alert(e.message); } }
  async function delAppt(id: number) { try { await removeAppointment(id); if (sel) openCust(sel); } catch (e: any) { alert(e.message); } }
  async function saveCustomer() {
    if (!cf.name.trim() && !cf.phone.trim()) { alert('Nhập tên hoặc SĐT khách.'); return; }
    const eid = editCustId;
    try {
      if (eid) await updateCustomer(eid, cf); else await addCustomer(cf);
      setCf({ name: '', phone: '', source: '', note: '' }); setShowAdd(false); setEditCustId(null); load();
      if (eid && sel === eid) openCust(eid);
    } catch (e: any) { alert('Lỗi: ' + (e?.message || e)); }
  }
  function startEditCust(c: Customer) {
    setEditCustId(c.id); setCf({ name: c.name || '', phone: c.phone || '', source: c.source || '', note: c.note || '' }); setShowAdd(true);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function delCustomer(id: number) {
    if (!confirm('Xoá khách này (kèm nhu cầu & quan tâm)?')) return;
    try { await removeCustomer(id); if (sel === id) { setSel(null); setDetail(null); } load(); } catch (e: any) { alert(e.message); }
  }
  async function saveNeed() {
    if (!sel) return;
    const eid = editNeedId;
    try { if (eid) await updateNeed(eid, nf); else await addNeed(sel, nf); setNf({ dealType: '', propType: '', budget: '', areaNeed: '', location: '', status: '', note: '' }); setShowNeed(false); setEditNeedId(null); openCust(sel); load(); }
    catch (e: any) { alert('Lỗi: ' + (e?.message || e)); }
  }
  function startEditNeed(n: CustomerNeed) {
    setEditNeedId(n.id); setNf({ dealType: n.dealType || '', propType: n.propType || '', budget: n.budget || '', areaNeed: n.areaNeed || '', location: n.location || '', status: n.status || '', note: n.note || '' }); setShowNeed(true);
  }
  async function delNeed(id: number) {
    if (!sel) return;
    try { await removeNeed(id); openCust(sel); load(); } catch (e: any) { alert(e.message); }
  }
  async function setIntStatus(id: number, dealStatus: string) {
    if (!sel) return;
    try { await updateInterest(id, { dealStatus }); openCust(sel); load(); } catch (e: any) { alert(e.message); }
  }
  async function delInterest(id: number) {
    if (!sel) return;
    try { await removeInterest(id); openCust(sel); load(); } catch (e: any) { alert(e.message); }
  }

  if (!user) return <div className="max-w-md mx-auto py-24 text-center text-slate-500">Vui lòng <Link href="/login" className="text-[#7c3aed] font-bold">đăng nhập</Link> để dùng CRM khách hàng.</div>;

  const shown = list.filter((c) => (!q || (c.name || '').toLowerCase().includes(q.toLowerCase()) || (c.phone || '').includes(q)) && (!stageFilter || (c.dealStage || 'Mới') === stageFilter));

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <div className={`flex items-center justify-between mb-3 ${sel ? 'hidden lg:flex' : ''}`}>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#0A2540]">CRM Khách hàng</h1>
            <p className="text-sm text-slate-500 hidden sm:block">Quản lý khách, nhu cầu và các tin họ quan tâm — chốt deal hiệu quả.</p>
          </div>
          <div className="flex items-center gap-2">
            {user.role === 'admin' && (
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-600 cursor-pointer bg-white border border-slate-200 rounded-full px-2.5 py-1.5"><input type="checkbox" checked={adminAll} onChange={(e) => { setAdminAll(e.target.checked); setSel(null); setDetail(null); }} className="accent-[#7c3aed]" /> Xem toàn đội</label>
            )}
            <button onClick={() => { setEditCustId(null); setCf({ name: '', phone: '', source: '', note: '' }); setShowAdd((v) => !v); }} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold px-3 sm:px-4 py-2 rounded-full text-sm whitespace-nowrap">＋ Thêm khách</button>
          </div>
        </div>

        <div className={`grid grid-cols-3 gap-1.5 sm:gap-3 mb-3 ${sel ? 'hidden lg:grid' : ''}`}>
          {[['Tổng khách', list.length, '👥'], ['Có nhu cầu', list.filter((c) => (c.needCount || 0) > 0).length, '🎯'], ['Tin quan tâm', list.reduce((s, c) => s + (c.interestCount || 0), 0), '🏠']].map(([label, n, ic]) => (
            <div key={label as string} className="bg-white rounded-xl border border-slate-200 shadow-sm px-2 sm:px-3 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-2.5">
              <span className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg grid place-items-center text-base sm:text-lg shrink-0 bg-slate-100">{ic as string}</span>
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-extrabold leading-none text-[#0A2540]">{n as number}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate">{label as string}</div>
              </div>
            </div>
          ))}
        </div>

        {showAdd && (
          <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <b className="text-sm text-[#0A2540]">{editCustId ? '✎ Sửa thông tin khách' : '＋ Thêm khách mới'}</b>
              <button onClick={() => { setShowAdd(false); setEditCustId(null); }} className="text-slate-400 hover:text-slate-600 w-7 h-7 grid place-items-center rounded-lg hover:bg-slate-100 text-base leading-none">✕</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} placeholder="Tên khách" className={inpc} />
              <input value={cf.phone} onChange={(e) => setCf({ ...cf, phone: e.target.value })} placeholder="SĐT" inputMode="tel" className={inpc} />
              <input value={cf.source} onChange={(e) => setCf({ ...cf, source: e.target.value })} placeholder="Nguồn (FB, giới thiệu…)" className={inpc} />
              <input value={cf.note} onChange={(e) => setCf({ ...cf, note: e.target.value })} placeholder="Ghi chú" className={inpc} />
              <div className="sm:col-span-2 flex gap-2">
                <button onClick={saveCustomer} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm">{editCustId ? '💾 Lưu thay đổi' : 'Lưu khách'}</button>
                <button onClick={() => { setShowAdd(false); setEditCustId(null); }} className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm">Huỷ</button>
              </div>
            </div>
          </div>
        )}

        <div className="lg:flex gap-4 items-start">
          {/* Danh sách khách */}
          <div className={`lg:w-2/5 lg:sticky lg:top-[70px] lg:self-start ${sel ? 'hidden lg:block' : ''}`}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm khách theo tên / SĐT…" className={`${inpc} bg-white mb-2`} />
            <div className="flex flex-wrap gap-1.5 mb-2">
              {([null, 'Mới', 'Đang tư vấn', 'Thương lượng', 'Đã chốt', 'Không thành'] as const).map((s) => {
                const cnt = s === null ? list.length : list.filter((c) => (c.dealStage || 'Mới') === s).length;
                const active = stageFilter === s;
                return (
                  <button key={s || 'all'} onClick={() => setStageFilter(s)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition ${active ? 'text-white border-transparent shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`} style={active ? { background: s ? dealColor(s) : '#0A2540' } : undefined}>{s || 'Tất cả'} <span className={active ? 'opacity-80' : 'text-slate-400'}>{cnt}</span></button>
                );
              })}
            </div>
            <div className="space-y-2 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto scroll-soft lg:pr-1">
            {shown.length === 0 ? <p className="text-slate-400 text-sm py-6 text-center">Chưa có khách. Bấm ＋ Thêm khách.</p> : null}
            {shown.map((c) => (
              <button key={c.id} onClick={() => openCust(c.id)} className={`w-full text-left bg-white rounded-xl border p-3 transition hover:shadow-md ${sel === c.id ? 'border-[#7c3aed] ring-2 ring-[#7c3aed]/20 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full grid place-items-center text-white font-bold text-sm shrink-0 shadow-sm" style={{ background: avatarColor(c.name || String(c.id)) }}>{initials(c.name || 'K')}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-[#0A2540] truncate">{c.name || 'Khách chưa đặt tên'}</b>
                      <span className="text-[11px] text-slate-400 shrink-0 truncate max-w-[40%]">{adminAll && c.salesName ? `👤 ${c.salesName}` : c.source}</span>
                    </div>
                    <div className="text-sm text-slate-500 truncate">{c.phone ? <span className="text-[#7c3aed] font-semibold">{c.phone}</span> : 'Chưa có SĐT'}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: dealColor(c.dealStage || 'Mới') }}>{c.dealStage || 'Mới'}</span>
                  <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">🎯 {c.needCount || 0}</span>
                  <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">🏠 {c.interestCount || 0}</span>
                </div>
              </button>
            ))}
            </div>
          </div>

          {/* Chi tiết khách */}
          <div className={`lg:flex-1 mt-3 lg:mt-0 ${sel ? '' : 'hidden lg:block'}`}>
            {sel && <button onClick={() => { setSel(null); setDetail(null); }} className="lg:hidden mb-3 inline-flex items-center gap-1 text-sm font-bold text-[#7c3aed] bg-white border border-slate-200 rounded-full px-3.5 py-1.5 shadow-sm">← Danh sách khách</button>}
            {!detail ? (
              sel ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">Đang tải…</div>
              ) : (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <div className="text-4xl mb-2">👥</div>
                <p className="text-slate-500 font-semibold">Chọn một khách để xem chi tiết</p>
                <p className="text-slate-400 text-sm mt-1">Nhu cầu, tin quan tâm, lịch sử chăm sóc &amp; lịch công chứng.</p>
              </div>
              )
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-14 h-14 rounded-2xl grid place-items-center text-white font-extrabold text-xl shrink-0 shadow" style={{ background: avatarColor(detail.customer.name || String(detail.customer.id)) }}>{initials(detail.customer.name || 'K')}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-extrabold text-[#0A2540]">{detail.customer.name || 'Khách'}</h2>
                        {(() => { const st = custStage(detail.interests); return st ? <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: dealColor(st) }}>{st}</span> : null; })()}
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{detail.customer.phone ? <a href={`tel:${detail.customer.phone}`} className="text-[#7c3aed] font-bold">📞 {detail.customer.phone}</a> : 'Chưa có SĐT'}{detail.customer.source ? <span className="ml-1.5 text-[11px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full align-middle">{detail.customer.source}</span> : null}</p>
                      {detail.customer.note ? <p className="text-xs text-slate-500 mt-1">🗨 {detail.customer.note}</p> : null}
                    </div>
                    <div className="shrink-0 flex items-center gap-0.5">
                      <button onClick={() => startEditCust(detail.customer)} title="Sửa thông tin khách" className="text-slate-400 hover:text-[#7c3aed] hover:bg-slate-100 w-9 h-9 grid place-items-center rounded-lg transition text-base">✎</button>
                      <button onClick={() => delCustomer(detail.customer.id)} title="Xoá khách" className="text-slate-300 hover:text-red-600 hover:bg-red-50 w-9 h-9 grid place-items-center rounded-lg transition">🗑</button>
                    </div>
                  </div>
                  {(() => {
                    const stages = ['Mới', 'Đang tư vấn', 'Thương lượng', 'Đã chốt'];
                    const idx = stages.indexOf(custStage(detail.interests) || 'Mới');
                    return (
                      <div className="flex items-end gap-1.5 mt-4">
                        {stages.map((s, i) => (
                          <div key={s} className="flex-1 min-w-0">
                            <div className="h-1.5 rounded-full" style={{ background: i <= idx ? dealColor(s) : '#e2e8f0' }} />
                            <span className={`block text-[10px] font-semibold mt-1 truncate ${i <= idx ? 'text-[#0A2540]' : 'text-slate-400'}`}>{s}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {detail.customer.phone && <a href={`tel:${detail.customer.phone}`} onClick={() => logAct('Gọi')} className="flex-1 min-w-[72px] flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2 rounded-lg transition">📞 Gọi</a>}
                    <button onClick={() => logAct('Nhắn')} className="flex-1 min-w-[72px] flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-2 rounded-lg transition">💬 Nhắn</button>
                    <button onClick={() => logAct('Gặp')} className="flex-1 min-w-[72px] flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-2 rounded-lg transition">🤝 Gặp</button>
                    <button onClick={() => { setTab('appt'); setShowAp(true); }} className="flex-1 min-w-[72px] flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-2 rounded-lg transition">🗓 Lịch</button>
                  </div>
                </div>

                <div className="flex gap-0.5 px-2 sm:px-3 border-y border-slate-100 bg-slate-50 overflow-x-auto">
                  {([['overview', 'Tổng quan', -1], ['needs', '🎯 Nhu cầu', detail.needs.length], ['interests', '🏠 Tin quan tâm', detail.interests.length], ['activity', '🕑 Chăm sóc', detail.activities.length], ['appt', '🗓 Công chứng', detail.appointments.length]] as const).map(([k, lb, n]) => (
                    <button key={k} onClick={() => setTab(k)} className={`shrink-0 px-3 py-2.5 text-sm font-bold border-b-2 -mb-px transition whitespace-nowrap ${tab === k ? 'border-[#7c3aed] text-[#7c3aed]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{lb}{n > 0 ? <span className="ml-1 text-[11px] bg-slate-200 text-slate-600 rounded-full px-1.5">{n}</span> : null}</button>
                  ))}
                </div>

                <div className="p-4 sm:p-5">
                  {tab === 'overview' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([['🎯', 'Nhu cầu', detail.needs.length, '#d97706'], ['🏠', 'Tin quan tâm', detail.interests.length, '#16a34a'], ['🕑', 'Lần chăm sóc', detail.activities.length, '#64748b'], ['🗓', 'Hẹn chờ', detail.appointments.filter((a) => (a.status || 'Chờ') === 'Chờ').length, '#2563eb']] as const).map(([ic, lb, n, c]) => (
                          <div key={lb} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                            <div className="text-xl font-extrabold text-[#0A2540]">{n}</div>
                            <div className="text-[11px] text-slate-500 font-semibold">{ic} {lb}</div>
                          </div>
                        ))}
                      </div>
                      {detail.needs[0] && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Nhu cầu chính</p>
                          <p className="text-sm text-slate-700"><b>{[detail.needs[0].dealType, detail.needs[0].propType].filter(Boolean).join(' · ') || 'Nhu cầu'}</b>{[detail.needs[0].budget, detail.needs[0].areaNeed, detail.needs[0].location].filter(Boolean).length ? ' — ' + [detail.needs[0].budget, detail.needs[0].areaNeed, detail.needs[0].location].filter(Boolean).join(' · ') : ''}</p>
                        </div>
                      )}
                      {(() => { const up = detail.appointments.filter((a) => (a.status || 'Chờ') === 'Chờ').slice().sort((a, b) => (a.appointAt || '').localeCompare(b.appointAt || ''))[0]; return up ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Lịch công chứng sắp tới</p>
                          <p className="text-sm text-[#0A2540] font-bold">{up.appointAt ? new Date(up.appointAt).toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                          {up.location ? <p className="text-xs text-slate-600 mt-0.5">📍 {up.location}</p> : null}
                        </div>
                      ) : null; })()}
                      {detail.activities.length > 0 && (
                        <div className="rounded-xl border border-slate-100 p-3">
                          <div className="flex items-center justify-between mb-2.5">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Hoạt động gần nhất</p>
                            <button onClick={() => setTab('activity')} className="text-[11px] font-bold text-[#7c3aed] shrink-0">Xem tất cả ({detail.activities.length}) →</button>
                          </div>
                          <div className="space-y-3">
                            {detail.activities.slice(0, 3).map((a, i) => (
                              <div key={a.id} className="flex gap-2.5">
                                <div className="flex flex-col items-center shrink-0">
                                  <span className="w-7 h-7 rounded-full grid place-items-center text-xs shadow-sm" style={{ background: actStyle(a.kind).bg }}>{actStyle(a.kind).ic}</span>
                                  {i < Math.min(3, detail.activities.length) - 1 && <span className="w-px flex-1 bg-slate-200 my-1" />}
                                </div>
                                <div className="min-w-0 flex-1 pb-0.5">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <b className="text-[13px] text-[#0A2540]">{a.kind}</b>
                                    <span className="text-[11px] font-semibold text-slate-500">{fmtWhen(a.createdAt)}</span>
                                    <span className="text-[10px] text-slate-400">{fmtDateTime(a.createdAt)}</span>
                                  </div>
                                  {a.note ? <p className="text-xs text-slate-600 break-words mt-0.5">{a.note}</p> : <button onClick={() => { setTab('activity'); setEditAct({ id: a.id, note: '' }); }} className="text-xs text-[#7c3aed] font-semibold mt-0.5">＋ Thêm nội dung</button>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {matches.some((m) => m.places.length > 0) && (
                        <button onClick={() => setTab('interests')} className="w-full text-left rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 p-3 hover:bg-[#7c3aed]/10 transition text-sm font-bold text-[#7c3aed]">✨ Có {matches.reduce((s, m) => s + m.places.length, 0)} tin phù hợp nhu cầu — xem &amp; gắn →</button>
                      )}
                      {detail.needs.length === 0 && detail.interests.length === 0 && detail.activities.length === 0 && detail.appointments.length === 0 && (
                        <p className="text-slate-400 text-sm text-center py-4">Khách mới — thêm nhu cầu, gắn tin quan tâm và ghi lại lần chăm sóc đầu tiên.</p>
                      )}
                    </div>
                  )}

                  {tab === 'needs' && (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-sm font-bold text-[#0A2540]">Nhu cầu của khách</p>
                        <button onClick={() => { setEditNeedId(null); setNf({ dealType: '', propType: '', budget: '', areaNeed: '', location: '', status: '', note: '' }); setShowNeed((v) => !v); }} className="text-[#7c3aed] font-bold text-sm">＋ Thêm nhu cầu</button>
                      </div>
                      {showNeed && (
                        <div className="bg-slate-50 rounded-lg p-2.5 mb-2">
                          <b className="block text-xs text-[#0A2540] mb-1.5">{editNeedId ? '✎ Sửa nhu cầu' : '＋ Nhu cầu mới'}</b>
                          <div className="grid sm:grid-cols-2 gap-1.5">
                          <select value={nf.dealType} onChange={(e) => setNf({ ...nf, dealType: e.target.value })} className={`${inpc} bg-white`}><option value="">Nhu cầu…</option><option>Mua</option><option>Thuê</option><option>Bán</option><option>Ký gửi</option></select>
                          <input value={nf.propType} onChange={(e) => setNf({ ...nf, propType: e.target.value })} placeholder="Loại BĐS (đất nền, nhà phố…)" className={inpc} />
                          <input value={nf.budget} onChange={(e) => setNf({ ...nf, budget: e.target.value })} placeholder="Ngân sách" className={inpc} />
                          <input value={nf.areaNeed} onChange={(e) => setNf({ ...nf, areaNeed: e.target.value })} placeholder="Diện tích mong muốn" className={inpc} />
                          <input value={nf.location} onChange={(e) => setNf({ ...nf, location: e.target.value })} placeholder="Khu vực" className={inpc} />
                          <select value={nf.status} onChange={(e) => setNf({ ...nf, status: e.target.value })} className={`${inpc} bg-white`}><option value="">Trạng thái…</option><option>Đang tìm</option><option>Đã có hàng</option><option>Tạm dừng</option><option>Đã chốt</option></select>
                          <input value={nf.note} onChange={(e) => setNf({ ...nf, note: e.target.value })} placeholder="Ghi chú" className={`${inpc} sm:col-span-2`} />
                          <div className="sm:col-span-2 flex gap-2">
                            <button onClick={saveNeed} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg text-sm">{editNeedId ? '💾 Lưu thay đổi' : 'Lưu nhu cầu'}</button>
                            <button onClick={() => { setShowNeed(false); setEditNeedId(null); }} className="bg-white border border-slate-200 px-4 py-1.5 rounded-lg text-sm">Huỷ</button>
                          </div>
                          </div>
                        </div>
                      )}
                      {detail.needs.length === 0 && !showNeed ? <p className="text-slate-400 text-sm">Chưa có nhu cầu. Bấm ＋ Thêm nhu cầu.</p> : null}
                      <div className="space-y-1.5">
                        {detail.needs.map((n) => (
                          <div key={n.id} className="group flex items-start justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
                            <div className="text-sm text-slate-700">
                              <b>{[n.dealType, n.propType].filter(Boolean).join(' · ') || 'Nhu cầu'}</b>
                              <span className="text-slate-500">{[n.budget, n.areaNeed, n.location].filter(Boolean).length ? ' — ' + [n.budget, n.areaNeed, n.location].filter(Boolean).join(' · ') : ''}</span>
                              {n.status ? <span className="ml-1 text-[11px] font-bold text-amber-700">[{n.status}]</span> : null}
                              {n.note ? <div className="text-xs text-slate-500">🗨 {n.note}</div> : null}
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => startEditNeed(n)} title="Sửa nhu cầu" className="text-slate-400 hover:text-[#7c3aed] text-sm w-7 h-7 grid place-items-center rounded-lg hover:bg-white opacity-100 lg:opacity-0 lg:group-hover:opacity-100">✎</button>
                              <button onClick={() => delNeed(n.id)} title="Xoá nhu cầu" className="text-red-400 hover:text-red-600 text-sm w-7 h-7 grid place-items-center rounded-lg hover:bg-white">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab === 'interests' && (
                    <div>
                      <p className="text-sm font-bold text-[#0A2540] mb-2.5">Tin BĐS khách đang quan tâm</p>
                      {detail.interests.length === 0 ? <p className="text-slate-400 text-sm">Chưa gắn tin nào. Vào bản đồ, bấm 1 tin đã lưu → ＋ Thêm khách.</p> : null}
                      <div className="space-y-1.5">
                        {detail.interests.map((it) => (
                          <div key={it.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
                            <div className="text-sm text-slate-700 min-w-0">
                              <b className="truncate">{it.features || (it.parcel ? `Thửa ${it.parcel}${it.sheet ? ', Tờ ' + it.sheet : ''}` : 'Tin BĐS')}</b>
                              <span className="text-slate-500">{it.price ? ' · ' + it.price : ''}{it.area ? ' · ' + it.area + 'm²' : ''}{it.ward ? ' · ' + it.ward : ''}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {it.interest ? <span className="text-[10px] font-bold px-1.5 rounded bg-white text-slate-600">{it.interest}</span> : null}
                              <span className="relative inline-flex items-center">
                                <select value={it.dealStatus || 'Mới'} onChange={(e) => setIntStatus(it.id, e.target.value)} title="Bấm để đổi trạng thái deal" className="text-[10px] font-bold rounded pl-1.5 pr-4 py-0.5 text-white border-0 outline-none cursor-pointer appearance-none" style={{ backgroundColor: dealColor(it.dealStatus || 'Mới') }}>
                                  {['Mới', 'Đang tư vấn', 'Thương lượng', 'Đã chốt', 'Không thành'].map((s) => <option key={s} value={s} className="bg-white text-slate-700">{s}</option>)}
                                </select>
                                <span className="pointer-events-none absolute right-1 text-white text-[8px]">▼</span>
                              </span>
                              <button onClick={() => delInterest(it.id)} title="Bỏ gắn tin" className="text-red-400 hover:text-red-600 text-sm">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {matches.some((m) => m.places.length > 0) && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <span className="text-sm font-extrabold text-[#7c3aed]">✨ Gợi ý tin phù hợp nhu cầu</span>
                          {matches.filter((m) => m.places.length > 0).map((m) => (
                            <div key={m.need.id} className="mt-1.5">
                              <p className="text-xs text-slate-500 font-semibold">{[m.need.dealType, m.need.propType, m.need.location, m.need.budget].filter(Boolean).join(' · ') || 'Nhu cầu'}:</p>
                              <div className="space-y-1 mt-1">
                                {m.places.map((p) => (
                                  <div key={p.id} className="flex items-center justify-between bg-[#7c3aed]/5 rounded-lg px-2.5 py-1.5 text-sm">
                                    <span className="text-slate-700 min-w-0 truncate"><b>{p.features || (p.parcel ? `Thửa ${p.parcel}` : 'Tin')}</b><span className="text-slate-500">{p.price ? ' · ' + p.price : ''}{p.ward ? ' · ' + p.ward : ''}</span></span>
                                    <button onClick={() => attach(p.id)} className="shrink-0 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">＋ Quan tâm</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'activity' && (
                    <div>
                      <input value={actNote} onChange={(e) => setActNote(e.target.value)} placeholder="Nhập nội dung chăm sóc rồi bấm loại bên dưới…" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-[#7c3aed]" />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[['📞', 'Gọi'], ['💬', 'Nhắn'], ['🤝', 'Gặp'], ['📝', 'Ghi chú']].map(([ic, k]) => (
                          <button key={k} onClick={() => logAct(k)} className="text-xs font-bold px-3 py-1.5 rounded-lg transition bg-slate-100 text-slate-700 hover:bg-slate-200">{ic} {k}</button>
                        ))}
                      </div>
                      {detail.activities.length > 0 && (
                        <div className="flex items-center justify-between mt-4 mb-1">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Lịch sử ({detail.activities.length})</p>
                          <button onClick={clearAllAct} className="text-[11px] font-bold text-red-500 hover:text-red-700">🗑 Xoá tất cả</button>
                        </div>
                      )}
                      <div className="mt-1">
                        {detail.activities.length === 0 ? <p className="text-slate-400 text-xs mt-3">Chưa có tương tác nào. Nhập nội dung rồi bấm 📞/💬/🤝/📝 để ghi lại.</p> : null}
                        {detail.activities.map((a, i) => (
                          <div key={a.id} className="flex gap-2.5 group">
                            <div className="flex flex-col items-center shrink-0">
                              <span className="w-7 h-7 rounded-full grid place-items-center text-xs shadow-sm" style={{ background: actStyle(a.kind).bg }}>{actStyle(a.kind).ic}</span>
                              {i < detail.activities.length - 1 && <span className="w-px flex-1 bg-slate-200 my-1" />}
                            </div>
                            <div className="flex-1 min-w-0 pb-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                                  <b className="text-[13px] text-[#0A2540]">{a.kind}</b>
                                  <span className="text-[11px] text-slate-400">{fmtWhen(a.createdAt)} · {fmtDateTime(a.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button onClick={() => setEditAct({ id: a.id, note: a.note || '' })} title="Sửa nội dung" className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-[#7c3aed] hover:bg-slate-100 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">✎</button>
                                  <button onClick={() => delAct(a.id)} title="Xoá" className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">✕</button>
                                </div>
                              </div>
                              {editAct?.id === a.id ? (
                                <div className="flex gap-1.5 mt-1">
                                  <input value={editAct.note} onChange={(e) => setEditAct({ id: a.id, note: e.target.value })} autoFocus placeholder="Nội dung chi tiết…" onKeyDown={(e) => { if (e.key === 'Enter') saveActNote(); }} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-[#7c3aed]" />
                                  <button onClick={saveActNote} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold px-2.5 rounded">Lưu</button>
                                  <button onClick={() => setEditAct(null)} className="text-slate-400 text-xs px-1">Huỷ</button>
                                </div>
                              ) : a.note ? (
                                <p className="text-xs text-slate-600 mt-0.5 break-words">{a.note}</p>
                              ) : (
                                <button onClick={() => setEditAct({ id: a.id, note: '' })} className="text-xs text-[#7c3aed] font-semibold mt-0.5">＋ Thêm nội dung chi tiết</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab === 'appt' && (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-sm font-bold text-[#0A2540]">Lịch hẹn công chứng</p>
                        <button onClick={() => setShowAp((v) => !v)} className="text-[#7c3aed] font-bold text-sm">＋ Đặt lịch</button>
                      </div>
                      {showAp && (
                        <div className="bg-slate-50 rounded-lg p-2.5 mb-2 space-y-1.5">
                          <input type="datetime-local" value={ap.appointAt} onChange={(e) => setAp({ ...ap, appointAt: e.target.value })} className={inpc} />
                          <input value={ap.location} onChange={(e) => setAp({ ...ap, location: e.target.value })} placeholder="Văn phòng công chứng" className={inpc} />
                          <input value={ap.note} onChange={(e) => setAp({ ...ap, note: e.target.value })} placeholder="Ghi chú (giấy tờ cần mang…)" className={inpc} />
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><input type="checkbox" checked={ap.smsReminder} onChange={(e) => setAp({ ...ap, smsReminder: e.target.checked })} className="accent-[#7c3aed]" /> 📲 Tự nhắc khách qua SMS trước 24h</label>
                          <div className="flex gap-2">
                            <button onClick={saveAppt} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg text-sm">Lưu lịch</button>
                            <button onClick={() => setShowAp(false)} className="bg-white border border-slate-200 px-4 py-1.5 rounded-lg text-sm">Huỷ</button>
                          </div>
                        </div>
                      )}
                      {detail.appointments.length === 0 && !showAp ? <p className="text-slate-400 text-sm">Chưa có lịch công chứng.</p> : null}
                      <div className="space-y-1.5">
                        {detail.appointments.map((a) => (
                          <div key={a.id} className="bg-slate-50 rounded-lg px-2.5 py-1.5 text-sm">
                            <div className="flex items-center justify-between">
                              <b className="text-blue-800">🗓 {a.appointAt ? new Date(a.appointAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</b>
                              <div className="flex items-center gap-1.5">
                                <select value={a.status || 'Chờ'} onChange={(e) => setApStatus(a.id, e.target.value)} className="text-[11px] border border-slate-200 rounded px-1 py-0.5 bg-white outline-none"><option>Chờ</option><option>Xong</option><option>Huỷ</option></select>
                                <button onClick={() => delAppt(a.id)} className="text-red-400 hover:text-red-600">✕</button>
                              </div>
                            </div>
                            <div className="text-slate-600 text-xs">{a.location ? `📍 ${a.location}` : ''}{(a.features || a.parcel) ? ` · ${a.features || 'Thửa ' + a.parcel}` : ''}{a.note ? ` · ${a.note}` : ''}</div>
                            <button onClick={() => toggleApSms(a)} className={`mt-0.5 text-[11px] font-bold ${a.smsReminder ? 'text-emerald-600' : 'text-slate-400'}`}>📲 SMS nhắc khách: {a.smsReminder ? 'BẬT' : 'tắt'}{a.smsSentAt ? ' · đã gửi' : ''}</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ ic, color, title, count, action }: { ic: string; color: string; title: string; count: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-7 h-7 rounded-lg grid place-items-center text-sm shrink-0" style={{ background: color + '18' }}>{ic}</span>
        <span className="text-sm font-extrabold text-[#0A2540] truncate">{title}</span>
        <span className="text-[11px] font-bold text-white rounded-full px-1.5 min-w-[18px] text-center shrink-0" style={{ background: color }}>{count}</span>
      </div>
      {action}
    </div>
  );
}
