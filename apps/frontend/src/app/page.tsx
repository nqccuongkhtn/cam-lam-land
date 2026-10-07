'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, NO_IMG } from '@/lib/api';
import { Listing, PropertyType, PROPERTY_LABELS, SALE_PROPERTY_TYPES, RENT_PROPERTY_TYPES } from '@/lib/types';
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
import OQuangCaoTrangChu from '@/components/OQuangCaoTrangChu';
import { useFlags } from '@/lib/flags';
import { LOAI_DU_AN, TRANG_THAI_DU_AN, loaiCua, trangThaiCua, type DuAnGoiY } from '@/lib/duAnLoc';
import { KhungBangLoc, NutXemKetQua, MucLoc, NutLien, OLuoi, KhoangKeo, TRAN_GIA, TRAN_DT, tomTat } from '@/components/LocNangCao';

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
  // Tab đổi tên "Cẩm nang nhà đất" → "Tra cứu văn bản" (chủ dự án 7/10/2026): bài NỔI BẬT (dòng đầu, có ảnh)
  // là Tra cứu văn bản thay cho Thủ tục sang tên Sổ đỏ; 3 dòng kế đưa lên trên, 4 bài cẩm nang xuống dưới.
  'Tra cứu văn bản': [
    // Ảnh: xấp Giấy chứng nhận (sổ hồng) chủ dự án gửi 6/10/2026 — file public/cam-nang/so-hong.webp
    // Câu chữ (chủ dự án chốt 7/10/2026): GIỮ cách viết ban đầu, chỉ thêm "..." sau NOXH (kho còn nhiều loại văn bản khác).
    // Thứ tự: dịch vụ → hợp đồng → cẩm nang → 4 bài con của cẩm nang (cẩm nang đứng ngay trên các bài con của nó).
    { title: 'Tra cứu văn bản pháp luật nhà đất (quy hoạch, bồi thường, tái định cư, NOXH...)', url: '/van-ban', img: '/cam-nang/so-hong.webp' },
    { title: 'Dịch vụ pháp lý nhà đất — sang tên, tách thửa, thuế phí', url: '/cam-nang#dich-vu-phap-ly' },
    { title: 'Mẫu hợp đồng đặt cọc Cam Lâm Land — tạo & in miễn phí', url: '/hop-dong-dat-coc' },
    { title: 'Xem tất cả cẩm nang pháp lý nhà đất', url: '/cam-nang' },
    { title: 'Thủ tục sang tên Sổ đỏ (chuyển nhượng quyền sử dụng đất)', url: '/cam-nang/sang-ten-so-do' },
    { title: 'Các loại thuế, phí khi mua bán nhà đất phải nộp', url: '/cam-nang/thue-phi-mua-ban-nha-dat' },
    { title: 'Cách kiểm tra Sổ đỏ thật hay giả nhanh, chính xác', url: '/cam-nang/kiem-tra-so-do-that-gia' },
    { title: 'Cách kiểm tra đất có dính quy hoạch không', url: '/cam-nang/kiem-tra-quy-hoach-dat' },
  ],
};

// Khối bên trái của tab "Tra cứu văn bản" — MẪU 105 + nền ảnh của MẪU 101 (chủ dự án chọn 7/10/2026).
// Ảnh sổ hồng làm nền, chữ đè lên, có ô tìm + nút chủ đề → mở /van-ban đã lọc sẵn (?q= / ?chude=).
// Không đặt "văn bản mới" ở đây: kho văn bản cần đăng nhập, khách chưa đăng nhập sẽ thấy khối trống.
const CHU_DE_NHANH: [string, string][] = [
  ['Quy hoạch', 'Quy hoạch'], ['Bồi thường, TĐC', 'Bồi thường & Tái định cư'], ['Giấy chứng nhận', 'Giấy chứng nhận'], ['Nhà ở xã hội', 'Nhà ở xã hội'],
];
function KhoiTraCuuVanBan({ tieuDe, anh }: { tieuDe: string; anh?: string }) {
  const router = useRouter();
  const [tu, setTu] = useState('');
  const i = tieuDe.indexOf(' (');
  const chinh = i > 0 ? tieuDe.slice(0, i) : tieuDe;            // "Tra cứu văn bản pháp luật nhà đất"
  const phu = i > 0 ? tieuDe.slice(i + 2).replace(/\)$/, '') : ''; // "quy hoạch, bồi thường, tái định cư, NOXH..."
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#0A2540] min-h-[270px] sm:min-h-[300px] lg:min-h-0 lg:h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {anh && <img src={anh} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A2540]/95 via-[#0A2540]/80 to-[#0A2540]/40" />
      <div className="relative flex h-full flex-col justify-center gap-3 p-4 sm:p-6">
        <div>
          <h3 className="text-xl font-extrabold leading-snug text-white sm:text-2xl">{chinh}</h3>
          {phu && <p className="mt-1 text-[13px] text-white/80 sm:text-sm">{phu.charAt(0).toUpperCase() + phu.slice(1)}</p>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); router.push('/van-ban' + (tu.trim() ? `?q=${encodeURIComponent(tu.trim())}` : '')); }} className="flex gap-2">
          <input value={tu} onChange={(e) => setTu(e.target.value)} placeholder="Số hiệu hoặc tên văn bản, vd 1264/QĐ-UBND"
            aria-label="Tìm văn bản" className="h-11 min-w-0 flex-1 rounded-md border-0 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#C8A14B]" />
          <button type="submit" className="h-11 shrink-0 rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700">Tìm</button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {CHU_DE_NHANH.map(([nhan, ma]) => (
            <Link key={ma} href={`/van-ban?chude=${encodeURIComponent(ma)}`}
              className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12.5px] font-medium text-white hover:bg-white/20">{nhan}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Ic({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#0A2540]/60 shrink-0"><path d={d} /></svg>;
}

// Bảng "Lọc nâng cao" (điện thoại): giao diện dùng chung với trang Nhà đất — components/LocNangCao.tsx

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
  const [q, setQ] = useState(''); const [type, setType] = useState<PropertyType | ''>(''); const [max, setMax] = useState(''); const [newsTab, setNewsTab] = useState('Thị trường BĐS'); /* mở trang chủ là thấy TIN THỊ TRƯỜNG trước */ const [heroDeal, setHeroDeal] = useState<'sale' | 'rent' | 'project'>('sale');
  const searchHint = useTypingHint(SEARCH_HINTS);
  const [locMo, setLocMo] = useState(false); // bảng "Lọc nâng cao" trên điện thoại
  // Điều kiện lọc THÊM chỉ có trong bảng lọc điện thoại: giá từ (tỷ), xã, diện tích (m²), sắp xếp.
  const [min, setMin] = useState(''); const [xaLoc, setXaLoc] = useState('');
  const [dt, setDt] = useState<[number, number]>([0, 0]);
  const coGia = heroDeal !== 'project';
  // TAB DỰ ÁN lọc theo thứ khác hẳn tin đăng: loại dự án + trạng thái (dữ liệu dự án không có giá/diện tích/xã).
  const [duAn, setDuAn] = useState<DuAnGoiY[]>([]);
  useEffect(() => { api<{ projects: DuAnGoiY[] }>('/projects').then((r) => setDuAn(r.projects || [])).catch(() => {}); }, []);
  const [loaiDA, setLoaiDA] = useState<string[]>([]); const [ttDA, setTtDA] = useState('');
  const [locDuAn, setLocDuAn] = useState<number[] | null>(null); // mã dự án đang lọc ở mục "Dự án nổi bật"; null = hiện hết
  const duAnKhop = duAn.filter((p) => (!loaiDA.length || loaiCua(p).some((l) => loaiDA.includes(l))) && (!ttDA || trangThaiCua(p) === ttDA));
  const soLoc = heroDeal === 'project'
    ? loaiDA.length + (ttDA ? 1 : 0)
    : (type ? 1 : 0) + (xaLoc ? 1 : 0) + (min || max ? 1 : 0) + (dt[0] || dt[1] ? 1 : 0); // hiện số trên nút lọc
  const heSoGia = heroDeal === 'rent' ? 1000 : 1; // trong máy cất theo tỷ; bán hiện tỷ, thuê hiện triệu
  const tranGia = TRAN_GIA[heroDeal === 'rent' ? 'rent' : 'sale'];
  const giaLo = min ? Number(min) * heSoGia : 0, giaHi = max ? Number(max) * heSoGia : tranGia.tran; // theo đơn vị hiển thị
  // Đổi nhu cầu mà loại hình đang chọn không có ở nhu cầu mới (vd "Biệt thự" → sang Cho thuê, hay sang Dự án) thì bỏ chọn.
  useEffect(() => {
    const ds: PropertyType[] = heroDeal === 'rent' ? RENT_PROPERTY_TYPES : heroDeal === 'sale' ? SALE_PROPERTY_TYPES : [];
    if (type && !ds.includes(type)) setType('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroDeal]);
  const datLaiLoc = () => { setType(''); setMin(''); setMax(''); setXaLoc(''); setDt([0, 0]); setLoaiDA([]); setTtDA(''); };
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
    fetch('/feed/news?gon=1') /* gọn: không kèm toàn văn bài */
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
  // Tab Dự án: ÁP bộ lọc vào mục "Dự án nổi bật" ngay trang này rồi cuộn xuống đó (web chưa có trang dự án riêng).
  function xemDuAn(ids: number[]) {
    setLocDuAn(ids);
    setTimeout(() => document.getElementById('du-an-noi-bat')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
  // Gom mọi điều kiện lọc thành địa chỉ trang /listings. Dùng chung cho nút tìm và cho phần ĐẾM SỐ TIN trong bảng lọc.
  // Xã được ghép vào ô từ khoá: trang danh sách tìm không dấu trên tiêu đề + địa chỉ + tên xã nên ra đúng tin của xã đó.
  function thamSoLoc(thay?: { q?: string; xa?: string; deal?: string }) {
    const p = new URLSearchParams();
    const deal = thay?.deal ?? heroDeal;
    if (type) p.set('propertyType', type);
    const kw = [(thay?.q ?? q).trim(), thay?.xa ?? xaLoc].filter(Boolean).join(' ');
    if (kw) p.set('q', kw);
    if (deal === 'rent') p.set('deal', 'rent');
    if (deal !== 'project') {
      if (min) p.set('minPrice', String(Math.round(Number(min) * 1e9)));
      if (max) p.set('maxPrice', String(Math.round(Number(max) * 1e9)));
      if (dt[0]) p.set('minArea', String(dt[0]));
      if (dt[1]) p.set('maxArea', String(dt[1]));
    }
    return p;
  }
  // ĐẾM TRƯỚC số tin khớp để nút cuối bảng lọc ghi "Xem 23 tin" — người dùng biết trước có hàng hay không,
  // khỏi bấm sang trang rồi mới thấy trống. Chờ 350ms sau lần chọn cuối mới hỏi máy chủ cho đỡ gọi dồn.
  const [soKhop, setSoKhop] = useState<number | null>(null);
  const khoaDem = locMo && coGia ? thamSoLoc().toString() : '';
  useEffect(() => {
    if (!khoaDem) return;
    setSoKhop(null);
    const t = setTimeout(() => {
      const p = thamSoLoc(); p.delete('minArea'); p.delete('maxArea'); p.set('limit', '500');
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
                còn MỘT ô, bên phải có nút LỌC. Loại hình +
                mức giá dời vào bảng "Lọc nâng cao" trồi lên từ dưới khi bấm nút lọc.
                Nút lọc có số nhỏ màu đỏ = đang bật mấy điều kiện lọc.
                Máy tính (từ 768px) vẫn giữ nguyên hàng đầy đủ bên dưới. */}
            <div className="md:hidden">
              {/* Ô TÌM KIẾM ĐIỆN THOẠI (28/9/2026) — MỘT KHỐI DUY NHẤT:
                    📍 chữ gõ ……………  ⚙  [🔍]
                  · Nền dải bao quanh TRẮNG (đã thử navy, xanh xám — chủ dự án chê cả hai).
                  · GÕ THẲNG trong ô. ⚠️ Đã thử "bấm ô → mở màn hình tìm kiếm toàn màn hình" —
                    chủ dự án không thích (bấm vào để gõ lại bật ra màn hình khác). Đừng làm lại.
                  · Nút lọc CHỈ CÓ BIỂU TƯỢNG (bỏ chữ "Lọc"), đang lọc thì có chấm số đỏ ở góc.
                  · Nút tìm đỏ 36×36 nằm TRONG ô, cách mép 4px đều ba phía (chủ dự án: "cho nút tìm kiếm
                    cùng 1 khối"). Nút tìm là kính lúp nên đầu ô dùng GHIM VỊ TRÍ, khỏi lặp hai kính lúp. */}
              <div className="flex h-11 items-center rounded-lg border border-transparent bg-slate-100 pr-1 transition-colors focus-within:border-[#C8A14B] focus-within:bg-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-3 h-[18px] w-[18px] shrink-0 text-slate-400"><path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} enterKeyHint="search"
                  placeholder={heroDeal === 'project' ? 'Tên dự án…' : heroDeal === 'rent' ? 'Thuê nhà, mặt bằng ở đâu?' : (searchHint || 'Khu vực, dự án…')}
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" />
                <button type="button" onClick={() => setLocMo(true)} aria-label={soLoc > 0 ? `Bộ lọc, đang bật ${soLoc}` : 'Bộ lọc'}
                  className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-md active:bg-slate-200 ${soLoc > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[18px] w-[18px]"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
                  {soLoc > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">{soLoc}</span>}
                </button>
                <button type="button" onClick={search} aria-label={heroDeal === 'rent' ? 'Tìm thuê' : 'Tìm kiếm'}
                  className="cl-press ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-red-600 text-white active:bg-red-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-[18px] w-[18px]"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
                </button>
              </div>
              {/* ⚠️ Đã thử thêm hàng từ khoá "Tìm nhiều: Đất nền · Ven biển…" dưới ô — chủ dự án bảo bỏ (28/9/2026). Đừng thêm lại. */}
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
          Đặt NGOÀI banner vì banner cắt cụt mọi thứ tràn ra ngoài nó. Bố cục: xem ghi chú ở MucLoc phía trên. */}
      <KhungBangLoc mo={locMo} dong={() => setLocMo(false)} datLai={datLaiLoc} coLoc={soLoc > 0}
        chan={heroDeal === 'project'
          ? <NutXemKetQua so={duAnKhop.length} donVi="dự án" onClick={() => { setLocMo(false); xemDuAn(duAnKhop.map((p) => p.id)); }} />
          : <NutXemKetQua so={soKhop} chuMacDinh={heroDeal === 'rent' ? 'Tìm thuê' : 'Xem kết quả'} onClick={() => { setLocMo(false); search(); }} />}>
              <MucLoc ten="Nhu cầu">
                <NutLien ds={[['sale', 'Mua bán'], ['rent', 'Cho thuê'], ['project', 'Dự án']] as const} chon={heroDeal}
                  doi={(k) => { if (k !== heroDeal) { setHeroDeal(k); setMin(''); setMax(''); } }} />
              </MucLoc>

              {/* Loại hình ĐỔI THEO NHU CẦU (cùng danh sách với form đăng tin): bán ≠ thuê.
                  Tab "Dự án" KHÔNG có mục này — dự án là khu đô thị/nghỉ dưỡng, chia kiểu "Nhà phố /
                  Đất nông nghiệp" là vô nghĩa, mà web cũng chưa có trang dự án để lọc (chủ dự án bắt, 28/9/2026). */}
              {heroDeal !== 'project' && <MucLoc ten="Loại hình">
                <div className="grid grid-cols-3 gap-2">
                  {(heroDeal === 'rent' ? RENT_PROPERTY_TYPES : SALE_PROPERTY_TYPES).map((t) => {
                    const on = type === t;
                    return (
                      <OLuoi key={t} on={on} onClick={() => setType(on ? '' : t)}>{PROPERTY_LABELS[t]}</OLuoi>
                    );
                  })}
                </div>
              </MucLoc>}

              {/* TAB DỰ ÁN: lọc theo LOẠI DỰ ÁN + TRẠNG THÁI (suy từ chữ admin nhập — xem lib/duAnLoc.ts),
                  kết quả hiện NGAY trong bảng. Không có khu vực/giá/diện tích: dữ liệu dự án không có mấy thứ đó.
                  Chỉ hiện những loại/trạng thái có ít nhất 1 dự án → không bao giờ bấm vào ra trống. */}
              {heroDeal === 'project' && (<>
                <MucLoc ten="Loại dự án" tomTat={loaiDA.length ? `${loaiDA.length} loại` : ''}>
                  <div className="grid grid-cols-3 gap-2">
                    {LOAI_DU_AN.filter((l) => duAn.some((p) => loaiCua(p).includes(l.key))).map((l) => {
                      const on = loaiDA.includes(l.key);
                      return (
                        <OLuoi key={l.key} on={on} onClick={() => setLoaiDA(on ? loaiDA.filter((x) => x !== l.key) : [...loaiDA, l.key])}>{l.ten}</OLuoi>
                      );
                    })}
                  </div>
                </MucLoc>
                <MucLoc ten="Trạng thái">
                  <div className="grid grid-cols-3 gap-2">
                    {TRANG_THAI_DU_AN.filter((t) => duAn.some((p) => trangThaiCua(p) === t.key)).map((t) => {
                      const on = ttDA === t.key;
                      return (
                        <OLuoi key={t.key} on={on} onClick={() => setTtDA(on ? '' : t.key)}>{t.ten}</OLuoi>
                      );
                    })}
                  </div>
                </MucLoc>
                <MucLoc ten="Kết quả" tomTat={`${duAnKhop.length} dự án`}>
                  {duAnKhop.length === 0 ? <p className="py-3 text-center text-[13px] text-slate-400">Không có dự án nào khớp.</p> : (
                    <div className="-my-1">
                      {duAnKhop.map((p) => (
                        <Link key={p.id} href={`/listings?q=${encodeURIComponent(p.name)}`} onClick={() => setLocMo(false)}
                          className="flex items-center gap-3 py-2 active:bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-md bg-slate-100 object-cover" /> : <span className="h-11 w-11 shrink-0 rounded-md bg-slate-100" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                            <span className="block truncate text-[12px] text-slate-400">{[p.status, p.scale].filter(Boolean).join(' · ')}</span>
                          </span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0 text-slate-300"><path d="m9 6 6 6-6 6" /></svg>
                        </Link>
                      ))}
                    </div>
                  )}
                </MucLoc>
              </>)}

              {coGia && <MucLoc ten="Khu vực">
                <OChon giaTri={xaLoc} doiGiaTri={setXaLoc} nhan="Tất cả khu vực" lop="[&>button]:h-10 [&>button]:border-slate-200"
                  dsChon={AREAS.map((a) => ({ gt: a.ward, ten: a.name }))} />
              </MucLoc>}

              {coGia && (<>
                <MucLoc ten={heroDeal === 'rent' ? 'Giá thuê / tháng' : 'Khoảng giá'} tomTat={tomTat(giaLo, giaHi, tranGia.tran, tranGia.dv)}>
                  <KhoangKeo lo={giaLo} hi={giaHi} tran={tranGia.tran} buoc={tranGia.buoc} dv={tranGia.dv}
                    doi={(l, h) => { setMin(l > 0 ? String(l / heSoGia) : ''); setMax(h < tranGia.tran ? String(h / heSoGia) : ''); }} />
                </MucLoc>

                <MucLoc ten="Diện tích" tomTat={tomTat(dt[0], dt[1] || TRAN_DT.tran, TRAN_DT.tran, 'm²')}>
                  <KhoangKeo lo={dt[0]} hi={dt[1] || TRAN_DT.tran} tran={TRAN_DT.tran} buoc={TRAN_DT.buoc} dv={TRAN_DT.dv}
                    doi={(l, h) => setDt([Math.max(0, l), h >= TRAN_DT.tran ? 0 : h])} />
                </MucLoc>
              </>)}
      </KhungBangLoc>

      {/* TIN TỨC & QUY HOẠCH — kiểu batdongsan */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-8">
        {/* `no-scrollbar`: trên điện thoại dải tab này dài hơn màn nên trình duyệt
            vẽ một thanh cuộn xám ngay dưới, nhìn rất thô. Vuốt vẫn cuộn được. */}
        {/* Hàng tab GIỮ NHƯ BẢN ĐẦU (ghi đủ tên, cuộn ngang được). "Xem thêm" KHÔNG nằm ở đây nữa mà
            ở DƯỚI danh sách tin. ⚠️ Đã thử ghim "Xem thêm" bên phải hàng tab + rút gọn tên tab —
            chủ dự án thấy rối hơn (28/9/2026). */}
        <div className="flex items-center gap-5 border-b border-slate-200 mb-5 overflow-x-auto no-scrollbar">
          {Object.keys(NEWS).map((t) => (
            <button key={t} onClick={() => setNewsTab(t)} className={`pb-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px ${newsTab === t ? 'border-red-600 text-[#0A2540]' : 'border-transparent text-slate-500 hover:text-[#0A2540]'}`}>{t}</button>
          ))}
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
          {newsTab === 'Tra cứu văn bản' ? <KhoiTraCuuVanBan tieuDe={newsItems[0].title} anh={newsItems[0].img} /> : (() => { const feat = newsItems[0]; return (
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
            {/* "Xem thêm" ở CUỐI danh sách tin (chủ dự án chỉ đúng chỗ này, 28/9/2026) — cùng nhịp với các dòng tin, không chen vào hàng tab */}
            {/* Tab "Tra cứu văn bản" thì nút dẫn sang kho văn bản, không phải tin tức */}
            <Link href={newsTab === 'Tra cứu văn bản' ? '/van-ban' : '/tin-tuc'} className="flex items-center justify-center gap-1 pt-3 pb-1 text-sm font-semibold text-red-600 hover:text-red-700">
              {newsTab === 'Tra cứu văn bản' ? 'Xem tất cả văn bản' : 'Xem thêm tin tức'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m9 6 6 6-6 6" /></svg>
            </Link>
          </div>
          </>)}
          {/* ĐIỆN THOẠI (chủ dự án 2/10/2026: hai thẻ to "lạc quẻ" giữa tin tức và tin đăng): thu thành HAI Ô NHỎ đứng
              cạnh nhau — nhãn nhỏ + tiêu đề ngắn + mũi tên, bỏ đoạn mô tả và nút. Máy tính giữ hai thẻ to như cũ. */}
          {/* Điện thoại: hai ô cao tối thiểu 104px (5/10/2026) — trước đó ô chỉ cao theo thẻ của web (~85px) nên quảng cáo
              có nhãn + tiêu đề 2 dòng + "Xem ngay" bị tràn, mất dòng "Xem ngay". Quảng cáo phủ đúng cỡ thẻ nên cùng cao theo. */}
          {/* Hai ô này là CHỖ ĐẶT QUẢNG CÁO: admin nhập quảng cáo của khách ở /admin → Quảng cáo; ô trống/hết hạn thì hiện thẻ của web. */}
          <OQuangCaoTrangChu macDinh1={
            <Link href="/map" className="flex min-h-[104px] flex-col sm:min-h-0 justify-between rounded-lg bg-gradient-to-br from-[#a3121b] to-[#6d0d14] p-3 text-white transition hover:brightness-110 active:scale-[.98] sm:block sm:rounded-xl sm:p-5">
              <p className="text-[10px] font-semibold tracking-wide text-white/70 sm:text-[11px]">CAM LÂM LAND</p>
              <p className="mt-1 text-[13.5px] font-extrabold leading-tight sm:text-lg"><span className="sm:hidden">Bản đồ quy hoạch</span><span className="hidden sm:inline">Sàn BĐS & Bản đồ quy hoạch Cam Lâm</span></p>
              <p className="mt-1.5 hidden text-xs leading-snug text-white/80 sm:block">Tra cứu quy hoạch, mua bán nhà đất, nền vệ tinh — tất cả tại một nơi.</p>
              <span className="mt-1.5 text-[11.5px] font-bold text-white/90 sm:mt-3 sm:inline-block sm:rounded sm:bg-white sm:px-3 sm:py-1.5 sm:text-xs sm:text-[#a3121b]">Khám phá ngay →</span>
            </Link>} macDinh2={
            <Link href="/sales/post" className="flex min-h-[104px] flex-col sm:min-h-0 justify-between rounded-lg bg-gradient-to-br from-[#0A2540] to-[#0d2f54] p-3 text-white transition hover:brightness-110 active:scale-[.98] sm:block sm:rounded-xl sm:p-5">
              <p className="text-[10px] font-semibold tracking-wide text-[#C8A14B] sm:text-[11px]">MIỄN PHÍ</p>
              <p className="mt-1 text-[13.5px] font-extrabold leading-tight sm:text-lg"><span className="sm:hidden">Đăng tin bán nhà đất</span><span className="hidden sm:inline">Đăng tin — tiếp cận khách mua ngay</span></p>
              <span className="mt-1.5 text-[11.5px] font-bold text-[#C8A14B] sm:mt-3 sm:inline-block sm:rounded sm:bg-[#C8A14B] sm:px-3 sm:py-1.5 sm:text-xs sm:text-[#0A2540]">Đăng tin ngay →</span>
            </Link>} />
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
          {featured.slice(0, 8).map((l, i) => <ListingCard key={l.id} l={l} href={fromApi ? undefined : '/listings'} to={i < 2} />)}
        </div>
        <div className="mt-6 sm:mt-8 text-center">
          {/* Thay nút "Mở rộng" bằng nút sang hẳn trang tin đăng (chủ dự án 2/10/2026) — đúng theo tab đang chọn.
              Nút ĐỎ NHỎ GỌN bo góc 4px theo mẫu chủ dự án gửi (bản nút tròn to bị chê "hơi thô"). */}
          <Link href={heroDeal === 'rent' ? '/listings?deal=rent' : heroDeal === 'project' ? '/du-an' : '/listings'}
            className="cl-press inline-flex items-center gap-1 rounded bg-red-600 px-4 py-1.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-red-700 sm:px-5 sm:py-2 sm:text-[13.5px]">
            {heroDeal === 'project' ? 'Xem tất cả dự án' : 'Xem tất cả tin đăng'} →
          </Link>
        </div>
      </section>

      {/* BẢN ĐỒ QUY HOẠCH — MẪU 5 chủ dự án chọn 2/10/2026: đưa lên NGAY SAU tin đăng (thế mạnh riêng của web),
          dạng ẢNH RỘNG — ảnh mô hình 3D trải hết khung, chữ đè bên trái trên nền trắng mờ dần.
          Điện thoại: ảnh ở trên, chữ ở dưới (đè chữ lên ảnh trên màn hẹp khó đọc). */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-8">
        <div className="relative overflow-hidden rounded-lg bg-white sm:border sm:border-slate-200 md:min-h-[360px]">
          <div className="relative md:absolute md:inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/quyhoach-camlam.jpg" alt="Mô hình quy hoạch Cam Lâm" loading="lazy" decoding="async"
              className="block aspect-[2/1] w-full object-cover sm:aspect-auto sm:h-64 md:h-full" />
            {/* HUY HIỆU "Cam Lâm Land · Hotline" — ảnh gốc có sẵn ở góc dưới phải nhưng dạng ảnh rộng bị cắt mất
                (chủ dự án 2/10/2026) → dựng lại bằng chữ thật, đè lên góc ảnh, bấm là gọi. Giống hệt kiểu trong ảnh gốc. */}
            <a href="tel:0988888888" className="absolute bottom-1.5 right-1.5 z-[2] hidden sm:flex items-center gap-1 rounded bg-[#0f2236]/80 px-1 py-0.5 text-white shadow-lg backdrop-blur-sm sm:bottom-4 sm:right-4 sm:gap-2.5 sm:rounded-lg sm:px-3 sm:py-2">
              {/* ĐÚNG LOGO CỦA WEB (chữ C vàng trên nền xanh đậm) — bản đầu dùng hình ngôi nhà là sai (chủ dự án 2/10/2026). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-gon.webp" alt="" width={36} height={36} className="h-4 w-4 rounded-sm sm:h-9 sm:w-9 sm:rounded-md" />
              <span className="leading-tight">
                <b className="block text-[9px] sm:text-[15px]">Cam Lâm <span className="text-[#C8A14B]">Land</span></b>
                <span className="block text-[7.5px] font-semibold sm:text-[12.5px]">Hotline <span className="text-[#C8A14B]">0988 888 888</span></span>
              </span>
            </a>
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(90deg,#fff 0%,rgba(255,255,255,.96) 38%,rgba(255,255,255,0) 70%)' }} />
          {/* Điện thoại: MẪU 6 "chữ trên ảnh" chủ dự án chọn 5/10/2026 (mẫu 8 trước đó tiêu đề gãy dòng, nhiều kiểu nút → rối).
              Cả ô chỉ còn MỘT KHỐI ẢNH 2:1 (trước 2,4:1 — chủ dự án bảo cao thêm 20%, 5/10/2026): chân ảnh tối mờ dần, trên đó nhãn vàng + "Tra cứu quy hoạch" chữ trắng,
              bên phải một nút trắng "Mở bản đồ". Bỏ nút QR và huy hiệu hotline trên điện thoại cho đỡ chật.
              Từ khổ sm trở lên giữ nguyên bố cục cũ. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 sm:hidden" style={{ background: 'linear-gradient(180deg,rgba(10,37,64,0) 35%,rgba(10,37,64,.9) 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-1.5 px-[11px] pb-[9px] sm:relative sm:block sm:p-8 md:max-w-[46%] md:p-12">
            <div className="min-w-0 flex-1">
              <span className="block text-[#C8A14B] font-bold text-[9.5px] tracking-wide sm:inline sm:font-semibold sm:text-sm">BẢN ĐỒ QUY HOẠCH</span>
              <h2 className="text-[14px] leading-snug sm:text-3xl font-extrabold text-white sm:text-[#0A2540] sm:mt-2">Tra cứu quy hoạch<span className="hidden sm:inline"> & thửa đất chính xác</span></h2>
            </div>
            <p className="hidden sm:block leading-relaxed text-base text-slate-500 mt-3">Quy hoạch sử dụng đất, nền vệ tinh độ nét cao, tra cứu theo số thửa/số tờ/xã, toạ độ VN-2000, đo đạc trực tiếp trên bản đồ.</p>
            <div className="flex flex-none gap-3 sm:mt-6">
              <Link href="/map" className="cl-press bg-white text-[#0A2540] sm:bg-[#0A2540] sm:hover:bg-[#0d2f54] sm:text-white font-bold text-[11.5px] sm:text-base px-2.5 sm:px-6 py-[5px] sm:py-3 rounded sm:rounded-xl">Mở bản đồ<span className="hidden sm:inline"> →</span></Link>
              <Link href="/qr" className="cl-press hidden sm:inline-block border border-slate-300 bg-white text-[#0A2540] font-bold text-[11.5px] sm:text-base px-[9px] sm:px-6 py-[5px] sm:py-3 rounded sm:rounded-xl hover:bg-slate-50"><span className="hidden sm:inline">Tra cứu </span>QR</Link>
            </div>
          </div>
        </div>
      </section>

      {/* DỰ ÁN BĐS NỔI BẬT — admin quản lý (kiểu batdongsan) */}
      <FeaturedProjects chiHien={locDuAn} boLoc={() => { setLocDuAn(null); setLoaiDA([]); setTtDA(''); }} />

      {/* BĐS THEO ĐỊA ĐIỂM — ô lớn + lưới + số tin (kiểu batdongsan) */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-8">
        <h2 className="text-xl md:text-2xl font-extrabold text-[#0A2540] mb-4 sm:mb-6">Bất động sản theo địa điểm</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-3 md:gap-4 md:h-[420px]">
          {bigArea && <AreaCard a={bigArea} big />}
          {gridAreas.map((a) => <AreaCard key={a.ward} a={a} />)}
        </div>
      </section>

      {/* PROMO BANNER — quảng cáo (kiểu batdongsan). Chủ dự án dời xuống SAU mục "theo địa điểm", trước "Hỗ trợ tiện ích"
          (6/10/2026) — trước đó nằm giữa "Dự án nổi bật" và "theo địa điểm", chen giữa hai mục nhà đất. */}
      {/* KHỐI KẾT TRANG — NỀN TRÙNG THÂN WEB, KHÔNG chia dải nền riêng (chủ dự án 6/10/2026: "để nền trùng với thân web
          đừng chia khối như này" — bản dải trắng viền trên/dưới bị bỏ). Dải quảng bá giữ nguyên thiết kế. */}
      <PromoBanner />
      <HomeUtilities />

      {/* DOANH NGHIỆP TIÊU BIỂU — logo carousel (kiểu batdongsan) */}
      <FeaturedPartners />

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
