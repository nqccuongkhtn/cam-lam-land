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
type Dieu = { so: number; tieuDe: string; chuong: string; chuongTen: string; muc: string | null; mucTen: string; khoan: Khoan[] };
type VanBan = { ma: string; soHieu: string; ngay: string; ten: string; nguon: string; phuLuc?: string; hetHieuLuc?: string; chuong: { so: string; ten: string }[]; dieu: Dieu[] };

type KhoItem = { ma: string; soHieu: string; ngay: string; ten: string; soDieu: number; hetHieuLuc?: string };
// Giải thích do người làm web viết, KHÔNG phải chữ luật — luôn để trong khung riêng, màu khác.
type GiaiThich = { canhBao: string; muc: Record<string, { y: string; nho: string }> };
type DoiChieu = { canhBao: string; moi: string; cu: string; cap: Record<string, { cu: number[]; y: string }> };
type NutSoDo = { ten: string; y: string; dan: { ma: string; so?: number }[] };
type NhanhSoDo = { ten: string; icon: string; mau: string; y: string; con: NutSoDo[] };
type SoDo = { canhBao: string; nhanh: NhanhSoDo[] };

// DẪN CHIẾU TRONG CHỮ LUẬT — biến thành nút bấm được, kiểu Thư viện pháp luật.
// Ba dạng, xét theo đúng thứ tự này (dạng dài phải xét trước, không thì bị dạng ngắn ăn mất):
//   1. "Điều 5 của Nghị định số 88/2024/NĐ-CP"  -> nhảy tới đúng điều của đúng văn bản
//   2. "Điều 137 của Luật này" / "Nghị định này" -> nhảy trong chính văn bản đang xem
//   3. "88/2024/NĐ-CP" đứng một mình              -> mở văn bản đó
const RE_DAN = new RegExp(
  'Điều\\s+(\\d{1,3})\\s+(?:của\\s+)?(?:Luật|Nghị định|Thông tư)\\s+(?:số\\s+)?(\\d{1,4}/\\d{4}/[A-ZĐ][A-ZĐ0-9-]*)'
  + '|Điều\\s+(\\d{1,3})(?:\\s+của)?\\s+(?:Luật|Nghị định|Thông tư)\\s+này'
  + '|(\\d{1,4}/\\d{4}/[A-ZĐ][A-ZĐ0-9-]*)',
  'g');

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
  if (ma === 'ldd2024') return 'Luật Đất đai 2024';
  if (ma === 'ldd2013') return 'Luật Đất đai 2013';
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
  const [dc, setDc] = useState<DoiChieu | null>(null);
  const [sd, setSd] = useState<SoDo | null>(null);
  const [moNhanh, setMoNhanh] = useState<Record<number, boolean>>({ 0: true });
  const [the, setThe] = useState<'luat' | 'sodo' | 'danhmuc'>('luat');
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
    fetch('/luat/doi-chieu.json').then((r) => r.json()).then((d: DoiChieu) => setDc(d)).catch(() => {});
    fetch('/luat/so-do.json').then((r) => r.json()).then((d: SoDo) => setSd(d)).catch(() => {});
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
      }
      if (maDich) {
        const md = maDich, sd2 = soDich;
        ra.push(
          <button key={`l${m.index}`} onClick={() => (sd2 ? moDieu(md, sd2) : doiVanBan(md))}
            title={sd2 ? `Tới Điều ${sd2}` : 'Mở văn bản này'}
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
        {kho.length ? <>Kho có <b className="text-[#0A2540]">{kho.length} văn bản</b> · <b className="text-[#0A2540]">{tongDieu} điều</b> —
          Luật Đất đai 2024 và các nghị định hướng dẫn. Nguyên văn lấy từ bản PDF ký số đăng Công báo Chính phủ.</> : 'Đang tải…'}
      </p>

      <div className="mt-3 flex gap-1.5">
        {([['luat', '⚖️ Toàn văn luật & nghị định'], ['sodo', '🧠 Sơ đồ tư duy'], ['danhmuc', '📚 Danh mục văn bản đất đai']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setThe(k)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${the === k ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{l}</button>
        ))}
      </div>

      {/* ── SƠ ĐỒ TƯ DUY: gom cả bộ luật thành 8 nhánh việc thật, mỗi ô dẫn thẳng tới điều gốc ── */}
      {the === 'sodo' && (
        <div className="mt-3">
          {!sd ? <p className="text-slate-400">Đang tải sơ đồ…</p> : (
            <>
              <p className="text-[12.5px] leading-snug text-slate-500">
                Gom cả bộ luật thành <b>{sd.nhanh.length} nhánh việc thật</b>. Ý nào nhiều điều nói cùng một chuyện
                thì gộp làm một ô. Bấm vào nút <b>Điều …</b> là nhảy thẳng sang nguyên văn.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => setMoNhanh(Object.fromEntries(sd.nhanh.map((_, i) => [i, true])))}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">Mở hết</button>
                <button onClick={() => setMoNhanh({})}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600">Thu hết</button>
              </div>

              <div className="mt-3 space-y-2.5">
                {sd.nhanh.map((n, i) => {
                  const mo = !!moNhanh[i];
                  const mau = MAU_NHANH[n.mau] || MAU_NHANH.slate;
                  return (
                    <div key={n.ten} className={`overflow-hidden rounded-2xl border-2 ${mau.split(' ')[0]} bg-white`}>
                      <button onClick={() => setMoNhanh((m) => ({ ...m, [i]: !m[i] }))}
                        className={`flex w-full items-start gap-2 px-3 py-2.5 text-left ${mau}`}>
                        <span className="text-[20px] leading-none">{n.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-extrabold leading-snug">{n.ten}</span>
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
          )}
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
      {/* ── CHỌN VĂN BẢN: một hàng cuộn ngang, mỗi nút một văn bản ── */}
      <div className="-mx-3 mt-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5 pb-1">
          {kho.map((x) => (
            <button key={x.ma} onClick={() => doiVanBan(x.ma)} title={`${x.ten} — ${x.soHieu}, ngày ${ngayVn(x.ngay)}`}
              className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-left transition ${maVb === x.ma ? 'border-[#0A2540] bg-[#0A2540]' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <span className={`block text-[12.5px] font-bold ${maVb === x.ma ? 'text-white' : x.hetHieuLuc ? 'text-rose-700' : 'text-[#0A2540]'}`}>
                {x.hetHieuLuc ? '⛔ ' : ''}{nhanNgan(x.ma, x.soHieu)}
              </span>
              <span className={`block text-[10.5px] ${maVb === x.ma ? 'text-white/70' : 'text-slate-400'}`}>
                {x.hetHieuLuc ? 'hết hiệu lực' : `${x.soDieu} điều`}
              </span>
            </button>
          ))}
        </div>
      </div>
      {vb && (
        <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
          <b className="text-[#0A2540]">{vb.ten}</b> — số {vb.soHieu}, ngày {ngayVn(vb.ngay)} · {vb.dieu.length} điều
          {vb.chuong.length ? `, ${vb.chuong.length} chương` : ''}.
          {vb.phuLuc ? <button onClick={() => { setXemPhuLuc((v) => !v); setChon(null); oNoiDung.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            className="ml-1.5 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">📎 Phụ lục</button> : null}
        </p>
      )}
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
            placeholder="Gõ từ khoá (không dấu cũng được) hoặc số điều — ví dụ: thu hoi dat, 75, bảng giá đất"
            className="w-full bg-transparent text-[15px] outline-none" />
          {tim && <button onClick={() => setTim('')} className="text-slate-400 hover:text-slate-700">✕</button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {/* Nhiều việc luật chỉ nói một câu rồi "Chính phủ quy định chi tiết" -> chữ thật nằm ở nghị định.
              Nút này tìm một lượt cả luật lẫn nghị định. */}
          <button onClick={() => setTimCaKho((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${timCaKho ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
            {dangTaiKho ? '⏳ Đang mở cả kho…' : `🔎 Tìm cả ${kho.length || ''} văn bản${timCaKho ? ' ✓' : ''}`}
          </button>
          {CHU_DE.map((c) => (
            <button key={c.ten} onClick={() => { setTim(c.tim); setChiGhim(false); setChon(null); setXemPhuLuc(false); }}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${kd(tim) === kd(c.tim) ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              {c.icon} {c.ten}
            </button>
          ))}
          <button onClick={() => { setChiGhim((v) => !v); setChon(null); setXemPhuLuc(false); }}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${chiGhim ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
            ⭐ Điều đã ghim ({ghim.length})
          </button>
          {gt && (
            <button onClick={() => { setChiGt((v) => !v); setChon(null); setXemPhuLuc(false); }}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${chiGt ? 'border-sky-600 bg-sky-600 text-white' : 'border-sky-300 bg-sky-50 text-sky-700'}`}>
              💡 Điều có giải thích ({Object.keys(gt.muc).length})
            </button>
          )}
        </div>
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

                {/* KHUNG ĐỐI CHIẾU CŨ ↔ MỚI — chỉ hiện khi có cặp đã soi tay. */}
                {(() => {
                  if (!dc) return null;
                  const laMoi = vb.ma === dc.moi;
                  const laCu = vb.ma === dc.cu;
                  if (!laMoi && !laCu) return null;
                  // Chiều mới -> cũ tra thẳng; chiều cũ -> mới phải dò ngược.
                  const cap = laMoi ? dc.cap[String(dieuDangXem.so)] : null;
                  const nguoc = laCu
                    ? Object.entries(dc.cap).filter(([, v]) => v.cu.includes(dieuDangXem.so))
                    : [];
                  if (!cap && nguoc.length === 0) return null;
                  const maKia = laMoi ? dc.cu : dc.moi;
                  const nhanKia = laMoi ? 'Luật Đất đai 2013' : 'Luật Đất đai 2024';
                  return (
                    <div className="mt-2.5 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/60 p-3">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-violet-700">
                        🔀 So với {nhanKia} — người làm web lập, không phải bảng đối chiếu chính thức
                      </p>
                      {laMoi && cap && (
                        <>
                          <p className="mt-1 text-[13.5px] leading-relaxed text-slate-700">{cap.y}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {cap.cu.length === 0
                              ? <span className="rounded-lg bg-white px-2 py-1 text-[12px] font-semibold text-violet-800">Luật 2013 không có điều tương ứng</span>
                              : cap.cu.map((s) => (
                                <button key={s} onClick={() => moDieu(maKia, s)}
                                  className="rounded-lg border border-violet-300 bg-white px-2 py-1 text-[12px] font-semibold text-violet-800 hover:bg-violet-100">
                                  Điều {s} (2013) →
                                </button>
                              ))}
                          </div>
                        </>
                      )}
                      {laCu && nguoc.length > 0 && (
                        <>
                          <p className="mt-1 text-[13.5px] leading-relaxed text-slate-700">{nguoc[0][1].y}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {nguoc.map(([s]) => (
                              <button key={s} onClick={() => moDieu(maKia, Number(s))}
                                className="rounded-lg border border-violet-300 bg-white px-2 py-1 text-[12px] font-semibold text-violet-800 hover:bg-violet-100">
                                Điều {s} (2024) →
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

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

                <p className="mt-4 border-t pt-2 text-[11px] leading-snug text-slate-400">
                  Nguyên văn {vb.ten} (số {vb.soHieu}, ngày {ngayVn(vb.ngay)}) — {vb.nguon}. Chữ giữ nguyên, không rút gọn.
                </p>
              </article>
            )}
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
