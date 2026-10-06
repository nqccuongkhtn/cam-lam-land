// GIÁ ĐẤT ĐỀN BÙ (BỒI THƯỜNG) ĐẤT NÔNG NGHIỆP — XÃ CAM LÂM
// Nguồn DUY NHẤT: Thông báo số 306/TB-HĐTĐ ngày 07/5/2026 của Hội đồng thẩm định giá đất cụ thể xã Cam Lâm
// "Về kết quả thẩm định phương án giá đất cụ thể để tính tiền bồi thường khi Nhà nước thu hồi đất
//  để thực hiện dự án Khu đô thị mới Cam Lâm" (mục V. Kết luận).
// Số tiền = đồng/m². Giá trong thông báo lấy theo Nghị quyết 15/2025/NQ-HĐND ngày 18/12/2025 của HĐND tỉnh Khánh Hòa.
// Gõ lại từ chính bản PDF chủ dự án cung cấp (16/9/2026), đối chiếu 2 nguồn: chữ trong file PDF và ảnh chụp từng trang.
// ⚠️ ĐỪNG sửa số ở đây theo trí nhớ hay theo suy đoán — chỉ sửa khi có văn bản mới của cơ quan nhà nước.

export const DEN_BU_NGUON = {
  vanBan: 'Thông báo 306/TB-HĐTĐ ngày 07/5/2026',
  coQuan: 'Hội đồng thẩm định giá đất cụ thể xã Cam Lâm',
  duAn: 'Dự án Khu đô thị mới Cam Lâm',
  bangGia: 'Nghị quyết 15/2025/NQ-HĐND ngày 18/12/2025 của HĐND tỉnh Khánh Hòa',
};

/** Một dòng trong bảng: [tên thôn, cây lâu năm/hàng năm VT1, VT2, nuôi trồng thuỷ sản VT1, VT2] */
export type DongGia = [string, number | null, number | null, number | null, number | null];

export const GIA_NONG_NGHIEP: DongGia[] = [
  ['Thôn Vĩnh Phú', 561261, 430300, 581293, 415209],
  ['Thôn Dầu Sơn', 561261, 430300, 581293, 415209],
  ['Thôn Đồng Cau', 561261, 430300, 581293, 415209],
  ['Thôn Vinh Bình', 561261, 430300, 581293, 415209],
  ['Thôn Cửu Lợi 1', 600250, 460192, 581293, 415209],
  ['Thôn Cửu Lợi 2', 600250, 460192, 581293, 415209],
  ['Thôn Cửu Lợi 3', 561261, 430300, 581293, 415209],
  ['Thôn Văn Tứ Đông (phía Đông Quốc lộ 1A)', 561261, 430300, 708411, 506008],
  ['Thôn Văn Tứ Đông (phía Tây Quốc lộ 1A)', 600250, 460192, 581293, 415209],
  ['Thôn Văn Tứ Tây (phía Đông Quốc lộ 1A)', 561261, 430300, 708411, 506008],
  ['Thôn Văn Tứ Tây (phía Tây Quốc lộ 1A)', 600250, 460192, 581293, 415209],
  ['Thôn Lập Định 1', 600250, 460192, 581293, 415209],
  ['Thôn Lập Định 2', 600250, 460192, 581293, 415209],
  ['Thôn Lập Định 3', 600250, 460192, 581293, 415209],
  ['Thôn Thủy Triều', 889961, 682355, 811000, 579286],
  ['Thôn Cù Hin', 889961, 682355, 811000, 579286],
  ['Thôn Tân Hải', 901850, 691418, 811000, 579286],
  ['Thôn Bắc Vĩnh (phía Đông Quốc lộ 1A)', 901850, 691418, 811000, 579286],
  ['Thôn Bắc Vĩnh (phía Tây Quốc lộ 1A)', 755020, 578849, 648746, 463390],
  ['Thôn Bãi Giếng 2 (phía Đông Quốc lộ 1A)', 901850, 691418, 811000, 579286],
  ['Thôn Bãi Giếng 2 (phía Tây Quốc lộ 1A)', 755020, 578849, 648746, 463390],
  ['Thôn Bãi Giếng 1 (phía Tây Quốc lộ 1A)', 901850, 691418, 811000, 579286],
  ['Thôn Bãi Giếng (phía Tây Quốc lộ 1A)', 901850, 691418, 811000, 579286],
  ['Thôn Tân Hòa (phía Tây Quốc lộ 1A)', 901850, 691418, 811000, 579286],
  ['Thôn Yên Hòa (phía Tây Quốc lộ 1A)', 901850, 691418, 811000, 579286],
  ['Thôn Nghĩa Trung (phía Tây Quốc lộ 1A)', 901850, 691418, 811000, 579286],
  ['Thôn Nghĩa Nam (phía Tây Quốc lộ 1A)', 901850, 691418, 811000, 579286],
  ['Thôn Bãi Giếng 3 (phía Đông Quốc lộ 1A)', 1063340, 815227, 811000, 579286],
  ['Thôn Tân Hải 1 (phía Đông Quốc lộ 1A, khu vực Đầm Thủy Triều)', 1063340, 815227, 811000, 579286],
  ['Thôn Bãi Giếng Trung (phía Đông Quốc lộ 1A)', 1063340, 815227, 811000, 579286],
  ['Thôn Bãi Giếng Nam (phía Đông Quốc lộ 1A)', 1063340, 815227, 811000, 579286],
  ['Thôn Tân Lập (phía Tây Quốc lộ 1A)', 748019, 573481, 648746, 463390],
  ['Thôn Tân Sinh Tây (phía Tây Quốc lộ 1A)', 748019, 573481, 648746, 463390],
  ['Thôn Lam Sơn (phía Tây Quốc lộ 1A)', 748019, 573481, 648746, 463390],
  ['Thôn Tân Phú (phía Tây Quốc lộ 1A)', 748019, 573481, 648746, 463390],
  ['Thôn Tân Sinh Đông (phía Tây Quốc lộ 1A)', 748019, 573481, 648746, 463390],
  ['Thôn Tân Thành (phía Đông Quốc lộ 1A, khu vực Đầm Thủy Triều)', 936345, 717865, 811000, 579286],
  ['Thôn Suối Cam (phía Đông Quốc lộ 1A, khu vực Đầm Thủy Triều)', 936345, 717865, 811000, 579286],
  ['Thôn Tân Quý (phía Đông Quốc lộ 1A, khu vực Đầm Thủy Triều)', 936345, 717865, 811000, 579286],
  ['Thôn Trung Hiệp 1', 652743, 500436, 581293, 415209],
  ['Thôn Trung Hiệp 2', 652743, 500436, 581293, 415209],
  ['Thôn Quảng Đức', 652743, 500436, 581293, 415209],
  ['Thôn Suối Cát', 652743, 500436, 581293, 415209],
  ['Thôn Vĩnh Thái', 652743, 500436, 581293, 415209],
  // Mục II của bảng: chỉ có giá đất nuôi trồng thuỷ sản, không có giá đất trồng cây.
  ['Khu vực bên Cồn', null, null, 281689, 201206],
];

/** Đất rừng sản xuất — bảng riêng trong cùng thông báo (mục 6.2). [tên thôn, vị trí 1, vị trí 2] */
export const GIA_RUNG_SAN_XUAT: [string, number, number][] = [
  ['Thôn Vĩnh Phú', 202114, 160550],
  ['Thôn Đồng Cau', 202114, 160550],
  ['Thôn Vinh Bình', 202114, 160550],
  ['Thôn Cửu Lợi 3', 202114, 160550],
  ['Thôn Văn Tứ Đông', 202114, 160550],
  ['Thôn Văn Tứ Tây', 202114, 160550],
  ['Thôn Thủy Triều', 225882, 178328],
  ['Thôn Cù Hin', 225882, 178328],
];

export type LoaiDat = 'cay' | 'thuysan' | 'rung';

export const TEN_LOAI_DAT: Record<LoaiDat, string> = {
  cay: 'Đất trồng cây lâu năm; đất trồng cây hằng năm (gồm đất trồng lúa và đất trồng cây hằng năm khác)',
  thuysan: 'Đất nuôi trồng thuỷ sản',
  rung: 'Đất rừng sản xuất',
};

export const TEN_NGAN_LOAI_DAT: Record<LoaiDat, string> = {
  cay: 'Cây lâu năm / cây hằng năm (cả lúa)',
  thuysan: 'Nuôi trồng thuỷ sản',
  rung: 'Rừng sản xuất',
};

/** Giá đền bù 1 m² của một thôn. Trả về null nếu thông báo không ghi giá cho trường hợp đó. */
export function giaDenBu(thon: string, loai: LoaiDat, viTri: 1 | 2): number | null {
  if (loai === 'rung') {
    const d = GIA_RUNG_SAN_XUAT.find((x) => x[0] === thon);
    return d ? d[viTri] : null;
  }
  const d = GIA_NONG_NGHIEP.find((x) => x[0] === thon);
  if (!d) return null;
  return (loai === 'cay' ? (viTri === 1 ? d[1] : d[2]) : (viTri === 1 ? d[3] : d[4])) ?? null;
}

/** Danh sách thôn có giá cho loại đất đang chọn (đất rừng chỉ có 8 thôn). */
export function dsThon(loai: LoaiDat): string[] {
  return loai === 'rung' ? GIA_RUNG_SAN_XUAT.map((x) => x[0]) : GIA_NONG_NGHIEP.map((x) => x[0]);
}

// ───────────────────────────────────────────────────────────────────────────────────────────
// BỐN DỰ ÁN KHU ĐÔ THỊ PHỨC HỢP — giá đất cụ thể để tính bồi thường, do Chủ tịch UBND xã Cam Lâm
// phê duyệt ngày 23/9/2025. Bảng ở đây KHÔNG chia theo thôn mà chia theo KHOẢNG CÁCH tới đường
// giao thông chính / đường liên xã, liên thôn (trong hay ngoài 200 m) và thửa có tiếp giáp đường hay không.
// Bốn quyết định dùng CHUNG một biểu giá; chỉ khác phạm vi dự án và vài dòng có/không có.
export const DU_AN_PHUC_HOP = [
  { ma: '2952', ten: 'Khu đô thị phức hợp Suối Tân', pham: 'Xã Cam Lâm (trước đây là xã Suối Tân)', tep: 'QD-2952-gia-dat-boi-thuong-KDT-Suoi-Tan.pdf', coLua: false, coThuySan: false },
  { ma: '2953', ten: 'Khu đô thị phức hợp Cam Thượng', pham: 'Xã Cam Lâm (trước đây là xã Cam Tân và xã Suối Tân)', tep: 'QD-2953-gia-dat-boi-thuong-KDT-Cam-Thuong.pdf', coLua: true, coThuySan: true },
  { ma: '2954', ten: 'Khu đô thị phức hợp Cam Tân', pham: 'Xã Cam Lâm (trước đây là xã Cam Tân và xã Suối Tân)', tep: 'QD-2954-gia-dat-boi-thuong-KDT-Cam-Tan.pdf', coLua: true, coThuySan: true },
  { ma: '2955', ten: 'Khu đô thị phức hợp Cam Hòa', pham: 'Xã Cam Lâm (trước đây là xã Cam Tân và xã Cam Hòa)', tep: 'QD-2955-gia-dat-boi-thuong-KDT-Cam-Hoa.pdf', coLua: true, coThuySan: false },
] as const;

export type ViTriPH = 'trong-tiep' | 'trong-khong' | 'ngoai-tiep' | 'ngoai-khong';

export const TEN_VI_TRI_PH: Record<ViTriPH, string> = {
  'trong-tiep': 'Trong 200 m tới đường · thửa tiếp giáp đường',
  'trong-khong': 'Trong 200 m tới đường · thửa KHÔNG tiếp giáp đường',
  'ngoai-tiep': 'Ngoài 200 m tới đường · thửa tiếp giáp đường',
  'ngoai-khong': 'Ngoài 200 m tới đường · thửa KHÔNG tiếp giáp đường',
};

/** Giá theo 4 quyết định ngày 23/9/2025 (đồng/m²). null = quyết định không ghi mức cho trường hợp đó. */
export const GIA_PHUC_HOP: Record<ViTriPH, { cayLauNam: number; cayHangNam: number; rung: number; thuySan: number | null }> = {
  'trong-tiep': { cayLauNam: 515000, cayHangNam: 509800, rung: 198100, thuySan: null },
  'trong-khong': { cayLauNam: 422100, cayHangNam: 417800, rung: 165300, thuySan: null },
  'ngoai-tiep': { cayLauNam: 397300, cayHangNam: 397200, rung: 156500, thuySan: null },
  'ngoai-khong': { cayLauNam: 376100, cayHangNam: 375700, rung: 148700, thuySan: 363000 },
};

/** Đất chuyên trồng lúa nước canh tác 02 vụ/năm — chỉ chia tiếp giáp đường hay không. */
export const GIA_LUA_2VU = { tiepGiap: 509800, khongTiepGiap: 417800 };

// ───────────────────────────────────────────────────────────────────────────────────────────
// BẢNG GIÁ ĐẤT NÔNG NGHIỆP CỦA TỈNH — Nghị quyết 15/2025/NQ-HĐND (áp dụng từ 01/01/2026).
// ⚠️ ĐÂY MỚI LÀ SỐ DÙNG ĐỂ TÍNH HỖ TRỢ ĐÀO TẠO, CHUYỂN ĐỔI NGHỀ (khoản 1 Điều 109 Luật Đất đai 2024,
// Điều 22 Nghị định 88/2024/NĐ-CP: "… lần giá đất nông nghiệp cùng loại TRONG BẢNG GIÁ ĐẤT").
// KHÔNG được lấy giá đất cụ thể để bồi thường (TB 306 hay 4 quyết định khu phức hợp) mà nhân lên:
// giá bồi thường cao gấp ~10 lần bảng giá, nhân 3–5 lần nữa thì tiền hỗ trợ vọt lên gấp đôi tiền đất —
// chủ dự án bắt lỗi 16/9/2026. Số dưới đây lấy từ chính bảng giá đang hiển thị ở trang /bang-gia-dat
// (src/data/camlamBangGia.json — mục "Xã Cam Lâm"), 4 xã vùng Cam Lâm đều cùng mức.
export const BANG_GIA_NN: Record<'cay' | 'thuysan' | 'rung', { vt1: number; vt2: number; ten: string }> = {
  cay: { vt1: 54000, vt2: 41400, ten: 'Đất trồng cây hàng năm / cây lâu năm' },
  thuysan: { vt1: 37800, vt2: 27000, ten: 'Đất nuôi trồng thuỷ sản' },
  rung: { vt1: 18000, vt2: 12600, ten: 'Đất rừng sản xuất' },
};

/** Giá 1 m² trong BẢNG GIÁ ĐẤT của tỉnh (không phải giá bồi thường) — dùng tính tiền hỗ trợ chuyển đổi nghề. */
export function giaBangGiaNN(loai: 'cay' | 'thuysan' | 'rung', viTri: 1 | 2): number {
  const b = BANG_GIA_NN[loai];
  return viTri === 1 ? b.vt1 : b.vt2;
}

// ───────────────────────────────────────────────────────────────────────────────────────────
// HẠN MỨC GIAO ĐẤT NÔNG NGHIỆP CHO CÁ NHÂN — Điều 176 Luật Đất đai 2024.
// Tiền hỗ trợ đào tạo, chuyển đổi nghề CHỈ tính cho phần diện tích TRONG hạn mức này
// (khoản 1 Điều 109 Luật Đất đai 2024 · khoản 3 Điều 22 Nghị định 88/2024/NĐ-CP ·
//  Điều 13 Quy định kèm QĐ 17/2024/QĐ-UBND Khánh Hoà, sửa bởi QĐ 14/2025/QĐ-UBND).
// Khánh Hoà KHÔNG thuộc Đông Nam Bộ / đồng bằng sông Cửu Long nên đất trồng cây hằng năm
// và đất nuôi trồng thuỷ sản là 02 ha. Đất trồng cây lâu năm: 10 ha ở xã đồng bằng,
// 30 ha ở xã trung du - miền núi. Đất rừng sản xuất là rừng trồng: 30 ha.
// Vì một dòng giá gộp cả cây lâu năm lẫn cây hằng năm nên PHẢI cho người dùng chọn đúng loại:
// chọn nhầm cây lâu năm cho thửa trồng lúa là hạn mức vọt từ 2 ha lên 10 ha, tiền hỗ trợ sai gấp 5 lần.
// Mặc định lấy mức THẤP NHẤT (2 ha) cho an toàn.
export type HanMuc = { ma: string; ten: string; m2: number };
export const HAN_MUC: Record<'cay' | 'thuysan' | 'rung', HanMuc[]> = {
  cay: [
    { ma: 'hangnam', ten: 'Cây hằng năm / đất trồng lúa — 2 ha', m2: 20000 },
    { ma: 'launam-db', ten: 'Cây lâu năm, xã đồng bằng — 10 ha', m2: 100000 },
    { ma: 'launam-mn', ten: 'Cây lâu năm, xã trung du - miền núi — 30 ha', m2: 300000 },
  ],
  thuysan: [{ ma: 'ts', ten: 'Nuôi trồng thuỷ sản — 2 ha', m2: 20000 }],
  rung: [{ ma: 'rung', ten: 'Rừng sản xuất là rừng trồng — 30 ha', m2: 300000 }],
};

/** Số lần giá đất nông nghiệp dùng tính hỗ trợ chuyển đổi nghề. */
// ĐANG ÁP DỤNG = 5 lần (chủ dự án chỉ ra 6/10/2026, đã đọc nguyên văn văn bản):
//   03 lần — Điều 13 QĐ 17/2024, sửa bởi khoản 10 Điều 2 QĐ 14/2025/QĐ-UBND
// + 02 lần — khoản 1 Điều 9 QĐ 32/2026/QĐ-UBND ngày 29/4/2026 (hiệu lực 30/4/2026, Công báo Khánh Hòa số 43 ngày 18/5/2026):
//            "ngoài mức hỗ trợ quy định tại Điều 13 … còn được hỗ trợ thêm 02 (hai) lần giá đất nông nghiệp cùng loại".
//   Không đủ điều kiện chuyển đổi nghề → khoản 2 Điều 9 QĐ 32/2026: 50% phần cộng thêm (= 1 lần).
export const SO_LAN_KHANH_HOA = 5;
export const SO_LAN_TRUOC_QD32 = 3;  // phương án bồi thường duyệt TRƯỚC 30/4/2026 (chỉ có QĐ 14/2025)
export const SO_LAN_TRAN = SO_LAN_KHANH_HOA; // giữ tên cũ cho chỗ khác đang dùng

// ───────────────────────────────────────────────────────────────────────────────────────────
// HỖ TRỢ DI CHUYỂN TÀI SẢN KHI PHẢI DI CHUYỂN CHỖ Ở — khoản 1 Điều 8 Quy định kèm
// QĐ 17/2024/QĐ-UBND, được thay bằng khoản 6 Điều 2 QĐ 14/2025/QĐ-UBND (bản đang có hiệu lực).
export const DI_CHUYEN = [
  { ma: 'trong-xa', ten: 'Chuyển đến chỗ ở mới TRONG cùng xã nơi có đất thu hồi', tien: 10000000 },
  { ma: 'ngoai-xa', ten: 'Chuyển đến chỗ ở mới RA NGOÀI xã nơi có đất thu hồi', tien: 12000000 },
  { ma: 'mot-phan', ten: 'Thu hồi một phần đất ở, phải phá nhà nhưng đất còn lại vẫn xây nhà được', tien: 5000000 },
] as const;
/** Nhà nhiều tầng: cộng thêm 20% mức trên cho MỖI TẦNG tính từ tầng thứ 3 (điểm d khoản 1 Điều 8). */
export const DI_CHUYEN_THEM_MOI_TANG = 0.2;

/** Thưởng bàn giao mặt bằng trước thời hạn — 5.000.000 đồng (điểm c khoản 1 Điều 14, sửa bởi QĐ 14/2025). */
export const THUONG_BAN_GIAO = 5000000;

// ───────────────────────────────────────────────────────────────────────────────────────────
// HỖ TRỢ ỔN ĐỊNH ĐỜI SỐNG — Điều 19 Nghị định 88/2024/NĐ-CP.
// Một nhân khẩu được hỗ trợ mỗi tháng số tiền bằng 30 kg gạo theo GIÁ TRUNG BÌNH TẠI THỊ TRƯỜNG
// ĐỊA PHƯƠNG ở thời điểm hỗ trợ. Số tháng phụ thuộc: thu hồi bao nhiêu phần trăm đất nông nghiệp
// đang dùng, có phải dời nhà đi không, nơi đến có phải vùng kinh tế - xã hội khó khăn không.
export const GAO_KG_THANG = 30;
/** Số tháng được hỗ trợ. ty = 'duoi30' | '30-70' | 'tren70'. */
export function soThangOnDinh(ty: 'duoi30' | '30-70' | 'tren70', diChuyen: boolean, vungKhoKhan: boolean): number {
  if (ty === 'duoi30') return 0;                       // dưới 30%: do UBND tỉnh quyết, không có mức cứng
  if (ty === '30-70') return vungKhoKhan && diChuyen ? 24 : diChuyen ? 12 : 6;
  return vungKhoKhan && diChuyen ? 36 : diChuyen ? 24 : 12;
}
