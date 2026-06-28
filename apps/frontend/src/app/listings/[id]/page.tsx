'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Listing, PROPERTY_LABELS, formatVnd } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import ListingCard from '@/components/ListingCard';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

const IPhone = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const ILock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
const IEye = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const IHeart = ({ filled }: { filled?: boolean }) => <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1.1L12 21l7.8-7.4 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>;

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [l, setL] = useState<Listing | null>(null);
  const [err, setErr] = useState('');
  const [active, setActive] = useState(0);
  const [full, setFull] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [similar, setSimilar] = useState<Listing[]>([]);

  useEffect(() => { setL(null); setFull(null); setActive(0); api<Listing>(`/listings/${id}`).then(setL).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => {
    if (!l) return;
    const qs = l.ward ? `ward=${encodeURIComponent(l.ward)}` : `propertyType=${l.propertyType}`;
    api<{ listings: Listing[] }>(`/listings?${qs}&limit=6`).then((d) => setSimilar((d.listings || []).filter((x) => x.id !== l.id).slice(0, 4))).catch(() => {});
  }, [l]);

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

  if (err) return <div className="mx-auto max-w-3xl p-10 text-center text-slate-500">Không tìm thấy tin.</div>;
  if (!l) return <div className="mx-auto max-w-3xl p-10 text-center text-slate-500">Đang tải…</div>;

  const imgs = l.images?.length ? l.images : [`https://picsum.photos/seed/cl${l.id}/1000/700`];
  const pricePerM2 = l.area && l.area > 0 ? l.price / l.area : null;
  const specs: [string, string, any][] = [
    ['📐', 'Diện tích', l.area ? `${l.area} m²` : null], ['💰', 'Mức giá', formatVnd(l.price)],
    ['🛏️', 'Phòng ngủ', l.bedrooms], ['🛁', 'Phòng tắm', l.bathrooms],
    ['🧭', 'Hướng', l.direction], ['📜', 'Pháp lý', l.legal],
    ['📏', 'Mặt tiền', l.frontage ? `${l.frontage} m` : null], ['🏷️', 'Loại hình', PROPERTY_LABELS[l.propertyType]],
  ];
  const fb = (i: number) => `https://picsum.photos/seed/cl${l.id}_${i}/1000/700`;

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <Link href="/listings" className="hover:text-[#0A2540]">Nhà đất</Link> › <span className="text-slate-600">{l.ward || 'Cam Lâm'}</span></div>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="relative bg-slate-900 aspect-[16/10]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgs[active]} alt={l.title} onError={(e) => { (e.currentTarget as HTMLImageElement).src = fb(active); }} className="w-full h-full object-contain" />
                {l.boosted && <span className="absolute top-3 left-3 bg-[#C8A14B] text-white text-xs font-bold px-2.5 py-1 rounded-full">⭐ Tin nổi bật</span>}
                <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">📷 {active + 1}/{imgs.length}</span>
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
                    <img key={i} src={s} alt="" onClick={() => setActive(i)} onError={(e) => { (e.currentTarget as HTMLImageElement).src = fb(i); }} className={`h-16 w-20 object-cover rounded-lg cursor-pointer shrink-0 ${i === active ? 'ring-2 ring-[#C8A14B]' : 'opacity-70 hover:opacity-100'}`} />
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h1 className="text-xl md:text-2xl font-extrabold text-[#0A2540]">{l.title}</h1>
              <p className="text-slate-500 mt-1 text-sm">📍 {[l.address, l.ward, 'Cam Lâm, Khánh Hòa'].filter(Boolean).join(', ')}</p>
              <div className="grid grid-cols-3 gap-3 mt-4 border-y border-slate-100 py-3">
                <div><p className="text-xs text-slate-400">Mức giá</p><p className="text-lg md:text-xl font-extrabold text-red-600">{formatVnd(l.price)}</p></div>
                <div><p className="text-xs text-slate-400">Diện tích</p><p className="text-lg md:text-xl font-extrabold text-[#0A2540]">{l.area ? `${l.area} m²` : '—'}</p></div>
                <div><p className="text-xs text-slate-400">Giá/m²</p><p className="text-lg md:text-xl font-extrabold text-[#0A2540]">{pricePerM2 ? formatVnd(pricePerM2) : '—'}</p></div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={share} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A2540] border border-slate-200 rounded-lg px-3 py-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg> Chia sẻ</button>
                <button onClick={() => setSaved((v) => !v)} className={`inline-flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 ${saved ? 'border-red-200 text-red-600 bg-red-50' : 'border-slate-200 text-slate-500 hover:text-red-600'}`}><IHeart filled={saved} /> {saved ? 'Đã lưu' : 'Lưu'}</button>
                <Link href={`/listings?ward=${encodeURIComponent(l.ward || '')}`} className="ml-auto inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-lg px-3 py-1.5 hover:bg-emerald-100"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg> Giá khu vực {l.ward || 'Cam Lâm'}</Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-bold text-[#0A2540] mb-2">Đặc điểm bất động sản</h2>
              <div className="grid sm:grid-cols-2 gap-x-6">
                {specs.filter(([, , v]) => v != null && v !== '').map(([ic, k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-slate-50 py-2 text-sm">
                    <span className="text-slate-500">{ic} {k}</span><b className="text-[#0A2540] text-right">{String(v)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-bold text-[#0A2540] mb-2">Thông tin mô tả</h2>
              <p className="text-slate-700 whitespace-pre-line leading-relaxed">{l.description ?? 'Đang cập nhật.'}</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-3">
              <h2 className="font-bold text-[#0A2540] mb-2 px-2">Vị trí trên bản đồ</h2>
              <div className="h-72 rounded-xl overflow-hidden">
                <MapView center={[l.lng, l.lat]} zoom={15} baseMap="satellite" markers={[{ lng: l.lng, lat: l.lat, popupHtml: `<b>${l.title}</b>` }]} className="h-full w-full" />
              </div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl">🧭 Chỉ đường đến bất động sản</a>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:sticky lg:top-20 shadow-sm">
              <div className="flex items-center gap-3">
                {l.posterAvatar ? <img src={l.posterAvatar} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-[#C8A14B]/30" /> : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#123459] to-[#081B30] text-[#C8A14B] grid place-items-center text-lg font-extrabold ring-2 ring-[#C8A14B]/30">{(l.contactName || 'C').charAt(0).toUpperCase()}</div>}
                <div><p className="font-bold text-[#0A2540] leading-tight">{l.contactName || 'Cam Lâm Land'}</p><p className="text-xs text-slate-400">Người đăng tin · Cam Lâm Land</p></div>
              </div>
              <a href="https://zalo.me/0988888888" target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 bg-[#0068FF] hover:bg-[#0058d6] text-white font-bold py-3 rounded-xl"><svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.5 2 2 5.8 2 10.5c0 2.6 1.4 4.9 3.6 6.4-.1.9-.5 2.2-1.2 3.1 1.4-.2 2.8-.8 3.9-1.5 1.1.3 2.4.5 3.7.5 5.5 0 10-3.8 10-8.5S17.5 2 12 2z" /></svg> Chat qua Zalo</a>
              {full ? (
                <a href={`tel:${full.replace(/\s/g, '')}`} className="mt-2.5 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-extrabold text-lg py-3.5 rounded-xl shadow-lg shadow-red-600/30"><IPhone /> {full}</a>
              ) : (
                <div className="mt-2.5">
                  <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <span className="grid place-items-center w-8 h-8 rounded-lg bg-[#0A2540] text-white shrink-0"><ILock /></span>
                    <span className="text-xl font-extrabold text-[#0A2540] tracking-wider">{l.contactPhone || '0988 88•••'}</span>
                  </div>
                  {user ? (
                    <button onClick={reveal} disabled={revealing} className="mt-2.5 w-full flex items-center justify-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold py-3 rounded-xl"><IEye /> {revealing ? 'Đang hiện…' : 'Hiện số đầy đủ'}</button>
                  ) : (
                    <Link href="/login" className="mt-2.5 w-full flex items-center justify-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold py-3 rounded-xl"><ILock /> Đăng nhập để xem số</Link>
                  )}
                </div>
              )}
              <button onClick={() => setSaved((v) => !v)} className={`mt-2.5 w-full flex items-center justify-center gap-2 font-bold py-2.5 rounded-xl border transition ${saved ? 'border-red-200 text-red-600 bg-red-50' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}><IHeart filled={saved} /> {saved ? 'Đã lưu tin' : 'Lưu tin'}</button>
              {user && (l.createdBy === user.id || user.role === 'admin') && (
                <Link href={`/sales/edit/${l.id}`} className="mt-2.5 w-full flex items-center justify-center gap-2 font-bold py-2.5 rounded-xl border border-[#C8A14B]/50 text-[#8a6d1f] bg-[#C8A14B]/10 hover:bg-[#C8A14B]/20">✏️ Sửa tin</Link>
              )}
              <p className="text-[11px] text-slate-400 mt-3 text-center">Mã tin #{l.id} · đăng {new Date(l.createdAt).toLocaleDateString('vi-VN')}</p>
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-extrabold text-[#0A2540] mb-4">Bất động sản cùng khu vực</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{similar.map((s) => <ListingCard key={s.id} l={s} />)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
