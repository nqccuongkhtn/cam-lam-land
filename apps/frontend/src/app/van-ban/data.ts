// Hằng số UI cho trang Tra cứu văn bản. Dữ liệu văn bản lấy từ API /api/van-ban (chỉ người đăng nhập).
export type ChuDe = 'Quy hoạch' | 'Bồi thường' | 'Tái định cư' | 'Nhà ở xã hội' | 'Giao & thuê đất' | 'Giấy chứng nhận' | 'Định giá đất' | 'Khác';

export interface VanBan {
  id: number;
  soKyHieu: string;
  trichYeu: string;
  ngay: string;        // 'YYYY-MM-DD'
  coQuan: string;
  chuDe: ChuDe;
  linhVuc: string;
  nguon: string;
  luotTai?: number;
  noiBat?: boolean;
  coFile?: boolean;    // có link gốc để tải/mở
}

// Ô lọc chủ đề trên giao diện — mỗi ô gộp MỘT hoặc NHIỀU chủ đề trong DB (match).
export const CHUDE_LIST = ['Quy hoạch', 'Bồi thường & Tái định cư', 'Giao & thuê đất', 'Giấy chứng nhận', 'Định giá đất', 'Nhà ở xã hội'] as const;
export type ChuDeNhom = typeof CHUDE_LIST[number];
export const CHUDE_META: Record<ChuDeNhom, { icon: string; desc: string; match: ChuDe[] }> = {
  'Quy hoạch': { icon: '🗺️', desc: 'Quy hoạch chung, phân khu, kế hoạch sử dụng đất', match: ['Quy hoạch'] },
  'Bồi thường & Tái định cư': { icon: '💰', desc: 'GPMB, bồi thường – hỗ trợ, thu hồi, tái định cư', match: ['Bồi thường', 'Tái định cư'] },
  'Giao & thuê đất': { icon: '📗', desc: 'Giao đất, cho thuê, đấu giá, chuyển mục đích, tách thửa', match: ['Giao & thuê đất'] },
  'Giấy chứng nhận': { icon: '📜', desc: 'Cấp GCN, sổ đỏ/sổ hồng, đăng ký đất đai', match: ['Giấy chứng nhận'] },
  'Định giá đất': { icon: '🏷️', desc: 'Định giá, giá đất, bảng giá đất', match: ['Định giá đất'] },
  'Nhà ở xã hội': { icon: '🏢', desc: 'NOXH · dự án Happy Home', match: ['Nhà ở xã hội'] },
};

// Cổng thông tin điện tử tỉnh Khánh Hòa & các xã, phường, sở ngành.
export const PORTALS: { nhom: string; items: [string, string][] }[] = [
  {
    nhom: 'Tỉnh & Sở ngành',
    items: [
      ['Cổng tỉnh Khánh Hòa', 'https://khanhhoa.gov.vn/'],
      ['Sở Xây dựng', 'https://sxd.khanhhoa.gov.vn/'],
      ['Sở Nông nghiệp & Môi trường', 'https://snnmt.khanhhoa.gov.vn/'],
      ['Xúc tiến đầu tư – Dự án', 'https://ipa.khanhhoa.gov.vn/du-an-dau-tu'],
      ['Quản lý đất đai (Bộ NN&MT)', 'https://qldd.mae.gov.vn/'],
      ['Công báo Khánh Hòa', 'https://congbaokhanhhoa.gov.vn/'],
    ],
  },
  {
    nhom: 'Khu vực Cam Lâm & lân cận',
    items: [
      ['Cam Lâm', 'https://camlam.khanhhoa.gov.vn/'],
      ['Cam An', 'https://caman.khanhhoa.gov.vn/'],
      ['Cam Hiệp', 'https://camhiep.khanhhoa.gov.vn/'],
      ['Suối Dầu', 'https://suoidau.khanhhoa.gov.vn/'],
      ['Suối Hiệp', 'https://suoihiep.khanhhoa.gov.vn/'],
    ],
  },
  {
    nhom: 'Cam Ranh',
    items: [
      ['Cam Ranh', 'https://camranh.khanhhoa.gov.vn/'],
      ['Bắc Cam Ranh', 'https://baccamranh.khanhhoa.gov.vn/'],
      ['Nam Cam Ranh', 'https://namcamranh.khanhhoa.gov.vn/'],
      ['Cam Linh', 'https://camlinh.khanhhoa.gov.vn/'],
      ['Ba Ngòi', 'https://bangoi.khanhhoa.gov.vn/'],
    ],
  },
  {
    nhom: 'Nha Trang & Diên Khánh',
    items: [
      ['Nha Trang', 'https://nhatrang.khanhhoa.gov.vn/'],
      ['Bắc Nha Trang', 'https://bacnhatrang.khanhhoa.gov.vn/'],
      ['Tây Nha Trang', 'https://taynhatrang.khanhhoa.gov.vn/'],
      ['Nam Nha Trang', 'https://namnhatrang.khanhhoa.gov.vn/'],
      ['Diên Khánh', 'https://dienkhanh.khanhhoa.gov.vn/'],
      ['Diên Lạc', 'https://dienlac.khanhhoa.gov.vn/'],
      ['Diên Điền', 'https://diendien.khanhhoa.gov.vn/'],
      ['Diên Lâm', 'https://dienlam.khanhhoa.gov.vn/'],
      ['Diên Thọ', 'https://dientho.khanhhoa.gov.vn/'],
    ],
  },
];
