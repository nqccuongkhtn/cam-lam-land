'use client';
/* HAI Ô QUẢNG CÁO CẠNH TIN TỨC Ở TRANG CHỦ (5/10/2026).
   Admin nhập ở /admin → tab Quảng cáo → "2 ô quảng cáo trang chủ" (cất ở app_config, khoá `trangchu_ad`).
   - MỖI Ô CHỨA ĐƯỢC NHIỀU QUẢNG CÁO, tự TRƯỢT luân phiên như các web khác (5 giây/quảng cáo, có chấm chuyển,
     điện thoại vuốt được, rê chuột vào thì dừng). Ô 2 trượt lệch nửa nhịp với ô 1 cho khỏi giật cùng lúc.
   - Quảng cáo có ảnh nền thì chạy kiểu "banner động": ảnh phóng chậm, chữ trồi lên, nút có vệt sáng lướt qua.
   - Quảng cáo nào tắt / thiếu tiêu đề / quá ngày hết hạn thì tự bỏ ra. Ô hết sạch quảng cáo → quay về thẻ của web
     (Bản đồ quy hoạch, Đăng tin) — không bao giờ để ô trống, admin không phải nhớ ngày mà gỡ tay.
   - Góc mỗi quảng cáo có chữ nhỏ "Quảng cáo" (Luật Quảng cáo: phải phân biệt được với nội dung của web). */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';

export interface OQc {
  id?: string;          // mã riêng (để trang quản trị phân biệt khi thêm/xoá)
  bat?: boolean;        // bật/tắt quảng cáo này
  khach?: string;       // tên khách đặt (để admin nhớ, không hiện ra ngoài)
  nhan?: string;        // nhãn nhỏ phía trên, vd "DỰ ÁN MỚI"
  tieuDe?: string;      // tiêu đề chính
  moTa?: string;        // một dòng mô tả (chỉ hiện trên máy tính)
  nut?: string;         // chữ nút, vd "Xem dự án"
  link?: string;        // bấm vào đi đâu: /listings/123, https://..., tel:09..., https://zalo.me/09...
  anh?: string;         // ảnh nền (không bắt buộc)
  mau?: string;         // bộ màu khi không có ảnh: do | xanh | vang | xanhla
  hanDen?: string;      // ngày hết hạn YYYY-MM-DD (rỗng = không hạn)
}
// Bản đầu (sáng 5/10) mỗi ô chỉ 1 quảng cáo → o1/o2 có thể là 1 quảng cáo lẻ, vẫn đọc được.
export interface CauHinhQc { o1?: OQc[] | OQc; o2?: OQc[] | OQc }
export const dsCua = (v?: OQc[] | OQc): OQc[] => (Array.isArray(v) ? v : v ? [v] : []);

// Bộ màu khi quảng cáo không có ảnh — dùng chung cho trang chủ lẫn ô xem trước trong trang quản trị.
export const MAU_QC: Record<string, { ten: string; nen: string; nhan: string; nut: string; chuNut: string; chu: string }> = {
  do:    { ten: 'Đỏ đậm',   nen: 'linear-gradient(135deg,#a3121b,#6d0d14)', nhan: 'rgba(255,255,255,.75)', nut: '#fff',    chuNut: '#a3121b', chu: '#fff' },
  xanh:  { ten: 'Xanh đậm', nen: 'linear-gradient(135deg,#0A2540,#0d2f54)', nhan: '#C8A14B',               nut: '#C8A14B', chuNut: '#0A2540', chu: '#fff' },
  vang:  { ten: 'Vàng',     nen: 'linear-gradient(135deg,#C8A14B,#a8842f)', nhan: 'rgba(10,37,64,.75)',    nut: '#0A2540', chuNut: '#fff',    chu: '#0A2540' },
  xanhla:{ ten: 'Xanh lá',  nen: 'linear-gradient(135deg,#0f6b4a,#0a4d35)', nhan: 'rgba(255,255,255,.75)', nut: '#fff',    chuNut: '#0f6b4a', chu: '#fff' },
};

/** Quảng cáo này có đang chạy không (bật + có tiêu đề + chưa quá hạn). */
export function dangChay(o?: OQc, homNay = new Date()): boolean {
  if (!o || o.bat === false || !o.tieuDe?.trim()) return false;
  if (o.hanDen) {
    const het = new Date(o.hanDen + 'T23:59:59+07:00'); // hết ngày hôm đó theo giờ Việt Nam
    if (!isNaN(+het) && het < homNay) return false;
  }
  return true;
}

/* Hiệu ứng "banner động". Chỉ chạy khi thẻ đang được hiện (.on) → mỗi lần trượt tới là chữ trồi lên lại.
   Người dùng bật "giảm chuyển động" trong máy thì tắt hết. */
const CSS = `
@keyframes clqc-phong{from{transform:scale(1)}to{transform:scale(1.14)}}
@keyframes clqc-troi{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes clqc-sang{0%,55%{left:-40%}100%{left:130%}}
.clqc-the.on .clqc-anh{animation:clqc-phong 7s ease-out both}
.clqc-the.on .clqc-c1{animation:clqc-troi .55s .15s cubic-bezier(.2,.8,.2,1) both}
.clqc-the.on .clqc-c2{animation:clqc-troi .55s .3s cubic-bezier(.2,.8,.2,1) both}
.clqc-the.on .clqc-c3{animation:clqc-troi .55s .45s cubic-bezier(.2,.8,.2,1) both}
.clqc-the.on .clqc-c4{animation:clqc-troi .55s .6s cubic-bezier(.2,.8,.2,1) both}
.clqc-nut{position:relative;overflow:hidden}
.clqc-nut::after{content:'';position:absolute;top:0;bottom:0;left:-40%;width:30%;background:rgba(255,255,255,.55);filter:blur(3px);transform:skewX(-20deg);animation:clqc-sang 3.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.clqc-the *,.clqc-the *::after,.clqc-ray{animation:none!important;transition:none!important}}
`;

/** Một thẻ quảng cáo — cùng khuôn với thẻ của web (điện thoại: ô nhỏ; máy tính: thẻ to). */
export function TheQc({ o, on = true, xemTruoc = false }: { o: OQc; on?: boolean; xemTruoc?: boolean }) {
  const m = MAU_QC[o.mau || 'xanh'] || MAU_QC.xanh;
  const coAnh = !!o.anh?.trim();
  const ngoai = /^https?:/i.test(o.link || '');
  const nhanMau = coAnh ? '#C8A14B' : m.nhan;
  const ruot = (
    <>
      {coAnh && <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={o.anh} alt="" loading="lazy" draggable={false} className="clqc-anh absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
      </>}
      {/* Chữ "Quảng cáo" nhỏ ở góc — bắt buộc để người xem phân biệt với nội dung của web */}
      <span className="absolute right-1.5 top-1.5 z-[1] rounded bg-black/35 px-1 py-px text-[8.5px] font-medium tracking-wide text-white/90 sm:right-2 sm:top-2 sm:text-[9.5px]">Quảng cáo</span>
      <span className="relative z-[1] flex h-full flex-col justify-between">
        <span>
          {o.nhan && <span className="clqc-c1 block pr-12 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]" style={{ color: nhanMau }}>{o.nhan}</span>}
          <span className="clqc-c2 mt-1 block text-[13.5px] font-extrabold leading-tight line-clamp-2 sm:text-lg sm:line-clamp-3">{o.tieuDe}</span>
          {o.moTa && <span className={`clqc-c3 mt-1.5 hidden text-xs leading-snug line-clamp-2 sm:block ${xemTruoc ? '!block' : ''}`} style={{ opacity: .85 }}>{o.moTa}</span>}
        </span>
        <span className="clqc-c4 mt-1.5 block text-[11.5px] font-bold sm:hidden" style={{ color: nhanMau }}>{o.nut || 'Xem ngay'} →</span>
        <span className="clqc-c4 sm:mt-3 hidden sm:block"><span className="clqc-nut inline-block rounded px-3 py-1.5 text-xs font-bold" style={{ background: coAnh ? '#C8A14B' : m.nut, color: coAnh ? '#0A2540' : m.chuNut }}>{o.nut || 'Xem ngay'} →</span></span>
      </span>
    </>
  );
  const cls = `clqc-the ${on ? 'on' : ''} relative flex h-full w-full flex-col overflow-hidden rounded-lg p-3 pb-4 select-none sm:block sm:min-h-[172px] sm:rounded-xl sm:p-5 sm:pb-6`;
  const style = { background: coAnh ? '#0A2540' : m.nen, color: coAnh ? '#fff' : m.chu };
  // Thẻ đang khuất (chờ trượt tới) thì không cho bấm phím Tab tới, đỡ nhầm
  const tab = on ? undefined : -1;
  if (xemTruoc || !o.link) return <div className={cls} style={style}>{ruot}</div>;
  // Link ra ngoài: mở tab mới + rel="sponsored" (Google yêu cầu đánh dấu link quảng cáo trả tiền, không thì bị phạt SEO)
  if (ngoai) return <a href={o.link} target="_blank" rel="sponsored noopener noreferrer" tabIndex={tab} className={cls} style={style}>{ruot}</a>;
  if (/^(tel:|mailto:)/i.test(o.link)) return <a href={o.link} tabIndex={tab} className={cls} style={style}>{ruot}</a>;
  return <Link href={o.link} tabIndex={tab} className={cls} style={style}>{ruot}</Link>;
}

/** Một ô: nhiều quảng cáo trượt ngang luân phiên. `lech` = trễ nhịp đầu (ms) để hai ô không trượt cùng lúc. */
export function TruotQc({ ds, lech = 0, xemTruoc = false }: { ds: OQc[]; lech?: number; xemTruoc?: boolean }) {
  const [i, setI] = useState(0);
  const [dung, setDung] = useState(false);
  const cham = useRef<{ x: number; y: number } | null>(null);
  const keo = useRef(false);
  const n = ds.length;
  const den = useCallback((k: number) => setI(((k % n) + n) % n), [n]);
  useEffect(() => { if (i >= n) setI(0); }, [n, i]);
  useEffect(() => {
    if (n < 2 || dung) return;
    let t: ReturnType<typeof setInterval> | undefined;
    const d = setTimeout(() => { setI((k) => (k + 1) % n); t = setInterval(() => setI((k) => (k + 1) % n), 5000); }, 5000 + lech);
    return () => { clearTimeout(d); if (t) clearInterval(t); };
  }, [n, dung, lech]);
  if (!n) return null;
  if (n === 1) return <TheQc o={ds[0]} xemTruoc={xemTruoc} />;
  return (
    <div className="relative overflow-hidden rounded-lg sm:rounded-xl"
      onMouseEnter={() => setDung(true)} onMouseLeave={() => setDung(false)}
      onTouchStart={(e) => { cham.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; keo.current = false; setDung(true); }}
      onTouchEnd={(e) => {
        const c = cham.current; cham.current = null; setDung(false);
        if (!c) return;
        const dx = e.changedTouches[0].clientX - c.x, dy = e.changedTouches[0].clientY - c.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { keo.current = true; den(i + (dx < 0 ? 1 : -1)); }
      }}
      // Vuốt để chuyển thì không tính là bấm vào quảng cáo
      onClickCapture={(e) => { if (keo.current) { e.preventDefault(); e.stopPropagation(); keo.current = false; } }}>
      <div className="clqc-ray flex h-full transition-transform duration-[650ms] ease-[cubic-bezier(.5,0,.25,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
        {ds.map((o, k) => <div key={o.id || k} className="w-full shrink-0" aria-hidden={k !== i}><TheQc o={o} on={k === i} xemTruoc={xemTruoc} /></div>)}
      </div>
      {/* Chấm chuyển quảng cáo */}
      <div className="absolute inset-x-0 bottom-1 z-[2] flex justify-center gap-1 sm:bottom-2">
        {ds.map((o, k) => (
          <button key={o.id || k} type="button" aria-label={`Quảng cáo ${k + 1}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); den(k); }}
            className={`h-1.5 rounded-full transition-all ${k === i ? 'w-4 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/70'}`} />
        ))}
      </div>
    </div>
  );
}

export function CssQc() { return <style dangerouslySetInnerHTML={{ __html: CSS }} />; }

/** Cột hai ô: ô nào có quảng cáo đang chạy thì trượt luân phiên, không thì giữ thẻ mặc định của web. */
export default function OQuangCaoTrangChu({ macDinh1, macDinh2 }: { macDinh1: ReactNode; macDinh2: ReactNode }) {
  const [ch, setCh] = useState<CauHinhQc>({});
  useEffect(() => {
    fetch('/api/config/trangchu_ad').then((r) => r.json())
      .then((d) => { if (d?.value && typeof d.value === 'object') setCh(d.value); }).catch(() => {});
  }, []);
  const ds1 = dsCua(ch.o1).filter((o) => dangChay(o));
  const ds2 = dsCua(ch.o2).filter((o) => dangChay(o));
  return (
    <div>
      <CssQc />
      <div className="grid grid-cols-2 gap-2.5 sm:block sm:space-y-4">
        {ds1.length ? <TruotQc ds={ds1} /> : macDinh1}
        {ds2.length ? <TruotQc ds={ds2} lech={2500} /> : macDinh2}
      </div>
      {/* Lời mời đặt quảng cáo — chỉ trên máy tính, chữ nhỏ cho khỏi rối (điện thoại cần gọn) */}
      <Link href="/dichvu#quang-cao" className="mt-2 hidden text-right text-[11px] text-slate-400 hover:text-red-600 sm:block">Đặt quảng cáo tại vị trí này →</Link>
    </div>
  );
}
