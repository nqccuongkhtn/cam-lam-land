'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api, imgUrl, thumbUrl, NO_IMG } from '@/lib/api';
import { Listing, PROPERTY_LABELS, formatVnd, priceLabel, DEAL_LABELS, TIER_LABEL, postedLabel } from '@/lib/types';
import { displayViews, rememberViews, pushRecent, getRecent } from '@/lib/views';
import { useAuth } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';
import ListingCard from '@/components/ListingCard';
import { Skeleton, EmptyState, buttonClass } from '@/components/ui';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

const IPhone = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const ILock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
const IEye = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const IHeart = ({ filled }: { filled?: boolean }) => <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1.1L12 21l7.8-7.4 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>;
const Ic = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><path d={d} /></svg>;
function joinLabel(iso?: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  const months = Math.max(1, Math.round((Date.now() - t) / (30.44 * 86400000)));
  return months < 12 ? `${months} tháng` : `${Math.floor(months / 12)} năm`;
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { openLogin } = useLoginGate();
  const [l, setL] = useState<Listing | null>(null);
  const [err, setErr] = useState('');
  const [active, setActive] = useState(0);
  const [full, setFull] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [similar, setSimilar] = useState<Listing[]>([]);
  const [similarLoading, setSimilarLoading] = useState(true);
  const [recent, setRecent] = useState<Listing[]>([]);
  const [agentInfo, setAgentInfo] = useState<{ createdAt?: string; activeCount: number } | null>(null);
  const [areas, setAreas] = useState<{ ward: string; count: number }[]>([]);
  const [lightbox, setLightbox] = useState(false);
  const [lbView, setLbView] = useState<'img' | 'map'>('img');
  const [zoom, setZoom] = useState(1);

  useEffect(() => { setL(null); setFull(null); setActive(0); api<Listing>(`/listings/${id}`).then((data) => { setL(data); rememberViews(data.id, data.views || 0); pushRecent(data); }).catch((e) => setErr(e.message)); }, [id]);
  // "Đã xem gần đây": đọc danh sách TRƯỚC lần mở này (trước khi ghi tin hiện tại vào), bỏ tin đang xem
  useEffect(() => { setRecent(getRecent().filter((x: any) => x?.id !== Number(id)).slice(0, 8)); }, [id]);
  useEffect(() => {
    if (!l) return;
    setSimilarLoading(true); setSimilar([]);
    const qs = l.ward ? `ward=${encodeURIComponent(l.ward)}` : `propertyType=${l.propertyType}`;
    api<{ listings: Listing[] }>(`/listings?${qs}&limit=6`).then((d) => setSimilar((d.listings || []).filter((x) => x.id !== l.id).slice(0, 4))).catch(() => {}).finally(() => setSimilarLoading(false));
  }, [l]);
  // Thống kê môi giới (đã tham gia · tin đang đăng) — như batdongsan
  useEffect(() => {
    if (!l?.createdBy) { setAgentInfo(null); return; }
    api<{ agent: any; active: any[] }>(`/listings/agent/${l.createdBy}`).then((d) => setAgentInfo({ createdAt: d.agent?.createdAt, activeCount: Array.isArray(d.active) ? d.active.length : 0 })).catch(() => {});
  }, [l]);
  // Danh sách khu vực cho mục "Mua bán nhà đất tại Cam Lâm"
  useEffect(() => { api<{ areas: { ward: string; count: number }[] }>(`/listings/areas`).then((d) => setAreas(d.areas || [])).catch(() => {}); }, []);
  // Lightbox ảnh: Esc đóng, ← → chuyển ảnh; khóa cuộn nền khi mở.
  useEffect(() => {
    if (!lightbox) return;
    const n = l?.images?.length || 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false);
      else if (e.key === 'ArrowLeft') { setZoom(1); setActive((a) => (a - 1 + n) % n); }
      else if (e.key === 'ArrowRight') { setZoom(1); setActive((a) => (a + 1) % n); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [lightbox, l]);

  async function reveal() {
    setRevealing(true);
    try { const r = await api<{ contactPhone: string }>(`/listings/${id}/reveal`, { method: 'POST' }); setFull(r.contactPhone); }
    catch (e: any) { alert(e.message); } finally { setRevealing(false); }
  }
  function share() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && (navigator as any).share) (navigator as any).share({ title: l?.title, url }).catch(() => {});
    else if (typeof navigator !== 'undefined' && navigator.clipboard) { navigator.clipboard.writeText(url); alert('Đã sao chép liên kết tin.'); }
  }

  if (err) return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <EmptyState
        icon={<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>}
        title="Không tìm thấy tin này"
        description="Tin có thể đã được gỡ hoặc đường dẫn không đúng."
        action={<Link href="/listings" className={buttonClass({ variant: 'navy', size: 'sm' })}>Về danh sách nhà đất</Link>}
      />
    </div>
  );
  if (!l) return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Skeleton className="aspect-[4/3] w-full sm:aspect-[16/10]" rounded="rounded-2xl" />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex gap-2"><Skeleton h={20} w={72} rounded="rounded-full" /><Skeleton h={20} w={56} rounded="rounded-full" /></div>
            <Skeleton className="mt-3" h={26} w="85%" />
            <Skeleton className="mt-3" h={30} w="45%" />
            <Skeleton className="mt-3" h={16} w="65%" />
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={44} rounded="rounded-xl" />)}</div>
          </div>
          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><Skeleton h={18} w={140} /><Skeleton h={14} w="100%" /><Skeleton h={14} w="92%" /><Skeleton h={14} w="80%" /></div>
        </div>
        <div className="lg:col-span-1">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-3"><Skeleton className="h-11 w-11 shrink-0" rounded="rounded-full" /><div className="flex-1 space-y-2"><Skeleton h={14} w="60%" /><Skeleton h={12} w="40%" /></div></div>
            <Skeleton h={44} rounded="rounded-xl" /><Skeleton h={44} rounded="rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );

  const imgs = l.images?.length ? l.images : [NO_IMG];
  // Tin THƯỜNG (không VIP/đẩy) quá 7 ngày kể từ lần đăng/đẩy gần nhất bị ẩn khỏi danh sách, nhưng vẫn mở được
  // qua link trực tiếp → hiện banner cảnh báo cho người xem (vẫn cho xem đầy đủ thông tin + liên hệ).
  const _anchor = (l as any).bumpedAt || l.createdAt;
  // CHỈ tin THƯỜNG (không VIP, không đẩy) mới có thể "hết hạn" sau 7 ngày. Tin nổi bật (VIP/đẩy) luôn giữ, không gắn nhãn.
  const isExpired = !(l as any).boosted && (!l.tier || l.tier === 'normal') && !!_anchor && (Date.now() - new Date(_anchor).getTime()) > 7 * 86400000;
  const pricePerM2 = l.area && l.area > 0 ? l.price / l.area : null;
  const specs: [string, any][] = [
    ['Hình thức', l.deal === 'rent' ? 'Cho thuê' : 'Cần bán'],
    ['Mức giá', priceLabel(l.price, l.deal)],
    ['Diện tích', l.area ? `${l.area} m²` : null],
    ['Giá/m²', l.deal !== 'rent' && pricePerM2 ? formatVnd(pricePerM2) : null],
    ['Số phòng ngủ', l.bedrooms ? `${l.bedrooms} phòng` : null],
    ['Số phòng tắm, vệ sinh', l.bathrooms ? `${l.bathrooms} phòng` : null],
    ['Hướng nhà', l.direction],
    ['Mặt tiền', l.frontage ? `${l.frontage} m` : null],
    ['Pháp lý', l.legal],
    ['Loại hình', PROPERTY_LABELS[l.propertyType]],
  ];
  const heroStats: [string, string, any][] = [
    ['M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3', 'Diện tích', l.area ? `${l.area} m²` : null],
    ['M18 8l4 4-4 4M6 8l-4 4 4 4M2 12h20', 'Mặt tiền', l.frontage ? `${l.frontage} m` : null],
    ['M2 4v16 M2 8h18a2 2 0 0 1 2 2v10 M2 17h20 M6 8v9', 'Phòng ngủ', l.bedrooms ? `${l.bedrooms} PN` : null],
    ['M12 2.7l5.66 5.66a8 8 0 1 1-11.32 0z', 'Phòng tắm', l.bathrooms ? `${l.bathrooms} WC` : null],
    ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M16.2 7.8l-2.9 6.4-6.4 2.9 2.9-6.4z', 'Hướng', l.direction],
  ];
  const fb = (_i: number) => NO_IMG;
  const created = l.createdAt ? new Date(l.createdAt) : null;
  const refT = l.bumpedAt ? new Date(l.bumpedAt) : created;
  const isVip = !!l.tier && l.tier !== 'normal';
  const expiry = (!isVip && refT) ? new Date(refT.getTime() + 7 * 86400000) : null;
  const code = 'CL' + String(l.id).padStart(5, '0');
  const typeLabel = isVip ? (TIER_LABEL[l.tier as string] || 'VIP') : 'Tin thường';

  return (
    <div className="bg-slate-50 min-h-[calc(100dvh-56px)]">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-5">
        <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <Link href="/listings" className="hover:text-[#0A2540]">Nhà đất</Link> › <span className="text-slate-600">{l.ward || 'Cam Lâm'}</span></div>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="relative bg-slate-900 aspect-[16/10]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={(el) => { if (el?.complete) el.classList.add('is-on'); }} onLoad={(e) => e.currentTarget.classList.add('is-on')} src={imgUrl(imgs[active])} alt={l.title} onError={(e) => { (e.currentTarget as HTMLImageElement).src = fb(active); }} onClick={() => { setZoom(1); setLbView('img'); setLightbox(true); }} className="cl-img w-full h-full object-contain cursor-zoom-in" />
                {l.boosted && <span className="absolute top-3 left-3 bg-[#C8A14B] text-white text-xs font-bold px-2.5 py-1 rounded-full">⭐ Tin nổi bật</span>}
                <button onClick={() => { setZoom(1); setLbView('img'); setLightbox(true); }} aria-label="Xem ảnh lớn" className="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-lg bg-black/45 hover:bg-black/70 text-white backdrop-blur transition"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg></button>
                {!!l.images?.length && <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">📷 {active + 1}/{imgs.length}</span>}
                {imgs.length > 1 && (
                  <>
                    <button onClick={() => setActive((a) => (a - 1 + imgs.length) % imgs.length)} aria-label="Ảnh trước"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-black/45 hover:bg-black/70 active:scale-95 text-white backdrop-blur transition">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <button onClick={() => setActive((a) => (a + 1) % imgs.length)} aria-label="Ảnh sau"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-black/45 hover:bg-black/70 active:scale-95 text-white backdrop-blur transition">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  </>
                )}
              </div>
              {imgs.length > 1 && (
                <div className="flex gap-2 p-2 overflow-x-auto">
                  {imgs.map((s, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={thumbUrl(s)} alt="" loading="lazy" decoding="async" onClick={() => setActive(i)} onError={(e) => { (e.currentTarget as HTMLImageElement).src = fb(i); }} className={`h-16 w-20 object-cover rounded-lg cursor-pointer shrink-0 ${i === active ? 'ring-2 ring-[#C8A14B]' : 'opacity-70 hover:opacity-100'}`} />
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              {/* Nhãn trạng thái (trái) + nút LƯU dạng trái tim góc phải — như Zillow/Airbnb */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${l.deal === 'rent' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{l.deal === 'rent' ? 'CHO THUÊ' : 'CẦN BÁN'}</span>
                  {l.propertyType && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{PROPERTY_LABELS[l.propertyType]}</span>}
                  {(l as any).verified && <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5"><path d="M20 6 9 17l-5-5" /></svg>Xác thực</span>}
                </div>
                <button onClick={() => setSaved((v) => !v)} aria-label={saved ? 'Bỏ lưu' : 'Lưu tin'} className={`cl-press shrink-0 grid place-items-center w-9 h-9 rounded-full border transition ${saved ? 'border-red-200 text-red-600 bg-red-50' : 'border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200'}`}><IHeart filled={saved} /></button>
              </div>
              {isExpired && (
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                  <span className="text-base leading-none">⏳</span>
                  <span><b>Tin đã hết hạn hiển thị.</b> Tin này không còn trong danh sách tìm kiếm và thông tin có thể đã cũ. Vui lòng liên hệ để xác nhận còn hàng và đúng giá trước khi giao dịch.</span>
                </div>
              )}
              <h1 className="text-xl md:text-2xl font-extrabold text-[#0A2540] leading-snug mt-2">{l.title}</h1>
              {/* GIÁ ngay dưới tiêu đề — điểm nhấn chính */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-2">
                <span className="text-2xl md:text-3xl font-extrabold text-red-600 leading-none">{priceLabel(l.price, l.deal)}</span>
                {l.deal !== 'rent' && pricePerM2 && <span className="text-sm font-semibold text-slate-500">~ {formatVnd(pricePerM2)}/m²</span>}
              </div>
              <p className="text-slate-500 mt-2 text-sm flex items-start gap-1.5"><span className="text-red-500 mt-0.5 shrink-0"><Ic d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></span><span>{[l.address, l.ward, 'Cam Lâm', 'Khánh Hòa'].filter(Boolean).join(', ').split(', ').filter((p, i, a) => a.findIndex((x) => x.toLowerCase() === p.toLowerCase()) === i).join(', ')}</span></p>
              {/* THÔNG SỐ NHANH — lưới gọn trong panel, bỏ gạch dọc lộn xộn */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-xl bg-slate-50 p-3">
                {heroStats.filter(([, , v]) => v != null && v !== '').map(([d, label, val]) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className="grid place-items-center w-9 h-9 rounded-lg bg-white border border-slate-100 text-[#C8A14B] shrink-0"><Ic d={d as string} /></span>
                    <div className="min-w-0"><p className="text-[11px] text-slate-400 leading-none">{label}</p><p className="font-bold text-[#0A2540] text-sm mt-1 leading-tight truncate">{String(val)}</p></div>
                  </div>
                ))}
              </div>
              {/* Hành động phụ: chia sẻ + so sánh giá khu vực */}
              <div className="flex items-stretch gap-2 mt-4 pt-4 border-t border-slate-100">
                <button onClick={share} className="cl-press shrink-0 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A2540] border border-slate-200 rounded-lg px-3 py-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg> Chia sẻ</button>
                <Link href={`/listings?ward=${encodeURIComponent(l.ward || '')}`} className="cl-press flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-lg px-3 py-1.5 hover:bg-emerald-100"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg> <span className="truncate">Giá khu vực {l.ward || 'Cam Lâm'}</span></Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h2 className="text-lg font-bold text-[#0A2540] mb-2">Thông tin mô tả</h2>
              <p className="text-slate-700 whitespace-pre-line leading-relaxed">{l.description ?? 'Đang cập nhật.'}</p>
            </div>

            {(l as any).verified && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-full bg-emerald-600 text-white grid place-items-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <div><p className="font-extrabold text-[#0A2540]">Tin xác thực bởi Cam Lâm Land</p><p className="text-[13px] text-slate-500">Đội ngũ Cam Lâm Land đã kiểm chứng thực tế</p></div>
                </div>
                <div className="mt-3 grid sm:grid-cols-3 gap-x-4 gap-y-2 text-sm text-slate-700">
                  {['Có sổ đỏ / hợp đồng mua bán', 'Đúng địa chỉ, hình ảnh & đặc điểm', 'Trong khoảng giá thị trường'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M20 6 9 17l-5-5" /></svg>{t}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h2 className="text-lg font-bold text-[#0A2540] mb-3">Đặc điểm bất động sản</h2>
              <div className="grid sm:grid-cols-2 sm:gap-x-8">
                {specs.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 border-b border-slate-100 py-2.5 text-sm">
                    <span className="text-slate-500">{k}</span><b className="text-[#0A2540] text-right">{String(v)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-3">
              <h2 className="font-bold text-[#0A2540] mb-2 px-2">Vị trí trên bản đồ</h2>
              <div className="h-72 rounded-xl overflow-hidden">
                <MapView center={[l.lng, l.lat]} zoom={15} baseMap="satellite" markers={[{ lng: l.lng, lat: l.lat, popupHtml: `<b>${l.title}</b>` }]} className="h-full w-full" />
              </div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`} target="_blank" rel="noreferrer" className="cl-press mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] py-2.5 font-bold text-white hover:bg-[#0d3a6b]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m15.4 8.6-2 5.4-5.4 2 2-5.4z" fill="currentColor" />
                </svg>
                Chỉ đường đến bất động sản
              </a>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h2 className="font-bold text-[#0A2540] mb-3">Thông tin tin đăng</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"><p className="text-[11px] text-slate-400">Mã tin</p><p className="font-bold text-[#0A2540] text-sm">{code}</p></div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"><p className="text-[11px] text-slate-400">Loại tin</p><p className="font-bold text-[#0A2540] text-sm">{typeLabel}</p></div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"><p className="text-[11px] text-slate-400">Ngày đăng</p><p className="font-bold text-[#0A2540] text-sm">{created ? created.toLocaleDateString('vi-VN') : '—'}</p></div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"><p className="text-[11px] text-slate-400">Hết hạn hiển thị</p><p className="font-bold text-[#0A2540] text-sm">{expiry ? expiry.toLocaleDateString('vi-VN') : 'Không giới hạn'}</p></div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 1.9" />
                </svg>
                {postedLabel(l.createdAt)}
              </p>
            </div>

            {/* Liên kết chéo → Cẩm nang pháp lý (tăng lượt xem bảng dịch vụ).
                ⚠️ TRƯỚC ĐÂY khối này để nền navy đậm, chữ trắng, nút vàng — lạc hẳn
                giữa một trang mà MỌI khối khác đều là thẻ TRẮNG, viền xám nhạt,
                tiêu đề màu navy. Nhìn như dán nhầm từ trang khác sang.
                Nay dùng đúng bộ áo chung của trang: thẻ trắng + viền slate-200 +
                bo góc rounded-2xl + tiêu đề navy. Nút viền navy, rê chuột thì tô
                đặc — vẫn nổi để bấm mà không phá nhịp trang. Đừng đổi lại nền tối. */}
            <Link href="/cam-nang"
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[#C8A14B]/60 hover:shadow-lg sm:p-5">
              {/* Ô biểu tượng: NỀN NAVY ĐẶC + biểu tượng VÀNG — y như logo trên thanh
                  menu, nên nhìn là thấy cùng một nhà.
                  ⚠️ Bản đầu để nền xanh nhạt 6% + nét mảnh 1.8 → chủ dự án nói
                  "nhạt nhòa quá". Đúng: nét mảnh màu tối trên nền gần trắng thì ở
                  cỡ 24px gần như chìm. Nền đặc + nét dày 2.2 mới đủ chắc. */}
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#0A2540]">
                {/* ⚠️ HAI LẦN TRƯỚC ĐỀU BỊ CHÊ "NHẠT NHÒA", lý do:
                      lần 1 — nền xanh nhạt 6% + nét rỗng mảnh 1.8 → chìm hẳn;
                      lần 2 — nền navy đặc rồi nhưng biểu tượng vẫn là NÉT RỖNG,
                              ở cỡ 24px mấy nét mảnh vẫn không đủ "ăn" mắt.
                    Nay vẽ HÌNH ĐẶC: tờ giấy tô kín màu vàng, dấu tích khoét
                    thủng bằng màu nền. Mảng đặc bao giờ cũng chắc hơn nét rỗng
                    ở cỡ nhỏ. Đừng quay lại kiểu nét rỗng mảnh. */}
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                  <path fill="#C8A14B" d="M6 2.6h7.6L19.4 8.4V21.4H6z" />
                  <path fill="#e0c07d" d="M13.6 2.6 19.4 8.4h-5.8z" />
                  <path fill="none" stroke="#0A2540" strokeWidth="2.4"
                    strokeLinecap="round" strokeLinejoin="round" d="m9.1 14.5 2.2 2.2 4.3-4.5" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-[#0A2540]">Thủ tục pháp lý khi mua bán đất</span>
                <span className="block text-[13px] text-slate-500">Sang tên sổ đỏ, thuế phí, kiểm tra sổ, mẫu hợp đồng đặt cọc — tư vấn miễn phí.</span>
              </span>
              <span className="shrink-0 whitespace-nowrap rounded-lg border border-[#0A2540] px-4 py-2 text-sm font-bold text-[#0A2540] transition group-hover:bg-[#0A2540] group-hover:text-white">Xem →</span>
            </Link>
          </div>

          {/* CỘT PHẢI CHẠY THEO TRANG.
              Trước đây đã có lg:sticky mà vẫn đứng yên, vì hai lẽ:
              1. Nó là một ô của lưới (grid). Ô lưới mặc định bị KÉO CAO BẰNG cả hàng,
                 đã lấp đầy chỗ rồi thì không còn chỗ nào mà trượt — phải self-start.
              2. Nội dung cột cao hơn màn hình thì dính cũng vô nghĩa, vì phải cuộn hết
                 cột mới tới đáy nó. Nên chặn chiều cao đúng bằng màn hình và cho cột
                 tự cuộn riêng.
              Không đè lên chân trang: cột dính chỉ trượt trong phạm vi lưới, mà lưới
              kết thúc trước chân trang. */}
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1 cl-cot-ben">
            {/* MẢNH LẠI CHO SANG — so với batdongsan.com.vn thì thẻ này của mình dày và nặng:
                  bóng đổ to, ảnh đại diện 64px, con số 20px, ba nút đều cao 48-52px.
                  Bên họ: viền mảnh, ảnh 52px, nút vừa phải. Hạ theo hướng đó. */}
            <div className="rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(13,138,128,0.18)] bg-gradient-to-b from-[#13a99c] to-[#0b7d72]">
              <div className="flex items-center justify-center gap-1.5 px-4 py-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="8" r="6" /><path d="M15.5 13.6 17 22l-5-3-5 3 1.5-8.4" /></svg>
                <span className="text-white text-[12.5px] font-bold tracking-wide">Môi giới chuyên nghiệp</span>
              </div>
              <div className="bg-white mx-2 rounded-lg p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    {l.posterAvatar ? <img src={l.posterAvatar} alt="" className="w-[52px] h-[52px] rounded-full object-cover ring-2 ring-[#13a99c]/25" /> : <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-[#123459] to-[#081B30] text-[#C8A14B] grid place-items-center text-xl font-extrabold ring-2 ring-[#13a99c]/25">{(l.contactName || 'C').charAt(0).toUpperCase()}</div>}
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#13a99c] grid place-items-center ring-2 ring-white"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5"><path d="M20 6 9 17l-5-5" /></svg></span>
                  </div>
                  <p className="font-extrabold text-[#0A2540] text-[16px] leading-snug">{l.contactName || 'Cam Lâm Land'}</p>
                </div>
                {agentInfo && (
                  <div className="mt-3 grid grid-cols-2 text-center">
                    <div className="border-r border-slate-100 px-2"><p className="text-[11px] text-slate-400 leading-tight">Tham gia Cam Lâm Land</p><p className="font-extrabold text-[#0A2540] text-[17px] mt-1 leading-none">{joinLabel(agentInfo.createdAt) ?? '—'}</p></div>
                    <div className="px-2"><p className="text-[11px] text-slate-400 leading-tight">Tin đăng đang có</p><p className="font-extrabold text-[#0A2540] text-[17px] mt-1 leading-none">{agentInfo.activeCount}{agentInfo.activeCount >= 60 ? '+' : ''}</p></div>
                  </div>
                )}
                {l.createdBy && (
                  <Link href={`/moi-gioi/${l.createdBy}`} className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-center gap-1 text-[12.5px] font-bold text-[#0e8b80]">Xem trang cá nhân <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 18l6-6-6-6" /></svg></Link>
                )}
              </div>
              <div className="px-2 pt-2.5 pb-2.5 space-y-2">
                <a href="https://zalo.me/0988888888" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-[#0A2540] font-bold py-2.5 rounded-lg shadow-sm text-[14px]"><svg viewBox="0 0 24 24" fill="#0068FF" className="w-5 h-5"><path d="M12 2C6.5 2 2 5.8 2 10.5c0 2.6 1.4 4.9 3.6 6.4-.1.9-.5 2.2-1.2 3.1 1.4-.2 2.8-.8 3.9-1.5 1.1.3 2.4.5 3.7.5 5.5 0 10-3.8 10-8.5S17.5 2 12 2z" /></svg> Chat qua Zalo</a>
                {full ? (
                  <a href={`tel:${full.replace(/\s/g, '')}`} className="flex items-center justify-center gap-2 bg-[#075e56] hover:bg-[#064f48] text-white font-extrabold text-[15px] py-2.5 rounded-lg shadow-sm"><IPhone /> {full}</a>
                ) : (
                  <button onClick={user ? reveal : () => openLogin()} disabled={revealing} className="cl-press w-full flex items-center justify-center gap-2 bg-[#075e56] hover:bg-[#064f48] disabled:opacity-60 text-white font-extrabold py-3.5 rounded-xl shadow-md"><IPhone /> {revealing ? 'Đang hiện…' : `${l.contactPhone || '0988 88•••'} · Hiện số`}</button>
                )}
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setSaved((v) => !v)} className={`flex-1 flex items-center justify-center gap-1.5 font-bold py-2.5 rounded-xl border transition ${saved ? 'bg-white text-red-600 border-white' : 'border-white/45 text-white hover:bg-white/10'}`}><IHeart filled={saved} /> {saved ? 'Đã lưu' : 'Lưu tin'}</button>
                  {user && l.createdBy === user.id && (
                    <Link href={`/sales/edit/${l.id}`} className="flex-1 flex items-center justify-center gap-1.5 font-bold py-2.5 rounded-xl border border-white/45 text-white hover:bg-white/10">✏️ Sửa</Link>
                  )}
                </div>
                <p className="text-[11px] text-white/70 text-center pt-0.5">Mã tin {code} · {postedLabel(l.createdAt)} · {displayViews(l).toLocaleString('vi-VN')} lượt xem</p>
              </div>
            </div>
            {areas.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-bold text-[#0A2540] mb-3">Mua bán nhà đất tại Cam Lâm</h3>
                <div className="grid grid-cols-1">
                  {areas.slice(0, 10).map((a) => (
                    <Link key={a.ward} href={`/listings?ward=${encodeURIComponent(a.ward)}`} className="flex items-center justify-between py-1.5 text-sm text-slate-600 hover:text-red-700 border-b border-slate-50 last:border-0"><span>Nhà đất {a.ward}</span><span className="text-slate-400">({a.count})</span></Link>
                  ))}
                </div>
                <Link href="/nha-dat" className="mt-3 inline-block text-sm font-semibold text-red-600 hover:underline">Xem thêm khu vực →</Link>
              </div>
            )}
          </div>
        </div>

        {(similarLoading || similar.length > 0) && (
          <div className="mt-6 sm:mt-8">
            <h2 className="text-xl font-extrabold text-[#0A2540] mb-3 sm:mb-4">Bất động sản cùng khu vực</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {similarLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <Skeleton className="aspect-[16/10] w-full" rounded="rounded-none" />
                      <div className="space-y-2 p-3"><Skeleton h={14} w="90%" /><Skeleton h={14} w="55%" /><Skeleton h={18} w="45%" /><Skeleton h={12} w="70%" /></div>
                    </div>
                  ))
                : similar.map((s) => <ListingCard key={s.id} l={s} />)}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-6 sm:mt-8">
            <h2 className="text-xl font-extrabold text-[#0A2540] mb-3 sm:mb-4 flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#C8A14B]"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>Đã xem gần đây</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{recent.slice(0, 4).map((s) => <ListingCard key={s.id} l={s} />)}</div>
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
          <div className="relative flex items-center justify-center shrink-0" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))', paddingBottom: '0.5rem' }}>
            <div className="flex rounded-lg overflow-hidden bg-white/10 text-[13px] font-bold">
              <button onClick={() => setLbView('img')} className={`flex items-center gap-1.5 px-4 py-1.5 transition ${lbView === 'img' ? 'bg-white text-[#0A2540]' : 'text-white/80 hover:text-white'}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg> Hình ảnh</button>
              <button onClick={() => setLbView('map')} className={`flex items-center gap-1.5 px-4 py-1.5 transition ${lbView === 'map' ? 'bg-white text-[#0A2540]' : 'text-white/80 hover:text-white'}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 20l-5.5 2.5V6L9 3.5m0 16.5 6-2.5M9 20V3.5m6 14 5.5 2.5V6L15 3.5m0 14V3.5m0 0L9 6" /></svg> Bản đồ</button>
            </div>
            {lbView === 'img' && <span className="absolute left-4 text-white/70 text-sm font-medium">{active + 1} / {imgs.length}</span>}
            <div className="absolute right-2 flex items-center gap-1">
              {lbView === 'img' && (<>
                <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} aria-label="Thu nhỏ" className="w-9 h-9 grid place-items-center rounded-full text-white text-2xl leading-none hover:bg-white/15">−</button>
                <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)))} aria-label="Phóng to" className="w-9 h-9 grid place-items-center rounded-full text-white text-xl leading-none hover:bg-white/15">+</button>
              </>)}
              <button onClick={() => setLightbox(false)} aria-label="Đóng" className="w-9 h-9 grid place-items-center rounded-full text-white text-xl leading-none hover:bg-white/15">✕</button>
            </div>
          </div>
          {lbView === 'img' ? (
            <>
              <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden" onClick={() => zoom > 1 && setZoom(1)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(imgs[active])} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).src = fb(active); }} className="max-h-full max-w-full object-contain transition-transform duration-200" style={{ transform: `scale(${zoom})` }} />
                {imgs.length > 1 && (<>
                  <button onClick={(e) => { e.stopPropagation(); setZoom(1); setActive((a) => (a - 1 + imgs.length) % imgs.length); }} aria-label="Ảnh trước" className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M15 18l-6-6 6-6" /></svg></button>
                  <button onClick={(e) => { e.stopPropagation(); setZoom(1); setActive((a) => (a + 1) % imgs.length); }} aria-label="Ảnh sau" className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M9 18l6-6-6-6" /></svg></button>
                </>)}
              </div>
              {imgs.length > 1 && (
                <div className="shrink-0 flex gap-2 px-3 pt-3 overflow-x-auto no-scrollbar sm:justify-center" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                  {imgs.map((sImg, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={thumbUrl(sImg)} alt="" onClick={() => { setZoom(1); setActive(i); }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = fb(i); }} className={`h-14 w-20 object-cover rounded-md cursor-pointer shrink-0 transition ${i === active ? 'ring-2 ring-[#C8A14B]' : 'opacity-45 hover:opacity-90'}`} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 min-h-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <MapView center={[l.lng, l.lat]} zoom={16} baseMap="satellite" markers={[{ lng: l.lng, lat: l.lat, popupHtml: `<b>${l.title}</b>` }]} className="h-full w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
