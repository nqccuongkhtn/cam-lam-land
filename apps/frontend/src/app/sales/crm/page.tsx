'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { getStats, getBoard, listAppointments, updateInterest, removeInterest, type CrmStats, type Interest, type Appointment } from '@/lib/crm';

const STATUSES = ['Mới', 'Đang tư vấn', 'Thương lượng', 'Đã chốt', 'Không thành'];
const dealColor = (s?: string | null) => s === 'Đã chốt' ? '#16a34a' : s === 'Thương lượng' ? '#ea580c' : s === 'Đang tư vấn' ? '#0891b2' : s === 'Không thành' ? '#9ca3af' : '#7c3aed';
const titleOf = (it: Interest) => it.features || (it.parcel ? `Thửa ${it.parcel}${it.sheet ? ', Tờ ' + it.sheet : ''}` : 'Tin BĐS');
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('vi-VN') : '';
const bucketOf = (s?: string | null) => (STATUSES.includes(s || '') ? (s as string) : 'Mới');

export default function CrmBoardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [items, setItems] = useState<Interest[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [adminAll, setAdminAll] = useState(false);

  const load = () => { getStats(adminAll).then(setStats).catch(() => { }); getBoard(adminAll).then(setItems).catch(() => setItems([])); listAppointments(adminAll).then(setAppts).catch(() => setAppts([])); };
  useEffect(() => { if (user) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, adminAll]);

  async function move(it: Interest, dealStatus: string) { try { await updateInterest(it.id, { dealStatus }); load(); } catch (e: any) { alert(e.message); } }
  async function setFollow(it: Interest, date: string) { try { await updateInterest(it.id, { followUpAt: date ? new Date(date).toISOString() : null }); load(); } catch (e: any) { alert(e.message); } }
  async function del(id: number) { if (!confirm('Xoá quan tâm này?')) return; try { await removeInterest(id); load(); } catch (e: any) { alert(e.message); } }

  if (!user) return <div className="max-w-md mx-auto py-24 text-center text-slate-500">Vui lòng <Link href="/login" className="text-[#7c3aed] font-bold">đăng nhập</Link> để dùng CRM.</div>;

  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const due = items.filter((it) => it.followUpAt && new Date(it.followUpAt) <= endToday && it.dealStatus !== 'Đã chốt' && it.dealStatus !== 'Không thành');
  const upAppts = appts.filter((a) => (a.status || 'Chờ') === 'Chờ');
  const statCount = (s: string) => stats?.byStatus.find((x) => x.status === s)?.n ?? 0;

  const Card = ({ it }: { it: Interest }) => (
    <div className="bg-white rounded-lg border border-slate-200 p-2 text-xs shadow-sm">
      <p className="font-bold text-[#0A2540] line-clamp-1">{titleOf(it)}</p>
      <p className="text-slate-500">{it.price ? <b className="text-red-600">{it.price}</b> : null}{it.area ? ` · ${it.area}m²` : ''}{it.ward ? ` · ${it.ward}` : ''}</p>
      <p className="mt-0.5">🧑 Khách: <b>{it.custName || '—'}</b>{it.custPhone ? <> · <a href={`tel:${it.custPhone}`} className="text-emerald-600 font-semibold">{it.custPhone}</a></> : null}{it.interest ? <span className="ml-1 text-[9px] font-bold text-amber-600">Quan tâm {it.interest}</span> : null}</p>
      {adminAll && it.salesName ? <p className="text-[10px] text-slate-400">👤 Sales: {it.salesName}</p> : null}
      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-[10px] text-slate-500 font-bold shrink-0">Giai đoạn:</span>
        <select value={bucketOf(it.dealStatus)} onChange={(e) => move(it, e.target.value)} className="flex-1 min-w-0 border border-slate-200 rounded px-1 py-1 text-[11px] bg-white outline-none" style={{ color: dealColor(it.dealStatus) }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => del(it.id)} className="text-red-400 hover:text-red-600">✕</button>
      </div>
      <label className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">📅 Hẹn gọi lại:
        <input type="date" value={it.followUpAt ? new Date(it.followUpAt).toISOString().slice(0, 10) : ''} onChange={(e) => setFollow(it, e.target.value)} className="border border-slate-200 rounded px-1 py-0.5 text-[10px] outline-none" />
      </label>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <div className="flex items-center gap-2 mb-3">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#0A2540]">Pipeline chốt deal</h1>
            <p className="text-xs text-slate-500">Mỗi thẻ là 1 khách quan tâm 1 tin. Đổi ô “Giai đoạn” trong thẻ để chuyển cột (Mới → … → Đã chốt).</p>
          </div>
          {user.role === 'admin' && (
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-600 cursor-pointer bg-white border border-slate-200 rounded-full px-2.5 py-1.5"><input type="checkbox" checked={adminAll} onChange={(e) => setAdminAll(e.target.checked)} className="accent-[#7c3aed]" /> Toàn đội</label>
          )}
          <div className="ml-auto inline-flex rounded-full bg-white border border-slate-200 p-1 text-xs sm:text-sm font-bold shrink-0">
            <Link href="/sales/khach" className="px-2.5 sm:px-3.5 py-1 rounded-full text-slate-600 hover:text-[#0A2540]">Khách hàng</Link>
            <span className="px-2.5 sm:px-3.5 py-1 rounded-full bg-[#7c3aed] text-white">Pipeline</span>
          </div>
        </div>

        {/* Dashboard tổng hợp */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          {[['Khách', stats?.customers ?? 0, '#0A2540'], ['Nhu cầu', stats?.needs ?? 0, '#d97706'], ['Quan tâm', stats?.interests ?? 0, '#7c3aed'],
          ['Mới', statCount('Mới'), dealColor('Mới')], ['Thương lượng', statCount('Thương lượng'), dealColor('Thương lượng')],
          ['Đã chốt', stats?.closed ?? 0, '#16a34a'], ['Cần chăm', stats?.dueFollow ?? 0, '#dc2626']].map(([label, n, color]) => (
            <div key={label as string} className="bg-white rounded-xl border border-slate-200 p-2 sm:p-2.5 text-center">
              <div className="text-xl sm:text-2xl font-extrabold" style={{ color: color as string }}>{n as number}</div>
              <div className="text-[11px] text-slate-500 font-semibold">{label as string}</div>
            </div>
          ))}
        </div>

        {/* Cần chăm hôm nay */}
        {due.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-sm font-extrabold text-red-600 mb-2">🔔 Cần chăm hôm nay / quá hạn ({due.length})</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {due.map((it) => (
                <div key={it.id} className="bg-white rounded-lg border border-red-100 p-2 text-xs flex items-center justify-between">
                  <div className="min-w-0"><b className="text-[#0A2540] line-clamp-1">{it.custName || 'Khách'}</b><span className="text-slate-500 line-clamp-1">{titleOf(it)} · hẹn {fmtDate(it.followUpAt)}</span></div>
                  {it.custPhone ? <a href={`tel:${it.custPhone}`} className="shrink-0 bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-lg">📞 Gọi</a> : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lịch công chứng sắp tới */}
        {upAppts.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
            <p className="text-sm font-extrabold text-blue-700 mb-2">🗓 Lịch công chứng sắp tới ({upAppts.length})</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {upAppts.slice(0, 12).map((a) => (
                <div key={a.id} className="bg-white rounded-lg border border-blue-100 p-2 text-xs">
                  <b className="text-blue-800">{a.appointAt ? new Date(a.appointAt).toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</b>
                  <div className="text-slate-600 line-clamp-1">🧑 {a.custName || 'Khách'}{a.custPhone ? <> · <a href={`tel:${a.custPhone}`} className="text-emerald-600 font-semibold">{a.custPhone}</a></> : null}</div>
                  <div className="text-slate-500 line-clamp-1">{a.location ? '📍 ' + a.location : ''}{a.smsReminder ? ' · 📲 SMS' : ''}{adminAll && a.salesName ? ' · 👤 ' + a.salesName : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bảng Kanban theo trạng thái */}
        <div className="flex gap-2.5 overflow-x-auto pb-3">
          {STATUSES.map((col) => {
            const list = items.filter((it) => bucketOf(it.dealStatus) === col);
            return (
              <div key={col} className="w-64 shrink-0">
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <span className="text-sm font-extrabold" style={{ color: dealColor(col) }}>{col}</span>
                  <span className="text-xs font-bold text-white rounded-full px-2" style={{ backgroundColor: dealColor(col) }}>{list.length}</span>
                </div>
                <div className="space-y-2 bg-slate-100 rounded-xl p-2 min-h-[60px]">
                  {list.map((it) => <Card key={it.id} it={it} />)}
                  {list.length === 0 ? <p className="text-[11px] text-slate-400 text-center py-2">—</p> : null}
                </div>
              </div>
            );
          })}
        </div>
        {items.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">Chưa có khách quan tâm nào. Vào bản đồ tin lưu → bấm 1 tin → ＋ Thêm khách.</p> : null}
      </div>
    </div>
  );
}
