'use client';
/* HAI Ô QUẢNG CÁO CẠNH TIN TỨC Ở TRANG CHỦ (5/10/2026).
   Admin nhập ở /admin → tab Quảng cáo → "2 ô quảng cáo trang chủ" (cất ở app_config, khoá `trangchu_ad`).
   - Ô nào có khách đặt, đang BẬT và CHƯA HẾT HẠN → hiện quảng cáo của khách, góc có chữ nhỏ "Quảng cáo"
     (Luật Quảng cáo: phải phân biệt được quảng cáo với nội dung của web).
   - Ô trống / tắt / quá ngày hết hạn → TỰ quay về thẻ của chính web (Bản đồ quy hoạch, Đăng tin) — không bao giờ để ô trống.
   Hết hạn là tự gỡ, admin không phải nhớ ngày mà tắt tay. */
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';

export interface OQc {
  bat?: boolean;        // bật/tắt ô
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
export interface CauHinhQc { o1?: OQc; o2?: OQc }

// Bộ màu dùng chung cho cả trang chủ lẫn ô xem trước trong trang quản trị. [nền, chữ nhãn, nền nút, chữ nút]
export const MAU_QC: Record<string, { ten: string; nen: string; nhan: string; nut: string; chuNut: string; chu: string }> = {
  do:    { ten: 'Đỏ đậm',   nen: 'linear-gradient(135deg,#a3121b,#6d0d14)', nhan: 'rgba(255,255,255,.75)', nut: '#fff',    chuNut: '#a3121b', chu: '#fff' },
  xanh:  { ten: 'Xanh đậm', nen: 'linear-gradient(135deg,#0A2540,#0d2f54)', nhan: '#C8A14B',               nut: '#C8A14B', chuNut: '#0A2540', chu: '#fff' },
  vang:  { ten: 'Vàng',     nen: 'linear-gradient(135deg,#C8A14B,#a8842f)', nhan: 'rgba(10,37,64,.75)',    nut: '#0A2540', chuNut: '#fff',    chu: '#0A2540' },
  xanhla:{ ten: 'Xanh lá',  nen: 'linear-gradient(135deg,#0f6b4a,#0a4d35)', nhan: 'rgba(255,255,255,.75)', nut: '#fff',    chuNut: '#0f6b4a', chu: '#fff' },
};

/** Ô này có đang chạy quảng cáo của khách không (bật + có tiêu đề + chưa quá hạn). */
export function dangChay(o?: OQc, homNay = new Date()): boolean {
  if (!o || o.bat === false || !o.tieuDe?.trim()) return false;
  if (o.hanDen) {
    const het = new Date(o.hanDen + 'T23:59:59+07:00'); // hết ngày hôm đó theo giờ Việt Nam
    if (!isNaN(+het) && het < homNay) return false;
  }
  return true;
}

/** Thẻ quảng cáo của khách — cùng khuôn với thẻ của web (điện thoại: ô nhỏ; máy tính: thẻ to). */
export function TheQc({ o, xemTruoc = false }: { o: OQc; xemTruoc?: boolean }) {
  const m = MAU_QC[o.mau || 'xanh'] || MAU_QC.xanh;
  const coAnh = !!o.anh?.trim();
  const chu = coAnh ? '#fff' : m.chu;
  const ngoai = /^https?:/i.test(o.link || '');
  const ruot = (
    <>
      {coAnh && <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={o.anh} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
      </>}
      {/* Chữ "Quảng cáo" nhỏ ở góc — bắt buộc để người xem phân biệt với nội dung của web */}
      <span className="absolute right-1.5 top-1.5 z-[1] rounded bg-black/35 px-1 py-px text-[8.5px] font-medium tracking-wide text-white/90 sm:right-2 sm:top-2 sm:text-[9.5px]">Quảng cáo</span>
      <span className="relative z-[1] flex h-full flex-col justify-between">
        <span>
          {o.nhan && <span className="block pr-12 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]" style={{ color: coAnh ? '#C8A14B' : m.nhan }}>{o.nhan}</span>}
          <span className="mt-1 block text-[13.5px] font-extrabold leading-tight line-clamp-2 sm:text-lg sm:line-clamp-3">{o.tieuDe}</span>
          {o.moTa && <span className={`mt-1.5 hidden text-xs leading-snug line-clamp-2 sm:block ${xemTruoc ? '!block' : ''}`} style={{ opacity: .85 }}>{o.moTa}</span>}
        </span>
        <span className="mt-1.5 block text-[11.5px] font-bold sm:mt-3 sm:hidden" style={{ color: coAnh ? '#C8A14B' : m.nhan }}>{o.nut || 'Xem ngay'} →</span>
        <span className="mt-3 hidden self-start rounded px-3 py-1.5 text-xs font-bold sm:inline-block" style={{ background: coAnh ? '#C8A14B' : m.nut, color: coAnh ? '#0A2540' : m.chuNut }}>{o.nut || 'Xem ngay'} →</span>
      </span>
    </>
  );
  const cls = 'relative flex flex-col overflow-hidden rounded-lg p-3 transition hover:brightness-110 active:scale-[.98] sm:block sm:min-h-[150px] sm:rounded-xl sm:p-5';
  const style = { background: coAnh ? '#0A2540' : m.nen, color: chu };
  if (xemTruoc || !o.link) return <div className={cls} style={style}>{ruot}</div>;
  // Link ra ngoài: mở tab mới + rel="sponsored" (Google yêu cầu đánh dấu link quảng cáo trả tiền, không thì bị phạt SEO)
  if (ngoai) return <a href={o.link} target="_blank" rel="sponsored noopener noreferrer" className={cls} style={style}>{ruot}</a>;
  if (/^(tel:|mailto:)/i.test(o.link)) return <a href={o.link} className={cls} style={style}>{ruot}</a>;
  return <Link href={o.link} className={cls} style={style}>{ruot}</Link>;
}

/** Cột hai ô: ô nào có khách thì thay, không thì giữ thẻ mặc định của web. */
export default function OQuangCaoTrangChu({ macDinh1, macDinh2 }: { macDinh1: ReactNode; macDinh2: ReactNode }) {
  const [ch, setCh] = useState<CauHinhQc>({});
  useEffect(() => {
    fetch('/api/config/trangchu_ad').then((r) => r.json())
      .then((d) => { if (d?.value && typeof d.value === 'object') setCh(d.value); }).catch(() => {});
  }, []);
  const o1 = dangChay(ch.o1) ? <TheQc o={ch.o1!} /> : macDinh1;
  const o2 = dangChay(ch.o2) ? <TheQc o={ch.o2!} /> : macDinh2;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:block sm:space-y-4">{o1}{o2}</div>
      {/* Lời mời đặt quảng cáo — chỉ trên máy tính, chữ nhỏ cho khỏi rối (điện thoại cần gọn) */}
      <Link href="/dichvu#quang-cao" className="mt-2 hidden text-right text-[11px] text-slate-400 hover:text-red-600 sm:block">Đặt quảng cáo tại vị trí này →</Link>
    </div>
  );
}
