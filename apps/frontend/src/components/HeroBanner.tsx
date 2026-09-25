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
import { BANNERS, lopPhu, tachTu, type Slide } from '@/lib/banner';
import BannerHat from './BannerHat';

/* ── Chữ của một slide, hiện ra LẦN LƯỢT kiểu quảng cáo HTML5 ─────────────── */
function ChuSlide({ s, hien, chayHieuUng }: { s: Slide; hien: boolean; chayHieuUng: boolean }) {
  const tu = tachTu(s.tieuDe);

  /* Gom các từ LIỀN NHAU cùng màu thành một "cụm".
     Vì sao phải gom: lúc đầu mỗi từ tô màu tự kẻ một gạch chân riêng, nên
     "Cam Lâm" ra hai nét rời có khe ở giữa, nhìn cụt lủn. Gom lại thì cả cụm
     chỉ có MỘT nét liền — mà từng từ bên trong vẫn hiện lần lượt như cũ. */
  const cum: { toMau: boolean; tu: string[] }[] = [];
  for (const t of tu) {
    const cuoi = cum[cum.length - 1];
    if (cuoi && cuoi.toMau === t.toMau) cuoi.tu.push(t.chu);
    else cum.push({ toMau: t.toMau, tu: [t.chu] });
  }

  // Mỗi từ chậm hơn từ trước 70ms.
  let dem = 0;
  const tre = () => 0.34 + 0.07 * dem++;
  const treTu = cum.map((c) => c.tu.map((x) => (/^\s+$/.test(x) ? -1 : tre())));
  const treCuoi = 0.34 + 0.07 * dem;
  const hu = (x: string) => (chayHieuUng && hien ? x : '');

  return (
    <div
      // Xếp chồng: mọi slide cùng nằm ở ô lưới hàng 1 cột 1 → chiều cao không nhảy.
      className={`col-start-1 row-start-1 transition-opacity duration-500 ${hien ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      aria-hidden={!hien}
    >
      {s.dongNhan ? (
        <p className={`cl-bn-vien text-[13px] font-semibold tracking-wide text-[#FFD56A] sm:text-sm ${hu('cl-bn-nhan')}`}
          style={{ animationDelay: '.12s' }}>
          <span className={hu('cl-bn-sao')}>★</span> {s.dongNhan.replace(/^★\s*/, '')}
        </p>
      ) : null}

      {/* Tiêu đề slide dùng h2 — cả trang chỉ được MỘT thẻ h1, và h1 đó là tên
          thương hiệu (ẩn đi cho máy tìm kiếm đọc). */}
      <h2 className="cl-bn-vien mt-1.5 max-w-3xl text-[26px] font-extrabold leading-[1.14] sm:text-[32px] md:text-[38px]">
        {cum.map((c, ci) => {
          const chu = c.tu.map((x, i) =>
            /^\s+$/.test(x) ? <span key={i}> </span> : (
              <span key={i} className={hu('cl-bn-tu')} style={{ animationDelay: `${treTu[ci][i]}s` }}>{x}</span>
            ));
          if (!c.toMau) return <span key={ci}>{chu}</span>;
          const treGach = Math.max(...treTu[ci]) + 0.25;
          return (
            <span key={ci} className={`relative inline-block text-[#FFD56A] ${hu('cl-bn-lanh')}`}>
              {chu}
              <span aria-hidden
                className={`absolute -bottom-0.5 left-0 h-[3px] w-full rounded-full bg-[#C8A14B]/85 ${hu('cl-bn-gach')}`}
                style={{ animationDelay: `${treGach}s` }} />
            </span>
          );
        })}
      </h2>

      {s.moTa ? (
        <p className={`cl-bn-vien mt-2.5 max-w-2xl text-sm text-white sm:text-base ${hu('cl-bn-mota')}`}
          style={{ animationDelay: `${treCuoi + 0.05}s` }}>
          {s.moTa}
        </p>
      ) : null}

      {s.nutChu && s.nutLink ? (
        <div className="mt-4">
          <Link href={s.nutLink}
            className={`cl-press pointer-events-auto inline-flex items-center gap-1.5 rounded bg-[#C8A14B] px-5 py-2.5 text-sm font-bold text-[#0B4045] shadow-lg hover:bg-[#d8b45e] ${hu('cl-bn-nut')}`}
            style={{ animationDelay: `${treCuoi + 0.2}s` }}>
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
  const [chayNen, setChayNen] = useState(false); // lớp hạt sáng có đang vẽ không

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
    // Lớp hạt sáng cũng theo đúng điều kiện đó — banner khuất hoặc đang tạm dừng
    // thì ngừng vẽ luôn, khỏi ngốn pin.
    setChayNen(!nguoiDung && !itChuyenDong && trongTam.current && tabMo.current);
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
              {/* ⚠️ ĐỪNG ĐỂ loading="lazy" CHO CÁC SLIDE SAU.
                  Đã thử và hỏng: slide 2, 3 nằm trong khung nhìn nhưng đang mờ
                  (opacity 0) nên trình duyệt hoãn tải. Đến lúc chuyển tới thì ảnh
                  chưa có, người dùng thấy MẢNG TỐI TRỐNG vài giây.
                  Cách đúng: tải sẵn hết, nhưng slide đầu ưu tiên CAO (nó là thứ
                  quyết định tốc độ hiện trang), mấy slide sau ưu tiên THẤP để
                  không giành băng thông lúc mới vào trang. */}
              <img src={s.anh} alt={i === 0 ? s.moTaAnh : ''} aria-hidden={i !== 0}
                loading="eager" fetchPriority={i === 0 ? 'high' : 'low'} decoding="async"
                style={{ objectPosition: s.tieuDiem || '50% 50%' }} />
            </SwiperSlide>
          ))}
        </Swiper>
        </div>
      ) : null}

      {/* Lớp hạt sáng lấp lánh — thứ làm banner "động" thật sự */}
      <BannerHat chay={chayNen} />

      {/* Vệt nắng quét ngang một lần mỗi khi đổi slide, như ánh nắng loé trên mặt nước.
          Gắn `key` theo số thứ tự slide để mỗi lần đổi slide là hiệu ứng chạy lại từ đầu. */}
      {!itChuyenDong ? (
        <div key={idx} aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          <div className="cl-bn-quet absolute inset-y-0 -left-1/3 w-1/4"
            style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.22) 50%, rgba(255,255,255,0) 100%)' }} />
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

      {/* Sóng chạy ở mép dưới — hai lớp lệch tốc độ cho có chiều sâu.
          Đặt z-10 nên nằm trên ảnh, dưới chữ. Không bấm được. */}
      {!itChuyenDong ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 overflow-hidden sm:h-24">
          <svg className="cl-bn-song absolute bottom-0 left-0 h-full" style={{ ['--toc' as string]: '22s' }}
            viewBox="0 0 1600 120" preserveAspectRatio="none">
            <path d="M0,70 C120,100 240,40 400,60 C560,80 680,30 800,55 C920,80 1040,40 1200,62 C1360,84 1480,50 1600,70 L1600,120 L0,120 Z"
              fill="rgba(255,255,255,0.10)" />
            <path d="M1600,70 C1720,100 1840,40 2000,60 C2160,80 2280,30 2400,55 C2520,80 2640,40 2800,62 C2960,84 3080,50 3200,70 L3200,120 L1600,120 Z"
              fill="rgba(255,255,255,0.10)" />
          </svg>
          <svg className="cl-bn-song absolute bottom-0 left-0 h-full" style={{ ['--toc' as string]: '14s' }}
            viewBox="0 0 1600 120" preserveAspectRatio="none">
            <path d="M0,88 C140,110 260,66 420,82 C580,98 700,60 840,80 C980,100 1100,66 1240,84 C1380,102 1490,74 1600,88 L1600,120 L0,120 Z"
              fill="rgba(255,255,255,0.16)" />
            <path d="M1600,88 C1740,110 1860,66 2020,82 C2180,98 2300,60 2440,80 C2580,100 2700,66 2840,84 C2980,102 3090,74 3200,88 L3200,120 L1600,120 Z"
              fill="rgba(255,255,255,0.16)" />
          </svg>
        </div>
      ) : null}

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
                className={`relative h-2 overflow-hidden rounded-full transition-all ${i === idx ? 'w-7 bg-white/35' : 'w-2 bg-white/50 hover:bg-white/80'}`}>
                {/* Chấm đang chạy có thanh trắng bò dần — nhìn là biết còn bao lâu
                    thì sang banner sau. `key` đổi theo slide để chạy lại từ đầu. */}
                {i === idx ? (
                  <span key={`${s.ma}-${idx}-${nguoiDung}`} aria-hidden
                    className={`absolute inset-y-0 left-0 block rounded-full bg-white ${nguoiDung || itChuyenDong ? 'w-full' : 'cl-bn-dem'}`}
                    style={{ ['--lau' as string]: `${s.giay ?? 7}s` }} />
                ) : null}
              </button>
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
