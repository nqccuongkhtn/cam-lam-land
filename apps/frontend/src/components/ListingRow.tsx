'use client';
import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import { Listing, priceLabel, TIER_BADGE, TIER_LABEL, postedLabel } from '@/lib/types';
import { displayViews, viewedReal } from '@/lib/views';
import { thumbUrl, NO_IMG } from '@/lib/api';
import { inCompare, toggleCompare } from '@/lib/compare';
import { useLoginGate } from '@/lib/loginGate';
import LogoAnh from '@/components/LogoAnh';

function IPin() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></svg>; }
function Verified() { return <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded leading-none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5"><path d="M20 6 9 17l-5-5" /></svg>XÁC THỰC</span>; }
function IPhone() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>; }
// Watermark dọc ĐÁY ảnh bìa (như batdongsan): avatar + tên môi giới bên trái, logo Cam Lâm Land bên phải — mờ, chống lấy ảnh & nhận diện thương hiệu.
function Watermark({ name, avatar }: { name?: string; avatar?: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[1] pointer-events-none select-none flex items-center gap-1.5 px-2 pt-6 pb-1.5 bg-gradient-to-t from-black/35 via-black/10 to-transparent">
      {avatar
        ? <img src={avatar} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white/60 opacity-90 shrink-0" />
        : <span className="w-5 h-5 rounded-full bg-white/25 grid place-items-center shrink-0"><svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.5V20h12V9.5" /></svg></span>}
      <span className="text-white/90 text-[11px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate max-w-[46%]">{name || 'Cam Lâm Land'}</span>
      <span className="ml-auto flex items-center gap-1 opacity-85 shrink-0">
        <LogoAnh cao={14} nenToi lop="drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" />
        <span className="text-white/85 text-[9.5px] font-black tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">Cam Lâm Land</span>
      </span>
    </div>
  );
}

function ListingRow({ l, href }: { l: Listing; href?: string }) {
  const [fav, setFav] = useState(false);
  const [cmp, setCmp] = useState(false);
  const [extraViews, setExtraViews] = useState(0);
  const { requireLogin } = useLoginGate();
  const onHeart = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); requireLogin({ reason: 'Đăng nhập để lưu tin yêu thích của bạn.', onSuccess: () => setFav((v) => !v) }); };
  useEffect(() => {
    const sync = () => setCmp(inCompare(l.id));
    sync(); window.addEventListener('compare-change', sync);
    return () => window.removeEventListener('compare-change', sync);
  }, [l.id]);
  useEffect(() => {
    const apply = () => setExtraViews(Math.max(0, viewedReal(l.id) - (l.views || 0)));
    apply(); window.addEventListener('views-change', apply);
    return () => window.removeEventListener('views-change', apply);
  }, [l.id, l.views]);

  const nImg = l.images?.length ?? 0;
  const perM2 = l.area && l.area > 0 ? l.price / l.area / 1e6 : null;
  const img0 = thumbUrl(l.images?.[0]) ?? NO_IMG;
  const posted = postedLabel(l.createdAt);
  const agentName = (l as any).contactName || 'Cam Lâm Land';
  const agentPhone = (l as any).contactPhone as string | undefined;
  const avatar = (l as any).posterAvatar as string | undefined;
  const verified = !!(l as any).verified;
  // Ảnh bìa hiện dần khi tải xong. An toàn với ảnh ĐÃ CACHE: nếu .complete ngay lúc gắn ref → hiện luôn (không kẹt mờ).
  const fadeImg = (el: HTMLImageElement | null) => { if (el?.complete) el.classList.add('is-on'); };
  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add('is-on');
  // TỔNG ảnh hiện ngoài card theo HẠNG (gồm bìa): Kim cương 5 · Vàng 4 · Bạc 3 · Thường 1.
  const stripMax = l.tier === 'diamond' ? 4 : l.tier === 'gold' ? 3 : l.tier === 'silver' ? 2 : 0;
  const stripN = Math.min(stripMax, nImg - 1);
  const heroMosaic = l.tier === 'diamond';   // Kim cương LUÔN dùng hero full-width (kể cả THIẾU ẢNH — không vỡ layout, không tụt xuống thẻ nhỏ)
  const mThumbs = l.images?.slice(1, 4) ?? [];   // ảnh phụ mosaic (0–3): thiếu ảnh vẫn hiển thị gọn, không ô trống
  const mSpan = (i: number) => mThumbs.length === 1 ? 'col-span-2 row-span-2' : mThumbs.length === 2 ? 'col-span-2' : (i === 0 ? 'col-span-2' : '');
  // Viền/nền theo HẠNG để VIP nổi bật rõ hơn tin thường
  const frameCls =
    l.tier === 'diamond' ? 'border-[#C8A14B]/70 ring-1 ring-[#C8A14B]/40 shadow-[0_2px_16px_rgba(200,161,75,0.18)]'
      : l.tier === 'gold' ? 'border-[#C8A14B]/45 ring-1 ring-[#C8A14B]/25'
      : l.tier === 'silver' ? 'border-slate-300 ring-1 ring-slate-200'
      : 'border-slate-200';

  const heartSm = (
    <button onClick={onHeart} aria-label="Lưu tin" className={`w-9 h-9 grid place-items-center rounded-lg border transition shrink-0 ${fav ? 'border-red-200 text-red-500 bg-red-50' : 'border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200'}`}>
      <svg viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
    </button>
  );
  const tierBadge = l.tier && l.tier !== 'normal' && (
    <span className={`inline-flex items-center gap-0.5 text-white text-[9px] leading-none font-bold tracking-wide px-1.5 py-[3px] rounded-sm shadow-sm ${TIER_BADGE[l.tier] || 'bg-[#C8A14B]'}`}>
      {l.tier === 'diamond' && <svg viewBox="0 0 24 24" fill="currentColor" className="w-2 h-2 shrink-0"><path d="M6 2h12l4 6-10 14L2 8z" /></svg>}
      {(TIER_LABEL[l.tier] || 'VIP').toUpperCase()}
    </span>
  );
  const countBadge = nImg > 1 && <span className="absolute top-2 right-2 z-[2] bg-black/55 backdrop-blur text-white text-[11px] font-medium px-1.5 py-0.5 rounded-md">📷 {nImg}</span>;
  const priceRow = (big = false) => (
    <div className={`flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1.5`}>
      <span className={`text-red-600 font-extrabold leading-none ${big ? 'text-[17px]' : 'text-[15px]'}`}>{priceLabel(l.price, l.deal)}</span>
      {l.area != null && <span className="text-slate-700 text-sm">· {l.area} m²</span>}
      {perM2 != null && l.deal !== 'rent' && <span className="text-slate-400 text-[13px]">· {perM2.toFixed(1).replace('.', ',')} tr/m²</span>}
      {l.bedrooms != null && <span className="text-slate-500 text-[13px]">· 🛏 {l.bedrooms}</span>}
      {l.bathrooms != null && <span className="text-slate-500 text-[13px]">· 🛁 {l.bathrooms}</span>}
    </div>
  );
  const locRow = <div className="text-[13px] text-slate-500 mt-1 flex items-center gap-1 truncate"><IPin /> <span className="truncate">{l.ward ?? 'Cam Lâm'}, Khánh Hòa</span></div>;
  const agentFooter = (
    // Chân thẻ: bớt khoảng cách và thu ảnh đại diện 32 -> 28px cho thẻ gọn lại.
    <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center gap-2">
      {avatar
        ? <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0" />
        : <span className="w-7 h-7 rounded-full bg-[#0A2540] text-white grid place-items-center text-xs font-extrabold shrink-0">{String(agentName)[0]?.toUpperCase() || 'C'}</span>}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-700 truncate">{agentName}</div>
        <div className="text-[11px] text-slate-400">{posted}</div>
      </div>
      {agentPhone && <span className="inline-flex items-center gap-1 bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap shrink-0"><IPhone />{agentPhone}</span>}
      {heartSm}
    </div>
  );
  // Dải ảnh phụ (Vàng/Bạc & Kim cương thiếu ảnh) — cần ≥2 ảnh phụ, khe mỏng như batdongsan.
  const renderStrip = (mini = false) => stripN < 2 ? null : (
    <div className={`flex bg-white gap-0.5 mt-0.5 ${mini ? 'h-[72px]' : 'h-16'}`}>
      {l.images!.slice(1, 1 + stripN).map((u, i) => (
        <div key={i} className="flex-1 relative bg-slate-100 overflow-hidden">
          <img src={thumbUrl(u)} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).src = NO_IMG; }} className="absolute inset-0 w-full h-full object-cover" />
          {i === stripN - 1 && nImg > 1 + stripN && <div className="absolute inset-0 bg-black/45 grid place-items-center text-white text-xs font-bold">+{nImg - 1 - stripN}</div>}
        </div>
      ))}
    </div>
  );
  const titleCls = `font-semibold line-clamp-2 leading-snug ${l.tier === 'diamond' ? 'text-red-600 uppercase' : 'text-slate-800'}`;

  return (
    <Link href={href ?? `/listings/${l.id}`}
      // BO GÓC 4px, KHÔNG BO ẢNH — đo tận nơi trên batdongsan.com.vn:
      //   thẻ bo 4px · ảnh bo 0px · bóng rất nhạt rgba(44,44,44,.04) 0 4px 6px
      // Mình đang để rounded-xl (12px) nên góc ảnh bị cắt cong, nhìn mềm và "web mẫu".
      className={`cl-tap group block bg-white rounded border transition overflow-hidden hover:shadow-[0_4px_6px_rgba(44,44,44,0.10)] hover:border-slate-300 ${frameCls}`}>

      {/* ══════════ MOBILE — MỌI TIN đều ảnh bìa lớn 16:9; tin thường hiện 1 ảnh, VIP thêm dải ảnh phụ ══════════ */}
      <div className="md:hidden">
        <div className="relative aspect-[16/9] bg-slate-100">
          <img ref={fadeImg} onLoad={onImgLoad} src={img0} alt={l.title} onError={(e) => { (e.currentTarget as HTMLImageElement).src = NO_IMG; }} loading="lazy" decoding="async" className="cl-img absolute inset-0 w-full h-full object-cover" />
          <Watermark name={agentName} avatar={avatar} />
          <div className="absolute top-2 left-2 flex items-center gap-1 z-[1]">{tierBadge}{l.deal === 'rent' && <span className="bg-emerald-600 text-white text-[10px] leading-none font-extrabold px-1.5 py-1 rounded shadow">CHO THUÊ</span>}</div>
          {countBadge}
        </div>
        {renderStrip()}
        <div className="p-2.5">
          {verified && <div className="mb-1"><Verified /></div>}
          <h3 className={`text-[15px] ${titleCls}`}>{l.title}</h3>
          {priceRow(true)}
          {locRow}
          {agentFooter}
        </div>
      </div>

      {/* ══════════ DESKTOP (md+) — theo hạng, giống batdongsan ══════════ */}
      <div className="hidden md:block">
        {heroMosaic ? (
          /* KIM CƯƠNG: hero mosaic 1 lớn + 4 nhỏ (2×2), chi tiết bên dưới, full width */
          <>
            {/* CHIỀU CAO ẢNH — đã đo tận nơi trên batdongsan.com.vn rồi mới chọn:
                  thẻ thường của họ  313px, ảnh 141px
                  thẻ VIP của họ     484-504px, ảnh 141-284px
                  chữ nội dung 14px · giá 16px  (mình 14/13px · giá 15px — tương đương)
                Thẻ mình lúc đầu 438px với ảnh 248px.
                Đã thử 168px -> ẢNH BÉ QUÁ, dải ảnh nhìn bẹp, chủ dự án bảo không giống.
                Chốt 220px: thẻ còn khoảng 385px, ảnh vẫn ra tấm ra món, mà nhẹ hơn hẳn
                438px lúc đầu. Phần tiết kiệm còn lại lấy ở chân thẻ và thanh lọc chứ
                không lấy tiếp ở ảnh. */}
            <div className="flex gap-0.5 h-[220px]">
              <div className={`relative bg-slate-100 ${mThumbs.length ? 'flex-[1.9]' : 'flex-1'}`}>
                <img src={img0} alt={l.title} onError={(e) => { (e.currentTarget as HTMLImageElement).src = NO_IMG; }} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                <Watermark name={agentName} avatar={avatar} />
                <div className="absolute top-2 left-2 flex items-center gap-1 z-[1]">{tierBadge}{l.deal === 'rent' && <span className="bg-emerald-600 text-white text-[10px] leading-none font-extrabold px-1.5 py-1 rounded shadow">CHO THUÊ</span>}</div>
                {countBadge}
              </div>
              {mThumbs.length > 0 && (
                <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-0.5">
                  {mThumbs.map((u, i) => (
                    <div key={i} className={`relative bg-slate-100 overflow-hidden ${mSpan(i)}`}>
                      <img src={thumbUrl(u)} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).src = NO_IMG; }} className="absolute inset-0 w-full h-full object-cover" />
                      {i === mThumbs.length - 1 && nImg > 1 + mThumbs.length && <div className="absolute inset-0 bg-black/50 grid place-items-center text-white text-lg font-bold">+{nImg - 1 - mThumbs.length}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-3 pb-2.5 pt-2">
              {verified && <div className="mb-1"><Verified /></div>}
              <h3 className={`text-[15px] ${titleCls}`}>{l.title}</h3>
              {priceRow(true)}
              {locRow}
              {l.description && <p className="text-[13px] text-slate-500 mt-1 line-clamp-2">{l.description}</p>}
              {agentFooter}
            </div>
          </>
        ) : (
          /* VÀNG / BẠC / THƯỜNG: ngang — ảnh (+dải) trái, chi tiết phải */
          <div className="flex gap-3">
            <div className="shrink-0 self-stretch flex flex-col w-52">
              <div className="relative flex-1 min-h-[96px] bg-slate-100">
                <img src={img0} alt={l.title} onError={(e) => { (e.currentTarget as HTMLImageElement).src = NO_IMG; }} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                <Watermark name={agentName} avatar={avatar} />
                <div className="absolute top-2 left-2 right-2 flex flex-row flex-wrap items-center gap-1 z-[1]">{l.tier && l.tier !== 'normal' && <span className={`text-white text-[9px] leading-none font-extrabold px-1 py-1 rounded shadow whitespace-nowrap ${TIER_BADGE[l.tier] || 'bg-[#C8A14B]'}`}>{(TIER_LABEL[l.tier] || 'VIP').toUpperCase()}</span>}{l.deal === 'rent' && <span className="bg-emerald-600 text-white text-[9px] leading-none font-extrabold px-1 py-1 rounded shadow whitespace-nowrap">CHO THUÊ</span>}</div>
                {nImg > 1 && <span className="absolute top-2 right-2 z-[2] bg-black/55 backdrop-blur text-white text-[11px] font-medium px-1.5 py-0.5 rounded-md">📷 {nImg}</span>}
              </div>
              {renderStrip(true)}
            </div>
            <div className="flex-1 min-w-0 py-2 pr-2.5 flex flex-col">
              <div className="flex items-center gap-1.5">{verified && <Verified />}<h3 className={`text-[15px] group-hover:text-red-700 ${titleCls}`}>{l.title}</h3></div>
              {priceRow()}
              {locRow}
              {l.description && <p className="text-[13px] text-slate-500 mt-1 line-clamp-2">{l.description}</p>}
              {agentFooter}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

// Memo hoá: feed KHÔNG render lại khi cuộn (đổi state header) — chỉ render card khi dữ liệu tin đổi → mượt.
export default memo(ListingRow);
