'use client';
/* QUẢNG CÁO TRANG TIN TỨC (danh sách tin /tin-tuc và trang đọc bài /tin-tuc/[id]) — làm lại 5/10/2026.
   Chủ dự án chê bản cũ 3 điểm: (1) ảnh biển du lịch không ăn nhập với nhà đất, (2) mọi chỗ cùng lặp MỘT câu
   "Đăng tin miễn phí", (4) kiểu dáng chưa giống báo thật. Nên giờ:
   - DÙNG CHUNG kho quảng cáo với 2 ô trang chủ (khoá `trangchu_ad`, nhập ở /admin → Quảng cáo). Có thêm
     banner cũ `tintuc_ad` (nếu admin đã bật) thì xếp lên đầu. Kho trống → 6 quảng cáo mẫu bên dưới.
   - MỖI CHỖ BẮT ĐẦU Ở MỘT QUẢNG CÁO KHÁC NHAU (`batDau`) rồi cùng đổi luân phiên 6 giây/lần → không chỗ nào trùng nhau.
   - Trình bày kiểu báo (VnExpress, Znews): chữ "QUẢNG CÁO" nhỏ màu xám phía trên, khung viền mảnh, nền trắng,
     không phủ chữ to lên ảnh. Quảng cáo chèn giữa danh sách tin trông như một dòng tin, có nhãn "Quảng cáo". */
import { useEffect, useState } from 'react';
import { dangChay, dsCua, type OQc } from '@/components/OQuangCaoTrangChu';

export interface Ad { enabled?: boolean; image?: string; images?: string[]; link?: string; title?: string; sub?: string; cta?: string }
export const imgsOf = (ad: Ad) => ((ad.images && ad.images.length ? ad.images : ad.image ? [ad.image] : []) as string[]).filter(Boolean);

// 6 quảng cáo mẫu — dẫn tới trang CÓ THẬT của web, ảnh nhà đất (không dùng ảnh biển du lịch).
// Trùng nội dung với 6 mẫu đang đặt ở trang chủ, để web chưa có khách vẫn có quảng cáo đủ đa dạng.
export const QC_MAU: OQc[] = [
  { id: 'm1', nhan: 'Đất nền ven biển', tieuDe: 'Đất nền Bãi Dài – Cam Lâm đang rao bán', moTa: 'Lô đất nền mới đăng gần biển Bãi Dài, xem giá & sổ từng lô.', nut: 'Xem đất nền', link: '/listings?propertyType=land', anh: '/tin-mau/dat-nen-01.webp' },
  { id: 'm2', nhan: 'Biệt thự · Nghỉ dưỡng', tieuDe: 'Biệt thự, nhà vườn Cam Lâm view biển', moTa: 'Không gian sống xanh cạnh sân bay Cam Ranh, tiện đi Nha Trang.', nut: 'Xem biệt thự', link: '/listings?propertyType=villa', anh: '/tin-mau/biet-thu-01.webp' },
  { id: 'm3', nhan: 'Bản đồ quy hoạch', tieuDe: 'Tra quy hoạch theo số tờ, số thửa', moTa: 'Bấm vào thửa đất là biết loại đất, diện tích, quy hoạch.', nut: 'Mở bản đồ', link: '/map', anh: '/quyhoach-camlam.jpg' },
  { id: 'm4', nhan: 'Miễn phí', tieuDe: 'Đăng tin bán nhà đất — khách thấy ngay', moTa: 'Chụp ảnh, điền giá, bấm đăng. Khách trong khu vực thấy ngay hôm nay.', nut: 'Đăng tin ngay', link: '/sales/post', anh: '/tin-mau/nha-01.webp' },
  { id: 'm5', nhan: 'Đặt quảng cáo', tieuDe: 'Thương hiệu của bạn ở vị trí này', moTa: 'Hiện trên trang chủ và trang tin tức của Cam Lâm Land.', nut: 'Liên hệ đặt chỗ', link: '/dichvu#quang-cao', anh: '/tin-mau/nha-02.webp' },
  { id: 'm6', nhan: 'Giá đất Cam Lâm', tieuDe: 'Mặt bằng giá đất theo từng xã', moTa: 'Tính từ chính tin rao trên web, cập nhật liên tục.', nut: 'Xem giá đất', link: '/gia-dat', anh: '/tin-mau/dat-nen-03.webp' },
];

/** Kho quảng cáo cho trang tin: banner tin tức (nếu bật) + mọi quảng cáo đang chạy ở 2 ô trang chủ. */
export function useBoQc(): OQc[] {
  const [ds, setDs] = useState<OQc[]>(QC_MAU);
  useEffect(() => {
    let huy = false;
    Promise.all([
      fetch('/api/config/trangchu_ad').then((r) => r.json()).catch(() => null),
      fetch('/api/config/tintuc_ad').then((r) => r.json()).catch(() => null),
    ]).then(([tc, tt]) => {
      if (huy) return;
      const kq: OQc[] = [];
      const a: Ad | null = tt?.value && typeof tt.value === 'object' ? tt.value : null;
      if (a && a.enabled !== false && a.title) kq.push({ id: 'tintuc', tieuDe: a.title, moTa: a.sub, nut: a.cta, link: a.link, anh: imgsOf(a)[0] });
      const v = tc?.value || {};
      kq.push(...dsCua(v.o1).filter((o) => dangChay(o)), ...dsCua(v.o2).filter((o) => dangChay(o)));
      if (kq.length) setDs(kq);
    });
    return () => { huy = true; };
  }, []);
  return ds;
}

/** Nhịp đổi chung: mọi chỗ quảng cáo trên trang cùng đổi một lúc. */
function useNhip(ms = 6000) {
  const [b, setB] = useState(0);
  useEffect(() => { const t = setInterval(() => setB((k) => k + 1), ms); return () => clearInterval(t); }, [ms]);
  return b;
}
const lay = (ds: OQc[], batDau: number, buoc: number) => ds[(batDau + buoc) % ds.length];

// Thẻ <a>/<Link> đúng loại: link ra ngoài → tab mới + rel="sponsored" (Google bắt đánh dấu link quảng cáo trả tiền)
function LinkQc({ o, className, children }: { o: OQc; className?: string; children: React.ReactNode }) {
  const ngoai = /^https?:/i.test(o.link || '');
  return <a href={o.link || '#'} target={ngoai ? '_blank' : undefined} rel={ngoai ? 'sponsored noopener noreferrer' : undefined} className={className}>{children}</a>;
}
// Chữ "QUẢNG CÁO" nhỏ màu xám phía trên khung — y kiểu báo điện tử
const NhanTren = () => <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-[.12em] text-slate-400">Quảng cáo</p>;
const Anh = ({ o, className = '' }: { o: OQc; className?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  o.anh ? <img src={o.anh} alt="" loading="lazy" className={`h-full w-full object-cover transition duration-700 group-hover:scale-105 ${className}`} />
    : <div className="h-full w-full bg-gradient-to-br from-[#0A2540] to-[#13365c]" />
);
const Nut = ({ o, className = '' }: { o: OQc; className?: string }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded bg-[#0A2540] px-3 py-1.5 text-xs font-bold text-white group-hover:bg-red-600 ${className}`}>{o.nut || 'Xem ngay'} →</span>
);

/** Dải ngang trên đầu trang — kiểu "leaderboard" của báo: ảnh trái, chữ giữa, nút phải. Thấp gọn, không che tin. */
export function BillboardAd({ ds, batDau = 0 }: { ds: OQc[]; batDau?: number }) {
  const buoc = useNhip(); if (!ds.length) return null;
  const o = lay(ds, batDau, buoc);
  return (
    <div>
      <NhanTren />
      <LinkQc o={o} className="group block overflow-hidden rounded border border-slate-200 bg-white hover:border-slate-300">
        <div key={o.id || buoc} className="cl-fadeup flex h-[104px] items-stretch">
          <div className="w-[180px] shrink-0 overflow-hidden bg-slate-100 lg:w-[210px]"><Anh o={o} /></div>
          <div className="flex min-w-0 flex-1 items-center gap-4 px-5">
            <div className="min-w-0 flex-1">
              {o.nhan && <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">{o.nhan}</p>}
              <p className="mt-0.5 text-lg font-bold leading-snug text-[#0A2540] line-clamp-1 group-hover:text-red-600">{o.tieuDe}</p>
              {o.moTa && <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{o.moTa}</p>}
            </div>
            <Nut o={o} className="shrink-0 px-4 py-2 text-[13px]" />
          </div>
        </div>
      </LinkQc>
    </div>
  );
}

/** Chèn giữa danh sách tin — trông như MỘT DÒNG TIN (cùng cỡ ảnh, cùng kiểu chữ), chỗ nguồn/ngày ghi "Quảng cáo". */
export function NativeAd({ ds, batDau = 1 }: { ds: OQc[]; batDau?: number }) {
  const buoc = useNhip(); if (!ds.length) return null;
  const o = lay(ds, batDau, buoc);
  return (
    <LinkQc o={o} className="group block py-4 sm:py-5">
      <div key={o.id || buoc} className="cl-fadeup flex items-start gap-3 sm:gap-5">
        <div className="aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:w-36 md:w-56"><Anh o={o} /></div>
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600 md:text-lg">{o.tieuDe}</h3>
          {o.moTa && <p className="mt-2 hidden text-[15px] text-slate-500 line-clamp-2 sm:block">{o.moTa}</p>}
          <p className="mt-2 text-xs text-slate-400"><span className="rounded border border-slate-300 px-1 py-px text-[10px] font-medium text-slate-500">Quảng cáo</span>{o.nhan ? ` · ${o.nhan}` : ''}</p>
        </div>
      </div>
    </LinkQc>
  );
}

/** Ô vuông cột phải (trang đọc bài) — ảnh trên, chữ dưới, khung mảnh. */
export function SidebarAd({ ds, batDau = 2 }: { ds: OQc[]; batDau?: number }) {
  const buoc = useNhip(); if (!ds.length) return null;
  const o = lay(ds, batDau, buoc);
  return (
    <div>
      <NhanTren />
      <LinkQc o={o} className="group block overflow-hidden rounded border border-slate-200 bg-white hover:border-slate-300">
        <div key={o.id || buoc} className="cl-fadeup">
          <div className="aspect-[4/3] overflow-hidden bg-slate-100"><Anh o={o} /></div>
          <div className="p-3">
            {o.nhan && <p className="text-[10.5px] font-semibold uppercase tracking-wide text-red-600">{o.nhan}</p>}
            <p className="mt-0.5 text-[15px] font-bold leading-snug text-[#0A2540] line-clamp-2 group-hover:text-red-600">{o.tieuDe}</p>
            {o.moTa && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{o.moTa}</p>}
            <Nut o={o} className="mt-2.5" />
          </div>
        </div>
      </LinkQc>
    </div>
  );
}


/* CÁNH GÀ kiểu Znews: fixed kẹp 2 bên cột nội dung (màn ≥1536px). Dùng ở trang Tin tức + trang xem một tin đăng.
   Mỗi bên XẾP CHỒNG 2 thẻ, ảnh giữ tỉ lệ ngang 4:3. KHÔNG kéo một ảnh cao hết màn hình: ảnh ngang bị cắt
   thành dải dọc, chữ trong ảnh còn "M L" — chủ dự án chê "cụt cụt" (5/10/2026).
   `rong` = bề rộng cột nội dung của trang (px), cánh gà nằm gọn trong phần trống hai bên.
   `hienSau` = cuộn xuống bao nhiêu px thì trượt vào (trang Tin tức chờ qua dải quảng cáo trên đầu; 0 = hiện ngay).
   `batDau` = quảng cáo đầu tiên của 4 thẻ (trái 2 thẻ, phải 2 thẻ) → không trùng các chỗ quảng cáo khác trên trang. */
export function CanhGaAd({ ds, rong = 1120, hienSau = 340, batDau = 2 }: { ds: OQc[]; rong?: number; hienSau?: number; batDau?: number }) {
  const [shown, setShown] = useState(hienSau <= 0);
  useEffect(() => {
    if (hienSau <= 0) return;
    const onScroll = () => setShown(window.scrollY > hienSau);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hienSau]);
  if (!ds.length) return null;
  const cls = 'pointer-events-auto fixed top-20 z-20 flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-hidden transition-all duration-500 ease-out';
  const w = `calc((100vw - ${rong}px) * 0.3)`;
  const off = `calc((100vw - ${rong}px) * 0.1)`;
  return (
    <div className="hidden 2xl:block">
      <aside className={`${cls} ${shown ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`} style={{ width: w, maxWidth: 260, left: off }}><SidebarAd ds={ds} batDau={batDau} /><SidebarAd ds={ds} batDau={batDau + 1} /></aside>
      <aside className={`${cls} ${shown ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`} style={{ width: w, maxWidth: 260, right: off }}><SidebarAd ds={ds} batDau={batDau + 2} /><SidebarAd ds={ds} batDau={batDau + 3} /></aside>
    </div>
  );
}
