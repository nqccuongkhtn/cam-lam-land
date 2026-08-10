// ============================================================================
// Dữ liệu sinh TRANG ĐÍCH SEO tự động theo KHU VỰC × LOẠI HÌNH ở Cam Lâm, Khánh Hòa.
// Mỗi tổ hợp = 1 trang tối ưu 1 từ khóa (vd "Đất nền Cam Đức", "Nhà phố Bãi Dài"…)
// → phủ Google local, kéo khách miễn phí. Sinh tự động, không viết tay từng trang.
// ============================================================================
import type { PropertyType, DealType } from './types';

export interface SeoArea {
  slug: string;            // đường dẫn, vd "cam-duc"
  name: string;            // tên hiển thị, vd "Cam Đức"
  ward: string;            // tên xã dùng để LỌC tin (khớp WARDS ở types.ts)
  region: string;          // vùng ngắn gọn, vd "trung tâm huyện Cam Lâm"
  blurb: string;           // đặc điểm khu (kết nối, tiện ích) — nội dung riêng, chống trùng lặp
  coastal?: boolean;       // ven biển (để ghép với "đất ven biển")
  center: [number, number];// [lng, lat] canh bản đồ khu
}

export interface SeoType {
  slug: string;            // đường dẫn, vd "dat-nen"
  label: string;           // từ khóa hiển thị, vd "Đất nền"
  base: PropertyType;      // loại để lọc tin
  deal: DealType;          // sale | rent
  blurb: string;           // mô tả loại hình — nội dung riêng
  areas?: string[];        // nếu có: CHỈ sinh cho các area slug này (vd đất ven biển, cho thuê)
}

// ---- 14 xã/thị trấn Cam Lâm + điểm nóng Bãi Dài ----
export const AREAS: SeoArea[] = [
  { slug: 'cam-duc', name: 'Cam Đức', ward: 'Cam Đức', region: 'trung tâm huyện Cam Lâm', coastal: false, center: [109.098, 12.072],
    blurb: 'Trung tâm hành chính – thương mại của Cam Lâm, nằm trên Quốc lộ 1, dân cư đông đúc, hạ tầng đầy đủ; mặt bằng và đất thổ cư khu vực này luôn được săn đón.' },
  { slug: 'cam-hai-dong', name: 'Cam Hải Đông', ward: 'Cam Hải Đông', region: 'ven biển Bãi Dài, bắc bán đảo Cam Ranh', coastal: true, center: [109.190, 12.030],
    blurb: 'Xã ven biển sở hữu bãi biển Bãi Dài, sát sân bay quốc tế Cam Ranh và loạt dự án nghỉ dưỡng; là thủ phủ bất động sản du lịch – biển của Cam Lâm.' },
  { slug: 'cam-hai-tay', name: 'Cam Hải Tây', ward: 'Cam Hải Tây', region: 'giáp Cam Đức và vùng ven biển', coastal: true, center: [109.140, 12.050],
    blurb: 'Nối trung tâm Cam Đức với dải ven biển, quỹ đất nông nghiệp và thổ cư còn nhiều, giá mềm hơn khu biển, tiềm năng theo trục đường ra Bãi Dài.' },
  { slug: 'cam-thanh-bac', name: 'Cam Thành Bắc', ward: 'Cam Thành Bắc', region: 'cửa ngõ phía bắc Cam Đức', coastal: false, center: [109.105, 12.098],
    blurb: 'Cửa ngõ phía bắc thị trấn Cam Đức trên Quốc lộ 1, gần đầm Thủy Triều; thuận lợi ở, kinh doanh và kho bãi ven quốc lộ.' },
  { slug: 'cam-hoa', name: 'Cam Hòa', ward: 'Cam Hòa', region: 'phía bắc huyện, ven đầm Thủy Triều', coastal: false, center: [109.130, 12.130],
    blurb: 'Vùng phía bắc ven đầm Thủy Triều, thế mạnh nuôi trồng thủy sản và cây lâu năm; đất vườn, đất nông nghiệp diện tích lớn, giá hợp lý.' },
  { slug: 'cam-tan', name: 'Cam Tân', ward: 'Cam Tân', region: 'bắc Cam Lâm, giáp Ninh Hòa', coastal: false, center: [109.085, 12.150],
    blurb: 'Xã nông nghiệp phía bắc giáp thị xã Ninh Hòa, đồng ruộng và cây lâu năm; phù hợp đầu tư đất vườn, đất nông nghiệp dài hạn.' },
  { slug: 'cam-hiep-bac', name: 'Cam Hiệp Bắc', ward: 'Cam Hiệp Bắc', region: 'vùng nông nghiệp trung tâm', coastal: false, center: [109.065, 12.100],
    blurb: 'Vùng nông nghiệp trung tâm huyện, gần Quốc lộ 1, giá đất mềm; lựa chọn tốt cho nhà vườn, canh tác và đầu tư đón hạ tầng.' },
  { slug: 'cam-hiep-nam', name: 'Cam Hiệp Nam', ward: 'Cam Hiệp Nam', region: 'vùng nông nghiệp trung tâm', coastal: false, center: [109.062, 12.082],
    blurb: 'Kề Cam Hiệp Bắc và Suối Cát, quỹ đất nông nghiệp – thổ cư rộng, mặt bằng giá thấp, tiềm năng khi hạ tầng khu vực hoàn thiện.' },
  { slug: 'cam-an-bac', name: 'Cam An Bắc', ward: 'Cam An Bắc', region: 'phía tây bắc, ven núi', coastal: false, center: [109.050, 12.130],
    blurb: 'Xã ven núi phía tây bắc, đất vườn và đất nông nghiệp rộng rãi, không khí trong lành; hợp làm nhà vườn, trang trại nghỉ dưỡng.' },
  { slug: 'cam-an-nam', name: 'Cam An Nam', ward: 'Cam An Nam', region: 'phía tây bắc huyện', coastal: false, center: [109.040, 12.110],
    blurb: 'Vùng gò đồi phía tây bắc, quỹ đất lớn giá thấp, thích hợp đầu tư đất vườn, cây lâu năm và tích lũy dài hạn.' },
  { slug: 'cam-phuoc-tay', name: 'Cam Phước Tây', ward: 'Cam Phước Tây', region: 'phía tây huyện', coastal: false, center: [108.980, 12.050],
    blurb: 'Xã phía tây giáp vùng gò đồi và tuyến giao thông liên vùng; đất rộng, giá mềm, tiềm năng nông nghiệp – trang trại quy mô lớn.' },
  { slug: 'son-tan', name: 'Sơn Tân', ward: 'Sơn Tân', region: 'xã miền núi phía tây', coastal: false, center: [108.950, 12.020],
    blurb: 'Xã miền núi phía tây Cam Lâm, quỹ đất rừng – vườn rộng, giá thấp nhất khu vực; phù hợp trang trại, nông – lâm kết hợp.' },
  { slug: 'suoi-cat', name: 'Suối Cát', ward: 'Suối Cát', region: 'nam Cam Đức, trên Quốc lộ 1', coastal: false, center: [109.030, 11.980],
    blurb: 'Nằm nam Cam Đức trên Quốc lộ 1, dân cư đông, gần khu công nghiệp; nhu cầu nhà ở, mặt bằng và phòng trọ cao.' },
  { slug: 'suoi-tan', name: 'Suối Tân', ward: 'Suối Tân', region: 'cực nam huyện, Khu công nghiệp Suối Dầu', coastal: false, center: [109.100, 11.950],
    blurb: 'Cực nam huyện, có Khu công nghiệp Suối Dầu, sát Diên Khánh – Nha Trang; nhu cầu nhà xưởng, kho bãi và phòng trọ công nhân rất lớn.' },
  { slug: 'bai-dai', name: 'Bãi Dài', ward: 'Cam Hải Đông', region: 'bãi biển bắc bán đảo Cam Ranh', coastal: true, center: [109.195, 12.020],
    blurb: 'Bãi biển đẹp bậc nhất Khánh Hòa thuộc xã Cam Hải Đông, kề sân bay quốc tế Cam Ranh và các khu nghỉ dưỡng; tâm điểm đất nền ven biển và bất động sản du lịch.' },
];

// ---- Loại hình (nhiều từ khóa cho MUA BÁN & CHO THUÊ) ----
const RENT_AREAS = ['cam-duc', 'cam-hai-dong', 'cam-hai-tay', 'cam-thanh-bac', 'suoi-cat', 'suoi-tan', 'cam-hoa'];
const COASTAL_AREAS = ['cam-hai-dong', 'cam-hai-tay', 'bai-dai'];

export const TYPES: SeoType[] = [
  // ----- MUA BÁN -----
  { slug: 'dat-nen', label: 'Đất nền', base: 'land', deal: 'sale',
    blurb: 'Đất nền, đất ở đã có sổ, pháp lý rõ ràng — dòng sản phẩm được giao dịch nhiều nhất tại Cam Lâm.' },
  { slug: 'dat-tho-cu', label: 'Đất thổ cư', base: 'land', deal: 'sale',
    blurb: 'Đất thổ cư (đất ở) đã lên thổ, xây dựng được ngay, phù hợp an cư và tách thửa.' },
  { slug: 'dat-mat-tien', label: 'Đất mặt tiền', base: 'land', deal: 'sale',
    blurb: 'Đất mặt tiền đường lớn, thuận lợi kinh doanh buôn bán, giá trị khai thác và thanh khoản cao.' },
  { slug: 'dat-nen-du-an', label: 'Đất nền dự án', base: 'land', deal: 'sale',
    blurb: 'Đất nền thuộc các dự án, khu quy hoạch bài bản, hạ tầng đồng bộ, sổ từng nền.' },
  { slug: 'dat-ven-bien', label: 'Đất ven biển', base: 'land', deal: 'sale', areas: COASTAL_AREAS,
    blurb: 'Đất ven biển, gần bãi tắm và khu nghỉ dưỡng — sản phẩm đầu tư nghỉ dưỡng và cho thuê du lịch.' },
  { slug: 'dat-vuon', label: 'Đất vườn', base: 'farm', deal: 'sale',
    blurb: 'Đất vườn, đất trồng cây lâu năm diện tích rộng, giá mềm, hợp làm nhà vườn – trang trại nghỉ dưỡng.' },
  { slug: 'dat-nong-nghiep', label: 'Đất nông nghiệp', base: 'farm', deal: 'sale',
    blurb: 'Đất nông nghiệp, đất trồng cây quỹ lớn, tiềm năng chuyển đổi và tích lũy dài hạn.' },
  { slug: 'nha-pho', label: 'Nhà phố', base: 'house', deal: 'sale',
    blurb: 'Nhà phố, nhà mặt đất đã hoàn thiện, ở ngay hoặc cho thuê, vị trí dân cư hiện hữu.' },
  { slug: 'nha-cap-4', label: 'Nhà cấp 4', base: 'house', deal: 'sale',
    blurb: 'Nhà cấp 4 giá vừa tầm, có sẵn đất, phù hợp an cư và cải tạo về sau.' },
  { slug: 'nha-mat-tien', label: 'Nhà mặt tiền', base: 'house', deal: 'sale',
    blurb: 'Nhà mặt tiền đường kinh doanh, vừa ở vừa buôn bán, khai thác dòng tiền tốt.' },
  { slug: 'biet-thu', label: 'Biệt thự', base: 'villa', deal: 'sale',
    blurb: 'Biệt thự, nhà vườn cao cấp, không gian sống rộng rãi, hướng tới nghỉ dưỡng và an cư dài lâu.' },
  { slug: 'can-ho', label: 'Căn hộ chung cư', base: 'apartment', deal: 'sale',
    blurb: 'Căn hộ, chung cư tiện nghi, an ninh, phù hợp gia đình trẻ và khai thác cho thuê.' },
  { slug: 'mat-bang-kinh-doanh', label: 'Mặt bằng kinh doanh', base: 'commercial', deal: 'sale',
    blurb: 'Mặt bằng kinh doanh, shophouse vị trí đông người qua lại, sinh lời từ hoạt động thương mại.' },
  { slug: 'kho-xuong', label: 'Kho xưởng', base: 'warehouse', deal: 'sale',
    blurb: 'Kho, nhà xưởng phục vụ sản xuất – lưu trữ, gần khu công nghiệp và trục giao thông.' },
  // ----- CHO THUÊ -----
  { slug: 'cho-thue-nha', label: 'Cho thuê nhà', base: 'house', deal: 'rent', areas: RENT_AREAS,
    blurb: 'Nhà nguyên căn cho thuê để ở hoặc kinh doanh, đa dạng diện tích và mức giá.' },
  { slug: 'phong-tro', label: 'Phòng trọ', base: 'room', deal: 'rent', areas: RENT_AREAS,
    blurb: 'Phòng trọ, nhà trọ giá tốt cho người lao động, sinh viên và công nhân khu công nghiệp.' },
  { slug: 'cho-thue-mat-bang', label: 'Cho thuê mặt bằng', base: 'commercial', deal: 'rent', areas: RENT_AREAS,
    blurb: 'Mặt bằng, cửa hàng cho thuê ở vị trí buôn bán, sẵn sàng khai thác kinh doanh.' },
  { slug: 'cho-thue-kho-xuong', label: 'Cho thuê kho xưởng', base: 'warehouse', deal: 'rent', areas: RENT_AREAS,
    blurb: 'Kho, nhà xưởng cho thuê gần Khu công nghiệp Suối Dầu và Quốc lộ 1, thuận vận chuyển.' },
  { slug: 'cho-thue-can-ho', label: 'Cho thuê căn hộ', base: 'apartment', deal: 'rent', areas: RENT_AREAS,
    blurb: 'Căn hộ cho thuê đầy đủ tiện nghi, phù hợp gia đình và chuyên gia làm việc trong khu vực.' },
];

// ---- Định nghĩa 1 trang đích ----
export interface PageDef { slug: string; type: SeoType | null; area: SeoArea | null; deal: DealType; }

const AREA_BY_SLUG: Record<string, SeoArea> = Object.fromEntries(AREAS.map((a) => [a.slug, a]));

function buildPages(): PageDef[] {
  const pages: PageDef[] = [];
  // 1) Loại hình × Khu vực  (vd dat-nen-cam-duc)
  for (const t of TYPES) {
    const areaSlugs = t.areas ?? AREAS.map((a) => a.slug);
    for (const as of areaSlugs) {
      const area = AREA_BY_SLUG[as]; if (!area) continue;
      pages.push({ slug: `${t.slug}-${area.slug}`, type: t, area, deal: t.deal });
    }
  }
  // 2) Loại hình toàn Cam Lâm  (vd dat-nen)
  for (const t of TYPES) pages.push({ slug: t.slug, type: t, area: null, deal: t.deal });
  // 3) Khu vực (mọi loại hình)  (vd cam-duc)
  for (const a of AREAS) pages.push({ slug: a.slug, type: null, area: a, deal: 'sale' });
  return pages;
}

export const PAGES: PageDef[] = buildPages();
export const PAGE_BY_SLUG: Record<string, PageDef> = Object.fromEntries(PAGES.map((p) => [p.slug, p]));
export const ALL_SLUGS: string[] = PAGES.map((p) => p.slug);

// Trang nên PRE-RENDER sẵn (nhanh, quan trọng): khu vực + loại hình đơn lẻ. Tổ hợp còn lại render theo yêu cầu (ISR).
export const CORE_SLUGS: string[] = [
  ...AREAS.map((a) => a.slug),
  ...TYPES.map((t) => t.slug),
];
