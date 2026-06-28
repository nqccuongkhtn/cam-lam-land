'use client';
import { useEffect, useState, useCallback } from 'react';
import { refreshFlags } from '@/lib/flags';
import { api, uploadGis } from '@/lib/api';
import { ImportJob, formatVnd, PROPERTY_LABELS } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

type Tab = 'overview' | 'users' | 'listings' | 'payments' | 'config' | 'upload' | 'logs';
const TABS: [Tab, string][] = [['overview', 'Tổng quan'], ['users', 'Người dùng'], ['listings', 'Tin đăng'], ['payments', 'Thanh toán'], ['config', 'Cấu hình'], ['upload', 'Tải GIS'], ['logs', 'Nhật ký']];

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  useEffect(() => { if (user?.role === 'gis') setTab('upload'); }, [user]);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">Đang tải…</div>;
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'gis') return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-xl font-bold text-[#0A2540]">Không có quyền truy cập</p>
      <p className="text-slate-500 mt-2 text-sm">Trang này chỉ dành cho admin / biên tập GIS. <Link href="/" className="text-[#0A2540] font-semibold underline">Về trang chủ</Link></p>
    </div>
  );
  const isGis = user.role === 'gis';
  const shownTabs = isGis ? TABS.filter(([t]) => t === 'upload' || t === 'logs') : TABS;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-[#0A2540]">{isGis ? 'Quản lý bản đồ GIS' : 'Bảng điều khiển quản trị'}</h1>
        <button onClick={() => { logout(); router.replace('/login'); }} className="text-sm text-slate-500 hover:text-slate-800">Đăng xuất</button>
      </div>
      <div className="flex gap-1 border-b mb-5 overflow-x-auto">
        {shownTabs.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === t ? 'border-[#C8A14B] text-[#0A2540]' : 'border-transparent text-slate-500'}`}>{l}</button>
        ))}
      </div>
      {tab === 'overview' && !isGis && <Overview />}
      {tab === 'users' && !isGis && <Users />}
      {tab === 'listings' && !isGis && <ListingsAdmin />}
      {tab === 'payments' && !isGis && <Payments />}
      {tab === 'config' && !isGis && <Config />}
      {tab === 'upload' && <UploadGis />}
      {tab === 'logs' && <Logs />}
    </div>
  );
}

function Config() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState('');
  const [newsMsg, setNewsMsg] = useState('');
  const load = useCallback(() => { api<{ flags: Record<string, boolean> }>('/flags').then((r) => setFlags(r.flags || {})).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  async function toggle(key: string, on: boolean) {
    setBusy(key);
    try { await api('/flags', { method: 'POST', body: JSON.stringify({ key, on }) }); setFlags((f) => ({ ...f, [key]: on })); refreshFlags(); }
    catch (e: any) { const m = String(e?.message || ''); alert(/404|không tìm/i.test(m) ? 'Máy chủ chưa có tính năng này — cần rebuild lại camlam-api rồi thử lại.' : 'Lỗi: ' + m); } finally { setBusy(''); }
  }
  async function doRefreshNews() {
    setNewsMsg('Đang lấy tin…');
    try { const r = await api<{ count: number }>('/news/refresh', { method: 'POST' }); setNewsMsg(`✓ Đã cập nhật ${r.count} tin BĐS.`); }
    catch (e: any) { const m = String(e?.message || ''); setNewsMsg(/404|không tìm/i.test(m) ? '✗ Máy chủ chưa có tính năng — cần rebuild lại camlam-api.' : '✗ ' + m); }
  }
  const ITEMS: [string, string, string][] = [
    ['services_live', 'Trang Dịch vụ & Bảng giá (/dichvu)', 'Hiện trang bảng giá, các ô “mua/nâng gói”, banner quảng cáo trang chủ và quảng cáo 2 bên. Tắt = khách thấy “Sắp ra mắt”, admin vẫn xem trước được.'],
  ];
  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-sm text-slate-500">Bật/tắt các tính năng <b>chưa triển khai</b>. Khi tắt, khách không thấy; bạn (admin) vẫn xem trước được để kiểm tra.</p>
      {ITEMS.map(([key, title, desc]) => (
        <div key={key} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-[#0A2540]">{title}</p>
            <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
          </div>
          <button onClick={() => toggle(key, !flags[key])} disabled={busy === key} aria-label="Bật/tắt"
            className={`shrink-0 w-14 h-8 rounded-full transition relative ${flags[key] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${flags[key] ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      ))}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="font-bold text-[#0A2540]">📰 Tin tức thị trường (trang chủ)</p>
        <p className="text-sm text-slate-500 mt-0.5">Tự lấy bài BĐS từ nguồn uy tín (VnExpress, CafeF…) mỗi 6 giờ. Bấm để cập nhật ngay.</p>
        <button onClick={doRefreshNews} className="mt-3 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-4 py-2 rounded-xl text-sm">Cập nhật tin ngay</button>
        {newsMsg && <p className="text-xs text-slate-600 mt-2 font-medium">{newsMsg}</p>}
      </div>
      <p className="text-xs text-slate-400">{flags.services_live ? '🟢 Dịch vụ đang công khai với khách.' : '🔒 Dịch vụ đang ẩn — chỉ admin xem được.'}</p>
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
        <Stat label="Người dùng" value={s.users.total} sub={`${s.users.gis} biên tập GIS · ${s.users.paid} trả phí`} />
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
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Tài khoản</th><th className="p-2">Vai trò</th><th className="p-2">Gói</th><th className="p-2">Trạng thái</th><th className="p-2">Gói đẩy/th</th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2"><div className="font-semibold text-[#0A2540]">{u.fullName || u.email}</div><div className="text-xs text-slate-400">{u.email} · {u.phone || '—'}</div></td>
              <td className="p-2"><select value={u.role} onChange={(e) => upd(u.id, { role: e.target.value })} className={sel}><option value="user">Khách</option><option value="gis">Biên tập GIS</option><option value="admin">Admin</option></select></td>
              <td className="p-2"><select value={u.tier} onChange={(e) => upd(u.id, { tier: e.target.value })} className={sel}><option value="free">Free</option><option value="paid">Trả phí</option></select></td>
              <td className="p-2"><select value={u.status} onChange={(e) => upd(u.id, { status: e.target.value })} className={sel}><option value="active">Hoạt động</option><option value="suspended">Khoá</option></select></td>
              <td className="p-2"><input type="number" min="0" defaultValue={u.boostQuota ?? 0} onBlur={(e) => upd(u.id, { boostQuota: Math.max(0, Number(e.target.value) || 0) })} title="Số lượt đẩy tin/tháng" className="w-16 border border-slate-300 rounded px-1.5 py-1 text-xs" /></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-slate-500">Chưa có người dùng.</td></tr>}
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
              <td className="p-2 whitespace-nowrap"><select value={l.tier || 'normal'} onChange={(e) => patch(l.id, { tier: e.target.value })} className="border border-slate-300 rounded px-1.5 py-1 text-xs"><option value="normal">Thường</option><option value="silver">VIP Bạc</option><option value="gold">VIP Vàng</option><option value="diamond">VIP Kim cương</option></select><button onClick={() => patch(l.id, { bump: true })} title="Đẩy lên đầu" className="ml-1.5 text-xs font-bold px-2 py-1 rounded bg-[#0A2540] text-white hover:bg-[#0d2f54]">↑ Đẩy</button></td>
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
    setMsg('⏳ Đang nạp…');
    try { const r = await uploadGis(fd); setMsg(`✅ ${r.message || 'Đã nạp xong'}${r.reprojected ? ' (tự quy đổi VN-2000→WGS84)' : ''}. Mở trang Bản đồ để xem.`); setFile(null); } catch (e: any) { setMsg(`❌ ${e.message}`); }
  }
  return (
    <div className="max-w-lg bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="font-bold text-[#0A2540] mb-3">Tải lên dữ liệu GIS</h2>
      <p className="text-sm text-slate-500 mb-3">Nạp trực tiếp <b>.geojson</b> hoặc <b>Shapefile nén .zip</b> — toạ độ <b>VN-2000/WGS84</b> đều được (tự quy đổi). DGN: xuất sang SHP/GeoJSON trước.</p>
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
          {jobs.length === 0 && <tr><td colSpan={6} className="p-4 text-slate-500">Chưa có job nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Payments() {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => { api<{ payments: any[] }>('/payments').then((d) => setRows(d.payments || [])).catch(() => {}); }, []);
  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);
  async function confirm(id: number) { if (!window.confirm('Xác nhận đã nhận tiền & kích hoạt gói cho khách?')) return; try { await api(`/payments/${id}/confirm`, { method: 'POST' }); load(); } catch (e: any) { alert(e.message); } }
  const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + 'đ';
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">#</th><th className="p-2">Khách</th><th className="p-2">Gói</th><th className="p-2">Số tiền</th><th className="p-2">Nội dung CK</th><th className="p-2">Trạng thái</th><th className="p-2"></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.id}</td>
              <td className="p-2"><div className="font-semibold text-[#0A2540]">{p.userName}</div><div className="text-xs text-slate-400">{p.email}</div></td>
              <td className="p-2 uppercase">{p.packageId}</td>
              <td className="p-2 font-bold text-red-600">{fmt(p.amount)}</td>
              <td className="p-2 font-mono text-xs">{p.note}</td>
              <td className={`p-2 font-semibold ${p.status === 'paid' ? 'text-emerald-700' : 'text-amber-600'}`}>{p.status === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}</td>
              <td className="p-2 text-right">{p.status !== 'paid' && <button onClick={() => confirm(p.id)} className="text-xs font-bold text-white bg-[#0A2540] hover:bg-[#0d2f54] rounded px-2.5 py-1">✓ Xác nhận</button>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-slate-500">Chưa có đơn nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
