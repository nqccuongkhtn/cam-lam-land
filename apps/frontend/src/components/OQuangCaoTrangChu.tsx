'use client';
/* HAI Ô QUẢNG CÁO CẠNH TIN TỨC Ở TRANG CHỦ (5/10/2026).
   Admin nhập ở /admin → tab Quảng cáo → "2 ô quảng cáo trang chủ" (cất ở app_config, khoá `trangchu_ad`).
   - MỖI Ô CHỨA ĐƯỢC NHIỀU QUẢNG CÁO, tự TRƯỢT luân phiên như các web khác (5 giây/quảng cáo, có chấm chuyển,
     điện thoại vuốt được, rê chuột vào thì dừng). Hai ô trượt CÙNG LÚC (chung một đồng hồ).
   - Khung quảng cáo khoá ĐÚNG cỡ thẻ gốc của web (thẻ gốc nằm ẩn bên dưới giữ chỗ).
   - Quảng cáo có ảnh nền: ảnh phóng thật chậm, thật nhẹ; phủ một lớp tối đều để chữ trắng luôn đọc rõ.
     (Bản đầu có chữ trồi lên + nút vàng có vệt sáng chạy → chủ dự án chê "màu mè", 5/10/2026 làm dịu lại.)
   - Quảng cáo nào tắt / thiếu tiêu đề / quá ngày hết hạn thì tự bỏ ra. Ô hết sạch quảng cáo → quay về thẻ của web
     (Bản đồ quy hoạch, Đăng tin) — không bao giờ để ô trống, admin không phải nhớ ngày mà gỡ tay.
   - Góc mỗi quảng cáo có chữ nhỏ "Quảng cáo" (Luật Quảng cáo: phải phân biệt được với nội dung của web). */
import { useEffect, useRef, useState, type ReactNode } from 'react';
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

/* Chuyển động duy nhất trong thẻ: ảnh nền phóng rất chậm (4% trong 8 giây) — gần như không nhận ra,
   chỉ đủ cho ảnh "sống". Người dùng bật "giảm chuyển động" trong máy thì tắt hết. */
const CSS = `
@keyframes clqc-phong{from{transform:scale(1)}to{transform:scale(1.04)}}
.clqc-the.on .clqc-anh{animation:clqc-phong 8s ease-out both}
@media (prefers-reduced-motion:reduce){.clqc-the *,.clqc-ray{animation:none!important;transition:none!important}}
`;

/** Một thẻ quảng cáo — cùng khuôn với thẻ của web (điện thoại: ô nhỏ; máy tính: thẻ to). */
export function TheQc({ o, on = true, xemTruoc = false, coMoTa = true }: { o: OQc; on?: boolean; xemTruoc?: boolean; coMoTa?: boolean }) {
  const m = MAU_QC[o.mau || 'xanh'] || MAU_QC.xanh;
  const coAnh = !!o.anh?.trim();
  const ngoai = /^https?:/i.test(o.link || '');
  // Có ảnh: nhãn trắng mờ (vàng nhỏ trên ảnh rối thì không đọc nổi), nút nền trắng chữ xanh đậm
  const nhanMau = coAnh ? 'rgba(255,255,255,.75)' : m.nhan;
  const ruot = (
    <>
      {coAnh && <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={o.anh} alt="" loading="lazy" draggable={false} className="clqc-anh absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden className="absolute inset-0 bg-black/55" />
      </>}
      {/* Chữ "Quảng cáo" nhỏ ở góc — bắt buộc để người xem phân biệt với nội dung của web */}
      <span className="absolute right-1.5 top-1.5 z-[1] rounded bg-black/35 px-1 py-px text-[8.5px] font-medium tracking-wide text-white/90 sm:right-2 sm:top-2 sm:text-[9.5px]">Quảng cáo</span>
      <span className="relative z-[1] flex h-full flex-col justify-between">
        <span>
          {o.nhan && <span className="block truncate pr-14 text-[10px] font-semibold uppercase tracking-wide sm:pr-16 sm:text-[11px]" style={{ color: nhanMau }}>{o.nhan}</span>}
          <span className="mt-1 block text-[13.5px] font-extrabold leading-tight line-clamp-2 sm:text-lg">{o.tieuDe}</span>
          {/* Mô tả chỉ có ở ô mà thẻ gốc của web cũng có mô tả (ô 1) — ô 2 thẻ gốc thấp hơn, thêm mô tả là tràn khung */}
          {o.moTa && coMoTa && <span className={`mt-1.5 hidden text-xs leading-snug line-clamp-1 sm:block ${xemTruoc ? '!block' : ''}`} style={{ opacity: .85 }}>{o.moTa}</span>}
        </span>
        <span className="mt-1.5 block truncate pr-9 text-[11.5px] font-bold sm:hidden" style={{ color: nhanMau }}>{o.nut || 'Xem ngay'} →</span>
        <span className="sm:mt-3 hidden sm:block"><span className="inline-block rounded px-3 py-1.5 text-xs font-bold" style={{ background: coAnh ? '#fff' : m.nut, color: coAnh ? '#0A2540' : m.chuNut }}>{o.nut || 'Xem ngay'} →</span></span>
      </span>
    </>
  );
  const cls = `clqc-the ${on ? 'on' : ''} relative flex h-full w-full flex-col overflow-hidden rounded-lg p-3 select-none sm:rounded-xl sm:p-5`;
  const style = { background: coAnh ? '#0A2540' : m.nen, color: coAnh ? '#fff' : m.chu };
  // Thẻ đang khuất (chờ trượt tới) thì không cho bấm phím Tab tới, đỡ nhầm
  const tab = on ? undefined : -1;
  if (xemTruoc || !o.link) return <div className={cls} style={style}>{ruot}</div>;
  // Link ra ngoài: mở tab mới + rel="sponsored" (Google yêu cầu đánh dấu link quảng cáo trả tiền, không thì bị phạt SEO)
  if (ngoai) return <a href={o.link} target="_blank" rel="sponsored noopener noreferrer" tabIndex={tab} className={cls} style={style}>{ruot}</a>;
  if (/^(tel:|mailto:)/i.test(o.link)) return <a href={o.link} tabIndex={tab} className={cls} style={style}>{ruot}</a>;
  return <Link href={o.link} tabIndex={tab} className={cls} style={style}>{ruot}</Link>;
}

/** Một ô: nhiều quảng cáo trượt ngang. Số thứ tự `buoc` do bên ngoài giữ — HAI Ô DÙNG CHUNG một bước
    nên luôn trượt CÙNG LÚC (chủ dự án 5/10/2026: lệch nhịp nhìn không đồng bộ). Ô ít quảng cáo hơn thì quay vòng sớm hơn. */
export function TruotQc({ ds, buoc, denBuoc, dungLai, coMoTa = true, xemTruoc = false }: {
  ds: OQc[]; buoc: number; denBuoc: (k: number) => void; dungLai: (d: boolean) => void; coMoTa?: boolean; xemTruoc?: boolean;
}) {
  const cham = useRef<{ x: number; y: number } | null>(null);
  const keo = useRef(false);
  const n = ds.length;
  if (!n) return null;
  const i = ((buoc % n) + n) % n;
  if (n === 1) return <TheQc o={ds[0]} xemTruoc={xemTruoc} coMoTa={coMoTa} />;
  return (
    <div className="relative h-full overflow-hidden rounded-lg sm:rounded-xl"
      onMouseEnter={() => dungLai(true)} onMouseLeave={() => dungLai(false)}
      onTouchStart={(e) => { cham.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; keo.current = false; dungLai(true); }}
      onTouchEnd={(e) => {
        const c = cham.current; cham.current = null; dungLai(false);
        if (!c) return;
        const dx = e.changedTouches[0].clientX - c.x, dy = e.changedTouches[0].clientY - c.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { keo.current = true; denBuoc(buoc + (dx < 0 ? 1 : -1)); }
      }}
      // Vuốt để chuyển thì không tính là bấm vào quảng cáo
      onClickCapture={(e) => { if (keo.current) { e.preventDefault(); e.stopPropagation(); keo.current = false; } }}>
      <div className="clqc-ray flex h-full transition-transform duration-[650ms] ease-[cubic-bezier(.5,0,.25,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
        {ds.map((o, k) => <div key={o.id || k} className="h-full w-full shrink-0" aria-hidden={k !== i}><TheQc o={o} on={k === i} xemTruoc={xemTruoc} coMoTa={coMoTa} /></div>)}
      </div>
      {/* Chấm chuyển quảng cáo — máy tính: góc TRÊN bên trái (góc dưới hay đè lên logo/chữ có sẵn trong ảnh).
          Điện thoại: góc DƯỚI PHẢI — ô nhỏ, để trên trái thì dính sát nhãn (5/10/2026). */}
      <div className="absolute bottom-2.5 right-2.5 z-[2] flex gap-1 sm:bottom-auto sm:right-auto sm:left-5 sm:top-2">
        {ds.map((o, k) => (
          <button key={o.id || k} type="button" aria-label={`Quảng cáo ${k + 1}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); denBuoc(buoc - i + k); }}
            className={`h-1.5 rounded-full transition-all ${k === i ? 'w-4 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/70'}`} />
        ))}
      </div>
    </div>
  );
}

export function CssQc() { return <style dangerouslySetInnerHTML={{ __html: CSS }} />; }

/* ── ĐIỆN THOẠI (6/10/2026): chủ dự án chê hai ô ảnh tối chữ trắng "nhìn kì", xem thử 3 kiểu và CHỌN KIỂU 1:
   MỘT DÒNG giống hệt dòng tin tức ngay phía trên (ảnh nhỏ trái, tiêu đề đậm, nhãn "Quảng cáo" viền xám).
   Quảng cáo của 2 ô gộp thành một danh sách, đổi lần lượt. Không có quảng cáo nào → vẫn hiện 2 thẻ của web.
   Máy tính giữ nguyên hai ô trượt như cũ. */
function LinkDt({ o, className, children }: { o: OQc; className?: string; children: ReactNode }) {
  const ngoai = /^https?:/i.test(o.link || '');
  return <a href={o.link || '#'} target={ngoai ? '_blank' : undefined} rel={ngoai ? 'sponsored noopener noreferrer' : undefined} className={className}>{children}</a>;
}
const AnhDt = ({ o }: { o: OQc }) => (o.anh
  // eslint-disable-next-line @next/next/no-img-element
  ? <img src={o.anh} alt="" loading="lazy" className="h-full w-full object-cover" />
  : <div className="h-full w-full" style={{ background: (MAU_QC[o.mau || 'xanh'] || MAU_QC.xanh).nen }} />);
const ChamDt = ({ n, i, sang = false }: { n: number; i: number; sang?: boolean }) => n < 2 ? null : (
  <div className="flex gap-1">{Array.from({ length: n }, (_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? `w-3.5 ${sang ? 'bg-white' : 'bg-[#0A2540]'}` : `w-1.5 ${sang ? 'bg-white/50' : 'bg-slate-300'}`}`} />)}</div>
);

/** MỘT DÒNG như dòng tin tức ngay phía trên: ảnh nhỏ trái, tiêu đề đậm, nhãn "Quảng cáo" viền xám. */
function Kieu1({ ds, i }: { ds: OQc[]; i: number }) {
  const o = ds[i];
  return (
    <div className="border-y border-slate-200 bg-white">
      <LinkDt o={o} className="flex items-center gap-3 px-1 py-3">
        <div key={o.id || i} className="cl-fadeup flex min-w-0 flex-1 items-center gap-3">
          <div className="aspect-[16/10] w-[108px] shrink-0 overflow-hidden rounded bg-slate-100"><AnhDt o={o} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-snug text-[#0A2540] line-clamp-2">{o.tieuDe}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400"><span className="shrink-0 whitespace-nowrap rounded border border-slate-300 px-1 text-[10px] font-medium text-slate-500">Quảng cáo</span><span className="truncate">{o.nhan}</span></p>
          </div>
        </div>
      </LinkDt>
      {ds.length > 1 && <div className="flex justify-center pb-2"><ChamDt n={ds.length} i={i} /></div>}
    </div>
  );
}

/** Điện thoại: MỘT dòng quảng cáo, đổi lần lượt 5 giây/lần qua mọi quảng cáo của cả 2 ô. */
function QcDienThoai({ ds }: { ds: OQc[] }) {
  const [buoc, setBuoc] = useState(0);
  useEffect(() => { if (ds.length < 2) return; const t = setInterval(() => setBuoc((k) => k + 1), 5000); return () => clearInterval(t); }, [ds.length]);
  return <div className="sm:hidden"><Kieu1 ds={ds} i={buoc % ds.length} /></div>;
}

/* ── MÁY TÍNH: 18 KIỂU XEM THỬ (6/10/2026, TẠM) ──
   Chủ dự án chê hai ô ảnh tối ở cột phải khu tin tức (chữ "Quảng cáo" bị cắt, chấm bé, ảnh phủ tối nặng).
   Mở trang chủ kèm ?mauqc=N trên máy tính để xem. 1–3: lượt đầu · 4–8: cải tiến kiểu 1 · 9–18: kiểu mới.
   Chọn xong giữ một kiểu làm mặc định, xoá phần còn lại. */
const NhanXam = ({ cls = '' }: { cls?: string }) => <p className={`mb-2 text-[10.5px] font-medium uppercase tracking-[.14em] text-slate-400 ${cls}`}>Quảng cáo</p>;
const TheQcNho = () => <span className="shrink-0 whitespace-nowrap rounded border border-slate-300 px-1 text-[10px] font-medium text-slate-500">Quảng cáo</span>;
const NutXanh = ({ o, cls = '' }: { o: OQc; cls?: string }) => <span className={`inline-block rounded bg-[#0A2540] px-3 py-1.5 text-xs font-bold text-white group-hover:bg-red-600 ${cls}`}>{o.nut || 'Xem ngay'} →</span>;
const NutChu = ({ o, cls = '' }: { o: OQc; cls?: string }) => <span className={`block truncate text-xs font-semibold text-red-600 ${cls}`}>{o.nut || 'Xem ngay'} →</span>;
type Ve = (ds: OQc[]) => ReactNode; // ds = các quảng cáo đang tới lượt (đã xoay vòng)

// Một dòng kiểu tin tức — dùng lại cho kiểu 1 và các bản cải tiến
const Dong = ({ o, anh = 'w-[104px] aspect-[4/3]', moTa = 0, nut = false, dong = 3 }: { o: OQc; anh?: string; moTa?: number; nut?: boolean; dong?: number }) => (
  <LinkDt o={o} className="group block border-b border-slate-200 py-3 first:pt-0 last:border-b-0">
    <div className="flex gap-3">
      <div className={`${anh} shrink-0 overflow-hidden rounded bg-slate-100`}><AnhDt o={o} /></div>
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] font-bold leading-snug text-[#0A2540] group-hover:text-red-600 ${dong === 2 ? 'line-clamp-2' : 'line-clamp-3'}`}>{o.tieuDe}</p>
        {moTa > 0 && o.moTa && <p className={`mt-1 text-[12.5px] leading-snug text-slate-500 ${moTa === 1 ? 'line-clamp-1' : 'line-clamp-2'}`}>{o.moTa}</p>}
        {nut ? <NutChu o={o} cls="mt-1.5" /> : <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400"><TheQcNho /><span className="truncate">{o.nhan}</span></p>}
      </div>
    </div>
  </LinkDt>
);

const KIEU_MT: { ten: string; so: number; ve: Ve }[] = [
  // ── Lượt đầu ──
  { ten: 'Hai dòng như tin tức', so: 2, ve: (ds) => <div><NhanXam />{ds.map((o, k) => <Dong key={k} o={o} />)}</div> },
  { ten: 'Một thẻ kiểu báo', so: 1, ve: ([o]) => (
    <div><NhanXam />
      <LinkDt o={o} className="group block overflow-hidden rounded border border-slate-200 bg-white hover:border-slate-300">
        <div className="aspect-[16/10] overflow-hidden bg-slate-100"><AnhDt o={o} /></div>
        <div className="p-3.5">
          {o.nhan && <p className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-red-600">{o.nhan}</p>}
          <p className="mt-0.5 text-base font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p>
          {o.moTa && <p className="mt-1 text-[13px] leading-snug text-slate-500 line-clamp-2">{o.moTa}</p>}
          <NutXanh o={o} cls="mt-3" />
        </div>
      </LinkDt></div>) },
  { ten: 'Hai thẻ ảnh trên chữ dưới', so: 2, ve: (ds) => (
    <div className="space-y-3">{ds.map((o, k) => (
      <LinkDt key={k} o={o} className="group block overflow-hidden rounded-lg border border-slate-200 bg-white hover:border-slate-300">
        <div className="relative aspect-[2.3/1] overflow-hidden bg-slate-100"><AnhDt o={o} /><span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-px text-[9.5px] font-medium text-slate-600">Quảng cáo</span></div>
        <div className="px-3 py-2.5"><p className="text-[14.5px] font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p><NutChu o={o} cls="mt-1" /></div>
      </LinkDt>))}</div>) },

  // ── 5 bản cải tiến của kiểu 1 (kiểu 1 chỉ cao nửa cột → các bản dưới lấp cho cân) ──
  { ten: 'Cải tiến 1a · BA dòng thay vì hai, cuối có lời mời đặt quảng cáo', so: 3, ve: (ds) => (
    <div><NhanXam />{ds.map((o, k) => <Dong key={k} o={o} dong={2} />)}
      <Link href="/dichvu#quang-cao" className="mt-1 block text-[11.5px] text-slate-400 hover:text-red-600">Đặt quảng cáo tại đây →</Link></div>) },
  { ten: 'Cải tiến 1b · Hai dòng, ảnh to hơn + một dòng mô tả', so: 2, ve: (ds) => (
    <div><NhanXam />{ds.map((o, k) => <Dong key={k} o={o} anh="w-[122px] aspect-[4/3.4]" moTa={2} dong={2} />)}</div>) },
  { ten: 'Cải tiến 1c · Hai dòng có mô tả + chữ đỏ "Xem ngay →"', so: 2, ve: (ds) => (
    <div><NhanXam />{ds.map((o, k) => <Dong key={k} o={o} anh="w-[112px] aspect-square" moTa={2} nut dong={2} />)}</div>) },
  { ten: 'Cải tiến 1d · Đặt trong hộp trắng, tiêu đề hộp gạch đỏ (giống "Tin liên quan")', so: 3, ve: (ds) => (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <p className="border-b-2 border-red-600 px-3.5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-[#0A2540]">Quảng cáo</p>
      <div className="px-3.5 pt-3">{ds.map((o, k) => <Dong key={k} o={o} anh="w-[92px] aspect-[4/3]" dong={2} />)}</div>
    </div>) },
  { ten: 'Cải tiến 1e · Một quảng cáo ảnh to + hai dòng nhỏ bên dưới (như tin chính + tin phụ)', so: 3, ve: ([a, ...con]) => (
    <div><NhanXam />
      <LinkDt o={a} className="group block border-b border-slate-200 pb-3">
        <div className="aspect-[16/9] overflow-hidden rounded bg-slate-100"><AnhDt o={a} /></div>
        <p className="mt-2 text-[15.5px] font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{a.tieuDe}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400"><TheQcNho /><span className="truncate">{a.nhan}</span></p>
      </LinkDt>
      <div className="pt-3">{con.map((o, k) => <Dong key={k} o={o} anh="w-[84px] aspect-[4/3]" dong={2} />)}</div>
    </div>) },

  // ── 10 kiểu mới ──
  { ten: 'Mới 1 · Áp phích ảnh cao bằng cột, chân ảnh có dải trắng ghi tiêu đề', so: 1, ve: ([o]) => (
    <LinkDt o={o} className="group relative block aspect-[3/4] overflow-hidden rounded-lg bg-slate-100 lg:aspect-auto lg:h-[360px]">
      <AnhDt o={o} />
      <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-px text-[9.5px] font-medium text-slate-600">Quảng cáo</span>
      <div className="absolute inset-x-2 bottom-2 rounded bg-white/95 p-3 shadow-sm">
        {o.nhan && <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-red-600">{o.nhan}</p>}
        <p className="text-[15px] font-bold leading-snug text-[#0A2540] line-clamp-2">{o.tieuDe}</p>
        <NutChu o={o} cls="mt-1" />
      </div>
    </LinkDt>) },
  { ten: 'Mới 2 · Chỉ chữ, nền xanh đậm phẳng (không ảnh), hai thẻ', so: 2, ve: (ds) => (
    <div className="space-y-3">{ds.map((o, k) => (
      <LinkDt key={k} o={o} className="group block rounded-lg bg-[#0A2540] p-4 text-white hover:bg-[#0d2f54]">
        <p className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#C8A14B]"><span className="truncate">{o.nhan}</span><span className="shrink-0 font-medium normal-case tracking-normal text-white/50">Quảng cáo</span></p>
        <p className="mt-1 text-[16px] font-bold leading-snug line-clamp-2">{o.tieuDe}</p>
        {o.moTa && <p className="mt-1 text-[12.5px] leading-snug text-white/65 line-clamp-2">{o.moTa}</p>}
        <span className="mt-3 inline-block rounded bg-[#C8A14B] px-3 py-1.5 text-xs font-bold text-[#0A2540]">{o.nut || 'Xem ngay'} →</span>
      </LinkDt>))}</div>) },
  { ten: 'Mới 3 · Ba thẻ nhỏ ảnh tròn kiểu danh thiếp', so: 3, ve: (ds) => (
    <div><NhanXam /><div className="space-y-2.5">{ds.map((o, k) => (
      <LinkDt key={k} o={o} className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100"><AnhDt o={o} /></div>
        <div className="min-w-0 flex-1"><p className="text-[14px] font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p><NutChu o={o} cls="mt-0.5" /></div>
      </LinkDt>))}</div></div>) },
  { ten: 'Mới 4 · Một thẻ ảnh trên, chữ dưới có vạch vàng bên trái', so: 1, ve: ([o]) => (
    <div><NhanXam />
      <LinkDt o={o} className="group block bg-white">
        <div className="aspect-[4/3] overflow-hidden rounded bg-slate-100"><AnhDt o={o} /></div>
        <div className="mt-3 border-l-[3px] border-[#C8A14B] pl-3">
          {o.nhan && <p className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{o.nhan}</p>}
          <p className="text-[16px] font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p>
          {o.moTa && <p className="mt-1 text-[12.5px] leading-snug text-slate-500 line-clamp-2">{o.moTa}</p>}
        </div>
      </LinkDt></div>) },
  { ten: 'Mới 5 · Hai ảnh có dải chữ trắng mờ ở chân ảnh', so: 2, ve: (ds) => (
    <div className="space-y-3">{ds.map((o, k) => (
      <LinkDt key={k} o={o} className="group relative block aspect-[16/10] overflow-hidden rounded-lg bg-slate-100">
        <AnhDt o={o} />
        <span className="absolute right-2 top-2 rounded bg-white/90 px-1.5 py-px text-[9.5px] font-medium text-slate-600">Quảng cáo</span>
        <div className="absolute inset-x-0 bottom-0 bg-white/90 px-3 py-2 backdrop-blur-sm">
          <p className="text-[14px] font-bold leading-snug text-[#0A2540] line-clamp-1">{o.tieuDe}</p><NutChu o={o} />
        </div>
      </LinkDt>))}</div>) },
  { ten: 'Mới 6 · Lưới 4 ô vuông nhỏ (4 quảng cáo cùng lúc)', so: 4, ve: (ds) => (
    <div><NhanXam /><div className="grid grid-cols-2 gap-2.5">{ds.map((o, k) => (
      <LinkDt key={k} o={o} className="group block">
        <div className="aspect-square overflow-hidden rounded bg-slate-100"><AnhDt o={o} /></div>
        <p className="mt-1.5 text-[13px] font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p>
      </LinkDt>))}</div></div>) },
  { ten: 'Mới 7 · Danh sách đánh số "Gợi ý cho bạn", ảnh nhỏ bên phải', so: 4, ve: (ds) => (
    <div><p className="mb-1 flex items-baseline justify-between"><span className="text-[13px] font-extrabold uppercase tracking-wide text-[#0A2540]">Gợi ý cho bạn</span><span className="text-[10px] text-slate-400">Quảng cáo</span></p>
      {ds.map((o, k) => (
        <LinkDt key={k} o={o} className="group flex items-center gap-3 border-b border-slate-200 py-2.5 last:border-b-0">
          <span className="w-5 shrink-0 text-xl font-extrabold text-slate-300">{k + 1}</span>
          <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p>
          <div className="aspect-square w-14 shrink-0 overflow-hidden rounded bg-slate-100"><AnhDt o={o} /></div>
        </LinkDt>))}</div>) },
  { ten: 'Mới 8 · Thẻ viền đỏ trên đầu: chữ trước, ảnh sau', so: 1, ve: ([o]) => (
    <LinkDt o={o} className="group block overflow-hidden rounded-lg border border-slate-200 border-t-[3px] border-t-red-600 bg-white p-4 hover:border-slate-300 hover:border-t-red-600">
      <p className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wide text-red-600"><span className="truncate">{o.nhan}</span><span className="font-medium normal-case tracking-normal text-slate-400">Quảng cáo</span></p>
      <p className="mt-1 text-[17px] font-extrabold leading-snug text-[#0A2540] line-clamp-2">{o.tieuDe}</p>
      {o.moTa && <p className="mt-1.5 text-[13px] leading-snug text-slate-500 line-clamp-2">{o.moTa}</p>}
      <div className="mt-3 aspect-[16/9] overflow-hidden rounded bg-slate-100"><AnhDt o={o} /></div>
      <NutXanh o={o} cls="mt-3" />
    </LinkDt>) },
  { ten: 'Mới 9 · Giống thẻ tin VIP: nhãn vàng "QUẢNG CÁO" trên ảnh, chữ đỏ dưới', so: 2, ve: (ds) => (
    <div className="space-y-3">{ds.map((o, k) => (
      <LinkDt key={k} o={o} className="group block overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200 hover:ring-slate-300">
        <div className="relative aspect-[2.2/1] overflow-hidden bg-slate-100"><AnhDt o={o} />
          <span className="absolute left-2 top-2 rounded bg-[#C8A14B] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-[#0A2540]">Quảng cáo</span></div>
        <div className="px-3 py-2.5">
          <p className="text-[13.5px] font-bold uppercase leading-snug text-red-600 line-clamp-2">{o.tieuDe}</p>
          {o.nhan && <p className="mt-1 truncate text-[11.5px] text-slate-500">{o.nhan}</p>}
        </div>
      </LinkDt>))}</div>) },
  { ten: 'Mới 10 · Một khung xám nhạt, ảnh trái chữ phải, hai quảng cáo', so: 2, ve: (ds) => (
    <div className="rounded-lg bg-slate-100 p-3">
      <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[.14em] text-slate-400">Quảng cáo</p>
      <div className="space-y-2.5">{ds.map((o, k) => (
        <LinkDt key={k} o={o} className="group flex gap-3 rounded bg-white p-2.5">
          <div className="aspect-[4/3] w-[96px] shrink-0 overflow-hidden rounded bg-slate-100"><AnhDt o={o} /></div>
          <div className="min-w-0 flex-1"><p className="text-[14px] font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p>
            {o.moTa && <p className="mt-0.5 text-[12px] leading-snug text-slate-500 line-clamp-2">{o.moTa}</p>}<NutChu o={o} cls="mt-1" /></div>
        </LinkDt>))}</div>
    </div>) },
];

function XemThuMayTinh({ ds, kieu }: { ds: OQc[]; kieu: number }) {
  const k = KIEU_MT[kieu - 1];
  const [buoc, setBuoc] = useState(0);
  useEffect(() => { if (ds.length <= k.so) return; const t = setInterval(() => setBuoc((b) => b + k.so), 6000); return () => clearInterval(t); }, [ds.length, k.so]);
  const n = Math.min(k.so, ds.length);
  const dang = Array.from({ length: n }, (_, j) => ds[(buoc + j) % ds.length]);
  const tong = KIEU_MT.length;
  return (
    <div className="hidden sm:block">
      <div key={buoc} className="cl-fadeup lg:max-w-none sm:max-w-md">{k.ve(dang)}</div>
      <div className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
        <b>Xem thử {kieu}/{tong}</b> · {k.ten}
        <div className="mt-1 flex flex-wrap gap-1">{KIEU_MT.map((_, j) => <a key={j} href={`/?mauqc=${j + 1}`} className={`grid h-5 min-w-[20px] place-items-center rounded px-1 ${j + 1 === kieu ? 'bg-amber-600 text-white' : 'bg-white text-amber-800 ring-1 ring-amber-200'}`}>{j + 1}</a>)}</div>
      </div>
    </div>
  );
}

/** Cột hai ô: ô nào có quảng cáo đang chạy thì trượt luân phiên, không thì giữ thẻ mặc định của web. */
export default function OQuangCaoTrangChu({ macDinh1, macDinh2 }: { macDinh1: ReactNode; macDinh2: ReactNode }) {
  const [ch, setCh] = useState<CauHinhQc>({});
  useEffect(() => {
    fetch('/api/config/trangchu_ad').then((r) => r.json())
      .then((d) => { if (d?.value && typeof d.value === 'object') setCh(d.value); }).catch(() => {});
  }, []);
  const ds1 = dsCua(ch.o1).filter((o) => dangChay(o));
  const ds2 = dsCua(ch.o2).filter((o) => dangChay(o));
  const dsDt = [...ds1, ...ds2]; // điện thoại: gộp 2 ô thành một dòng
  // TẠM: ?mauqc=1|2|3 → máy tính xem thử kiểu mới (xem XemThuMayTinh ở trên)
  const [kieuMt, setKieuMt] = useState(0);
  useEffect(() => { const k = Number(new URLSearchParams(location.search).get('mauqc')); if (k >= 1 && k <= KIEU_MT.length) setKieuMt(k); }, []);
  const xemThuMt = kieuMt > 0 && dsDt.length > 0;
  // MỘT đồng hồ chung cho cả hai ô → trượt cùng lúc. Rê chuột / chạm vào ô nào cũng dừng cả hai.
  const [buoc, setBuoc] = useState(0);
  const [dung, setDung] = useState(false);
  const chay = Math.max(ds1.length, ds2.length) > 1;
  useEffect(() => {
    if (!chay || dung) return;
    const t = setInterval(() => setBuoc((k) => k + 1), 5000);
    return () => clearInterval(t);
  }, [chay, dung, buoc]); // có `buoc`: bấm chấm / vuốt xong thì đếm lại đủ 5 giây
  // KHUNG GIỮ NGUYÊN CỠ THẺ GỐC: thẻ của web vẫn nằm đó nhưng ẩn đi (giữ chỗ), quảng cáo phủ đúng lên khung đó
  // → ô quảng cáo không bao giờ to hơn/nhỏ hơn thẻ ban đầu, dù chữ dài hay ảnh to.
  const khung = (ds: OQc[], macDinh: ReactNode, coMoTa: boolean) => !ds.length ? macDinh : (
    <div className="relative">
      <div className="invisible" aria-hidden>{macDinh}</div>
      <div className="absolute inset-0">
        <TruotQc ds={ds} buoc={buoc} denBuoc={setBuoc} dungLai={setDung} coMoTa={coMoTa} />
      </div>
    </div>
  );
  return (
    <div>
      <CssQc />
      {dsDt.length > 0 && <QcDienThoai ds={dsDt} />}
      {xemThuMt && <XemThuMayTinh ds={dsDt} kieu={kieuMt} />}
      <div className={`grid grid-cols-2 gap-2.5 sm:block sm:space-y-4 ${dsDt.length > 0 ? 'max-sm:hidden' : ''} ${xemThuMt ? 'sm:hidden' : ''}`}>
        {khung(ds1, macDinh1, true)}
        {khung(ds2, macDinh2, false)}
      </div>
      {/* Lời mời đặt quảng cáo — chỉ trên máy tính, chữ nhỏ cho khỏi rối (điện thoại cần gọn) */}
      <Link href="/dichvu#quang-cao" className={`mt-2 hidden text-right text-[11px] text-slate-400 hover:text-red-600 ${xemThuMt ? '' : 'sm:block'}`}>Đặt quảng cáo tại vị trí này →</Link>
    </div>
  );
}
