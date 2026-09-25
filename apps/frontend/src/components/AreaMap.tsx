'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { MarkerSpec } from './MapView';

// MapView (maplibre) khá nặng → chỉ tải khi cuộn tới (không kéo chậm trang đích SEO).
const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => <div className="w-full h-full grid place-items-center text-slate-400 text-sm">Đang tải bản đồ…</div> });

interface Pt { id: number; lng: number; lat: number; label: string; title: string; }
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export default function AreaMap({ center, zoom = 12.5, points = [], moreHref, title }: { center: [number, number]; zoom?: number; points?: Pt[]; moreHref?: string; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { setShow(true); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setShow(true); io.disconnect(); } }), { rootMargin: '250px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  // Không set tier → hiện dạng PIN GIÁ luôn thấy (đẹp cho bản xem trước khu vực).
  const markers: MarkerSpec[] = points.map((p) => ({
    lng: p.lng, lat: p.lat, label: p.label,
    popupHtml: `<a href="/listings/${p.id}" style="font-weight:700;color:#0A2540">${esc(p.title)}</a><br/><b style="color:#dc2626">${esc(p.label)}</b>`,
  }));
  return (
    <div ref={ref} className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100" style={{ height: 300 }}>
      {show
        ? <MapView center={center} zoom={zoom} markers={markers} className="w-full h-full" />
        : <div className="w-full h-full grid place-items-center text-slate-400 text-sm">🗺️ {title || 'Bản đồ khu vực'}</div>}
      {moreHref && <Link href={moreHref} className="absolute z-[5] bottom-3 right-3 bg-[#0A2540] text-white text-[12px] font-bold px-3 py-1.5 rounded-lg shadow-lg">Mở bản đồ đầy đủ →</Link>}
    </div>
  );
}
