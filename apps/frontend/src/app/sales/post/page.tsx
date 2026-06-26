'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, uploadImages } from '@/lib/api';
import { resizeImage } from '@/lib/img';
import { useAuth } from '@/lib/auth';
import { PROPERTY_LABELS, WARDS, DIRECTIONS, LEGAL_OPTIONS, formatVnd, type PropertyType } from '@/lib/types';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const TYPES: PropertyType[] = ['land', 'house', 'apartment', 'villa', 'commercial', 'farm'];

export default function PostListing() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [f, setF] = useState({ title: '', propertyType: 'land' as PropertyType, priceVal: '', priceUnit: 'ty', area: '', bedrooms: '', bathrooms: '', direction: '', legal: '', frontage: '', ward: '', address: '', description: '', contactName: '', contactPhone: '' });
  const [images, setImages] = useState<string[]>([]);
  const [coord, setCoord] = useState<{ lng: number; lat: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setErr('');
    try {
      const resized = await Promise.all(files.map((x) => resizeImage(x)));
      const up = await uploadImages(resized);
      setImages((p) => [...p, ...up.map((u) => u.url)]);
    } catch (e: any) { setErr('Lỗi tải ảnh: ' + e.message); } finally { setUploading(false); e.target.value = ''; }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!f.title.trim()) return setErr('Nhập tiêu đề tin.');
    if (!f.priceVal) return setErr('Nhập giá.');
    if (!coord) return setErr('Bấm vào bản đồ để chọn vị trí cho tin đăng.');
    const price = Number(f.priceVal) * (f.priceUnit === 'ty' ? 1e9 : 1e6);
    setBusy(true);
    try {
      await api('/listings', { method: 'POST', body: JSON.stringify({
        title: f.title, propertyType: f.propertyType, price, area: f.area ? Number(f.area) : null,
        bedrooms: f.bedrooms ? Number(f.bedrooms) : null, bathrooms: f.bathrooms ? Number(f.bathrooms) : null,
        direction: f.direction || null, legal: f.legal || null, frontage: f.frontage ? Number(f.frontage) : null,
        ward: f.ward || null, address: f.address || null, description: f.description || null,
        contactName: f.contactName || user?.fullName || null, contactPhone: f.contactPhone || user?.phone || null,
        images, lng: coord.lng, lat: coord.lat,
      }) });
      router.push('/sales');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (loading || !user) return <div className="py-24 text-center text-slate-500">Đang tải…</div>;

  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#0A2540] outline-none';
  const lbl = 'block text-sm font-semibold text-slate-700 mb-1';
  const priceVnd = f.priceVal ? formatVnd(Number(f.priceVal) * (f.priceUnit === 'ty' ? 1e9 : 1e6)) : '';

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)] py-8">
      <form onSubmit={submit} className="mx-auto max-w-3xl px-4 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-[#0A2540]">Đăng tin bất động sản</h1>
          <Link href="/sales" className="text-sm font-semibold text-slate-500 hover:text-[#0A2540]">← Tin của tôi</Link>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-[#0A2540]">Thông tin chính</h2>
          <div><label className={lbl}>Tiêu đề *</label><input className={inp} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="VD: Đất nền ven biển Bãi Dài, sổ đỏ" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Loại hình *</label>
              <select className={inp} value={f.propertyType} onChange={(e) => set('propertyType', e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{PROPERTY_LABELS[t]}</option>)}</select></div>
            <div><label className={lbl}>Diện tích (m²)</label><input className={inp} type="number" value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="250" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Giá *</label>
              <div className="flex gap-2">
                <input className={inp} type="number" step="0.01" value={f.priceVal} onChange={(e) => set('priceVal', e.target.value)} placeholder="2.8" />
                <select className="border border-slate-300 rounded-lg px-2 text-sm" value={f.priceUnit} onChange={(e) => set('priceUnit', e.target.value)}><option value="ty">Tỷ</option><option value="trieu">Triệu</option></select>
              </div>
              {priceVnd && <p className="text-xs text-[#C8A14B] font-semibold mt-1">= {priceVnd}</p>}
            </div>
            <div><label className={lbl}>Mặt tiền (m)</label><input className={inp} type="number" step="0.1" value={f.frontage} onChange={(e) => set('frontage', e.target.value)} placeholder="5" /></div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-[#0A2540]">Chi tiết</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Phòng ngủ</label><input className={inp} type="number" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} /></div>
            <div><label className={lbl}>Phòng tắm</label><input className={inp} type="number" value={f.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} /></div>
            <div><label className={lbl}>Hướng</label><select className={inp} value={f.direction} onChange={(e) => set('direction', e.target.value)}><option value="">— Chọn —</option>{DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
            <div><label className={lbl}>Pháp lý</label><select className={inp} value={f.legal} onChange={(e) => set('legal', e.target.value)}><option value="">— Chọn —</option>{LEGAL_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-[#0A2540]">Vị trí</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Xã / Phường</label><select className={inp} value={f.ward} onChange={(e) => set('ward', e.target.value)}><option value="">— Chọn xã —</option>{WARDS.map((w) => <option key={w} value={w}>{w}</option>)}</select></div>
            <div><label className={lbl}>Địa chỉ cụ thể</label><input className={inp} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Đường, thôn…" /></div>
          </div>
          <div>
            <label className={lbl}>Ghim vị trí trên bản đồ * <span className="font-normal text-slate-400">(bấm vào bản đồ)</span></label>
            <div className="relative h-72 rounded-xl overflow-hidden border border-slate-200">
              <MapView markers={coord ? [{ lng: coord.lng, lat: coord.lat }] : []} baseMap="satellite" onMapClick={(lng, lat) => setCoord({ lng, lat })} className="absolute inset-0 h-full w-full" />
              <div className="absolute top-2 left-2 z-10 bg-white/95 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow">
                {coord ? <span className="text-emerald-700">✓ Đã ghim: {coord.lat.toFixed(5)}, {coord.lng.toFixed(5)}</span> : <span className="text-slate-500">Bấm vào bản đồ để chọn vị trí</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-bold text-[#0A2540]">Hình ảnh</h2>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-6 cursor-pointer hover:border-[#C8A14B] text-sm text-slate-500 font-semibold">
            <input type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />
            {uploading ? 'Đang tải ảnh…' : '＋ Chọn ảnh từ máy (tải lên trực tiếp)'}
          </label>
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((u) => (
                <div key={u} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setImages((p) => p.filter((x) => x !== u))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs grid place-items-center">✕</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-[#0A2540]">Mô tả & liên hệ</h2>
          <textarea className={`${inp} min-h-[120px]`} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Mô tả chi tiết bất động sản…" />
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Tên liên hệ</label><input className={inp} value={f.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder={user.fullName || ''} /></div>
            <div><label className={lbl}>SĐT liên hệ</label><input className={inp} value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder={user.phone || '09xxxxxxxx'} /></div>
          </div>
        </section>

        {err && <p className="text-red-600 text-sm font-semibold">{err}</p>}
        <div className="flex gap-3 pb-10">
          <button disabled={busy || uploading} className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-red-600/30">{busy ? 'Đang đăng…' : 'Đăng tin'}</button>
          <Link href="/sales" className="px-6 py-3 rounded-xl border border-slate-300 font-semibold text-slate-600">Huỷ</Link>
        </div>
      </form>
    </div>
  );
}
