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
// Thẻ học soạn tay cho phần CON SỐ và MỐC THỜI GIAN — thứ bắt buộc phải thuộc lòng.
type TheSo = { hoi: string; dap: string; nho?: string; chuDe: string; dan?: Dan[] };
type KhoTheSo = { canhBao: string; the: TheSo[] };
// Một thẻ đã dựng xong, sẵn sàng đưa ra hỏi.
type TheHoc = { khoa: string; loai: string; chuDe: string; hoi: string; dap: string; nho?: string; dan?: Dan[] };

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
  if (loai && loai.startsWith('QH')) return `Luật ${so}/${nam}`;
  if (loai && loai.startsWith('TT')) return `TT ${so}/${nam}`;
  return `NĐ ${so}/${nam}`;
};
const ngayVn = (s: string) => (s ? s.split('-').reverse().join('/') : '');
// Dấu hiệu nhỏ đặt trước tên điều để nhìn danh sách là biết ngay điều nào còn dùng được.
// Dấu đứng đầu tên điều trong danh sách — nhìn lướt là biết điều nào còn dùng được.
// ⛔ hết hiệu lực · ⚠️ bị bãi bỏ một phần · ✏️ đã bị sửa đổi, bổ sung.
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
  { ten: 'Hạn mức & thời hạn', icon: '📏', tim: 'hạn mức' },
  { ten: 'Đất nông nghiệp', icon: '🌾', tim: 'đất nông nghiệp' },
  { ten: 'Đất ở', icon: '🏠', tim: 'đất ở' },
  { ten: 'Tách thửa, hợp thửa', icon: '✂️', tim: 'tách thửa' },
  { ten: 'Tranh chấp, khiếu nại', icon: '⚖️', tim: 'tranh chấp đất đai' },
  { ten: 'Quy hoạch sử dụng đất', icon: '🗺️', tim: 'quy hoạch sử dụng đất' },
  { ten: 'Tiền sử dụng đất, thuê đất', icon: '🧾', tim: 'tiền sử dụng đất' },
  { ten: 'Thừa kế, tặng cho, chuyển nhượng', icon: '📜', tim: 'chuyển nhượng' },
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
  const [chuoi, setChuoi] = useState(0);   // chuỗi ngày học liên tiếp
  const [theSo, setTheSo] = useState(0);
  const [datLat, setDatLat] = useState(false);
  const [th, setTh] = useState<KhoTinhHuong | null>(null);
  const [tn, setTn] = useState<KhoTuNgu | null>(null);
  // XEM NHANH: bấm vào một dẫn chiếu thì hiện thẻ ngay tại chỗ, KHÔNG nhảy đi mất — đang
  // đọc dở một điều mà bị cuốn sang điều khác là mất mạch. Muốn đọc kỹ thì bấm "Mở hẳn".
  const [xemNhanh, setXemNhanh] = useState<{ ma: string; so: number; x: number; y: number } | null>(null);
  // NGĂN ĐỌC BÊN CẠNH: đang xem sơ đồ hay tình huống mà bấm vào một điều thì mở điều đó ở
  // ngăn bên, sơ đồ giữ nguyên phía sau — đóng ngăn là về đúng chỗ đang xem dở.
  // Trước đây bấm một cái là nhảy thẳng sang thẻ "Toàn văn", mất sạch chỗ đang đứng.
  const [docBen, setDocBen] = useState<{ ma: string; so: number } | null>(null);
  const [moSuaDoi, setMoSuaDoi] = useState<Record<string, boolean>>({});
  const [moLuocDo, setMoLuocDo] = useState(false);
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
  const [dm, setDm] = useState<VanBanNgan[]>([]);
  const [timDm, setTimDm] = useState('');
  const [locLoai, setLocLoai] = useState('');
  const oNoiDung = useRef<HTMLDivElement | null>(null);
  const daTai = useRef<Record<string, Promise<VanBan>>>({});

  const vb = cacVb[maVb] || null;

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

  useEffect(() => {
    if (!duocXem) return;
    fetch('/luat/_kho.json').then((r) => r.json()).then((ds: KhoItem[]) => setKho(ds)).catch(() => {});
    fetch('/luat/giai-thich.json').then((r) => r.json()).then((d: GiaiThich) => setGt(d)).catch(() => {});
    fetch('/luat/so-do.json').then((r) => r.json()).then((d: SoDo) => setSd(d)).catch(() => {});
    fetch('/luat/tinh-huong.json').then((r) => r.json()).then((d: KhoTinhHuong) => setTh(d)).catch(() => {});
    fetch('/luat/the-so.json').then((r) => r.json()).then((d: KhoTheSo) => setTheSo2(d)).catch(() => {});
    fetch('/luat/tu-ngu.json').then((r) => r.json()).then(setTn).catch(() => {});
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
  useEffect(() => { if (the === 'danhmuc' && !dm.length) fetch('/luat/danh-muc.json').then((r) => r.json()).then((d) => setDm(d.vanBan || [])).catch(() => {}); }, [the, dm.length]);

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
    // 5. Thẻ con số soạn tay.
    for (const [i, t] of (theSo2?.the || []).entries()) {
      ra.push({ khoa: 'so:' + i, loai: 'Con số', chuDe: t.chuDe, hoi: t.hoi, dap: t.dap, nho: t.nho, dan: t.dan });
    }
    return ra;
  }, [gt, th, theSo2, tn, cacVb, kho]);

  const chuDeCo = useMemo(() => [...new Set(dsThe.map((t) => t.chuDe))].sort(), [dsThe]);
  const theTheoChuDe = useMemo(
    () => (chuDeHoc ? dsThe.filter((t) => t.chuDe === chuDeHoc) : dsThe), [dsThe, chuDeHoc]);

  // Thẻ tới hạn ôn hôm nay. TRỘN NGẪU NHIÊN (nhưng cố định theo ngày) — học xen kẽ chủ đề
  // nhớ lâu hơn học dồn một chủ đề, đây là kỹ thuật "interleaving".
  const theHomNay = useMemo(() => {
    const ds = theTheoChuDe.filter((t) => !boThe[t.khoa] || (boThe[t.khoa] as any).ngayOn <= homNay());
    const hat = homNay().split('-').join('');
    return ds.map((t, i) => ({ t, r: (Number(hat) + i * 2654435761) % 1000003 }))
      .sort((a, b) => a.r - b.r).map((x) => x.t);
  }, [theTheoChuDe, boThe]);

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
    return g === 1 ? 'ôn lại hôm nay' : n < 30 ? `${n} ngày` : n < 365 ? `${Math.round(n / 30)} tháng` : `${(n / 365).toFixed(1)} năm`;
  };

  const traLoiThe = (khoa: string, g: number) => {
    setBoThe((m) => {
      const c: any = m[khoa];
      const k = tinhThe(c, g);
      // Bấm "quên" thì cho quay lại NGAY trong buổi học, không đợi hôm sau — nhớ lại được
      // trong cùng buổi mới là học lại, để tới mai là mất công học từ đầu.
      const ngayOn = g === 1 ? homNay() : congNgay(soNgay(k.S));
      const moi = { ...m, [khoa]: { ...k, ngayOn, mocOn: Date.now() } as any };
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

  // Chuẩn bị sẵn chuỗi không dấu của từng điều để tìm cho nhanh (làm một lần cho mỗi văn bản).
  const chiMuc = useMemo(() => {
    const ra: Record<string, { d: Dieu; ma: string; kho: string }[]> = {};
    for (const ma of Object.keys(cacVb)) {
      ra[ma] = cacVb[ma].dieu.map((d) => ({
        d, ma,
        kho: kd(`Điều ${d.so} ${d.tieuDe} ${d.khoan.map((k) => k.chu + ' ' + k.diem.map((x) => x.chu).join(' ')).join(' ')}`),
      }));
    }
    return ra;
  }, [cacVb]);

  const ketQua = useMemo(() => {
    const q = kd(tim.trim());
    // Tìm cả kho: xếp theo thứ tự văn bản trong danh mục để kết quả không nhảy lung tung.
    let ds = timCaKho ? kho.flatMap((x) => chiMuc[x.ma] || []) : (chiMuc[maVb] || []);
    if (chiGhim) ds = ds.filter((x) => ghim.includes(khoaGhim(x.ma, x.d.so)));
    if (chiGt) ds = ds.filter((x) => !!gt?.muc[khoaGhim(x.ma, x.d.so)]);
    if (!q) return ds;
    // Gõ "điều 75" hay "75" -> nhảy thẳng tới điều đó
    const soDieu = /^(?:dieu\s*)?(\d{1,3})$/.exec(q);
    if (soDieu) {
      const s = Number(soDieu[1]);
      const t = ds.filter((x) => x.d.so === s);
      if (t.length) return t;
    }
    return ds.filter((x) => x.kho.includes(q));
  }, [chiMuc, tim, chiGhim, chiGt, gt, ghim, timCaKho, maVb, kho]);

  const dieuDangXem = useMemo(() => (vb && chon != null ? vb.dieu.find((d) => d.so === chon) || null : null), [vb, chon]);

  const doiVanBan = (ma: string) => {
    if (ma === maVb) return;
    setMaVb(ma); setChon(null); setMoChuong({}); setXemPhuLuc(false);
  };
  const moDieu = (ma: string, so: number) => {
    if (ma !== maVb) { setMaVb(ma); setMoChuong({}); }
    setXemPhuLuc(false); setChon(so); setThe('luat');
    oNoiDung.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // Đang ở thẻ nào thì mở kiểu đó: ở "Toàn văn" thì nhảy tới điều luôn; ở sơ đồ, tình
  // huống, thẻ học thì mở NGĂN BÊN để không mất chỗ đang xem.
  const moDieuHopLy = (ma: string, so: number) => {
    if (the === 'luat') moDieu(ma, so);
    else { taiVb(ma).catch(() => {}); setDocBen({ ma, so }); }
  };

  // Tô vàng chỗ khớp từ khoá trong nguyên văn (chỉ tô, không đổi chữ).
  const toVang = (chu: string) => {
    const q = tim.trim();
    if (!q || q.length < 2) return chu;
    const k = kd(chu), qq = kd(q);
    const ra: React.ReactNode[] = [];
    let i = 0, j = k.indexOf(qq);
    while (j >= 0) {
      ra.push(chu.slice(i, j));
      ra.push(<mark key={i + '-' + j} className="rounded bg-amber-200 px-0.5">{chu.slice(j, j + q.length)}</mark>);
      i = j + q.length;
      j = k.indexOf(qq, i);
    }
    ra.push(chu.slice(i));
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

  const chep = (d: Dieu) => {
    const t = `Điều ${d.so}. ${d.tieuDe}\n` + d.khoan.map((k) =>
      (k.so ? `${k.so}. ` : '') + k.chu + (k.diem.length ? '\n' + k.diem.map((x) => `${x.ky}) ${x.chu}`).join('\n') : '')).join('\n')
      + `\n\n(${vb?.ten} — ${vb?.soHieu})`;
    navigator.clipboard?.writeText(t);
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
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-extrabold text-[#0A2540] sm:text-2xl">⚖️ Tra cứu &amp; học Luật Đất đai</h1>
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">Nội bộ</span>
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
        {kho.length ? <><b className="text-[#0A2540]">{kho.length} văn bản</b> · <b className="text-[#0A2540]">{tongDieu} điều</b> · nguyên văn từ bản PDF ký số Công báo</> : 'Đang tải…'}
      </p>

      <div className="mt-3 flex gap-1.5">
        {([['tinhhuong', '🧭 Tình huống'], ['luat', '⚖️ Toàn văn'],
           ['sodo', `🎴 Học thuộc${theHomNay.length ? ` (${theHomNay.length})` : ''}`],
           ['danhmuc', '📚 Danh mục']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setThe(k); if (k === 'sodo') setCheDoHoc('the'); }}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${the === k ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{l}</button>
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
                    <p className="mt-1 text-[12.5px] leading-snug text-slate-500">{x.tom}</p>
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
          {/* Hai cách học, cùng một kho kiến thức: NHÌN TỔNG THỂ (sơ đồ) và NHỚ LÂU (thẻ lật). */}
          <div className="flex gap-1.5">
            {([['the', `🎴 Thẻ ôn tập${theHomNay.length ? ` (${theHomNay.length})` : ''}`], ['sodo', '🧠 Sơ đồ tổng thể']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setCheDoHoc(k)}
                className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition ${cheDoHoc === k ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{l}</button>
            ))}
          </div>

          {cheDoHoc === 'the' && (
            <div className="mt-3">
              {/* MỘT DÒNG TRẠNG THÁI duy nhất — trước đây chỗ này có 2 đoạn chữ dài, 4 ô
                  màu và một hàng chip chủ đề dài dằng dặc, nhìn rối mà chẳng dùng tới. */}
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <select value={chuDeHoc} onChange={(e) => { setChuDeHoc(e.target.value); setTheSo(0); setDatLat(false); }}
                  className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1 text-[12.5px] font-semibold text-[#0A2540] outline-none">
                  <option value="">Tất cả chủ đề ({dsThe.length} thẻ)</option>
                  {chuDeCo.map((c) => (
                    <option key={c} value={c}>{c} ({dsThe.filter((t) => t.chuDe === c).length})</option>
                  ))}
                </select>
                <span className="font-bold text-sky-700">Hôm nay {theHomNay.length}</span>
                <span className="text-slate-300">·</span>
                <span className="font-bold text-emerald-700">Thuộc {daThuoc}/{theTheoChuDe.length}</span>
                {theKho > 0 && <><span className="text-slate-300">·</span>
                  <span className="font-bold text-rose-600" title="Thẻ quên từ 4 lần trở lên — nên mở lại điều gốc đọc kỹ">Khó {theKho}</span></>}
                {chuoi > 1 && <><span className="text-slate-300">·</span><span className="font-bold text-amber-600">🔥 {chuoi} ngày</span></>}
                <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${theTheoChuDe.length ? (daThuoc / theTheoChuDe.length) * 100 : 0}%` }} />
                </div>
                <button onClick={() => setBatGo((v) => !v)}
                  title="Gõ đáp án bằng tay nhớ chắc hơn hẳn chỉ lật thẻ rồi gật đầu"
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${batGo ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-500'}`}>
                  ⌨ Gõ đáp án
                </button>
              </div>

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
                return (
                  <div className="mt-3">
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-slate-400">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{t.loai} · {t.chuDe}</span>
                        <span>{c.lan ? `đã ôn ${c.lan} lần · nhớ chắc ~${Math.round(c.S || 0)} ngày` : 'thẻ mới'}</span>
                      </div>
                      {kho4 && (
                        <p className="mt-1.5 rounded-lg bg-rose-50 px-2 py-1 text-[11.5px] font-semibold text-rose-700">
                          Thẻ này đã quên {c.sai} lần — nên mở điều gốc đọc lại một lượt rồi hãy ôn tiếp.
                        </p>
                      )}
                      <p className="mt-2 text-[16px] font-extrabold leading-snug text-[#0A2540]">{t.hoi}</p>
                      {!datLat ? (
                        <>
                          {batGo ? (
                            <textarea value={goThu} onChange={(e) => setGoThu(e.target.value)} rows={3}
                              placeholder="Gõ câu trả lời theo trí nhớ… (gõ đúng ý là được, không cần đúng từng chữ)"
                              className="mt-2 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0A2540]" />
                          ) : (
                            <p className="mt-2 text-[13px] italic leading-snug text-slate-500">
                              Tự trả lời trong đầu trước đã — nhớ lại được mới là học, đọc lại thì không.
                            </p>
                          )}
                          <button onClick={() => setDatLat(true)}
                            className="mt-3 w-full rounded-xl bg-[#0A2540] px-3 py-2.5 text-[14px] font-bold text-white">
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
                          <div className="mt-3 grid grid-cols-4 gap-1.5">
                            {([[1, 'Quên', 'border-rose-300 bg-rose-50 text-rose-700'],
                               [2, 'Khó', 'border-amber-300 bg-amber-50 text-amber-700'],
                               [3, 'Được', 'border-sky-300 bg-sky-50 text-sky-700'],
                               [4, 'Dễ', 'border-emerald-300 bg-emerald-50 text-emerald-700']] as const).map(([g, nhan, mau]) => (
                              <button key={g} onClick={() => traLoiThe(t.khoa, g)}
                                className={`rounded-xl border-2 px-1 py-2 text-[12.5px] font-bold ${mau}`}>
                                {nhan}<span className="block text-[10px] font-normal opacity-70">{hienNgay(c, g)}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-slate-400">
                      <button onClick={() => { setDatLat(false); setGoThu(''); setTheSo((i2) => i2 + 1); }} className="font-semibold hover:text-slate-700">Để lát nữa →</button>
                      <span>{(theSo % theHomNay.length) + 1}/{theHomNay.length}</span>
                      <button onClick={() => { if (confirm('Xoá hết tiến độ học thuộc?')) { setBoThe({}); try { localStorage.removeItem('luat-the-hoc'); } catch { /* */ } } }}
                        className="hover:text-rose-600">Học lại từ đầu</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {cheDoHoc === 'sodo' && (!sd ? <p className="mt-3 text-slate-400">Đang tải sơ đồ…</p> : (
            <>
              <p className="mt-3 text-[12.5px] leading-snug text-slate-500">
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
                    <button onClick={() => { setPhongTo(0.6); setDich({ x: 0, y: 0 }); setTieuDiem(null); }}
                      title="Thu nhỏ để thấy toàn bộ sơ đồ, đưa gốc về giữa"
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">⤢ Vừa màn hình</button>
                    <input value={timSoDo} onChange={(e) => setTimSoDo(e.target.value)}
                      placeholder="Tìm trong sơ đồ…"
                      className="ml-1 min-w-[140px] flex-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] outline-none focus:border-[#0A2540]" />
                    {timSoDo && <button onClick={() => setTimSoDo('')} className="text-slate-400">✕</button>}
                  </>
                )}
              </div>

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
          <p className="text-[12.5px] leading-snug text-slate-500">
            Toàn bộ văn bản về đất đai trên <b>Hệ thống văn bản của Chính phủ</b> — máy quét lần lượt từng mã văn bản
            rồi lọc theo từ khoá nên <b>không sót</b>. Bấm vào từng dòng để mở bản gốc trên cổng Chính phủ,
            hoặc tải thẳng tệp PDF ký số.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={timDm} onChange={(e) => setTimDm(e.target.value)} placeholder="Tìm trong danh mục (gõ không dấu cũng được)…"
              className="min-w-[240px] flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-[#0A2540]" />
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
        </div>
      )}

      {the === 'luat' && <>
      {/* ── CHỌN VĂN BẢN: MỘT Ô SỔ XUỐNG ──
          Trước đây bày 17 cái nút thành hàng cuộn ngang -> nhìn rối, lại phải kéo mới
          thấy hết. Nay gom vào một ô sổ xuống, chia nhóm Luật / Nghị định / Thông tư. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={maVb} onChange={(e) => doiVanBan(e.target.value)}
          className="min-w-[260px] flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-[14px] font-semibold text-[#0A2540] outline-none focus:border-[#0A2540]">
          {([['Đang áp dụng — Luật', (x: KhoItem) => !x.hetHieuLuc && x.soHieu.includes('/QH')],
             ['Đang áp dụng — Nghị định', (x: KhoItem) => !x.hetHieuLuc && x.soHieu.includes('NĐ-CP')],
             ['Đang áp dụng — Thông tư', (x: KhoItem) => !x.hetHieuLuc && x.soHieu.includes('/TT-')],
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
          tính sẵn: văn bản này dựa trên văn bản nào, và văn bản nào hướng dẫn nó. */}
      {vb && (() => {
        const k = kho.find((x) => x.ma === maVb);
        return (
          <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-slate-500">
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
      {/* Còn hiệu lực nhưng có điều đã bị bãi bỏ — đếm ra cho người đọc biết trước. */}
      {vb && !vb.hetHieuLuc && (() => {
        const bo = vb.dieu.filter((d) => d.tinhTrang?.loai === 'het-hieu-luc').length;
        const phan = vb.dieu.filter((d) => d.tinhTrang && d.tinhTrang.loai !== 'het-hieu-luc').length
          + vb.dieu.filter((d) => !d.tinhTrang && (d.suaDoi?.length || 0) > 0).length;
        if (!bo && !phan) return null;
        return (
          <p className="mt-1 text-[11.5px] leading-snug text-slate-500">
            Trong văn bản này: {bo > 0 && <><b className="text-rose-600">{bo} điều đã hết hiệu lực ⛔</b></>}
            {bo > 0 && phan > 0 && ' · '}
            {phan > 0 && <><b className="text-amber-600">{phan} điều bị sửa đổi / bãi bỏ một phần ⚠️</b></>}
            {' '}— nhìn dấu ở danh sách bên trái là biết.
          </p>
        );
      })()}

      {/* Ô TÌM — gõ không dấu vẫn ra; gõ số thì nhảy thẳng tới điều đó */}
      <div className="sticky top-0 z-10 -mx-3 mt-3 bg-white/95 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 px-3 py-2 focus-within:border-[#0A2540]">
          <span className="text-slate-400">🔍</span>
          <input value={tim} onChange={(e) => setTim(e.target.value)}
            placeholder="Gõ từ khoá hoặc số điều — vd: thu hoi dat, 75"
            className="w-full bg-transparent text-[15px] outline-none" />
          {tim && <button onClick={() => setTim('')} className="text-slate-400 hover:text-slate-700">✕</button>}
        </div>
        {/* MỘT HÀNG NÚT NHỎ, không xuống dòng lung tung. 14 chủ đề nhanh giấu sau nút
            "Chủ đề" — bấm mới xổ ra, nhìn đỡ rối hẳn. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button onClick={() => setMoChuDe((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${moChuDe ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
            🔖 Chủ đề {moChuDe ? '▴' : '▾'}
          </button>
          {/* Nhiều việc luật chỉ nói một câu rồi "Chính phủ quy định chi tiết" -> chữ thật nằm ở nghị định. */}
          <button onClick={() => setTimCaKho((v) => !v)} title="Tìm một lượt trong cả luật lẫn nghị định, thông tư"
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${timCaKho ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
            {dangTaiKho ? '⏳ đang mở…' : `🔎 Cả kho${timCaKho ? ' ✓' : ''}`}
          </button>
          <button onClick={() => { setChiGhim((v) => !v); setChon(null); setXemPhuLuc(false); }} title="Chỉ hiện những điều đã ghim"
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${chiGhim ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
            ⭐ {ghim.length}
          </button>
          {gt && (
            <button onClick={() => { setChiGt((v) => !v); setChon(null); setXemPhuLuc(false); }} title="Chỉ hiện những điều có giải thích ngắn"
              className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${chiGt ? 'border-sky-600 bg-sky-600 text-white' : 'border-sky-300 bg-sky-50 text-sky-700'}`}>
              💡 {Object.keys(gt.muc).length}
            </button>
          )}
          {(tim || chiGhim || chiGt) && (
            <button onClick={() => { setTim(''); setChiGhim(false); setChiGt(false); }}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-500">✕ Bỏ lọc</button>
          )}
        </div>
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
        <div className="mt-3 grid gap-3 lg:grid-cols-[360px_1fr]">
          {/* Điều ĐẺ RA VỀ SAU: Luật sửa đổi 1998/2001 thêm hẳn Điều 22a, 78b… vào Luật 1993.
              Bản gốc 1993 không có mấy điều này, mà chèn chữ vào giữa nguyên văn là sửa luật
              gốc — không được phép. Nên hiện thành dòng gạch đứt nối ngay sau điều liền trước,
              bấm vào thì mở đúng khoản của luật sửa đổi, nơi có nguyên văn của nó. */}
          {/* ── CỘT TRÁI: cây chương → điều, hoặc kết quả tìm ── */}
          <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <p className="sticky top-0 z-10 border-b bg-slate-50/95 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur">
              {tim || chiGhim || chiGt ? `${ketQua.length} điều khớp${timCaKho ? ' · cả kho' : ''}` : `${vb.chuong.length ? vb.chuong.length + ' chương · ' : ''}${vb.dieu.length} điều`}
            </p>
            {tim || chiGhim || chiGt ? (
              ketQua.length === 0
                ? <p className="p-3 text-[13px] text-slate-400">Không tìm thấy điều nào. Thử từ khoá khác, gõ số điều, hoặc bật <b>Tìm cả kho</b>.</p>
                : ketQua.map((x) => (
                  <button key={x.ma + ':' + x.d.so} onClick={() => moDieu(x.ma, x.d.so)}
                    className={`block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 ${x.ma === maVb && chon === x.d.so ? 'bg-[#0A2540]/[0.05]' : ''}`}>
                    <span className={`block text-[13px] font-bold ${x.d.tinhTrang?.loai === 'het-hieu-luc' ? 'text-slate-400 line-through decoration-rose-300' : 'text-[#0A2540]'}`}>
                      {ghim.includes(khoaGhim(x.ma, x.d.so)) ? '⭐ ' : ''}{gt?.muc[khoaGhim(x.ma, x.d.so)] ? '💡 ' : ''}{dauTinhTrang(x.d)}Điều {x.d.so}. {x.d.tieuDe}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {timCaKho && <span className="mr-1 rounded bg-slate-100 px-1 font-bold text-slate-500">{nhanNgan(x.ma, cacVb[x.ma]?.soHieu || '')}</span>}
                      {x.d.chuong ? <>Chương {x.d.chuong}{x.d.muc ? ` · Mục ${x.d.muc}` : ''}</> : null}
                    </span>
                  </button>
                ))
            ) : vb.chuong.length === 0 ? (
              // Văn bản ngắn không chia chương (Luật 43/2024, Nghị định 42/2024) — liệt kê
              // thẳng từng điều. Không có nhánh này thì cột trái trống trơn.
              vb.dieu.map((d) => (
                <div key={d.so}>
                <button onClick={() => moDieu(vb.ma, d.so)}
                  className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-[12.5px] hover:bg-slate-50 ${chon === d.so ? 'bg-[#0A2540]/[0.05] font-semibold' : 'text-slate-600'}`}>
                  <span className={d.tinhTrang?.loai === 'het-hieu-luc' ? 'text-slate-400 line-through decoration-rose-300' : ''}>
                    {ghim.includes(khoaGhim(vb.ma, d.so)) ? '⭐ ' : ''}{gt?.muc[khoaGhim(vb.ma, d.so)] ? '💡 ' : ''}{dauTinhTrang(d)}Điều {d.so}. {d.tieuDe}
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
                          {ghim.includes(khoaGhim(vb.ma, d.so)) ? '⭐ ' : ''}{gt?.muc[khoaGhim(vb.ma, d.so)] ? '💡 ' : ''}{dauTinhTrang(d)}Điều {d.so}. {d.tieuDe}
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
          <div ref={oNoiDung} className="rounded-xl border border-slate-200 bg-white p-4">
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
                <p className="mt-2 text-sm">Chọn một điều ở cột bên trái, hoặc gõ từ khoá để tìm.</p>
                <p className="mt-1 text-[12px]">Mẹo: gõ thẳng <b>số điều</b> (ví dụ <b>79</b>) là nhảy tới ngay.</p>
                <p className="mt-1 text-[12px]">Việc nào luật ghi &ldquo;Chính phủ quy định chi tiết&rdquo; thì bật <b>Tìm cả kho</b> để ra luôn nghị định.</p>
              </div>
            ) : (
              <article>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {vb.soHieu}
                  {dieuDangXem.chuong ? <> · Chương {dieuDangXem.chuong} — {dieuDangXem.chuongTen}</> : null}
                  {dieuDangXem.muc ? <> · Mục {dieuDangXem.muc} — {dieuDangXem.mucTen}</> : null}
                </p>
                <div className="mt-1 flex items-start gap-2">
                  <h2 className="min-w-0 flex-1 text-[17px] font-extrabold leading-snug text-[#0A2540]">
                    Điều {dieuDangXem.so}. {toVang(dieuDangXem.tieuDe)}
                  </h2>
                  <button onClick={() => doiGhim(vb.ma, dieuDangXem.so)} title="Ghim để học lại"
                    className={`shrink-0 rounded-lg border px-2 py-1 text-[12px] font-semibold ${ghim.includes(khoaGhim(vb.ma, dieuDangXem.so)) ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500'}`}>
                    {ghim.includes(khoaGhim(vb.ma, dieuDangXem.so)) ? '⭐ Đã ghim' : '☆ Ghim'}
                  </button>
                  <button onClick={() => chep(dieuDangXem)} title="Sao chép nguyên văn"
                    className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[12px] font-semibold text-slate-500">⧉ Chép</button>
                </div>

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
                <div className="mt-1 space-y-2.5 text-[14px] leading-relaxed text-slate-800">
                  {dieuDangXem.khoan.map((k, i) => (
                    <div key={i}>
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

              <div className="flex gap-1.5 border-t bg-slate-50 px-3 py-2">
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
