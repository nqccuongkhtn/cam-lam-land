'use client';
/* ============================================================================
 *  LỚP HẠT SÁNG LẤP LÁNH TRÊN BANNER  (vẽ bằng canvas)
 * ----------------------------------------------------------------------------
 *  Đây là thứ làm banner "động" thật sự chứ không chỉ là ảnh đứng yên: những
 *  đốm sáng mờ trôi chậm lên trên, giống nắng loé trên mặt nước Bãi Dài.
 *
 *  VÌ SAO DÙNG CANVAS CHỨ KHÔNG PHẢI 40 THẺ DIV:
 *  40 thẻ div cùng chạy hiệu ứng là 40 lớp trình duyệt phải vẽ lại mỗi khung
 *  hình — máy yếu và điện thoại tụt ngay. Canvas chỉ là MỘT lớp duy nhất.
 *
 *  GIỮ CHO NHẸ — mấy điều kiện dưới đây đừng bỏ:
 *   · Dừng hẳn vòng vẽ khi banner bị che, khi đổi sang tab khác, hoặc khi người
 *     dùng bấm tạm dừng. Không để nó chạy nền ngốn pin.
 *   · Máy đặt "giảm chuyển động" thì KHÔNG vẽ gì cả.
 *   · Màn nhỏ thì ít hạt lại.
 *   · Lớp này chỉ để nhìn, không bấm được (pointer-events-none) — nếu không nó
 *     sẽ nuốt mất cú bấm vào ô tìm kiếm bên dưới.
 * ========================================================================== */
import { useEffect, useRef } from 'react';

interface Hat { x: number; y: number; r: number; toc: number; mo: number; pha: number }

export default function BannerHat({ chay }: { chay: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    // Máy đã bật "giảm chuyển động" thì thôi, không vẽ.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let rong = 0, cao = 0, ti = 1;
    let hat: Hat[] = [];
    let khung = 0;
    let dangChay = true;

    const dungLai = () => {
      const r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return;
      ti = Math.min(window.devicePixelRatio || 1, 2); // 2 là đủ nét, cao hơn chỉ tốn máy
      rong = r.width; cao = r.height;
      cv.width = Math.round(rong * ti);
      cv.height = Math.round(cao * ti);
      ctx.setTransform(ti, 0, 0, ti, 0, 0);

      const so = rong < 640 ? 16 : rong < 1100 ? 26 : 38;
      hat = Array.from({ length: so }, () => ({
        x: Math.random() * rong,
        y: Math.random() * cao,
        r: 0.8 + Math.random() * 2.6,
        toc: 0.08 + Math.random() * 0.26,   // trôi lên rất chậm
        mo: 0.12 + Math.random() * 0.4,
        pha: Math.random() * Math.PI * 2,
      }));
    };

    const ve = () => {
      if (!dangChay) return;
      ctx.clearRect(0, 0, rong, cao);
      const t = performance.now() / 1000;
      for (const h of hat) {
        h.y -= h.toc;
        if (h.y < -6) { h.y = cao + 6; h.x = Math.random() * rong; }
        // nhấp nháy nhẹ cho khỏi đều tăm tắp như đèn led
        const mo = h.mo * (0.6 + 0.4 * Math.sin(t * 1.1 + h.pha));
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,246,214,${mo.toFixed(3)})`;
        ctx.fill();
      }
      khung = requestAnimationFrame(ve);
    };

    dungLai();
    const ro = new ResizeObserver(dungLai);
    ro.observe(cv);

    if (chay) { dangChay = true; khung = requestAnimationFrame(ve); }
    else { dangChay = false; ctx.clearRect(0, 0, rong, cao); }

    return () => { dangChay = false; cancelAnimationFrame(khung); ro.disconnect(); };
  }, [chay]);

  return (
    <canvas ref={ref} aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 h-full w-full" />
  );
}
