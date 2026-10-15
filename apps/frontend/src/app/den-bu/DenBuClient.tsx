'use client';
import { cloneElement, isValidElement, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth, coGoiChung } from '@/lib/auth';
import HopTraPhi from '@/components/HopTraPhi';
import {
  DEN_BU_NGUON, DU_AN_PHUC_HOP, GIA_LUA_2VU, GIA_NONG_NGHIEP, GIA_PHUC_HOP, GIA_RUNG_SAN_XUAT,
  BANG_GIA_NN, TEN_NGAN_LOAI_DAT, TEN_VI_TRI_PH, dsThon, giaBangGiaNN, giaDenBu, type LoaiDat, type ViTriPH,
  HAN_MUC, SO_LAN_KHANH_HOA, SO_LAN_TRUOC_QD32, DI_CHUYEN, DI_CHUYEN_THEM_MOI_TANG, THUONG_BAN_GIAO,
  GAO_KG_THANG, soThangOnDinh,
} from '@/lib/denBuCamLam';

const tienGoc = (v: number) => Math.round(v).toLocaleString('vi-VN') + ' đ';
// CHE SỐ LIỆU TRONG CHỮ VIẾT SẴN (15/10/2026 — chủ dự án chụp thẻ "Căn cứ pháp luật": "vẫn chưa che"). Tài khoản chưa có quyền tính giá đền
// bù: mọi con số CÓ ĐƠN VỊ (đồng, đ, %, kg, tháng, triệu, lần, m², người, ha) hoặc có DẤU CHẤM NGHÌN trên trang đổi thành 0 + làm mờ.
// Cùng ngày chủ dự án chụp thẻ ③: "che mà số quyết định các thứ còn như này họ tự kiếm tự xem cần gì mình" → che THÊM mọi thứ giúp tự tra ra
// văn bản gốc + hệ số (× 1,12): số có gạch chéo (số hiệu "35/2026/QĐ-UBND" → "00/0000/QĐ-UBND", ngày "04/5/2026", phân số), số đứng sau Điều / khoản / điểm /
// Chương / Mục / Số / STT / QĐ / NQ / Công văn / Quyết định…, và năm (19xx, 20xx). Chữ số DÍNH SAU CHỮ CÁI (m2, m3) là đơn vị → giữ nguyên;
// số trong tên hạng mục ("Nhà ở 1 tầng") giữ để người xem vẫn hiểu nội dung. Duyệt cả cây giao diện (cloneElement).
const RE_SO = /(\d{1,3}(?:\.\d{3})+(?:,\d+)?(?:\s?(?:đồng|đ(?![a-zà-ỹ])|triệu))?|\d+(?:[.,]\d+)?\s?(?:%|kg|tháng|triệu|lần|m²|đồng|đ(?![a-zà-ỹ])|người|ha(?![a-zà-ỹ]))|\d+(?:\s?\/\s?\d+)+\/?|×\s?\d+(?:[.,]\d+)?|(?:Điều|điều|Khoản|khoản|Điểm|điểm|Chương|chương|Mục|mục|Số|số|STT|QĐ|NQ|NĐ|TT|CV|Công văn|công văn|Quyết định|quyết định|Nghị quyết|nghị quyết|Nghị định|nghị định|Thông tư|thông tư)\s+\d+(?:\s*[,–-]\s*\d+)*|(?:19|20)\d{2}(?!\d))/g;
// Chữ số đứng ngay sau chữ cái (m2, m3, UBTVQH15) không phải số liệu → không che. (Không dùng "lookbehind" trong biểu thức trên vì
// iPhone đời cũ — Safari < 16.4 — không hiểu, cả trang sẽ hỏng.)
const DINH_CHU = /[A-Za-zÀ-ỹĐđ]/;
// Kèm: NÚT MỞ VĂN BẢN GỐC (đường dẫn /tai-lieu/… hoặc .pdf — chủ dự án: "bấm vào các văn bản vẫn cho xem") bị GỠ đường dẫn, bấm vào gọi moHop
// (hộp "tính năng trả phí") — gỡ hẳn href nên chuột giữa / "mở tab mới" cũng không mở được.
const LA_TEP_VB = /\/tai-lieu\/|\.pdf(?:[?#]|$)/i;
function cheSo(node: ReactNode, moHop?: () => void): ReactNode {
  if (typeof node === 'string') {
    const ra: ReactNode[] = [];
    let cuoi = 0, m: RegExpExecArray | null;
    RE_SO.lastIndex = 0;
    while ((m = RE_SO.exec(node))) {
      if (DINH_CHU.test(node[m.index - 1] || '')) continue;   // m2, m3… — đơn vị, không che
      if (m.index > cuoi) ra.push(node.slice(cuoi, m.index));
      ra.push(<span key={m.index} className="select-none blur-[3px]">{m[0].replace(/\d/g, '0')}</span>);
      cuoi = m.index + m[0].length;
    }
    if (!ra.length) return node;
    if (cuoi < node.length) ra.push(node.slice(cuoi));
    return ra;
  }
  if (Array.isArray(node)) return node.map((x) => cheSo(x, moHop));
  if (isValidElement(node)) {
    const pr = node.props as any;
    const con = pr?.children;
    if (node.type === 'a' && LA_TEP_VB.test(String(pr?.href || ''))) {
      return cloneElement(node as any, { href: undefined, target: undefined, role: 'button', tabIndex: 0, style: { ...(pr.style || {}), cursor: 'pointer' },
        onClick: (ev: any) => { ev.preventDefault(); moHop?.(); } }, con == null ? con : cheSo(con, moHop));
    }
    if (con == null || typeof con === 'function') return node;
    return cloneElement(node as any, undefined, cheSo(con, moHop));
  }
  return node;
}
const so = (s: string) => {
  const v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : 0;
};
const khongDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
// Ô nhập: chữ 16px để iPhone không tự phóng to trang khi bấm vào ô.
const O = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-[16px] outline-none focus:border-[#0A2540]';
const TL = '/tai-lieu/';

// tyLe: Điều 10 QĐ 32/2026 (tài sản không đủ điều kiện bồi thường: 100 / 80 / ≤ 70%) hoặc 20% (giấy phép có thời hạn đã hết — Điều 3
// QĐ 08/2026). heSo: hệ số điều chỉnh theo Công văn 2093/SXD (hệ vệ sinh × 1,1; tường sơn nước × 1,12…), mặc định 1.
type DongTinh = { ten: string; dv: string; gia: number; sl: number; tyLe: number; heSo: number };
// Bảng đơn giá bóc từ BẢN WORD trên Công báo tỉnh → mỗi hạng mục đủ tên, nhóm, mô tả kết cấu, đơn vị tính và số tiền.
// Không phải OCR nên số chính xác. 13/10/2026 bóc lại theo đúng ô của bảng (scripts/den-bu/README.md): bản cũ sót 126 dòng
// (cả mục "Xây dựng mặt tiền nhà", 14 loại giếng…) và gắn nhầm tên nhóm — chủ dự án báo "thiếu" QĐ 12/2026.
// vb = quyết định gốc của dòng: '08' (QĐ 08/2026 — nhà, công trình) hoặc '12' (QĐ 12/2026 — một số chi phí), gắn lúc tải tệp.
type Muc = { pl?: string; nhom: string; phu: string; ketCau: string; ten: string; dv: string; gia: number; vb?: '08' | '12' };
// Cây trồng, vật nuôi — QĐ 35/2026/QĐ-UBND: 559 dòng bóc từ bản Word Công báo (số 43 ngày 18/5/2026), đối chiếu bản PDF ký số
// khớp 100% (13/10/2026). gia = null: văn bản ghi "tính theo thực tế" (gỗ, củi rừng trồng từ năm thứ 4/6) → người dùng tự nhập giá.
type MucCay = { pl: string; nhom: string; ten: string; phanLoai: string; dv: string; gia: number | null; ghiChu?: string };
type DongCay = { ten: string; dv: string; gia: number; sl: number; vuot: boolean; tuNhap: boolean };
type MatDo = { ten: string; dv: string; tuHat: number | null; chietGhep: number | null };

export default function DenBuClient() {
  // TÍNH GIÁ ĐỀN BÙ LÀ TÍNH NĂNG TRẢ PHÍ (15/10/2026, chủ dự án: "giá bồi thường cũng cho xem nhưng không cho tính, che mờ đi những số liệu
  // quan trọng ở tài khoản free"). Có quyền: admin · khách có GÓI CHỨC NĂNG CHUNG còn hạn (lib/auth coGoiChung). Người khác: mọi SỐ TIỀN hiện "•••.•••" (tien /
  // soTien bên dưới), ô nhập để TÍNH bị khoá — bấm vào là hộp "tính năng trả phí"; ô TÌM trong danh sách (data-cho-xem) vẫn dùng được.
  // ⚠️ Che ở GIAO DIỆN: số liệu gốc là văn bản công khai của tỉnh, vẫn nằm trong mã / tệp tĩnh của trang.
  const { user } = useAuth();
  const khoa = !coGoiChung(user);
  const [hopTraPhi, setHopTraPhi] = useState(false);
  const tien = (v: number) => (khoa ? '•••.••• đ' : tienGoc(v));
  const soTien = (v: number) => (khoa ? '•••.•••' : v.toLocaleString('vi-VN'));
  const chanTinh = (e: React.SyntheticEvent) => {
    if (!khoa) return;
    const el = e.target as HTMLElement;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.closest('[data-cho-xem]')) return;
    e.preventDefault(); el.blur(); setHopTraPhi(true);
  };
  const [tab, setTab] = useState<'dat' | 'nha' | 'cay' | 'khac' | 'cancu'>('dat');

  // ── Tiền đất ──────────────────────────────────────────────
  const [duAn, setDuAn] = useState<'camlam' | 'phuchop'>('camlam');
  const [loai, setLoai] = useState<LoaiDat>('cay');
  const [thon, setThon] = useState('Thôn Vĩnh Phú');
  const [viTri, setViTri] = useState<1 | 2>(1);
  const [phVt, setPhVt] = useState<ViTriPH>('trong-tiep');
  const [phLoai, setPhLoai] = useState<'cayLauNam' | 'cayHangNam' | 'rung' | 'thuySan' | 'lua'>('cayLauNam');
  // 4 dự án phức hợp: GIÁ ĐỀN BÙ luôn giữ nguyên theo 4 quyết định ngày 23/9/2025 đã phê duyệt.
  // Chỗ khác nhau DUY NHẤT là BẢNG GIÁ ĐẤT NHÀ NƯỚC dùng để tính TIỀN HỖ TRỢ chuyển đổi nghề:
  // phương án duyệt trước 01/01/2026 → bảng giá cũ (QĐ 04/2020, sửa bởi QĐ 23/2025);
  // từ 01/01/2026 → bảng giá mới (NQ 15/2025). (Chủ dự án nói rõ 16/9/2026.)
  const [phBanGia, setPhBanGia] = useState<'cu' | 'moi'>('moi');
  const [dt, setDt] = useState('');

  const [timThon, setTimThon] = useState('');
  const [moThon, setMoThon] = useState(false);
  const ds = useMemo(() => dsThon(loai), [loai]);
  const thonDung = ds.includes(thon) ? thon : ds[0];
  const dsThonLoc = useMemo(() => {
    const k = khongDau(timThon.trim());
    return k ? ds.filter((t) => khongDau(t).includes(k)) : ds;
  }, [ds, timThon]);
  const giaM2 = useMemo(() => {
    if (duAn === 'camlam') return giaDenBu(thonDung, loai, viTri);
    if (phLoai === 'lua') return phVt.endsWith('tiep') ? GIA_LUA_2VU.tiepGiap : GIA_LUA_2VU.khongTiepGiap;
    return GIA_PHUC_HOP[phVt][phLoai];
  }, [duAn, thonDung, loai, viTri, phVt, phLoai]);
  const dienTich = so(dt);
  const tienDat = giaM2 != null ? giaM2 * dienTich : 0;

  // ── Nhà & công trình ─────────────────────────────────────
  const [mucs, setMucs] = useState<Muc[]>([]);
  const [chiPhi, setChiPhi] = useState<Muc[]>([]);
  const [tim, setTim] = useState('');
  const [timCp, setTimCp] = useState('');
  // THẺ ② TÌM CHUNG QĐ 08 + QĐ 12 (15/10/2026, chủ dự án: "sao chưa đưa quyết định 12 vào chỗ giá đền bù và bồi thường" — bảng QĐ 12
  // trước chỉ nằm ở thẻ ④ nên ở thẻ ② gõ "mộ", "di chuyển máy lạnh" không ra). locVb = lọc theo quyết định.
  const [locVb, setLocVb] = useState<'' | '08' | '12'>('');
  const [dongs, setDongs] = useState<DongTinh[]>([]);
  // ── Cây trồng, vật nuôi (QĐ 35/2026) ──
  const [cays, setCays] = useState<MucCay[]>([]);
  const [matDo, setMatDo] = useState<MatDo[]>([]);
  const [timCay, setTimCay] = useState('');
  const [dongCay, setDongCay] = useState<DongCay[]>([]);
  useEffect(() => {
    if (tab === 'nha' && !mucs.length) fetch('/den-bu-nha-qd08.json').then((r) => r.json()).then((d: Muc[]) => setMucs(d.map((m) => ({ ...m, vb: '08' as const })))).catch(() => setMucs([]));
    if ((tab === 'nha' || tab === 'khac') && !chiPhi.length) fetch('/den-bu-chi-phi-qd12.json').then((r) => r.json()).then((d: Muc[]) => setChiPhi(d.map((m) => ({ ...m, vb: '12' as const })))).catch(() => setChiPhi([]));
    if (tab === 'cay' && !cays.length) {
      fetch('/den-bu-cay-trong-qd35.json').then((r) => r.json()).then(setCays).catch(() => setCays([]));
      fetch('/den-bu-mat-do-cay-qd35.json').then((r) => r.json()).then(setMatDo).catch(() => setMatDo([]));
    }
  }, [tab, mucs.length, chiPhi.length, cays.length]);
  const loc = (ds: Muc[], k: string) => {
    const q = khongDau(k.trim());
    const r = q ? ds.filter((m) => khongDau([m.ten, m.phu, m.nhom, m.ketCau].join(' ')).includes(q)) : ds;
    return r.slice(0, 80);
  };
  const themMuc = (m: Muc) => setDongs((d) => [...d, { ten: ([m.phu, m.ten].filter(Boolean).join(' · ') || m.nhom) + (m.vb ? ` (QĐ ${m.vb}/2026${m.pl ? ` · PL ${m.pl}` : ''})` : ''), dv: m.dv, gia: m.gia, sl: 1, tyLe: 1, heSo: 1 }]);
  const theMuc = (m: Muc, i: number) => (
    <button key={i} onClick={() => themMuc(m)} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 active:bg-slate-100">
      <span className="block text-[13.5px] font-semibold leading-snug text-slate-700">{[m.phu, m.ten].filter(Boolean).join(' · ')}</span>
      {m.ketCau && <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-400">{m.ketCau}</span>}
      <span className="mt-0.5 block text-[12.5px] font-bold text-[#0A2540]">{tien(m.gia)} / {m.dv}
        <span className="ml-1 font-normal text-slate-400">· {m.vb ? `QĐ ${m.vb}/2026 · ` : ''}{m.pl ? `PL ${m.pl} · ` : ''}{m.nhom.toLowerCase().trim()}</span></span>
    </button>
  );
  const tienNha = dongs.reduce((s, d) => s + d.gia * d.sl * d.tyLe * d.heSo, 0);
  const locCay = (k: string) => {
    const q = khongDau(k.trim());
    const r = q ? cays.filter((m) => khongDau([m.ten, m.phanLoai, m.nhom].join(' ')).includes(q)) : cays;
    return r.slice(0, 80);
  };
  const themCay = (m: MucCay) => setDongCay((d) => [...d, { ten: [m.ten, m.phanLoai].filter(Boolean).join(' · '), dv: m.dv || 'cây', gia: m.gia ?? 0, sl: 1, vuot: false, tuNhap: m.gia == null }]);
  // Phần cây VƯỢT mật độ được hỗ trợ 80% giá trị theo bảng giá (Điều 11 QĐ 32/2026/QĐ-UBND).
  const tienCay = dongCay.reduce((s, d) => s + d.gia * d.sl * (d.vuot ? 0.8 : 1), 0);

  // ── Hỗ trợ ───────────────────────────────────────────────
  // MẶC ĐỊNH × 5 (sửa 6/10/2026, chủ dự án chỉ ra): 03 lần của khoản 10 Điều 2 QĐ 14/2025 (Công báo số 015+016
  // ngày 29/8/2025) + 02 lần của khoản 1 Điều 9 QĐ 32/2026/QĐ-UBND (hiệu lực 30/4/2026, Công báo số 43 ngày 18/5/2026).
  // Bản cũ để × 3 vì chưa biết QĐ 32/2026 → tính THIẾU 40% quyền lợi của người dân. Nút × 3 giữ cho phương án duyệt trước 30/4/2026.
  const [heSoNghe, setHeSoNghe] = useState(String(SO_LAN_KHANH_HOA));
  const [truSxNn, setTruSxNn] = useState(true);       // có phải hộ TRỰC TIẾP sản xuất nông nghiệp không
  const [maHanMuc, setMaHanMuc] = useState('hangnam');// hạn mức giao đất áp cho thửa này
  const [dtHanMuc, setDtHanMuc] = useState('');
  // Thưởng bàn giao trước hạn — Điều 15 QĐ 32/2026 (hiệu lực 30/4/2026): dự án theo khoản 7 Điều 111 Luật Đất đai được 5.000.000 đ
  // (điểm c khoản 1 Điều 14 QĐ 17/2024, sửa bởi QĐ 14/2025) + thêm 3.000.000 đ; dự án khác bàn giao trước hạn được 10% tổng tiền bồi
  // thường, hỗ trợ — thấp nhất 1.000.000 đ, cao nhất 8.000.000 đ. Trước 13/10/2026 web để cố định 5.000.000 đ (đã lỗi thời).
  const [cachThuong, setCachThuong] = useState<'10pt' | 'k7' | 'khong' | 'tay'>('10pt');
  const [thuongTay, setThuongTay] = useState('');
  // Hỗ trợ tạm cư — Điều 4 (và Điều 5) QĐ 32/2026
  const [coTamCu, setCoTamCu] = useState(false);
  const [tamCuPhuong, setTamCuPhuong] = useState(false);   // đất thu hồi ở phường (7 triệu) hay xã, đặc khu (4 triệu)
  const [tamCuNguoi, setTamCuNguoi] = useState('4');
  const [tamCuThang, setTamCuThang] = useState('');
  // Ổn định đời sống — khoản 1 Điều 6 QĐ 32/2026: không đủ điều kiện bồi thường về đất nhưng thực tế canh tác → 70%
  const [khongDuDkDat, setKhongDuDkDat] = useState(false);
  const [khac, setKhac] = useState('');
  // Hỗ trợ ổn định đời sống — Điều 19 NĐ 88/2024: số khẩu × 30 kg gạo × giá gạo × số tháng
  const [soKhau, setSoKhau] = useState('');
  const [tyThuHoi, setTyThuHoi] = useState<'duoi30' | '30-70' | 'tren70'>('30-70');
  const [phaiDoiNha, setPhaiDoiNha] = useState(false);
  const [vungKhoKhan, setVungKhoKhan] = useState(false);
  const [giaGao, setGiaGao] = useState('');
  // Hỗ trợ di chuyển tài sản — khoản 1 Điều 8 (QĐ 14/2025)
  const [maDiChuyen, setMaDiChuyen] = useState('');
  const [soTang, setSoTang] = useState('');
  const [tuLoChoO, setTuLoChoO] = useState(false);   // tự lo chỗ ở → được thêm một khoản bằng chi phí di chuyển
  const [thuNhapNam, setThuNhapNam] = useState(''); // thu nhập sau thuế bình quân 1 năm (3 năm liền kề)
  const heSo = so(heSoNghe);
  // ⚠️ HỖ TRỢ CHUYỂN ĐỔI NGHỀ TÍNH THEO BẢNG GIÁ ĐẤT CỦA NHÀ NƯỚC, KHÔNG PHẢI GIÁ BỒI THƯỜNG
  // (khoản 1 Điều 109 Luật Đất đai 2024, Điều 22 Nghị định 88/2024/NĐ-CP: "… lần giá đất nông nghiệp cùng loại
  // trong bảng giá đất"). Bảng giá đang áp dụng là Nghị quyết 15/2025/NQ-HĐND — CHÍNH LÀ bảng giá in trong
  // Thông báo 306 theo từng thôn, nên lấy thẳng từ đó. Với 4 dự án cũ thì giá bồi thường (theo bảng giá 2020–2024)
  // KHÁC bảng giá mới → phải lấy theo thôn ở bảng NQ 15/2025, không lấy giá bồi thường. (Chủ dự án bắt lỗi 16/9/2026.)
  // Loại đất để tra BẢNG GIÁ: bên 4 dự án cũ chọn theo nhóm của loại đang chọn.
  const loaiBG: 'cay' | 'thuysan' | 'rung' = duAn === 'camlam'
    ? loai
    : (phLoai === 'thuySan' ? 'thuysan' : phLoai === 'rung' ? 'rung' : 'cay');
  const [vtBG, setVtBG] = useState<1 | 2>(1);
  // Bảng giá MỚI (NQ 15/2025) chỉ dùng khi phương án từ 01/01/2026. Phương án cũ phải lấy bảng giá 2020–2024
  // (QĐ 04/2020, sửa QĐ 23/2025) — web chưa có bảng đó nên để trống cho người dùng điền theo phương án.
  const dungBangGiaMoi = duAn === 'camlam' || phBanGia === 'moi';
  const giaTuBangGia = dungBangGiaMoi ? giaBangGiaNN(loaiBG, duAn === 'camlam' ? viTri : vtBG) : 0;
  const [giaNNTay, setGiaNNTay] = useState('');
  const giaNN = so(giaNNTay) || giaTuBangGia || 0;
  // Hạn mức: tiền hỗ trợ chuyển đổi nghề CHỈ tính cho phần diện tích TRONG hạn mức giao đất
  // (khoản 1 Điều 109 Luật Đất đai 2024). Không chặn thì thửa 3 ha ra tiền hỗ trợ sai rất lớn.
  const dsHanMuc = HAN_MUC[loaiBG];
  const hanMucChon = dsHanMuc.find((h) => h.ma === maHanMuc) || dsHanMuc[0];
  const dtTuNhap = so(dtHanMuc);
  const dtTinhNghe = Math.min(dtTuNhap || dienTich, hanMucChon.m2);
  const biCatHanMuc = (dtTuNhap || dienTich) > hanMucChon.m2;
  // Không trực tiếp sản xuất NN: khoản 2 Điều 9 QĐ 32/2026 → 50% phần cộng thêm của QĐ 32 (số lần vượt 3), không phải 0
  const tienNghe = giaNN > 0 && heSo > 0 ? (truSxNn ? giaNN * dtTinhNghe * heSo : giaNN * dtTinhNghe * Math.max(0, heSo - SO_LAN_TRUOC_QD32) * 0.5) : 0;

  // Hỗ trợ ổn định đời sống — Điều 19 NĐ 88/2024
  // Dưới 30% (khoản 6 Điều 6 QĐ 32/2026) và người không đủ điều kiện bồi thường đất mà thực tế canh tác (khoản 1) → bằng 70% mức của
  // khoản 1 Điều 19 NĐ 88/2024. Dưới 30% tạm tính số tháng như khung thấp nhất (30–70%) rồi nhân 70% — số chính thức theo phương án.
  const thangOnDinh = soThangOnDinh(tyThuHoi === 'duoi30' ? '30-70' : tyThuHoi, phaiDoiNha, vungKhoKhan);
  const heSoOnDinh = tyThuHoi === 'duoi30' || khongDuDkDat ? 0.7 : 1;
  const tienOnDinh = so(soKhau) * GAO_KG_THANG * so(giaGao) * thangOnDinh * heSoOnDinh;

  // Hỗ trợ di chuyển tài sản — khoản 1 Điều 8 (QĐ 14/2025), nhà nhiều tầng cộng thêm từ tầng 3
  const mucDiChuyen = DI_CHUYEN.find((d) => d.ma === maDiChuyen);
  const tangThem = Math.max(0, Math.floor(so(soTang)) - 2);
  const tienDiChuyen1 = mucDiChuyen ? mucDiChuyen.tien * (1 + tangThem * DI_CHUYEN_THEM_MOI_TANG) : 0;
  // Tự lo chỗ ở: ngoài bồi thường, còn được thêm một khoản hỗ trợ tái định cư BẰNG chi phí di chuyển
  // (khoản 2 Điều 12 Quy định kèm QĐ 17/2024) → cộng thêm đúng một lần nữa.
  const tienDiChuyen = tienDiChuyen1 * (tuLoChoO ? 2 : 1);
  // Hỗ trợ ổn định SẢN XUẤT, KINH DOANH — khoản 2 Điều 11 QĐ 17/2024: 30% một năm thu nhập sau thuế,
  // lấy theo mức thu nhập bình quân của 03 năm liền kề trước đó.
  const tienSxkd = so(thuNhapNam) * 0.3;

  // Tạm cư (Điều 4 QĐ 32/2026): hộ ≤ 4 người 7.000.000 đ/tháng ở phường, 4.000.000 đ/tháng ở xã, đặc khu; mỗi người thêm + 10%.
  const mucTamCu = (tamCuPhuong ? 7_000_000 : 4_000_000) * (1 + 0.1 * Math.max(0, Math.floor(so(tamCuNguoi)) - 4));
  const tienTamCu = coTamCu ? mucTamCu * so(tamCuThang) : 0;
  const tongChuaThuong = tienDat + tienNha + tienNghe + tienOnDinh + tienDiChuyen + tienSxkd + tienCay + tienTamCu + so(khac);
  const tienThuong = cachThuong === 'k7' ? THUONG_BAN_GIAO + 3_000_000
    : cachThuong === '10pt' ? (tongChuaThuong > 0 ? Math.min(8_000_000, Math.max(1_000_000, Math.round(tongChuaThuong * 0.1))) : 0)
    : cachThuong === 'tay' ? so(thuongTay) : 0;
  const tong = tongChuaThuong + tienThuong;

  const [moTong, setMoTong] = useState(true);   // thanh tổng tiền dính đáy: mở sẵn phần chi tiết
  const nut = (k: typeof tab, nhan: string) => (
    <button key={k} onClick={() => setTab(k)}
      className={`cl-press whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold ${tab === k ? 'bg-[#0A2540] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{nhan}</button>
  );

  const trang = (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8" onFocusCapture={chanTinh} onMouseDownCapture={chanTinh} onClickCapture={chanTinh}>
      {hopTraPhi && <HopTraPhi ten="Tính giá đền bù" onDong={() => setHopTraPhi(false)} />}
      {khoa && (
        <button type="button" onClick={() => setHopTraPhi(true)} className="mb-3 block w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-[13px] leading-snug text-amber-900">
          🔒 <b>Tính giá đền bù là tính năng trả phí</b> — số tiền trên trang đã được che. <span className="underline">Đăng ký thành viên</span>
        </button>
      )}
      <h1 className="text-xl font-extrabold text-[#0A2540] sm:text-3xl">Đền bù khi Nhà nước thu hồi đất — Cam Lâm</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Tra giá đất bồi thường theo <b>từng thôn / từng dự án</b>, đơn giá <b>nhà và công trình</b>, rồi tính nhanh tổng tiền. Số liệu lấy nguyên từ văn bản của cơ quan nhà nước — bấm nút để xem bản gốc.
      </p>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nut('dat', '① Tiền đất')}{nut('nha', '② Nhà & công trình')}{nut('cay', '③ Cây trồng, vật nuôi')}{nut('khac', '④ Chi phí khác')}{nut('cancu', '⑤ Căn cứ pháp luật')}
      </div>

      {/* ───────────────── ① TIỀN ĐẤT ───────────────── */}
      {tab === 'dat' && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[13px] font-bold uppercase tracking-wide text-slate-400">Thửa đất nằm trong dự án nào</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button onClick={() => setDuAn('camlam')} className={`cl-press rounded-xl border p-3 text-left ${duAn === 'camlam' ? 'border-[#0A2540] bg-[#0A2540]/[0.04]' : 'border-slate-200'}`}>
              <b className="text-[14px] text-[#0A2540]">Khu đô thị mới Cam Lâm</b>
              <span className="mt-0.5 block text-[12px] text-slate-500">Theo bảng giá đất MỚI (NQ 15/2025) · {DEN_BU_NGUON.vanBan}</span>
            </button>
            <button onClick={() => setDuAn('phuchop')} className={`cl-press rounded-xl border p-3 text-left ${duAn === 'phuchop' ? 'border-[#0A2540] bg-[#0A2540]/[0.04]' : 'border-slate-200'}`}>
              <b className="text-[14px] text-[#0A2540]">4 khu đô thị phức hợp <span className="text-[11px] font-normal text-amber-700">(bảng giá cũ)</span></b>
              <span className="mt-0.5 block text-[12px] text-slate-500">Suối Tân · Cam Thượng · Cam Tân · Cam Hòa — quyết định 23/9/2025</span>
            </button>
          </div>

          {duAn === 'camlam' ? (
            <>
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Loại đất</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['cay', 'thuysan', 'rung'] as LoaiDat[]).map((k) => (
                  <button key={k} onClick={() => { setLoai(k); const d = dsThon(k); if (!d.includes(thon)) setThon(d[0]); }}
                    className={`cl-press rounded-full px-3.5 py-2 text-[13px] font-semibold ${loai === k ? 'bg-[#0A2540] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
                    {TEN_NGAN_LOAI_DAT[k]}
                  </button>
                ))}
              </div>
              {/* THÔN: vừa GÕ TÌM vừa sổ danh sách (chủ dự án 16/9/2026) — 45 thôn, cuộn tìm thì lâu. Gõ không dấu vẫn ra. */}
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Thôn</p>
              <div className="relative mt-2">
                <input data-cho-xem value={moThon ? timThon : thonDung}
                  onFocus={() => { setMoThon(true); setTimThon(''); }}
                  onClick={() => { setMoThon(true); setTimThon(''); }}
                  onChange={(e) => { setTimThon(e.target.value); setMoThon(true); }}
                  onBlur={() => setTimThon((k) => { setTimeout(() => setMoThon(false), 150); return k; })}
                  placeholder="Gõ tên thôn để tìm, hoặc bấm để xem cả danh sách" className={`${O} bg-white`} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">▼</span>
                {moThon && (
                  <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-xl">
                    {dsThonLoc.length === 0 && <p className="px-3 py-2.5 text-[13px] text-slate-400">Không có thôn nào khớp “{timThon}”.</p>}
                    {dsThonLoc.map((t) => (
                      <button key={t} onMouseDown={(e) => { e.preventDefault(); setThon(t); setMoThon(false); setTimThon(''); }}
                        className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left text-[14px] last:border-b-0 hover:bg-slate-50 ${t === thonDung ? 'bg-amber-50/70 font-semibold text-[#0A2540]' : 'text-slate-700'}`}>
                        {t === thonDung && <span className="mr-1 text-[#C8A14B]">✓</span>}{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* VỊ TRÍ: hộp sổ xuống ghi luôn GIÁ của thôn + loại đất đang chọn, khỏi phải đoán chọn cái nào. */}
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Vị trí thửa đất</p>
              {/* Hai nút như kiểu cũ (chủ dự án 16/9/2026) — giá của từng vị trí ghi ngay dưới nút. */}
              <div className="mt-2 flex gap-2">
                {([1, 2] as const).map((v) => {
                  const g = giaDenBu(thonDung, loai, v);
                  return (
                    <button key={v} onClick={() => setViTri(v)}
                      className={`cl-press flex-1 rounded-lg px-3 py-2 text-[14px] font-semibold ${viTri === v ? 'bg-[#0A2540] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
                      Vị trí {v}
                      <span className={`mt-0.5 block text-[11.5px] font-normal ${viTri === v ? 'text-white/80' : 'text-slate-400'}`}>{g == null ? 'không ghi giá' : tien(g) + '/m²'}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-slate-500">Vị trí ghi trong phương án bồi thường, hoặc hỏi cán bộ địa chính xã.</p>
            </>
          ) : (
            <>
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Phương án bồi thường được duyệt khi nào</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button onClick={() => setPhBanGia('cu')} className={`cl-press rounded-xl border p-3 text-left ${phBanGia === 'cu' ? 'border-[#0A2540] bg-[#0A2540]/[0.04]' : 'border-slate-200'}`}>
                  <b className="text-[13.5px] text-[#0A2540]">Trước 01/01/2026</b>
                  <span className="mt-0.5 block text-[12px] text-slate-500">Tiền hỗ trợ tính theo bảng giá đất CŨ (QĐ 04/2020, sửa bởi QĐ 23/2025)</span>
                </button>
                <button onClick={() => setPhBanGia('moi')} className={`cl-press rounded-xl border p-3 text-left ${phBanGia === 'moi' ? 'border-[#0A2540] bg-[#0A2540]/[0.04]' : 'border-slate-200'}`}>
                  <b className="text-[13.5px] text-[#0A2540]">Từ 01/01/2026</b>
                  <span className="mt-0.5 block text-[12px] text-slate-500">Tiền hỗ trợ tính theo bảng giá đất MỚI (Nghị quyết 15/2025)</span>
                </button>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-slate-500">Giá <b>đền bù về đất</b> của 4 dự án này <b>không đổi</b> — vẫn theo 4 quyết định ngày 23/9/2025. Mốc trên chỉ đổi <b>bảng giá đất nhà nước</b> dùng để tính tiền hỗ trợ chuyển đổi nghề ở mục ③.</p>
              {phBanGia === 'cu' && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-snug text-amber-900">
                ⚠️ Bốn quyết định này ký ngày <b>23/9/2025</b>, căn cứ <b>bảng giá đất cũ giai đoạn 2020–2024</b> (QĐ 04/2020, sửa bởi QĐ 23/2025) nên chia giá theo <b>khoảng cách 200 m tới đường</b>.
                Từ <b>01/01/2026</b> tỉnh áp dụng <b>bảng giá đất mới — Nghị quyết 15/2025/NQ-HĐND</b>, đất nông nghiệp chỉ còn <b>vị trí 1 và vị trí 2</b> (xem mục “Khu đô thị mới Cam Lâm”).
                Vì vậy mức giá dưới đây <b>chỉ dùng để đối chiếu phương án đã lập theo bảng giá cũ</b>; phương án mới phải theo giá đất cụ thể được phê duyệt tại thời điểm thu hồi.
                Mỗi quyết định cũng chỉ áp dụng cho <b>đất nông nghiệp ngoài khu dân cư, trong ranh giới thu hồi của chính dự án đó</b>.
              </div>
              )}
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Loại đất</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {([['cayLauNam', 'Cây lâu năm'], ['cayHangNam', 'Cây hằng năm'], ['lua', 'Lúa nước 2 vụ'], ['rung', 'Rừng sản xuất'], ['thuySan', 'Nuôi trồng thuỷ sản']] as const).map(([k, n]) => (
                  <button key={k} onClick={() => setPhLoai(k)}
                    className={`cl-press rounded-full px-3.5 py-2 text-[13px] font-semibold ${phLoai === k ? 'bg-[#0A2540] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{n}</button>
                ))}
              </div>
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Vị trí thửa đất so với đường</p>
              <div className="mt-2 grid gap-2">
                {(Object.keys(TEN_VI_TRI_PH) as ViTriPH[]).map((k) => {
                  const g = phLoai === 'lua' ? (k.endsWith('tiep') ? GIA_LUA_2VU.tiepGiap : GIA_LUA_2VU.khongTiepGiap) : GIA_PHUC_HOP[k][phLoai];
                  return (
                    <button key={k} onClick={() => setPhVt(k)}
                      className={`cl-press rounded-lg border px-3 py-2 text-left text-[13.5px] ${phVt === k ? 'border-[#0A2540] bg-[#0A2540]/[0.04] font-semibold text-[#0A2540]' : 'border-slate-200 text-slate-600'}`}>
                      {TEN_VI_TRI_PH[k]}
                      <span className="ml-1 text-[12px] font-normal text-slate-400">— {g == null ? 'không ghi giá' : tien(g) + '/m²'}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-slate-500">Đường ở đây là <b>đường giao thông chính, đường liên xã, liên thôn</b>. Đất lúa 2 vụ chỉ chia tiếp giáp đường hay không.</p>
            </>
          )}

          <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Diện tích bị thu hồi (m²)</p>
          <input value={dt} onChange={(e) => setDt(e.target.value)} inputMode="decimal" placeholder="Ví dụ: 1250,5" className={`${O} mt-2`} />

          <div className="mt-4 rounded-xl border border-[#C8A14B]/40 bg-[#C8A14B]/[0.08] p-3.5">
            {giaM2 == null ? (
              <p className="text-[14px] text-slate-600">Văn bản <b>không ghi giá</b> cho trường hợp này. Hãy chọn lại loại đất / vị trí, hoặc hỏi hội đồng bồi thường.</p>
            ) : (
              <>
                <p className="text-[14px] text-slate-600">Giá đền bù 1 m²: <b className="text-[#0A2540]">{tien(giaM2)}</b></p>
                <p className="mt-1 text-[15px] text-slate-600">Tiền bồi thường về đất:
                  <b className="ml-1.5 text-[18px] text-[#0A2540]">{dienTich > 0 ? tien(tienDat) : '—'}</b></p>
                {dienTich > 0 && <p className="mt-0.5 text-[12px] text-slate-500">{tien(giaM2)} × {dienTich.toLocaleString('vi-VN')} m²</p>}
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {duAn === 'camlam'
              ? <a href={TL + 'TB-306-gia-dat-boi-thuong-Cam-Lam-07-5-2026.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0A2540] hover:bg-slate-200">📄 {DEN_BU_NGUON.vanBan}</a>
              : DU_AN_PHUC_HOP.map((d) => (
                <a key={d.ma} href={TL + d.tep} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0A2540] hover:bg-slate-200">📄 {d.ten.replace('Khu đô thị phức hợp ', 'QĐ ' + d.ma + ' — ')}</a>
              ))}
          </div>

          {duAn === 'camlam' && (
            <details className="group mt-3 overflow-hidden rounded-xl border border-slate-200">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[13.5px] font-bold text-[#0A2540] hover:bg-slate-50">
                <span>Xem cả bảng {GIA_NONG_NGHIEP.length} khu vực</span><span className="text-[#C8A14B] transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="overflow-x-auto px-3 pb-3">
                <table className="w-full min-w-[540px] text-[12.5px]">
                  <thead><tr className="text-left text-slate-500">
                    <th className="py-1.5 pr-2 font-semibold">Khu vực</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Cây VT1</th><th className="px-2 py-1.5 text-right font-semibold">Cây VT2</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Thuỷ sản VT1</th><th className="py-1.5 pl-2 text-right font-semibold">VT2</th>
                  </tr></thead>
                  <tbody>
                    {GIA_NONG_NGHIEP.map((r) => (
                      <tr key={r[0]} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2 text-slate-700">{r[0]}</td>
                        {r.slice(1).map((v, i) => <td key={i} className="px-2 py-1.5 text-right tabular-nums text-[#0A2540]">{v == null ? '—' : soTien(v as number)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 font-bold text-[#0A2540]">Đất rừng sản xuất</p>
                <table className="w-full min-w-[320px] text-[12.5px]"><tbody>
                  {GIA_RUNG_SAN_XUAT.map((r) => (
                    <tr key={r[0]} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 text-slate-700">{r[0]}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[#0A2540]">{soTien(r[1])}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums text-[#0A2540]">{soTien(r[2])}</td>
                    </tr>
                  ))}
                </tbody></table>
                <p className="mt-2 text-[12px] text-slate-500">Đơn vị: đồng/m². VT1 = vị trí 1, VT2 = vị trí 2.</p>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ───────────────── ② NHÀ & CÔNG TRÌNH ───────────────── */}
      {tab === 'nha' && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[13px] leading-snug text-slate-600">
            Đơn giá bồi thường nhà, nhà ở, công trình xây dựng theo <b>Quyết định 08/2026/QĐ-UBND</b> ngày 22/01/2026 và đơn giá một số chi phí
            (tự xây dựng, cải tạo, sửa chữa công trình · di dời mồ mả · tháo dỡ, di chuyển, lắp đặt tài sản · chi phí đầu tư vào đất còn lại) theo
            {' '}<b>Quyết định 12/2026/QĐ-UBND</b> ngày 24/02/2026 của UBND tỉnh Khánh Hòa. Gõ tên hạng mục (nhà 1 tầng, tường rào, giếng, chuồng trại,
            mộ xây, di chuyển máy lạnh…) rồi bấm để cộng vào bảng tính.
          </p>
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm: tường rào, mái tôn, giếng, mộ xây, máy lạnh…" data-cho-xem className={`${O} mt-2.5`} />
          <div className="mt-2 flex flex-wrap gap-1.5" data-cho-xem>
            {([['', `Cả hai (${mucs.length + chiPhi.length})`], ['08', `QĐ 08 — nhà, công trình (${mucs.length})`], ['12', `QĐ 12 — chi phí (${chiPhi.length})`]] as ['' | '08' | '12', string][]).map(([k, nhan]) => (
              <button key={k || 'tat-ca'} type="button" data-cho-xem onClick={() => setLocVb(k)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${locVb === k ? 'bg-[#0A2540] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{nhan}</button>
            ))}
          </div>
          <div className="mt-2 max-h-[46vh] overflow-y-auto overscroll-contain rounded-xl border border-slate-100">
            {mucs.length === 0 && chiPhi.length === 0 && <p className="p-3 text-[13px] text-slate-400">Đang tải bảng đơn giá…</p>}
            {loc(locVb === '08' ? mucs : locVb === '12' ? chiPhi : [...mucs, ...chiPhi], tim).map(theMuc)}
            {mucs.length + chiPhi.length > 0 && loc(locVb === '08' ? mucs : locVb === '12' ? chiPhi : [...mucs, ...chiPhi], tim).length === 0 && <p className="p-3 text-[13px] text-slate-400">Không tìm thấy hạng mục nào.</p>}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-slate-500">Bấm một hạng mục là cộng vào bảng tính. Bản gốc: <a href={TL + 'QD-08-2026-don-gia-boi-thuong-nha-cong-trinh.pdf'} target="_blank" rel="noreferrer" className="font-semibold text-[#0A2540] underline">QĐ 08/2026 (PDF)</a>
            {' · '}<a href={TL + 'QD-12-2026-don-gia-boi-thuong-ho-tro-chi-phi.pdf'} target="_blank" rel="noreferrer" className="font-semibold text-[#0A2540] underline">QĐ 12/2026 (PDF)</a>. Nhà, công trình xây theo giấy phép có thời hạn mà giấy phép đã hết hạn thì <b>chỉ được hỗ trợ 20%</b> mức trên (Điều 3 QĐ 08/2026); tài sản không đủ điều kiện bồi thường được hỗ trợ 100 / 80 / 70% (Điều 10 QĐ 32/2026) — chọn ở từng hạng mục.</p>

          {dongs.length > 0 && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13px] font-bold text-[#0A2540]">Hạng mục đã chọn</p>
              {dongs.map((d, i) => (
                <div key={i} className="mt-2 flex flex-wrap items-start gap-x-2 gap-y-1.5 border-t border-slate-200 pt-2 first:border-t-0 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-snug text-slate-600">{d.ten.slice(0, 110)}</p>
                    <p className="text-[12px] text-slate-400">{tien(d.gia)} / {d.dv}</p>
                  </div>
                  <input value={String(d.sl)} onChange={(e) => setDongs((a) => a.map((x, j) => (j === i ? { ...x, sl: so(e.target.value) } : x)))}
                    inputMode="decimal" aria-label={`Khối lượng (${d.dv})`} className="w-20 shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-[16px]" />
                  <button onClick={() => setDongs((a) => a.filter((_, j) => j !== i))} aria-label="Bỏ" className="shrink-0 px-1 text-slate-400">✕</button>
                  <div className="flex w-full basis-full flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
                    <select value={String(d.tyLe)} onChange={(e) => setDongs((a) => a.map((x, j) => (j === i ? { ...x, tyLe: Number(e.target.value) } : x)))}
                      aria-label="Tỷ lệ được nhận" className="max-w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-[12.5px]">
                      <option value="1">100% — đủ điều kiện bồi thường (hoặc tường rào, bờ kè, móng trụ)</option>
                      <option value="0.8">80% — không đủ ĐK: nhà ở, mái che, công trình phụ</option>
                      <option value="0.7">70% — không đủ ĐK: công trình khác (mức tối đa)</option>
                      <option value="0.2">20% — giấy phép xây dựng có thời hạn đã hết hạn</option>
                    </select>
                    <label className="flex items-center gap-1">× hệ số
                      <input value={String(d.heSo)} onChange={(e) => setDongs((a) => a.map((x, j) => (j === i ? { ...x, heSo: so(e.target.value) || 1 } : x)))}
                        inputMode="decimal" className="w-14 rounded-lg border border-slate-300 px-1.5 py-1 text-right text-[16px]" /></label>
                    {(d.tyLe !== 1 || d.heSo !== 1) && <span className="font-semibold text-[#0A2540]">= {tien(d.gia * d.sl * d.tyLe * d.heSo)}</span>}
                  </div>
                </div>
              ))}
              <details className="mt-2 text-[12px] leading-snug text-slate-500">
                <summary className="cursor-pointer font-semibold text-[#0A2540]">Tỷ lệ và hệ số dùng khi nào?</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li><b>Tài sản không đủ điều kiện bồi thường</b> (Điều 105 Luật Đất đai) vẫn được hỗ trợ: tường rào, bờ kè, móng trụ bảo vệ khuôn viên 100%; nhà ở, mái che, công trình phụ để ở 80%; công trình khác UBND xã xét, tối đa 70%; tạo lập trong thời hạn thông báo thu hồi thì không hỗ trợ (Điều 10 QĐ 32/2026).</li>
                  <li><b>Hệ số theo Công văn 2093/SXD</b>: nhà có thêm hệ vệ sinh (STT 8, 9, 14–19 mục A) × 1,1, nhà STT 10–12 thêm 1 phòng vệ sinh × 1,03; tường sơn nước × 1,12, sơn dầu × 1,14; giếng khoan đường kính ≤ 114 mm × 1,17; mộ xây gạch ống, gạch block × 1,12; ao đìa ngưng sản xuất trên 1 năm × 0,7, trên 2 năm × 0,5, bỏ hoang × 0,3; công trình khác bảng vận dụng loại tương tự, cộng dồn không quá ± 15%.</li>
                  <li>Gác lửng bê tông: cao ≤ 1,6 m không tính, 1,6–2 m tính 1/2 diện tích, 2–2,5 m tính 2/3, trên 2,5 m tính đủ — nhập diện tích đã quy đổi vào ô khối lượng.</li>
                </ul>
              </details>
              <p className="mt-2 border-t border-slate-200 pt-2 text-[14px] text-slate-600">Cộng nhà, công trình &amp; chi phí (QĐ 08, QĐ 12): <b className="text-[#0A2540]">{tien(tienNha)}</b></p>
            </div>
          )}
        </div>
      )}

      {/* ───────────────── ③ CÂY TRỒNG, VẬT NUÔI ─────────────────
          QĐ 35/2026/QĐ-UBND ngày 04/5/2026 (hiệu lực 14/5/2026). 13/10/2026 chủ dự án: "tìm về 35 cây trồng nữa" — trước chỉ có
          một ô tự gõ số tiền. Phần vượt mật độ 80%: Điều 11 QĐ 32/2026. Quy định đi kèm: Phụ lục I–IV QĐ 35 + Điều 103, 105 Luật Đất đai. */}
      {tab === 'cay' && (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[13px] leading-snug text-slate-600">
              Đơn giá bồi thường cây trồng, vật nuôi theo <b>Quyết định 35/2026/QĐ-UBND</b> ngày 04/5/2026 của UBND tỉnh Khánh Hòa (hiệu lực 14/5/2026):
              cây hằng năm (đ/m²), cây lâu năm theo tuổi hoặc loại A/B/C (đ/cây), cây lâm nghiệp theo năm chăm sóc, thủy sản theo thời gian nuôi.
              Gõ tên cây, con rồi bấm để cộng vào bảng tính.
            </p>
            <input value={timCay} onChange={(e) => setTimCay(e.target.value)} placeholder="Tìm: sầu riêng, xoài ghép, keo lai, lúa, tôm thẻ…" data-cho-xem className={`${O} mt-2.5`} />
            <div className="mt-2 max-h-[46vh] overflow-y-auto overscroll-contain rounded-xl border border-slate-100">
              {cays.length === 0 && <p className="p-3 text-[13px] text-slate-400">Đang tải bảng đơn giá…</p>}
              {locCay(timCay).map((m, i) => (
                <button key={i} onClick={() => themCay(m)} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 active:bg-slate-100">
                  <span className="block text-[13.5px] font-semibold leading-snug text-slate-700">{m.ten}</span>
                  {m.phanLoai && <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">{m.phanLoai}</span>}
                  <span className="mt-0.5 block text-[12.5px] font-bold text-[#0A2540]">{m.gia != null ? `${tien(m.gia)} / ${m.dv}` : 'Tính theo thực tế — tự nhập giá'}
                    <span className="ml-1 font-normal text-slate-400">· {m.nhom.toLowerCase()}</span></span>
                </button>
              ))}
              {cays.length > 0 && locCay(timCay).length === 0 && <p className="p-3 text-[13px] text-slate-400">Không tìm thấy — cây, con không có trong bảng thì áp loại tương đồng (Điều 4 Quy định kèm QĐ 35/2026).</p>}
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
              Hoa, cây cảnh tính theo giá thực tế lúc kiểm kê (khoản 4 Điều 2 Quy định kèm QĐ 35/2026). Bản gốc:{' '}
              <a href={TL + 'QD-35-2026-don-gia-boi-thuong-cay-trong-vat-nuoi.pdf'} target="_blank" rel="noreferrer" className="font-semibold text-[#0A2540] underline">QĐ 35/2026 (PDF)</a>.
            </p>

            {dongCay.length > 0 && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-[13px] font-bold text-[#0A2540]">Cây trồng, vật nuôi đã chọn <span className="font-normal text-slate-400">(ô bên phải: số cây / số m²)</span></p>
                {dongCay.map((d, i) => (
                  <div key={i} className="mt-2 border-t border-slate-200 pt-2 first:border-t-0 first:pt-0">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] leading-snug text-slate-600">{d.ten.slice(0, 120)}</p>
                        {d.tuNhap ? (
                          <label className="mt-1 block text-[12px] text-slate-500">Giá thực tế (đồng/{d.dv})
                            <input value={d.gia ? String(d.gia) : ''} onChange={(e) => setDongCay((a) => a.map((x, j) => (j === i ? { ...x, gia: so(e.target.value) } : x)))}
                              inputMode="decimal" placeholder="theo biên bản kiểm đếm" className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[16px]" /></label>
                        ) : <p className="text-[12px] text-slate-400">{tien(d.gia)} / {d.dv}</p>}
                      </div>
                      <input value={String(d.sl)} onChange={(e) => setDongCay((a) => a.map((x, j) => (j === i ? { ...x, sl: so(e.target.value) } : x)))}
                        inputMode="decimal" aria-label={`Số lượng (${d.dv})`} className="w-20 shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-[16px]" />
                      <button onClick={() => setDongCay((a) => a.filter((_, j) => j !== i))} aria-label="Bỏ" className="shrink-0 px-1 text-slate-400">✕</button>
                    </div>
                    <label className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500">
                      <input type="checkbox" checked={d.vuot} onChange={(e) => setDongCay((a) => a.map((x, j) => (j === i ? { ...x, vuot: e.target.checked } : x)))} />
                      Đây là phần cây <b className="font-semibold">vượt mật độ</b> — hỗ trợ 80% (Điều 11 QĐ 32/2026)
                    </label>
                  </div>
                ))}
                <p className="mt-2 border-t border-slate-200 pt-2 text-[14px] text-slate-600">Cộng cây trồng, vật nuôi: <b className="text-[#0A2540]">{tien(tienCay)}</b></p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold text-[#0A2540]">Khi nào được bồi thường cây trồng, vật nuôi</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-slate-600">
              <li>Chỉ bồi thường cây, con <b>tạo lập hợp pháp trước khi có thông báo thu hồi đất</b>. Trồng, thả nuôi trong thời hạn thông báo thu hồi (12 tháng) thì <b>không được bồi thường</b> (khoản 2 Điều 105, khoản 5 Điều 85 Luật Đất đai 2024).</li>
              <li>Cây hằng năm, thủy sản <b>đã đến kỳ thu hoạch hoặc đã thu hoạch xong thì không bồi thường</b> (ghi chú Phụ lục I, IV QĐ 35/2026).</li>
              <li>Cây lâu năm tính <b>theo mật độ</b> (bảng dưới). Trồng xen: cây lâu năm tính số cây thực tế nhưng không quá mật độ, cây hằng năm tính theo diện tích thực tế. <b>Phần vượt mật độ được hỗ trợ 80%</b> (Điều 11 QĐ 32/2026).</li>
              <li>Tuổi cây: giá “1 năm” cho cây dưới 1 đến 1 năm tuổi, “2 năm” cho cây trên 1 đến 2 năm tuổi… Cây đang cho thu hoạch chia <b>loại A, B, C</b> theo năng suất cao hơn, bằng, thấp hơn bình quân niên giám thống kê 3 năm liền kề.</li>
              <li>Cây lâm nghiệp từ năm thứ 4 (bạch đàn, keo, phi lao) hoặc năm thứ 6 (loài khác) trở đi: sản phẩm gỗ, củi <b>tính theo thực tế</b>.</li>
              <li>Chủ cây trồng, vật nuôi <b>được tự thu hồi</b> (chặt, bứng, bắt) trước khi bàn giao đất (khoản 5 Điều 103 Luật Đất đai 2024).</li>
              <li>Phương án bồi thường đã được duyệt trước 14/5/2026 thì giữ theo phương án đã duyệt (Điều 3 QĐ 35/2026).</li>
            </ul>
            {matDo.length > 0 && (
              <details className="mt-2.5">
                <summary className="cursor-pointer text-[13px] font-semibold text-[#0A2540]">Mật độ tối đa được bồi thường (cây/ha) — Bảng 2 Phụ lục II</summary>
                <div className="mt-1.5 overflow-x-auto">
                  <table className="w-full text-left text-[12.5px] [font-variant-numeric:tabular-nums]">
                    <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-1 pr-2 font-semibold">Cây</th><th className="py-1 pr-2 font-semibold">Từ hạt</th><th className="py-1 font-semibold">Chiết, ghép</th></tr></thead>
                    <tbody>{matDo.map((m, i) => (
                      <tr key={i} className="border-b border-slate-100"><td className="py-1 pr-2 text-slate-700">{m.ten}</td>
                        <td className="py-1 pr-2">{m.tuHat != null ? m.tuHat.toLocaleString('vi-VN') : '—'}</td>
                        <td className="py-1">{m.chietGhep != null ? m.chietGhep.toLocaleString('vi-VN') : '—'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
                <p className="mt-1 text-[11.5px] text-slate-400">Cây không có trong bảng mật độ thì tính theo số cây trong biên bản kiểm đếm.</p>
              </details>
            )}
          </div>
        </div>
      )}

      {/* ───────────────── ④ CHI PHÍ KHÁC ───────────────── */}
      {tab === 'khac' && (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold text-[#0A2540]">Hỗ trợ cho người có đất bị thu hồi</p>
            <p className="mt-1 text-[12.5px] leading-snug text-slate-500">Mức cụ thể do UBND tỉnh quy định và ghi trong phương án bồi thường của dự án — điền vào đây để cộng vào tổng.</p>

            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0A2540]">Hỗ trợ đào tạo, chuyển đổi nghề &amp; tìm kiếm việc làm</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">= <b>giá đất nông nghiệp trong BẢNG GIÁ ĐẤT của nhà nước</b> (không phải giá bồi thường) × diện tích <b>trong hạn mức</b> × số lần.
                Khánh Hòa đang áp dụng <b>05 lần</b> = 03 lần theo Điều 13 (khoản 10 Điều 2 <b>QĐ 14/2025/QĐ-UBND</b>)
                + <b>02 lần</b> theo khoản 1 Điều 9 <b>QĐ 32/2026/QĐ-UBND</b> (hiệu lực 30/4/2026): “<i>ngoài mức hỗ trợ quy định tại Điều 13 … còn được hỗ trợ thêm 02 (hai) lần giá đất nông nghiệp cùng loại trong Bảng giá đất hiện hành</i>”.
                Phương án bồi thường duyệt <b>trước 30/4/2026</b> thì chọn 3 lần.</p>
              <label className="mt-2 flex items-start gap-2 text-[12.5px] leading-snug text-slate-600">
                <input type="checkbox" checked={truSxNn} onChange={(e) => setTruSxNn(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>Hộ gia đình, cá nhân <b>trực tiếp sản xuất nông nghiệp</b> (khoản 1 Điều 109 Luật Đất đai 2024). Bỏ tick: chỉ còn <b>50% phần cộng thêm của QĐ 32/2026</b> (khoản 2 Điều 9) = 1 lần.</span>
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-slate-600">Số lần:</span>
                {[String(SO_LAN_KHANH_HOA), String(SO_LAN_TRUOC_QD32)].map((k) => (
                  <button key={k} onClick={() => setHeSoNghe(k)}
                    className={`cl-press rounded-full px-3 py-1.5 text-[13px] font-bold ${heSoNghe === k ? 'bg-[#0A2540] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
                    × {k} lần{k === String(SO_LAN_KHANH_HOA) ? ' — Khánh Hòa đang áp dụng (QĐ 14/2025 + QĐ 32/2026)' : ' — phương án duyệt trước 30/4/2026'}
                  </button>
                ))}
              </div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[12px] leading-snug text-slate-500">
                  {dungBangGiaMoi ? (<>Lấy theo <b>BẢNG GIÁ ĐẤT của tỉnh</b> — Nghị quyết 15/2025/NQ-HĐND (KHÔNG phải giá bồi thường): <b className="text-[#0A2540]">{BANG_GIA_NN[loaiBG].ten}</b></>)
                    : (<>Phương án duyệt <b>trước 01/01/2026</b> → lấy <b>bảng giá đất cũ</b> (QĐ 04/2020, sửa bởi QĐ 23/2025). Web chưa có bảng này, hãy điền giá ghi trong phương án: <b className="text-[#0A2540]">{BANG_GIA_NN[loaiBG].ten}</b></>)}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {duAn !== 'camlam' && dungBangGiaMoi && (
                    <select value={vtBG} onChange={(e) => setVtBG(Number(e.target.value) as 1 | 2)}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-[14px] outline-none focus:border-[#0A2540]">
                      <option value={1}>Vị trí 1</option><option value={2}>Vị trí 2</option>
                    </select>
                  )}
                  <input value={giaNNTay} onChange={(e) => setGiaNNTay(e.target.value)} inputMode="decimal"
                    placeholder={giaTuBangGia ? soTien(giaTuBangGia) : 'nhập giá theo bảng giá cũ'}
                    className="w-32 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-[16px] outline-none focus:border-[#0A2540]" />
                  <span className="text-[12.5px] text-slate-500">đ/m² {so(giaNNTay) > 0 ? '(bạn tự nhập)' : dungBangGiaMoi ? `(bảng giá mới, vị trí ${duAn === 'camlam' ? viTri : vtBG})` : '(chưa có — cần điền)'}</span>
                </div>
                <p className={`mt-1 text-[11.5px] leading-snug text-slate-400 ${dungBangGiaMoi ? '' : 'hidden'}`}>
                  Bảng giá 4 xã vùng Cam Lâm: cây hằng năm / lâu năm {soTien(BANG_GIA_NN.cay.vt1)} (VT1) · {soTien(BANG_GIA_NN.cay.vt2)} (VT2) — thuỷ sản {soTien(BANG_GIA_NN.thuysan.vt1)} · {soTien(BANG_GIA_NN.thuysan.vt2)} — rừng sản xuất {soTien(BANG_GIA_NN.rung.vt1)} · {soTien(BANG_GIA_NN.rung.vt2)} đ/m².
                </p>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-[12.5px] text-slate-600">Số lần
                  <input value={heSoNghe} onChange={(e) => setHeSoNghe(e.target.value)} inputMode="decimal" placeholder="VD: 5" className={`${O} mt-1`} /></label>
                <label className="text-[12.5px] text-slate-600">Diện tích đất nông nghiệp bị thu hồi (m²)
                  <input value={dtHanMuc} onChange={(e) => setDtHanMuc(e.target.value)} inputMode="decimal" placeholder={dienTich ? `mặc định ${dienTich.toLocaleString('vi-VN')} (ô diện tích ở tab ①)` : 'mặc định = diện tích thu hồi'} className={`${O} mt-1`} /></label>
                <label className="text-[12.5px] text-slate-600 sm:col-span-2">Hạn mức giao đất áp cho thửa này (Điều 176 Luật Đất đai 2024)
                  <select value={hanMucChon.ma} onChange={(e) => setMaHanMuc(e.target.value)} className={`${O} mt-1`}>
                    {dsHanMuc.map((h) => <option key={h.ma} value={h.ma}>{h.ten}</option>)}
                  </select></label>
              </div>
              {biCatHanMuc && (
                <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] leading-snug text-amber-800">
                  Diện tích thu hồi <b>{(dtTuNhap || dienTich).toLocaleString('vi-VN')} m²</b> vượt hạn mức <b>{hanMucChon.m2.toLocaleString('vi-VN')} m²</b> →
                  chỉ tính hỗ trợ cho <b>{dtTinhNghe.toLocaleString('vi-VN')} m²</b>, phần vượt <b>không được khoản hỗ trợ này</b>.
                </p>
              )}
              {!truSxNn && <p className="mt-1.5 text-[12px] text-slate-500">Không phải hộ trực tiếp sản xuất nông nghiệp → chỉ được 50% phần cộng thêm của QĐ 32/2026 (khoản 2 Điều 9){heSo > SO_LAN_TRUOC_QD32 ? ` = ${((heSo - SO_LAN_TRUOC_QD32) * 0.5).toLocaleString('vi-VN')} lần` : ' — với mức 3 lần (trước 30/4/2026) thì bằng 0'}.</p>}
              {tienNghe > 0 && (
                <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0A2540]">{tien(tienNghe)}</b>
                  <span className="ml-1 text-[12px] text-slate-400">({tien(giaNN)} × {dtTinhNghe.toLocaleString('vi-VN')} m² × {heSo})</span></p>
              )}
            </div>

            {/* ── Hỗ trợ ổn định đời sống — Điều 19 Nghị định 88/2024/NĐ-CP ── */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0A2540]">Hỗ trợ ổn định đời sống</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                Mỗi nhân khẩu, mỗi tháng được số tiền bằng <b>30 kg gạo</b> (Điều 19 Nghị định 88/2024/NĐ-CP); Khánh Hòa lấy <b>giá gạo tẻ thường
                bình quân 6 tháng do Sở Tài chính thông báo</b> (khoản 4 Điều 6 QĐ 32/2026). Số tháng tuỳ theo thu hồi bao nhiêu phần đất nông nghiệp
                đang dùng và có phải dời nhà không. <b>Giá gạo lấy đúng con số ghi trong phương án bồi thường của dự án</b> — web không tự đặt giá.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-[12.5px] text-slate-600">Số nhân khẩu trong hộ
                  <input value={soKhau} onChange={(e) => setSoKhau(e.target.value)} inputMode="decimal" placeholder="VD: 4" className={`${O} mt-1`} /></label>
                <label className="text-[12.5px] text-slate-600">Giá 1 kg gạo (đồng)
                  <input value={giaGao} onChange={(e) => setGiaGao(e.target.value)} inputMode="decimal" placeholder="theo phương án của dự án" className={`${O} mt-1`} /></label>
                <label className="text-[12.5px] text-slate-600 sm:col-span-2">Phần đất nông nghiệp đang dùng bị thu hồi
                  <select value={tyThuHoi} onChange={(e) => setTyThuHoi(e.target.value as any)} className={`${O} mt-1`}>
                    <option value="duoi30">Dưới 30% — được 70% mức hỗ trợ (khoản 6 Điều 6 QĐ 32/2026)</option>
                    <option value="30-70">Từ 30% đến 70%</option>
                    <option value="tren70">Trên 70%</option>
                  </select></label>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                  <input type="checkbox" checked={phaiDoiNha} onChange={(e) => setPhaiDoiNha(e.target.checked)} className="h-4 w-4" /> Phải di chuyển chỗ ở</label>
                <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                  <input type="checkbox" checked={vungKhoKhan} onChange={(e) => setVungKhoKhan(e.target.checked)} className="h-4 w-4" /> Chuyển đến vùng kinh tế - xã hội khó khăn</label>
                <label className="flex items-start gap-2 text-[12.5px] text-slate-600">
                  <input type="checkbox" checked={khongDuDkDat} onChange={(e) => setKhongDuDkDat(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>Không đủ điều kiện bồi thường về đất nhưng thực tế canh tác trên đất thu hồi → 70% (khoản 1 Điều 6 QĐ 32/2026)</span></label>
              </div>
              <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0A2540]">{tien(tienOnDinh)}</b>
                <span className="ml-1 text-[12px] text-slate-400">({so(soKhau) || 0} khẩu × {GAO_KG_THANG} kg × {tien(so(giaGao))} × {thangOnDinh} tháng{heSoOnDinh < 1 ? ' × 70%' : ''})</span></p>
              {tyThuHoi === 'duoi30' && <p className="mt-1 text-[12px] leading-snug text-slate-500">Thu hồi dưới 30%: QĐ 32/2026 cho 70% “mức hỗ trợ quy định tại khoản 1 Điều 19 NĐ 88/2024” — web tạm tính theo số tháng của khung thấp nhất (thu hồi 30–70%). Số chính thức theo phương án của dự án.</p>}
            </div>

            {/* ── Hỗ trợ tạm cư — Điều 4, 5 QĐ 32/2026 (13/10/2026) ── */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <label className="flex items-start gap-2 text-[13.5px] font-semibold text-[#0A2540]">
                <input type="checkbox" checked={coTamCu} onChange={(e) => setCoTamCu(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>Hỗ trợ tạm cư (tiền thuê nhà)</span></label>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                Khi <b>đất ở bị thu hồi trước khi được bố trí tái định cư</b> (dự án theo khoản 4 Điều 3 Nghị quyết 254/2025/QH15, hoặc tái định cư ở
                xã khác — Điều 4, 5 QĐ 32/2026): hộ tối đa 4 người được <b>7.000.000 đ/tháng</b> nếu đất ở phường, <b>4.000.000 đ/tháng</b> nếu ở xã, đặc khu;
                mỗi người thêm cộng 10%. Thời gian: từ ngày dời nhà đến ngày cắm mốc giao đất tái định cư <b>+ 5 tháng</b> xây nhà (hoặc đến ngày nhận nhà tái định cư).
              </p>
              {coTamCu && (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <label className="text-[12.5px] text-slate-600">Đất thu hồi ở
                    <select value={tamCuPhuong ? 'phuong' : 'xa'} onChange={(e) => setTamCuPhuong(e.target.value === 'phuong')} className={`${O} mt-1`}>
                      <option value="xa">Xã, đặc khu — 4.000.000 đ/tháng</option>
                      <option value="phuong">Phường — 7.000.000 đ/tháng</option>
                    </select></label>
                  <label className="text-[12.5px] text-slate-600">Số người trong hộ
                    <input value={tamCuNguoi} onChange={(e) => setTamCuNguoi(e.target.value)} inputMode="decimal" className={`${O} mt-1`} /></label>
                  <label className="text-[12.5px] text-slate-600">Số tháng tạm cư
                    <input value={tamCuThang} onChange={(e) => setTamCuThang(e.target.value)} inputMode="decimal" placeholder="VD: 11" className={`${O} mt-1`} /></label>
                </div>
              )}
              {tienTamCu > 0 && <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0A2540]">{tien(tienTamCu)}</b>
                <span className="ml-1 text-[12px] text-slate-400">({tien(mucTamCu)}/tháng × {so(tamCuThang)} tháng)</span></p>}
            </div>

            {/* ── Bồi thường chi phí di chuyển tài sản — khoản 1 Điều 8 (QĐ 14/2025) ── */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0A2540]">Bồi thường chi phí di chuyển tài sản (khi phải dời chỗ ở)</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">Khoản 1 Điều 8 Quy định kèm QĐ 17/2024, được thay bằng <b>khoản 6 Điều 2 QĐ 14/2025/QĐ-UBND</b>.</p>
              <select value={maDiChuyen} onChange={(e) => setMaDiChuyen(e.target.value)} className={`${O} mt-2`}>
                <option value="">Không phải di chuyển chỗ ở</option>
                {DI_CHUYEN.map((d) => <option key={d.ma} value={d.ma}>{d.ten} — {soTien(d.tien)} đ/hộ</option>)}
              </select>
              {!!maDiChuyen && (
                <label className="mt-2 block text-[12.5px] text-slate-600">Nhà có mấy tầng (nhà nhiều tầng được cộng thêm 20% cho mỗi tầng tính từ tầng thứ 3)
                  <input value={soTang} onChange={(e) => setSoTang(e.target.value)} inputMode="decimal" placeholder="VD: 1 — nhà trệt" className={`${O} mt-1`} /></label>
              )}
              {!!maDiChuyen && (
                <label className="mt-2 flex items-start gap-2 text-[12.5px] leading-snug text-slate-600">
                  <input type="checkbox" checked={tuLoChoO} onChange={(e) => setTuLoChoO(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span><b>Tự lo chỗ ở</b> (không nhận đất/nhà tái định cư) → được thêm một khoản hỗ trợ tái định cư <b>bằng đúng chi phí di chuyển</b> ở trên (khoản 2 Điều 12 QĐ 17/2024).</span>
                </label>
              )}
              {tienDiChuyen > 0 && (
                <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0A2540]">{tien(tienDiChuyen)}</b>
                  <span className="ml-1 text-[12px] text-slate-400">({soTien(mucDiChuyen!.tien)} đ{tangThem > 0 ? ` + ${tangThem} tầng × 20%` : ''}{tuLoChoO ? ' × 2 vì tự lo chỗ ở' : ''})</span></p>
              )}
            </div>

            {/* ── Hỗ trợ ổn định sản xuất, kinh doanh — Điều 11 QĐ 17/2024 ── */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0A2540]">Hỗ trợ ổn định sản xuất, kinh doanh</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                Dành cho <b>tổ chức kinh tế, hộ/cá nhân sản xuất kinh doanh, doanh nghiệp có vốn nước ngoài</b>:
                hỗ trợ bằng tiền <b>30% một năm thu nhập sau thuế</b>, lấy theo thu nhập bình quân <b>03 năm liền kề trước đó</b>
                (khoản 2 Điều 11 Quy định kèm QĐ 17/2024/QĐ-UBND).
                Hộ nhận bồi thường bằng <b>đất nông nghiệp</b> thì được hỗ trợ bằng <b>hiện vật</b> — giống cây trồng, giống vật nuôi, khuyến nông, thú y — không quy ra tiền ở đây (khoản 1).
                Người lao động bị mất việc được trợ cấp ngừng việc <b>tối đa 06 tháng</b> (khoản 3).
              </p>
              <label className="mt-2 block text-[12.5px] text-slate-600">Thu nhập sau thuế bình quân 1 năm (đồng)
                <input value={thuNhapNam} onChange={(e) => setThuNhapNam(e.target.value)} inputMode="decimal" placeholder="lấy bình quân 3 năm gần nhất" className={`${O} mt-1`} /></label>
              {tienSxkd > 0 && <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0A2540]">{tien(tienSxkd)}</b> <span className="text-[12px] text-slate-400">(30% × {tien(so(thuNhapNam))})</span></p>}
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0A2540]">Thưởng bàn giao mặt bằng trước hạn</p>
              <select value={cachThuong} onChange={(e) => setCachThuong(e.target.value as any)} className={`${O} mt-1.5`}>
                <option value="10pt">Dự án thông thường: 10% tổng tiền bồi thường, hỗ trợ (1–8 triệu)</option>
                <option value="k7">Dự án theo khoản 7 Điều 111 Luật Đất đai: 5.000.000 + 3.000.000 đ</option>
                <option value="khong">Không bàn giao trước hạn — không được thưởng</option>
                <option value="tay">Tự nhập theo phương án</option>
              </select>
              {cachThuong === 'tay' && <input value={thuongTay} onChange={(e) => setThuongTay(e.target.value)} inputMode="decimal" placeholder="số tiền thưởng (đồng)" className={`${O} mt-1.5`} />}
              {tienThuong > 0 && <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0A2540]">{tien(tienThuong)}</b>
                {cachThuong === '10pt' && <span className="ml-1 text-[12px] text-slate-400">(10% × {tien(tongChuaThuong)}, thấp nhất 1 triệu, cao nhất 8 triệu)</span>}</p>}
              <p className="mt-1 text-[11.5px] leading-snug text-slate-400">Điều 15 QĐ 32/2026 (hiệu lực 30/4/2026); mức 5.000.000 đ: điểm c khoản 1 Điều 14 QĐ 17/2024, sửa bởi QĐ 14/2025. Mỗi dự án bị ảnh hưởng được thưởng riêng.</p>
            </div>
            <label className="mt-3 block text-[12.5px] text-slate-600">Khoản khác trong phương án bồi thường (đồng)
              <input value={khac} onChange={(e) => setKhac(e.target.value)} inputMode="decimal" placeholder="0" className={`${O} mt-1`} /></label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold text-[#0A2540]">Đơn giá một số chi phí — Quyết định 12/2026/QĐ-UBND</p>
            <p className="mt-1 text-[12.5px] leading-snug text-slate-600">Ngày 24/02/2026 của UBND tỉnh Khánh Hòa, gồm 4 phụ lục:</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-slate-600">
              <li>Phụ lục I — Đơn giá tự xây dựng, cải tạo, sửa chữa, nâng cấp công trình.</li>
              <li>Phụ lục II — Đơn giá bồi thường, hỗ trợ khi phải <b>di dời mồ mả</b>.</li>
              <li>Phụ lục III — Đơn giá <b>tháo dỡ, di chuyển, lắp đặt tài sản</b>.</li>
              <li>Phụ lục IV — Đơn giá bồi thường <b>chi phí đầu tư vào đất còn lại</b>.</li>
            </ul>
            {/* 15/10/2026: bảng QĐ 12 tra CHUNG với QĐ 08 ở thẻ ② (cùng một bảng tính "Hạng mục đã chọn") — trước tra riêng ở đây, cộng vào
                bảng tính nằm ở thẻ ② nên người dùng không thấy, còn ở thẻ ② thì không tìm ra QĐ 12. */}
            <button type="button" data-cho-xem onClick={() => { setLocVb('12'); setTim(timCp); setTab('nha'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="mt-2.5 w-full rounded-lg border border-[#0A2540] px-3 py-2 text-[13px] font-bold text-[#0A2540] hover:bg-[#0A2540] hover:text-white">
              Tra đơn giá QĐ 12/2026 và cộng vào bảng tính → thẻ ② Nhà &amp; công trình
            </button>
            <p className="mt-1.5 text-[12px] leading-snug text-slate-500">Số lấy từ bản Word đăng trên Công báo tỉnh Khánh Hòa (không phải bản scan) — {chiPhi.length || 315} hạng mục của 4 phụ lục.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={TL + 'QD-12-2026-don-gia-boi-thuong-ho-tro-chi-phi.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-[#0A2540] px-3 py-1.5 text-[12.5px] font-bold text-white">📄 QĐ 12/2026 (PDF)</a>
              <a href={TL + '2093-SXD-huong-dan-ap-dung-QD08-QD12.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0A2540] hover:bg-slate-200">📑 Hướng dẫn áp dụng của Sở Xây dựng</a>
              <a href={TL + 'QD-17-2024-quy-dinh-boi-thuong-ho-tro-tai-dinh-cu.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0A2540] hover:bg-slate-200">📑 QĐ 17/2024 — quy định gốc của tỉnh</a>
              <a href={TL + 'QD-14-2025-sua-doi-boi-thuong-ho-tro-tai-dinh-cu.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0A2540] hover:bg-slate-200">📑 QĐ 14/2025 — bản sửa đang áp dụng</a>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────── ⑤ CĂN CỨ ───────────────── */}
      {tab === 'cancu' && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-bold text-[#0A2540]">Người bị thu hồi đất nông nghiệp được nhận những khoản gì?</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-slate-600">
            <li><b>Tiền bồi thường về đất</b> = diện tích thu hồi × giá đất cụ thể được phê duyệt cho dự án.</li>
            <li><b>Bồi thường nhà, công trình xây dựng</b> gắn liền với đất — đơn giá tại QĐ 08/2026/QĐ-UBND.</li>
            <li><b>Bồi thường cây trồng, vật nuôi</b> bị thiệt hại — Điều 103 Luật Đất đai 2024, đơn giá tại QĐ 35/2026/QĐ-UBND (hiệu lực 14/5/2026); phần cây vượt mật độ hỗ trợ 80% (Điều 11 QĐ 32/2026).</li>
            <li><b>Bồi thường chi phí đầu tư vào đất còn lại</b> — Điều 104 Luật Đất đai 2024, đơn giá tại QĐ 12/2026.</li>
            <li><b>Hỗ trợ ổn định đời sống và sản xuất</b> — Điều 108 Luật Đất đai 2024.</li>
            <li><b>Hỗ trợ đào tạo, chuyển đổi nghề và tìm kiếm việc làm</b> — Điều 109 Luật Đất đai 2024 &amp; khoản 3 Điều 22 Nghị định 88/2024/NĐ-CP: hỗ trợ bằng tiền <b>không quá 5 lần</b> giá đất nông nghiệp cùng loại trong bảng giá đất, tính cho toàn bộ diện tích thu hồi nhưng <b>không vượt hạn mức giao đất nông nghiệp</b> (Điều 176 Luật Đất đai 2024); mức cụ thể do UBND tỉnh quy định. <b>Khánh Hòa đang áp dụng 05 lần</b>: 03 lần theo Điều 13 Quy định kèm QĐ 17/2024/QĐ-UBND (được thay bằng khoản 10 Điều 2 QĐ 14/2025/QĐ-UBND) <b>+ 02 lần</b> theo khoản 1 Điều 9 QĐ 32/2026/QĐ-UBND (hiệu lực 30/4/2026); người không đủ điều kiện chuyển đổi nghề được 50% phần cộng thêm (khoản 2 Điều 9).</li>
              <li><b>Hỗ trợ ổn định đời sống</b> — Điều 108 Luật Đất đai 2024 &amp; Điều 19 Nghị định 88/2024/NĐ-CP: mỗi nhân khẩu mỗi tháng được số tiền bằng <b>30 kg gạo</b> theo giá trung bình tại thị trường địa phương. Thu hồi 30–70% đất nông nghiệp đang dùng: 6 tháng (không dời nhà) / 12 tháng (dời nhà) / tối đa 24 tháng nếu dời đến vùng khó khăn. Thu hồi trên 70%: 12 / 24 / tối đa 36 tháng.</li>
              <li><b>Bồi thường chi phí di chuyển tài sản</b> — khoản 1 Điều 8 Quy định kèm QĐ 17/2024, thay bằng khoản 6 Điều 2 QĐ 14/2025/QĐ-UBND: <b>10.000.000 đ/hộ</b> nếu chuyển trong cùng xã, <b>12.000.000 đ/hộ</b> nếu ra ngoài xã, <b>5.000.000 đ/hộ</b> nếu chỉ thu hồi một phần đất ở mà phần còn lại vẫn xây nhà được; nhà nhiều tầng cộng thêm <b>20%</b> cho mỗi tầng từ tầng thứ 3 trở lên.</li>
              <li><b>Hỗ trợ ổn định sản xuất, kinh doanh</b> — Điều 20 Nghị định 88/2024/NĐ-CP &amp; Điều 11 Quy định kèm QĐ 17/2024/QĐ-UBND: tổ chức kinh tế, hộ/cá nhân sản xuất kinh doanh được <b>30% một năm thu nhập sau thuế</b> (bình quân 03 năm liền kề); hộ nhận bồi thường bằng đất nông nghiệp được hỗ trợ giống cây trồng, giống vật nuôi, khuyến nông, thú y; người lao động được trợ cấp ngừng việc tối đa <b>06 tháng</b>.</li>
              <li><b>Hỗ trợ tái định cư khi tự lo chỗ ở</b> — khoản 2 Điều 12 Quy định kèm QĐ 17/2024/QĐ-UBND: ngoài bồi thường còn được thêm một khoản <b>bằng đúng chi phí di chuyển tài sản</b>.</li>
              <li><b>Thưởng bàn giao mặt bằng trước thời hạn</b> — Điều 15 QĐ 32/2026/QĐ-UBND (hiệu lực 30/4/2026): dự án theo khoản 7 Điều 111 Luật Đất đai được <b>5.000.000 đ</b> (điểm c khoản 1 Điều 14 Quy định kèm QĐ 17/2024, sửa bởi khoản 11 Điều 2 QĐ 14/2025) <b>+ 3.000.000 đ</b>; dự án khác được <b>10% tổng tiền bồi thường, hỗ trợ</b>, thấp nhất 1.000.000 đ, cao nhất 8.000.000 đ.</li>
              <li><b>Hỗ trợ tạm cư</b> khi đất ở bị thu hồi trước khi bố trí tái định cư — Điều 4, 5 QĐ 32/2026: <b>7.000.000 đ/tháng</b> (phường) hoặc <b>4.000.000 đ/tháng</b> (xã, đặc khu) cho hộ tối đa 4 người, mỗi người thêm + 10%.</li>
              <li><b>Tài sản không đủ điều kiện bồi thường</b> (Điều 105 Luật Đất đai) vẫn được hỗ trợ — Điều 10 QĐ 32/2026: tường rào, bờ kè, móng trụ 100%; nhà ở, mái che, công trình phụ 80%; công trình khác tối đa 70%; của tổ chức 50% giá trị hiện có.</li>
              <li><b>Ổn định đời sống</b> khi thu hồi dưới 30% đất nông nghiệp, hoặc không đủ điều kiện bồi thường đất mà thực tế canh tác: <b>70%</b> mức của khoản 1 Điều 19 NĐ 88/2024 (Điều 6 QĐ 32/2026).</li>
            <li><b>Chi phí di dời mồ mả, tháo dỡ – di chuyển tài sản</b> — đơn giá tại QĐ 12/2026.</li>
            <li><b>Thưởng bàn giao mặt bằng đúng hạn</b> và hỗ trợ khác theo quy định của tỉnh.</li>
          </ol>
          <p className="mt-2.5 text-[12.5px] leading-snug text-slate-500">
            Quy định chung của tỉnh Khánh Hòa: <b>Quyết định 17/2024/QĐ-UBND</b> ngày 29/8/2024, sửa đổi bởi <b>Quyết định 14/2025/QĐ-UBND</b>.
          </p>
          <p className="mt-3 text-[13px] font-bold text-[#0A2540]">Văn bản gốc (bấm để xem)</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[['TB-306-gia-dat-boi-thuong-Cam-Lam-07-5-2026.pdf', 'TB 306/TB-HĐTĐ — giá đất KĐT mới Cam Lâm'],
              ['QD-2952-gia-dat-boi-thuong-KDT-Suoi-Tan.pdf', 'QĐ 2952 — KĐT phức hợp Suối Tân'],
              ['QD-2953-gia-dat-boi-thuong-KDT-Cam-Thuong.pdf', 'QĐ 2953 — KĐT phức hợp Cam Thượng'],
              ['QD-2954-gia-dat-boi-thuong-KDT-Cam-Tan.pdf', 'QĐ 2954 — KĐT phức hợp Cam Tân'],
              ['QD-2955-gia-dat-boi-thuong-KDT-Cam-Hoa.pdf', 'QĐ 2955 — KĐT phức hợp Cam Hòa'],
              ['QD-08-2026-don-gia-boi-thuong-nha-cong-trinh.pdf', 'QĐ 08/2026 — đơn giá nhà, công trình'],
              ['QD-12-2026-don-gia-boi-thuong-ho-tro-chi-phi.pdf', 'QĐ 12/2026 — đơn giá một số chi phí'],
              ['QD-35-2026-don-gia-boi-thuong-cay-trong-vat-nuoi.pdf', 'QĐ 35/2026 — đơn giá cây trồng, vật nuôi'],
              ['QD-32-2026-chinh-sach-ho-tro-boi-thuong-tai-dinh-cu.pdf', 'QĐ 32/2026 — chính sách hỗ trợ'],
              ['2093-SXD-huong-dan-ap-dung-QD08-QD12.pdf', 'CV 2093/SXD — hướng dẫn áp dụng QĐ 08 & 12']].map(([f, n]) => (
              <a key={f} href={TL + f} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0A2540] hover:bg-slate-200">📄 {n}</a>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/bang-gia-dat" className="rounded-lg bg-slate-100 px-3.5 py-2 text-[13px] font-semibold text-[#0A2540] hover:bg-slate-200">📊 Bảng giá đất 2026</Link>
            <Link href="/van-ban" className="rounded-lg bg-slate-100 px-3.5 py-2 text-[13px] font-semibold text-[#0A2540] hover:bg-slate-200">📑 Tra cứu văn bản</Link>
            <Link href="/map" className="rounded-lg bg-slate-100 px-3.5 py-2 text-[13px] font-semibold text-[#0A2540] hover:bg-slate-200">🗺️ Bản đồ quy hoạch</Link>
          </div>
        </div>
      )}

      {/* ───────────────── TỔNG — THANH DÍNH ĐÁY, TAB NÀO CŨNG THẤY ─────────────────
          Chủ dự án 16/9/2026: tách tab cho rõ nhưng đừng để phải cuộn tìm tổng tiền.
          16/9/2026 chốt: KHÔNG dính đáy che nội dung — để nằm hẳn cuối trang, bấm để mở/thu chi tiết. */}
      <div className="mt-4">
        <button onClick={() => setMoTong((v) => !v)} className="w-full rounded-2xl bg-[#0A2540] p-3.5 text-left text-white shadow-[0_8px_30px_rgba(10,37,64,.35)]">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] uppercase tracking-wide text-white/70">Tổng tiền dự kiến</p>
              <p className="text-[22px] font-extrabold leading-tight text-[#FFD56A]">{tong > 0 ? tien(tong) : '—'}</p>
            </div>
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-white/90">{moTong ? 'Thu gọn ▾' : 'Chi tiết ▸'}</span>
          </div>
          {moTong && (
            <div className="mt-2 space-y-0.5 border-t border-white/15 pt-2 text-[12.5px] text-white/85">
              {tienDat > 0 && <p>· Đất: {tien(tienDat)}</p>}
              {tienNha > 0 && <p>· Nhà, công trình &amp; chi phí khác: {tien(tienNha)}</p>}
              {tienNghe > 0 && <p>· Hỗ trợ chuyển đổi nghề: {tien(tienNghe)}</p>}
              {tienOnDinh > 0 && <p>· Hỗ trợ ổn định đời sống: {tien(tienOnDinh)}</p>}
              {tienDiChuyen > 0 && <p>· Di chuyển tài sản{tuLoChoO ? ' + tự lo chỗ ở' : ''}: {tien(tienDiChuyen)}</p>}
              {tienSxkd > 0 && <p>· Ổn định sản xuất, kinh doanh: {tien(tienSxkd)}</p>}
              {tienCay > 0 && <p>· Cây trồng, vật nuôi: {tien(tienCay)}</p>}
              {tienTamCu > 0 && <p>· Hỗ trợ tạm cư: {tien(tienTamCu)}</p>}
              {tienThuong > 0 && <p>· Thưởng bàn giao: {tien(tienThuong)}</p>}
              {so(khac) > 0 && <p>· Khoản khác: {tien(so(khac))}</p>}
              {tong === 0 && <p>Chưa có số liệu — hãy nhập diện tích ở mục ① hoặc chọn hạng mục ở mục ② ③ ④.</p>}
              <p className="pt-1 text-[11.5px] leading-snug text-white/60">Con số chỉ mang tính tham khảo. Số chính thức là số ghi trong phương án bồi thường, hỗ trợ, tái định cư được cơ quan có thẩm quyền phê duyệt.</p>
            </div>
          )}
        </button>
      </div>
    </div>
  );
  return khoa ? <>{cheSo(trang, () => setHopTraPhi(true))}</> : trang;
}
