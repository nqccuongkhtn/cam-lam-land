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
// không tự chế "chủ đề" theo cảm tính. Muốn tra nhanh theo việc thật (sổ đỏ, đền bù, tách thửa…)
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
type Dieu = { so: number; tieuDe: string; chuong: string; chuongTen: string; muc: string | null; mucTen: string; khoan: Khoan[]; dan?: Dan[]; duocDan?: Dan[] };
type VanBan = { ma: string; soHieu: string; ngay: string; ten: string; nguon: string; phuLuc?: string; hetHieuLuc?: string; chuong: { so: string; ten: string }[]; dieu: Dieu[] };

type KhoItem = { ma: string; soHieu: string; ngay: string; ten: string; soDieu: number; hetHieuLuc?: string;
  nguoiKy?: string; ngayHieuLuc?: string; dan?: string[]; duocDan?: string[];
  // Lược đồ văn bản: bốn loại quan hệ, tính sẵn lúc build từ chính chữ của văn bản.
  canCu?: string[]; laCanCuCho?: string[]; thayThe?: string[]; biThayTheBoi?: string[];
  baiBoMotPhan?: { ma: string; phan: string }[]; biBaiBoMotPhanBoi?: string[] };
// TÌNH HUỐNG = đi theo việc thật, mỗi bước một câu hỏi, có nhánh trả lời, bước nào cũng dẫn nguồn.
type NhanhTH = { neu: string; thi: string; canh?: boolean; dan?: Dan[] };
type BuocTH = { hoi: string; y: string; dan?: Dan[]; nhanh?: NhanhTH[] };
// BỘ HỒ SƠ: giấy tờ phải nộp, nộp ở đâu, bao lâu, nhận được gì — lấy từ Nghị định 101/2024.
type GiayTo = { ten: string; mau?: string; batBuoc?: boolean; y?: string };
type HoSo = { nhan: string; gom: GiayTo[]; noiNop: string[]; thoiHan: string; ketQua: string; dan?: Dan[] };
type VuongMac = { gap: string; go: string; dan?: Dan[] };
type TinhHuong = { ma: string; icon: string; ten: string; tom: string; buoc: BuocTH[];
  ketLuan?: string[]; danKetLuan?: Dan[]; hoSo?: HoSo; vuongMac?: VuongMac[] };
type KhoTinhHuong = { canhBao: string; ds: TinhHuong[] };
// Giải thích do người làm web viết, KHÔNG phải chữ luật — luôn để trong khung riêng, màu khác.
type GiaiThich = { canhBao: string; muc: Record<string, { y: string; nho: string }> };
type NutSoDo = { ten: string; y: string; dan: { ma: string; so?: number }[] };
// "neo" = SỐ NEO GHI NHỚ: mỗi nhánh gắn một con số để bám vào (3 nhóm đất, 5 điều kiện,
// 7 bước…). Nhớ con số là gọi ra được cả nhánh — mẹo học cũ mà hiệu quả.
type NhanhSoDo = { ten: string; icon: string; mau: string; y: string; neo?: string; con: NutSoDo[] };
type SoDo = { canhBao: string; nhanh: NhanhSoDo[] };

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

// CHỦ ĐỀ NHANH = câu tìm sẵn theo việc người ta hay hỏi. Không phải phân loại pháp lý,
// chỉ là lối tắt — nên để nguyên chữ trong luật để tìm cho trúng.
const CHU_DE: { ten: string; icon: string; tim: string }[] = [
  { ten: 'Sổ đỏ / cấp giấy chứng nhận', icon: '📗', tim: 'giấy chứng nhận quyền sử dụng đất' },
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
  const [kieuSoDo, setKieuSoDo] = useState<'danhsach' | 'khungve'>('danhsach');
  const [phongTo, setPhongTo] = useState(1);
  const [timSoDo, setTimSoDo] = useState('');
  const [boThe, setBoThe] = useState<Record<string, { hop: number; ngayOn: string }>>({});
  const [theSo, setTheSo] = useState(0);
  const [datLat, setDatLat] = useState(false);
  const [th, setTh] = useState<KhoTinhHuong | null>(null);
  // XEM NHANH: bấm vào một dẫn chiếu thì hiện thẻ ngay tại chỗ, KHÔNG nhảy đi mất — đang
  // đọc dở một điều mà bị cuốn sang điều khác là mất mạch. Muốn đọc kỹ thì bấm "Mở hẳn".
  const [xemNhanh, setXemNhanh] = useState<{ ma: string; so: number; x: number; y: number } | null>(null);
  const [thChon, setThChon] = useState<string>('');
  // Đánh dấu đã chuẩn bị xong từng giấy tờ — lưu trong máy để hôm sau mở lại vẫn còn.
  const [daCo, setDaCo] = useState<Record<string, boolean>>({});
  const [moVuong, setMoVuong] = useState<Record<string, boolean>>({});
  const [the, setThe] = useState<'luat' | 'tinhhuong' | 'sodo' | 'danhmuc'>('luat');
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
    try { setBoThe(JSON.parse(localStorage.getItem('luat-the-hoc') || '{}')); } catch { /* */ }
    try { setDaCo(JSON.parse(localStorage.getItem('luat-ho-so') || '{}')); } catch { /* */ }
  }, []);

  const danhDauGiayTo = (khoa: string) => setDaCo((m) => {
    const moi = { ...m, [khoa]: !m[khoa] };
    try { localStorage.setItem('luat-ho-so', JSON.stringify(moi)); } catch { /* */ }
    return moi;
  });

  // Khoảng cách ôn theo hộp Leitner: thuộc thì đẩy xa dần, quên thì kéo về hộp 1.
  const CACH_ON = [1, 3, 7, 16, 35];
  const homNay = () => new Date().toISOString().slice(0, 10);
  const congNgay = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  // Bộ thẻ = những điều đã có giải thích ngắn (39 điều then chốt).
  const dsThe = useMemo(() => (gt ? Object.keys(gt.muc) : []), [gt]);
  const theHomNay = useMemo(
    () => dsThe.filter((k) => !boThe[k] || boThe[k].ngayOn <= homNay()),
    [dsThe, boThe]);
  const daThuoc = useMemo(() => dsThe.filter((k) => (boThe[k]?.hop || 0) >= 4).length, [dsThe, boThe]);

  const traLoiThe = (khoa: string, muc: 'quen' | 'tam' | 'thuoc') => {
    setBoThe((m) => {
      const cu = m[khoa]?.hop || 1;
      const hop = muc === 'quen' ? 1 : muc === 'thuoc' ? Math.min(5, cu + 1) : cu;
      const moi = { ...m, [khoa]: { hop, ngayOn: congNgay(muc === 'quen' ? 1 : CACH_ON[hop - 1]) } };
      try { localStorage.setItem('luat-the-hoc', JSON.stringify(moi)); } catch { /* */ }
      return moi;
    });
    setDatLat(false);
    setTheSo((i) => i + 1);
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
  const NutDan = ({ d, nho }: { d: Dan; nho?: boolean }) => {
    const v = kho.find((x) => x.ma === d.ma);
    return (
      <button onClick={() => { if (d.so) moDieu(d.ma, d.so); else { doiVanBan(d.ma); setThe('luat'); } }}
        title={v ? `${v.ten} — ${v.soHieu}` : d.ma}
        className={`rounded-md border border-slate-200 bg-white font-semibold text-slate-600 transition hover:border-[#0A2540] hover:text-[#0A2540] ${nho ? 'px-1.5 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[11.5px]'}`}>
        {d.so ? `Điều ${d.so}` : '📄'} · {v ? nhanNgan(v.ma, v.soHieu) : d.ma}
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
        {([['tinhhuong', '🧭 Tình huống'], ['luat', '⚖️ Toàn văn'], ['sodo', '🧠 Sơ đồ tư duy'], ['danhmuc', '📚 Danh mục']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setThe(k)}
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

                {/* ── BỘ HỒ SƠ ── ba ô tóm tắt (bao lâu · nộp đâu · nhận gì) rồi tới danh sách
                    giấy tờ bấm đánh dấu được. Đây mới là thứ dùng để ĐI LÀM VIỆC THẬT. */}
                {x.hoSo && (() => {
                  const tong = x.hoSo.gom.length;
                  const xong = x.hoSo.gom.filter((_, i) => daCo[`${x.ma}:${i}`]).length;
                  const batBuoc = x.hoSo.gom.filter((g) => g.batBuoc).length;
                  return (
                    <div className="mt-3 rounded-2xl border-2 border-[#0A2540]/20 bg-[#0A2540]/[0.03] p-3">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-[#0A2540]">📋 {x.hoSo.nhan}</p>
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
            {([['sodo', '🧠 Sơ đồ tổng thể'], ['the', `🎴 Thẻ học thuộc${theHomNay.length ? ` (${theHomNay.length})` : ''}`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setCheDoHoc(k)}
                className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition ${cheDoHoc === k ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{l}</button>
            ))}
          </div>

          {cheDoHoc === 'the' && (
            <div className="mt-3">
              <p className="text-[12.5px] leading-snug text-slate-500">
                Cách học đã được chứng minh: <b>tự nhớ lại trước khi xem đáp án</b>, rồi <b>ôn lại đúng lúc sắp quên</b>.
                Thẻ nào thuộc thì đẩy xa dần (1 → 3 → 7 → 16 → 35 ngày), thẻ nào quên thì mai ôn lại.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="rounded-full bg-sky-50 px-2.5 py-1 font-bold text-sky-700">Hôm nay: {theHomNay.length} thẻ</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">Đã thuộc: {daThuoc}/{dsThe.length}</span>
                <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-500" style={{ width: `${dsThe.length ? (daThuoc / dsThe.length) * 100 : 0}%` }} />
                </div>
              </div>

              {theHomNay.length === 0 ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-6 text-center">
                  <p className="text-4xl">✅</p>
                  <p className="mt-1 text-[14px] font-bold text-emerald-800">Hôm nay ôn xong rồi</p>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">Mai quay lại, máy tự chọn đúng những thẻ sắp quên.</p>
                </div>
              ) : (() => {
                const khoa = theHomNay[theSo % theHomNay.length];
                const [maT, soT] = khoa.split(':');
                const g = gt!.muc[khoa];
                const kv = kho.find((z) => z.ma === maT);
                const dT = cacVb[maT]?.dieu.find((z) => z.so === Number(soT));
                if (!cacVb[maT]) taiVb(maT).catch(() => {});
                const hop = boThe[khoa]?.hop || 1;
                return (
                  <div className="mt-3">
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                        <span>{kv ? nhanNgan(kv.ma, kv.soHieu) : maT} · Điều {soT}</span>
                        <span>Hộp {hop}/5</span>
                      </div>
                      <p className="mt-1.5 text-[16px] font-extrabold leading-snug text-[#0A2540]">
                        {dT ? dT.tieuDe : `Điều ${soT}`}
                      </p>
                      {!datLat ? (
                        <>
                          <p className="mt-2 text-[13px] italic leading-snug text-slate-500">
                            Thử tự nói lại trong đầu: điều này quy định gì, con số nào cần nhớ?
                          </p>
                          <button onClick={() => setDatLat(true)}
                            className="mt-3 w-full rounded-xl bg-[#0A2540] px-3 py-2.5 text-[14px] font-bold text-white">
                            Lật thẻ xem đáp án
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="mt-2 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/70 p-3">
                            <p className="text-[13.5px] font-bold text-sky-900">Nhớ nhanh: {g.nho}</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{g.y}</p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <NutDan d={{ ma: maT, so: Number(soT) }} />
                          </div>
                          <p className="mt-3 text-[11.5px] font-semibold text-slate-500">Tự chấm: nhớ được tới đâu?</p>
                          <div className="mt-1 grid grid-cols-3 gap-1.5">
                            <button onClick={() => traLoiThe(khoa, 'quen')}
                              className="rounded-xl border-2 border-rose-300 bg-rose-50 px-2 py-2 text-[12.5px] font-bold text-rose-700">
                              Chưa thuộc<span className="block text-[10.5px] font-normal opacity-70">mai ôn lại</span>
                            </button>
                            <button onClick={() => traLoiThe(khoa, 'tam')}
                              className="rounded-xl border-2 border-amber-300 bg-amber-50 px-2 py-2 text-[12.5px] font-bold text-amber-700">
                              Tạm được<span className="block text-[10.5px] font-normal opacity-70">{CACH_ON[hop - 1]} ngày</span>
                            </button>
                            <button onClick={() => traLoiThe(khoa, 'thuoc')}
                              className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-2 py-2 text-[12.5px] font-bold text-emerald-700">
                              Thuộc rồi<span className="block text-[10.5px] font-normal opacity-70">{CACH_ON[Math.min(4, hop)]} ngày</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-slate-400">
                      <button onClick={() => { setDatLat(false); setTheSo((i) => i + 1); }} className="font-semibold hover:text-slate-700">Để lát nữa →</button>
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
                <span className="mx-1 h-4 w-px bg-slate-200" />
                <button onClick={() => setMoNhanh(Object.fromEntries(sd.nhanh.map((_, i) => [i, true])))}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">Mở hết</button>
                <button onClick={() => setMoNhanh({})}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">Thu hết</button>
                {kieuSoDo === 'khungve' && (
                  <>
                    <span className="mx-1 h-4 w-px bg-slate-200" />
                    <button onClick={() => setPhongTo((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600">−</button>
                    <span className="text-[11.5px] font-semibold text-slate-400">{Math.round(phongTo * 100)}%</span>
                    <button onClick={() => setPhongTo((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600">+</button>
                    <input value={timSoDo} onChange={(e) => setTimSoDo(e.target.value)}
                      placeholder="Tìm trong sơ đồ…"
                      className="ml-1 min-w-[140px] flex-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] outline-none focus:border-[#0A2540]" />
                    {timSoDo && <button onClick={() => setTimSoDo('')} className="text-slate-400">✕</button>}
                  </>
                )}
              </div>

              {/* ── KHUNG VẼ kiểu Notion: nút bo tròn, đường cong nối, bung/thu từng nhánh ──
                  Vị trí tính bằng tay: gốc ở giữa bên trái, nhánh toả sang phải, con của nhánh
                  toả tiếp. Nhánh nào đang thu thì không chiếm chỗ. */}
              {kieuSoDo === 'khungve' && (() => {
                // Ô cao hơn hẳn bản trước để chữ KHÔNG bị cắt cụt, và mỗi ô con hiện luôn
                // các nút "Điều …" bấm được — trước đây chỉ bấm được vào dẫn chiếu đầu tiên.
                const W0 = 190, W1 = 236, W2 = 300, H1 = 72, H2 = 96, KHE = 12, X1 = 262, X2 = 560;
                const q = kd(timSoDo.trim());
                const khop = (t: string) => !q || kd(t).includes(q);
                let y = 0;
                const nut: { x: number; y: number; w: number; h: number; cap: number; i: number; j?: number }[] = [];
                const canh: { x1: number; y1: number; x2: number; y2: number; mau: string }[] = [];
                const yNhanh: number[] = [];
                sd.nhanh.forEach((n, i) => {
                  const mo = !!moNhanh[i];
                  const con = mo ? n.con : [];
                  const yBatDau = y;
                  con.forEach((_, j) => { nut.push({ x: X2, y, w: W2, h: H2, cap: 2, i, j }); y += H2 + KHE; });
                  const yN = con.length ? (yBatDau + y - H2 - KHE + (H2 - H1)) / 2 : y;
                  if (!con.length) y += H1 + KHE;
                  yNhanh[i] = yN;
                  nut.push({ x: X1, y: yN, w: W1, h: H1, cap: 1, i });
                  con.forEach((_, j) => {
                    const yc = yBatDau + j * (H2 + KHE);
                    canh.push({ x1: X1 + W1, y1: yN + H1 / 2, x2: X2, y2: yc + H2 / 2, mau: n.mau });
                  });
                  y += KHE * 1.6;
                });
                const H = H1;
                const yGoc = yNhanh.length ? (yNhanh[0] + yNhanh[yNhanh.length - 1]) / 2 : 0;
                sd.nhanh.forEach((n, i) => canh.push({ x1: W0, y1: yGoc + H / 2, x2: X1, y2: yNhanh[i] + H / 2, mau: n.mau }));
                const cao = Math.max(y, yGoc + H) + 20;
                const rong = X2 + W2 + 20;
                const cong = (c: { x1: number; y1: number; x2: number; y2: number }) =>
                  `M ${c.x1} ${c.y1} C ${(c.x1 + c.x2) / 2} ${c.y1}, ${(c.x1 + c.x2) / 2} ${c.y2}, ${c.x2} ${c.y2}`;
                const viMau: Record<string, string> = { slate: '#94a3b8', emerald: '#34d399', amber: '#fbbf24', sky: '#38bdf8', violet: '#a78bfa', rose: '#fb7185', orange: '#fb923c', teal: '#2dd4bf' };
                return (
                  <div className="mt-3 overflow-auto rounded-2xl border border-slate-200 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:18px_18px]">
                    <div style={{ width: rong * phongTo, height: cao * phongTo }}>
                      <div style={{ width: rong, height: cao, transform: `scale(${phongTo})`, transformOrigin: 'top left', position: 'relative' }}>
                        <svg width={rong} height={cao} className="pointer-events-none absolute inset-0">
                          {canh.map((c, k2) => <path key={k2} d={cong(c)} fill="none" stroke={viMau[c.mau] || '#94a3b8'} strokeWidth={2} />)}
                        </svg>
                        <div className="absolute flex items-center rounded-2xl border-2 border-[#0A2540] bg-[#0A2540] px-3 text-white"
                          style={{ left: 0, top: yGoc, width: W0, height: H }}>
                          <span className="text-[13.5px] font-extrabold leading-tight">⚖️ Luật Đất đai 2024</span>
                        </div>
                        {nut.map((o, k2) => {
                          const n = sd.nhanh[o.i];
                          const mau = MAU_NHANH[n.mau] || MAU_NHANH.slate;
                          if (o.cap === 1) {
                            const sang = khop(n.ten + ' ' + n.y + ' ' + (n.neo || '')) ||
                              n.con.some((c) => khop(c.ten + ' ' + c.y));
                            return (
                              <button key={k2} onClick={() => setMoNhanh((m) => ({ ...m, [o.i]: !m[o.i] }))}
                                className={`absolute flex flex-col justify-center rounded-2xl border-2 px-2.5 text-left transition ${mau} ${sang ? '' : 'opacity-25'}`}
                                style={{ left: o.x, top: o.y, width: o.w, height: o.h }}>
                                <span className="text-[13px] font-extrabold leading-tight">{n.icon} {n.ten}</span>
                                {n.neo && <span className="mt-0.5 inline-block w-fit rounded-full bg-white/80 px-1.5 text-[10.5px] font-bold text-slate-700">🔑 {n.neo}</span>}
                                <span className="mt-0.5 text-[10.5px] leading-tight opacity-70">{moNhanh[o.i] ? 'thu lại ▴' : `${n.con.length} ý ▾`}</span>
                              </button>
                            );
                          }
                          const c = n.con[o.j!];
                          const sang = khop(c.ten + ' ' + c.y);
                          return (
                            <div key={k2}
                              className={`absolute flex flex-col justify-center rounded-xl border-2 bg-white px-2.5 py-1.5 transition ${sang ? 'border-slate-200' : 'border-slate-100 opacity-25'}`}
                              style={{ left: o.x, top: o.y, width: o.w, height: o.h }}>
                              <p className="text-[12.5px] font-bold leading-tight text-[#0A2540]">{c.ten}</p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-slate-500">{c.y}</p>
                              <div className="mt-1 flex flex-wrap gap-1 overflow-hidden">
                                {c.dan.slice(0, 4).map((d, i2) => {
                                  const v2 = kho.find((z) => z.ma === d.ma);
                                  return (
                                    <button key={i2} onClick={() => { if (d.so) moDieu(d.ma, d.so); else { doiVanBan(d.ma); setThe('luat'); } }}
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
                    </div>
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
                              <div className="mt-1 flex flex-wrap gap-1">
                                {c.dan.map((d, k2) => {
                                  const tenVb = kho.find((x) => x.ma === d.ma);
                                  return (
                                    <button key={k2} onClick={() => { if (d.so) moDieu(d.ma, d.so); else { doiVanBan(d.ma); setThe('luat'); } }}
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
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] leading-snug text-slate-500">{sd.canhBao}</p>
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
                ['Bị bãi bỏ một phần bởi', k?.biBaiBoMotPhanBoi, 'text-amber-600'],
                ['Được hướng dẫn bởi', k?.laCanCuCho, 'text-emerald-600'],
                ['Có nhắc tới', k?.dan, 'text-slate-500'],
              ];
              const co = hang.filter(([, ds]) => (ds?.length || 0) > 0);
              if (!co.length) return null;
              return (
                <div className="mt-1 space-y-0.5 border-t border-slate-200 pt-1 text-[11px]">
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
                    <span className="block text-[13px] font-bold text-[#0A2540]">{ghim.includes(khoaGhim(x.ma, x.d.so)) ? '⭐ ' : ''}{gt?.muc[khoaGhim(x.ma, x.d.so)] ? '💡 ' : ''}Điều {x.d.so}. {x.d.tieuDe}</span>
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
                <button key={d.so} onClick={() => moDieu(vb.ma, d.so)}
                  className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-[12.5px] hover:bg-slate-50 ${chon === d.so ? 'bg-[#0A2540]/[0.05] font-semibold' : 'text-slate-600'}`}>
                  {ghim.includes(khoaGhim(vb.ma, d.so)) ? '⭐ ' : ''}{gt?.muc[khoaGhim(vb.ma, d.so)] ? '💡 ' : ''}Điều {d.so}. {d.tieuDe}
                </button>
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
                      <button key={d.so} onClick={() => moDieu(vb.ma, d.so)}
                        className={`block w-full px-3 py-1.5 pl-8 text-left text-[12.5px] hover:bg-slate-50 ${chon === d.so ? 'bg-[#0A2540]/[0.05] font-semibold' : 'text-slate-600'}`}>
                        {ghim.includes(khoaGhim(vb.ma, d.so)) ? '⭐ ' : ''}{gt?.muc[khoaGhim(vb.ma, d.so)] ? '💡 ' : ''}Điều {d.so}. {d.tieuDe}
                      </button>
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
