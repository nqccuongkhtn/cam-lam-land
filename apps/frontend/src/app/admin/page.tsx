'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, uploadGis } from '@/lib/api';
import { ImportJob, formatVnd, PROPERTY_LABELS } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

type Tab = 'overview' | 'users' | 'listings' | 'upload' | 'logs';
const TABS: [Tab, string][] = [['overview', 'Tổng quan'], ['users', 'Người dùng'], ['listings', 'Tin đăng'], ['upload', 'Tải GIS'], ['logs', 'Nhật ký']];

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">Đang tải…</div>;
  if (!user) return null;
  if (user.role !== 'admin') return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-xl font-bold text-[#0A2540]">Không có quyền truy cập</p>
      <p className="text-slate-500 mt-2 text-sm">Trang quản trị chỉ dành cho admin. <Link href="/" className="text-[#0A2540] font-semibold underline">Về trang chủ</Link></p>
    </div>
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-[#0A2540]">Bảng điều khiển quản trị</h1>
        <button onClick={() => { logout(); router.replace('/login'); }} className="text-sm text-slate-500 hover:text-slate-800">Đăng xuất</button>
      </div>
      <div className="flex gap-1 border-b mb-5 overflow-x-auto">
        {TABS.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === t ? 'border-[#C8A14B] text-[#0A2540]' : 'border-transparent text-slate-500'}`}>{l}</button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <Users />}
      {tab === 'listings' && <ListingsAdmin />}
      {tab === 'upload' && <UploadGis />}
      {tab === 'logs' && <Logs />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-2xl md:text-3xl font-extrabold text-[#0A2540]">{value}</p><p className="text-sm text-slate-500">{label}</p>{sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}</div>;
}
function Row({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between text-sm py-1 border-b border-slate-50"><span className="text-slate-600">{k}</span><b className="text-[#0A2540]">{v}</b></div>;
}
function Overview() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api('/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return <p className="text-slate-500">Đang tải báo cáo…</p>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Người dùng" value={s.users.total} sub={`${s.users.sales} môi giới · ${s.users.paid} trả phí`} />
        <Stat label="Tin đăng" value={s.listings.total} sub={`${s.listings.active} hiển thị · ${s.listings.boosted} đẩy`} />
        <Stat label="Tổng giá trị tin" value={formatVnd(s.listings.totalValue)} />
        <Stat label="Ảnh trong CSDL" value={s.images.total} sub={`${(Number(s.images.bytes) / 1048576).toFixed(1)} MB`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-[#0A2540] mb-2">Tin theo loại hình</h3>{s.byType.map((r: any) => <Row key={r.type} k={PROPERTY_LABELS[r.type as keyof typeof PROPERTY_LABELS] || r.type} v={r.n} />)}</div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-[#0A2540] mb-2">Tin theo xã</h3>{s.byWard.map((r: any) => <Row key={r.ward} k={r.ward} v={r.n} />)}</div>
      </div>
    </div>
  );
}

function Users() {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => { api<{ users: any[] }>('/admin/users').then((d) => setRows(d.users)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  async function upd(id: number, patch: any) { try { await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); load(); } catch (e: any) { alert(e.message); } }
  const sel = 'border border-slate-300 rounded px-1.5 py-1 text-xs';
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm min-w-[660px]">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Tài khoản</th><th className="p-2">Vai trò</th><th className="p-2">Gói</th><th className="p-2">Trạng thái</th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2"><div className="font-semibold text-[#0A2540]">{u.fullName || u.email}</div><div className="text-xs text-slate-400">{u.email} · {u.phone || '—'}</div></td>
              <td className="p-2"><select value={u.role} onChange={(e) => upd(u.id, { role: e.target.value })} className={sel}><option value="user">Khách</option><option value="sales">Môi giới</option><option value="admin">Admin</option></select></td>
              <td className="p-2"><select value={u.tier} onChange={(e) => upd(u.id, { tier: e.target.value })} className={sel}><option value="free">Free</option><option value="paid">Trả phí</option></select></td>
              <td className="p-2"><select value={u.status} onChange={(e) => upd(u.id, { status: e.target.value })} className={sel}><option value="active">Hoạt động</option><option value="suspended">Khoá</option></select></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="p-4 text-slate-500">Chưa có người dùng.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ListingsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => { api<{ listings: any[] }>('/admin/listings').then((d) => setRows(d.listings)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  async function patch(id: number, p: any) { try { await api(`/admin/listings/${id}`, { method: 'PATCH', body: JSON.stringify(p) }); load(); } catch (e: any) { alert(e.message); } }
  async function del(id: number) { if (!window.confirm('Xoá tin này?')) return; try { await api(`/listings/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); } }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Tin</th><th className="p-2">Trạng thái</th><th className="p-2">Đẩy tin</th><th className="p-2"></th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="p-2"><div className="font-semibold text-[#0A2540] truncate max-w-[280px]">{l.title}</div><div className="text-xs text-slate-400">{formatVnd(l.price)} · {l.ward || 'Cam Lâm'}</div></td>
              <td className="p-2"><select value={l.status} onChange={(e) => patch(l.id, { status: e.target.value })} className="border border-slate-300 rounded px-1.5 py-1 text-xs"><option value="active">Hiển thị</option><option value="pending">Chờ duyệt</option><option value="hidden">Ẩn</option><option value="sold">Đã bán</option></select></td>
              <td className="p-2"><button onClick={() => patch(l.id, { boosted: !l.boosted })} className={`text-xs font-bold px-2.5 py-1 rounded ${l.boosted ? 'bg-[#C8A14B] text-white' : 'bg-slate-100 text-slate-500'}`}>{l.boosted ? '⭐ Đang đẩy' : 'Đẩy tin'}</button></td>
              <td className="p-2 text-right whitespace-nowrap"><Link href={`/listings/${l.id}`} className="text-xs text-[#0A2540] font-semibold mr-3">Xem</Link><button onClick={() => del(l.id)} className="text-xs text-red-600 font-semibold">Xoá</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="p-4 text-slate-500">Chưa có tin nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function UploadGis() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(''); const [layerType, setLayerType] = useState('custom'); const [msg, setMsg] = useState('');
  async function submit() {
    if (!file) return setMsg('Vui lòng chọn tệp .dgn/.shp/.zip/.geojson');
    const fd = new FormData(); fd.append('file', file); fd.append('name', name || file.name); fd.append('layerType', layerType);
    try { const r = await uploadGis(fd); setMsg(`✅ Đã nhận, đang xử lý (job #${r.job.id}). Xem tab Nhật ký.`); } catch (e: any) { setMsg(`❌ ${e.message}`); }
  }
  return (
    <div className="max-w-lg bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="font-bold text-[#0A2540] mb-3">Tải lên dữ liệu GIS</h2>
      <p className="text-sm text-slate-500 mb-3">Hỗ trợ <b>.dgn</b>, <b>.shp</b> (nén .zip), <b>.geojson</b>. Tự chuyển sang EPSG:4326 và hiển thị trên bản đồ.</p>
      <input type="file" accept=".dgn,.shp,.zip,.geojson,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mb-3 block w-full text-sm" />
      <input className="border border-slate-300 rounded-md px-3 py-2 w-full mb-2 text-sm" placeholder="Tên lớp (vd: Quy hoạch 2030)" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="border border-slate-300 rounded-md px-3 py-2 w-full mb-3 text-sm" value={layerType} onChange={(e) => setLayerType(e.target.value)}>
        <option value="parcel">Thửa đất</option><option value="zoning">Quy hoạch</option><option value="admin">Ranh giới hành chính</option><option value="road">Giao thông</option><option value="custom">Khác</option>
      </select>
      <button onClick={submit} className="bg-[#0A2540] hover:bg-[#0d2f54] text-white px-4 py-2 rounded-md text-sm font-semibold">Tải lên & xử lý</button>
      {msg && <p className="text-sm mt-3">{msg}</p>}
    </div>
  );
}

function Logs() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const load = () => api<{ jobs: ImportJob[] }>('/imports').then((d) => setJobs(d.jobs)).catch(() => {});
  useEffect(() => { load(); const i = setInterval(load, 4000); return () => clearInterval(i); }, []);
  const color: Record<string, string> = { done: 'text-emerald-700', error: 'text-red-600', processing: 'text-amber-600', pending: 'text-slate-500' };
  async function del(j: ImportJob) {
    if (!window.confirm(`Xoá "${j.layerName || j.originalFilename}" và lớp dữ liệu của nó?`)) return;
    try { await api(`/imports/${j.id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert('Lỗi xoá: ' + e.message); }
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">#</th><th className="p-2">Tệp</th><th className="p-2">Định dạng</th><th className="p-2">Trạng thái</th><th className="p-2">Features</th><th className="p-2 text-right">Xoá</th></tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t align-top">
              <td className="p-2">{j.id}</td>
              <td className="p-2">{j.originalFilename}<div className="text-xs text-slate-400">{j.layerName}</div></td>
              <td className="p-2 uppercase">{j.sourceFormat}</td>
              <td className={`p-2 font-medium ${color[j.status]}`}>{j.status}</td>
              <td className="p-2">{j.featureCount ?? '—'}</td>
              <td className="p-2 text-right"><button onClick={() => del(j)} className="text-red-600 hover:underline text-xs font-medium">Xoá</button></td>
            </tr>
          ))}
          {jobs.length === 0 && <tr><td colSpan={6} className="p-4 text-slate-500">Chưa có lần nhập nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
