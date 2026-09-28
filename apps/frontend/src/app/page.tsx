'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, NO_IMG } from '@/lib/api';
import { Listing, PropertyType, PROPERTY_LABELS } from '@/lib/types';
import ListingCard from '@/components/ListingCard';
import HomeUtilities from '@/components/HomeUtilities';
import PromoBanner from '@/components/PromoBanner';
import OChon from '@/components/OChon';
import FeaturedPartners from '@/components/FeaturedPartners';
import FeaturedProjects from '@/components/FeaturedProjects';
/* Banner đầu trang: 11 mẫu động do chủ dự án thiết kế (components/banner11).
   ⚠️ Bản banner CŨ (5 ảnh + chữ chạy) vẫn còn nguyên ở components/HeroBanner.tsx
   và đã cất bản dự phòng ở backup/banner-slide-2026-09-22 + nhãn git
   `banner-slide-v1`. Muốn quay lại thì đổi lại dòng import này là xong. */
import Banner11 from '@/components/banner11/Banner11';
import SiteFooter from '@/components/SiteFooter';
import { useFlags } from '@/lib/flags';

const U = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=60`;
const CATS: { t: PropertyType; icon: string }[] = [
  { t: 'apartment', icon: '🏢' }, { t: 'house', icon: '🏠' }, { t: 'villa', icon: '🏡' },
  { t: 'land', icon: '🪧' }, { t: 'commercial', icon: '🏬' }, { t: 'farm', icon: '🌳' },
];
// Tin mẫu tĩnh — đảm bảo mục Nổi bật KHÔNG BAO GIỜ trống (kể cả khi backend chưa lên)
const STATIC: Listing[] = ([
  ['Biệt thự nghỉ dưỡng ven biển Bãi Dài', 9.8e9, 420, 'villa', 'Cam Hải Đông', 4, '1613490493576-7fde63acd811'],
  ['Đất nền mặt tiền đường ven biển', 4.2e9, 250, 'land', 'Cam Hải Đông', null, '1500382017468-9049fed747ef'],
  ['Nhà phố trung tâm Cam Đức', 2.8e9, 96, 'house', 'Cam Đức', 3, '1568605114967-8130f3a36994'],
  ['Căn hộ view đầm Thủy Triều', 1.75e9, 65, 'apartment', 'Cam Đức', 2, '1502672260266-1c1ef2d93688'],
  ['Mặt bằng kinh doanh QL1A', 6.5e9, 320, 'commercial', 'Cam Đức', null, '1497366216548-37526070297c'],
  ['Đất vườn Suối Tân có suối tự nhiên', 1.9e9, 2000, 'farm', 'Suối Tân', null, '1449844908441-8829872d2607'],
  ['Biệt thự đơn lập khu compound', 12.5e9, 360, 'villa', 'Cam Hải Đông', 5, '1564013799919-ab600027ffc6'],
  ['Đất thổ cư Cam Thành Bắc', 1.25e9, 150, 'land', 'Cam Thành Bắc', null, '1542621334-a254cf47733d'],
] as [string, number, number, PropertyType, string, number | null, string][]).map(([title, price, area, t, ward, bed, img], i) => ({
  id: -(i + 1), title, description: null, price, area, propertyType: t, address: null, ward, bedrooms: bed,
  status: 'active', images: [U(img)], lng: 109.09, lat: 12.07, createdAt: '',
}));
/* ── ẢNH 14 XÃ/THỊ TRẤN CAM LÂM — CHỌN THEO ĐÚNG TÍNH CHẤT TỪNG NƠI ─────────
   Khai đủ 14 xã, NHƯNG NGOÀI TRANG CHỦ CHỈ HIỆN 5 Ô. Ba ô đầu ghim cứng, hai ô
   cuối tự xoay theo xã đang có nhiều tin đăng nhất (xem chỗ `GHIM` bên dưới).
   Khai dư ra như vậy để xã nào lên cũng CÓ SẴN ẢNH ĐÚNG VÙNG, khỏi phải sửa code.

   Không lấy ảnh đẹp bừa. Mỗi xã một kiểu địa lý, mật độ dân và tính chất đô thị
   khác hẳn nhau, ảnh phải nói đúng cái đó thì người xem mới nhận ra vùng mình
   đang tìm. Căn cứ lấy từ mô tả khu vực trong src/lib/seoLanding.ts.

   ⚠️ Trừ ảnh Bãi Dài là ảnh chụp THẬT của Cam Lâm, các ảnh còn lại là ảnh MINH HOẠ
   đúng tính chất vùng, không phải ảnh chụp tại chính xã đó. Có ảnh thật thì thay
   thẳng vào, giữ nguyên tên file. */
const AREAS = [
  // ── VEN BIỂN — mật độ thấp, đất du lịch nghỉ dưỡng ──
  { name: 'Cam Hải Đông', ward: 'Cam Hải Đông', sub: 'Bãi Dài · ven biển nghỉ dưỡng', img: '/bai-dai/bd-04.webp' },   // ảnh Bãi Dài THẬT
  { name: 'Cam Hải Tây', ward: 'Cam Hải Tây', sub: 'Nối Cam Đức ra biển', img: '/tin-mau/dat-nen-01.webp' },   // lối mòn ra phía mặt nước — xã nằm giữa Cam Đức và biển
  // ── TRUNG TÂM — dân cư đông, trên Quốc lộ 1 ──
  { name: 'Cam Đức', ward: 'Cam Đức', sub: 'Trung tâm huyện · dân cư đông', img: '/tin-mau/nha-02.webp' },             // dãy nhà phố liền kề
  { name: 'Cam Thành Bắc', ward: 'Cam Thành Bắc', sub: 'Ven đầm Thủy Triều', img: '/tin-mau/vuon-11.webp' },           // mặt nước đầm + núi
  // ── BẮC HUYỆN — ven đầm, nuôi trồng thuỷ sản ──
  { name: 'Cam Hòa', ward: 'Cam Hòa', sub: 'Ven đầm · nuôi trồng thủy sản', img: '/tin-mau/vuon-08.webp' },   // mặt nước đầm — xã ven đầm, nuôi trồng thuỷ sản
  { name: 'Cam Tân', ward: 'Cam Tân', sub: 'Giáp Ninh Hòa · đồng ruộng', img: '/tin-mau/vuon-09.webp' },
  // ── NÔNG NGHIỆP TRUNG TÂM — dân thưa ──
  { name: 'Cam Hiệp Bắc', ward: 'Cam Hiệp Bắc', sub: 'Vùng nông nghiệp', img: '/tin-mau/vuon-06.webp' },               // ruộng + hàng dừa
  { name: 'Cam Hiệp Nam', ward: 'Cam Hiệp Nam', sub: 'Đất nông nghiệp · thổ cư rộng', img: '/tin-mau/vuon-10.webp' },   // thung lũng có xóm nhà + ruộng
  // ── TÂY BẮC VEN NÚI — quỹ đất rộng, dân thưa nhất ──
  { name: 'Cam An Bắc', ward: 'Cam An Bắc', sub: 'Ven núi · quỹ đất rộng', img: '/tin-mau/dat-nen-07.webp' },          // đường đất giữa đồng trống
  { name: 'Cam An Nam', ward: 'Cam An Nam', sub: 'Gò đồi · giá mềm', img: '/tin-mau/dat-nen-06.webp' },   // đồng cỏ gò đồi, lối mòn — quỹ đất rộng
  // ── MIỀN TÂY — gò đồi, trang trại, đất rừng ──
  { name: 'Cam Phước Tây', ward: 'Cam Phước Tây', sub: 'Gò đồi · trang trại', img: '/tin-mau/vuon-14.webp' },   // vườn dừa có lối đi — vùng trang trại
  { name: 'Sơn Tân', ward: 'Sơn Tân', sub: 'Xã miền núi · đất rừng', img: '/tin-mau/vuon-05.webp' },
  // ── CỰC NAM — trên Quốc lộ 1, có khu công nghiệp ──
  { name: 'Suối Cát', ward: 'Suối Cát', sub: 'Trên Quốc lộ 1 · dân đông', img: '/tin-mau/nha-05.webp' },          // xóm nhà mái ngói ven quốc lộ — KHÔNG lấy ảnh nhà liền kề, trùng kiểu với Cam Đức
  { name: 'Suối Tân', ward: 'Suối Tân', sub: 'Khu công nghiệp Suối Dầu', img: '/tin-mau/dat-nen-02.webp' },            // mặt bằng san lấp, xe cơ giới
];

const STATS = [
  { n: '2,000+', l: 'Bất động sản', d: 'M3 21h18M5 21V7l6-4 6 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01' },
  { n: '5,000+', l: 'Khách hàng', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { n: '50+', l: 'Dự án quy hoạch', d: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { n: '8 năm', l: 'Kinh nghiệm', d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2' },
];

const NEWS: Record<string, { title: string; url: string; img?: string; date?: string; source?: string }[]> = {
  'Tin nổi bật': [
    { title: 'Thủ tướng phê duyệt Quy hoạch chung đô thị mới Cam Lâm đến năm 2045', url: 'https://thanhnien.vn/thu-tuong-phe-duyet-quy-hoach-chung-do-thi-moi-cam-lam-den-2045-185240228205628777.htm', img: U('1486406146926-c627a92ad1ab'), date: '28/02/2024' },
    { title: 'Cam Lâm trở thành cực tăng trưởng phía Nam Khánh Hòa và vùng Nam Trung Bộ', url: 'https://baochinhphu.vn/cam-lam-tro-thanh-cuc-tang-truong-vung-nam-trung-bo-102240228164301983.htm' },
    { title: 'Công bố 3 đồ án quy hoạch phân khu của Đô thị mới Cam Lâm', url: 'https://baokhanhhoa.vn/xa-hoi/202408/cong-bo-3-do-an-quy-hoach-phan-khu-cua-do-thi-moi-cam-lam-b956a11/' },
    { title: 'Đô thị sân bay Cam Lâm — tầm nhìn đô thị quốc tế đến năm 2045', url: 'https://quyhoach.xaydung.gov.vn/vn/quy-hoach/18260/quy-hoach-chung-do-thi-moi-cam-lam--tinh-khanh-hoa-den-nam-2045.aspx' },
    { title: 'Phê duyệt quy hoạch phân khu đô thị phía Bắc Cam Lâm', url: 'https://congbaokhanhhoa.gov.vn/noi-dung/id/3479/Phe-duyet-quy-hoach-phan-khu-do-thi-phia-Bac-Cam-Lam' },
    { title: 'Khánh Hòa hướng tới trở thành thành phố trực thuộc Trung ương', url: 'https://baochinhphu.vn/cam-lam-tro-thanh-cuc-tang-truong-vung-nam-trung-bo-102240228164301983.htm' },
  ],
  'Thị trường BĐS': [
    { title: 'Bất động sản Cam Lâm — cập nhật tin bán mới nhất', url: '/listings', img: U('1564013799919-ab600027ffc6'), date: 'Hôm nay' },
    { title: 'Nhà đất trung tâm Cam Đức', url: '/listings?q=Cam Đức' },
    { title: 'Đất nền ven biển Bãi Dài, Cam Hải Đông', url: '/listings?q=Cam Hải Đông' },
    { title: 'Ký gửi nhà đất — định giá & bán giúp miễn phí', url: '/listings' },
    { title: 'Đăng tin bán nhà đất miễn phí tại Cam Lâm', url: '/sales/post' },
  ],
  'Cẩm nang nhà đất': [
    { title: 'Thủ tục sang tên Sổ đỏ (chuyển nhượng quyền sử dụng đất)', url: '/cam-nang/sang-ten-so-do', img: U('1486406146926-c627a92ad1ab'), date: 'Cẩm nang' },
    { title: 'Các loại thuế, phí khi mua bán nhà đất phải nộp', url: '/cam-nang/thue-phi-mua-ban-nha-dat' },
    { title: 'Cách kiểm tra Sổ đỏ thật hay giả nhanh, chính xác', url: '/cam-nang/kiem-tra-so-do-that-gia' },
    { title: 'Cách kiểm tra đất có dính quy hoạch không', url: '/cam-nang/kiem-tra-quy-hoach-dat' },
    { title: '🔎 Tra cứu văn bản pháp luật nhà đất (quy hoạch, bồi thường, tái định cư, NOXH)', url: '/van-ban' },
    { title: '⚖️ Dịch vụ pháp lý nhà đất — sang tên, tách thửa, thuế phí', url: '/cam-nang#dich-vu-phap-ly' },
    { title: '📝 Mẫu hợp đồng đặt cọc Cam Lâm Land — tạo & in miễn phí', url: '/hop-dong-dat-coc' },
    { title: '📚 Xem tất cả cẩm nang pháp lý nhà đất', url: '/cam-nang' },
  ],
};

function Ic({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#0A2540]/60 shrink-0"><path d={d} /></svg>;
}

/* ── BẢNG "LỌC NÂNG CAO" TRÊN ĐIỆN THOẠI ─────────────────────────────────────
   Khoảng giá cất theo TỶ (y như trang /listings đang dùng): '' = không giới hạn.
   Diện tích cất theo m², 0 = không giới hạn — khớp AREA_RANGES bên trang /listings. */
const KHOANG_GIA: Record<'sale' | 'rent', [string, string, string][]> = {
  sale: [['Dưới 500 triệu', '', '0.5'], ['500 tr – 1 tỷ', '0.5', '1'], ['1 – 2 tỷ', '1', '2'], ['2 – 3 tỷ', '2', '3'],
         ['3 – 5 tỷ', '3', '5'], ['5 – 10 tỷ', '5', '10'], ['Trên 10 tỷ', '10', '']],
  rent: [['Dưới 3 triệu', '', '0.003'], ['3 – 5 triệu', '0.003', '0.005'], ['5 – 10 triệu', '0.005', '0.01'],
         ['10 – 30 triệu', '0.01', '0.03'], ['Trên 30 triệu', '0.03', '']],
};
const DIEN_TICH: [string, number, number][] = [['Dưới 50 m²', 0, 50], ['50 – 100 m²', 50, 100], ['100 – 150 m²', 100, 150],
  ['150 – 300 m²', 150, 300], ['300 – 1.000 m²', 300, 1000], ['Trên 1.000 m²', 1000, 0]];
const SAP_XEP: [string, string][] = [['default', 'Nổi bật'], ['newest', 'Mới nhất'], ['price-asc', 'Giá thấp → cao'], ['price-desc', 'Giá cao → thấp']];
/* Một mục trong bảng lọc = MỘT DÒNG gọn: tên mục bên trái, giá trị đang chọn bên phải, mũi tên.
   Bấm vào mới sổ các thẻ chọn ra; mỗi lúc chỉ mở MỘT mục (bảng cha giữ `moMuc`).
   ⚠️ Bản trước sổ hết mọi mục cùng lúc → chủ dự án chê "nhiều sổ ra hết nhìn chán, thô" (28/9/2026). */
function MucLoc({ ten, giaTri, co, mo, bat, children }: { ten: string; giaTri: string; co: boolean; mo: boolean; bat: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button type="button" onClick={bat} aria-expanded={mo} className="flex h-12 w-full items-center gap-3 text-left">
        <span className="flex-1 text-sm text-slate-700">{ten}</span>
        <span className={`max-w-[55%] truncate text-[13px] ${co ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{giaTri}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${mo ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {mo && <div className="flex flex-wrap gap-1.5 pb-3.5">{children}</div>}
    </div>
  );
}
// Thẻ chọn nhỏ gọn cao 32px. Đang chọn: nền đỏ nhạt, chữ đỏ.
function The({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] transition-colors ${on ? 'border-red-200 bg-red-50 font-semibold text-red-600' : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50'}`}>
      {children}
    </button>
  );
}

const SEARCH_HINTS = [
  'Đất nền Cam Lâm dưới 1 tỷ',
  'Nhà phố trung tâm Cam Đức',
  'Đất ven biển Bãi Dài, Cam Hải Đông',
  'Biệt thự nghỉ dưỡng gần sân bay Cam Ranh',
  'Đất nông nghiệp giá tốt Suối Tân',
];
// Placeholder gõ chữ luân phiên các gợi ý tìm kiếm để kích thích người dùng nhập.
function useTypingHint(items: string[]): string {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    let i = 0, ci = 0, del = false; let t: any;
    const tick = () => {
      const w = items[i % items.length];
      ci += del ? -1 : 1;
      setTxt(w.slice(0, Math.max(0, ci)));
      if (!del && ci >= w.length) { del = true; t = setTimeout(tick, 1500); return; }
      if (del && ci <= 0) { del = false; i++; t = setTimeout(tick, 350); return; }
      t = setTimeout(tick, del ? 35 : 70);
    };
    t = setTimeout(tick, 700);
    return () => clearTimeout(t);
  }, []);
  return txt;
}

type AreaWithCount = { name: string; ward: string; sub: string; img: string; count: number };
function AreaCard({ a, big }: { a: AreaWithCount; big?: boolean }) {
  return (
    <Link href={`/listings?ward=${encodeURIComponent(a.ward)}`}
      className={`cl-tap group relative rounded-2xl overflow-hidden shadow-sm bg-slate-100 ${big ? 'col-span-2 md:row-span-2 h-64 md:h-auto' : 'h-[132px] md:h-auto'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={a.img} alt={a.name} loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).src = NO_IMG; }} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
      {/* Lớp phủ CŨ đậm từ dưới lên tới tận giữa thẻ (90% → 25%) nên ảnh nào cũng
          thành xam xám, nhìn buồn. Nay chỉ tối ở ĐÁY — vừa đủ cho tên xã đọc rõ,
          phần ảnh phía trên để nguyên màu. */}
      <div className="absolute inset-x-0 bottom-0 h-3/5"
        style={{ background: 'linear-gradient(to top, rgba(10,37,64,0.86) 0%, rgba(10,37,64,0.45) 42%, rgba(10,37,64,0) 100%)' }} />
      <div className={`absolute left-0 bottom-0 text-white ${big ? 'p-4 md:p-6' : 'p-3.5'}`}>
        <p className={`font-bold leading-tight ${big ? 'text-2xl md:text-3xl' : 'text-base'}`}>{a.name}</p>
        <p className={`text-white/85 ${big ? 'text-sm mt-1' : 'text-[12px] mt-0.5'}`}>{a.count > 0 ? `${a.count.toLocaleString('vi-VN')} tin đăng` : a.sub}</p>
      </div>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const { flags } = useFlags();
  const [listings, setListings] = useState<Listing[]>([]);
  const [marketNews, setMarketNews] = useState<{ title: string; url: string; img?: string; date?: string; source?: string }[]>([]);
  const [featuredNews, setFeaturedNews] = useState<{ title: string; url: string; img?: string; date?: string; source?: string }[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [q, setQ] = useState(''); const [type, setType] = useState<PropertyType | ''>(''); const [max, setMax] = useState(''); const [expanded, setExpanded] = useState(false); const [newsTab, setNewsTab] = useState('Thị trường BĐS'); /* mở trang chủ là thấy TIN THỊ TRƯỜNG trước */ const [heroDeal, setHeroDeal] = useState<'sale' | 'rent' | 'project'>('sale');
  const searchHint = useTypingHint(SEARCH_HINTS);
  const [locMo, setLocMo] = useState(false); // bảng "Lọc nâng cao" trên điện thoại
  // Điều kiện lọc THÊM chỉ có trong bảng lọc điện thoại: giá từ (tỷ), xã, diện tích (m²), sắp xếp.
  const [min, setMin] = useState(''); const [xaLoc, setXaLoc] = useState('');
  const [dt, setDt] = useState<[number, number]>([0, 0]); const [sapXep, setSapXep] = useState('default');
  const coGia = heroDeal !== 'project';
  const soLoc = (type ? 1 : 0) + (xaLoc ? 1 : 0) + (coGia && (min || max) ? 1 : 0) + (coGia && (dt[0] || dt[1]) ? 1 : 0) + (coGia && sapXep !== 'default' ? 1 : 0); // hiện số trên nút lọc
  const [moMuc, setMoMuc] = useState(''); // mục đang sổ ra trong bảng lọc ('' = thu hết)
  const heSoGia = heroDeal === 'rent' ? 1000 : 1; // bán ghi tỷ, thuê ghi triệu
  const chuGia = (() => { // chữ tóm tắt khoảng giá ở dòng "Khoảng giá"
    const mau = KHOANG_GIA[heroDeal === 'rent' ? 'rent' : 'sale'].find(([, a, b]) => a === min && b === max);
    if (mau) return mau[0];
    if (!min && !max) return 'Tất cả';
    const dv = heroDeal === 'rent' ? ' triệu' : ' tỷ', so = (v: string) => String(+(Number(v) * heSoGia).toFixed(3));
    return min && max ? `${so(min)} – ${so(max)}${dv}` : min ? `Từ ${so(min)}${dv}` : `Đến ${so(max)}${dv}`;
  })();
  useEffect(() => { if (!locMo) setMoMuc(''); }, [locMo]); // mở lại bảng thì mọi mục đều thu gọn
  const datLaiLoc = () => { setType(''); setMin(''); setMax(''); setXaLoc(''); setDt([0, 0]); setSapXep('default'); };
  // Khoá cuộn trang phía sau khi bảng lọc đang mở (không thì vuốt trong bảng lại cuộn cả trang chủ).
  useEffect(() => {
    if (!locMo) return;
    const cu = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = cu; };
  }, [locMo]);
  // Bảng giá đổi theo tab (thuê tính triệu/tháng, bán tính tỷ). Dùng chung cho ô "Mức giá" máy tính và bảng lọc điện thoại.
  const MUC_GIA = heroDeal === 'rent'
    ? [{ gt: '0.003', ten: 'Dưới 3 triệu/tháng' }, { gt: '0.005', ten: 'Dưới 5 triệu/tháng' },
       { gt: '0.01', ten: 'Dưới 10 triệu/tháng' }, { gt: '0.03', ten: 'Dưới 30 triệu/tháng' }]
    : [{ gt: '1', ten: 'Dưới 1 tỷ' }, { gt: '3', ten: 'Dưới 3 tỷ' },
       { gt: '5', ten: 'Dưới 5 tỷ' }, { gt: '10', ten: 'Dưới 10 tỷ' }];
  /* ⚠️ MỤC "Bất động sản dành cho bạn" PHẢI ĐỔI THEO TAB ĐANG CHỌN ở khung
     tìm kiếm. Trước đây nó chỉ gọi /listings?limit=20 đúng một lần lúc mở
     trang, nên bấm sang "Cho thuê" thì khung tìm kiếm đổi mà danh sách bên
     dưới vẫn y nguyên tin BÁN — chủ dự án bắt lỗi "chỗ baner chưa chuyển theo".
     Nay tab đổi là gọi lại: 'rent' lấy tin cho thuê, còn lại lấy tin bán. */
  useEffect(() => {
    const p = heroDeal === 'rent' ? '/listings?limit=20&deal=rent' : '/listings?limit=20';
    let huy = false;
    api<{ listings: Listing[] }>(p)
      .then((d) => { if (!huy) setListings(d.listings || []); })
      .catch(() => {});
    return () => { huy = true; };
  }, [heroDeal]);
  const [areaCounts, setAreaCounts] = useState<Record<string, number>>({});
  useEffect(() => { api<{ areas: { ward: string; count: number }[] }>('/listings/areas').then((d) => { const m: Record<string, number> = {}; (d.areas || []).forEach((a) => { m[a.ward] = a.count; }); setAreaCounts(m); }).catch(() => {}); }, []);
  useEffect(() => {
    setMarketLoading(true);
    fetch('/feed/news')
      .then((r) => r.json())
      .then((d) => {
        const raw: any[] = d.news || [];
        const toCard = (n: any) => ({ title: n.title, url: '/tin-tuc/' + n.slug, img: n.image || U('1486406146926-c627a92ad1ab'), date: n.publishedAt ? new Date(n.publishedAt).toLocaleDateString('vi-VN') : undefined, source: n.source });
        setMarketNews(raw.filter((n) => !n.pin).map(toCard)); // Thị trường BĐS — GIỮ NGUYÊN (bỏ bài ghim)
        // Tin nổi bật: CHỈ tin về ĐÔ THỊ MỚI CAM LÂM (bài ghim + tin mới khớp từ khoá), mới nhất trước.
        const DTM = /đô thị mới cam lâm|đô thị sân bay cam lâm|đô thị cam lâm|phân khu.*cam lâm|cam lâm.*đô thị/i;
        const feat = raw.filter((n) => n.pin || DTM.test((n.title || '') + ' ' + (n.summary || ''))).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || +new Date(b.publishedAt) - +new Date(a.publishedAt)).map(toCard);
        setFeaturedNews(feat);
      })
      .catch(() => {})
      .finally(() => setMarketLoading(false));
  }, []);

  function search() {
    /* Chọn "Dự án" mà chưa gõ gì thì đưa thẳng xuống mục Dự án nổi bật ngay
       trang này — tìm rỗng chỉ ra một danh sách tin đăng lộn xộn, không ích gì.
       ⚠️ Web CHƯA có trang riêng cho dự án; mỗi dự án hiện đang tra bằng chính
       tên của nó trong kho tin đăng. Khi nào làm trang /du-an thì sửa ở đây. */
    if (heroDeal === 'project' && !q.trim()) {
      document.getElementById('du-an-noi-bat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    router.push(`/listings?${thamSoLoc().toString()}`);
  }
  // Gom mọi điều kiện lọc thành địa chỉ trang /listings. Dùng chung cho nút tìm và cho phần ĐẾM SỐ TIN trong bảng lọc.
  // Xã được ghép vào ô từ khoá: trang danh sách tìm không dấu trên tiêu đề + địa chỉ + tên xã nên ra đúng tin của xã đó.
  function thamSoLoc() {
    const p = new URLSearchParams();
    if (type) p.set('propertyType', type);
    const kw = [q.trim(), xaLoc].filter(Boolean).join(' ');
    if (kw) p.set('q', kw);
    if (heroDeal === 'rent') p.set('deal', 'rent');
    if (coGia) {
      if (min) p.set('minPrice', String(Math.round(Number(min) * 1e9)));
      if (max) p.set('maxPrice', String(Math.round(Number(max) * 1e9)));
      if (dt[0]) p.set('minArea', String(dt[0]));
      if (dt[1]) p.set('maxArea', String(dt[1]));
      if (sapXep !== 'default') p.set('sort', sapXep);
    }
    return p;
  }
  // ĐẾM TRƯỚC số tin khớp để nút cuối bảng lọc ghi "Xem 23 tin" — người dùng biết trước có hàng hay không,
  // khỏi bấm sang trang rồi mới thấy trống. Chờ 350ms sau lần chọn cuối mới hỏi máy chủ cho đỡ gọi dồn.
  const [soKhop, setSoKhop] = useState<number | null>(null);
  const khoaDem = locMo ? thamSoLoc().toString() : '';
  useEffect(() => {
    if (!locMo) return;
    setSoKhop(null);
    const t = setTimeout(() => {
      const p = thamSoLoc(); p.delete('sort'); p.delete('minArea'); p.delete('maxArea'); p.set('limit', '500');
      api<{ listings: Listing[] }>(`/listings?${p.toString()}`)
        .then((d) => setSoKhop((d.listings || []).filter((l) => { const a = l.area ?? 0; return (!dt[0] || a >= dt[0]) && (!dt[1] || a <= dt[1]); }).length))
        .catch(() => setSoKhop(null));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khoaDem]);
  const featured = listings.length > 0 ? listings : STATIC;
  const fromApi = listings.length > 0;
  const newsItems = newsTab === 'Thị trường BĐS' ? (marketNews.length ? marketNews.slice(0, 8) : NEWS['Thị trường BĐS'])
    : newsTab === 'Tin nổi bật' ? (featuredNews.length ? featuredNews.slice(0, 8) : NEWS['Tin nổi bật'])
    : NEWS[newsTab];
  const marketLoadingNow = marketLoading && ((newsTab === 'Thị trường BĐS' && !marketNews.length) || (newsTab === 'Tin nổi bật' && !featuredNews.length));
  /* ── CHỌN 5 KHU VỰC HIỆN RA TRANG CHỦ ───────────────────────────────────
     Ba xã dưới đây GHIM CỨNG, luôn hiện đúng thứ tự này dù tin đăng nhiều ít
     thế nào — chủ dự án đã chốt. Xã đầu tiên là THẺ LỚN bên trái.
     Hai ô còn lại để TỰ XOAY: trong 11 xã kia, xã nào đang nhiều tin đăng nhất
     thì lên. Nhờ vậy trang chủ luôn dẫn người xem tới chỗ đang có hàng.
     ⚠️ Muốn đổi 3 xã ghim thì sửa đúng dòng này, tên phải khớp cột `ward`. */
  const GHIM = ['Cam Hải Đông', 'Cam Đức', 'Cam Thành Bắc'];
  const kemSoTin = (a: (typeof AREAS)[number]): AreaWithCount => ({ ...a, count: areaCounts[a.ward] || 0 });
  const dsGhim = GHIM.map((w) => AREAS.find((a) => a.ward === w)).filter(Boolean).map((a) => kemSoTin(a!));
  const dsXoay = AREAS.filter((a) => !GHIM.includes(a.ward)).map(kemSoTin)
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'vi'));
  /* Ghim trước, xoay sau, cắt đúng 5 — bố cục lưới chỉ có 5 ô. */
  const khuVuc: AreaWithCount[] = [...dsGhim, ...dsXoay].slice(0, 5);
  const bigArea = khuVuc[0]; const gridAreas = khuVuc.slice(1);

  return (
    <div className="bg-slate-50">
      {/* HERO */}
      <Banner11>
          {/* ── KHUNG TÌM KIẾM KIỂU KHUNG KÍNH TỐI ──────────────────────────────
              Làm theo cách batdongsan.com.vn đang dùng (chủ dự án chỉ trang đó để
              tham khảo): cả tab lẫn ô nhập nằm TRONG MỘT KHUNG KÍNH TỐI MỜ, đặt
              giữa banner.
              ⚠️ Vì sao KHÔNG để thẻ trắng như trước: banner có 18 mẫu, mẫu nền
              sáng mẫu nền tối. Thẻ trắng rơi trúng mẫu nền sáng là chìm nghỉm,
              rơi trúng mẫu nền tối thì chói loà. Khung kính tối hợp với cả hai. */}
          {/* ⚠️ ĐIỆN THOẠI BỎ KHUNG KÍNH. Trên màn hẹp, khung tìm kiếm đã nằm
              hẳn DƯỚI ảnh trên một dải TRẮNG liền (trước là navy; xem .cl-b11-tim trong
              banner11-them.css), nên thêm một thẻ kính tối nữa là hộp lồng
              trong hộp — viền chồng viền, nhìn rối và tốn mất hai bên 8px
              vốn đã hẹp. Từ 768px trở lên mới cần khung kính, vì lúc đó nó
              nằm ĐÈ LÊN ảnh banner. */}
          <div className="border-0 bg-transparent p-0 shadow-none md:rounded-2xl md:border md:border-white/15 md:bg-black/45 md:p-2 md:shadow-2xl md:backdrop-blur-md">
            {/* Tab kiểu GẠCH CHÂN ĐỎ, làm theo đúng ảnh chủ dự án gửi (giống
                batdongsan.com.vn): chữ trắng, tab đang chọn in đậm và có một
                nét đỏ mảnh bên dưới. Không dùng nút bo tròn nền trắng nữa —
                nền trắng làm nặng mắt và che mất ảnh banner phía sau. */}
            <div className="mb-2 flex items-center justify-center gap-6 sm:gap-8">
              {([['sale', 'Nhà đất bán'], ['rent', 'Cho thuê'], ['project', 'Dự án']] as const).map(([k, ten]) => (
                <button key={k} onClick={() => { setHeroDeal(k); setMin(''); setMax(''); }}
                  className={`relative pb-1.5 text-[13px] transition sm:text-sm ${heroDeal === k ? 'font-bold text-[#0A2540] md:font-extrabold md:text-white' : 'font-medium text-slate-500 md:font-semibold md:text-white/75 md:hover:text-white'}`}>
                  {ten}
                  <span aria-hidden
                    className={`absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-red-500 transition-opacity ${heroDeal === k ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              ))}
            </div>

          {/* Search card */}
            {/* Hàng ô nhập — nằm ngay trong khung kính, không có thẻ trắng riêng */}
            {/* ⚠️ ĐIỆN THOẠI XẾP HAI CỘT, KHÔNG XẾP DỌC BỐN HÀNG.
                Trước đây ở màn hẹp lưới rơi về một cột, thành bốn hàng chồng
                nhau (ô tìm, Loại hình, Mức giá, nút) — cao gần bằng cả tấm
                banner, che gần hết ảnh, mà banner trên điện thoại chỉ cao
                268px. Nay: ô tìm chiếm trọn một hàng, hai ô sổ xuống đứng
                CẠNH NHAU một hàng, nút một hàng → còn ba hàng, thấp hơn hẳn
                mà vẫn bấm thoải mái. */}
            {/* ── ĐIỆN THOẠI: CHỈ MỘT Ô ──────────────────────────────────────
                Chủ dự án yêu cầu (28/9/2026): khung tìm kiếm trên điện thoại chỉ
                còn MỘT ô gõ chữ, bên phải có nút LỌC và nút KÍNH LÚP. Loại hình +
                mức giá dời vào bảng "Lọc nâng cao" trồi lên từ dưới khi bấm nút lọc.
                Nút lọc có số nhỏ màu đỏ = đang bật mấy điều kiện lọc.
                Máy tính (từ 768px) vẫn giữ nguyên hàng đầy đủ bên dưới. */}
            <div className="md:hidden">
              {/* Cân đối: lề trái = lề phải (6px quanh hai nút), hai nút CÙNG CỠ 32px (ô cao 44px — bản 48px chủ dự án chê to, thô) thành một cặp —
                  nút lọc nền xám nhạt, nút tìm nền đỏ. Trước đây nút đỏ 40px sát mép còn nút lọc chỉ là
                  một biểu tượng trơ trọi → chủ dự án thấy lệch (28/9/2026). */}
              {/* Nền dải bao quanh giờ là TRẮNG (hết navy) → ô tìm kiếm đổi sang nền xám rất nhạt + viền mảnh
                  cho nổi lên; nút lọc nền trắng để vẫn tách khỏi nền ô. */}
              <div className="flex h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-1.5 focus-within:border-[#C8A14B] focus-within:bg-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-slate-400"><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} enterKeyHint="search"
                  placeholder={heroDeal === 'project' ? 'Tên dự án…' : heroDeal === 'rent' ? 'Thuê nhà, mặt bằng ở đâu?' : (searchHint || 'Khu vực, dự án…')}
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" />
                <button type="button" onClick={() => setLocMo(true)} aria-label="Lọc nâng cao"
                  className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors ${soLoc > 0 ? 'bg-red-50 text-red-600' : 'border border-slate-200 bg-white text-[#0A2540] active:bg-slate-100'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
                  {soLoc > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">{soLoc}</span>}
                </button>
                <button type="button" onClick={search} aria-label={heroDeal === 'rent' ? 'Tìm thuê' : heroDeal === 'project' ? 'Xem dự án' : 'Tìm kiếm'}
                  className="cl-press grid h-8 w-8 shrink-0 place-items-center rounded-md bg-red-600 text-white active:bg-red-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-4 w-4"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
                </button>
              </div>
            </div>

            <div className={`hidden w-full gap-2 md:grid ${heroDeal === 'project'
              ? 'md:grid-cols-[2.5fr_1fr_auto]' : 'md:grid-cols-[1.5fr_1fr_1fr_auto]'}`}>
            <label className="col-span-2 flex items-center gap-2 rounded-xl border border-white/20 bg-white px-3 focus-within:border-[#C8A14B] md:col-span-1">
              <Ic d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder={heroDeal === 'project' ? 'Tên dự án: Golden Bay, Khu đô thị mới Cam Lâm…'
                : heroDeal === 'rent' ? 'Thuê nhà, phòng trọ, mặt bằng… ở khu vực nào?'
                : (searchHint || 'Khu vực, dự án…')} className="w-full py-2.5 text-sm text-slate-800 outline-none" />
            </label>
            {/* Hai ô sổ xuống dùng OChon chứ không dùng <select> của trình duyệt:
                bảng sổ xuống của <select> do hệ điều hành vẽ, không chỉnh được,
                nhìn lạc hẳn với giao diện (xem components/OChon.tsx). */}
            <div className={heroDeal === 'project' ? 'col-span-2 md:col-span-1' : ''}>
              <OChon giaTri={type} doiGiaTri={(v) => setType(v as PropertyType)} nhan="Loại hình"
                icon={<Ic d="M3 11l9-8 9 8M5 10v10h14V10" />}
                dsChon={CATS.map((c) => ({ gt: c.t, ten: PROPERTY_LABELS[c.t] }))} />
            </div>
            {/* ⚠️ BẢNG GIÁ ĐỔI THEO TẮB. Chủ dự án bấm sang "Cho thuê" rồi bảo
                "hình như chưa hoạt động" — đúng, vì trước đó bấm xong mọi thứ
                vẫn y nguyên: vẫn "Dưới 1 tỷ, dưới 3 tỷ…" trong khi nhà cho thuê
                tính bằng triệu mỗi tháng. Nay mỗi tắb một bảng giá riêng, và tắb
                "Dự án" thì bỏ hẳn ô giá (dự án không tra theo giá). */}
            {heroDeal !== 'project' && (
              <OChon giaTri={max} doiGiaTri={setMax} nhan="Mức giá"
                icon={<Ic d="M20.6 13.4 12 22l-9-9V3h8z M7 7h.01" />}
                dsChon={MUC_GIA} />
            )}
              <button onClick={search} className="cl-press col-span-2 min-h-[44px] whitespace-nowrap rounded-xl bg-red-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 md:col-span-1">
                {heroDeal === 'rent' ? 'Tìm thuê' : heroDeal === 'project' ? 'Xem dự án' : 'Tìm kiếm'}
              </button>
            </div>
          </div>

      </Banner11>

      {/* BẢNG "LỌC NÂNG CAO" (chỉ điện thoại) — trồi lên từ đáy màn hình khi bấm nút lọc trong ô tìm kiếm.
          Đặt NGOÀI banner vì banner cắt cụt mọi thứ tràn ra ngoài nó.
          Dùng nút bấm dạng thẻ thay cho ô sổ xuống: ngón tay chọn một chạm là xong. */}
      {locMo && (
        <div className="md:hidden fixed inset-0 z-[70]" role="dialog" aria-label="Lọc nâng cao">
          <div className="absolute inset-0 bg-[#0A2540]/40 cl-sheet-fade" onClick={() => setLocMo(false)} aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl bg-white px-4 pt-2 shadow-2xl cl-sheet-up" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mb-1 h-1 w-9 rounded-full bg-slate-300" />
            {/* Đầu bảng: [×] — tên bảng ở giữa — số điều kiện đang bật */}
            <div className="-mx-4 mb-3 grid grid-cols-[40px_1fr_40px] items-center border-b border-slate-100 px-2 pb-2">
              <button type="button" onClick={() => setLocMo(false)} aria-label="Đóng" className="grid h-10 w-10 place-items-center rounded-full text-slate-500 active:bg-slate-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
              <span className="text-center text-base font-bold text-[#0A2540]">Lọc nâng cao</span>
              <span className="text-center text-[12px] font-semibold text-red-600">{soLoc > 0 ? `${soLoc} lọc` : ''}</span>
            </div>

            <div className="-mx-4 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
              {/* Nhu cầu: đổi ngay trong bảng, khỏi đóng ra bấm tab trên banner */}
              <div className="mb-1 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {([['sale', 'Mua bán'], ['rent', 'Cho thuê'], ['project', 'Dự án']] as const).map(([k, ten]) => (
                  <button key={k} type="button" onClick={() => { if (k !== heroDeal) { setHeroDeal(k); setMin(''); setMax(''); } }}
                    className={`h-8 rounded-md text-[13px] transition-colors ${heroDeal === k ? 'bg-white font-semibold text-[#0A2540] shadow-sm' : 'font-medium text-slate-500'}`}>{ten}</button>
                ))}
              </div>

              {/* Chọn xong một thẻ là mục tự thu lại (trừ ô tự gõ giá) → bảng luôn gọn. */}
              <MucLoc ten="Loại hình" giaTri={type ? PROPERTY_LABELS[type] : 'Tất cả'} co={!!type}
                mo={moMuc === 'loai'} bat={() => setMoMuc(moMuc === 'loai' ? '' : 'loai')}>
                {CATS.map((c) => (
                  <The key={c.t} on={type === c.t} onClick={() => { setType(type === c.t ? '' : c.t); setMoMuc(''); }}>{PROPERTY_LABELS[c.t]}</The>
                ))}
              </MucLoc>

              <MucLoc ten="Khu vực" giaTri={xaLoc || 'Tất cả'} co={!!xaLoc}
                mo={moMuc === 'xa'} bat={() => setMoMuc(moMuc === 'xa' ? '' : 'xa')}>
                {AREAS.map((a) => (
                  <The key={a.ward} on={xaLoc === a.ward} onClick={() => { setXaLoc(xaLoc === a.ward ? '' : a.ward); setMoMuc(''); }}>{a.name}</The>
                ))}
              </MucLoc>

              {coGia && (<>
                <MucLoc ten={heroDeal === 'rent' ? 'Giá thuê' : 'Khoảng giá'} giaTri={chuGia} co={!!(min || max)}
                  mo={moMuc === 'gia'} bat={() => setMoMuc(moMuc === 'gia' ? '' : 'gia')}>
                  {KHOANG_GIA[heroDeal === 'rent' ? 'rent' : 'sale'].map(([ten, a, b]) => {
                    const on = min === a && max === b;
                    return <The key={ten} on={on} onClick={() => { setMin(on ? '' : a); setMax(on ? '' : b); setMoMuc(''); }}>{ten}</The>;
                  })}
                  {/* Tự gõ khoảng giá. Bán tính bằng TỶ, thuê tính bằng TRIỆU — trong máy vẫn cất theo tỷ như cũ. */}
                  <div className="mt-1 flex w-full items-center gap-2">
                    {([['Từ', min, setMin], ['Đến', max, setMax]] as const).map(([nhan, gt, dat]) => (
                      <label key={nhan} className="flex h-9 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 focus-within:border-red-300">
                        <span className="text-[12px] text-slate-400">{nhan}</span>
                        <input inputMode="decimal" value={gt ? String(+(Number(gt) * heSoGia).toFixed(3)) : ''}
                          onChange={(e) => { const v = e.target.value.replace(',', '.').replace(/[^\d.]/g, ''); dat(v ? String(Number(v) / heSoGia) : ''); }}
                          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none" />
                        <span className="text-[12px] text-slate-400">{heroDeal === 'rent' ? 'triệu' : 'tỷ'}</span>
                      </label>
                    ))}
                  </div>
                </MucLoc>

                <MucLoc ten="Diện tích" giaTri={DIEN_TICH.find(([, a, b]) => dt[0] === a && dt[1] === b)?.[0] || 'Tất cả'} co={!!(dt[0] || dt[1])}
                  mo={moMuc === 'dt'} bat={() => setMoMuc(moMuc === 'dt' ? '' : 'dt')}>
                  {DIEN_TICH.map(([ten, a, b]) => {
                    const on = dt[0] === a && dt[1] === b;
                    return <The key={ten} on={on} onClick={() => { setDt(on ? [0, 0] : [a, b]); setMoMuc(''); }}>{ten}</The>;
                  })}
                </MucLoc>

                <MucLoc ten="Sắp xếp" giaTri={SAP_XEP.find(([k]) => k === sapXep)?.[1] || 'Nổi bật'} co={sapXep !== 'default'}
                  mo={moMuc === 'sx'} bat={() => setMoMuc(moMuc === 'sx' ? '' : 'sx')}>
                  {SAP_XEP.map(([k, ten]) => (
                    <The key={k} on={sapXep === k} onClick={() => { setSapXep(k); setMoMuc(''); }}>{ten}</The>
                  ))}
                </MucLoc>
              </>)}
            </div>

            {/* Chân bảng luôn đứng yên dưới đáy: Đặt lại + nút xem kèm SỐ TIN ĐẾM TRƯỚC */}
            <div className="-mx-4 flex gap-2 border-t border-slate-100 px-4 pt-3">
              <button type="button" onClick={datLaiLoc} disabled={soLoc === 0}
                className="h-11 flex-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-40">
                Đặt lại
              </button>
              <button type="button" onClick={() => { setLocMo(false); search(); }} disabled={soKhop === 0}
                className="cl-press h-11 flex-[2] rounded-lg bg-red-600 text-sm font-bold text-white active:bg-red-700 disabled:bg-slate-300 disabled:shadow-none">
                {soKhop === 0 ? 'Không có tin phù hợp'
                  : soKhop == null ? (heroDeal === 'rent' ? 'Tìm thuê' : heroDeal === 'project' ? 'Xem dự án' : 'Xem kết quả')
                  : `Xem ${soKhop >= 500 ? '500+' : soKhop.toLocaleString('vi-VN')} tin`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIN TỨC & QUY HOẠCH — kiểu batdongsan */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-8">
        {/* `no-scrollbar`: trên điện thoại dải tab này dài hơn màn nên trình duyệt
            vẽ một thanh cuộn xám ngay dưới, nhìn rất thô. Vuốt vẫn cuộn được. */}
        <div className="flex items-center gap-5 border-b border-slate-200 mb-5 overflow-x-auto no-scrollbar">
          {Object.keys(NEWS).map((t) => (
            <button key={t} onClick={() => setNewsTab(t)} className={`pb-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px ${newsTab === t ? 'border-red-600 text-[#0A2540]' : 'border-transparent text-slate-500 hover:text-[#0A2540]'}`}>{t}</button>
          ))}
          <Link href="/tin-tuc" className="ml-auto text-red-600 text-sm font-semibold whitespace-nowrap shrink-0">Xem thêm →</Link>
        </div>
        <div className="grid lg:grid-cols-[1.05fr_1fr_0.62fr] gap-3 sm:gap-6">
          {marketLoadingNow ? (
            <div className="lg:col-span-2 grid place-items-center min-h-[220px] text-slate-400 text-sm">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin mx-auto" />
                <p className="mt-3">Đang tải tin…</p>
              </div>
            </div>
          ) : (<>
          {(() => { const feat = newsItems[0]; return (
            <a href={feat.url} target={feat.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="group block">
              <div className="aspect-[16/10] rounded-xl overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={feat.img} alt={feat.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
              </div>
              <h3 className="font-extrabold text-[#0A2540] mt-3 text-lg leading-snug line-clamp-2 group-hover:text-red-600">{feat.title}</h3>
              {feat.date && <p className="text-xs text-slate-400 mt-2">🕒 {feat.date}{feat.source ? ` · ${feat.source}` : ''}</p>}
            </a>
          ); })()}
          <div className="divide-y divide-slate-100">
            {newsItems.slice(1).map((h) => (
              <a key={h.title} href={h.url} target={h.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="block py-2.5 text-[15px] text-slate-700 hover:text-red-600 leading-snug line-clamp-2">{h.title}</a>
            ))}
          </div>
          </>)}
          <div className="space-y-4">
            <Link href="/map" className="block rounded-xl bg-gradient-to-br from-[#a3121b] to-[#6d0d14] text-white p-5 hover:brightness-110 transition active:scale-[.98]">
              <p className="text-[11px] tracking-wide text-white/70 font-semibold">CAM LÂM LAND</p>
              <p className="font-extrabold text-lg mt-1 leading-tight">Sàn BĐS & Bản đồ quy hoạch Cam Lâm</p>
              <p className="text-xs text-white/80 mt-1.5 leading-snug">Tra cứu quy hoạch, mua bán nhà đất, nền vệ tinh — tất cả tại một nơi.</p>
              <span className="inline-block mt-3 bg-white text-[#a3121b] text-xs font-bold px-3 py-1.5 rounded">Khám phá ngay →</span>
            </Link>
            <Link href="/sales/post" className="block rounded-xl bg-gradient-to-br from-[#0A2540] to-[#0d2f54] text-white p-5 hover:brightness-110 transition active:scale-[.98]">
              <p className="text-[11px] tracking-wide text-[#C8A14B] font-semibold">MIỄN PHÍ</p>
              <p className="font-extrabold text-lg mt-1 leading-tight">Đăng tin — tiếp cận khách mua ngay</p>
              <span className="inline-block mt-3 bg-[#C8A14B] text-[#0A2540] text-xs font-bold px-3 py-1.5 rounded">Đăng tin ngay →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED — kiểu batdongsan */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
          <h2 className="text-xl md:text-2xl font-extrabold text-[#0A2540]">
            {heroDeal === 'rent' ? 'Nhà đất cho thuê dành cho bạn'
              : heroDeal === 'project' ? 'Dự án dành cho bạn' : 'Bất động sản dành cho bạn'}
          </h2>
          <div className="flex items-center gap-3 text-sm font-semibold text-[#0A2540]">
            <Link href="/listings" className="hover:text-red-600">Tin bán mới nhất</Link>
            <span className="text-slate-300">|</span>
            <Link href="/listings?deal=rent" className="hover:text-red-600">Tin cho thuê mới nhất</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {(expanded ? featured : featured.slice(0, 8)).map((l) => <ListingCard key={l.id} l={l} href={fromApi ? undefined : '/listings'} />)}
        </div>
        <div className="mt-6 sm:mt-8 text-center">
          {featured.length > 8 ? (
            <button onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-[#0A2540] hover:text-[#0A2540] text-slate-600 font-semibold rounded-full px-7 py-2.5 bg-white transition">
              {expanded ? 'Thu gọn' : 'Mở rộng'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
            </button>
          ) : (
            <Link href="/listings" className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-[#0A2540] text-[#0A2540] font-semibold rounded-full px-7 py-2.5 bg-white">Xem tất cả →</Link>
          )}
        </div>
      </section>

      {/* DỰ ÁN BĐS NỔI BẬT — admin quản lý (kiểu batdongsan) */}
      <FeaturedProjects />

      {/* PROMO BANNER — quảng cáo (kiểu batdongsan) */}
      <PromoBanner />

      {/* BĐS THEO ĐỊA ĐIỂM — ô lớn + lưới + số tin (kiểu batdongsan) */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-8">
        <h2 className="text-xl md:text-2xl font-extrabold text-[#0A2540] mb-4 sm:mb-6">Bất động sản theo địa điểm</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-3 md:gap-4 md:h-[420px]">
          {bigArea && <AreaCard a={bigArea} big />}
          {gridAreas.map((a) => <AreaCard key={a.ward} a={a} />)}
        </div>
      </section>

      {/* HỖ TRỢ TIỆN ÍCH */}
      <HomeUtilities />

      {/* DOANH NGHIỆP TIÊU BIỂU — logo carousel (kiểu batdongsan) */}
      <FeaturedPartners />

      {/* PLANNING PROMO — dưới Tiện ích & Doanh nghiệp tiêu biểu */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-8">
        <div className="grid md:grid-cols-2 rounded-xl sm:rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="p-5 sm:p-8 md:p-12 flex flex-col justify-center">
            <span className="text-[#C8A14B] font-semibold text-sm tracking-wide">BẢN ĐỒ QUY HOẠCH</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A2540] mt-2">Tra cứu quy hoạch & thửa đất chính xác</h2>
            <p className="text-sm sm:text-base text-slate-500 mt-2 sm:mt-3">Quy hoạch sử dụng đất, nền vệ tinh độ nét cao, tra cứu theo số thửa/số tờ/xã, toạ độ VN-2000, đo đạc trực tiếp trên bản đồ.</p>
            <div className="mt-4 sm:mt-6 flex gap-3">
              <Link href="/map" className="cl-press bg-[#0A2540] hover:bg-[#0d2f54] text-white font-semibold px-6 py-3 rounded-xl">Mở bản đồ →</Link>
              <Link href="/qr" className="cl-press border border-slate-300 text-[#0A2540] font-semibold px-6 py-3 rounded-xl hover:bg-slate-50">Tra cứu QR</Link>
            </div>
          </div>
          <div className="bg-slate-100 flex items-center justify-center min-h-[280px] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/quyhoach-camlam.jpg" alt="Mô hình quy hoạch Cam Lâm" loading="lazy" decoding="async" className="w-full h-full object-contain max-h-[460px] rounded-xl" />
          </div>
        </div>
      </section>

      {/* AD CONTACT — tế nhị */}
      {flags.services_live && (
      <section className="mx-auto max-w-7xl px-3 sm:px-4 pb-8 sm:pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-bold text-[#0A2540]">📣 Quảng cáo cùng Cam Lâm Land</p>
            <p className="text-sm text-slate-500 mt-0.5">Đưa thương hiệu, dự án của bạn đến khách quan tâm bất động sản Cam Lâm — banner, logo trên bản đồ, đẩy tin nổi bật.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/dichvu" className="border border-slate-300 text-[#0A2540] font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 text-sm whitespace-nowrap">Xem dịch vụ</Link>
            <a href="tel:0988888888" className="cl-press bg-[#0A2540] hover:bg-[#0d2f54] text-white font-semibold px-5 py-2.5 rounded-xl text-sm whitespace-nowrap">Liên hệ quảng cáo</a>
          </div>
        </div>
      </section>
      )}

      {/* FOOTER — nhiều tầng (kiểu batdongsan) */}
      <SiteFooter />
    </div>
  );
}
