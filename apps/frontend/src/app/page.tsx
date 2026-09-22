'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, NO_IMG } from '@/lib/api';
import { Listing, PropertyType, PROPERTY_LABELS } from '@/lib/types';
import ListingCard from '@/components/ListingCard';
import HomeUtilities from '@/components/HomeUtilities';
import PromoBanner from '@/components/PromoBanner';
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
  useEffect(() => { api<{ listings: Listing[] }>('/listings?limit=20').then((d) => setListings(d.listings || [])).catch(() => {}); }, []);
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
    const p = new URLSearchParams();
    if (type) p.set('propertyType', type); if (max) p.set('maxPrice', String(Number(max) * 1e9)); if (q) p.set('q', q);
    if (heroDeal === 'rent') p.set('deal', 'rent');
    router.push(`/listings?${p.toString()}`);
  }
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
          {/* Nhà đất bán · Cho thuê · Dự án */}
          {/* Nền XANH ĐẶC chứ không phải nền mờ: hàng nút này nằm vắt ngang mép dưới
              banner, nửa trên đè lên ảnh, nửa dưới nằm trên nền trang màu sáng —
              nền mờ thì chữ trắng rơi xuống phần sáng là mất hút. */}
          <div className="inline-flex rounded-full border border-white/15 bg-[#0A2540] p-1 shadow-lg">
            {([['sale', 'Nhà đất bán'], ['rent', 'Cho thuê'], ['project', 'Dự án']] as const).map(([k, ten]) => (
              <button key={k} onClick={() => setHeroDeal(k)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition sm:px-5 ${heroDeal === k ? 'bg-white text-[#0A2540]' : 'text-white/90 hover:text-white'}`}>{ten}</button>
            ))}
          </div>

          {/* Search card */}
          {/* KHÔNG đặt lại max-w-5xl: ô tìm kiếm phải kéo dài hết chiều ngang của
              dải xanh, nếu không hai bên thừa hai mảng trống nhìn rất chắp vá. */}
          <div className="mt-3 grid w-full gap-2 rounded-xl bg-white p-2 shadow-2xl sm:p-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
            <label className="flex items-center gap-2 px-3 rounded-xl border border-slate-200 focus-within:border-[#0A2540]">
              <Ic d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder={heroDeal === 'project' ? 'Tên dự án: Golden Bay, Khu đô thị mới Cam Lâm…' : (searchHint || 'Khu vực, dự án…')} className="py-3 w-full outline-none text-slate-800 text-sm" />
            </label>
            <label className="flex items-center gap-2 px-3 rounded-xl border border-slate-200">
              <Ic d="M3 11l9-8 9 8M5 10v10h14V10" />
              <select value={type} onChange={(e) => setType(e.target.value as PropertyType)} className="py-3 w-full outline-none text-slate-700 text-sm bg-transparent">
                <option value="">Loại hình</option>{CATS.map((c) => <option key={c.t} value={c.t}>{PROPERTY_LABELS[c.t]}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 px-3 rounded-xl border border-slate-200">
              <Ic d="M20.6 13.4 12 22l-9-9V3h8z M7 7h.01" />
              <select value={max} onChange={(e) => setMax(e.target.value)} className="py-3 w-full outline-none text-slate-700 text-sm bg-transparent">
                <option value="">Mức giá</option><option value="1">Dưới 1 tỷ</option><option value="3">Dưới 3 tỷ</option><option value="5">Dưới 5 tỷ</option><option value="10">Dưới 10 tỷ</option>
              </select>
            </label>
            <button onClick={search} className="cl-press bg-red-600 hover:bg-red-700 text-white font-bold px-7 py-3 rounded-xl whitespace-nowrap shadow-lg shadow-red-600/30">Tìm kiếm</button>
          </div>

      </Banner11>

      {/* TIN TỨC & QUY HOẠCH — kiểu batdongsan */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-8">
        <div className="flex items-center gap-5 border-b border-slate-200 mb-5 overflow-x-auto">
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
          <h2 className="text-xl md:text-2xl font-extrabold text-[#0A2540]">Bất động sản dành cho bạn</h2>
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
