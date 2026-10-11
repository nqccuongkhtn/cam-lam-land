'use client';
/* eslint-disable react-hooks/exhaustive-deps */
// TRA CỨU & HỌC LUẬT ĐẤT ĐAI — CHỈ QUẢN TRỊ VIÊN XEM ĐƯỢC.
//
// Nguyên tắc số một: NGUYÊN VĂN LÀ NGUYÊN VĂN. Chữ luật lấy từ bản PDF ký số đăng Công báo,
// tách máy ra JSON, KHÔNG viết lại một chữ nào. Phần "giải thích cho dễ hiểu" để RIÊNG một
// khung màu khác, ghi rõ "không phải văn bản luật" — người đọc không bao giờ lẫn hai thứ.
// (Bản HTML toàn văn trên cổng Chính phủ THIẾU 3 điều mà không báo gì — xem scripts/luat.)
//
// Cách bày cho dễ nhớ: cây CHƯƠNG → MỤC → ĐIỀU lấy thẳng từ cấu trúc của chính văn bản,
// không tự chế "chủ đề" theo cảm tính. Muốn tra nhanh theo việc thật (cấp Giấy chứng nhận, bồi thường, tách thửa…)
// thì dùng hàng CHỦ ĐỀ NHANH — bản chất là câu tìm sẵn, bấm một cái ra đúng nhóm điều.
//
// Kho gồm LUẬT ĐẤT ĐAI 2024 + toàn bộ NGHỊ ĐỊNH HƯỚNG DẪN. Tìm được CẢ KHO một lượt, vì
// nhiều việc luật chỉ nói một câu rồi "Chính phủ quy định chi tiết" — chữ thật nằm ở nghị định.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, coVaiTro } from '@/lib/auth';

type Diem = { ky: string; chu: string };
type Khoan = { so: number; chu: string; diem: Diem[] };
type Dan = { ma: string; so?: number };
// Tình trạng của TỪNG ĐIỀU: đã bị bãi bỏ cả điều, bãi bỏ một phần, hay bị sửa đổi.
// Thiếu cái này thì người đọc tưởng điều đã hết hiệu lực vẫn còn dùng được — nguy hiểm nhất.
type TinhTrang = { loai: 'het-hieu-luc' | 'bai-bo-mot-phan' | 'sua-doi'; boi: string;
  boiDieu?: number; tuNgay: string; phan?: string };
type Dieu = { so: number; tieuDe: string; chuong: string; chuongTen: string; muc: string | null; mucTen: string;
  khoan: Khoan[]; dan?: Dan[]; duocDan?: Dan[]; tinhTrang?: TinhTrang;
  suaDoi?: SuaDoi[]; suaDoiCho?: { ma: string; soHieu: string; loai: string; phamVi: string }[] };
// Một lần điều này bị sửa: ai sửa, sửa phần nào, từ ngày nào, và NGUYÊN VĂN đoạn mới.
type SuaDoi = { loai: 'sua-doi' | 'bo-sung' | 'bai-bo' | 'thay-the'; boi: string; boiDieu: number;
  boiKhoan: number; tuNgay: string; phamVi: string; khoan?: number; noiDungMoi?: string };
// Điều ĐẺ RA VỀ SAU (Điều 22a, 78b…): bản gốc không có, do luật sửa đổi thêm vào.
type DieuThem = { so: string; sauDieu: number; boi: string; boiDieu: number; boiKhoan: number;
  tuNgay: string; noiDungMoi: string };
type VanBan = { ma: string; soHieu: string; ngay: string; ten: string; nguon: string; phuLuc?: string;
  hetHieuLuc?: string; chuong: { so: string; ten: string }[]; dieu: Dieu[];
  mauBiBaiBo?: { boi: string; tuNgay: string; phan: string }[]; boSungThem?: DieuThem[] };

type KhoItem = { ma: string; soHieu: string; ngay: string; ten: string; soDieu: number; hetHieuLuc?: string;
  nguoiKy?: string; ngayHieuLuc?: string; dan?: string[]; duocDan?: string[];
  // Lược đồ văn bản: bốn loại quan hệ, tính sẵn lúc build từ chính chữ của văn bản.
  canCu?: string[]; laCanCuCho?: string[]; thayThe?: string[]; biThayTheBoi?: string[];
  suaDoi?: string[]; biSuaDoiBoi?: string[];
  baiBoMotPhan?: { ma: string; phan: string }[]; biBaiBoMotPhanBoi?: string[] };
// TÌNH HUỐNG = đi theo việc thật, mỗi bước một câu hỏi, có nhánh trả lời, bước nào cũng dẫn nguồn.
type NhanhTH = { neu: string; thi: string; canh?: boolean; dan?: Dan[] };
type BuocTH = { hoi: string; y: string; dan?: Dan[]; nhanh?: NhanhTH[] };
// BỘ HỒ SƠ: giấy tờ phải nộp, nộp ở đâu, bao lâu, nhận được gì — lấy từ Nghị định 101/2024.
type GiayTo = { ten: string; mau?: string; batBuoc?: boolean; y?: string };
type HoSo = { nhan: string; gom: GiayTo[]; noiNop: string[]; thoiHan: string; ketQua: string;
  dan?: Dan[]; canhBao?: string };
type VuongMac = { gap: string; go: string; dan?: Dan[] };
// Bảng liệt kê đầy đủ một nhóm trường hợp (dùng cho 16 trường hợp đăng ký biến động).
type DongBang = { diem: string; ten: string; moTa: string; batBuoc30: boolean;
  thoiHan: string; thoiHanThem?: string; cu?: string; dan?: Dan[] };
type BangTH = { nhan: string; ghiChu: string; cot: string[]; dong: DongBang[] };
type TinhHuong = { ma: string; icon: string; ten: string; tom: string; buoc: BuocTH[];
  ketLuan?: string[]; danKetLuan?: Dan[]; hoSo?: HoSo; vuongMac?: VuongMac[]; bang?: BangTH };
type KhoTinhHuong = { canhBao: string; ds: TinhHuong[] };
// Giải thích do người làm web viết, KHÔNG phải chữ luật — luôn để trong khung riêng, màu khác.
type GiaiThich = { canhBao: string; muc: Record<string, { y: string; nho: string }> };
// y = câu cốt lõi, ngắn, để in lên khung vẽ cho gọn.
// chiTiet = phần giải thích dài, chỉ hiện ở kiểu Danh sách (nơi có chỗ đọc) — nhét hết vào
// khung vẽ thì ô cao gấp đôi, cuộn mãi không hết, học khó hơn chứ không dễ hơn.
type NutSoDo = { ten: string; y: string; chiTiet?: string; dan: { ma: string; so?: number }[] };
// "neo" = SỐ NEO GHI NHỚ: mỗi nhánh gắn một con số để bám vào (3 nhóm đất, 5 điều kiện,
// 7 bước…). Nhớ con số là gọi ra được cả nhánh — mẹo học cũ mà hiệu quả.
type NhanhSoDo = { ten: string; icon: string; mau: string; y: string; neo?: string; con: NutSoDo[] };
type SoDo = { nhanh: NhanhSoDo[] };
// Từ ngữ do CHÍNH LUẬT định nghĩa (điều "Giải thích từ ngữ"), rút bằng dung-tu-dien.py.
type TuNgu = { tu: string; nghia: string; ma: string; soHieu: string; dieu: number; khoan: number };
type KhoTuNgu = { tu: TuNgu[]; danGian: Record<string, string> };
// LỘ TRÌNH HỌC: 9 chặng, xếp theo vòng đời một thửa đất. Xem dung-lo-trinh.py.
type Chang = { so: number; ten: string; icon: string; mau: string; moTa: string };
type Chang2 = Chang & { trongTam?: boolean };
// theoDieu: MỘT điều có thể thuộc NHIỀU chặng — vì các điều liên kết chéo nhau,
// vd Điều 45 (quyền giao dịch) bị cả chặng đăng ký biến động lẫn chặng giao dịch kéo vào.
type LoTrinh = { chang: Chang2[]; theoDieu: Record<string, number[]>; theoVanBan: Record<string, number> };
// Chuỗi dọc: điều của Luật Đất đai 2024 -> những điều của nghị định, thông tư hướng dẫn nó.
type ChuoiDoc = { chuoi: Record<string, { ma: string; nhan: string; dieu: number[] }[]>;
  truc: Record<string, number[]> };
// Thẻ học soạn tay cho phần CON SỐ và MỐC THỜI GIAN — thứ bắt buộc phải thuộc lòng.
type TheSo = { hoi: string; dap: string; nho?: string; chuDe: string; dan?: Dan[] };
type KhoTheSo = { canhBao: string; the: TheSo[] };
// Một thẻ đã dựng xong, sẵn sàng đưa ra hỏi.
type TheHoc = { khoa: string; loai: string; chuDe: string; hoi: string; dap: string; nho?: string; dan?: Dan[] ; truc?: number };

// ── BỘ TỔNG HỢP: một danh mục gom MỌI văn bản học được, sinh bởi scripts/luat/dung-bo-tong-hop.py ──
// Không tự tính gì ở đây — chỉ hiện ra cái script đã gom (tình trạng, quan hệ, chủ đề, chặng).
type TinhTrangVb = 'con-hieu-luc' | 'sua-doi-mot-phan' | 'het-hieu-luc' | 'tham-khao';
type VbBth = { ma: string; nhom: string; loai: string; soHieu: string; nhan: string; ten: string; coQuan: string;
  ngay: string; ngayHieuLuc: string; ngayHieuLucDoc?: string; hieuLucNguyenVan?: string; nguoiKy?: string;
  tinhTrang: TinhTrangVb; tinhTrangChu: string; soDieu?: number; soChuong?: number;
  dieuHetHieuLuc?: number; dieuBaiBoMotPhan?: number; dieuSuaDoi?: number;
  quanHe?: Record<string, string[]>; chuDe: { ten: string; icon: string; soDieu?: number }[];
  chang: { so: number; soDieu?: number; loi?: boolean }[]; nguon?: string;
  tinh?: string; nguonChu?: string; banGoc?: string; tom?: string; nhacToiNgoaiKho?: string[];
  canKiemTra?: { tu: string; dieu: number; khoan?: number; ghi: string }[];
  luuTru?: { tep: string; kichThuocGoc: number; kichThuocLuu: number; cachLuu: string } };
// Một văn bản tham khảo nhắc tới một điều của kho: TRÍCH DẪN (công văn trích điều đó) hoặc LIÊN QUAN
// (người làm web thấy nên đọc kèm). luuY = lời người làm web, KHÔNG phải chữ của văn bản nào.
type DanTk = { ma: string; kieu: 'trich-dan' | 'lien-quan'; khoan?: number; trich?: string[]; luuY?: string;
  canh?: boolean; lyDo?: string };
type NenBoSung = { soHieu: string; ten?: string; duocNhacBoi: string[]; nhom?: string; anhHuongDieu?: string[];
  lyDoChuaCo?: string; canKiemTra?: string; danhMuc?: { link: string; tep: string[] } };
type BoTongHop = { capNhat: string; tong: { vanBan: number; coDieu: number; thamKhao: number; dieu: number };
  nhom: { ma: string; icon: string; ten: string; moTa: string; soVanBan: number; conHieuLuc: number; nenBoSung?: number }[];
  tinhTrang: Record<string, { icon: string; ten: string }>;
  chuDe: { ten: string; icon: string; tim: string; vanBan: { ma: string; soDieu?: number }[] }[];
  chang: Chang2[]; vanBan: VbBth[]; theoDieu: Record<string, DanTk[]>; nenBoSung: NenBoSung[] };
// VĂN BẢN THAM KHẢO (công văn hướng dẫn, giải đáp của bộ, sở các tỉnh) — public/luat/tham-khao/<mã>.json.
// Không chia điều nên không đi chung đường với kho luật. doan = NGUYÊN VĂN từng đoạn.
type VbThamKhao = { ma: string; loai: string; soHieu: string; ngay: string; diaDanh?: string; coQuanChuQuan?: string;
  coQuan: string; coQuanNgan: string; tinh?: string; ten: string; kinhGui?: string; canhBao: string;
  doan: string[]; chuThich?: { so: string; chu: string }[]; noiNhan?: string[]; chucVuKy?: string[]; nguoiKy?: string;
  nguonChu: string; ghiChuChu?: string; suaMayDoc?: { may: string; dung: string; ghi?: string }[]; banGoc?: string;
  danChieu: { chu: string; ma?: string; so?: number; khoan?: number; soHieu?: string; ngoaiKho?: boolean; luuY?: string; canh?: boolean }[];
  vanBanNhacToi?: { soHieu: string; ma?: string; ten?: string; canKiemTra?: string }[];
  lienQuan?: { ma: string; so: number; khoan?: number; lyDo?: string }[];
  giaiThich?: { tom?: string; y?: string[]; luuY?: string } };
// Màu nhãn tình trạng — nhìn màu là biết văn bản còn dùng được không.
const MAU_TT: Record<TinhTrangVb, string> = {
  'con-hieu-luc': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'sua-doi-mot-phan': 'bg-sky-50 text-sky-700 border-sky-200',
  'het-hieu-luc': 'bg-rose-50 text-rose-700 border-rose-200',
  'tham-khao': 'bg-amber-50 text-amber-800 border-amber-200',
};
const TEN_QH: [string, string][] = [['canCu', 'Căn cứ ban hành'], ['thayThe', 'Thay thế'], ['biThayTheBoi', 'Bị thay thế bởi'],
  ['suaDoi', 'Sửa đổi, bổ sung'], ['biSuaDoiBoi', 'Bị sửa đổi, bổ sung bởi'], ['baiBoMotPhan', 'Bãi bỏ một phần của'],
  ['biBaiBoMotPhanBoi', 'Bị bãi bỏ một phần bởi'], ['laCanCuCho', 'Được hướng dẫn bởi']];
// Tên NGẮN của nhóm cho hàng nút lọc trên điện thoại (tên đầy đủ để ở tiêu đề nhóm).
const TEN_NGAN_NHOM: Record<string, string> = { luat: 'Luật', 'nghi-quyet': 'Nghị quyết', 'nghi-dinh': 'Nghị định',
  'thong-tu': 'Thông tư', 'dia-phuong': 'Khánh Hòa', 'huong-dan': 'Tham khảo' };
const nutLoc = (bat: boolean) => `shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-semibold transition ${bat ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`;
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// tách chữ đã chuẩn hoá thành TIẾNG (mọi thứ không phải chữ / số là chỗ ngắt) — dùng chung cho câu gõ và chữ luật
const tachTieng = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
// ── BỎ TỪ HỎI ĐỜI THƯỜNG (đợt 26, 12/10/2026) ──
// Người dùng điện thoại hay gõ cả câu hỏi: "tách thửa cần điều kiện gì", "có được xây nhà không", "như thế nào", "bao nhiêu". Chữ luật không
// có mấy từ này → đòi đủ mọi tiếng là hụt kết quả. Bỏ chúng trước khi so khớp. Cẩn thận không bỏ nhầm chữ có nghĩa trong luật:
//   · "sao" chỉ bỏ trong cụm ("ra sao", "làm sao") — "bản sao" là thuật ngữ; "không" / "chưa" chỉ bỏ khi ĐỨNG CUỐI ("không được" có nghĩa);
//   · gõ KHÔNG DẤU thì không bỏ từ đơn dễ nhầm ("can" = căn hộ, "vay" = vay vốn, "chua" = đất chùa) — chỉ bỏ khi gõ có dấu đúng chữ;
//   · "anh, chị, em" giữ nguyên (luật thừa kế: "anh, chị, em ruột").
// [cụm từ (gõ có dấu), bỏ cả khi gõ không dấu?, chỉ bỏ khi đứng cuối?]
const TU_HOI: [string, boolean, boolean][] = [
  ['như thế nào', true, false], ['làm thế nào', true, false], ['thế nào', true, false], ['làm sao', true, false], ['ra sao', true, false],
  ['là gì', true, false], ['là sao', true, false], ['bao nhiêu', true, false], ['bao lâu', true, false], ['khi nào', true, false],
  ['ở đâu', true, false], ['hay không', true, false], ['được không', true, false], ['có không', true, false], ['phải không', true, false],
  ['đúng không', true, false], ['hay chưa', true, false], ['cho hỏi', true, false], ['xin hỏi', true, false], ['cho mình hỏi', true, false],
  ['cho tôi hỏi', true, false], ['cho em hỏi', true, false],
  ['gì', true, false], ['nào', true, false], ['không', true, true], ['chưa', false, true], ['cần', false, false], ['vậy', false, false],
  ['ạ', false, false], ['nhỉ', false, false], ['hả', false, false], ['à', false, false], ['tôi', false, false], ['mình', false, false],
];
const TU_HOI_TACH = TU_HOI.map(([c, kdOk, cuoi]) => ({ c, tu: c.split(' '), kdOk, cuoi })).sort((a, b) => b.tu.length - a.tu.length);
function boTuHoi(cau: string): { cau: string; bo: string[] } {
  const goc = tachTieng(cau);
  if (goc.length < 2) return { cau, bo: [] };
  const D = goc.map((t) => thuongDau(t)), K = goc.map((t) => kd(t));
  const xoa = new Array(goc.length).fill(false); const bo: string[] = [];
  for (let i = 0; i < goc.length; i++) {
    if (xoa[i]) continue;
    for (const h of TU_HOI_TACH) {
      const n = h.tu.length;
      if (i + n > goc.length || (h.cuoi && i + n !== goc.length)) continue;
      let khop = true;
      for (let j = 0; j < n && khop; j++) {
        const coDauGo = D[i + j] !== K[i + j];   // tiếng người dùng gõ CÓ dấu
        khop = coDauGo ? D[i + j] === h.tu[j] : (h.kdOk && K[i + j] === kd(h.tu[j]));
      }
      if (!khop) continue;
      for (let j = 0; j < n; j++) xoa[i + j] = true;
      bo.push(goc.slice(i, i + n).join(' ')); break;
    }
  }
  const con = goc.filter((_, i) => !xoa[i]);
  if (!bo.length || con.join('').length < 2) return { cau, bo: [] };   // bỏ hết thì thôi, giữ nguyên câu gõ
  return { cau: con.join(' '), bo };
}

// DẪN CHIẾU TRONG CHỮ LUẬT — biến thành nút bấm được, kiểu Thư viện pháp luật.
// Ba dạng, xét theo đúng thứ tự này (dạng dài phải xét trước, không thì bị dạng ngắn ăn mất):
//   1. "Điều 5 của Nghị định số 88/2024/NĐ-CP"  -> nhảy tới đúng điều của đúng văn bản
//   2. "Điều 137 của Luật này" / "Nghị định này" -> nhảy trong chính văn bản đang xem
//   3. "88/2024/NĐ-CP" đứng một mình              -> mở văn bản đó
//   4. "Điều 96 của Luật Đất đai" — GỌI TÊN, KHÔNG ghi số hiệu. Đây mới là dạng hay gặp
//      nhất trong nghị định (đã đo 762 chỗ); thiếu nó là mất gần 2/3 mối nối về luật gốc.
const RE_DAN = new RegExp(
  'Điều\\s+(\\d{1,3})\\s+(?:của\\s+)?(?:Luật|Nghị định|Thông tư)\\s+(?:số\\s+)?(\\d{1,4}/\\d{4}/[A-ZĐ][A-ZĐ0-9-]*)'
  + '|Điều\\s+(\\d{1,3})(?:\\s+của)?\\s+(?:Luật|Nghị định|Thông tư)\\s+này'
  + '|(\\d{1,4}/\\d{4}/[A-ZĐ][A-ZĐ0-9-]*)'
  + '|Điều\\s+(\\d{1,3})\\s+(?:của\\s+)?Luật Đất đai(?:\\s+năm\\s+(\\d{4}))?(?!\\s*(?:số|\\d))',
  'g');

// "Luật Đất đai" không ghi số hiệu thì là luật của ĐỜI ĐÓ. Mốc lấy theo NGÀY BAN HÀNH của
// từng đạo luật, không lấy ngày hiệu lực: nghị định hướng dẫn Luật 2024 đều ký tháng 6-7/2024,
// tức là trước ngày luật có hiệu lực 01/8/2024.
const DOI_LUAT: [string, string][] = [['2024-01-18', 'ldd2024'], ['2013-11-29', 'ldd2013'],
  ['2003-11-26', 'ldd2003'], ['1993-07-14', 'ldd1993'], ['0000-00-00', 'ldd1987']];
const luatDatDaiLucDo = (ngay: string, nam?: string) =>
  (nam ? 'ldd' + nam : (DOI_LUAT.find(([moc]) => (ngay || '9999') >= moc) || DOI_LUAT[0])[1]);

const MAU_NHANH: Record<string, string> = {
  slate: 'border-slate-300 bg-slate-50 text-slate-700',
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-300 bg-amber-50 text-amber-800',
  sky: 'border-sky-300 bg-sky-50 text-sky-800',
  violet: 'border-violet-300 bg-violet-50 text-violet-800',
  rose: 'border-rose-300 bg-rose-50 text-rose-800',
  orange: 'border-orange-300 bg-orange-50 text-orange-800',
  teal: 'border-teal-300 bg-teal-50 text-teal-800',
};
type VanBanNgan = { id: number; loai: string; so: string; ten: string; tep: string[]; link: string };

// Bỏ dấu để gõ "dat dai" vẫn ra "đất đai".
const kd = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Nhãn ngắn hiện trên nút chọn văn bản: "31/2024/QH15" -> "Luật Đất đai 2024",
// "88/2024/NĐ-CP" -> "NĐ 88/2024", "10/2024/TT-BTNMT" -> "TT 10/2024".
const nhanNgan = (ma: string, soHieu: string) => {
  // Luật Đất đai qua các đời: gọi thẳng theo NĂM cho dễ nhận, số hiệu cũ (3-LCT/HĐNN8,
  // 24-L/CTN) chẳng ai nhớ nổi.
  if (ma.startsWith('ldd')) return 'Luật Đất đai ' + ma.slice(3);
  if (ma.startsWith('lsd')) return 'Luật sửa đổi ' + ma.slice(3);
  const [so, nam, loai] = (soHieu || '').split('/');
  // Nghị quyết của Quốc hội cũng đuôi QH như luật — nhận theo mã "nq…" (quy ước khi nạp).
  if (ma.startsWith('nq')) return `NQ ${so}/${nam}`;
  if (loai && /HĐND/.test(loai)) return `NQ ${so}/${nam} (HĐND)`;
  if (loai && /UBND/.test(loai)) return `QĐ ${so}/${nam} (UBND)`;
  if (loai && loai.startsWith('QH')) return `Luật ${so}/${nam}`;
  if (loai && loai.startsWith('TT')) return `TT ${so}/${nam}`;
  return `NĐ ${so}/${nam}`;
};
const ngayVn = (s: string) => (s ? s.split('-').reverse().join('/') : '');
// Dấu hiệu nhỏ đặt trước tên điều để nhìn danh sách là biết ngay điều nào còn dùng được.
// Dấu đứng đầu tên điều trong danh sách — nhìn lướt là biết điều nào còn dùng được.
// ⛔ hết hiệu lực · ⚠️ bị bãi bỏ một phần · ✏️ đã bị sửa đổi, bổ sung.
// ❓ (dấu riêng, xem canKiem): công văn tham khảo báo điều này đã đổi hiệu lực mà văn bản làm thay đổi
//    CHƯA có trong kho — máy không tự kết luận, chỉ nhắc "cần kiểm".
const dauTinhTrang = (d: Dieu) => (d.tinhTrang?.loai === 'het-hieu-luc' ? '⛔ '
  : d.tinhTrang?.loai === 'bai-bo-mot-phan' ? '⚠️ '
  : (d.tinhTrang?.loai === 'sua-doi' || (d.suaDoi?.length || 0) > 0) ? '✏️ ' : '');

// CHỦ ĐỀ NHANH = câu tìm sẵn theo việc người ta hay hỏi. Không phải phân loại pháp lý,
// chỉ là lối tắt — nên để nguyên chữ trong luật để tìm cho trúng.
const CHU_DE: { ten: string; icon: string; tim: string }[] = [
  { ten: 'Cấp Giấy chứng nhận', icon: '📗', tim: 'giấy chứng nhận quyền sử dụng đất' },
  { ten: 'Thu hồi đất', icon: '🚧', tim: 'thu hồi đất' },
  { ten: 'Bồi thường, tái định cư', icon: '💵', tim: 'bồi thường' },
  { ten: 'Giá đất, bảng giá đất', icon: '🏷️', tim: 'giá đất' },
  { ten: 'Giao đất, cho thuê đất', icon: '🤝', tim: 'giao đất, cho thuê đất' },
  { ten: 'Chuyển mục đích sử dụng', icon: '🔁', tim: 'chuyển mục đích sử dụng đất' },
  // Hai chủ đề thêm 11/10/2026 cùng hai công văn tham khảo (Quảng Ngãi, Lào Cai). Cụm tìm chọn đúng
  // chữ luật dùng: "đất trồng lúa, đất rừng" chỉ có ở các điều về chuyển mục đích đất lúa, đất rừng.
  // Bộ tổng hợp (scripts/luat/dung-bo-tong-hop.py) đọc THẲNG mảng này — thêm, đổi tên ở đây là đủ.
  { ten: 'Chuyển mục đích đất lúa, đất rừng', icon: '🌲', tim: 'đất trồng lúa, đất rừng' },
  { ten: 'Trồng rừng thay thế', icon: '🌱', tim: 'trồng rừng thay thế' },
  { ten: 'Hạn mức & thời hạn', icon: '📏', tim: 'hạn mức' },
  { ten: 'Đất nông nghiệp', icon: '🌾', tim: 'đất nông nghiệp' },
  { ten: 'Đất ở', icon: '🏠', tim: 'đất ở' },
  { ten: 'Tách thửa, hợp thửa', icon: '✂️', tim: 'tách thửa' },
  { ten: 'Tranh chấp, khiếu nại', icon: '⚖️', tim: 'tranh chấp đất đai' },
  { ten: 'Quy hoạch sử dụng đất', icon: '🗺️', tim: 'quy hoạch sử dụng đất' },
  { ten: 'Tiền sử dụng đất, thuê đất', icon: '🧾', tim: 'tiền sử dụng đất' },
  { ten: 'Thừa kế, tặng cho, chuyển nhượng', icon: '📜', tim: 'chuyển nhượng' },
];

// HAI KIỂU ĐẶT DẤU THANH: "hòa / hoà", "ủy / uỷ", "thủy / thuỷ", "khỏe / khoẻ" — chính kho luật cũng dùng lẫn lộn (đếm 11/10/2026:
// "ủy" 1.909 chỗ, "uỷ" 313 chỗ; "hòa" 289, "hoà" 98). So có dấu mà không quy về một kiểu thì gõ "uỷ ban" sót 1.909 chỗ.
// Quy hết về kiểu dấu đặt trên chữ sau (oà, uỷ); mỗi cặp 2 chữ đổi thành 2 chữ nên vị trí từng ký tự không lệch.
const DAU_THANH: Record<string, string> = {
  'òa': 'oà', 'óa': 'oá', 'ỏa': 'oả', 'õa': 'oã', 'ọa': 'oạ',
  'òe': 'oè', 'óe': 'oé', 'ỏe': 'oẻ', 'õe': 'oẽ', 'ọe': 'oẹ',
  'ùy': 'uỳ', 'úy': 'uý', 'ủy': 'uỷ', 'ũy': 'uỹ', 'ụy': 'uỵ',
};
const chuanDau = (s: string) => s.replace(/[òóỏõọ][ae]|[ùúủũụ]y/g, (m) => DAU_THANH[m] || m);
// chữ thường CÓ DẤU (dạng NFC, dấu thanh đã quy một kiểu) — so khớp khi người dùng gõ có dấu
const thuongDau = (s: string) => chuanDau((s || '').normalize('NFC').toLowerCase());

// CÁCH GỌI ĐỜI THƯỜNG → CHỮ CỦA LUẬT (11/10/2026). Người dân hay gõ "sổ đỏ", "đền bù", "lên thổ cư", "UBND"… mà luật viết khác
// ("giấy chứng nhận", "bồi thường", "chuyển mục đích sử dụng đất", "Ủy ban nhân dân") → ra ít hoặc 0 kết quả. Gõ có cách gọi này thì
// tìm THÊM theo chữ của luật; kết quả theo đúng chữ đã gõ vẫn đứng trước. "canDau": chỉ đổi khi gõ CÓ DẤU (gõ "so do" có thể là "sơ đồ").
const CACH_GOI: { goi: string[]; luat: string; canDau?: boolean }[] = [
  { goi: ['sổ đỏ'], luat: 'giấy chứng nhận', canDau: true },
  { goi: ['sổ hồng', 'bìa đỏ', 'bìa hồng'], luat: 'giấy chứng nhận' },
  { goi: ['gcn', 'gcnqsdđ'], luat: 'giấy chứng nhận' },
  { goi: ['qsdđ'], luat: 'quyền sử dụng đất' },
  { goi: ['lên thổ cư', 'chuyển thổ cư', 'lên đất ở', 'cmđ'], luat: 'chuyển mục đích sử dụng đất' },
  { goi: ['đất thổ cư', 'thổ cư'], luat: 'đất ở' },
  { goi: ['đền bù'], luat: 'bồi thường' },
  { goi: ['giải tỏa', 'gpmb'], luat: 'giải phóng mặt bằng' },
  { goi: ['tđc'], luat: 'tái định cư' },
  { goi: ['ubnd'], luat: 'ủy ban nhân dân' },
  { goi: ['hđnd'], luat: 'hội đồng nhân dân' },
  { goi: ['tách sổ'], luat: 'tách thửa' },
  { goi: ['gộp sổ', 'gộp thửa'], luat: 'hợp thửa' },
  { goi: ['sang tên', 'mua bán đất'], luat: 'chuyển nhượng quyền sử dụng đất' },
  { goi: ['lấn chiếm'], luat: 'lấn đất' },
  { goi: ['khung giá đất', 'khung giá'], luat: 'bảng giá đất' },
  // cụm ĐỦ phải có riêng (12/10/2026): bảng xếp theo độ dài nên "cấp sổ" đổi trước "sổ đỏ" → "cấp sổ đỏ" thành "cấp giấy chứng nhận ĐỎ"
  // (sót chữ "đỏ") → không điều nào khớp. Cụm dài hơn thì được đổi trước, trọn cụm.
  { goi: ['cấp sổ đỏ', 'làm sổ đỏ', 'cấp sổ hồng', 'làm sổ hồng', 'cấp bìa đỏ', 'cấp bìa hồng'], luat: 'cấp giấy chứng nhận', canDau: true },
  { goi: ['cấp sổ', 'làm sổ', 'cấp bìa'], luat: 'cấp giấy chứng nhận' },
  { goi: ['đất lúa'], luat: 'đất trồng lúa' },
];

export default function TraCuuLuatPage() {
  const { user, loading } = useAuth() as any;
  const duocXem = coVaiTro(user, 'admin');

  const [kho, setKho] = useState<KhoItem[]>([]);
  const [maVb, setMaVb] = useState('ldd2024');
  const [cacVb, setCacVb] = useState<Record<string, VanBan>>({});
  const [dangTai, setDangTai] = useState(true);
  const [dangTaiKho, setDangTaiKho] = useState(false);
  const [loi, setLoi] = useState('');
  const [tim, setTim] = useState('');
  const [timCaKho, setTimCaKho] = useState(false);
  const [chon, setChon] = useState<number | null>(null);
  const [xemPhuLuc, setXemPhuLuc] = useState(false);
  const [moChuong, setMoChuong] = useState<Record<string, boolean>>({});
  const [ghim, setGhim] = useState<string[]>([]);
  const [chiGhim, setChiGhim] = useState(false);
  // Danh sách kết quả chỉ vẽ trước SO_HIEN dòng (đợt 11): gõ "đất" + Cả kho là ~1.400 điều khớp → vẽ 1.400 nút mỗi lần gõ một chữ
  // làm điện thoại giật. Dòng cuối có nút "Xem thêm"; đổi chữ tìm / bộ lọc thì về lại 60.
  const SO_HIEN = 60;
  const [soHien, setSoHien] = useState(SO_HIEN);
  const [gt, setGt] = useState<GiaiThich | null>(null);
  const [chiGt, setChiGt] = useState(false);
  const [sd, setSd] = useState<SoDo | null>(null);
  const [moNhanh, setMoNhanh] = useState<Record<number, boolean>>({ 0: true });
  const [moChuDe, setMoChuDe] = useState(false);
  // ── HỌC THUỘC BẰNG THẺ LẬT + LẶP LẠI NGẮT QUÃNG ──
  // Hai kỹ thuật học đã được chứng minh: TỰ NHỚ LẠI trước khi xem đáp án, và ÔN LẠI ĐÚNG
  // LÚC SẮP QUÊN. Thẻ nào thuộc thì đẩy xa ra (1 → 3 → 7 → 16 → 35 ngày), thẻ nào quên thì
  // kéo về ôn ngay hôm sau. Tiến độ lưu ngay trong máy người dùng.
  const [cheDoHoc, setCheDoHoc] = useState<'sodo' | 'the'>('sodo');
  const [theSo2, setTheSo2] = useState<KhoTheSo | null>(null);
  const [chuDeHoc, setChuDeHoc] = useState('');
  const [kieuSoDo, setKieuSoDo] = useState<'danhsach' | 'khungve'>('danhsach');
  const [phongTo, setPhongTo] = useState(1);
  const [timSoDo, setTimSoDo] = useState('');
  // Khung vẽ: kéo thả để di chuyển, và "tiêu điểm" = chỉ xem riêng một nhánh.
  const [dich, setDich] = useState({ x: 0, y: 0 });
  const [tieuDiem, setTieuDiem] = useState<number | null>(null);
  const keo = useRef<{ x: number; y: number } | null>(null);
  const khungVe = useRef<HTMLDivElement | null>(null);
  // Thẻ: S = độ bền (ngày), D = độ khó 1..10, lan = số lần ôn, sai = số lần quên.
  const [boThe, setBoThe] = useState<Record<string, any>>({});
  const [goThu, setGoThu] = useState('');        // ô gõ thử đáp án
  const [batGo, setBatGo] = useState(false);     // bật chế độ gõ thay vì chỉ lật thẻ
  const [moCaiDat, setMoCaiDat] = useState(false);   // bảng cài đặt của màn hình học
  const [chuoi, setChuoi] = useState(0);   // chuỗi ngày học liên tiếp
  const [theSo, setTheSo] = useState(0);
  const [datLat, setDatLat] = useState(false);
  const [th, setTh] = useState<KhoTinhHuong | null>(null);
  const [tn, setTn] = useState<KhoTuNgu | null>(null);
  // 544 thẻ SINH TỰ ĐỘNG từ chính kho luật (dung-the-tu-dong.py) — xem lời giải thích ở đó.
  const [theTd, setTheTd] = useState<{ the: TheHoc[] } | null>(null);
  const [lt, setLt] = useState<LoTrinh | null>(null);
  const [cd, setCd] = useState<ChuoiDoc | null>(null);
  // XEM NHANH: bấm vào một dẫn chiếu thì hiện thẻ ngay tại chỗ, KHÔNG nhảy đi mất — đang
  // đọc dở một điều mà bị cuốn sang điều khác là mất mạch. Muốn đọc kỹ thì bấm "Mở hẳn".
  const [xemNhanh, setXemNhanh] = useState<{ ma: string; so: number; x: number; y: number } | null>(null);
  // NGĂN ĐỌC BÊN CẠNH: đang xem sơ đồ hay tình huống mà bấm vào một điều thì mở điều đó ở
  // ngăn bên, sơ đồ giữ nguyên phía sau — đóng ngăn là về đúng chỗ đang xem dở.
  // Trước đây bấm một cái là nhảy thẳng sang thẻ "Toàn văn", mất sạch chỗ đang đứng.
  const [docBen, setDocBen] = useState<{ ma: string; so: number } | null>(null);
  const [moSuaDoi, setMoSuaDoi] = useState<Record<string, boolean>>({});
  const [moLuocDo, setMoLuocDo] = useState(false);
  const [moThuocTinh, setMoThuocTinh] = useState(false);
  const [moCanKiem, setMoCanKiem] = useState(false);
  // Gõ "đ45 k2" rồi mở → tô sáng + cuộn tới khoản 2 của điều đang đọc (null = không tô khoản nào)
  const [khoanSang, setKhoanSang] = useState<number | null>(null);
  // XEM GẦN ĐÂY (lưu trên máy người dùng): ô tìm còn trống thì hiện để bấm mở lại ngay, khỏi tìm lại từ đầu
  const [ganDay, setGanDay] = useState<{ ma: string; so: number; nhan: string; tieuDe: string }[]>([]);
  // Từ khoá đã tìm (đợt 19, 11/10/2026): ghi lại khi người dùng MỞ một kết quả từ ô tìm (gõ dở rồi bỏ thì không ghi). Tối đa 6, mới nhất trước.
  const [daTim, setDaTim] = useState<string[]>([]);
  useEffect(() => { try { setDaTim(JSON.parse(localStorage.getItem('luat-da-tim') || '[]')); } catch { /* */ } }, []);
  useEffect(() => { try { setGanDay(JSON.parse(localStorage.getItem('luat-gan-day') || '[]')); } catch { /* */ } }, []);   // dòng "❓ N điều cần kiểm hiệu lực" — bấm mới bung danh sách
  // Điện thoại: danh sách điều đang bung ra hay đã thu lại (máy tính không dùng tới).
  const [moDs, setMoDs] = useState(false);
  const [thChon, setThChon] = useState<string>('');
  // Đánh dấu đã chuẩn bị xong từng giấy tờ — lưu trong máy để hôm sau mở lại vẫn còn.
  const [daCo, setDaCo] = useState<Record<string, boolean>>({});
  const [moVuong, setMoVuong] = useState<Record<string, boolean>>({});
  const [the, setThe] = useState<'luat' | 'tinhhuong' | 'sodo' | 'danhmuc'>('luat');
  // CUỘN CHUỘT ĐỂ PHÓNG TO / THU NHỎ sơ đồ. Phóng quanh ĐÚNG CHỖ CON TRỎ đang chỉ
  // (không phải quanh góc trên trái), nên nhìn tới đâu phóng tới đó, khỏi phải kéo lại.
  // Phải gắn tay bằng addEventListener: React để sự kiện cuộn ở chế độ "không chặn được",
  // không chặn thì cuộn chuột làm trôi cả trang thay vì phóng sơ đồ.
  const xemSd = useRef({ phongTo: 1, dich: { x: 0, y: 0 } });
  // Kích thước sơ đồ do phần vẽ tính ra, gửi ngược lên đây để canh cho vừa khung.
  const coSd = useRef({ rong: 0, cao: 0, x0: 0, y0: 0 });
  const daCanh = useRef('');
  xemSd.current = { phongTo, dich };
  useEffect(() => {
    const el = khungVe.current;
    if (!el) return;
    const cuon = (e: WheelEvent) => {
      e.preventDefault();
      const o = el.getBoundingClientRect();
      const cx = e.clientX - o.left, cy = e.clientY - o.top;
      const { phongTo: z1, dich: d1 } = xemSd.current;
      const z2 = Math.min(2, Math.max(0.35, +(z1 * (e.deltaY < 0 ? 1.12 : 1 / 1.12)).toFixed(3)));
      if (z2 === z1) return;
      const k = z2 / z1;
      setPhongTo(z2);
      setDich({ x: cx - (cx - d1.x) * k, y: cy - (cy - d1.y) * k });
    };
    el.addEventListener('wheel', cuon, { passive: false });
    return () => el.removeEventListener('wheel', cuon);
  }, [the, kieuSoDo]);

  // TỰ CANH CHO VỪA KHUNG mỗi khi mở khung vẽ, đổi nhánh đang xem, hoặc xoay máy.
  // Chỉ canh MỘT LẦN cho mỗi tình huống (daCanh) để không giật khi người dùng đang kéo.
  useEffect(() => {
    if (the !== 'sodo' || cheDoHoc !== 'sodo' || kieuSoDo !== 'khungve') return;
    const canh = () => {
      const el = khungVe.current;
      if (!el || !coSd.current.rong) return;
      const khoa = `${el.clientWidth}:${tieuDiem}`;
      if (daCanh.current === khoa) return;
      daCanh.current = khoa;
      // Xem riêng một nhánh thì cho phóng tới 1,6 lần — chữ mới đủ to để đọc trên điện thoại.
      const tran = tieuDiem != null ? 1.6 : 1;
      const z = Math.min(tran, Math.max(0.3, (el.clientWidth - 16) / coSd.current.rong));
      setPhongTo(+z.toFixed(3));
      setDich({ x: (el.clientWidth - coSd.current.rong * z) / 2 - coSd.current.x0 * z,
                y: Math.max(8, (el.clientHeight - coSd.current.cao * z) / 2) - coSd.current.y0 * z });
    };
    const t = setTimeout(canh, 60);
    window.addEventListener('resize', canh);
    return () => { clearTimeout(t); window.removeEventListener('resize', canh); };
  }, [the, cheDoHoc, kieuSoDo, tieuDiem, sd]);
  const [dm, setDm] = useState<VanBanNgan[]>([]);
  const [timDm, setTimDm] = useState('');
  const [locLoai, setLocLoai] = useState('');
  // ── BỘ TỔNG HỢP + VĂN BẢN THAM KHẢO ──
  const [bth, setBth] = useState<BoTongHop | null>(null);
  const [kieuDm, setKieuDm] = useState<'bo' | 'toanquoc'>('bo');   // thẻ Danh mục: bộ để học / toàn quốc
  const [timBo, setTimBo] = useState('');
  const [locNhom, setLocNhom] = useState('');
  const [locTt, setLocTt] = useState('');
  const [locCd, setLocCd] = useState('');
  const [moVb, setMoVb] = useState<Record<string, boolean>>({});
  const [moNen, setMoNen] = useState(false);
  const [cacTk, setCacTk] = useState<Record<string, VbThamKhao>>({});
  // Công văn đang mở ở NGĂN ĐỌC (giống ngăn đọc điều luật). tkTruoc: đang đọc công văn thì bấm sang
  // một điều luật nó dẫn — nhớ lại để có nút "← Về công văn", khỏi lạc đường.
  const [docTk, setDocTk] = useState<string | null>(null);
  const [tkTruoc, setTkTruoc] = useState<string | null>(null);
  const daTaiTk = useRef<Record<string, Promise<VbThamKhao>>>({});
  const oNoiDung = useRef<HTMLDivElement | null>(null);
  // Cuộn tới điều vừa mở SAU KHI trang vẽ xong (đợt 23, 12/10/2026) — moDieu chỉ tăng số này, việc cuộn để effect bên dưới làm.
  const [cuonToi, setCuonToi] = useState(0);
  // Bung / thu hai khung phụ trước nguyên văn (đợt 25): mặc định THU một dòng; người dùng bung một lần thì các điều sau cũng bung.
  const [moHuongDan, setMoHuongDan] = useState(false);
  const [moThamKhao, setMoThamKhao] = useState(false);
  const oTim = useRef<HTMLInputElement | null>(null);
  const daTai = useRef<Record<string, Promise<VanBan>>>({});

  const vb = cacVb[maVb] || null;
  const [daChep, setDaChep] = useState<'' | 'chu' | 'link'>('');
  const daMoLink = useRef(false);
  // Cỡ chữ phần nguyên văn (đợt 20): 0 = 14px (mặc định), 1 = 16px, 2 = 18px — nhớ trên máy.
  const CO_CHU = [14, 16, 18];
  const [coChu, setCoChu] = useState(0);
  useEffect(() => { try { const v = Number(localStorage.getItem('luat-co-chu')); if (v >= 0 && v <= 2) setCoChu(v); } catch { /* */ } }, []);
  const doiCoChu = () => setCoChu((v) => { const m = (v + 1) % CO_CHU.length; try { localStorage.setItem('luat-co-chu', String(m)); } catch { /* */ } return m; });

  // Tải một văn bản. Nhớ lại lời hứa đang chạy để bấm nhanh hai lần không tải hai lần.
  const taiVb = (ma: string): Promise<VanBan> => {
    if (!daTai.current[ma]) {
      daTai.current[ma] = fetch(`/luat/${ma}.json`).then((r) => r.json()).then((d: VanBan) => {
        setCacVb((m) => ({ ...m, [ma]: d }));
        return d;
      });
    }
    return daTai.current[ma];
  };
  // Tải một văn bản tham khảo (công văn) — nhỏ, vài KB, chỉ tải khi cần.
  const taiTk = (ma: string): Promise<VbThamKhao> => {
    if (!daTaiTk.current[ma]) {
      daTaiTk.current[ma] = fetch(`/luat/tham-khao/${ma}.json`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((d: VbThamKhao) => { setCacTk((m) => ({ ...m, [ma]: d })); return d; });
      daTaiTk.current[ma].catch(() => { delete daTaiTk.current[ma]; });
    }
    return daTaiTk.current[ma];
  };
  // Mở công văn ở ngăn đọc bên cạnh — đang xem gì vẫn giữ nguyên phía sau.
  const moTk = (ma: string) => {
    taiTk(ma).catch(() => {});
    setXemNhanh(null); setDocBen(null); setDocTk(ma);
  };

  useEffect(() => {
    if (!duocXem) return;
    fetch('/luat/_kho.json').then((r) => r.json()).then((ds: KhoItem[]) => setKho(ds)).catch(() => {});
    fetch('/luat/giai-thich.json').then((r) => r.json()).then((d: GiaiThich) => setGt(d)).catch(() => {});
    fetch('/luat/so-do.json').then((r) => r.json()).then((d: SoDo) => setSd(d)).catch(() => {});
    fetch('/luat/tinh-huong.json').then((r) => r.json()).then((d: KhoTinhHuong) => setTh(d)).catch(() => {});
    fetch('/luat/the-so.json').then((r) => r.json()).then((d: KhoTheSo) => setTheSo2(d)).catch(() => {});
    fetch('/luat/tu-ngu.json').then((r) => r.json()).then(setTn).catch(() => {});
    fetch('/luat/the-tu-dong.json').then((r) => r.json()).then(setTheTd).catch(() => {});
    fetch('/luat/lo-trinh.json').then((r) => r.json()).then(setLt).catch(() => {});
    fetch('/luat/chuoi-doc.json').then((r) => r.json()).then(setCd).catch(() => {});
    // Bộ tổng hợp ~50 KB: tải luôn vì cả khung "văn bản tham khảo nhắc tới điều này" cũng cần nó.
    fetch('/luat/bo-tong-hop.json').then((r) => r.json()).then(setBth).catch(() => {});
  }, [duocXem]);

  useEffect(() => {
    if (!duocXem) return;
    setDangTai(true); setLoi('');
    taiVb(maVb).then(() => setDangTai(false))
      .catch(() => { delete daTai.current[maVb]; setLoi('Không tải được văn bản này.'); setDangTai(false); });
  }, [duocXem, maVb]);

  // Bật "tìm cả kho" thì mới tải hết — 11 văn bản ~3,5 MB, không tải sẵn cho nhẹ máy.
  useEffect(() => {
    if (!timCaKho || !kho.length) return;
    const thieu = kho.filter((x) => !cacVb[x.ma]);
    if (!thieu.length) return;
    setDangTaiKho(true);
    Promise.all(thieu.map((x) => taiVb(x.ma).catch(() => null))).finally(() => setDangTaiKho(false));
  }, [timCaKho, kho.length]);

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('luat-ghim') || '[]');
      // Bản cũ chỉ ghim được Luật Đất đai nên lưu mỗi số điều -> chuyển sang dạng "mã:số".
      setGhim(t.map((x: any) => (typeof x === 'number' ? `ldd2024:${x}` : x)));
    } catch { /* */ }
  }, []);

  // Danh mục văn bản: cào cả dải mã văn bản của Hệ thống văn bản Chính phủ rồi lọc theo từ khoá đất đai
  // (xem scripts/luat/cao-van-ban-dat-dai.py) — nên KHÔNG SÓT như cách dùng ô tìm kiếm của trang gốc.
  // Danh mục toàn quốc ~170 KB: chỉ tải khi mở đúng lớp "toàn quốc" (lớp "bộ để học" không cần).
  useEffect(() => { if (the === 'danhmuc' && kieuDm === 'toanquoc' && !dm.length) fetch('/luat/danh-muc.json').then((r) => r.json()).then((d) => setDm(d.vanBan || [])).catch(() => {}); }, [the, kieuDm, dm.length]);

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('luat-the-hoc') || '{}');
      // Bản cũ lưu kiểu hộp Leitner {hop, ngayOn} -> đổi sang kiểu SM-2, giữ tiến độ đã học.
      for (const k of Object.keys(t)) {
        if (t[k] && t[k].hop != null && t[k].de == null) {
          const h = t[k].hop;
          t[k] = { de: 2.5, khoang: [1, 3, 7, 16, 35][h - 1] || 1, lan: h, ngayOn: t[k].ngayOn };
        }
      }
      setBoThe(t);
    } catch { /* */ }
    try { setChuoi(JSON.parse(localStorage.getItem('luat-chuoi') || '{}').chuoi || 0); } catch { /* */ }
    try { setDaCo(JSON.parse(localStorage.getItem('luat-ho-so') || '{}')); } catch { /* */ }
  }, []);

  const danhDauGiayTo = (khoa: string) => setDaCo((m) => {
    const moi = { ...m, [khoa]: !m[khoa] };
    try { localStorage.setItem('luat-ho-so', JSON.stringify(moi)); } catch { /* */ }
    return moi;
  });

  const homNay = () => new Date().toISOString().slice(0, 10);
  const congNgay = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  // ── BỘ SINH THẺ ──
  // Không soạn thẻ riêng một nơi rồi để nó lệch với nội dung. Thẻ DỰNG THẲNG từ chính dữ
  // liệu đang hiển thị, nên sửa nội dung ở đâu thì thẻ tự đúng theo ở đó.
  const dsThe = useMemo<TheHoc[]>(() => {
    const ra: TheHoc[] = [];
    // 1. Điều luật có giải thích: hỏi tên điều → đáp là câu "nhớ nhanh" + giải thích.
    if (gt) {
      for (const [k, v] of Object.entries(gt.muc)) {
        const [ma, so] = k.split(':');
        const d = cacVb[ma]?.dieu.find((z) => z.so === Number(so));
        const kv = kho.find((z) => z.ma === ma);
        ra.push({
          khoa: 'dieu:' + k, loai: 'Điều luật',
          chuDe: d?.chuongTen ? d.chuongTen.slice(0, 40) : (kv ? nhanNgan(kv.ma, kv.soHieu) : ma),
          hoi: d ? `${kv ? nhanNgan(kv.ma, kv.soHieu) : ma} · Điều ${so}. ${d.tieuDe} — điều này quy định gì?` :
            `${kv ? nhanNgan(kv.ma, kv.soHieu) : ma} · Điều ${so} nói gì?`,
          dap: v.y, nho: v.nho, dan: [{ ma, so: Number(so) }],
        });
      }
    }
    // 2. Vướng mắc trong tình huống: "gặp chuyện này thì gỡ sao" — dạng hỏi đáp sẵn.
    if (th) {
      for (const x of th.ds) {
        for (const [i, v] of (x.vuongMac || []).entries()) {
          ra.push({ khoa: `vuong:${x.ma}:${i}`, loai: 'Vướng mắc', chuDe: x.ten.slice(0, 40),
            hoi: `${x.icon} ${v.gap} — gỡ thế nào?`, dap: v.go, dan: v.dan });
        }
        // 3. Bảng liệt kê (16 trường hợp biến động): hỏi có bị ép 30 ngày + thời hạn.
        for (const r of x.bang?.dong || []) {
          ra.push({ khoa: `bang:${x.ma}:${r.diem}`, loai: 'Biến động', chuDe: 'Đăng ký biến động',
            hoi: `Đăng ký biến động theo điểm ${r.diem}) ${r.ten} — có bắt buộc đăng ký trong thời hạn 30 ngày không, thời hạn giải quyết bao lâu?`,
            dap: `${r.batBuoc30 ? '⏰ CÓ — phải đăng ký biến động trong thời hạn 30 ngày, quá hạn bị phạt 2–3 triệu đồng.' : 'Không bắt buộc đăng ký trong thời hạn 30 ngày.'} Thời hạn giải quyết: ${r.thoiHan}.${r.thoiHanThem ? ' ' + r.thoiHanThem : ''}`,
            nho: r.batBuoc30 ? '30 ngày · ' + r.thoiHan : r.thoiHan, dan: r.dan });
        }
      }
    }
    // 4. TỪ NGỮ DO LUẬT ĐỊNH NGHĨA — học chữ gốc thì đọc điều nào cũng hiểu, và viết ra
    //    cũng không còn dùng chữ tự nghĩ. Hỏi và đáp đều là NGUYÊN VĂN của luật.
    for (const [i, t] of (tn?.tu || []).entries()) {
      ra.push({
        khoa: 'tu:' + i, loai: 'Từ ngữ', chuDe: 'Từ ngữ pháp lý',
        hoi: `Luật định nghĩa “${t.tu}” là gì?`,
        dap: `${t.tu} là ${t.nghia}`,
        nho: `${nhanNgan(t.ma, t.soHieu)} · Điều ${t.dieu} khoản ${t.khoan}`,
        dan: [{ ma: t.ma, so: t.dieu }],
      });
    }
    // 5. THẺ SINH TỰ ĐỘNG TỪ KHO LUẬT — 544 thẻ, phủ rộng chứ không chỉ 19% như trước:
    //    "quy định này nằm ở điều nào" · "điều này còn dùng được không" · "bị sửa thế nào"
    //    · "văn bản này là gì". Hỏi và đáp đều là chữ của luật, không tự diễn giải.
    for (const t of (theTd?.the || [])) ra.push(t);
    // 6. Thẻ con số soạn tay.
    for (const [i, t] of (theSo2?.the || []).entries()) {
      ra.push({ khoa: 'so:' + i, loai: 'Con số', chuDe: t.chuDe, hoi: t.hoi, dap: t.dap, nho: t.nho, dan: t.dan });
    }
    return ra;
  }, [gt, th, theSo2, tn, theTd, cacVb, kho]);

  // ── THẺ NÀY THUỘC CHẶNG NÀO ──
  // Tra theo ĐIỀU mà thẻ dẫn tới. Không dựa vào "chủ đề" nữa vì chủ đề trước đây sinh ra
  // từ tên chương, tên tình huống, tên nhóm số… nên có tới 33 cái rời rạc, học kiểu đó là
  // chắp vá: hôm nay một mẩu bồi thường, mai một mẩu tách thửa, không nối được vào nhau.
  const cacChang = (t: TheHoc): number[] => {
    if (!lt) return [0];
    const ra = new Set<number>();
    // CHỈ xét điều ĐẦU TIÊN của thẻ — đó là điều chính của thẻ. Mấy điều sau là "học kèm",
    // gom cả vào thì thẻ nào cũng thuộc mọi chặng, phân chặng thành vô nghĩa.
    const d0 = (t.dan || [])[0];
    if (d0) {
      const k = d0.so ? `${d0.ma}:${d0.so}` : '';
      for (const c of (lt.theoDieu[k] || [])) ra.add(c);
      if (!ra.size && lt.theoVanBan[d0.ma] !== undefined) ra.add(lt.theoVanBan[d0.ma]);
    }
    return ra.size ? [...ra].sort((x, y) => x - y) : [0];
  };
  const changCua = (t: TheHoc): number => cacChang(t)[0];
  const changCo = useMemo(() => lt?.chang || [], [lt]);
  // chuDeHoc giờ mang số CHẶNG ('' = học cả lộ trình, theo đúng thứ tự chặng)
  const theTheoChuDe = useMemo(
    () => (chuDeHoc === '' ? dsThe : dsThe.filter((t) => cacChang(t).includes(Number(chuDeHoc)))),
    [dsThe, chuDeHoc, lt]);

  // ── CHỌN THẺ CHO HÔM NAY ──
  // Bộ thẻ có hơn 700 cái. Nếu ngày đầu đổ hết ra thì học hai hôm là bỏ, mà đó đúng là
  // cách hỏng việc thường gặp nhất khi học kiểu thẻ lật. Nên:
  //   • Thẻ ĐẾN HẠN ÔN thì cho ra HẾT — đây là thứ sắp quên, bỏ qua là mất công học lại.
  //   • Thẻ MỚI thì mỗi ngày chỉ nhận thêm một số nhất định (Anki để mặc định 20).
  // Nhờ vậy lượng học mỗi ngày đều tay, và số thẻ đến hạn cũng không dồn cục về sau.
  const [theMoiMoiNgay, setTheMoiMoiNgay] = useState(20);
  const theHomNay = useMemo(() => {
    const hn = homNay();
    const daBatDauHomNay = Object.values(boThe).filter((c: any) => c?.batDau === hn).length;
    const denHan = theTheoChuDe.filter((t) => boThe[t.khoa] && (boThe[t.khoa] as any).ngayOn <= hn);
    const conNhan = Math.max(0, theMoiMoiNgay - daBatDauHomNay);
    // THẺ TRỤC HỌC TRƯỚC: điều bị nhiều điều khác dẫn tới là trục của cả mảng
    // (Điều 9 Phân loại đất bị dẫn tới 36 lần). Học trục trước rồi mới học chi tiết thì
    // mới có chỗ móc kiến thức vào; học lộn ngược là học vẹt.
    const moi = theTheoChuDe.filter((t) => !boThe[t.khoa])
      .sort((a, b) => (b.truc || 0) - (a.truc || 0)).slice(0, conNhan);
    // XẾP THEO CHẶNG rồi mới trộn TRONG TỪNG CHẶNG.
    // Trộn tất tay như trước thì học xen kẽ đúng là nhớ lâu hơn, nhưng xen kẽ giữa những
    // thứ CHẲNG LIÊN QUAN GÌ NHAU thì chỉ thành chắp vá. Xen kẽ có tác dụng khi các thứ
    // đem trộn cùng một mảng việc và dễ lẫn với nhau — đúng bằng phạm vi một chặng.
    const hat = Number(hn.split('-').join(''));
    return [...denHan, ...moi]
      .map((t, i2) => ({ t, c: changCua(t), r: (hat + i2 * 2654435761) % 1000003 }))
      .sort((a, b) => (a.c - b.c) || ((b.t.truc || 0) - (a.t.truc || 0)) || (a.r - b.r))
      .map((x) => x.t);
  }, [theTheoChuDe, boThe, theMoiMoiNgay, lt]);
  // Số thẻ mới còn nhận được hôm nay — hiện lên cho biết còn bao nhiêu là xong phần mới.
  const theMoiConLai = useMemo(() => {
    const hn = homNay();
    const da = Object.values(boThe).filter((c: any) => c?.batDau === hn).length;
    return Math.max(0, theMoiMoiNgay - da);
  }, [boThe, theMoiMoiNgay]);

  // Coi là THUỘC khi độ bền đã trên 21 ngày — tức là nghỉ 3 tuần vẫn còn nhớ 90%.
  const daThuoc = useMemo(
    () => theTheoChuDe.filter((t) => ((boThe[t.khoa] as any)?.S || 0) >= 21).length, [theTheoChuDe, boThe]);
  // THẺ KHÓ (Anki gọi là 'leech'): quên từ 4 lần trở lên. Học kiểu cũ mãi không vào thì
  // phải quay lại đọc nguyên văn điều đó, chứ lật thẻ thêm cũng vô ích.
  const theKho = useMemo(
    () => theTheoChuDe.filter((t) => ((boThe[t.khoa] as any)?.sai || 0) >= 4).length, [theTheoChuDe, boThe]);

  // ── THUẬT TOÁN ÔN TẬP: FSRS ──
  // Trước đây dùng SM-2 (thuật toán của SuperMemo năm 1987, Anki dùng mấy chục năm).
  // Nay đổi sang FSRS — thứ Anki đã lấy làm mặc định từ 2023 vì ĐO ĐƯỢC là tốt hơn hẳn:
  // cùng mức nhớ thì số thẻ phải ôn giảm rõ rệt, vì nó không đoán mò mà TÍNH RA xác suất
  // mình còn nhớ thẻ đó tới đâu.
  //
  // Mỗi thẻ mang 2 con số thay vì 1:
  //   S (độ bền) = bao nhiêu ngày nữa thì khả năng nhớ tụt xuống 90%.
  //   D (độ khó) = 1..10, thẻ càng khó thì độ bền càng lên chậm.
  // Khả năng còn nhớ sau t ngày:  R = (1 + 19/81 · t/S) ^ (-0.5)   — đường quên thực nghiệm.
  // Hẹn ngày ôn = đúng lúc R tụt về 90%, tức là ÔN NGAY TRƯỚC KHI QUÊN. Ôn sớm hơn là phí
  // công, ôn muộn hơn là mất luôn.
  //
  // Bốn nút tự chấm (giống Anki) chứ không phải ba: FSRS cần phân biệt "khó nhưng vẫn nhớ"
  // với "nhớ bình thường" thì mới tính đúng. Mỗi nút hiện sẵn LẦN SAU ÔN KHI NÀO.
  const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
             0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  const DECAY = -0.5, NHAN = 19 / 81;
  const kep = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
  // Khả năng còn nhớ sau t ngày với độ bền S
  const conNho = (t: number, S: number) => Math.pow(1 + NHAN * t / Math.max(S, 0.1), DECAY);
  // Số ngày tới lúc khả năng nhớ tụt về 90%
  const soNgay = (S: number) => Math.max(1, Math.round((S / NHAN) * (Math.pow(0.9, 1 / DECAY) - 1)));

  /** Tính trạng thái mới của thẻ sau khi tự chấm. g: 1 quên · 2 khó · 3 được · 4 dễ */
  const tinhThe = (c: any, g: number) => {
    const D0 = (x: number) => kep(W[4] - (x - 3) * W[5], 1, 10);
    if (!c || !c.lan) return { S: W[g - 1], D: D0(g), lan: 1, sai: g === 1 ? 1 : 0 };
    const t = Math.max(0, Math.round((Date.now() - (c.mocOn || Date.now())) / 86400000));
    const S = Math.max(c.S || 1, 0.1), D = kep(c.D || 5, 1, 10), R = conNho(t, S);
    let Sm: number;
    if (g === 1) {
      Sm = W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
    } else {
      Sm = S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9])
        * (Math.exp(W[10] * (1 - R)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
    }
    // độ khó trôi dần về mức trung bình, không để một lần bấm làm lệch hẳn
    const Dm = kep(W[7] * D0(3) + (1 - W[7]) * (D - W[6] * (g - 3)), 1, 10);
    return { S: kep(Sm, 0.1, 36500), D: Dm, lan: (c.lan || 0) + 1, sai: (c.sai || 0) + (g === 1 ? 1 : 0) };
  };

  /** Lần sau ôn sau bao nhiêu ngày nếu bấm nút này — hiện sẵn lên nút cho đỡ bấm mò. */
  const hienNgay = (c: any, g: number) => {
    const n = soNgay(tinhThe(c, g).S);
    return g === 1 ? 'lát ôn lại' : n < 30 ? `${n} ngày` : n < 365 ? `${Math.round(n / 30)} tháng` : `${(n / 365).toFixed(1)} năm`;
  };

  const traLoiThe = (khoa: string, g: number) => {
    setBoThe((m) => {
      const c: any = m[khoa];
      const k = tinhThe(c, g);
      // Lần đầu đụng tới thẻ này là hôm nào — dùng để đếm hạn mức thẻ mới trong ngày.
      const batDau = c?.batDau || homNay();
      // Bấm "quên" thì cho quay lại NGAY trong buổi học, không đợi hôm sau — nhớ lại được
      // trong cùng buổi mới là học lại, để tới mai là mất công học từ đầu.
      const ngayOn = g === 1 ? homNay() : congNgay(soNgay(k.S));
      const moi = { ...m, [khoa]: { ...k, ngayOn, batDau, mocOn: Date.now() } as any };
      try { localStorage.setItem('luat-the-hoc', JSON.stringify(moi)); } catch { /* */ }
      return moi;
    });
    try {
      const g2 = JSON.parse(localStorage.getItem('luat-chuoi') || '{}');
      if (g2.ngay !== homNay()) {
        g2.chuoi = g2.ngay === congNgay(-1) ? (g2.chuoi || 0) + 1 : 1;
        g2.ngay = homNay();
        localStorage.setItem('luat-chuoi', JSON.stringify(g2));
        setChuoi(g2.chuoi);
      }
    } catch { /* */ }
    setDatLat(false);
    setGoThu('');
    setTheSo((i2) => i2 + 1);
  };

  const khoaGhim = (ma: string, so: number) => `${ma}:${so}`;
  const doiGhim = (ma: string, so: number) => setGhim((g) => {
    const k = khoaGhim(ma, so);
    const m = g.includes(k) ? g.filter((x) => x !== k) : [...g, k];
    try { localStorage.setItem('luat-ghim', JSON.stringify(m)); } catch { /* */ }
    return m;
  });

  // ── SO KHỚP THÔNG MINH (11/10/2026) ──
  // (1) Khớp theo TIẾNG trọn vẹn: "thu" không còn khớp vào "thuộc", "hồi" không khớp vào "hồii"; cụm nhiều tiếng thì hai đầu cụm
  //     cũng phải là ranh giới tiếng. (2) Người dùng gõ CÓ DẤU thì so CÓ DẤU ("thu hồi" không lẫn "thủ", "thư", "thú");
  //     gõ không dấu thì so không dấu như cũ (gõ "thu hoi" vẫn ra "thu hồi").
  const coDau = (q: string) => q.normalize('NFD') !== q.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || /[đĐ]/.test(q);
  // (3) Đợt 9: tách TIẾNG theo mọi thứ không phải chữ / số ("giao đất, cho thuê đất" = 5 tiếng, trước tính "đất," là một tiếng);
  //     cụm nhiều tiếng thì giữa hai tiếng chấp nhận mọi dấu câu / khoảng trắng → gõ "giao đất cho thuê đất" vẫn khớp nguyên cụm
  //     "giao đất, cho thuê đất" trong luật, gõ thừa dấu phẩy cũng không sao.
  const boKhop = (q: string) => {
    const dau = coDau(q);
    const goc = dau ? thuongDau(q.trim()) : kd(q.trim());
    const tu = tachTieng(goc);
    const tao = (ds: string[]) => new RegExp('(?:^|[^\\p{L}\\p{N}])(' + ds.map(escRe).join('[^\\p{L}\\p{N}]+') + ')(?=$|[^\\p{L}\\p{N}])', 'u');
    return { dau, cum: tu.join(' '), tu, reCum: tao(tu), reTu: tu.map((t) => tao([t])) };
  };
  // Đọc "số điều" từ chữ đã bỏ dấu: 75 · dieu 75 · d75 · d.75 · dieu 75 khoan 2 · d75 k2 · k2 d75 · 75.2
  const docSoDieu = (q: string): { dieu: number; khoan?: number } | null => {
    let m = /^(?:dieu|d\.?)?\s*(\d{1,3})(?:\s*(?:,|\.)?\s*(?:khoan|k\.?)\s*(\d{1,2}))?$/.exec(q);
    if (m) return { dieu: Number(m[1]), khoan: m[2] ? Number(m[2]) : undefined };
    m = /^(?:khoan|k\.?)\s*(\d{1,2})\s*(?:,|\.)?\s*(?:dieu|d\.?)\s*(\d{1,3})$/.exec(q);
    if (m) return { dieu: Number(m[2]), khoan: Number(m[1]) };
    m = /^(\d{1,3})\.(\d{1,2})$/.exec(q);
    return m ? { dieu: Number(m[1]), khoan: Number(m[2]) } : null;
  };
  // Câu tìm thêm theo chữ của luật (null nếu không có cách gọi đời thường nào). Có dấu thì đổi có dấu, không dấu thì đổi không dấu.
  const doiCachGoi = (q0: string) => {
    const q = q0.trim();
    if (q.length < 2 || docSoDieu(kd(q))) return null;
    const dau = coDau(q);
    const chuan = (t: string) => (dau ? thuongDau(t) : kd(t));
    let cau = chuan(q);
    const cap: [string, string][] = [];
    const ds = CACH_GOI.flatMap((c) => c.goi.map((g) => ({ g, luat: c.luat, canDau: c.canDau }))).sort((a, b) => b.g.length - a.g.length);
    for (const m of ds) {
      if (m.canDau && !dau) continue;
      const re = new RegExp('(^|[^\\p{L}\\p{N}])' + escRe(chuan(m.g)) + '(?=$|[^\\p{L}\\p{N}])', 'gu');
      if (!re.test(cau)) continue;
      re.lastIndex = 0;
      cau = cau.replace(re, (_, a: string) => a + chuan(m.luat));
      if (!cap.some((x) => x[1] === m.luat)) cap.push([m.g, m.luat]);
    }
    return cap.length ? { cau, cap } : null;
  };
  // Chuẩn bị sẵn chuỗi không dấu của từng điều để tìm cho nhanh (làm một lần cho mỗi văn bản).
  // Đợt 10 (11/10/2026): kèm BẢNG TIẾNG (Set) của từng điều — hỏi "điều này có đủ mọi tiếng đã gõ không" chỉ còn là tra bảng,
  // khỏi quét cả nghìn đoạn chữ mỗi lần gõ một chữ (đo trước khi sửa: 80–230 ms mỗi lần gõ trên máy tính, điện thoại chậm gấp
  // mấy lần → gõ bị giật). Chỉ điều có đủ mọi tiếng mới phải dò nguyên cụm bằng biểu thức chữ.
  const chiMuc = useMemo(() => {
    const ra: Record<string, { d: Dieu; ma: string; kho: string; tde: string; khoD: string; tdeD: string;
      tuD: Set<string>; tuK: Set<string>; tdeTuD: Set<string>; tdeTuK: Set<string> }[]> = {};
    for (const ma of Object.keys(cacVb)) {
      ra[ma] = cacVb[ma].dieu.map((d) => {
        const chu = `Điều ${d.so} ${d.tieuDe} ${d.khoan.map((k) => k.chu + ' ' + k.diem.map((x) => x.chu).join(' ')).join(' ')}`;
        const tde = kd(d.tieuDe || ''), kho = kd(chu), tdeD = thuongDau(d.tieuDe || ''), khoD = thuongDau(chu);
        return { d, ma, tde, kho, tdeD, khoD, tuD: new Set(tachTieng(khoD)), tuK: new Set(tachTieng(kho)),
          tdeTuD: new Set(tachTieng(tdeD)), tdeTuK: new Set(tachTieng(tde)) };
      });
    }
    return ra;
  }, [cacVb]);
  type MucChi = (typeof chiMuc)[string][number];
  const coDuTieng = (x: MucChi, bk: { dau: boolean; tu: string[] }, tieuDe = false) => {
    const t = tieuDe ? (bk.dau ? x.tdeTuD : x.tdeTuK) : (bk.dau ? x.tuD : x.tuK);
    return bk.tu.every((w) => t.has(w));
  };

  // GÕ SAI / THIẾU DẤU (đợt 8, 11/10/2026): gõ có dấu thì so có dấu (đợt 4) — nhưng lỡ sai hay thiếu dấu một chữ ("thu hồi đât",
  // "đen bu") là ra 0 kết quả. Nay: chữ có dấu (kể cả cách gọi đời thường đã đổi) không khớp điều nào trong phạm vi đang tìm thì tự
  // LÙI VỀ SO KHÔNG DẤU, kèm dòng báo. Có ít nhất một điều khớp đúng dấu thì giữ nguyên so có dấu.
  // ĐANG GÕ DỞ CHỮ CUỐI (đợt 10): "thu hồi đất quốc phòn" từng ra 0 kết quả cho tới khi gõ xong chữ "phòng". Nay chữ cuối (khi
  // chưa gõ dấu cách) không khớp tiếng nào thì đoán nốt: lấy tiếng HAY GẶP NHẤT bắt đầu bằng chữ đó, trong các điều có đủ mấy tiếng
  // đứng trước. Thứ tự thử: đúng dấu → cách gọi đời thường → đoán chữ cuối → lùi không dấu → không dấu + đoán chữ cuối.
  const timHL = useMemo(() => {
    const { cau: q, bo: boHoi } = boTuHoi(tim.trim());   // đợt 26: bỏ từ hỏi đời thường trước khi so khớp
    const giu = { q, lui: false, doan: '', boHoi };
    if (q.length < 2 || docSoDieu(kd(q))) return giu;
    const ds = timCaKho ? kho.flatMap((x) => chiMuc[x.ma] || []) : (chiMuc[maVb] || []);
    const co = (cau: string) => { const bk = boKhop(cau); return !bk.tu.length || ds.some((x) => coDuTieng(x, bk)); };
    const doanCuoi = (cau: string) => {
      if (/\s$/.test(tim)) return '';
      const bk = boKhop(cau), n = bk.tu.length;
      if (!n) return '';
      const cuoi = bk.tu[n - 1], truoc = { dau: bk.dau, tu: bk.tu.slice(0, -1) };
      // Ưu tiên tiếng ĐI LIỀN SAU tiếng đứng trước trong chữ luật ("quốc ph" → "quốc phòng", "tách t" → "tách thửa"); đếm theo số
      // điều có cặp đó. Không có cặp nào thì lấy tiếng bắt đầu bằng chữ đã gõ hay gặp nhất (số điều có tiếng đó).
      const tc = truoc.tu[truoc.tu.length - 1];
      const re = tc ? new RegExp('(?:^|[^\\p{L}\\p{N}])' + escRe(tc) + '[^\\p{L}\\p{N}]+(' + escRe(cuoi) + '[\\p{L}\\p{N}]+)', 'gu') : null;
      const lien = new Map<string, number>(), hay = new Map<string, number>();
      for (const x of ds) {
        if (!coDuTieng(x, truoc)) continue;
        for (const t of bk.dau ? x.tuD : x.tuK) if (t.length > cuoi.length && t.startsWith(cuoi)) hay.set(t, (hay.get(t) || 0) + 1);
        if (re) {
          re.lastIndex = 0;
          const gap = new Set<string>();
          let m: RegExpExecArray | null;
          while ((m = re.exec(bk.dau ? x.khoD : x.kho))) gap.add(m[1]);
          gap.forEach((t) => lien.set(t, (lien.get(t) || 0) + 1));
        }
      }
      const nhieuNhat = (mp: Map<string, number>) => { let t = '', so = 0; mp.forEach((c, k) => { if (c > so) { t = k; so = c; } }); return t; };
      const chon = nhieuNhat(lien) || nhieuNhat(hay);
      return chon ? [...truoc.tu, chon].join(' ') : '';
    };
    const coGoi = (cau: string) => { const mr = doiCachGoi(cau); return !!mr && co(mr.cau); };
    const dem = (cau: string) => { const bk = boKhop(cau); let c = 0; for (const x of ds) if (coDuTieng(x, bk)) c++; return c; };
    if (co(q) || coGoi(q)) {
      // chữ cuối gõ dở mà ngắn (1–2 chữ cái) vẫn khớp lác đác ("hạn m" → 1 điều có ký hiệu "m)") → đoán nốt nếu ra nhiều hơn hẳn
      const bk = boKhop(q), cuoi = bk.tu[bk.tu.length - 1] || '';
      if (!/\s$/.test(tim) && bk.tu.length >= 2 && cuoi.length <= 2) {
        const d0 = doanCuoi(q);
        if (d0 && dem(d0) >= 5 * Math.max(1, dem(q))) return { q: d0, lui: false, doan: d0, boHoi };
      }
      return giu;
    }
    const d1 = doanCuoi(q);
    if (d1) return { q: d1, lui: false, doan: d1, boHoi };
    if (!coDau(q)) return giu;
    const k = kd(q);
    if (co(k) || coGoi(k)) return { q: k, lui: true, doan: '', boHoi };
    const d2 = doanCuoi(k);
    return d2 ? { q: d2, lui: true, doan: d2, boHoi } : { q: k, lui: true, doan: '', boHoi };
  }, [tim, timCaKho, kho, chiMuc, maVb]);
  const luiKhongDau = timHL.lui;
  // Từ điển TIẾNG (không dấu) của phạm vi đang tìm → số điều có tiếng đó. Chỉ dùng để gợi ý sửa chính tả (đợt 16).
  const tuDien = useMemo(() => {
    const ds = timCaKho ? kho.flatMap((x) => chiMuc[x.ma] || []) : (chiMuc[maVb] || []);
    const dem = new Map<string, number>();
    for (const x of ds) x.tuK.forEach((t) => dem.set(t, (dem.get(t) || 0) + 1));
    return { ds, dem };
  }, [chiMuc, timCaKho, kho, maVb]);
  const moRong = useMemo(() => doiCachGoi(timHL.q), [timHL]);

  const ketQua = useMemo(() => {
    const q = kd(tim.trim());
    // Tìm cả kho: xếp theo thứ tự văn bản trong danh mục để kết quả không nhảy lung tung.
    let ds = timCaKho ? kho.flatMap((x) => chiMuc[x.ma] || []) : (chiMuc[maVb] || []);
    if (chiGhim) ds = ds.filter((x) => ghim.includes(khoaGhim(x.ma, x.d.so)));
    if (chiGt) ds = ds.filter((x) => !!gt?.muc[khoaGhim(x.ma, x.d.so)]);
    if (!q) return ds;
    // Gõ số điều kiểu nào cũng hiểu: "75", "điều 75", "đ75", "d.75", "điều 75 khoản 2", "k2 đ75", "75.2" → đúng Điều 75
    const so = docSoDieu(q);
    if (so) {
      const t = ds.filter((x) => x.d.so === so.dieu);
      if (t.length) return t;
    }
    // TÌM THÔNG MINH (11/10/2026): trước đây phải gõ đúng NGUYÊN CỤM liền nhau mới ra ("thu hồi đất quốc phòng" không ra nếu
    // các chữ đứng cách nhau). Nay: điều chứa nguyên cụm xếp trước, rồi tới điều có ĐỦ MỌI TIẾNG (không cần liền nhau);
    // trong mỗi nhóm, điều khớp ở TIÊU ĐỀ đứng trên điều chỉ khớp trong thân bài. So theo tiếng trọn vẹn, có dấu thì so có dấu.
    // XẾP THEO MỨC SÁT NGHĨA (đợt 28, 12/10/2026) — chấm điểm từng điều có đủ mọi tiếng:
    //   tiêu đề có NGUYÊN CỤM 100 · tiêu đề có đủ mọi tiếng 80 · thân bài có nguyên cụm 60 · chỉ có đủ tiếng rải rác 20.
    // Kết quả theo CHỮ CỦA LUẬT (cách gọi đời thường "sổ đỏ" → "giấy chứng nhận") gộp CHUNG, chỉ trừ 5 điểm — trước luôn xếp sau hết nên
    // "thủ tục cấp sổ đỏ" ra Điều 27 (chữ rải rác) trên Điều 223 "Các thủ tục hành chính về đất đai". Bằng điểm thì giữ thứ tự cũ.
    const thuTu = new Map(ds.map((x, i) => [x, i] as [(typeof ds)[number], number]));
    const chamDiem = (cau: string, tru: number, ra: Map<(typeof ds)[number], number>) => {
      const bk = boKhop(cau);
      if (!bk.tu.length) return false;                   // gõ toàn dấu câu → coi như chưa gõ
      const than = (x: (typeof ds)[number]) => (bk.dau ? x.khoD : x.kho), tde = (x: (typeof ds)[number]) => (bk.dau ? x.tdeD : x.tde);
      for (const x of ds) {
        if (!coDuTieng(x, bk)) continue;                 // có đủ mọi tiếng (tra bảng, rất nhanh)
        const tdDu = coDuTieng(x, bk, true);
        // + mỗi tiếng của câu tìm CÓ TRONG TIÊU ĐỀ (3 điểm, tối đa 15 — không vượt mức trên): hai điều cùng có nguyên cụm trong thân bài
        // thì điều có tiêu đề gần chủ đề hơn đứng trước (Điều 223 "Các THỦ TỤC hành chính…" trên Điều 27 chỉ nhắc "làm thủ tục cấp…").
        const tdSet = bk.dau ? x.tdeTuD : x.tdeTuK;
        const cong = Math.min(15, 3 * bk.tu.filter((t) => tdSet.has(t)).length);
        const d = (bk.tu.length < 2 ? (tdDu ? 80 : 20)
          : tdDu && bk.reCum.test(tde(x)) ? 100 : tdDu ? 80 : bk.reCum.test(than(x)) ? 60 : 20) + cong - tru;
        if (!(ra.get(x)! >= d)) ra.set(x, d);
      }
      return true;
    };
    const diem = new Map<(typeof ds)[number], number>();
    if (!chamDiem(timHL.q, 0, diem)) return ds;
    if (moRong) chamDiem(moRong.cau, 5, diem);
    return [...diem.entries()].sort((a, b) => b[1] - a[1] || thuTu.get(a[0])! - thuTu.get(b[0])!).map(([x]) => x);
  }, [chiMuc, tim, timHL, chiGhim, chiGt, gt, ghim, timCaKho, maVb, kho, moRong]);
  // LỌC THEO VĂN BẢN khi tìm cả kho (đợt 21): bấm chip "NĐ 102/2024 · 60" → chỉ xem kết quả của văn bản đó. Đổi chữ tìm thì bỏ lọc.
  const [locVb, setLocVb] = useState<string | null>(null);
  useEffect(() => { setLocVb(null); }, [tim, timCaKho]);
  const ketQuaHien = useMemo(() => (locVb ? ketQua.filter((x) => x.ma === locVb) : ketQua), [ketQua, locVb]);
  const demTheoVb = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of ketQua) m.set(x.ma, (m.get(x.ma) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ketQua]);

  const dieuDangXem = useMemo(() => (vb && chon != null ? vb.dieu.find((d) => d.so === chon) || null : null), [vb, chon]);
  useEffect(() => {
    if (!khoanSang || !dieuDangXem) return;
    const t = setTimeout(() => document.getElementById('khoan-' + khoanSang)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 450);
    return () => clearTimeout(t);
  }, [khoanSang, dieuDangXem]);
  // TRÍCH ĐOẠN quanh chữ khớp cho từng kết quả tìm (tối đa 80 kết quả đầu) — nhìn là biết điều nào đúng ý, khỏi mở từng điều.
  // Chữ đã bỏ dấu và chữ gốc (dạng NFC) dài bằng nhau từng ký tự nên dùng chung vị trí cắt.
  // Đợt 5 (11/10/2026): trước lấy đoạn ĐẦU TIÊN có từ đầu tiên ("quốc phòng thu hồi" → trích chỗ có mỗi chữ "quốc"). Nay chấm điểm
  // từng khoản / điểm: có nguyên cụm là nhất, rồi tới đoạn có NHIỀU TIẾNG KHÁC NHAU nhất; cửa sổ trích nới ra để phủ thêm các chữ
  // khớp gần nhau, cắt ở chỗ cách chữ (không cụt giữa tiếng). Nhớ luôn khoản đó để bấm vào là cuộn tới.
  const trichDoan = useMemo(() => {
    const ra = new Map<string, { chu: string; khoan?: number }>();
    const q = kd(tim.trim());
    if (q.length < 2 || docSoDieu(q)) return ra;
    const cacBk = [boKhop(timHL.q), ...(moRong ? [boKhop(moRong.cau)] : [])];
    const viTri = (m: RegExpExecArray) => m.index + (m[0].length - m[1].length);   // bỏ ký tự ranh giới đứng trước
    for (const x of ketQuaHien.slice(0, 80)) {
      // ghi kiểu bằng 'as' để TypeScript không coi tot luôn là null (gán trong vòng lặp lồng nhau)
      let tot = null as { chu: string; so: number; diem: number; vt: number[] } | null;
      for (const bk of cacBk) {
        if (!bk.tu.length) continue;
        const cacTu = bk.reTu.filter((_, i) => bk.tu[i].length >= 2);
        for (const k of x.d.khoan) for (const chu0 of [k.chu, ...k.diem.map((z) => z.chu)]) {
          const chu = (chu0 || '').normalize('NFC'), so = bk.dau ? thuongDau(chu) : kd(chu);
          const vt: number[] = []; let diem = 0;
          const mc = bk.reCum.exec(so);
          if (mc) { diem = 100; vt.push(viTri(mc)); }
          for (const re of cacTu) { const m = re.exec(so); if (m) { diem++; vt.push(viTri(m)); } }
          if (diem && (!tot || diem > tot.diem)) tot = { chu, so: k.so, diem, vt };
        }
        if (tot) break;
      }
      if (!tot) continue;
      const chu = tot.chu, vt = tot.vt.sort((m, n) => m - n), dau = vt[0];
      let cuoi = dau;
      for (const v of vt) if (v - dau <= 150) cuoi = v;
      let a = Math.max(0, dau - 45), b = Math.min(chu.length, cuoi + 90);
      if (a > 0) { const c = chu.indexOf(' ', a); if (c > 0 && c < dau) a = c + 1; }
      if (b < chu.length) { const c = chu.lastIndexOf(' ', b); if (c > cuoi) b = c; }
      ra.set(x.ma + ':' + x.d.so, { chu: (a > 0 ? '…' : '') + chu.slice(a, b) + (b < chu.length ? '…' : ''), khoan: tot.so || undefined });
    }
    return ra;
  }, [ketQuaHien, tim, timHL, moRong]);
  useEffect(() => { setSoHien(SO_HIEN); }, [tim, timCaKho, chiGhim, chiGt, maVb]);
  // GÕ SAI CHÍNH TẢ (đợt 16, 11/10/2026): không điều nào khớp (đã thử cả không dấu, cách gọi đời thường, đoán chữ cuối) thì sửa
  // từng tiếng LẠ thành tiếng gần giống nhất có trong chữ luật (sai 1 chữ cái; tiếng ≥ 5 chữ cái cho sai 2), ưu tiên tiếng hay ĐI LIỀN
  // SAU tiếng đứng trước ("thu hoj" → "thu hồi", không phải "thu hộ"). Chỉ gợi ý câu chắc chắn có điều khớp; chữ hiện ra lấy đúng
  // dấu như chữ luật viết (cắt từ chính đoạn luật có cụm đó).
  const goiYSua = useMemo(() => {
    const q = tim.trim();
    if (ketQua.length || q.length < 2 || docSoDieu(kd(q)) || chiGhim || chiGt) return [] as string[];
    const { ds, dem } = tuDien;
    if (!ds.length) return [] as string[];
    // khoảng cách sửa chữ: thêm / bớt / thay một chữ cái, hoặc ĐẢO hai chữ cạnh nhau ("thuogn" → "thuong") đều tính 1 lỗi
    const kc = (a: string, b: string, max: number) => {
      let hai = Array.from({ length: b.length + 1 }, (_, j) => j), mot = hai.slice();
      for (let i = 1; i <= a.length; i++) {
        const nay = [i]; let nhoNhat = i;
        for (let j = 1; j <= b.length; j++) {
          let v = Math.min(mot[j] + 1, nay[j - 1] + 1, mot[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, hai[j - 2] + 1);
          nay[j] = v; if (v < nhoNhat) nhoNhat = v;
        }
        if (nhoNhat > max) return max + 1;
        hai = mot; mot = nay;
      }
      return mot[b.length];
    };
    const coDu = (tu: string[]) => ds.filter((x) => tu.every((t) => x.tuK.has(t)));
    const lien = (a: string, b: string, trong: typeof ds) => {
      const re = new RegExp('(?:^|[^\\p{L}\\p{N}])' + escRe(a) + '[^\\p{L}\\p{N}]+' + escRe(b) + '(?=$|[^\\p{L}\\p{N}])', 'u');
      let c = 0; for (const x of trong) if (re.test(x.kho)) c++;
      return c;
    };
    const tu = tachTieng(kd(q));
    if (!tu.length || tu.every((t) => dem.has(t))) return [] as string[];
    const chon: string[] = [];
    for (let i = 0; i < tu.length; i++) {
      const w = tu[i];
      if (dem.has(w)) { chon.push(w); continue; }
      const gh = w.length >= 5 ? 2 : 1;
      const ung: [string, number, number][] = [];
      dem.forEach((n, t) => { if (Math.abs(t.length - w.length) <= gh) { const d = kc(w, t, gh); if (d <= gh) ung.push([t, d, n]); } });
      if (!ung.length) return [] as string[];
      ung.sort((a, b) => a[1] - b[1] || b[2] - a[2]);
      const top = ung.slice(0, 30);
      const sau = tu[i + 1] && dem.has(tu[i + 1]) ? tu[i + 1] : '';
      let tot = top[0][0], diem = -Infinity;
      for (const [t, d] of top) {
        const trong = coDu([...chon, t]);
        if (!trong.length) continue;
        const ghep = (chon.length ? lien(chon[chon.length - 1], t, trong) : 0) + (sau ? lien(t, sau, trong) : 0);
        const sc = ghep * 1000 + trong.length - d * 100000;
        if (sc > diem) { diem = sc; tot = t; }
      }
      if (diem === -Infinity) return [] as string[];     // không ứng viên nào ra kết quả
      chon.push(tot);
    }
    const trong = coDu(chon);
    if (!trong.length) return [] as string[];
    // chữ hiện ra: cắt đúng đoạn luật có cụm đó (giữ dấu như luật viết); không có nguyên cụm thì ghép từng tiếng
    const reCum = new RegExp('(?:^|[^\\p{L}\\p{N}])(' + chon.map(escRe).join('[^\\p{L}\\p{N}]+') + ')(?=$|[^\\p{L}\\p{N}])', 'u');
    for (const x of trong) {
      const m = reCum.exec(x.kho);
      if (m) { const a = m.index + (m[0].length - m[1].length); return [x.khoD.slice(a, a + m[1].length)]; }
    }
    const coDauTu = chon.map((t) => {
      const re = new RegExp('(?:^|[^\\p{L}\\p{N}])(' + escRe(t) + ')(?=$|[^\\p{L}\\p{N}])', 'u');
      for (const x of trong) { const m = re.exec(x.kho); if (m) { const a = m.index + (m[0].length - m[1].length); return x.khoD.slice(a, a + m[1].length); } }
      return t;
    });
    return [coDauTu.join(' ')];
  }, [ketQua, tim, tuDien, chiGhim, chiGt]);
  // Mở kết quả thì cuộn tới khoản nào: gõ số ("75.2") thì theo số; gõ chữ thì tới khoản có trích đoạn.
  const khoanKhop = (ma: string, so: number) => docSoDieu(kd(tim.trim()))?.khoan ?? trichDoan.get(ma + ':' + so)?.khoan;

  // Tra nhanh một văn bản trong bộ tổng hợp theo mã.
  const vbBth = useMemo<Record<string, VbBth>>(
    () => Object.fromEntries((bth?.vanBan || []).map((x) => [x.ma, x])), [bth]);
  const dsTk = useMemo(() => (bth?.vanBan || []).filter((x) => x.tinhTrang === 'tham-khao'), [bth]);
  // Đang gõ tìm thì tải luôn mấy văn bản tham khảo (vài KB mỗi cái) để tìm được cả trong đó.
  useEffect(() => {
    if (tim.trim().length >= 2) dsTk.forEach((x) => { taiTk(x.ma).catch(() => {}); });
  }, [tim, dsTk]);
  // Văn bản tham khảo có chữ khớp ô tìm (gõ không dấu vẫn ra) — hiện thành hàng nút trên kết quả.
  const tkKhop = useMemo(() => {
    const q = kd(tim.trim());
    if (q.length < 2 || docSoDieu(q)) return [];
    // cùng bộ so khớp với kho chính (đợt 21): đủ mọi TIẾNG trọn vẹn, gõ có dấu so có dấu (trước "thu" dính "thuộc")
    const bk = boKhop(timHL.q);
    if (!bk.tu.length) return [];
    return dsTk.filter((x) => {
      const v = cacTk[x.ma];
      const chu = [x.nhan, x.ten, x.coQuan, x.tinh || '', ...(v ? [...v.doan, ...(v.chuThich || []).map((c) => c.chu)] : [])].join(' ');
      const so = bk.dau ? thuongDau(chu) : kd(chu);
      return bk.reTu.every((r) => r.test(so));
    });
  }, [tim, timHL, dsTk, cacTk]);
  // Điều này có văn bản tham khảo báo là đã đổi hiệu lực (văn bản làm thay đổi CHƯA có trong kho) không.
  const canKiem = (ma: string, so: number) => !!bth?.theoDieu[`${ma}:${so}`]?.some((z) => z.canh);
  // Đóng ngăn đọc điều luật thì quên luôn "công văn đang đọc dở" để nút "← Về công văn" không hiện sai chỗ.
  useEffect(() => { if (!docBen) setTkTruoc(null); }, [docBen]);

  const doiVanBan = (ma: string) => {
    if (ma === maVb) return;
    setMaVb(ma); setChon(null); setMoChuong({}); setXemPhuLuc(false);
  };
  const moDieu = (ma: string, so: number, khoan?: number) => {
    setKhoanSang(khoan ?? null);
    {
      const q = tim.trim();
      if (q.length >= 2 && !docSoDieu(kd(q))) setDaTim((ds) => {
        const m = [q, ...ds.filter((x) => kd(x) !== kd(q))].slice(0, 6);
        try { localStorage.setItem('luat-da-tim', JSON.stringify(m)); } catch { /* */ }
        return m;
      });
    }
    {
      const v = cacVb[ma]; const d = v?.dieu.find((x) => x.so === so);
      const k0 = kho.find((x) => x.ma === ma);
      const muc = { ma, so, nhan: nhanNgan(ma, v?.soHieu || k0?.soHieu || ''), tieuDe: d?.tieuDe || '' };
      setGanDay((g) => { const m = [muc, ...g.filter((x) => !(x.ma === ma && x.so === so))].slice(0, 8); try { localStorage.setItem('luat-gan-day', JSON.stringify(m)); } catch { /* */ } return m; });
    }
    if (ma !== maVb) { setMaVb(ma); setMoChuong({}); }
    setDocTk(null); setTkTruoc(null);       // mở hẳn một điều thì đóng ngăn đọc công văn
    setXemPhuLuc(false); setChon(so); setThe('luat');
    setMoDs(false);        // điện thoại: chọn xong thì thu danh sách, nhường màn hình cho nội dung
    setCuonToi((n) => n + 1);   // cuộn tới điều SAU khi vẽ xong (xem effect cuonToi)
  };
  // Cuộn ngay lúc bấm thì điều chưa kịp hiện, danh sách chưa kịp thu → chỗ dừng lệch hẳn (mở bằng đường dẫn: trang đứng yên ở đầu).
  // Effect chạy SAU khi trang đã vẽ xong nên cuộn luôn được; 0,4 giây sau canh lại một lần (nội dung tải sau làm xê dịch). Không
  // dùng requestAnimationFrame: thẻ trình duyệt đang ẩn (mở đường dẫn ở thẻ nền) thì nó không chạy. Khung nội dung có scroll-mt để
  // không bị ô tìm dính trên đầu che mất tiêu đề điều.
  useEffect(() => {
    if (!cuonToi) return;
    const cuon = () => oNoiDung.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    cuon();
    const t = window.setTimeout(cuon, 400);
    return () => window.clearTimeout(t);
  }, [cuonToi]);
  // ĐƯỜNG DẪN TỚI TỪNG ĐIỀU (đợt 14, 11/10/2026): /tra-cuu-luat?vb=ldd2024&d=78&k=2 mở thẳng Điều 78 khoản 2 — lưu dấu trang, gửi
  // cho đồng nghiệp (người nhận vẫn phải đăng nhập, có quyền mới xem được). Đổi điều đang đọc thì đường dẫn trên thanh địa chỉ đổi
  // theo (thay tại chỗ, không chồng thêm lịch sử).
  useEffect(() => {
    if (!duocXem || daMoLink.current) return;
    daMoLink.current = true;
    let sp: URLSearchParams;
    try { sp = new URLSearchParams(window.location.search); } catch { return; }
    const ma = sp.get('vb'), so = Number(sp.get('d')), k = Number(sp.get('k')) || undefined;
    if (!ma || !/^[a-z0-9-]+$/.test(ma) || !(so > 0)) return;
    taiVb(ma).then(() => moDieu(ma, so, k)).catch(() => {});
  }, [duocXem]);
  useEffect(() => {
    if (!daMoLink.current) return;
    try {
      const u = new URL(window.location.href);
      if (chon != null) {
        u.searchParams.set('vb', maVb); u.searchParams.set('d', String(chon));
        if (khoanSang) u.searchParams.set('k', String(khoanSang)); else u.searchParams.delete('k');
      } else { u.searchParams.delete('vb'); u.searchParams.delete('d'); u.searchParams.delete('k'); }
      const moi = u.pathname + u.search + u.hash;
      if (moi !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', moi);
    } catch { /* */ }
  }, [maVb, chon, khoanSang]);
  // PHÍM TẮT MÁY TÍNH (đợt 15, 11/10/2026): "/" hoặc Ctrl+K → vào ô tìm; ← / → → điều trước / sau của văn bản đang đọc. Bỏ qua khi
  // con trỏ đang ở ô gõ chữ / ô chọn (để gõ chữ, chọn văn bản bình thường) hay đang giữ phím Alt (Alt+← là "quay lại" của trình duyệt).
  useEffect(() => {
    const nghe = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const dangGo = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); oTim.current?.focus(); oTim.current?.select(); return; }
      if (dangGo || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === '/') { e.preventDefault(); oTim.current?.focus(); oTim.current?.select(); return; }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && the === 'luat' && vb && chon != null) {
        const i = vb.dieu.findIndex((d) => d.so === chon);
        const j = e.key === 'ArrowLeft' ? i - 1 : i + 1;
        if (i >= 0 && j >= 0 && j < vb.dieu.length) { e.preventDefault(); moDieu(vb.ma, vb.dieu[j].so); }
      }
    };
    window.addEventListener('keydown', nghe);
    return () => window.removeEventListener('keydown', nghe);
  });
  // Đang ở thẻ nào thì mở kiểu đó: ở "Toàn văn" thì nhảy tới điều luôn; ở sơ đồ, tình
  // huống, thẻ học thì mở NGĂN BÊN để không mất chỗ đang xem.
  const moDieuHopLy = (ma: string, so: number) => {
    if (the === 'luat') moDieu(ma, so);
    else { taiVb(ma).catch(() => {}); setDocBen({ ma, so }); }
  };

  // CÁCH TÔ VÀNG (đợt 7, 11/10/2026). Tiếng Việt: một TỪ thường gồm 2 tiếng ("thu hồi", "quốc phòng") → tô từng TIẾNG rời là rối
  // (gõ "quốc phòng thu hồi" từng chỉ tô mỗi chữ "phòng", cả trong "phòng hộ"; gõ "hạn mức giao đất ở" thì vàng rực chữ "đất").
  // Nay với MỖI ĐIỀU: phủ các tiếng đã gõ bằng những CỤM LIỀN dài nhất có mặt trong điều đó (→ tô "thu hồi" + "quốc phòng"); điều có
  // nguyên cụm thì chỉ tô cụm; tiếng lẻ còn sót mới tô riêng, và chỉ khi nó HIẾM (có mặt ≤ 25 % số điều của văn bản — "đất" trong
  // Luật Đất đai thì không). Gõ cách gọi đời thường ("sổ đỏ") thì tô cả chữ của luật ("giấy chứng nhận").
  const cachTo = useMemo(() => {
    const q = timHL.q;
    if (!q || q.length < 2 || docSoDieu(kd(q))) return null;   // tìm theo số điều thì không tô chữ
    const ds = chiMuc[maVb] || [];
    return [q, ...(moRong ? [moRong.cau] : [])].map((cau) => {
      const bk = boKhop(cau), n = bk.tu.length;
      const cum: { i: number; j: number; chu: string; re: RegExp }[] = [];   // cụm liền từ tiếng i tới j-1, cụm dài trước
      for (let dai = n; dai >= 2; dai--) for (let i = 0; i + dai <= n; i++) {
        const chu = bk.tu.slice(i, i + dai).join(' ');
        cum.push({ i, j: i + dai, chu, re: new RegExp('(?:^|[^\\p{L}\\p{N}])(' + bk.tu.slice(i, i + dai).map(escRe).join('[^\\p{L}\\p{N}]+') + ')(?=$|[^\\p{L}\\p{N}])', 'u') });
      }
      const hiem = bk.tu.map((w, i) => {
        if (w.length < 2) return false;
        if (n < 2 || !ds.length) return true;
        let c = 0;
        for (const x of ds) if ((bk.dau ? x.tuD : x.tuK).has(w)) c++;
        return c / ds.length <= 0.25;
      });
      return { bk, cum, hiem };
    });
  }, [timHL, moRong, chiMuc, maVb]);
  // Chữ cần tô cho MỘT điều (mỗi nhóm một danh sách: chữ đã gõ / chữ của luật), chữ dài trước.
  const phuDieu = (x: MucChi | undefined): string[][] | null => {
    if (!cachTo || !x) return null;
    return cachTo.map((g) => {
      const so = g.bk.dau ? x.khoD : x.kho, n = g.bk.tu.length, bang = g.bk.dau ? x.tuD : x.tuK;
      if (n === 1) return [g.bk.cum];
      const phu: boolean[] = new Array(n).fill(false), ra: string[] = [];
      for (const c of g.cum) {
        let moi = false;
        for (let k = c.i; k < c.j; k++) if (!phu[k]) { moi = true; break; }
        if (!moi) continue;
        let du = true;
        for (let k = c.i; k < c.j; k++) if (!bang.has(g.bk.tu[k])) { du = false; break; }
        if (!du || !c.re.test(so)) continue;
        ra.push(c.chu);
        for (let k = c.i; k < c.j; k++) phu[k] = true;
      }
      g.bk.tu.forEach((w, i) => { if (!phu[i] && g.hiem[i] && bang.has(w)) ra.push(w); });
      return [...new Set(ra)].sort((a, b) => b.length - a.length);
    });
  };
  // Điều đang đọc, và 80 kết quả đầu (dòng trích) — tính sẵn một lần.
  const toCuaDieu = useMemo(() => {
    if (!cachTo || !dieuDangXem || !vb) return null;
    return phuDieu((chiMuc[vb.ma] || []).find((y) => y.d.so === dieuDangXem.so));
  }, [cachTo, dieuDangXem, vb, chiMuc]);
  const toKetQua = useMemo(() => {
    const ra = new Map<string, string[][] | null>();
    if (cachTo) for (const x of ketQuaHien.slice(0, 80)) ra.set(x.ma + ':' + x.d.so, phuDieu(x));
    return ra;
  }, [cachTo, ketQuaHien]);
  // Tô vàng chỗ khớp từ khoá trong nguyên văn (chỉ tô, không đổi chữ). Chỉ tô khi trọn tiếng (hai bên là ranh giới chữ); gõ có dấu
  // thì so có dấu. Chữ không dấu / chữ thường và chữ gốc (NFC) dài bằng nhau từng ký tự nên dùng chung vị trí.
  const toVang = (chu: string, to: string[][] | null = toCuaDieu) => {
    if (!cachTo || !to || !chu) return chu;
    const goc = chu.normalize('NFC'), D = thuongDau(goc), K = kd(goc);
    // Tìm MỌI chỗ khớp (cụm nhiều tiếng: giữa các tiếng chấp nhận dấu câu / nhiều khoảng trắng). Chỗ chồng nhau thì giữ chỗ bắt
    // đầu trước; cùng chỗ bắt đầu thì giữ chỗ dài hơn.
    const doan: [number, number][] = [];
    cachTo.forEach((g, gi) => {
      const k = g.bk.dau ? D : K;
      for (const w of to[gi] || []) {
        const re = new RegExp('(^|[^\\p{L}\\p{N}])(' + w.split(' ').map(escRe).join('[^\\p{L}\\p{N}]+') + ')(?=$|[^\\p{L}\\p{N}])', 'gu');
        let m: RegExpExecArray | null;
        while ((m = re.exec(k))) { const a = m.index + m[1].length; doan.push([a, a + m[2].length]); }
      }
    });
    if (!doan.length) return chu;
    doan.sort((x, y) => x[0] - y[0] || (y[1] - y[0]) - (x[1] - x[0]));
    const ra: React.ReactNode[] = [];
    let tu0 = 0;
    for (const [a, b] of doan) {
      if (a < tu0) continue;
      if (a > tu0) ra.push(goc.slice(tu0, a));
      ra.push(<mark key={'v' + a} className="rounded bg-amber-200 px-0.5">{goc.slice(a, b)}</mark>);
      tu0 = b;
    }
    ra.push(goc.slice(tu0));
    return ra;
  };

  // ── LIÊN KẾT TRONG CHỮ LUẬT ─────────────────────────────────────────────
  // Chữ luật nhắc tới điều khác suốt ("theo quy định tại Điều 137 của Luật này",
  // "Chính phủ quy định chi tiết", "Nghị định số 88/2024/NĐ-CP"). Ở đây biến mấy chỗ
  // đó thành NÚT BẤM ĐƯỢC để nhảy thẳng, khỏi phải cuộn tìm. Chữ hiện ra GIỮ NGUYÊN
  // từng ký tự — chỉ gạch chân, không thêm bớt chữ nào.
  const docTheoSoHieu = (so: string) => kho.find((x) => x.soHieu === so);

  // Nút dẫn nguồn dùng chung cho mọi chỗ (tình huống, sơ đồ, khung liên kết). Học của
  // NotebookLM: câu nào cũng phải chỉ được ra chỗ lấy, bấm một cái là tới nguyên văn.
  // Điều đích đã HẾT HIỆU LỰC thì nút phải tự nói ra. Bộ soát liên kết tìm ra 26 chỗ
  // dẫn tới điều đã bị bãi bỏ — bấm vào đọc rồi làm theo là hỏng cả bộ hồ sơ.
  const dichHetHieuLuc = (d: Dan) =>
    !!d.so && cacVb[d.ma]?.dieu.find((z) => z.so === d.so)?.tinhTrang?.loai === 'het-hieu-luc';
  const NutDan = ({ d, nho }: { d: Dan; nho?: boolean }) => {
    // Văn bản THAM KHẢO (công văn): nút màu vàng, bấm là mở ngăn đọc công văn — không lẫn với văn bản luật.
    const tk = vbBth[d.ma]?.tinhTrang === 'tham-khao' ? vbBth[d.ma] : null;
    if (tk) return (
      <button onClick={() => moTk(d.ma)} title={`${tk.ten} — văn bản tham khảo, KHÔNG phải văn bản luật`}
        className={`rounded-md border border-amber-200 bg-amber-50 font-semibold text-amber-800 transition hover:border-amber-500 ${nho ? 'px-1.5 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[11.5px]'}`}>
        📨 {tk.nhan}{tk.tinh ? ` · ${tk.tinh}` : ''}
      </button>
    );
    const v = kho.find((x) => x.ma === d.ma);
    const bo = dichHetHieuLuc(d);
    return (
      <button onClick={() => { if (d.so) moDieuHopLy(d.ma, d.so); else { doiVanBan(d.ma); setThe('luat'); } }}
        title={bo ? `ĐIỀU NÀY ĐÃ HẾT HIỆU LỰC — ${v ? v.ten : d.ma}` : (v ? `${v.ten} — ${v.soHieu}` : d.ma)}
        className={`rounded-md border font-semibold transition hover:border-[#0A2540] ${bo ? 'border-rose-200 bg-rose-50 text-rose-500 line-through decoration-rose-300' : 'border-slate-200 bg-white text-slate-600 hover:text-[#0A2540]'} ${nho ? 'px-1.5 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[11.5px]'}`}>
        {bo ? '⛔ ' : ''}{d.so ? `Điều ${d.so}` : '📄'} · {v ? nhanNgan(v.ma, v.soHieu) : d.ma}
      </button>
    );
  };

  const noiDung = (chu: string): React.ReactNode => {
    if (!chu) return chu;
    const ra: React.ReactNode[] = [];
    const re = new RegExp(RE_DAN.source, 'g');
    let i = 0, m: RegExpExecArray | null;
    while ((m = re.exec(chu)) !== null) {
      if (m.index > i) ra.push(<span key={`t${i}`}>{toVang(chu.slice(i, m.index))}</span>);
      let maDich = '', soDich: number | null = null;
      if (m[1] && m[2]) {                       // Điều N của Nghị định số X
        const d = docTheoSoHieu(m[2]);
        if (d) { maDich = d.ma; soDich = Number(m[1]); }
      } else if (m[3]) {                        // Điều N của Luật/Nghị định này
        const s = Number(m[3]);
        if (vb && vb.dieu.some((d) => d.so === s)) { maDich = maVb; soDich = s; }
      } else if (m[4]) {                        // số hiệu đứng một mình
        const d = docTheoSoHieu(m[4]);
        if (d && d.ma !== maVb) maDich = d.ma;
      } else if (m[5]) {                        // "Điều N của Luật Đất đai" (không ghi số hiệu)
        const md = luatDatDaiLucDo(vb?.ngay || '', m[6]);
        const s = Number(m[5]);
        if (md !== maVb && kho.some((x) => x.ma === md)) { maDich = md; soDich = s; }
      }
      if (maDich) {
        const md = maDich, sd2 = soDich;
        ra.push(
          <button key={`l${m.index}`}
            onClick={(e) => {
              if (!sd2) { doiVanBan(md); return; }
              taiVb(md).catch(() => {});
              const r = (e.target as HTMLElement).getBoundingClientRect();
              setXemNhanh({ ma: md, so: sd2, x: r.left, y: r.bottom });
            }}
            title={sd2 ? `Xem nhanh Điều ${sd2}` : 'Mở văn bản này'}
            className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:decoration-sky-600">
            {m[0]}
          </button>,
        );
      } else {
        ra.push(<span key={`p${m.index}`}>{toVang(m[0])}</span>);
      }
      i = m.index + m[0].length;
    }
    ra.push(<span key="cuoi">{toVang(chu.slice(i))}</span>);
    return ra;
  };

  // ── KHUNG "VĂN BẢN THAM KHẢO NHẮC TỚI ĐIỀU NÀY" ──
  // Công văn hướng dẫn, giải đáp (của bộ, của sở tỉnh khác) trích điều này, hoặc người làm web thấy nên
  // đọc kèm. Màu vàng, ghi rõ "tham khảo — không phải văn bản luật" để không bao giờ lẫn với nguyên văn.
  // Chỗ nào công văn báo điều này đã đổi hiệu lực mà văn bản làm thay đổi CHƯA có trong kho thì hiện
  // khung đỏ "cần kiểm" — máy không tự đánh dấu hết hiệu lực khi chưa có nguyên văn để kiểm.
  const veThamKhaoDieu = (ma: string, so: number) => {
    const ds = bth?.theoDieu[`${ma}:${so}`];
    if (!ds?.length) return null;
    return (
      <div className="mt-2 rounded-xl border-l-4 border-amber-400 bg-amber-50/70 px-2.5 py-2">
        {/* THU MỘT DÒNG (đợt 25) — nhưng công văn báo điều này CẦN KIỂM HIỆU LỰC thì luôn hiện chữ đỏ ngay dòng đầu */}
        <button onClick={() => setMoThamKhao((v) => !v)} className="flex w-full items-start justify-between gap-2 text-left">
          <span className="text-[12.5px] font-bold leading-snug text-amber-900">
            📨 {ds.length} văn bản hướng dẫn, giải đáp nhắc tới điều này
            {!moThamKhao && ds.some((z) => z.canh) && <span className="ml-1 font-extrabold text-rose-700">· ❓ có văn bản báo cần kiểm hiệu lực</span>}
          </span>
          <span className="shrink-0 text-[12px] font-bold text-amber-800">{moThamKhao ? '▴' : '▾'}</span>
        </button>
        {moThamKhao && <>
        <p className="text-[11px] leading-snug text-amber-800/80">Chỉ để tham khảo — không phải văn bản luật; văn bản của tỉnh khác không bắt buộc ở Khánh Hòa.</p>
        {ds.map((z, i) => {
          const v = vbBth[z.ma];
          const trich = z.trich?.find((s) => /hết hiệu lực/.test(s)) || z.trich?.[0];
          return (
            <div key={i} className="mt-1.5 rounded-lg bg-white/90 px-2 py-1.5">
              <p className="text-[12px] font-semibold leading-snug text-slate-700">
                {v ? v.nhan : z.ma}{v?.tinh ? ` · tỉnh ${v.tinh}` : ''}{v?.ngay ? ` · ${ngayVn(v.ngay)}` : ''}
                <span className="font-normal text-slate-500"> — {z.kieu === 'trich-dan' ? `có trích${z.khoan ? ` khoản ${z.khoan}` : ''} điều này` : 'liên quan, nên đọc kèm'}</span>
              </p>
              {z.canh && z.luuY && (
                <p className="mt-1 rounded-md border border-rose-300 bg-rose-50 px-1.5 py-1 text-[11.5px] font-semibold leading-snug text-rose-800">
                  ❓ Cần kiểm hiệu lực: {z.luuY}
                </p>
              )}
              {trich && (
                <p className="mt-1 line-clamp-4 border-l-2 border-amber-300 pl-2 text-[12px] italic leading-snug text-slate-600">“{trich}”</p>
              )}
              {!z.canh && z.luuY && <p className="mt-1 text-[11.5px] leading-snug text-slate-500">💡 Lưu ý (không phải chữ luật): {z.luuY}</p>}
              {z.lyDo && <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">💡 {z.lyDo}</p>}
              <button onClick={() => moTk(z.ma)}
                className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11.5px] font-bold text-amber-800 hover:border-amber-500">
                📨 Đọc công văn
              </button>
            </div>
          );
        })}
        </>}
      </div>
    );
  };

  // Đang đọc công văn mà bấm sang một điều luật nó dẫn: ở "Toàn văn" thì nhảy thẳng tới điều đó;
  // ở chỗ khác thì mở ngăn đọc điều luật, kèm nút "← Về công văn" để quay lại.
  const moDieuTuTk = (ma: string, so: number) => {
    const tu = docTk;
    setDocTk(null);
    if (the === 'luat') { moDieu(ma, so); return; }
    taiVb(ma).catch(() => {});
    setTkTruoc(tu); setDocBen({ ma, so });
  };

  // Chữ công văn: CHỈ biến đúng những cụm dẫn chiếu đã khai (danChieu.chu) thành nút bấm — không đoán.
  // Chữ hiện ra giữ nguyên từng ký tự.
  const noiDungTk = (chu: string, v: VbThamKhao): React.ReactNode => {
    const ds = v.danChieu.filter((z) => z.ma && z.so && chu.includes(z.chu));
    if (!ds.length) return chu;
    const re = new RegExp(ds.map((z) => z.chu).sort((a, b) => b.length - a.length).map(escRe).join('|'), 'g');
    const ra: React.ReactNode[] = [];
    let i = 0, m: RegExpExecArray | null;
    while ((m = re.exec(chu)) !== null) {
      if (m.index > i) ra.push(chu.slice(i, m.index));
      const z = ds.find((y) => y.chu === m![0])!;
      // Dùng <span> chứ không dùng <button>: nút luôn đứng thành một khối riêng, cụm dài bị đẩy xuống
      // dòng mới làm câu văn đứt khúc; span thì chữ chảy liền như đọc sách.
      ra.push(
        <span key={m.index} role="button" tabIndex={0} onClick={() => moDieuTuTk(z.ma!, z.so!)}
          onKeyDown={(e) => { if (e.key === 'Enter') moDieuTuTk(z.ma!, z.so!); }} title={`Mở Điều ${z.so} trong kho`}
          className="cursor-pointer font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:decoration-sky-600">{m[0]}</span>);
      i = m.index + m[0].length;
    }
    ra.push(chu.slice(i));
    return ra;
  };

  // ── THẺ MỘT VĂN BẢN trong bộ tổng hợp ── gọn một khối; bấm vào thì mở chi tiết ngay tại chỗ.
  const veTheVb = (x: VbBth, soDieuCd?: number) => {
    const mo = !!moVb[x.ma];
    const laTk = x.tinhTrang === 'tham-khao';
    const nhanTt = laTk ? `Tham khảo${x.tinh ? ` · ${x.tinh}` : ''}` : x.tinhTrang === 'het-hieu-luc' ? 'Hết hiệu lực'
      : x.tinhTrang === 'sua-doi-mot-phan' ? 'Còn hiệu lực · có phần bị sửa' : 'Còn hiệu lực';
    return (
      <div key={x.ma} className={`overflow-hidden rounded-xl border bg-white ${laTk ? 'border-amber-200' : 'border-slate-200'}`}>
        <button onClick={() => setMoVb((m) => ({ ...m, [x.ma]: !m[x.ma] }))} className="block w-full px-2.5 py-2 text-left">
          <span className="flex items-start gap-1.5">
            <span className="min-w-0 flex-1">
              <span className={`block text-[13px] font-bold leading-snug ${x.tinhTrang === 'het-hieu-luc' ? 'text-slate-500' : 'text-[#0A2540]'}`}>
                {x.nhan}
                {!x.nhan.includes(x.soHieu) && <span className="ml-1 text-[11.5px] font-normal text-slate-400">{x.soHieu}</span>}
              </span>
              {/* line-clamp tự đặt kiểu hiển thị riêng — KHÔNG kèm "block" (đè mất, chữ không cắt). */}
              <span className={`mt-0.5 text-[12px] leading-snug text-slate-600 ${mo ? 'block' : 'line-clamp-2'}`}>{x.ten}</span>
            </span>
            <span className="shrink-0 pt-0.5 text-[12px] text-slate-400">{mo ? '▾' : '▸'}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
            <span className={`rounded-full border px-1.5 py-px font-semibold ${MAU_TT[x.tinhTrang]}`}>{bth?.tinhTrang[x.tinhTrang]?.icon} {nhanTt}</span>
            <span className="text-slate-500">{x.coQuan}</span>
            <span className="text-slate-400">· {ngayVn(x.ngay)}</span>
            {x.soDieu ? <span className="text-slate-400">· {x.soDieu} điều</span> : null}
            {soDieuCd ? <span className="rounded-full bg-sky-50 px-1.5 font-semibold text-sky-700">{soDieuCd} điều về chủ đề này</span> : null}
            {x.canKiemTra?.length ? <span className="rounded-full bg-rose-50 px-1.5 font-semibold text-rose-700">❓ cần kiểm</span> : null}
          </span>
        </button>
        {mo && (
          <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/60 px-2.5 py-2 text-[12px] leading-snug text-slate-600">
            <p><b className="text-slate-700">Tình trạng:</b> {x.tinhTrangChu}</p>
            {x.canKiemTra?.map((c, i) => (
              <p key={i} className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 font-semibold text-rose-800">
                ❓ Điều {c.dieu}{c.khoan ? ` khoản ${c.khoan}` : ''}: {c.ghi}
              </p>
            ))}
            <p className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span><b className="text-slate-700">Ban hành:</b> {ngayVn(x.ngay)}</span>
              {!laTk && <span><b className="text-slate-700">Hiệu lực:</b> {x.ngayHieuLuc ? ngayVn(x.ngayHieuLuc) : 'chưa ghi được ngày'}</span>}
              {x.nguoiKy && <span><b className="text-slate-700">Người ký:</b> {x.nguoiKy}</span>}
            </p>
            {!laTk && x.hieuLucNguyenVan && (
              <p className="text-[11.5px] italic text-slate-500">Câu hiệu lực (nguyên văn): “{x.hieuLucNguyenVan}”</p>
            )}
            {TEN_QH.filter(([k]) => (x.quanHe?.[k]?.length || 0) > 0).map(([k, nhan]) => (
              <div key={k} className="flex flex-wrap items-center gap-1">
                <b className="text-slate-700">{nhan}:</b>{x.quanHe![k].map((m2) => <NutDan key={m2} d={{ ma: m2 }} nho />)}
              </div>
            ))}
            {x.chuDe.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <b className="text-slate-700">Chủ đề chính:</b>
                {x.chuDe.map((c) => (
                  <button key={c.ten} onClick={() => setLocCd(c.ten)} title="Lọc bộ tổng hợp theo chủ đề này"
                    className="rounded-full border border-slate-200 bg-white px-1.5 py-px text-[11px] font-semibold text-slate-600 hover:border-[#0A2540]">
                    {c.icon} {c.ten}{c.soDieu ? ` · ${c.soDieu}` : ''}
                  </button>
                ))}
              </div>
            )}
            {x.chang.length > 0 && bth && (
              <div className="flex flex-wrap items-center gap-1">
                <b className="text-slate-700">Chặng lộ trình học:</b>
                {x.chang.slice(0, 5).map((c) => {
                  const cg = bth.chang.find((z) => z.so === c.so);
                  return cg ? (
                    <span key={c.so} className="rounded-full bg-white px-1.5 py-px text-[11px] text-slate-600 ring-1 ring-slate-200">
                      {cg.icon} {c.so + 1}. {cg.ten}{c.soDieu ? ` · ${c.soDieu} điều` : ''}
                    </span>
                  ) : null;
                })}
                {x.chang.length > 5 && <span className="text-[11px] text-slate-400">+{x.chang.length - 5}</span>}
              </div>
            )}
            {laTk && x.tom && (
              <p className="rounded-md border border-dashed border-sky-300 bg-sky-50/70 px-2 py-1">
                <b className="text-sky-800">💡 Tóm tắt (không phải văn bản luật):</b> {x.tom}
              </p>
            )}
            {laTk && (x.nhacToiNgoaiKho?.length || 0) > 0 && (
              <p><b className="text-slate-700">Nhắc tới văn bản chưa có trong kho:</b> {x.nhacToiNgoaiKho!.join(' · ')}</p>
            )}
            <p className="text-[11px] text-slate-400">
              {laTk ? (x.nguonChu === 'may-doc-anh-quet'
                ? 'Bản quét — chữ do máy đọc từ ảnh rồi người soát lại; trích dẫn chính thức phải đối chiếu ảnh bản gốc.'
                : 'Chữ lấy thẳng từ lớp chữ của bản PDF gốc.') : (x.nguon ? `Nguồn chữ: ${x.nguon}` : '')}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {laTk ? (
                <button onClick={() => moTk(x.ma)} className="rounded-lg bg-amber-600 px-2.5 py-1 text-[12px] font-bold text-white">📨 Đọc công văn</button>
              ) : (
                <button onClick={() => { doiVanBan(x.ma); setThe('luat'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="rounded-lg bg-[#0A2540] px-2.5 py-1 text-[12px] font-bold text-white">⚖️ Mở toàn văn</button>
              )}
              {x.banGoc && (
                <a href={x.banGoc} target="_blank" rel="noreferrer"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">📄 Bản gốc (PDF)</a>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const chep = (d: Dieu) => {
    const t = `Điều ${d.so}. ${d.tieuDe}\n` + d.khoan.map((k) =>
      (k.so ? `${k.so}. ` : '') + k.chu + (k.diem.length ? '\n' + k.diem.map((x) => `${x.ky}) ${x.chu}`).join('\n') : '')).join('\n')
      + `\n\n(${vb?.ten} — ${vb?.soHieu})`;
    navigator.clipboard?.writeText(t).then(() => { setDaChep('chu'); setTimeout(() => setDaChep(''), 1800); }).catch(() => {});
  };
  // Thanh "Kết quả i/N · ‹ Trước · Sau ›" khi điều đang đọc nằm trong kết quả tìm / lọc (đợt 17–18) — vẽ ở đầu và cuối bài.
  const thanhKetQua = (lop: string) => {
    if (!(tim.trim() || chiGhim || chiGt) || !vb || !dieuDangXem) return null;
    const i = ketQuaHien.findIndex((x) => x.ma === vb.ma && x.d.so === dieuDangXem.so);
    if (i < 0 || ketQuaHien.length < 2) return null;
    const mo = (j: number) => { const x = ketQuaHien[j]; if (x) moDieu(x.ma, x.d.so, khoanKhop(x.ma, x.d.so)); };
    return (
      <div className={`${lop} flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600`}>
        <span className="min-w-0 flex-1 truncate">🔎 Kết quả <b className="text-[#0A2540]">{i + 1}/{ketQuaHien.length}</b>{tim.trim() ? <> cho “{tim.trim()}”</> : null}</span>
        <button disabled={i === 0} onClick={() => mo(i - 1)}
          className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold text-[#0A2540] disabled:opacity-40">‹ Trước</button>
        <button disabled={i >= ketQuaHien.length - 1} onClick={() => mo(i + 1)}
          className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold text-[#0A2540] disabled:opacity-40">Sau ›</button>
      </div>
    );
  };
  // Gửi đường dẫn tới điều đang đọc: điện thoại mở bảng chia sẻ (Zalo, Messenger…); máy tính chép đường dẫn.
  const guiLink = async (d: Dieu) => {
    const url = `${window.location.origin}/tra-cuu-luat?vb=${encodeURIComponent(maVb)}&d=${d.so}`;
    const ten = `Điều ${d.so}. ${d.tieuDe} — ${nhanNgan(maVb, vb?.soHieu || '')}`;
    const dienThoai = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (dienThoai && typeof navigator.share === 'function') { try { await navigator.share({ title: ten, url }); } catch { /* người dùng huỷ */ } return; }
    try { await navigator.clipboard.writeText(ten + '\n' + url); setDaChep('link'); setTimeout(() => setDaChep(''), 1800); } catch { /* */ }
  };

  if (loading) return <div className="p-6 text-slate-500">Đang kiểm tra quyền…</div>;
  if (!duocXem) return (
    <div className="mx-auto max-w-lg p-6 text-center">
      <p className="text-4xl">🔒</p>
      <h1 className="mt-2 text-lg font-bold text-[#0A2540]">Mục này chỉ dành cho quản trị viên</h1>
      <p className="mt-1 text-sm text-slate-500">Hãy đăng nhập bằng tài khoản có quyền quản trị.</p>
      <Link href="/tien-ich" className="mt-4 inline-block rounded-lg border px-4 py-2 text-sm font-semibold text-[#0A2540]">← Về Tiện ích</Link>
    </div>
  );

  const tongDieu = kho.reduce((s, x) => s + x.soDieu, 0);

  return (
    <div className="mx-auto max-w-6xl px-3 pb-24 pt-3 sm:px-4 lg:pb-4 lg:pt-4">
      {/* Điện thoại: tên trang + số liệu gộp vào MỘT DÒNG. Máy tính vẫn để hai dòng như cũ. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="text-[16px] font-extrabold text-[#0A2540] sm:text-2xl">⚖️ Luật Đất đai</h1>
        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Nội bộ</span>
        <span className="text-[11.5px] text-slate-500 lg:hidden">
          {kho.length ? <>{kho.length} văn bản · {tongDieu} điều{dsTk.length ? ` · ${dsTk.length} tham khảo` : ''}</> : 'Đang tải…'}
        </span>
      </div>
      <p className="mt-1 hidden text-[12.5px] leading-snug text-slate-500 lg:block">
        {kho.length ? <><b className="text-[#0A2540]">{kho.length} văn bản</b> · <b className="text-[#0A2540]">{tongDieu} điều</b> · nguyên văn từ bản PDF ký số Công báo{dsTk.length ? <> · <b className="text-amber-700">{dsTk.length} văn bản tham khảo</b> (công văn hướng dẫn, giải đáp)</> : null}</> : 'Đang tải…'}
      </p>

      {/* Màn hình điện thoại 390px không đủ cho 4 thẻ -> cho TRƯỢT NGANG, đừng để xuống
          dòng thành hai hàng chen chúc. -mx-3 px-3 để vuốt được sát mép máy. */}
      <div className="mt-3 -mx-3 hidden gap-1.5 overflow-x-auto px-3 pb-1 lg:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([['tinhhuong', '🧭 Tình huống'], ['luat', '⚖️ Toàn văn'],
           ['the', `🎴 Thẻ ôn tập${theHomNay.length ? ` (${theHomNay.length})` : ''}`],
           ['sodo', '🧠 Sơ đồ'],
           ['danhmuc', '📚 Danh mục']] as const).map(([k, l]) => (
          <button key={k} onClick={() => {
            if (k === 'the') { setThe('sodo'); setCheDoHoc('the'); }
            else if (k === 'sodo') { setThe('sodo'); setCheDoHoc('sodo'); }
            else setThe(k);
          }}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${(k === 'the' ? the === 'sodo' && cheDoHoc === 'the' : k === 'sodo' ? the === 'sodo' && cheDoHoc === 'sodo' : the === k) ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{l}</button>
        ))}
      </div>

      {/* ── TÌNH HUỐNG: đi theo VIỆC THẬT, mỗi bước một câu hỏi, có nhánh trả lời ──
          Đây là cách người làm nghề dùng luật: không ai đọc từ Điều 1 tới Điều 260, mà
          bắt đầu từ "tôi đang gặp chuyện gì". Mỗi bước đều kèm nút dẫn tới điều gốc. */}
      {the === 'tinhhuong' && (
        <div className="mt-3">
          {!th ? <p className="text-slate-400">Đang tải…</p> : !thChon ? (
            <>
              <p className="text-[12.5px] leading-snug text-slate-500">
                Chọn đúng chuyện bạn đang gặp. Mỗi tình huống là một chuỗi câu hỏi — trả lời tới đâu,
                luật chỉ tới đó.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {th.ds.map((x) => (
                  <button key={x.ma} onClick={() => setThChon(x.ma)}
                    className="rounded-2xl border-2 border-slate-200 bg-white p-3 text-left transition hover:border-[#0A2540]">
                    <p className="text-[15px] font-extrabold leading-snug text-[#0A2540]">{x.icon} {x.ten}</p>
                    <p className="mt-1 hidden text-[12.5px] leading-snug text-slate-500 lg:block">{x.tom}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{x.buoc.length} bước</span>
                      {x.bang && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">📑 đủ {x.bang.dong.length} trường hợp</span>}
                      {x.hoSo && <span className="rounded-full bg-[#0A2540]/10 px-2 py-0.5 text-[#0A2540]">📋 {x.hoSo.gom.length} giấy tờ</span>}
                      {x.vuongMac && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600">⚠️ {x.vuongMac.length} chỗ hay vướng</span>}
                    </p>
                  </button>
                ))}
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] leading-snug text-slate-500">{th.canhBao}</p>
            </>
          ) : (() => {
            const x = th.ds.find((k) => k.ma === thChon)!;
            return (
              <>
                <button onClick={() => setThChon('')} className="text-[12.5px] font-semibold text-slate-500 hover:text-[#0A2540]">← Chọn tình huống khác</button>
                <h2 className="mt-1.5 text-[17px] font-extrabold leading-snug text-[#0A2540]">{x.icon} {x.ten}</h2>
                <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{x.tom}</p>

                {/* ── BẢNG LIỆT KÊ ĐẦY ĐỦ ── dùng cho 16 trường hợp đăng ký biến động.
                    Bày kiểu THẺ chứ không kiểu bảng ngang, vì trên điện thoại bảng ngang
                    phải kéo qua kéo lại, đọc rất mệt. */}
                {x.bang && (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-extrabold text-[#0A2540]">{x.bang.nhan}</p>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11.5px] font-bold text-rose-700">
                        {x.bang.dong.filter((z) => z.batBuoc30).length} trường hợp bị ép 30 ngày
                      </span>
                    </div>
                    <p className="mt-1 rounded-xl bg-amber-50 px-2.5 py-2 text-[12px] leading-snug text-amber-900">{x.bang.ghiChu}</p>
                    <div className="mt-2 space-y-1.5">
                      {x.bang.dong.map((r) => (
                        <div key={r.diem}
                          className={`rounded-xl border-2 p-2.5 ${r.batBuoc30 ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-[13px] font-extrabold ${r.batBuoc30 ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{r.diem}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13.5px] font-bold leading-snug text-[#0A2540]">{r.ten}</p>
                              <p className="mt-0.5 text-[12.5px] leading-snug text-slate-600">{r.moTa}</p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
                                <span className={`rounded-full px-2 py-0.5 font-bold ${r.batBuoc30 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                  {r.batBuoc30 ? '⏰ Phải đăng ký trong 30 ngày' : 'Không bị ép 30 ngày'}
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">⏱ {r.thoiHan}</span>
                              </div>
                              {r.thoiHanThem && <p className="mt-1 text-[12px] leading-snug text-slate-500">↳ {r.thoiHanThem}</p>}
                              {r.cu && <p className="mt-0.5 text-[11.5px] leading-snug text-slate-400">Trước 01/7/2025: {r.cu}</p>}
                              {r.dan && <div className="mt-1 flex flex-wrap gap-1">{r.dan.map((dd, j) => <NutDan key={j} d={dd} nho />)}</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── BỘ HỒ SƠ ── ba ô tóm tắt (bao lâu · nộp đâu · nhận gì) rồi tới danh sách
                    giấy tờ bấm đánh dấu được. Đây mới là thứ dùng để ĐI LÀM VIỆC THẬT. */}
                {x.hoSo && (() => {
                  const tong = x.hoSo.gom.length;
                  const xong = x.hoSo.gom.filter((_, i) => daCo[`${x.ma}:${i}`]).length;
                  const batBuoc = x.hoSo.gom.filter((g) => g.batBuoc).length;
                  return (
                    <div className="mt-3 rounded-2xl border-2 border-[#0A2540]/20 bg-[#0A2540]/[0.03] p-3">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-[#0A2540]">📋 {x.hoSo.nhan}</p>
                      {/* Nguồn của bộ hồ sơ có thể đã bị văn bản mới bãi bỏ — phải báo ngay
                          trên đầu, không để ai lỡ nộp mẫu đơn đã bỏ rồi bị trả hồ sơ. */}
                      {x.hoSo.canhBao && (
                        <p className="mt-1.5 rounded-xl border-2 border-rose-300 bg-rose-50 px-2.5 py-2 text-[12.5px] font-semibold leading-snug text-rose-800">
                          {x.hoSo.canhBao}
                        </p>
                      )}
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                        <div className="rounded-xl bg-white p-2">
                          <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">⏱ Bao lâu</p>
                          <p className="mt-0.5 text-[12.5px] font-semibold leading-snug text-slate-700">{x.hoSo.thoiHan}</p>
                        </div>
                        <div className="rounded-xl bg-white p-2">
                          <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">📍 Nộp ở đâu</p>
                          <ul className="mt-0.5 space-y-0.5">
                            {x.hoSo.noiNop.map((n, i) => <li key={i} className="text-[12px] leading-snug text-slate-700">• {n}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-xl bg-white p-2">
                          <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">🎁 Nhận được gì</p>
                          <p className="mt-0.5 text-[12.5px] font-semibold leading-snug text-slate-700">{x.hoSo.ketQua}</p>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-2">
                        <p className="text-[12px] font-bold text-[#0A2540]">Giấy tờ phải chuẩn bị — đã có {xong}/{tong}</p>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${tong ? (xong / tong) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[11px] text-slate-400">{batBuoc} bắt buộc</span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {x.hoSo.gom.map((g, i) => {
                          const k = `${x.ma}:${i}`;
                          return (
                            <button key={i} onClick={() => danhDauGiayTo(k)}
                              className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-1.5 text-left transition ${daCo[k] ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                              <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 text-[11px] font-bold ${daCo[k] ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'}`}>✓</span>
                              <span className="min-w-0 flex-1">
                                <span className={`block text-[13px] font-semibold leading-snug ${daCo[k] ? 'text-emerald-900 line-through decoration-emerald-400' : 'text-slate-700'}`}>
                                  {g.ten}
                                  {g.mau && <span className="ml-1.5 rounded bg-[#C8A14B]/20 px-1.5 py-0.5 text-[11px] font-bold text-[#8a6d2f]">{g.mau}</span>}
                                  {g.batBuoc && <span className="ml-1 text-[11px] font-bold text-rose-600">bắt buộc</span>}
                                </span>
                                {g.y && <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{g.y}</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {x.hoSo.dan && <div className="mt-1.5 flex flex-wrap gap-1">{x.hoSo.dan.map((d, i) => <NutDan key={i} d={d} nho />)}</div>}
                    </div>
                  );
                })()}

                <div className="mt-3 space-y-0">
                  {x.buoc.map((b, i) => (
                    <div key={i} className="relative pl-7">
                      {/* đường dọc nối các bước — nhìn là biết đi theo thứ tự */}
                      {i < x.buoc.length - 1 && <span className="absolute left-[11px] top-7 h-full w-0.5 bg-slate-200" />}
                      <span className="absolute left-0 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#0A2540] text-[11px] font-bold text-white">{i + 1}</span>
                      <div className="pb-4">
                        <p className="text-[14.5px] font-bold leading-snug text-[#0A2540]">{b.hoi}</p>
                        <p className="mt-0.5 text-[13.5px] leading-relaxed text-slate-600">{b.y}</p>
                        {b.dan && <div className="mt-1 flex flex-wrap gap-1">{b.dan.map((d, j) => <NutDan key={j} d={d} />)}</div>}
                        {b.nhanh && b.nhanh.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {b.nhanh.map((n, j) => (
                              <div key={j} className={`rounded-xl border-l-4 px-2.5 py-1.5 ${n.canh ? 'border-rose-400 bg-rose-50' : 'border-emerald-400 bg-emerald-50'}`}>
                                <p className="text-[12.5px] font-bold text-slate-700">{n.canh ? '⚠️' : '→'} Nếu {n.neu}</p>
                                <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{n.thi}</p>
                                {n.dan && <div className="mt-1 flex flex-wrap gap-1">{n.dan.map((d, k2) => <NutDan key={k2} d={d} />)}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── VƯỚNG MẮC THƯỜNG GẶP ── phần người đi làm hồ sơ cần nhất: gặp thì gỡ sao. */}
                {x.vuongMac && x.vuongMac.length > 0 && (
                  <div className="mt-1 mb-2 rounded-2xl border-2 border-rose-200 bg-rose-50/50 p-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-rose-700">⚠️ Hay vướng chỗ này — và cách gỡ</p>
                    <div className="mt-1.5 space-y-1">
                      {x.vuongMac.map((v, i) => {
                        const k = `${x.ma}#${i}`;
                        return (
                          <div key={i} className="overflow-hidden rounded-xl border border-rose-200 bg-white">
                            <button onClick={() => setMoVuong((m) => ({ ...m, [k]: !m[k] }))}
                              className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left">
                              <span className="text-[13px]">{moVuong[k] ? '▾' : '▸'}</span>
                              <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-slate-700">{v.gap}</span>
                            </button>
                            {moVuong[k] && (
                              <div className="border-t border-rose-100 bg-rose-50/40 px-2.5 py-2">
                                <p className="text-[13px] leading-relaxed text-slate-700"><b className="text-rose-700">Gỡ:</b> {v.go}</p>
                                {v.dan && <div className="mt-1 flex flex-wrap gap-1">{v.dan.map((d, j) => <NutDan key={j} d={d} nho />)}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {x.ketLuan && (
                  <div className="mt-1 rounded-2xl border-2 border-dashed border-[#C8A14B] bg-amber-50/60 p-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-amber-700">📌 Chốt lại</p>
                    <ul className="mt-1 space-y-1">
                      {x.ketLuan.map((k, i) => <li key={i} className="text-[13.5px] leading-relaxed text-slate-700">• {k}</li>)}
                    </ul>
                    {x.danKetLuan && <div className="mt-1.5 flex flex-wrap gap-1">{x.danKetLuan.map((d, j) => <NutDan key={j} d={d} />)}</div>}
                  </div>
                )}
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] leading-snug text-slate-500">{th.canhBao}</p>
              </>
            );
          })()}
        </div>
      )}

      {/* ── SƠ ĐỒ TƯ DUY: gom cả bộ luật thành 8 nhánh việc thật, mỗi ô dẫn thẳng tới điều gốc ── */}
      {the === 'sodo' && (
        <div className="mt-3">

          {cheDoHoc === 'the' && (
            <div className="mt-3">
              {/* ── ĐANG HỌC: chỉ để lại thứ cần nhìn ──
                  Thanh tiến độ mảnh trên đỉnh · một dòng số liệu · nút ⚙ cho phần cài đặt.
                  Trước đây chỗ này là 3 hàng dày đặc: ô chọn chặng dài, "Thẻ mới/ngày [20]
                  (còn 20)", "Thuộc 0/1186" kèm thanh, nút "Gõ đáp án" — đẩy thẻ học xuống
                  tận giữa màn hình. */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${theTheoChuDe.length ? (daThuoc / theTheoChuDe.length) * 100 : 0}%` }} />
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[12px]">
                <span className="font-bold text-sky-700">Còn {theHomNay.length} thẻ hôm nay</span>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-emerald-700">thuộc {daThuoc}/{theTheoChuDe.length}</span>
                {theKho > 0 && <><span className="text-slate-300">·</span>
                  <span className="font-semibold text-rose-600" title="Thẻ quên từ 4 lần trở lên — nên mở lại điều gốc đọc kỹ">khó {theKho}</span></>}
                {chuoi > 1 && <span className="font-semibold text-amber-600">🔥 {chuoi}</span>}
                <button onClick={() => setMoCaiDat((v) => !v)}
                  title="Chọn chặng, số thẻ mới mỗi ngày, cách học"
                  className={`ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${moCaiDat ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-500'}`}>
                  ⚙ Cài đặt
                </button>
              </div>

              {moCaiDat && (
                <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <label className="block">
                    <span className="text-[11.5px] font-semibold text-slate-500">Học chặng nào</span>
                    <select value={chuDeHoc} onChange={(e) => { setChuDeHoc(e.target.value); setTheSo(0); setDatLat(false); }}
                      className="mt-0.5 block w-full rounded-lg border-2 border-slate-200 bg-white px-2 py-1.5 text-[12.5px] font-semibold text-[#0A2540] outline-none">
                      <option value="">Cả lộ trình, theo thứ tự chặng ({dsThe.length} thẻ)</option>
                      {changCo.map((c) => {
                        const ds2 = dsThe.filter((t) => cacChang(t).includes(c.so));
                        const xong = ds2.filter((t) => ((boThe[t.khoa] as any)?.S || 0) >= 21).length;
                        return <option key={c.so} value={String(c.so)}>{c.trongTam ? '★ ' : ''}{c.icon} Chặng {c.so + 1}. {c.ten} — {xong}/{ds2.length}</option>;
                      })}
                    </select>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <label className="flex items-center gap-1 text-slate-500"
                      title="Mỗi ngày nhận thêm bao nhiêu thẻ CHƯA HỌC BAO GIỜ. Thẻ đến hạn ôn thì luôn ra hết.">
                      Thẻ mới mỗi ngày
                      <select value={theMoiMoiNgay} onChange={(e) => setTheMoiMoiNgay(Number(e.target.value))}
                        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[12px] font-bold text-[#0A2540] outline-none">
                        {[5, 10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span className="text-[11px]">(còn {theMoiConLai})</span>
                    </label>
                    <button onClick={() => setBatGo((v) => !v)}
                      title="Gõ đáp án bằng tay nhớ chắc hơn hẳn chỉ lật thẻ rồi gật đầu"
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${batGo ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-500'}`}>
                      ⌨ Gõ đáp án
                    </button>
                    <button onClick={() => { if (confirm('Xoá hết tiến độ học thuộc?')) { setBoThe({}); try { localStorage.removeItem('luat-the-hoc'); } catch { /* */ } } }}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-rose-500">
                      Học lại từ đầu
                    </button>
                  </div>
                </div>
              )}

              {theHomNay.length === 0 ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-6 text-center">
                  <p className="text-4xl">✅</p>
                  <p className="mt-1 text-[14px] font-bold text-emerald-800">Ôn xong phần này rồi</p>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">
                    Mai quay lại, máy tự chọn đúng những thẻ sắp quên. Muốn học tiếp thì chọn chủ đề khác.
                  </p>
                </div>
              ) : (() => {
                const t = theHomNay[theSo % theHomNay.length];
                const c: any = boThe[t.khoa] || {};
                const kho4 = (c.sai || 0) >= 4;
                // Chấm bài gõ: so số chữ trùng nhau, gõ ý đúng là được, không bắt đúng từng chữ.
                const chamGo = () => {
                  const tach = (x: string) => new Set(kd(x).split(/[^a-z0-9]+/).filter((z) => z.length > 2));
                  const a = tach(goThu), b = tach(t.dap + ' ' + (t.nho || ''));
                  if (!a.size) return 0;
                  let n = 0; a.forEach((w) => { if (b.has(w)) n += 1; });
                  return Math.round((n / Math.max(a.size, 1)) * 100);
                };
                // Thẻ CAO ĐẦY MÀN HÌNH như app học bài: trước đây thẻ nhỏ nằm trên cùng,
                // bỏ trống hơn nửa màn hình phía dưới, mà nút "Xem đáp án" lại nằm tít trên
                // cao — ngón cái với không tới. 100dvh trừ phần đầu trang và thanh đáy.
                return (
                  <div className="mt-3 flex flex-col lg:block" style={{ minHeight: 'calc(100dvh - 210px)' }}>
                    <div className="flex flex-1 flex-col rounded-2xl border-2 border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-slate-400">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{t.loai} · {t.chuDe}</span>
                        <span>{c.lan ? `đã ôn ${c.lan} lần · nhớ chắc ~${Math.round(c.S || 0)} ngày` : 'thẻ mới'}</span>
                      </div>
                      {kho4 && (
                        <p className="mt-1.5 rounded-lg bg-rose-50 px-2 py-1 text-[11.5px] font-semibold text-rose-700">
                          Thẻ này đã quên {c.sai} lần — nên mở điều gốc đọc lại một lượt rồi hãy ôn tiếp.
                        </p>
                      )}
                      <p className="mt-2 text-[17px] font-extrabold leading-snug text-[#0A2540]">{t.hoi}</p>
                      {!datLat ? (
                        <>
                          {batGo ? (
                            <textarea value={goThu} onChange={(e) => setGoThu(e.target.value)} rows={3}
                              placeholder="Gõ câu trả lời theo trí nhớ… (gõ đúng ý là được, không cần đúng từng chữ)"
                              className="mt-2 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0A2540]" />
                          ) : (
                            <p className="my-4 text-[13px] italic leading-snug text-slate-500">
                              Tự trả lời trong đầu trước đã — nhớ lại được mới là học, đọc lại thì không.
                            </p>
                          )}
                          <button onClick={() => setDatLat(true)}
                            className="mt-auto w-full rounded-xl bg-[#0A2540] px-3 py-3 text-[15px] font-bold text-white">
                            Xem đáp án
                          </button>
                        </>
                      ) : (
                        <>
                          {batGo && goThu.trim() && (
                            <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600">
                              Bài gõ của mình trúng <b className={chamGo() >= 60 ? 'text-emerald-700' : 'text-amber-700'}>{chamGo()}%</b> số ý chính.
                            </p>
                          )}
                          <div className="mt-2 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 p-3">
                            {t.nho && <p className="text-[13.5px] font-bold text-sky-900">Nhớ nhanh: {t.nho}</p>}
                            <p className={`text-[13px] leading-relaxed text-slate-700 ${t.nho ? 'mt-1' : ''}`}>{t.dap}</p>
                          </div>
                          {t.dan && <div className="mt-2 flex flex-wrap gap-1">{t.dan.map((d, i2) => <NutDan key={i2} d={d} nho />)}</div>}
                          {/* Dính đáy: đáp án dài thì cuộn, nhưng 4 nút luôn trong tầm ngón cái. */}
                          <div className="sticky bottom-0 -mx-4 mt-3 grid grid-cols-4 gap-1.5 bg-white/95 px-4 pb-1 pt-2 backdrop-blur">
                            {([[1, 'Quên', 'border-rose-300 bg-rose-50 text-rose-700'],
                               [2, 'Khó', 'border-amber-300 bg-amber-50 text-amber-700'],
                               [3, 'Được', 'border-sky-300 bg-sky-50 text-sky-700'],
                               [4, 'Dễ', 'border-emerald-300 bg-emerald-50 text-emerald-700']] as const).map(([g, nhan, mau]) => (
                              <button key={g} onClick={() => traLoiThe(t.khoa, g)}
                                className={`flex min-h-[54px] flex-col items-center justify-center rounded-xl border-2 px-0.5 py-1.5 text-[12.5px] font-bold leading-tight ${mau}`}>
                                {nhan}<span className="mt-0.5 block text-[10px] font-normal leading-tight opacity-70">{hienNgay(c, g)}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-slate-400">
                      <button onClick={() => { setDatLat(false); setGoThu(''); setTheSo((i2) => i2 + 1); }} className="font-semibold hover:text-slate-700">Để lát nữa →</button>
                      <span>{(theSo % theHomNay.length) + 1}/{theHomNay.length}</span>
                      <span className="text-slate-300">{t.loai}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {cheDoHoc === 'sodo' && (!sd ? <p className="mt-3 text-slate-400">Đang tải sơ đồ…</p> : (
            <>
              <p className="mt-3 hidden text-[12.5px] leading-snug text-slate-500 lg:block">
                Gom cả bộ luật thành <b>{sd.nhanh.length} nhánh việc thật</b>. Ý nào nhiều điều nói cùng một chuyện
                thì gộp làm một ô. Bấm vào nút <b>Điều …</b> là nhảy thẳng sang nguyên văn.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {([['danhsach', '☰ Danh sách'], ['khungve', '🕸 Khung vẽ']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setKieuSoDo(k)}
                    className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition ${kieuSoDo === k ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{l}</button>
                ))}
                {kieuSoDo === 'danhsach' && <>
                  <span className="mx-1 h-4 w-px bg-slate-200" />
                  <button onClick={() => setMoNhanh(Object.fromEntries(sd.nhanh.map((_, i) => [i, true])))}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">Mở hết</button>
                  <button onClick={() => setMoNhanh({})}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">Thu hết</button>
                </>}
                {kieuSoDo === 'khungve' && (
                  <>
                    <span className="mx-1 h-4 w-px bg-slate-200" />
                    <button onClick={() => setPhongTo((z) => Math.max(0.35, +(z - 0.1).toFixed(2)))}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600">−</button>
                    <span className="text-[11.5px] font-semibold text-slate-400">{Math.round(phongTo * 100)}%</span>
                    <button onClick={() => setPhongTo((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600">+</button>
                    <button onClick={() => { setTieuDiem(null); daCanh.current = ''; }}
                      title="Thu cho vừa khung và đưa gốc về giữa"
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">⤢ Vừa màn hình</button>
                    <input value={timSoDo} onChange={(e) => setTimSoDo(e.target.value)}
                      placeholder="Tìm trong sơ đồ…"
                      className="ml-1 min-w-0 flex-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] outline-none focus:border-[#0A2540]" />
                    {timSoDo && <button onClick={() => setTimSoDo('')} className="text-slate-400">✕</button>}
                  </>
                )}
              </div>

              {/* Hàng nhánh: thu cả sơ đồ cho vừa màn hình điện thoại thì chữ chỉ còn 35%,
                  nhìn được tổng thể nhưng không đọc nổi và bấm cũng không trúng. Nên thêm
                  hàng này để nhảy thẳng vào một nhánh — lúc đó sơ đồ tự phóng cho vừa đúng
                  nhánh đó, chữ đọc được. Bấm lại nhánh đang xem là về lại toàn cảnh. */}
              {kieuSoDo === 'khungve' && (
                <div className="mt-2 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {sd.nhanh.map((n, i) => (
                    <button key={n.ten} onClick={() => setTieuDiem(tieuDiem === i ? null : i)}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${tieuDiem === i ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                      {n.icon} {n.ten.split(' · ')[0].slice(0, 22)}
                    </button>
                  ))}
                </div>
              )}

              {/* ── KHUNG VẼ SƠ ĐỒ TƯ DUY ──
                  Toả HAI BÊN quanh gốc như sơ đồ tư duy thật, không dồn hết sang phải
                  (dồn một bên thì cao gấp đôi, điện thoại phải cuộn mãi).
                  Ô cao theo ĐỘ DÀI CHỮ nên không cắt cụt chữ nào.
                  Kéo thả để di chuyển, có nút vừa màn hình, bấm nhánh để xem riêng nhánh đó. */}
              {kieuSoDo === 'khungve' && (() => {
                const q = kd(timSoDo.trim());
                const khop = (t: string) => !q || kd(t).includes(q);
                const W1 = 230, W2 = 300, KHE = 10, XC = 210, X1 = 250, X2 = 300;

                // Ô cao theo số dòng chữ thật -> không cắt cụt
                const caoNhanh = (n: NhanhSoDo) =>
                  Math.max(58, 26 + Math.ceil(n.ten.length / 24) * 17 + (n.neo ? 16 : 0));
                const caoCon = (c: NutSoDo) =>
                  Math.max(62, 22 + Math.ceil(c.ten.length / 30) * 17 + Math.ceil(c.y.length / 40) * 15
                    + (c.dan.length ? 20 : 0));

                // Nhánh nào đang xem riêng thì chỉ vẽ mình nó
                const ds = tieuDiem == null ? sd.nhanh.map((n, i) => ({ n, i }))
                  : [{ n: sd.nhanh[tieuDiem], i: tieuDiem }];
                // Chia đôi hai bên: nửa đầu sang phải, nửa sau sang trái
                const nua = Math.ceil(ds.length / 2);
                const ben: ('phai' | 'trai')[] = ds.map((_, k) => (k < nua ? 'phai' : 'trai'));

                type O = { x: number; y: number; w: number; h: number; cap: 1 | 2; i: number; j?: number; ben: 'phai' | 'trai' };
                const o: O[] = [];
                const canh: { x1: number; y1: number; x2: number; y2: number; mau: string; day: number }[] = [];
                const yN: Record<number, number> = {};
                const cao: Record<'phai' | 'trai', number> = { phai: 0, trai: 0 };

                ds.forEach(({ n, i }, k) => {
                  const b = ben[k];
                  const mo = tieuDiem != null || !!moNhanh[i];
                  const con = mo ? n.con : [];
                  const hN = caoNhanh(n);
                  const yBd = cao[b];
                  let yy = yBd;
                  const yCon: number[] = [];
                  con.forEach((c) => { yCon.push(yy); yy += caoCon(c) + KHE; });
                  const yNhanh = con.length ? (yBd + yy - KHE) / 2 - hN / 2 : yBd;
                  if (!con.length) yy = yBd + hN + KHE;
                  yN[i] = yNhanh;
                  const xN = b === 'phai' ? XC + X1 : XC - X1 - W1;
                  o.push({ x: xN, y: yNhanh, w: W1, h: hN, cap: 1, i, ben: b });
                  con.forEach((c, j) => {
                    const xCon = b === 'phai' ? xN + W1 + 60 : xN - 60 - W2;
                    o.push({ x: xCon, y: yCon[j], w: W2, h: caoCon(c), cap: 2, i, j, ben: b });
                    canh.push({
                      x1: b === 'phai' ? xN + W1 : xN, y1: yNhanh + hN / 2,
                      x2: b === 'phai' ? xCon : xCon + W2, y2: yCon[j] + caoCon(c) / 2,
                      mau: n.mau, day: 1.6,
                    });
                  });
                  cao[b] = yy + KHE;
                });

                const yGoc = Math.max(cao.phai, cao.trai) / 2 - 34;
                ds.forEach(({ n, i }, k) => {
                  const b = ben[k];
                  canh.push({
                    x1: b === 'phai' ? XC + 92 : XC - 92, y1: yGoc + 34,
                    x2: b === 'phai' ? XC + X1 : XC - X1, y2: yN[i] + caoNhanh(n) / 2,
                    mau: n.mau, day: 3,
                  });
                });

                const rongThat = (X1 + W1 + 60 + W2) * 2 + 40;
                const caoThat = Math.max(cao.phai, cao.trai, yGoc + 90) + 30;
                const lech = rongThat / 2 - XC;   // dịch để gốc nằm giữa khung
                // ĐO ĐÚNG VÙNG CÓ CHỮ, không lấy bề rộng danh nghĩa của khung.
                // rongThat là một công thức CỐ ĐỊNH, không co theo nội dung — nên lúc xem riêng
                // một nhánh, khung vẫn "rộng 2.400px" và mức phóng vẫn 35%, nhánh đó bé tí nằm
                // giữa một khoảng trống mênh mông. Đo theo hộp thật thì xem nhánh nào cũng vừa khít.
                // Xem riêng một nhánh thì chỉ canh theo CỘT NỘI DUNG (các ô con), bỏ qua ô gốc
                // và ô tên nhánh nằm bên trái. Sơ đồ trải ngang ba tầng: gốc → nhánh → nội dung,
                // cộng cả ba thì rộng hơn 1.000px, máy 390px thu lại còn 35% — chữ không đọc nổi.
                // Lấy riêng cột nội dung rộng ~300px thì phóng lên hơn 100%, đọc được ngay.
                // Ô gốc vẫn vẽ, kéo sang trái một tí là thấy.
                const con2 = o.filter((z) => z.cap === 2);
                const dung = tieuDiem != null && con2.length ? con2 : o;
                const mX = dung.map((z) => z.x + lech), mY = dung.map((z) => z.y);
                const goc = tieuDiem != null && con2.length ? [] : [XC + lech - 92];
                const x0 = Math.min(...mX, ...goc) - 12;
                const x1 = Math.max(...dung.map((z) => z.x + lech + z.w),
                                    ...(goc.length ? [XC + lech + 92] : [])) + 12;
                const y0 = Math.min(...mY, ...(goc.length ? [yGoc] : [])) - 12;
                const y1 = Math.max(...dung.map((z) => z.y + z.h),
                                    ...(goc.length ? [yGoc + 68] : [])) + 12;
                coSd.current = { rong: x1 - x0, cao: y1 - y0, x0, y0 };

                const cong = (c: { x1: number; y1: number; x2: number; y2: number }) =>
                  `M ${c.x1} ${c.y1} C ${(c.x1 + c.x2) / 2} ${c.y1}, ${(c.x1 + c.x2) / 2} ${c.y2}, ${c.x2} ${c.y2}`;
                const viMau: Record<string, string> = { slate: '#94a3b8', emerald: '#34d399', amber: '#fbbf24', sky: '#38bdf8', violet: '#a78bfa', rose: '#fb7185', orange: '#fb923c', teal: '#2dd4bf' };

                return (
                  <div ref={khungVe}
                    className="relative mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:18px_18px]"
                    style={{ height: 'min(72vh, 620px)', touchAction: 'none', cursor: keo.current ? 'grabbing' : 'grab' }}
                    onPointerDown={(e) => { keo.current = { x: e.clientX - dich.x, y: e.clientY - dich.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
                    onPointerMove={(e) => { if (keo.current) setDich({ x: e.clientX - keo.current.x, y: e.clientY - keo.current.y }); }}
                    onPointerUp={() => { keo.current = null; }}
                    onPointerLeave={() => { keo.current = null; }}>
                    <div style={{ transform: `translate(${dich.x}px, ${dich.y}px) scale(${phongTo})`, transformOrigin: 'top left', width: rongThat, height: caoThat, position: 'relative' }}>
                      <svg width={rongThat} height={caoThat} className="pointer-events-none absolute inset-0">
                        {canh.map((c, k2) => (
                          <path key={k2} d={cong({ x1: c.x1 + lech, y1: c.y1, x2: c.x2 + lech, y2: c.y2 })}
                            fill="none" stroke={viMau[c.mau] || '#94a3b8'} strokeWidth={c.day} strokeLinecap="round" opacity={0.85} />
                        ))}
                      </svg>

                      {/* GỐC */}
                      <button onClick={() => setTieuDiem(null)}
                        className="absolute flex flex-col items-center justify-center rounded-2xl border-2 border-[#0A2540] bg-[#0A2540] px-3 text-white shadow-lg"
                        style={{ left: XC + lech - 92, top: yGoc, width: 184, height: 68 }}>
                        <span className="text-[13.5px] font-extrabold leading-tight">⚖️ Luật Đất đai 2024</span>
                        <span className="text-[10.5px] opacity-70">{tieuDiem != null ? 'bấm để xem lại cả sơ đồ' : `${sd.nhanh.length} nhánh`}</span>
                      </button>

                      {o.map((z, k2) => {
                        const n = sd.nhanh[z.i];
                        const mau = MAU_NHANH[n.mau] || MAU_NHANH.slate;
                        if (z.cap === 1) {
                          const sang = khop(n.ten + ' ' + n.y + ' ' + (n.neo || '')) || n.con.some((c) => khop(c.ten + ' ' + c.y + ' ' + (c.chiTiet || '')));
                          return (
                            <div key={k2} className={`absolute rounded-2xl border-2 px-2.5 py-1.5 shadow-sm transition ${mau} ${sang ? '' : 'opacity-20'}`}
                              style={{ left: z.x + lech, top: z.y, width: z.w, minHeight: z.h }}>
                              <button onClick={() => setMoNhanh((m) => ({ ...m, [z.i]: !m[z.i] }))} className="block w-full text-left">
                                <span className="block text-[13px] font-extrabold leading-tight">{n.icon} {n.ten}</span>
                                {n.neo && <span className="mt-0.5 inline-block rounded-full bg-white/80 px-1.5 text-[10.5px] font-bold text-slate-700">🔑 {n.neo}</span>}
                              </button>
                              <div className="mt-1 flex items-center gap-1.5 text-[10.5px] opacity-80">
                                <button onClick={() => setMoNhanh((m) => ({ ...m, [z.i]: !m[z.i] }))} className="font-semibold">
                                  {(tieuDiem != null || moNhanh[z.i]) ? '▴ thu' : `▾ ${n.con.length} ý`}
                                </button>
                                <span>·</span>
                                <button onClick={() => { setTieuDiem(tieuDiem === z.i ? null : z.i); setDich({ x: 0, y: 0 }); }}
                                  className="font-semibold underline decoration-dotted">
                                  {tieuDiem === z.i ? 'xem cả sơ đồ' : 'chỉ xem nhánh này'}
                                </button>
                              </div>
                            </div>
                          );
                        }
                        const c = n.con[z.j!];
                        const sang = khop(c.ten + ' ' + c.y + ' ' + (c.chiTiet || ''));
                        return (
                          <div key={k2} className={`absolute rounded-xl border-2 bg-white px-2.5 py-1.5 shadow-sm transition ${sang ? 'border-slate-200' : 'border-slate-100 opacity-20'}`}
                            style={{ left: z.x + lech, top: z.y, width: z.w, minHeight: z.h }}>
                            <p className="text-[12.5px] font-bold leading-tight text-[#0A2540]">{c.ten}</p>
                            <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{c.y}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {c.dan.map((d, i2) => {
                                const v2 = kho.find((z2) => z2.ma === d.ma);
                                return (
                                  <button key={i2} onClick={() => { if (d.so) moDieuHopLy(d.ma, d.so); else { doiVanBan(d.ma); setThe('luat'); } }}
                                    title={v2 ? v2.ten : d.ma}
                                    className="rounded border border-slate-200 bg-slate-50 px-1 text-[10.5px] font-semibold text-slate-600 hover:border-[#0A2540] hover:text-[#0A2540]">
                                    {d.so ? `Điều ${d.so}` : '📄'} {v2 ? nhanNgan(v2.ma, v2.soHieu).replace('Luật Đất đai ', 'LĐĐ ') : ''}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="pointer-events-none absolute bottom-1.5 left-2 rounded-full bg-white/80 px-2 py-0.5 text-[10.5px] text-slate-500">
                      Kéo để di chuyển · cuộn chuột để phóng to / thu nhỏ · bấm nhánh để bung/thu
                    </p>
                  </div>
                );
              })()}

              <div className={`mt-3 space-y-2.5 ${kieuSoDo === 'khungve' ? 'hidden' : ''}`}>
                {sd.nhanh.map((n, i) => {
                  const mo = !!moNhanh[i];
                  const mau = MAU_NHANH[n.mau] || MAU_NHANH.slate;
                  return (
                    <div key={n.ten} className={`overflow-hidden rounded-2xl border-2 ${mau.split(' ')[0]} bg-white`}>
                      <button onClick={() => setMoNhanh((m) => ({ ...m, [i]: !m[i] }))}
                        className={`flex w-full items-start gap-2 px-3 py-2.5 text-left ${mau}`}>
                        <span className="text-[20px] leading-none">{n.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-extrabold leading-snug">
                            {n.ten}
                            {n.neo && <span className="ml-1.5 rounded-full bg-white/80 px-1.5 py-0.5 align-middle text-[11px] font-bold text-slate-700">🔑 {n.neo}</span>}
                          </span>
                          <span className="block text-[12px] leading-snug opacity-80">{n.y}</span>
                        </span>
                        <span className="shrink-0 text-[13px] opacity-60">{mo ? '▾' : '▸'}</span>
                      </button>
                      {mo && (
                        <div className="space-y-0 px-3 pb-2.5 pt-1">
                          {n.con.map((c, j) => (
                            // Gạch dọc bên trái + gạch ngang nhỏ = hình nhánh cây, đọc trên điện thoại vẫn rõ.
                            <div key={c.ten} className={`relative pl-4 ${j === n.con.length - 1 ? '' : 'pb-2'}`}>
                              <span className={`absolute left-0 top-0 w-px ${j === n.con.length - 1 ? 'h-[14px]' : 'h-full'} ${mau.split(' ')[0].replace('border-', 'bg-')}`} />
                              <span className={`absolute left-0 top-[14px] h-px w-3 ${mau.split(' ')[0].replace('border-', 'bg-')}`} />
                              <p className="text-[13.5px] font-bold leading-snug text-[#0A2540]">{c.ten}</p>
                              <p className="text-[12.5px] leading-snug text-slate-500">{c.y}</p>
                              {c.chiTiet && <p className="mt-1 text-[12px] leading-snug text-slate-400">{c.chiTiet}</p>}
                              <div className="mt-1 flex flex-wrap gap-1">
                                {c.dan.map((d, k2) => {
                                  const tenVb = kho.find((x) => x.ma === d.ma);
                                  return (
                                    <button key={k2} onClick={() => { if (d.so) moDieuHopLy(d.ma, d.so); else { doiVanBan(d.ma); setThe('luat'); } }}
                                      className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-slate-600 hover:border-[#0A2540] hover:text-[#0A2540]">
                                      {d.so ? `Điều ${d.so}` : '📄'} {tenVb ? nhanNgan(tenVb.ma, tenVb.soHieu) : d.ma}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ))}
        </div>
      )}

      {the === 'danhmuc' && (
        <div className="mt-3">
          {/* HAI LỚP DANH MỤC — đừng lẫn:
              · BỘ ĐỂ HỌC: mọi văn bản CÓ TOÀN VĂN trong công cụ này, xếp theo loại, ghi tình trạng, quan hệ,
                chủ đề, chặng. Dữ liệu: public/luat/bo-tong-hop.json (sinh bởi scripts/luat/dung-bo-tong-hop.py).
              · TOÀN QUỐC: mọi văn bản về đất đai trên hệ thống văn bản Chính phủ — chỉ có tên + đường tải bản
                gốc, phần lớn CHƯA có toàn văn ở đây. */}
          <div className="flex gap-1.5">
            {([['bo', `📚 Bộ để học${bth ? ` (${bth.tong.vanBan})` : ''}`],
               ['toanquoc', `🌐 Danh mục toàn quốc${dm.length ? ` (${dm.length})` : ''}`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setKieuDm(k)} className={nutLoc(kieuDm === k)}>{l}</button>
            ))}
          </div>

          {kieuDm === 'bo' && (!bth ? <p className="mt-3 text-[13px] text-slate-400">Đang tải bộ tổng hợp…</p> : (() => {
            const q = kd(timBo.trim());
            const cdChon = bth.chuDe.find((c) => c.ten === locCd);
            const theoCd = cdChon ? new Map(cdChon.vanBan.map((z) => [z.ma, z.soDieu])) : null;
            const hop = (x: VbBth) =>
              (!locNhom || x.nhom === locNhom)
              && (!locTt || (locTt === 'con' ? (x.tinhTrang === 'con-hieu-luc' || x.tinhTrang === 'sua-doi-mot-phan')
                : locTt === 'het' ? x.tinhTrang === 'het-hieu-luc' : x.tinhTrang === 'tham-khao'))
              && (!theoCd || theoCd.has(x.ma))
              && (!q || kd([x.nhan, x.soHieu, x.ten, x.coQuan, x.tinh || '', x.loai, ...x.chuDe.map((c) => c.ten)].join(' ')).includes(q));
            const ds = bth.vanBan.filter(hop);
            const dangLoc = !!(q || locNhom || locTt || locCd);
            return (
              <>
                <p className="mt-2 text-[12px] leading-snug text-slate-500">
                  <b className="text-[#0A2540]">{bth.tong.vanBan} văn bản</b> học được ở đây ({bth.tong.dieu.toLocaleString('vi-VN')} điều),
                  xếp theo loại · ghi rõ <b>còn hay hết hiệu lực</b> · văn bản nào sửa, thay, hướng dẫn văn bản nào.
                  <span className="hidden sm:inline"> Bấm vào từng văn bản để xem chi tiết.</span>
                </p>
                {/* Lọc theo LOẠI — trượt ngang trên điện thoại, không xuống dòng lộn xộn */}
                <div className="mt-2 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button onClick={() => setLocNhom('')} className={nutLoc(locNhom === '')}>Tất cả</button>
                  {bth.nhom.map((n) => (
                    <button key={n.ma} onClick={() => setLocNhom(locNhom === n.ma ? '' : n.ma)} className={nutLoc(locNhom === n.ma)}>
                      {n.icon} {TEN_NGAN_NHOM[n.ma] || n.ten} <span className="opacity-60">{n.soVanBan}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 rounded-xl border-2 border-slate-200 px-2.5 py-1.5 focus-within:border-[#0A2540]">
                  <span className="text-slate-400">🔍</span>
                  <input value={timBo} onChange={(e) => setTimBo(e.target.value)} placeholder="Tìm số hiệu, tên, cơ quan, tỉnh…"
                    className="w-full min-w-0 bg-transparent text-[14px] outline-none" />
                  {timBo && <button onClick={() => setTimBo('')} className="text-slate-400 hover:text-slate-700">✕</button>}
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <select value={locTt} onChange={(e) => setLocTt(e.target.value)}
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px] text-slate-700">
                    <option value="">Mọi tình trạng</option>
                    <option value="con">✅ Còn hiệu lực</option>
                    <option value="het">⛔ Hết hiệu lực</option>
                    <option value="tk">📨 Tham khảo</option>
                  </select>
                  <select value={locCd} onChange={(e) => setLocCd(e.target.value)}
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px] text-slate-700">
                    <option value="">Mọi chủ đề</option>
                    {bth.chuDe.filter((c) => c.vanBan.length).map((c) => (
                      <option key={c.ten} value={c.ten}>{c.icon} {c.ten} ({c.vanBan.length})</option>
                    ))}
                  </select>
                </div>
                {dangLoc && (
                  <p className="mt-1.5 flex items-center justify-between text-[11.5px] text-slate-500">
                    <span>{ds.length} văn bản khớp{cdChon ? ` · chủ đề “${cdChon.ten}”: đếm điều có cụm “${cdChon.tim}”` : ''}</span>
                    <button onClick={() => { setTimBo(''); setLocNhom(''); setLocTt(''); setLocCd(''); }}
                      className="shrink-0 font-semibold text-slate-500 underline">Bỏ lọc</button>
                  </p>
                )}

                {bth.nhom.map((n) => {
                  const cua = ds.filter((x) => x.nhom === n.ma);
                  const goiY = bth.nenBoSung.filter((r) => r.nhom === n.ma);
                  if (dangLoc && !cua.length) return null;
                  return (
                    <section key={n.ma} className="mt-3">
                      <div className="flex flex-wrap items-baseline gap-x-1.5 border-b border-slate-200 pb-1">
                        <h3 className="text-[13.5px] font-extrabold text-[#0A2540]">{n.icon} {n.ten}</h3>
                        <span className="text-[11.5px] text-slate-400">
                          {n.soVanBan} văn bản{n.ma !== 'huong-dan' && n.soVanBan ? ` · ${n.conHieuLuc} còn hiệu lực` : ''}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{n.moTa}</p>
                      {!cua.length && <p className="mt-1 text-[12px] italic text-slate-400">Chưa có văn bản nào trong kho.</p>}
                      <div className="mt-1.5 space-y-1.5">{cua.map((x) => veTheVb(x, theoCd?.get(x.ma)))}</div>
                      {!dangLoc && goiY.length > 0 && (
                        <p className="mt-1 text-[11.5px] leading-snug text-slate-500">
                          ➕ Nên bổ sung: {goiY.map((r) => r.soHieu).join(' · ')}{' '}
                          <button onClick={() => {
                            setMoNen(true);
                            setTimeout(() => document.getElementById('nen-bo-sung')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
                          }} className="font-semibold text-slate-600 underline">vì sao</button>
                        </p>
                      )}
                    </section>
                  );
                })}

                {/* VĂN BẢN NÊN BỔ SUNG — được văn bản trong kho nhắc tới mà kho chưa có. Đứng đầu là những
                    văn bản đang làm THAY ĐỔI HIỆU LỰC của điều có trong kho: nạp vào là các script tự đánh
                    dấu đúng, khỏi phải trông vào lời của công văn. */}
                {!dangLoc && bth.nenBoSung.length > 0 && (
                  <div id="nen-bo-sung" className="mt-3 scroll-mt-2 rounded-xl border border-dashed border-slate-300 bg-white">
                    <button onClick={() => setMoNen((v) => !v)} className="flex w-full items-center justify-between px-2.5 py-2 text-left">
                      <span className="text-[13px] font-bold text-[#0A2540]">➕ Văn bản nên bổ sung vào kho ({bth.nenBoSung.length})</span>
                      <span className="text-[12px] text-slate-400">{moNen ? '▾' : '▸'}</span>
                    </button>
                    {moNen && (
                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {bth.nenBoSung.map((r) => (
                          <div key={r.soHieu} className="px-2.5 py-1.5 text-[12px] leading-snug">
                            <p className="font-semibold text-slate-700">
                              {r.soHieu}{r.ten ? <span className="font-normal text-slate-500"> — {r.ten}</span> : null}
                            </p>
                            {(r.anhHuongDieu?.length || 0) > 0 && (
                              <p className="mt-0.5 font-semibold text-rose-700">⚠️ Làm thay đổi hiệu lực của: {r.anhHuongDieu!.join(', ')} — nên nạp trước.</p>
                            )}
                            {r.duocNhacBoi.length > 0 && (
                              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-slate-500">
                                Được nhắc tới ở: {r.duocNhacBoi.map((m2) => <NutDan key={m2} d={{ ma: m2 }} nho />)}
                              </p>
                            )}
                            {r.lyDoChuaCo && <p className="mt-0.5 text-slate-500">Chưa đưa vào được: {r.lyDoChuaCo}</p>}
                            {r.canKiemTra && <p className="mt-0.5 text-amber-700">⚠️ {r.canKiemTra}</p>}
                            {r.danhMuc && (
                              <p className="mt-0.5 flex flex-wrap gap-2 text-[11.5px]">
                                <a href={r.danhMuc.link} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 underline">Xem trên cổng Chính phủ</a>
                                {r.danhMuc.tep.slice(0, 1).map((u) => (
                                  <a key={u} href={u} target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">📄 Tải bản gốc</a>
                                ))}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
                  Bộ tổng hợp cập nhật ngày {ngayVn(bth.capNhat)} — máy tự gom từ chính dữ liệu của công cụ, không gõ tay.
                  Văn bản <b>📨 tham khảo</b> là công văn hướng dẫn, giải đáp: không phải văn bản quy phạm pháp luật; của tỉnh
                  khác thì không bắt buộc ở Khánh Hòa.
                </p>
              </>
            );
          })())}

          {kieuDm === 'toanquoc' && <>
          <p className="mt-2 text-[12.5px] leading-snug text-slate-500">
            Toàn bộ văn bản về đất đai trên <b>Hệ thống văn bản của Chính phủ</b> — máy quét lần lượt từng mã văn bản
            rồi lọc theo từ khoá nên <b>không sót</b>. Bấm vào từng dòng để mở bản gốc trên cổng Chính phủ,
            hoặc tải thẳng tệp PDF ký số. Phần lớn văn bản ở đây <b>chưa có toàn văn</b> trong công cụ — văn bản
            học được nằm ở <b>Bộ để học</b>.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={timDm} onChange={(e) => setTimDm(e.target.value)} placeholder="Tìm trong danh mục…"
              className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-[#0A2540]" />
            <select value={locLoai} onChange={(e) => setLocLoai(e.target.value)} className="rounded-xl border-2 border-slate-200 px-2 py-2 text-[14px]">
              <option value="">Tất cả loại</option>
              {[...new Set(dm.map((x) => x.loai))].sort().map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {(() => {
            const q = kd(timDm.trim());
            const ds = dm.filter((x) => (!locLoai || x.loai === locLoai) && (!q || kd(x.loai + ' ' + x.so + ' ' + x.ten).includes(q)));
            return (
              <>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{ds.length} văn bản</p>
                <div className="mt-1 max-h-[64vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {ds.map((x) => (
                    <div key={x.id} className="px-3 py-2">
                      <p className="text-[13px] font-semibold leading-snug text-[#0A2540]">
                        <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-500">{x.loai}</span>
                        {x.so ? <span className="mr-1">{x.so}</span> : null}{x.ten}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-2 text-[11.5px]">
                        <a href={x.link} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 underline">Xem trên cổng Chính phủ</a>
                        {x.tep.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">📄 Tải bản gốc{x.tep.length > 1 ? ` (phần ${i + 1})` : ''}</a>
                        ))}
                      </p>
                    </div>
                  ))}
                  {ds.length === 0 && <p className="p-3 text-[13px] text-slate-400">Không có văn bản nào khớp.</p>}
                </div>
              </>
            );
          })()}
          </>}
        </div>
      )}

      {the === 'luat' && <>
      {/* ── CHỌN VĂN BẢN: MỘT Ô SỔ XUỐNG ──
          Trước đây bày 17 cái nút thành hàng cuộn ngang -> nhìn rối, lại phải kéo mới
          thấy hết. Nay gom vào một ô sổ xuống, chia nhóm Luật / Nghị định / Thông tư. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={maVb} onChange={(e) => {
          // Chọn văn bản tham khảo (công văn) thì mở ngăn đọc công văn, ô chọn vẫn giữ văn bản đang xem.
          const v = e.target.value;
          if (v.startsWith('tk:')) moTk(v.slice(3)); else doiVanBan(v);
        }}
          className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-[14px] font-semibold text-[#0A2540] outline-none focus:border-[#0A2540]">
          {/* Nghị quyết của Quốc hội cũng mang đuôi /QH như luật → tách theo mã "nq…" (quy ước đặt mã khi
              nạp, xem .claude/skills/bo-sung-van-ban-hoc-luat). Văn bản của tỉnh mang đuôi UBND / HĐND. */}
          {([['Đang áp dụng — Luật', (x: KhoItem) => !x.hetHieuLuc && x.soHieu.includes('/QH') && !x.ma.startsWith('nq')],
             ['Đang áp dụng — Nghị quyết của Quốc hội', (x: KhoItem) => !x.hetHieuLuc && x.ma.startsWith('nq')],
             ['Đang áp dụng — Nghị định', (x: KhoItem) => !x.hetHieuLuc && x.soHieu.includes('NĐ-CP')],
             ['Đang áp dụng — Thông tư', (x: KhoItem) => !x.hetHieuLuc && x.soHieu.includes('/TT-')],
             ['Đang áp dụng — Văn bản của tỉnh Khánh Hòa', (x: KhoItem) => !x.hetHieuLuc && /UBND|HĐND/.test(x.soHieu)],
             ['⛔ Luật đời cũ (đã hết hiệu lực) — tra hồ sơ thời kỳ đó',
              (x: KhoItem) => !!x.hetHieuLuc]] as const).map(([nhom, loc]) => {
            const ds = kho.filter(loc);
            if (!ds.length) return null;
            return (
              <optgroup key={nhom} label={nhom}>
                {ds.map((x) => (
                  <option key={x.ma} value={x.ma}>
                    {x.hetHieuLuc ? '⛔ ' : ''}{nhanNgan(x.ma, x.soHieu)} — {x.ten.length > 58 ? x.ten.slice(0, 58) + '…' : x.ten} ({x.soDieu} điều)
                  </option>
                ))}
              </optgroup>
            );
          })}
          {dsTk.length > 0 && (
            <optgroup label="📨 Văn bản tham khảo (công văn) — chọn để đọc">
              {dsTk.map((x) => (
                <option key={x.ma} value={'tk:' + x.ma}>
                  📨 {x.nhan}{x.tinh ? ` (${x.tinh})` : ''} — {x.ten.length > 50 ? x.ten.slice(0, 50) + '…' : x.ten}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {vb?.phuLuc && (
          <button onClick={() => { setXemPhuLuc((v) => !v); setChon(null); oNoiDung.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            className={`shrink-0 rounded-xl border-2 px-2.5 py-2 text-[12.5px] font-semibold ${xemPhuLuc ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
            📎 Phụ lục
          </button>
        )}
      </div>
      {/* ── HỘP THUỘC TÍNH + LƯỢC ĐỒ VĂN BẢN ──
          Thư viện pháp luật để hộp này ngay đầu trang vì người tra luật nhìn nó trước cả
          nội dung: ai ký, hiệu lực từ bao giờ, còn hay hết hiệu lực. Ở đây thêm LƯỢC ĐỒ
          tính sẵn: văn bản này dựa trên văn bản nào, và văn bản nào hướng dẫn nó.
          ĐANG TÌM thì ẩn (đợt 22, 12/10/2026): trên điện thoại hộp này + dòng cảnh báo hiệu lực đẩy kết quả xuống
          gần nửa màn hình, lúc tìm "Cả kho" thì còn không liên quan tới kết quả. Xoá ô tìm là hiện lại. */}
      {vb && !tim.trim() && (() => {
        const k = kho.find((x) => x.ma === maVb);
        return (
          <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
            {/* Điện thoại: gấp lại, chỉ hiện dòng quan trọng nhất là CÒN HAY HẾT HIỆU LỰC.
                Sáu mục thuộc tính dàn ngang chiếm 3 dòng mà lúc tra cứu ít khi cần tới. */}
            <button onClick={() => setMoThuocTinh((v) => !v)}
              className="flex w-full items-center justify-between text-[12px] lg:hidden">
              <span className="font-semibold text-slate-600">
                {vb.soHieu} · {vb.hetHieuLuc ? <b className="text-rose-600">Hết hiệu lực</b> : <b className="text-emerald-600">Còn hiệu lực</b>}
              </span>
              <span className="text-slate-400">{moThuocTinh ? 'thu ▴' : 'chi tiết ▾'}</span>
            </button>
            <div className={`flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-slate-500 ${moThuocTinh ? 'mt-1.5 flex' : 'hidden lg:flex'}`}>
              <span>Số hiệu: <b className="text-slate-700">{vb.soHieu}</b></span>
              <span>Ban hành: <b className="text-slate-700">{ngayVn(vb.ngay)}</b></span>
              {k?.ngayHieuLuc && <span>Hiệu lực: <b className="text-slate-700">{ngayVn(k.ngayHieuLuc)}</b></span>}
              {k?.nguoiKy && <span>Người ký: <b className="text-slate-700">{k.nguoiKy}</b></span>}
              <span>Tình trạng: {vb.hetHieuLuc
                ? <b className="text-rose-600">Hết hiệu lực</b>
                : <b className="text-emerald-600">Còn hiệu lực</b>}</span>
              <span>{vb.dieu.length} điều{vb.chuong.length ? ` · ${vb.chuong.length} chương` : ''}</span>
            </div>
            {/* LƯỢC ĐỒ: bốn loại quan hệ, xếp theo thứ tự người tra luật cần biết trước. */}
            {(() => {
              const hang: [string, string[] | undefined, string][] = [
                ['Căn cứ ban hành', k?.canCu, 'text-slate-500'],
                ['Thay thế', k?.thayThe, 'text-rose-600'],
                ['Bị thay thế bởi', k?.biThayTheBoi, 'text-rose-600'],
                ['Sửa đổi, bổ sung', k?.suaDoi, 'text-sky-600'],
                ['Bị sửa đổi, bổ sung bởi', k?.biSuaDoiBoi, 'text-sky-600'],
                ['Bị bãi bỏ một phần bởi', k?.biBaiBoMotPhanBoi, 'text-amber-600'],
                ['Được hướng dẫn bởi', k?.laCanCuCho, 'text-emerald-600'],
                ['Có nhắc tới', k?.dan, 'text-slate-500'],
              ];
              const co = hang.filter(([, ds]) => (ds?.length || 0) > 0);
              if (!co.length) return null;
              // THU LẠI CHO ĐỠ RỐI: lược đồ có khi liệt kê cả chục văn bản, để bung sẵn thì
              // đầu trang dày đặc chữ, người đọc chưa kịp thấy nội dung điều luật đã ngợp.
              // Mặc định chỉ hiện một dòng, cần thì bấm mở.
              const demQh = co.reduce((n, [, ds]) => n + (ds?.length || 0), 0) + (k?.baiBoMotPhan?.length || 0);
              if (!moLuocDo) return (
                <button onClick={() => setMoLuocDo(true)}
                  className="mt-1 border-t border-slate-200 pt-1 text-[11px] font-semibold text-slate-500 hover:text-[#0A2540]">
                  🔗 Lược đồ văn bản — {demQh} quan hệ với văn bản khác ▾
                </button>
              );
              return (
                <div className="mt-1 space-y-0.5 border-t border-slate-200 pt-1 text-[11px]">
                  <button onClick={() => setMoLuocDo(false)} className="font-semibold text-slate-500 hover:text-[#0A2540]">🔗 Lược đồ văn bản ▴</button>
                  {co.map(([nhan, ds, mau]) => (
                    <div key={nhan} className="flex flex-wrap items-center gap-1">
                      <span className={`font-semibold ${mau}`}>{nhan}:</span>
                      {ds!.map((m) => <NutDan key={m} d={{ ma: m }} nho />)}
                    </div>
                  ))}
                  {(k?.baiBoMotPhan?.length || 0) > 0 && (
                    <div className="flex flex-wrap items-start gap-1">
                      <span className="font-semibold text-amber-600">Bãi bỏ một phần của:</span>
                      <span className="min-w-0 flex-1 text-slate-500">
                        {[...new Map(k!.baiBoMotPhan!.map((z) => [z.ma, z])).values()].map((z) => (
                          <span key={z.ma} className="mr-2 inline-block"><NutDan d={{ ma: z.ma }} nho /></span>
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}
      {/* Văn bản hết hiệu lực vẫn giữ trong kho để đối chiếu — phải báo thật to, không để
          người dùng tra nhầm rồi tưởng là luật đang áp dụng. */}
      {vb?.hetHieuLuc && (
        <p className="mt-1.5 rounded-lg border-2 border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[12.5px] font-semibold leading-snug text-rose-800">
          ⛔ {vb.hetHieuLuc}
        </p>
      )}
      {/* Văn bản còn hiệu lực nhưng MẪU ĐƠN đã bị bãi bỏ — nộp mẫu cũ là bị trả hồ sơ. */}
      {vb && !vb.hetHieuLuc && (vb.mauBiBaiBo?.length || 0) > 0 && (() => {
        const m = vb.mauBiBaiBo![0];
        const kb = kho.find((z) => z.ma === m.boi);
        return (
          <p className="mt-1.5 rounded-lg border-2 border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[12.5px] leading-snug text-amber-900">
            ⚠️ <b>Mẫu đơn của văn bản này đã bị bãi bỏ</b> từ {ngayVn(m.tuNgay)} bởi {kb ? nhanNgan(kb.ma, kb.soHieu) : m.boi} —
            lấy mẫu mới ở Phụ lục văn bản đó. Phần bị bỏ: <i>{m.phan}</i>
          </p>
        );
      })()}
      {/* Văn bản tham khảo (công văn) báo một điều của văn bản này đã đổi hiệu lực, nhưng văn bản làm
          thay đổi CHƯA có trong kho → máy không tự đánh dấu, chỉ báo "cần kiểm" để người đọc biết. */}
      {/* GỌN LẠI (11/10/2026): "điều bị sửa đổi / bãi bỏ" + "cần kiểm hiệu lực" trước là một dòng cam + một HỘP ĐỎ TO luôn bung,
          trên điện thoại chiếm nửa màn hình trước cả ô tìm. Nay chung MỘT dòng nhỏ; bấm "chi tiết" mới bung danh sách cần kiểm.
          Đang tìm thì ẩn như hộp thuộc tính ở trên (đợt 22). */}
      {vb && !tim.trim() && (() => {
        const bo = vb.hetHieuLuc ? 0 : vb.dieu.filter((d) => d.tinhTrang?.loai === 'het-hieu-luc').length;
        const phan = vb.hetHieuLuc ? 0 : vb.dieu.filter((d) => d.tinhTrang && d.tinhTrang.loai !== 'het-hieu-luc').length
          + vb.dieu.filter((d) => !d.tinhTrang && (d.suaDoi?.length || 0) > 0).length;
        const ck = vbBth[maVb]?.canKiemTra || [];
        if (!bo && !phan && !ck.length) return null;
        return (
          <div className="mt-1 text-[11.5px] leading-snug text-slate-500">
            <span>
              {bo > 0 && <b className="text-rose-600">{bo} điều hết hiệu lực ⛔</b>}
              {bo > 0 && (phan > 0 || ck.length > 0) && ' · '}
              {phan > 0 && <b className="text-amber-600">{phan} điều bị sửa đổi / bãi bỏ một phần ⚠️</b>}
              {phan > 0 && ck.length > 0 && ' · '}
              {ck.length > 0 && (
                <button onClick={() => setMoCanKiem((v) => !v)} className="font-bold text-rose-700 underline decoration-dotted underline-offset-2">
                  ❓ {ck.length} điều cần kiểm hiệu lực {moCanKiem ? '▴' : '▾'}
                </button>
              )}
            </span>
            {ck.length > 0 && moCanKiem && (
              <div className="mt-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-800">
                {ck.map((c, i) => (
                  <button key={i} onClick={() => moDieu(maVb, c.dieu)} className="mr-1.5 font-bold underline">
                    Điều {c.dieu}{c.khoan ? ` khoản ${c.khoan}` : ''}
                  </button>
                ))}
                — văn bản tham khảo báo đã thay đổi, nhưng văn bản làm thay đổi chưa có trong kho. Bấm để xem.
              </div>
            )}
          </div>
        );
      })()}

      {/* Ô TÌM — gõ không dấu vẫn ra; gõ số thì nhảy thẳng tới điều đó */}
      <div className="sticky top-0 z-10 -mx-3 mt-3 bg-white/95 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 px-3 py-2 focus-within:border-[#0A2540]">
          <span className="text-slate-400">🔍</span>
          <input ref={oTim} value={tim} onChange={(e) => setTim(e.target.value)} enterKeyHint="search"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && tim) { e.preventDefault(); setTim(''); return; }
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && ketQuaHien.length) { e.preventDefault(); moDieu(ketQuaHien[0].ma, ketQuaHien[0].d.so, khoanKhop(ketQuaHien[0].ma, ketQuaHien[0].d.so)); (e.target as HTMLInputElement).blur(); }
            }}
            placeholder="Từ khoá, hoặc số điều (vd 45, đ45 k2)…" title="Gõ rồi Enter để mở điều đầu tiên"
            className="w-full bg-transparent text-[15px] outline-none" />
          {tim && <button onClick={() => setTim('')} className="text-slate-400 hover:text-slate-700">✕</button>}
          {!tim && <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-400 lg:inline" title="Bấm / hoặc Ctrl+K ở bất cứ đâu để vào ô tìm">/</kbd>}
        </div>
      </div>
      {/* CHỈ Ô TÌM DÍNH TRÊN ĐẦU (đợt 24, 12/10/2026). Hàng nút lọc + "Gần đây" + "Đã tìm" + bảng chủ đề trước cũng dính theo → cả khối
          ~170 px đứng yên trên đầu, đọc điều trên điện thoại mất gần 1/4 màn hình và che tiêu đề điều vừa mở. Nay chúng cuộn đi như thường. */}
      <div>
        {/* MỘT HÀNG NÚT NHỎ, không xuống dòng lung tung. 14 chủ đề nhanh giấu sau nút
            "Chủ đề" — bấm mới xổ ra, nhìn đỡ rối hẳn. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setMoChuDe((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${moChuDe ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
            🔖 Chủ đề {moChuDe ? '▴' : '▾'}
          </button>
          {/* Nhiều việc luật chỉ nói một câu rồi "Chính phủ quy định chi tiết" -> chữ thật nằm ở nghị định. */}
          <button onClick={() => setTimCaKho((v) => !v)} title="Tìm một lượt trong cả luật lẫn nghị định, thông tư"
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${timCaKho ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
            {dangTaiKho ? '⏳ đang mở…' : `🔎 Cả kho${timCaKho ? ' ✓' : ''}`}
          </button>
          {(ghim.length > 0 || chiGhim) && <button onClick={() => { setChiGhim((v) => !v); setChon(null); setXemPhuLuc(false); }} title="Chỉ hiện những điều đã ghim"
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${chiGhim ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
            ⭐ Ghim {ghim.length}
          </button>}
          {gt && (
            <button onClick={() => { setChiGt((v) => !v); setChon(null); setXemPhuLuc(false); }} title="Chỉ hiện những điều có giải thích ngắn"
              className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${chiGt ? 'border-sky-600 bg-sky-600 text-white' : 'border-sky-300 bg-sky-50 text-sky-700'}`}>
              💡 Giải thích {Object.keys(gt.muc).length}
            </button>
          )}
          {(tim || chiGhim || chiGt) && (
            <button onClick={() => { setTim(''); setChiGhim(false); setChiGt(false); }}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-500">✕ Bỏ lọc</button>
          )}
        </div>
        {!tim && !chiGhim && !chiGt && ganDay.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-[11px] font-semibold text-slate-400">🕘 Gần đây:</span>
            {ganDay.map((g) => (
              <button key={g.ma + ':' + g.so} onClick={() => moDieu(g.ma, g.so)} title={`${g.nhan} · Điều ${g.so}. ${g.tieuDe}`}
                className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11.5px] text-slate-600 hover:border-[#0A2540] hover:text-[#0A2540]">
                Điều {g.so}{g.ma !== maVb ? <span className="text-slate-400"> · {g.nhan}</span> : null}
              </button>
            ))}
          </div>
        )}
        {!tim && !chiGhim && !chiGt && daTim.length > 0 && (
          <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-[11px] font-semibold text-slate-400">🔎 Đã tìm:</span>
            {daTim.map((q) => (
              <button key={q} onClick={() => setTim(q)} title={`Tìm lại “${q}”`}
                className="shrink-0 whitespace-nowrap rounded-full border border-sky-200 bg-sky-50/60 px-2 py-0.5 text-[11.5px] text-sky-800 hover:border-sky-400">
                {q}
              </button>
            ))}
            <button onClick={() => { setDaTim([]); try { localStorage.removeItem('luat-da-tim'); } catch { /* */ } }} title="Xoá danh sách đã tìm"
              className="shrink-0 px-1 text-[11px] text-slate-400 hover:text-slate-600">✕</button>
          </div>
        )}
        {moChuDe && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-xl bg-slate-50 p-2">
            {CHU_DE.map((c) => (
              <button key={c.ten} onClick={() => { setTim(c.tim); setChiGhim(false); setChiGt(false); setChon(null); setXemPhuLuc(false); setMoChuDe(false); }}
                className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${kd(tim) === kd(c.tim) ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                {c.icon} {c.ten}
              </button>
            ))}
          </div>
        )}
      </div>

      {dangTai && <p className="mt-6 text-slate-400">Đang tải toàn văn…</p>}
      {loi && <p className="mt-6 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loi}</p>}

      {vb && (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Điều ĐẺ RA VỀ SAU: Luật sửa đổi 1998/2001 thêm hẳn Điều 22a, 78b… vào Luật 1993.
              Bản gốc 1993 không có mấy điều này, mà chèn chữ vào giữa nguyên văn là sửa luật
              gốc — không được phép. Nên hiện thành dòng gạch đứt nối ngay sau điều liền trước,
              bấm vào thì mở đúng khoản của luật sửa đổi, nơi có nguyên văn của nó. */}
          {/* ── CỘT TRÁI: cây chương → điều, hoặc kết quả tìm ──
              TRÊN ĐIỆN THOẠI (dưới lg) chỉ hiện MỘT trong hai: đang đọc một điều thì thu
              danh sách lại thành một nút, bấm mới bung ra. Trước đây danh sách chiếm 70%
              màn hình và nằm ngay trên nội dung, đọc xong muốn chọn điều khác phải cuộn
              ngược cả màn hình — rất khó dùng. Máy tính màn rộng thì vẫn để hai cột. */}
          {dieuDangXem && !moDs && (
            <button onClick={() => setMoDs(true)}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left lg:hidden">
              <span className="text-[13px] font-bold text-[#0A2540]">📋 Danh sách điều</span>
              <span className="text-[12px] text-slate-400">
                {tim || chiGhim || chiGt ? `${ketQua.length} điều khớp` : `${vb.dieu.length} điều`} ▾
              </span>
            </button>
          )}
          <div className={`rounded-xl border border-slate-200 bg-white lg:max-h-[70vh] lg:overflow-y-auto ${dieuDangXem && !moDs ? 'hidden lg:block' : ''}`}>
            <p className="border-b bg-slate-50/95 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur lg:sticky lg:top-0 lg:z-10">
              {tim || chiGhim || chiGt ? `${ketQua.length} điều khớp${timCaKho ? ' · cả kho' : ''}` : `${vb.chuong.length ? vb.chuong.length + ' chương · ' : ''}${vb.dieu.length} điều`}
            </p>
            {tim || chiGhim || chiGt ? (<>
              {/* Công văn tham khảo có chữ khớp — để riêng một hàng màu vàng trên đầu, không trộn với điều luật. */}
              {tim && tkKhop.length > 0 && (
                <div className="border-b border-amber-100 bg-amber-50/60 px-3 py-1.5">
                  <p className="text-[11px] font-bold text-amber-800">📨 {tkKhop.length} văn bản tham khảo khớp (không phải văn bản luật):</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">{tkKhop.map((x) => <NutDan key={x.ma} d={{ ma: x.ma }} nho />)}</div>
                </div>
              )}
              {timCaKho && tim.trim() && demTheoVb.length > 1 && (
                <div key={tim.trim()} className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button onClick={() => setLocVb(null)}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${!locVb ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                    Tất cả · {ketQua.length}
                  </button>
                  {demTheoVb.map(([ma, n]) => (
                    <button key={ma} onClick={() => setLocVb(locVb === ma ? null : ma)}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] ${locVb === ma ? 'border-[#0A2540] bg-[#0A2540] font-semibold text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                      {nhanNgan(ma, cacVb[ma]?.soHieu || '')} · {n}
                    </button>
                  ))}
                </div>
              )}
              {tim && timHL.boHoi.length > 0 && (
                <p className="border-b border-slate-100 px-3 py-1.5 text-[11.5px] leading-snug text-slate-500">
                  🗣 Bỏ từ hỏi {timHL.boHoi.map((t) => `“${t}”`).join(', ')} — tìm theo “<b className="text-slate-700">{timHL.q}</b>”
                </p>
              )}
              {tim && luiKhongDau && (
                <p className="border-b border-amber-100 bg-amber-50/70 px-3 py-1.5 text-[11.5px] leading-snug text-amber-900">
                  ✍️ Không có điều nào{timCaKho ? '' : ' của văn bản này'} chứa đủ cụm đúng dấu như đã gõ — đang tìm <b>không dấu</b> “{timHL.q}” (rộng hơn,
                  dễ lạc đề). Có thể một chữ gõ sai / thiếu dấu{timCaKho ? '.' : <>, hoặc nội dung nằm ở <b>nghị định, thông tư</b> (trình tự, thủ tục, mẫu giấy… hay nằm ở đó).</>}
                  {/* đợt 27: tìm trong một văn bản mà không khớp đúng dấu → mời tìm cả kho, chỗ hay có chữ "thủ tục", "hồ sơ" thật */}
                  {!timCaKho && (
                    <button onClick={() => setTimCaKho(true)}
                      className="ml-1 mt-1 inline-block rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold text-emerald-700">
                      🔎 Tìm cả kho (nghị định, thông tư)
                    </button>
                  )}
                </p>
              )}
              {tim && timHL.doan && !luiKhongDau && (
                <p className="border-b border-slate-100 bg-slate-50 px-3 py-1 text-[11.5px] text-slate-500">
                  🔤 Đang gõ dở — tìm theo “<b className="text-slate-700">{timHL.doan}</b>”
                </p>
              )}
              {tim && moRong && (
                <p className="border-b border-sky-100 bg-sky-50/70 px-3 py-1.5 text-[11.5px] leading-snug text-sky-900">
                  💡 Luật gọi {moRong.cap.map(([g, l], i) => <span key={g}>{i ? '; ' : ''}“{g}” là <b>“{l}”</b></span>)} — đã tìm thêm theo chữ của luật.
                </p>
              )}
              {ketQua.length === 0
                ? <div className="p-3 text-[13px] text-slate-400">
                    Không tìm thấy điều nào{timCaKho ? ' trong cả kho' : ' trong văn bản này'}. Thử từ khoá khác hoặc gõ số điều.
                    {goiYSua.length > 0 && (
                      <span className="mt-2 flex flex-wrap items-center gap-1.5 text-slate-600">
                        <span>Có phải muốn tìm:</span>
                        {goiYSua.map((g) => (
                          <button key={g} onClick={() => setTim(g)} className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-[12.5px] font-bold text-sky-800">“{g}”</button>
                        ))}
                      </span>
                    )}
                    {!timCaKho && (
                      <button onClick={() => setTimCaKho(true)} className="mt-2 block rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[12.5px] font-bold text-emerald-700">
                        🔎 Tìm trong cả kho (luật, nghị định, thông tư…)
                      </button>
                    )}
                  </div>
                : <>{ketQuaHien.slice(0, soHien).map((x) => (
                  <button key={x.ma + ':' + x.d.so} onClick={() => moDieu(x.ma, x.d.so, khoanKhop(x.ma, x.d.so))}
                    className={`block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 ${x.ma === maVb && chon === x.d.so ? 'bg-[#0A2540]/[0.05]' : ''}`}>
                    <span className={`block text-[13px] font-bold ${x.d.tinhTrang?.loai === 'het-hieu-luc' ? 'text-slate-400 line-through decoration-rose-300' : 'text-[#0A2540]'}`}>
                      {ghim.includes(khoaGhim(x.ma, x.d.so)) ? '⭐ ' : ''}{gt?.muc[khoaGhim(x.ma, x.d.so)] ? '💡 ' : ''}{canKiem(x.ma, x.d.so) ? '❓ ' : ''}{dauTinhTrang(x.d)}Điều {x.d.so}. {x.d.tieuDe}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {timCaKho && <span className="mr-1 rounded bg-slate-100 px-1 font-bold text-slate-500">{nhanNgan(x.ma, cacVb[x.ma]?.soHieu || '')}</span>}
                      {x.d.chuong ? <>Chương {x.d.chuong}{x.d.muc ? ` · Mục ${x.d.muc}` : ''}</> : null}
                    </span>
                    {(() => {
                      const td = trichDoan.get(x.ma + ':' + x.d.so);
                      return td ? (
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">
                          {td.khoan ? <b className="mr-1 text-slate-400">K{td.khoan}</b> : null}{toVang(td.chu, toKetQua.get(x.ma + ':' + x.d.so) || null)}
                        </span>
                      ) : null;
                    })()}
                  </button>
                ))}
                {ketQuaHien.length > soHien && (
                  <button onClick={() => setSoHien((n) => n + 100)}
                    className="block w-full px-3 py-2.5 text-center text-[12.5px] font-bold text-[#0A2540] hover:bg-slate-50">
                    Xem thêm {Math.min(100, ketQuaHien.length - soHien)} điều ▾ <span className="font-normal text-slate-400">(còn {ketQuaHien.length - soHien})</span>
                  </button>
                )}</>}
            </>) : vb.chuong.length === 0 ? (
              // Văn bản ngắn không chia chương (Luật 43/2024, Nghị định 42/2024) — liệt kê
              // thẳng từng điều. Không có nhánh này thì cột trái trống trơn.
              vb.dieu.map((d) => (
                <div key={d.so}>
                <button onClick={() => moDieu(vb.ma, d.so)}
                  className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-[12.5px] hover:bg-slate-50 ${chon === d.so ? 'bg-[#0A2540]/[0.05] font-semibold' : 'text-slate-600'}`}>
                  <span className={d.tinhTrang?.loai === 'het-hieu-luc' ? 'text-slate-400 line-through decoration-rose-300' : ''}>
                    {ghim.includes(khoaGhim(vb.ma, d.so)) ? '⭐ ' : ''}{gt?.muc[khoaGhim(vb.ma, d.so)] ? '💡 ' : ''}{canKiem(vb.ma, d.so) ? '❓ ' : ''}{dauTinhTrang(d)}Điều {d.so}. {d.tieuDe}
                  </span>
                </button>
                {(vb.boSungThem || []).filter((z) => z.sauDieu === Number(d.so)).map((z) => (
                  <button key={z.so} onClick={() => moDieu(z.boi, z.boiDieu)}
                    className="block w-full border-b border-slate-100 px-3 py-1.5 pl-3 text-left text-[12px] text-violet-700 hover:bg-violet-50">
                    ➕ Điều {z.so} <span className="text-[10.5px] text-slate-400">— bổ sung năm {(z.tuNgay || '').slice(0, 4)}</span>
                  </button>
                ))}
                </div>
              ))
            ) : (
              vb.chuong.map((c) => {
                const ds = vb.dieu.filter((d) => d.chuong === c.so);
                const mo = moChuong[c.so];
                return (
                  <div key={c.so} className="border-b border-slate-100">
                    <button onClick={() => setMoChuong((m) => ({ ...m, [c.so]: !m[c.so] }))}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50">
                      <span className="mt-0.5 text-slate-400">{mo ? '▾' : '▸'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-bold text-[#0A2540]">Chương {c.so}</span>
                        <span className="block text-[11.5px] leading-snug text-slate-500">{c.ten}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10.5px] font-semibold text-slate-500">{ds.length}</span>
                    </button>
                    {mo && ds.map((d) => (
                      <div key={d.so}>
                      <button onClick={() => moDieu(vb.ma, d.so)}
                        className={`block w-full px-3 py-1.5 pl-8 text-left text-[12.5px] hover:bg-slate-50 ${chon === d.so ? 'bg-[#0A2540]/[0.05] font-semibold' : 'text-slate-600'}`}>
                        <span className={d.tinhTrang?.loai === 'het-hieu-luc' ? 'text-slate-400 line-through decoration-rose-300' : ''}>
                          {ghim.includes(khoaGhim(vb.ma, d.so)) ? '⭐ ' : ''}{gt?.muc[khoaGhim(vb.ma, d.so)] ? '💡 ' : ''}{canKiem(vb.ma, d.so) ? '❓ ' : ''}{dauTinhTrang(d)}Điều {d.so}. {d.tieuDe}
                        </span>
                      </button>
                      {(vb.boSungThem || []).filter((z) => z.sauDieu === Number(d.so)).map((z) => (
                  <button key={z.so} onClick={() => moDieu(z.boi, z.boiDieu)}
                    className="block w-full border-b border-slate-100 px-3 py-1.5 pl-8 text-left text-[12px] text-violet-700 hover:bg-violet-50">
                    ➕ Điều {z.so} <span className="text-[10.5px] text-slate-400">— bổ sung năm {(z.tuNgay || '').slice(0, 4)}</span>
                  </button>
                ))}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* ── CỘT PHẢI: nguyên văn điều đang chọn ── */}
          <div ref={oNoiDung} className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4">
            {xemPhuLuc && vb.phuLuc ? (
              <article>
                <h2 className="text-[17px] font-extrabold text-[#0A2540]">📎 Phụ lục — {vb.soHieu}</h2>
                <p className="mt-1 text-[12px] leading-snug text-slate-500">
                  Chép nguyên xi phần phụ lục của bản gốc (biểu mẫu, trình tự thủ tục). Bản PDF trình bày theo bảng
                  nên chữ ở đây chỉ để tra nhanh — <b>cần in ấn thì lấy bản PDF gốc</b>.
                </p>
                <pre className="mt-3 max-h-[64vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-[13px] leading-relaxed text-slate-700">{vb.phuLuc}</pre>
              </article>
            ) : !dieuDangXem ? (
              <div className="py-10 text-center text-slate-400">
                <p className="text-4xl">⚖️</p>
                <p className="mt-2 text-sm">Chọn một điều trong danh sách, hoặc gõ từ khoá để tìm.</p>
                <p className="mt-1 text-[12px]">Mẹo: gõ <b>số điều</b> kiểu nào cũng được — <b>79</b>, <b>đ79</b>, <b>điều 79 khoản 2</b>, <b>79.2</b> — rồi <b>Enter</b> là mở ngay.</p>
                <p className="mt-1 text-[12px]">Gõ nhiều từ không cần đúng thứ tự (vd <b>thu hồi quốc phòng</b>) — điều có đủ các từ sẽ hiện ra, chữ khớp được tô vàng.</p>
                <p className="mt-1 text-[12px]">Việc nào luật ghi &ldquo;Chính phủ quy định chi tiết&rdquo; thì bật <b>Tìm cả kho</b> để ra luôn nghị định.</p>
              </div>
            ) : (
              <article>
                <p className="line-clamp-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:line-clamp-none">
                  {vb.soHieu}
                  {dieuDangXem.chuong ? <> · Chương {dieuDangXem.chuong} — {dieuDangXem.chuongTen}</> : null}
                  {dieuDangXem.muc ? <> · Mục {dieuDangXem.muc} — {dieuDangXem.mucTen}</> : null}
                </p>
                {/* Điện thoại: hai nút Ghim/Chép XUỐNG DÒNG DƯỚI tiêu đề.
                    Để chen ngang thì tiêu đề dài bị ép vào cột hẹp, xuống 9 dòng. */}
                <div className="mt-1 flex flex-col items-start gap-1.5 sm:flex-row sm:items-start sm:gap-2">
                  <h2 className="order-first min-w-0 flex-1 text-[17px] font-extrabold leading-snug text-[#0A2540]">
                    Điều {dieuDangXem.so}. {toVang(dieuDangXem.tieuDe)}
                  </h2>
                  <span className="flex shrink-0 gap-1.5">
                  <button onClick={() => doiGhim(vb.ma, dieuDangXem.so)} title="Ghim để học lại"
                    className={`shrink-0 rounded-lg border px-2 py-1 text-[12px] font-semibold ${ghim.includes(khoaGhim(vb.ma, dieuDangXem.so)) ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500'}`}>
                    {ghim.includes(khoaGhim(vb.ma, dieuDangXem.so)) ? '⭐ Đã ghim' : '☆ Ghim'}
                  </button>
                  <button onClick={() => chep(dieuDangXem)} title="Sao chép nguyên văn"
                    className={`shrink-0 rounded-lg border px-2 py-1 text-[12px] font-semibold ${daChep === 'chu' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>{daChep === 'chu' ? '✓ Đã chép' : '⧉ Chép'}</button>
                  <button onClick={() => guiLink(dieuDangXem)} title="Gửi đường dẫn tới điều này (mở thẳng đúng điều)"
                    className={`shrink-0 rounded-lg border px-2 py-1 text-[12px] font-semibold ${daChep === 'link' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>{daChep === 'link' ? '✓ Đã chép đường dẫn' : '🔗 Gửi'}</button>
                  <button onClick={doiCoChu} title={`Cỡ chữ nguyên văn: ${CO_CHU[coChu]} — bấm để đổi`}
                    className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[12px] font-semibold text-slate-500">
                    <span style={{ fontSize: 10 + coChu * 2 }}>A</span>a
                  </button>
                  </span>
                </div>

                {/* LƯỚT KẾT QUẢ TÌM (đợt 17, 11/10/2026): điều đang đọc nằm trong danh sách kết quả thì cho sang kết quả trước / sau ngay tại
                    chỗ, mở đúng khoản khớp — khỏi bấm "Danh sách điều" rồi tìm lại chỗ đang xem. */}
                {thanhKetQua('mt-2')}

                {/* ── CẢNH BÁO TÌNH TRẠNG ĐIỀU ──
                    Phải đặt TRƯỚC mọi thứ khác. Nghị định 151/2025 bãi bỏ 25 điều của Nghị
                    định 101/2024 — đúng những điều nói về hồ sơ, thời hạn, mẫu đơn. Đọc
                    nguyên văn mà không biết nó đã hết hiệu lực thì làm sai cả bộ hồ sơ. */}
                {dieuDangXem.tinhTrang && (() => {
                  const t = dieuDangXem.tinhTrang!;
                  const kb = kho.find((z) => z.ma === t.boi);
                  const kieu = t.loai === 'het-hieu-luc'
                    ? { mau: 'border-rose-400 bg-rose-50', chu: 'text-rose-800', icon: '⛔', nhan: 'ĐIỀU NÀY ĐÃ HẾT HIỆU LỰC' }
                    : t.loai === 'bai-bo-mot-phan'
                      ? { mau: 'border-amber-400 bg-amber-50', chu: 'text-amber-800', icon: '⚠️', nhan: 'ĐIỀU NÀY BỊ BÃI BỎ MỘT PHẦN' }
                      : { mau: 'border-sky-400 bg-sky-50', chu: 'text-sky-800', icon: '✏️', nhan: 'ĐIỀU NÀY ĐÃ BỊ SỬA ĐỔI, BỔ SUNG' };
                  return (
                    <div className={`mt-2 rounded-xl border-2 ${kieu.mau} p-2.5`}>
                      <p className={`text-[12px] font-extrabold ${kieu.chu}`}>
                        {kieu.icon} {kieu.nhan}{t.tuNgay ? ` TỪ ${ngayVn(t.tuNgay)}` : ''}
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-slate-700">
                        Bởi {kb ? <b>{nhanNgan(kb.ma, kb.soHieu)}</b> : t.boi}
                        {t.boiDieu ? <> — Điều {t.boiDieu}</> : null}
                        {t.phan ? <> · phần bị động tới: <i>{t.phan}</i></> : null}
                        {t.loai === 'het-hieu-luc' && ' — chữ dưới đây chỉ dùng để tra hồ sơ thuộc thời kỳ trước đó.'}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <NutDan d={{ ma: t.boi, ...(t.boiDieu ? { so: t.boiDieu } : {}) }} nho />
                      </div>
                    </div>
                  );
                })()}

                {/* ── ĐIỀU NÀY ĐÃ BỊ SỬA ĐỔI BỞI AI ──
                    Thư viện pháp luật làm đúng một việc rất quý: mở điều nào bị sửa là hiện
                    ngay dòng "Khoản 2 Điều 251 được sửa đổi bởi khoản 1 Điều 1 Luật 43/2024",
                    bấm vào bung ra NGUYÊN VĂN đoạn mới. Đọc chữ cũ mà không thấy chữ mới thì
                    hiểu sai hẳn — nên đây là phần phải có.
                    Một điều có thể bị sửa NHIỀU LẦN (Điều 19 Luật 1993 bị sửa cả năm 1998 lẫn
                    2001) nên xếp theo ngày, mới nhất lên trên. */}
                {(dieuDangXem.suaDoi?.length || 0) > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {[...dieuDangXem.suaDoi!].sort((x, y) => (y.tuNgay || '').localeCompare(x.tuNgay || '')).map((sd2, i3) => {
                      const kb = kho.find((z) => z.ma === sd2.boi);
                      const mo = moSuaDoi[`${dieuDangXem.so}:${i3}`];
                      const dong = sd2.loai === 'thay-the' ? 'Cụm từ tại điều này được thay'
                        : sd2.loai === 'bo-sung' ? `${sd2.phamVi} được bổ sung`
                          : `${sd2.phamVi} được sửa đổi, bổ sung`;
                      return (
                        <div key={i3} className="rounded-xl border-l-4 border-sky-400 bg-sky-50/70 px-2.5 py-2">
                          <p className="text-[12.5px] leading-snug text-slate-700">
                            <b className="text-sky-800">{dong}</b> bởi <b>khoản {sd2.boiKhoan} Điều {sd2.boiDieu}</b>{' '}
                            {kb ? <b>{nhanNgan(kb.ma, kb.soHieu)}</b> : sd2.boi}
                            {sd2.tuNgay ? <> · có hiệu lực từ <b>{ngayVn(sd2.tuNgay)}</b></> : null}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {sd2.noiDungMoi && (
                              <button onClick={() => setMoSuaDoi((m) => ({ ...m, [`${dieuDangXem.so}:${i3}`]: !m[`${dieuDangXem.so}:${i3}`] }))}
                                className="rounded-lg border border-sky-300 bg-white px-2 py-0.5 text-[11.5px] font-bold text-sky-700">
                                {mo ? '▴ Thu lại' : '▾ Xem nguyên văn đoạn mới'}
                              </button>
                            )}
                            <NutDan d={{ ma: sd2.boi, so: sd2.boiDieu }} nho />
                          </div>
                          {mo && sd2.noiDungMoi && (
                            <div className="mt-1.5 whitespace-pre-line rounded-lg border border-sky-200 bg-white px-2.5 py-2 text-[13px] leading-relaxed text-slate-800">
                              {sd2.noiDungMoi}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Điều này ĐI SỬA ai — nhìn từ phía luật sửa đổi. */}
                {(dieuDangXem.suaDoiCho?.length || 0) > 0 && (
                  <p className="mt-2 rounded-xl border-l-4 border-violet-400 bg-violet-50/70 px-2.5 py-2 text-[12.5px] leading-snug text-slate-700">
                    <b className="text-violet-800">Điều này sửa đổi, bổ sung</b>{' '}
                    {[...new Set(dieuDangXem.suaDoiCho!.map((z) => z.soHieu).filter(Boolean))].join(' · ')}
                    {' — '}{dieuDangXem.suaDoiCho!.length} nội dung.
                  </p>
                )}

                {/* ── ĐIỀU NÀY ĐƯỢC HƯỚNG DẪN Ở ĐÂU ──
                    Chữ luật thường chỉ nêu nguyên tắc, còn làm hồ sơ thật thì phải mở nghị định,
                    thông tư. Đọc Điều 137 xong vẫn chưa làm được gì nếu không biết trình tự nằm ở
                    Nghị định 101/2024, mẫu giấy ở Thông tư 10/2024, tiền ở Nghị định 103/2024.
                    Dữ liệu lấy từ chính bản đồ dẫn chiếu (dung-chuoi-doc.py), không phải tự khai. */}
                {(() => {
                  const ds = cd?.chuoi['ldd2024:' + dieuDangXem.so];
                  if (maVb !== 'ldd2024' || !ds?.length) return null;
                  return (
                    <div className="mt-2 rounded-xl border-l-4 border-teal-400 bg-teal-50/70 px-2.5 py-2">
                      {/* THU MỘT DÒNG (đợt 25): tên các văn bản; bấm mới bung từng điều */}
                      <button onClick={() => setMoHuongDan((v) => !v)} className="flex w-full items-start justify-between gap-2 text-left">
                        <span className="text-[12.5px] leading-snug">
                          <b className="text-teal-800">📎 Hướng dẫn chi tiết ở {ds.length} văn bản dưới luật</b>
                          {!moHuongDan && <span className="text-slate-500">: {ds.map((v) => nhanNgan(v.ma, kho.find((z) => z.ma === v.ma)?.soHieu || '') || v.nhan).join(' · ')}</span>}
                        </span>
                        <span className="shrink-0 text-[12px] font-bold text-teal-700">{moHuongDan ? '▴' : '▾'}</span>
                      </button>
                      {moHuongDan && <div className="mt-1 space-y-1">
                        {ds.map((v) => (
                          <div key={v.ma} className="flex flex-wrap items-center gap-1">
                            <span className="text-[11.5px] font-semibold text-slate-500">{v.nhan}:</span>
                            {v.dieu.slice(0, 8).map((so) => <NutDan key={so} d={{ ma: v.ma, so }} nho />)}
                            {v.dieu.length > 8 && <span className="text-[11px] text-slate-400">+{v.dieu.length - 8}</span>}
                          </div>
                        ))}
                      </div>}
                    </div>
                  );
                })()}

                {/* Chiều ngược lại: đang đọc một điều của nghị định / thông tư thì cho biết nó
                    hướng dẫn cho điều nào của luật — để lúc nào cũng lần ngược về gốc được. */}
                {(() => {
                  if (maVb === 'ldd2024' || !cd) return null;
                  const goc = Object.entries(cd.chuoi)
                    .filter(([, v]) => v.some((x) => x.ma === maVb && x.dieu.includes(dieuDangXem.so)))
                    .map(([k]) => Number(k.split(':')[1]));
                  if (!goc.length) return null;
                  return (
                    <p className="mt-2 flex flex-wrap items-center gap-1 rounded-xl border-l-4 border-teal-400 bg-teal-50/70 px-2.5 py-2 text-[12.5px]">
                      <b className="text-teal-800">📎 Điều này hướng dẫn cho</b>
                      {goc.slice(0, 6).map((so) => <NutDan key={so} d={{ ma: 'ldd2024', so }} nho />)}
                    </p>
                  );
                })()}

                {/* Công văn hướng dẫn, giải đáp nhắc tới điều này (tham khảo) — xem veThamKhaoDieu */}
                {veThamKhaoDieu(vb.ma, dieuDangXem.so)}

                {/* KHUNG GIẢI THÍCH — màu khác hẳn, ghi rõ không phải chữ luật, để người đọc
                    không bao giờ lẫn với nguyên văn bên dưới. */}
                {gt?.muc[khoaGhim(vb.ma, dieuDangXem.so)] && (
                  <div className="mt-3 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 p-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-sky-700">
                      💡 Giải thích nhanh — KHÔNG PHẢI VĂN BẢN LUẬT
                    </p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-slate-700">{gt.muc[khoaGhim(vb.ma, dieuDangXem.so)].y}</p>
                    <p className="mt-1.5 rounded-lg bg-white/80 px-2 py-1 text-[13px] font-semibold text-sky-800">
                      Nhớ nhanh: {gt.muc[khoaGhim(vb.ma, dieuDangXem.so)].nho}
                    </p>
                    <p className="mt-1.5 text-[10.5px] leading-snug text-slate-400">{gt.canhBao}</p>
                  </div>
                )}

                <p className="mt-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Nguyên văn</p>
                <div className="mt-1 space-y-2.5 leading-relaxed text-slate-800" style={{ fontSize: CO_CHU[coChu] }}>
                  {dieuDangXem.khoan.map((k, i) => (
                    <div key={i} id={k.so ? 'khoan-' + k.so : undefined}
                      className={khoanSang && k.so === khoanSang ? '-mx-1.5 rounded-lg bg-amber-50 px-1.5 py-1 ring-1 ring-amber-300' : ''}>
                      <p className="whitespace-pre-line">
                        {k.so ? <b className="text-[#0A2540]">{k.so}. </b> : null}{noiDung(k.chu)}
                      </p>
                      {k.diem.length > 0 && (
                        <div className="mt-1 space-y-1 pl-4">
                          {k.diem.map((x, j) => (
                            <p key={j} className="whitespace-pre-line"><b className="text-slate-500">{x.ky}) </b>{noiDung(x.chu)}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {thanhKetQua('mt-3')}
                {/* ĐỌC LIỀN MẠCH (11/10/2026): sang điều trước / điều sau ngay tại chỗ, khỏi quay lại danh sách (nhất là trên điện thoại) */}
                {(() => {
                  const i = vb.dieu.findIndex((d) => d.so === dieuDangXem.so);
                  const truoc = i > 0 ? vb.dieu[i - 1] : null, sau = i >= 0 && i < vb.dieu.length - 1 ? vb.dieu[i + 1] : null;
                  if (!truoc && !sau) return null;
                  return (
                    <div className="mt-3 flex items-stretch gap-2 border-t border-slate-100 pt-2.5">
                      {truoc ? (
                        <button onClick={() => moDieu(vb.ma, truoc.so)} title={truoc.tieuDe}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left hover:border-[#0A2540]">
                          <span className="block text-[11px] text-slate-400">‹ Điều trước</span>
                          <span className="block truncate text-[12.5px] font-semibold text-[#0A2540]">Điều {truoc.so}. {truoc.tieuDe}</span>
                        </button>
                      ) : <span className="flex-1" />}
                      {sau ? (
                        <button onClick={() => moDieu(vb.ma, sau.so)} title={sau.tieuDe}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right hover:border-[#0A2540]">
                          <span className="block text-[11px] text-slate-400">Điều sau ›</span>
                          <span className="block truncate text-[12.5px] font-semibold text-[#0A2540]">Điều {sau.so}. {sau.tieuDe}</span>
                        </button>
                      ) : <span className="flex-1" />}
                    </div>
                  );
                })()}

                {/* ── LIÊN KẾT HAI CHIỀU ──
                    Luật đất đai nhắc chéo nhau chằng chịt: luật nói một câu rồi "Chính phủ
                    quy định chi tiết", chữ thật nằm ở nghị định; nghị định lại viện ngược về
                    "khoản 3 Điều 96 của Luật Đất đai". Không thấy sợi dây đó thì học mãi vẫn
                    rời rạc. Máy đọc chữ của từng điều rồi dựng sẵn cả hai chiều. */}
                {((dieuDangXem.dan?.length || 0) > 0 || (dieuDangXem.duocDan?.length || 0) > 0) && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">🔗 Liên kết</p>
                    {(dieuDangXem.dan?.length || 0) > 0 && (
                      <div className="mt-1">
                        <p className="text-[11.5px] font-semibold text-slate-500">Điều này dẫn tới:</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">{dieuDangXem.dan!.map((d, i) => <NutDan key={i} d={d} nho />)}</div>
                      </div>
                    )}
                    {(dieuDangXem.duocDan?.length || 0) > 0 && (
                      <div className="mt-1.5">
                        <p className="text-[11.5px] font-semibold text-slate-500">
                          Được {dieuDangXem.duocDan!.length} chỗ khác dẫn tới{dieuDangXem.duocDan!.some((d) => d.ma !== vb.ma) ? ' (có cả nghị định, thông tư hướng dẫn)' : ''}:
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1">{dieuDangXem.duocDan!.map((d, i) => <NutDan key={i} d={d} nho />)}</div>
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-4 border-t pt-2 text-[11px] leading-snug text-slate-400">
                  Nguyên văn {vb.ten} (số {vb.soHieu}, ngày {ngayVn(vb.ngay)}) — {vb.nguon}. Chữ giữ nguyên, không rút gọn.
                </p>
              </article>
            )}
          </div>
        </div>
      )}
      </>}

      {/* ── NGĂN ĐỌC BÊN CẠNH ──
          Máy tính: trượt ra bên phải. Điện thoại: đẩy lên từ đáy.
          Sơ đồ / tình huống vẫn nằm nguyên phía sau, đóng ngăn là về đúng chỗ đang xem dở. */}
      {docBen && (() => {
        const v = cacVb[docBen.ma];
        const d = v?.dieu.find((z) => z.so === docBen.so);
        const kb = kho.find((z) => z.ma === docBen.ma);
        const g = gt?.muc[`${docBen.ma}:${docBen.so}`];
        const tt = d?.tinhTrang;
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDocBen(null)} />
            <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[78vh] flex-col rounded-t-2xl border-t-2 border-[#0A2540] bg-white shadow-2xl
                            sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(94vw,480px)] sm:rounded-none sm:rounded-l-2xl sm:border-l-2 sm:border-t-0">
              <div className="flex items-start gap-2 border-b bg-slate-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                    📖 Đọc bên cạnh · {kb ? nhanNgan(kb.ma, kb.soHieu) : docBen.ma}
                  </p>
                  <p className="text-[14.5px] font-extrabold leading-snug text-[#0A2540]">
                    {d ? <>Điều {d.so}. {d.tieuDe}</> : <>Điều {docBen.so}</>}
                  </p>
                </div>
                <button onClick={() => setDocBen(null)} title="Đóng, về lại chỗ đang xem"
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] font-bold text-slate-500 hover:text-slate-800">✕</button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
                {/* Đang đọc công văn thì bấm sang điều này → cho nút quay lại công văn, khỏi lạc đường. */}
                {tkTruoc && (
                  <button onClick={() => { const t = tkTruoc; setDocBen(null); moTk(t); }}
                    className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-800">
                    ← Về công văn {vbBth[tkTruoc]?.nhan || ''}
                  </button>
                )}
                {!d ? <p className="text-[13px] text-slate-400">Đang mở…</p> : (
                  <>
                    {tt && (
                      <p className={`mb-2 rounded-xl border-2 px-2.5 py-1.5 text-[12px] font-bold leading-snug ${
                        tt.loai === 'het-hieu-luc' ? 'border-rose-400 bg-rose-50 text-rose-800'
                          : tt.loai === 'bai-bo-mot-phan' ? 'border-amber-400 bg-amber-50 text-amber-800'
                            : 'border-sky-400 bg-sky-50 text-sky-800'}`}>
                        {tt.loai === 'het-hieu-luc' ? '⛔ ĐIỀU NÀY ĐÃ HẾT HIỆU LỰC'
                          : tt.loai === 'bai-bo-mot-phan' ? '⚠️ BỊ BÃI BỎ MỘT PHẦN' : '✏️ ĐÃ BỊ SỬA ĐỔI'}
                        {tt.tuNgay ? ` TỪ ${ngayVn(tt.tuNgay)}` : ''}
                        {(() => { const kz = kho.find((z) => z.ma === tt.boi); return kz ? ` — bởi ${nhanNgan(kz.ma, kz.soHieu)}` : ''; })()}
                      </p>
                    )}
                    {g && (
                      <div className="mb-2 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 p-2.5">
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-sky-700">💡 Giải thích nhanh — không phải văn bản luật</p>
                        <p className="mt-0.5 text-[13px] font-bold text-sky-900">Nhớ nhanh: {g.nho}</p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-700">{g.y}</p>
                      </div>
                    )}
                    {(() => { const k = veThamKhaoDieu(docBen.ma, docBen.so); return k ? <div className="-mt-2 mb-2">{k}</div> : null; })()}
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Nguyên văn</p>
                    <div className="mt-1 space-y-2 text-[13.5px] leading-relaxed text-slate-800">
                      {d.khoan.map((k, i) => (
                        <div key={i}>
                          <p className="whitespace-pre-line">{k.so ? <b className="text-[#0A2540]">{k.so}. </b> : null}{k.chu}</p>
                          {k.diem.length > 0 && (
                            <div className="mt-1 space-y-1 pl-3.5">
                              {k.diem.map((x, j) => <p key={j} className="whitespace-pre-line"><b className="text-slate-500">{x.ky}) </b>{x.chu}</p>)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {((d.dan?.length || 0) > 0 || (d.duocDan?.length || 0) > 0) && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">🔗 Liên kết</p>
                        {(d.dan?.length || 0) > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-[11px] font-semibold text-slate-500">Dẫn tới:</span>
                            {d.dan!.map((z, i) => (
                              <button key={i} onClick={() => z.so && setDocBen({ ma: z.ma, so: z.so })}
                                className="rounded border border-slate-200 bg-white px-1.5 text-[11px] font-semibold text-slate-600 hover:border-[#0A2540]">
                                {z.so ? `Điều ${z.so}` : '📄'} {(() => { const kz = kho.find((y) => y.ma === z.ma); return kz ? nhanNgan(kz.ma, kz.soHieu) : z.ma; })()}
                              </button>
                            ))}
                          </div>
                        )}
                        {(d.duocDan?.length || 0) > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-[11px] font-semibold text-slate-500">Được {d.duocDan!.length} chỗ dẫn tới:</span>
                            {d.duocDan!.slice(0, 10).map((z, i) => (
                              <button key={i} onClick={() => z.so && setDocBen({ ma: z.ma, so: z.so })}
                                className="rounded border border-slate-200 bg-white px-1.5 text-[11px] font-semibold text-slate-600 hover:border-[#0A2540]">
                                {z.so ? `Điều ${z.so}` : '📄'} {(() => { const kz = kho.find((y) => y.ma === z.ma); return kz ? nhanNgan(kz.ma, kz.soHieu) : z.ma; })()}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-1.5 border-t bg-slate-50 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <button onClick={() => { const b = docBen; setDocBen(null); if (b) moDieu(b.ma, b.so); }}
                  className="flex-1 rounded-lg bg-[#0A2540] px-3 py-1.5 text-[12.5px] font-bold text-white">
                  Mở hẳn ở Toàn văn →
                </button>
                <button onClick={() => docBen && doiGhim(docBen.ma, docBen.so)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold ${docBen && ghim.includes(khoaGhim(docBen.ma, docBen.so)) ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                  {docBen && ghim.includes(khoaGhim(docBen.ma, docBen.so)) ? '⭐' : '☆'}
                </button>
                <button onClick={() => setDocBen(null)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-500">Đóng</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── NGĂN ĐỌC CÔNG VĂN (VĂN BẢN THAM KHẢO) ──
          Cùng kiểu ngăn đọc điều luật (máy tính: trượt từ phải; điện thoại: đẩy lên từ đáy) nhưng VIỀN
          VÀNG và ghi to "không phải văn bản luật". Thứ tự: cảnh báo phạm vi (tỉnh nào, không bắt buộc ở
          Khánh Hòa) → nếu là bản quét thì nói rõ chữ do máy đọc → tóm tắt (khung giải thích riêng) →
          điều luật trong kho mà công văn trích → NGUYÊN VĂN. */}
      {docTk && (() => {
        const v = cacTk[docTk];
        const x = vbBth[docTk];
        const ngayKy = v?.ngay ? v.ngay.split('-') : [];
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDocTk(null)} />
            <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t-2 border-amber-500 bg-white shadow-2xl
                            sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(94vw,520px)] sm:rounded-none sm:rounded-l-2xl sm:border-l-2 sm:border-t-0">
              <div className="flex items-start gap-2 border-b bg-amber-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
                    📨 Văn bản tham khảo{x?.tinh ? ` · tỉnh ${x.tinh}` : ''} — không phải văn bản luật
                  </p>
                  <p className="text-[14.5px] font-extrabold leading-snug text-[#0A2540]">{x ? x.nhan : (v ? `${v.loai} ${v.soHieu}` : '…')}</p>
                </div>
                <button onClick={() => setDocTk(null)} title="Đóng, về lại chỗ đang xem"
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] font-bold text-slate-500 hover:text-slate-800">✕</button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
                {!v ? <p className="text-[13px] text-slate-400">Đang mở…</p> : (
                  <>
                    <p className="rounded-xl border-2 border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[12.5px] font-semibold leading-snug text-amber-900">
                      📍 {v.canhBao}
                    </p>
                    {v.nguonChu === 'may-doc-anh-quet' && (
                      <p className="mt-1.5 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[12px] leading-snug text-slate-700">
                        🖨️ <b>Bản quét:</b> chữ ở dưới do máy đọc từ ảnh rồi người làm web soát lại từng chữ — vẫn có thể sót.
                        Trích dẫn chính thức phải đối chiếu <b>ảnh bản gốc</b>.
                        {v.banGoc && <> <a href={v.banGoc} target="_blank" rel="noreferrer" className="font-bold text-sky-700 underline">Xem ảnh bản gốc</a></>}
                      </p>
                    )}

                    {/* TÓM TẮT — khung giải thích riêng, màu khác hẳn nguyên văn */}
                    {v.giaiThich?.tom && (
                      <div className="mt-2 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 p-2.5">
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-sky-700">💡 Tóm tắt cho dễ hiểu — KHÔNG PHẢI VĂN BẢN LUẬT</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{v.giaiThich.tom}</p>
                        {(v.giaiThich.y?.length || 0) > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {v.giaiThich.y!.map((y, i) => <li key={i} className="text-[12.5px] leading-snug text-slate-600">• {y}</li>)}
                          </ul>
                        )}
                        {v.giaiThich.luuY && (
                          <p className="mt-1.5 rounded-lg bg-white/80 px-2 py-1 text-[12px] font-semibold leading-snug text-sky-900">Lưu ý: {v.giaiThich.luuY}</p>
                        )}
                      </div>
                    )}

                    {/* Điều luật trong kho mà công văn trích (bấm là mở), và điều nên đọc kèm */}
                    {(v.danChieu.some((z) => z.ma && z.so) || (v.lienQuan?.length || 0) > 0) && (
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">🔗 Điều luật liên quan có trong kho</p>
                        {v.danChieu.filter((z) => z.ma && z.so).map((z, i) => {
                          const kz = kho.find((y) => y.ma === z.ma);
                          return (
                            <div key={i} className="mt-1 text-[12px] leading-snug text-slate-600">
                              <button onClick={() => moDieuTuTk(z.ma!, z.so!)}
                                className="mr-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11.5px] font-semibold text-slate-700 hover:border-[#0A2540]">
                                Điều {z.so}{z.khoan ? ` (khoản ${z.khoan})` : ''} · {kz ? nhanNgan(kz.ma, kz.soHieu) : z.ma}
                              </button>
                              công văn trích: “{z.chu}”
                              {z.canh && z.luuY && (
                                <p className="mt-0.5 rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-rose-800">❓ Cần kiểm hiệu lực: {z.luuY}</p>
                              )}
                            </div>
                          );
                        })}
                        {(v.lienQuan || []).map((z, i) => {
                          const kz = kho.find((y) => y.ma === z.ma);
                          return (
                            <div key={'l' + i} className="mt-1 text-[12px] leading-snug text-slate-600">
                              <button onClick={() => moDieuTuTk(z.ma, z.so)}
                                className="mr-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11.5px] font-semibold text-slate-700 hover:border-[#0A2540]">
                                Điều {z.so} · {kz ? nhanNgan(kz.ma, kz.soHieu) : z.ma}
                              </button>
                              nên đọc kèm (công văn không trích){z.lyDo ? `: ${z.lyDo}` : ''}
                            </div>
                          );
                        })}
                        {(v.vanBanNhacToi || []).some((z) => !z.ma) && (
                          <p className="mt-1.5 text-[11.5px] leading-snug text-slate-500">
                            Công văn còn nhắc tới (CHƯA có trong kho): {(v.vanBanNhacToi || []).filter((z) => !z.ma).map((z) => z.soHieu).join(' · ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* NGUYÊN VĂN — trích yếu, kính gửi, từng đoạn, chú thích cuối trang, nơi nhận, người ký */}
                    <p className="mt-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                      Nguyên văn{v.nguonChu === 'may-doc-anh-quet' ? ' (chữ máy đọc từ ảnh, đã soát)' : ''}
                    </p>
                    <div className="mt-1 rounded-xl border border-slate-200 bg-white p-2.5 text-[13.5px] leading-relaxed text-slate-800">
                      <p className="text-[11.5px] leading-snug text-slate-500">
                        {v.coQuanChuQuan ? `${v.coQuanChuQuan} · ` : ''}<b className="text-slate-700">{v.coQuan}</b>
                        <br />Số: {v.soHieu}{v.diaDanh && ngayKy.length === 3 ? ` · ${v.diaDanh}, ngày ${ngayKy[2]}/${ngayKy[1]}/${ngayKy[0]}` : ''}
                      </p>
                      <p className="mt-2 text-center text-[13px] font-semibold leading-snug">{v.ten}</p>
                      {v.kinhGui && <p className="mt-2 text-center text-[13px]">Kính gửi: {v.kinhGui}</p>}
                      <div className="mt-2 space-y-2">
                        {v.doan.map((d, i) => <p key={i} className="whitespace-pre-line">{noiDungTk(d, v)}</p>)}
                      </div>
                      {(v.chuThich?.length || 0) > 0 && (
                        <div className="mt-3 space-y-0.5 border-t border-slate-200 pt-1.5 text-[11.5px] leading-snug text-slate-600">
                          {v.chuThich!.map((c) => <p key={c.so}><sup className="font-bold">{c.so}</sup> {c.chu}</p>)}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap justify-between gap-3 text-[11.5px] leading-snug">
                        {(v.noiNhan?.length || 0) > 0 && (
                          <div>
                            <p className="font-semibold italic">Nơi nhận:</p>
                            {v.noiNhan!.map((z, i) => <p key={i}>- {z}</p>)}
                          </div>
                        )}
                        <div className="text-center">
                          {(v.chucVuKy || []).map((z, i) => <p key={i} className="font-bold">{z}</p>)}
                          {v.nguoiKy && <p className="mt-2 font-bold">{v.nguoiKy}</p>}
                        </div>
                      </div>
                    </div>
                    {v.ghiChuChu && <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{v.ghiChuChu}</p>}
                    {(v.suaMayDoc?.length || 0) > 0 && (
                      <details className="mt-1 text-[11px] leading-snug text-slate-400">
                        <summary className="cursor-pointer font-semibold">Máy đọc sai {v.suaMayDoc!.length} chỗ — đã sửa theo ảnh</summary>
                        <ul className="mt-0.5 space-y-0.5">
                          {v.suaMayDoc!.map((s, i) => <li key={i}>“{s.may}” → “{s.dung}”{s.ghi ? ` (${s.ghi})` : ''}</li>)}
                        </ul>
                      </details>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-1.5 border-t bg-amber-50/60 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                {v?.banGoc && (
                  <a href={v.banGoc} target="_blank" rel="noreferrer"
                    className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 text-center text-[12.5px] font-bold text-white">📄 Xem bản gốc (PDF)</a>
                )}
                <button onClick={() => setDocTk(null)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-500">Đóng</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── THANH ĐIỀU HƯỚNG DƯỚI ĐÁY — chỉ trên điện thoại ──
          Ngón cái với tới được, không phải với lên đỉnh màn hình. Đây là cách mọi app
          điện thoại làm, và là lý do bỏ hàng thẻ ở đầu trang đi. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto flex max-w-lg">
          {([['tinhhuong', '🧭', 'Tình huống', false],
             ['luat', '⚖️', 'Toàn văn', false],
             ['the', '🎴', 'Thẻ ôn', true],
             ['sodo', '🧠', 'Sơ đồ', false],
             ['danhmuc', '📚', 'Danh mục', false]] as const).map(([k, ic, nhan, dem]) => {
            const dang = k === 'the' ? (the === 'sodo' && cheDoHoc === 'the')
              : k === 'sodo' ? (the === 'sodo' && cheDoHoc === 'sodo') : the === k;
            return (
              <button key={k} onClick={() => {
                if (k === 'the') { setThe('sodo'); setCheDoHoc('the'); }
                else if (k === 'sodo') { setThe('sodo'); setCheDoHoc('sodo'); }
                else setThe(k as typeof the);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold ${dang ? 'text-[#0A2540]' : 'text-slate-400'}`}>
                <span className="text-[19px] leading-none">{ic}</span>
                {nhan}
                {dem && theHomNay.length > 0 && (
                  <span className="absolute right-[18%] top-1 rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {theHomNay.length}
                  </span>
                )}
                {dang && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[#0A2540]" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── THẺ XEM NHANH ── nổi ngay dưới chỗ vừa bấm, đọc xong đóng lại là về chỗ cũ. */}
      {xemNhanh && (() => {
        const v = cacVb[xemNhanh.ma];
        const d = v?.dieu.find((z) => z.so === xemNhanh.so);
        const k = kho.find((z) => z.ma === xemNhanh.ma);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setXemNhanh(null)} />
            <div className="fixed z-50 w-[min(92vw,420px)] rounded-2xl border-2 border-sky-300 bg-white p-3 shadow-xl"
              style={{ left: Math.max(8, Math.min(xemNhanh.x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 440)),
                       top: Math.min(xemNhanh.y + 6, (typeof window !== 'undefined' ? window.innerHeight : 600) - 260) }}>
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-[10.5px] font-bold uppercase tracking-wide text-sky-700">
                  👁 Xem nhanh · {k ? nhanNgan(k.ma, k.soHieu) : xemNhanh.ma}
                </p>
                <button onClick={() => setXemNhanh(null)} className="shrink-0 text-slate-400 hover:text-slate-700">✕</button>
              </div>
              {!d ? <p className="mt-1 text-[13px] text-slate-400">Đang mở…</p> : (
                <>
                  <p className="mt-0.5 text-[14px] font-extrabold leading-snug text-[#0A2540]">Điều {d.so}. {d.tieuDe}</p>
                  <div className="mt-1 max-h-[38vh] space-y-1 overflow-y-auto text-[13px] leading-relaxed text-slate-700">
                    {d.khoan.slice(0, 4).map((x, i) => (
                      <p key={i} className="whitespace-pre-line">
                        {x.so ? <b className="text-[#0A2540]">{x.so}. </b> : null}
                        {x.chu.length > 460 ? x.chu.slice(0, 460) + '…' : x.chu}
                      </p>
                    ))}
                    {d.khoan.length > 4 && <p className="text-[12px] italic text-slate-400">…còn {d.khoan.length - 4} khoản nữa</p>}
                  </div>
                  <button onClick={() => { moDieu(xemNhanh.ma, xemNhanh.so); setXemNhanh(null); }}
                    className="mt-2 w-full rounded-lg bg-[#0A2540] px-3 py-1.5 text-[12.5px] font-bold text-white">
                    Mở hẳn điều này →
                  </button>
                </>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
