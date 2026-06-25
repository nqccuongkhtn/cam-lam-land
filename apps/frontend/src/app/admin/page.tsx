'use client';
import { useEffect, useState } from 'react';
import { api, uploadGis } from '@/lib/api';
import { Listing, ImportJob, formatVnd } from '@/lib/types';

type Tab = 'upload' | 'logs' | 'listings';

export default function Admin() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('upload');

  useEffect(() => { setToken(localStorage.getItem('camlam_token')); }, []);

  if (token === null) return <Login onLogin={(t) => { localStorage.setItem('camlam_token', t); setToken(t); }} />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Bảng điều khiển quản trị</h1>
        <button onClick={() => { localStorage.removeItem('camlam_token'); setToken(null); }}
          className="text-sm text-slate-500 hover:text-slate-800">Đăng xuất</button>
      </div>
      <div className="flex gap-2 border-b mb-5">
        {(['upload', 'logs', 'listings'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'}`}>
            {t === 'upload' ? 'Tải lớp GIS' : t === 'logs' ? 'Nhật ký xử lý' : 'Quản lý tin'}
          </button>
        ))}
      </div>
      {tab === 'upload' && <UploadGis />}
      {tab === 'logs' && <Logs />}
      {tab === 'listings' && <Listings />}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (t: string) => void }) {
  const [email, setEmail] = useState('admin@camlam.local');
  const [password, setPassword] = useState('admin12345');
  const [err, setErr] = useState('');
  async function submit() {
    try { const r = await api<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); onLogin(r.token); }
    catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-bold mb-4">Đăng nhập quản trị</h1>
      <input className="border rounded-md px-3 py-2 w-full mb-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input className="border rounded-md px-3 py-2 w-full mb-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" />
      {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
      <button onClick={submit} className="bg-emerald-600 text-white w-full py-2 rounded-md font-medium">Đăng nhập</button>
      <p className="text-xs text-slate-400 mt-3">Tài khoản mặc định: admin@camlam.local / admin12345</p>
    </div>
  );
}

function UploadGis() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [layerType, setLayerType] = useState('custom');
  const [msg, setMsg] = useState('');
  async function submit() {
    if (!file) return setMsg('Vui lòng chọn tệp .dgn/.shp/.zip/.geojson');
    const fd = new FormData();
    fd.append('file', file); fd.append('name', name || file.name); fd.append('layerType', layerType);
    try { const r = await uploadGis(fd); setMsg(`✅ Đã nhận, đang xử lý (job #${r.job.id}). Xem tab "Nhật ký xử lý".`); }
    catch (e: any) { setMsg(`❌ ${e.message}`); }
  }
  return (
    <div className="max-w-lg bg-white border rounded-xl p-5">
      <h2 className="font-semibold mb-3">Tải lên dữ liệu GIS</h2>
      <p className="text-sm text-slate-500 mb-3">Hỗ trợ <b>.dgn</b>, <b>.shp</b> (nén .zip), <b>.geojson</b>. Hệ thống tự chuyển đổi sang EPSG:4326 và hiển thị trên bản đồ.</p>
      <input type="file" accept=".dgn,.shp,.zip,.geojson,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mb-3 block w-full text-sm" />
      <input className="border rounded-md px-3 py-2 w-full mb-2 text-sm" placeholder="Tên lớp (vd: Quy hoạch 2030)" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="border rounded-md px-3 py-2 w-full mb-3 text-sm" value={layerType} onChange={(e) => setLayerType(e.target.value)}>
        <option value="parcel">Thửa đất (parcel)</option>
        <option value="zoning">Quy hoạch (zoning)</option>
        <option value="admin">Ranh giới hành chính (admin)</option>
        <option value="road">Giao thông (road)</option>
        <option value="custom">Khác (custom)</option>
      </select>
      <button onClick={submit} className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium">Tải lên & xử lý</button>
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
    if (!window.confirm(`Xoá "${j.layerName || j.originalFilename}" và lớp dữ liệu của nó khỏi bản đồ?`)) return;
    try { await api(`/imports/${j.id}`, { method: 'DELETE' }); load(); }
    catch (e: any) { alert('Lỗi xoá: ' + e.message); }
  }
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr><th className="p-2">#</th><th className="p-2">Tệp</th><th className="p-2">Định dạng</th><th className="p-2">Trạng thái</th><th className="p-2">Features</th><th className="p-2">Cập nhật</th><th className="p-2 text-right">Xoá</th></tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t align-top">
              <td className="p-2">{j.id}</td>
              <td className="p-2">{j.originalFilename}<div className="text-xs text-slate-400">{j.layerName}</div></td>
              <td className="p-2 uppercase">{j.sourceFormat}</td>
              <td className={`p-2 font-medium ${color[j.status]}`}>{j.status}</td>
              <td className="p-2">{j.featureCount ?? '—'}</td>
              <td className="p-2 text-xs text-slate-400">{new Date(j.updatedAt).toLocaleTimeString('vi-VN')}</td>
              <td className="p-2 text-right">
                <button onClick={() => del(j)} title="Xoá lớp & bản ghi này"
                  className="text-red-600 hover:text-red-700 hover:underline text-xs font-medium">Xoá</button>
              </td>
            </tr>
          ))}
          {jobs.length === 0 && <tr><td colSpan={7} className="p-4 text-slate-500">Chưa có lần nhập nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Listings() {
  const [items, setItems] = useState<Listing[]>([]);
  const [form, setForm] = useState({ title: '', price: '', area: '', propertyType: 'land', ward: '', lng: '109.0917', lat: '12.0771', image: '', description: '' });
  const load = () => api<{ listings: Listing[] }>('/listings?limit=200').then((d) => setItems(d.listings)).catch(() => {});
  useEffect(() => { load(); }, []);
  async function create() {
    await api('/listings', { method: 'POST', body: JSON.stringify({
      title: form.title, description: form.description, price: Number(form.price) * 1e9, area: Number(form.area) || null,
      propertyType: form.propertyType, ward: form.ward, lng: Number(form.lng), lat: Number(form.lat),
      images: form.image ? [form.image] : [],
    }) });
    setForm({ ...form, title: '', price: '', area: '', description: '', image: '' }); load();
  }
  async function del(id: number) { await api(`/listings/${id}`, { method: 'DELETE' }); load(); }
  return (
    <div className="grid md:grid-cols-3 gap-5">
      <div className="md:col-span-2 bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Tiêu đề</th><th className="p-2">Giá</th><th className="p-2">Loại</th><th className="p-2"></th></tr></thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-2">{l.title}</td><td className="p-2">{formatVnd(l.price)}</td><td className="p-2">{l.propertyType}</td>
                <td className="p-2 text-right"><button onClick={() => del(l.id)} className="text-red-600 text-xs">Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold mb-2">Thêm tin mới</h3>
        {[['title','Tiêu đề'],['price','Giá (tỷ)'],['area','Diện tích m²'],['ward','Phường/xã'],['lng','Kinh độ (lng)'],['lat','Vĩ độ (lat)'],['image','URL ảnh']].map(([k,label]) => (
          <input key={k} className="border rounded-md px-2 py-1.5 w-full mb-2 text-sm" placeholder={label}
            value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        ))}
        <select className="border rounded-md px-2 py-1.5 w-full mb-2 text-sm" value={form.propertyType} onChange={(e)=>setForm({...form,propertyType:e.target.value})}>
          {['land','house','apartment','villa','commercial','farm'].map((t)=><option key={t} value={t}>{t}</option>)}
        </select>
        <textarea className="border rounded-md px-2 py-1.5 w-full mb-2 text-sm" placeholder="Mô tả" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} />
        <button onClick={create} className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm w-full font-medium">Lưu tin</button>
      </div>
    </div>
  );
}
