'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Listing, PROPERTY_LABELS, formatVnd } from '@/lib/types';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const [l, setL] = useState<Listing | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<Listing>(`/listings/${id}`).then(setL).catch((e) => setErr(e.message)); }, [id]);

  if (err) return <div className="mx-auto max-w-3xl p-8 text-slate-500">Không tìm thấy tin: {err}</div>;
  if (!l) return <div className="mx-auto max-w-3xl p-8 text-slate-500">Đang tải…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/listings" className="text-emerald-700 text-sm">← Quay lại danh sách</Link>
      <h1 className="text-2xl font-bold mt-2">{l.title}</h1>
      <p className="text-slate-500">{l.address ?? l.ward ?? 'Cam Lâm, Khánh Hòa'}</p>

      <div className="grid md:grid-cols-3 gap-2 mt-4">
        {(l.images?.length ? l.images : ['https://picsum.photos/seed/x/800/600']).map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/d${l.id}_${i}/800/600`; }} className={`rounded-lg object-cover w-full ${i === 0 ? 'md:col-span-3 h-72' : 'h-40'}`} />
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="md:col-span-2">
          <div className="flex flex-wrap gap-4 bg-white border rounded-xl p-4">
            <Stat label="Giá" value={formatVnd(l.price)} highlight />
            <Stat label="Diện tích" value={l.area ? `${l.area} m²` : '—'} />
            <Stat label="Loại" value={PROPERTY_LABELS[l.propertyType] ?? l.propertyType} />
            {l.bedrooms != null && <Stat label="Phòng ngủ" value={String(l.bedrooms)} />}
          </div>
          <h2 className="font-semibold mt-5 mb-1">Mô tả</h2>
          <p className="text-slate-700 whitespace-pre-line">{l.description ?? 'Đang cập nhật.'}</p>
        </div>
        <div className="h-72 rounded-xl overflow-hidden border">
          <MapView center={[l.lng, l.lat]} zoom={15}
            markers={[{ lng: l.lng, lat: l.lat, popupHtml: `<b>${l.title}</b>` }]} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-bold ${highlight ? 'text-emerald-700 text-lg' : ''}`}>{value}</p>
    </div>
  );
}
