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

/* ── MÁY TÍNH: 3 KIỂU XEM THỬ (6/10/2026, TẠM) ──
   Chủ dự án chê hai ô ảnh tối ở cột phải khu tin tức (chữ "Quảng cáo" bị cắt, chấm bé, ảnh phủ tối nặng).
   Mở trang chủ kèm ?mauqc=1 / 2 / 3 trên máy tính để xem. Chọn xong giữ một kiểu, xoá phần còn lại. */
const NhanXam = () => <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[.14em] text-slate-400">Quảng cáo</p>;

/** Kiểu 1 — HAI DÒNG như dòng tin tức ở cột giữa (đồng bộ với kiểu đã chọn cho điện thoại). */
function Mt1({ hai }: { hai: OQc[] }) {
  return (
    <div>
      <NhanXam />
      <div className="sm:grid sm:grid-cols-2 sm:gap-x-5 lg:block">
        {hai.map((o, k) => (
          <LinkDt key={k} o={o} className="group block border-b border-slate-200 py-3 first:pt-0">
            <div key={o.id || k} className="cl-fadeup flex gap-3">
              <div className="aspect-[4/3] w-[104px] shrink-0 overflow-hidden rounded bg-slate-100"><AnhDt o={o} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold leading-snug text-[#0A2540] line-clamp-3 group-hover:text-red-600">{o.tieuDe}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400"><span className="shrink-0 whitespace-nowrap rounded border border-slate-300 px-1 text-[10px] font-medium text-slate-500">Quảng cáo</span><span className="truncate">{o.nhan}</span></p>
              </div>
            </div>
          </LinkDt>
        ))}
      </div>
    </div>
  );
}

/** Kiểu 2 — MỘT THẺ KIỂU BÁO (giống cột phải trang Tin tức): chữ "QUẢNG CÁO" xám phía trên, ảnh sáng, chữ đen, nút xanh đậm. */
function Mt2({ o }: { o: OQc }) {
  return (
    <div>
      <NhanXam />
      <LinkDt o={o} className="group block overflow-hidden rounded border border-slate-200 bg-white hover:border-slate-300">
        <div key={o.id} className="cl-fadeup sm:flex lg:block">
          <div className="aspect-[16/10] overflow-hidden bg-slate-100 sm:w-2/5 sm:shrink-0 lg:w-auto"><AnhDt o={o} /></div>
          <div className="p-3.5">
            {o.nhan && <p className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-red-600">{o.nhan}</p>}
            <p className="mt-0.5 text-base font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p>
            {o.moTa && <p className="mt-1 text-[13px] leading-snug text-slate-500 line-clamp-2">{o.moTa}</p>}
            <span className="mt-3 inline-block rounded bg-[#0A2540] px-3 py-1.5 text-xs font-bold text-white group-hover:bg-red-600">{o.nut || 'Xem ngay'} →</span>
          </div>
        </div>
      </LinkDt>
    </div>
  );
}

/** Kiểu 3 — HAI THẺ ẢNH TRÊN CHỮ DƯỚI (kiểu thẻ tin đăng), không phủ tối. */
function Mt3({ hai }: { hai: OQc[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      {hai.map((o, k) => (
        <LinkDt key={k} o={o} className="group block overflow-hidden rounded-lg border border-slate-200 bg-white hover:border-slate-300">
          <div key={o.id || k} className="cl-fadeup">
            <div className="relative aspect-[2.3/1] overflow-hidden bg-slate-100"><AnhDt o={o} />
              <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-px text-[9.5px] font-medium text-slate-600">Quảng cáo</span></div>
            <div className="px-3 py-2.5">
              <p className="text-[14.5px] font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p>
              <p className="mt-1 truncate text-xs font-semibold text-red-600">{o.nut || 'Xem ngay'} →</p>
            </div>
          </div>
        </LinkDt>
      ))}
    </div>
  );
}

function XemThuMayTinh({ ds, kieu }: { ds: OQc[]; kieu: number }) {
  const [buoc, setBuoc] = useState(0);
  const nhay = kieu === 2 ? 1 : 2;
  useEffect(() => { if (ds.length <= (kieu === 2 ? 1 : 2)) return; const t = setInterval(() => setBuoc((k) => k + nhay), 6000); return () => clearInterval(t); }, [ds.length, kieu, nhay]);
  const i = buoc % ds.length;
  const hai = ds.length === 1 ? [ds[0]] : [ds[i], ds[(i + 1) % ds.length]];
  return (
    <div className="hidden sm:block">
      {kieu === 1 ? <Mt1 hai={hai} /> : kieu === 2 ? <Mt2 o={ds[i]} /> : <Mt3 hai={hai} />}
      <p className="mt-2 text-right text-[11px] text-slate-400">Đang xem thử kiểu {kieu}/3 · <a href="/?mauqc=1" className="underline">1</a> · <a href="/?mauqc=2" className="underline">2</a> · <a href="/?mauqc=3" className="underline">3</a></p>
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
  useEffect(() => { const k = Number(new URLSearchParams(location.search).get('mauqc')); if (k >= 1 && k <= 3) setKieuMt(k); }, []);
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
