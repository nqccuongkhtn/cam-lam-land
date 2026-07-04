'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, uploadImages } from '@/lib/api';
import { resizeImage } from '@/lib/img';
import { useAuth } from '@/lib/auth';
import { useFlags } from '@/lib/flags';
import { PROPERTY_LABELS, WARDS, DIRECTIONS, LEGAL_OPTIONS, formatVnd, priceLabel, SALE_PROPERTY_TYPES, RENT_PROPERTY_TYPES, type PropertyType, type DealType } from '@/lib/types';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function PostListing() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { flags } = useFlags();
  const [f, setF] = useState({ title: '', deal: 'sale' as DealType, propertyType: 'land' as PropertyType, priceVal: '', priceUnit: 'ty', area: '', bedrooms: '', bathrooms: '', direction: '', legal: '', frontage: '', ward: '', address: '', description: '', contactName: '' });
  const TYPES = f.deal === 'rent' ? RENT_PROPERTY_TYPES : SALE_PROPERTY_TYPES;
  const setDeal = (deal: DealType) => setF((s) => ({ ...s, deal, propertyType: (deal === 'rent' ? RENT_PROPERTY_TYPES : SALE_PROPERTY_TYPES)[0], priceUnit: deal === 'rent' ? 'trieu' : 'ty' }));
  const [images, setImages] = useState<string[]>([]);
  const [coord, setCoord] = useState<{ lng: number; lat: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
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
    const priceNum = Number(f.priceVal);
    if (!f.priceVal || !(priceNum > 0)) return setErr('Giá phải lớn hơn 0.');
    if (!coord) return setErr('Bấm vào bản đồ để chọn vị trí cho tin đăng.');
    const price = priceNum * (f.priceUnit === 'ty' ? 1e9 : 1e6);
    setBusy(true);
    try {
      await api('/listings', { method: 'POST', body: JSON.stringify({
        title: f.title, deal: f.deal, propertyType: f.propertyType, price, area: f.area ? Number(f.area) : null,
        bedrooms: f.bedrooms ? Number(f.bedrooms) : null, bathrooms: f.bathrooms ? Number(f.bathrooms) : null,
        direction: f.direction || null, legal: f.legal || null, frontage: f.frontage ? Number(f.frontage) : null,
        ward: f.ward || null, address: f.address || null, description: f.description || null,
        contactName: f.contactName || user?.fullName || null, contactPhone: null,
        images, lng: coord.lng, lat: coord.lat,
      }) });
      router.push('/sales');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (loading || !user) return <div className="py-24 text-center text-slate-500">Đang tải…</div>;

  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#0A2540] outline-none';
  const lbl = 'block text-sm font-semibold text-slate-700 mb-1';
  async function aiDescribe() {
    setAiBusy(true);
    try {
      const price = f.priceVal ? `${f.priceVal} ${f.priceUnit === 'ty' ? 'tỷ' : 'triệu'}` : '';
      const r = await fetch('/feed/ai/describe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: f.title, propertyType: PROPERTY_LABELS[f.propertyType], price, area: f.area, ward: f.ward, address: f.address, direction: f.direction, legal: f.legal, bedrooms: f.bedrooms, bathrooms: f.bathrooms, frontage: f.frontage }) });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Không tạo được mô tả.'); return; }
      set('description', d.description);
    } catch { alert('Lỗi kết nối, thử lại.'); } finally { setAiBusy(false); }
  }
  const priceTotal = f.priceVal ? Number(f.priceVal) * (f.priceUnit === 'ty' ? 1e9 : 1e6) : 0;
  const priceVnd = priceTotal > 0 ? priceLabel(priceTotal, f.deal) : '';
  const perM2 = priceTotal > 0 && Number(f.area) > 0 && f.deal !== 'rent' ? formatVnd(priceTotal / Number(f.area)) : '';

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)] py-8">
      <form onSubmit={submit} className="mx-auto max-w-3xl px-4 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-[#0A2540]">Đăng tin bất động sản</h1>
          <Link href="/sales" className="text-sm font-semibold text-slate-500 hover:text-[#0A2540]">← Tin của tôi</Link>
        </div>

        {flags.services_live && (
        <Link href="/dichvu" className="block bg-gradient-to-r from-[#0A2540] to-[#10355f] text-white rounded-2xl p-4 hover:brightness-110 transition">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">🚀 Đăng nhiều tin hơn & đẩy tin lên VIP</p>
              <p className="text-sm text-slate-300 mt-0.5">Miễn phí 1 tin/tháng — mua gói để đăng thêm và làm nổi bật tin.</p>
            </div>
            <span className="bg-[#C8A14B] text-[#0A2540] font-bold px-4 py-2 rounded-xl whitespace-nowrap shrink-0">Xem bảng giá →</span>
          </div>
        </Link>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-[#0A2540]">Thông tin chính</h2>
          <div>
            <label className={lbl}>Nhu cầu *</label>
            <div className="inline-flex rounded-xl border border-slate-300 overflow-hidden">
              <button type="button" onClick={() => setDeal('sale')} className={`px-5 py-2 text-sm font-bold transition ${f.deal === 'sale' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Cần bán</button>
              <button type="button" onClick={() => setDeal('rent')} className={`px-5 py-2 text-sm font-bold transition ${f.deal === 'rent' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Cho thuê</button>
            </div>
          </div>
          <div><label className={lbl}>Tiêu đề *</label><input className={inp} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={f.deal === 'rent' ? 'VD: Cho thuê nhà nguyên căn Cam Đức, 3 phòng ngủ' : 'VD: Đất nền ven biển Bãi Dài, sổ đỏ'} /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Loại hình *</label>
              <select className={inp} value={f.propertyType} onChange={(e) => set('propertyType', e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{PROPERTY_LABELS[t]}</option>)}</select></div>
            <div><label className={lbl}>Diện tích (m²)</label><input className={inp} type="number" min="0" value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="250" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lbl}>{f.deal === 'rent' ? 'Giá thuê / tháng *' : 'Giá *'}</label>
              <div className="flex gap-2">
                <input className={inp} type="number" min="0" step="0.01" value={f.priceVal} onChange={(e) => set('priceVal', e.target.value.replace('-', ''))} placeholder={f.deal === 'rent' ? '5' : '2.8'} />
                <select className="border border-slate-300 rounded-lg px-2 text-sm" value={f.priceUnit} onChange={(e) => set('priceUnit', e.target.value)}><option value="ty">Tỷ</option><option value="trieu">Triệu</option></select>
              </div>
              {priceVnd && <p className="text-xs text-[#C8A14B] font-semibold mt-1">= {priceVnd}{perM2 && <span className="text-slate-500 font-medium"> · {perM2}/m²</span>}</p>}
            </div>
            <div><label className={lbl}>Mặt tiền (m)</label><input className={inp} type="number" min="0" step="0.1" value={f.frontage} onChange={(e) => set('frontage', e.target.value)} placeholder="5" /></div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-[#0A2540]">Chi tiết</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Phòng ngủ</label><input className={inp} type="number" min="0" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} /></div>
            <div><label className={lbl}>Phòng tắm</label><input className={inp} type="number" min="0" value={f.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} /></div>
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-[#0A2540]">Mô tả & liên hệ</h2>
            <button type="button" onClick={aiDescribe} disabled={aiBusy} className="text-xs font-bold text-[#0A2540] bg-[#C8A14B]/20 hover:bg-[#C8A14B]/30 border border-[#C8A14B]/40 rounded-lg px-3 py-1.5 disabled:opacity-60 whitespace-nowrap">{aiBusy ? 'Đang viết…' : '✨ AI viết mô tả'}</button>
          </div>
          <textarea className={`${inp} min-h-[120px]`} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Mô tả chi tiết bất động sản…" />
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Tên liên hệ</label><input className={inp} value={f.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder={user.fullName || ''} /></div>
            <div><label className={lbl}>SĐT liên hệ</label>
              <div className={`${inp} bg-slate-50 text-slate-600 flex items-center`}>{user.phone || 'Chưa có SĐT trong tài khoản'}</div>
              <p className="text-xs text-slate-400 mt-1">Tự dùng SĐT của tài khoản. Đổi tại <Link href="/account" className="text-[#0A2540] font-semibold">Tài khoản</Link>.</p>
            </div>
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
