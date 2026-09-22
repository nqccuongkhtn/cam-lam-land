'use client';
/* ============================================================================
 *  BANNER ĐỘNG Ở ĐẦU TRANG CHỦ
 * ----------------------------------------------------------------------------
 *  CÁCH XẾP LỚP (từ dưới lên):
 *    ① Ảnh nền dự phòng — ảnh của slide đầu, LUÔN nằm đó. Có nó thì lúc trang
 *       vừa mở, trước khi thư viện Swiper kịp chạy, người dùng đã thấy ảnh chứ
 *       không thấy mảng trắng.
 *    ② Swiper — chỉ lo phần ẢNH, không chứa chữ.
 *    ③ Lớp phủ tối — đổi theo slide đang chạy (mỗi slide chỉnh được độ đậm riêng).
 *    ④ Khối nội dung — CHỮ của slide + ô tìm kiếm (phần `children` truyền vào).
 *    ⑤ Nút điều khiển ‹ › , chấm tròn, nút tạm dừng — góc dưới bên phải.
 *
 *  VÌ SAO CHỮ KHÔNG NẰM TRONG SWIPER:
 *  Nếu nhét chữ vào trong slide thì mỗi slide chữ dài ngắn khác nhau → chiều cao
 *  banner nhảy lên nhảy xuống mỗi lần đổi ảnh, nhìn rất xấu. Nên chữ của MỌI
 *  slide xếp chồng lên nhau trong CÙNG MỘT Ô lưới, chỉ slide đang chạy mới hiện.
 *  Chiều cao lúc nào cũng bằng slide có chữ dài nhất → không bao giờ nhảy.
 *
 *  BẤM XUYÊN QUA: khối nội dung để `pointer-events-none`, chỉ những thứ bấm được
 *  (nút, ô tìm kiếm, chip) mới bật lại `pointer-events-auto`. Nhờ vậy vùng trống
 *  quanh chữ vẫn bấm/kéo được xuống banner bên dưới.
 * ========================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperGoc } from 'swiper';
import 'swiper/css';
import 'swiper/css/effect-fade';
import { BANNERS, lopPhu, tachTieuDe, type Slide } from '@/lib/banner';

/* ── Chữ của một slide ───────────────────────────────────────────────────── */
function ChuSlide({ s, hien, chayHieuUng }: { s: Slide; hien: boolean; chayHieuUng: boolean }) {
  return (
    <div
      // Xếp chồng: mọi slide cùng nằm ở ô lưới hàng 1 cột 1.
      className={`col-start-1 row-start-1 transition-opacity duration-500 ${hien ? 'opacity-100' : 'pointer-events-none opacity-0'} ${chayHieuUng && hien ? 'cl-hero-chu' : ''}`}
      aria-hidden={!hien}
    >
      {s.dongNhan ? (
        <p style={{ animationDelay: '.15s' }}
          className="text-[13px] sm:text-sm font-semibold tracking-wide text-[#FFD56A] drop-shadow">
          {s.dongNhan}
        </p>
      ) : null}

      {/* Tiêu đề slide dùng h2 — cả trang chỉ được MỘT thẻ h1, và thẻ h1 đó là
          tên thương hiệu (ẩn đi, để cho máy tìm kiếm đọc). */}
      <h2 style={{ animationDelay: '.3s' }}
        className="mt-1.5 max-w-3xl text-[26px] leading-[1.14] font-extrabold sm:text-[32px] md:text-[38px] line-clamp-2 drop-shadow-[0_3px_18px_rgba(0,0,0,0.55)]">
        {tachTieuDe(s.tieuDe).map((m, i) =>
          m.toMau ? <span key={i} className="text-[#FFD56A]">{m.chu}</span> : <span key={i}>{m.chu}</span>)}
      </h2>

      {s.moTa ? (
        <p style={{ animationDelay: '.45s' }}
          className="mt-2 max-w-2xl text-sm sm:text-base text-slate-100 line-clamp-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
          {s.moTa}
        </p>
      ) : null}

      {s.nutChu && s.nutLink ? (
        <div style={{ animationDelay: '.6s' }} className="mt-3.5">
          <Link href={s.nutLink}
            className="cl-press pointer-events-auto inline-flex items-center gap-1.5 rounded bg-[#C8A14B] px-5 py-2.5 text-sm font-bold text-[#0A2540] shadow-lg hover:bg-[#d8b45e]">
            {s.nutChu} <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function HeroBanner({ children }: { children: React.ReactNode }) {
  const slides = BANNERS;
  const nhieuSlide = slides.length > 1;

  const [idx, setIdx] = useState(0);
  const [daChuyen, setDaChuyen] = useState(false);   // đã đổi slide lần nào chưa
  const [nguoiDung, setNguoiDung] = useState(false); // người dùng bấm tạm dừng
  const [itChuyenDong, setItChuyenDong] = useState(false);

  const swRef = useRef<SwiperGoc | null>(null);
  const khungRef = useRef<HTMLElement | null>(null);
  const trongTam = useRef(true);   // banner còn nằm trong màn hình không
  const tabMo = useRef(true);      // người dùng còn đang mở tab này không

  /* Bật/tắt chạy tự động theo đủ mọi điều kiện — gom về một chỗ cho khỏi lệch. */
  const capNhatChay = useCallback(() => {
    const sw = swRef.current;
    if (!sw || !sw.autoplay) return;
    const nenChay = nhieuSlide && !nguoiDung && !itChuyenDong && trongTam.current && tabMo.current;
    if (nenChay) sw.autoplay.start();
    else sw.autoplay.stop();
  }, [nhieuSlide, nguoiDung, itChuyenDong]);

  /* Người dùng đã tắt hiệu ứng chuyển động trong hệ điều hành thì tôn trọng. */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const doc = () => setItChuyenDong(mq.matches);
    doc();
    mq.addEventListener?.('change', doc);
    return () => mq.removeEventListener?.('change', doc);
  }, []);

  /* Chuyển sang tab khác thì dừng — đỡ tốn pin và đỡ bỏ lỡ slide. */
  useEffect(() => {
    const doi = () => { tabMo.current = !document.hidden; capNhatChay(); };
    document.addEventListener('visibilitychange', doi);
    return () => document.removeEventListener('visibilitychange', doi);
  }, [capNhatChay]);

  /* Cuộn xuống dưới, banner khuất khỏi màn hình thì cũng dừng. */
  useEffect(() => {
    const el = khungRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const ob = new IntersectionObserver((mucs) => {
      trongTam.current = mucs[0]?.isIntersecting ?? true;
      capNhatChay();
    }, { threshold: 0.25 });
    ob.observe(el);
    return () => ob.disconnect();
  }, [capNhatChay]);

  useEffect(() => { capNhatChay(); }, [capNhatChay]);

  const phu = lopPhu(slides[idx]?.doPhu ?? 50);
  const dau = slides[0];

  return (
    <section ref={khungRef} className="relative overflow-hidden">
      {/* ① Ảnh nền dự phòng — chống mảng trắng lúc trang vừa mở, và là ảnh duy
             nhất khi chỉ có một slide hoặc khi Swiper vì lý do nào đó không chạy. */}
      {dau ? (
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dau.anh} alt="" aria-hidden="true" fetchPriority="high" decoding="async"
            className="h-full w-full object-cover"
            style={{ objectPosition: dau.tieuDiem || '50% 50%' }} />
        </div>
      ) : null}

      {/* ② Lớp ảnh chạy.
             ⚠️ BẪY ĐÃ VẤP: lúc đầu đặt thẳng `absolute inset-0` lên thẻ <Swiper>.
             Không ăn — chính CSS của thư viện Swiper (`.swiper { position: relative }`)
             ĐÈ LÊN class của Tailwind, nên nó nằm trong dòng và ĐẨY cả ô tìm kiếm
             xuống dưới ảnh: banner cao 1401px, ô tìm kiếm rơi khỏi màn hình.
             Cách chắc ăn: BỌC Swiper trong một thẻ div định vị sẵn, Swiper chỉ việc
             cao 100% bên trong. CSS thư viện không với tới thẻ bọc được. */}
      {nhieuSlide ? (
        <div className="absolute inset-0 z-0">
        <Swiper
          className="cl-hero-swiper h-full w-full"
          modules={[Autoplay, EffectFade, Keyboard]}
          effect="fade"
          fadeEffect={{ crossFade: true }}
          speed={1000}
          rewind
          allowTouchMove={false}     // kéo ngang ở đây dễ nhầm với cuộn trang
          keyboard={{ enabled: true, onlyInViewport: true }}
          autoplay={{ delay: 7000, disableOnInteraction: false, pauseOnMouseEnter: true }}
          onSwiper={(sw) => { swRef.current = sw; capNhatChay(); }}
          onSlideChange={(sw) => { setIdx(sw.activeIndex); setDaChuyen(true); }}
        >
          {slides.map((s, i) => (
            <SwiperSlide key={s.ma} data-swiper-autoplay={(s.giay ?? 7) * 1000}
              style={{ ['--lau' as string]: `${s.giay ?? 7}s` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.anh} alt={i === 0 ? s.moTaAnh : ''} aria-hidden={i !== 0}
                loading={i === 0 ? 'eager' : 'lazy'} decoding="async"
                style={{ objectPosition: s.tieuDiem || '50% 50%' }} />
            </SwiperSlide>
          ))}
        </Swiper>
        </div>
      ) : null}

      {/* ⚠️ BẪY THỨ HAI CỦA SWIPER: CSS của nó đặt `.swiper { z-index: 1 }`.
          Thẻ nào có z-index thì luôn nổi lên trên thẻ KHÔNG đặt z-index, bất kể
          thứ tự trong code. Nên lớp ảnh che mất cả chữ lẫn ô tìm kiếm dù chúng
          viết sau. => Phải đánh số lớp rõ ràng: ảnh 0 · lớp phủ 10 · nội dung 20
          · nút điều khiển 20. Đừng bỏ mấy số này đi. */}
      {/* ③ Lớp phủ tối — đổi theo slide đang chạy */}
      <div className="absolute inset-0 z-10 transition-[background] duration-700" style={{ background: phu.nen }} />
      <div className="absolute inset-0 z-10 hidden transition-[background] duration-700 sm:block" style={{ background: phu.ngang }} />
      <div className="absolute inset-0 z-10 transition-[background] duration-700 sm:hidden" style={{ background: phu.doc }} />
      <div className="absolute inset-x-0 top-0 z-10 h-40" style={{ background: phu.tren }} />
      <div className="absolute inset-x-0 bottom-0 z-10 h-36" style={{ background: phu.duoi }} />

      {/* ④ Nội dung */}
      <div className="pointer-events-none relative z-20 mx-auto max-w-7xl px-3 pb-16 pt-[calc(5rem_+_env(safe-area-inset-top))] text-white sm:px-4 sm:pb-24 sm:pt-24 md:pt-28">
        {/* Cả trang CHỈ MỘT thẻ h1, và nó ẩn đi cho máy tìm kiếm đọc. Bỏ hẳn thì
            Google mất chỗ bám, trang chủ tụt hạng. `sr-only` KHÁC display:none —
            display:none bị Google coi là giấu chữ. */}
        <h1 className="sr-only">Mua bán nhà đất và tra cứu bản đồ quy hoạch Cam Lâm, Khánh Hòa</h1>

        {/* Chữ các slide xếp chồng trong một ô lưới → chiều cao không đổi */}
        <div className="grid">
          {slides.map((s, i) => (
            <ChuSlide key={s.ma} s={s} hien={i === idx} chayHieuUng={daChuyen && !itChuyenDong} />
          ))}
        </div>

        <div className="pointer-events-auto mt-6">{children}</div>
      </div>

      {/* ⑤ Điều khiển — góc dưới phải, không đè lên ô tìm kiếm (bên trái) */}
      {nhieuSlide ? (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 sm:bottom-5 sm:right-5">
          <button type="button" aria-label="Banner trước"
            onClick={() => swRef.current?.slidePrev()}
            className="hidden h-8 w-8 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55 sm:grid">
            <span aria-hidden>‹</span>
          </button>

          {/* Chấm tròn — bấm được để nhảy thẳng tới banner đó */}
          <div className="flex items-center gap-1.5 px-1">
            {slides.map((s, i) => (
              <button key={s.ma} type="button"
                aria-label={`Tới banner ${i + 1}`}
                aria-current={i === idx ? 'true' : undefined}
                onClick={() => swRef.current?.slideTo(i)}
                className={`h-2 rounded-full transition-all ${i === idx ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`} />
            ))}
          </div>

          <button type="button" aria-label="Banner sau"
            onClick={() => swRef.current?.slideNext()}
            className="hidden h-8 w-8 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55 sm:grid">
            <span aria-hidden>›</span>
          </button>

          {/* Nút tạm dừng: quy chuẩn tiếp cận (WCAG 2.2.2) bắt buộc phải có cách
              dừng thứ gì đó tự chạy quá 5 giây. */}
          <button type="button"
            aria-label={nguoiDung ? 'Chạy lại banner' : 'Tạm dừng banner'}
            aria-pressed={nguoiDung}
            onClick={() => setNguoiDung((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-full bg-black/35 text-[11px] text-white backdrop-blur transition hover:bg-black/55">
            <span aria-hidden>{nguoiDung ? '▶' : '❚❚'}</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
