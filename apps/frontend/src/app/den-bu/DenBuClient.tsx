'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DEN_BU_NGUON, DU_AN_PHUC_HOP, GIA_LUA_2VU, GIA_NONG_NGHIEP, GIA_PHUC_HOP, GIA_RUNG_SAN_XUAT,
  BANG_GIA_NN, TEN_NGAN_LOAI_DAT, TEN_VI_TRI_PH, dsThon, giaBangGiaNN, giaDenBu, type LoaiDat, type ViTriPH,
  HAN_MUC, SO_LAN_KHANH_HOA, SO_LAN_TRAN, DI_CHUYEN, DI_CHUYEN_THEM_MOI_TANG, THUONG_BAN_GIAO,
  GAO_KG_THANG, soThangOnDinh,
} from '@/lib/denBuCamLam';

const tien = (v: number) => Math.round(v).toLocaleString('vi-VN') + ' đ';
const so = (s: string) => {
  const v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : 0;
};
const khongDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
// Ô nhập: chữ 16px để iPhone không tự phóng to trang khi bấm vào ô.
const O = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-[16px] outline-none focus:border-[#0B4045]';
const TL = '/tai-lieu/';

type DongTinh = { ten: string; dv: string; gia: number; sl: number };
// Bảng đơn giá bóc từ BẢN WORD trên Công báo tỉnh (scripts/den-bu/boc-don-gia.py) → mỗi hạng mục đủ
// tên, nhóm, mô tả kết cấu, đơn vị tính và số tiền. Không phải OCR nên số chính xác.
type Muc = { pl?: string; nhom: string; phu: string; ketCau: string; ten: string; dv: string; gia: number };
const TEN_PL: Record<string, string> = {
  I: 'Phụ lục I — tự xây dựng, cải tạo, sửa chữa, nâng cấp',
  II: 'Phụ lục II — di dời mồ mả',
  III: 'Phụ lục III — tháo dỡ, di chuyển, lắp đặt tài sản',
  IV: 'Phụ lục IV — chi phí đầu tư vào đất còn lại',
};

export default function DenBuClient() {
  const [tab, setTab] = useState<'dat' | 'nha' | 'khac' | 'cancu'>('dat');

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
  const [dongs, setDongs] = useState<DongTinh[]>([]);
  useEffect(() => {
    if (tab === 'nha' && !mucs.length) fetch('/den-bu-nha-qd08.json').then((r) => r.json()).then(setMucs).catch(() => setMucs([]));
    if (tab === 'khac' && !chiPhi.length) fetch('/den-bu-chi-phi-qd12.json').then((r) => r.json()).then(setChiPhi).catch(() => setChiPhi([]));
  }, [tab, mucs.length, chiPhi.length]);
  const loc = (ds: Muc[], k: string) => {
    const q = khongDau(k.trim());
    const r = q ? ds.filter((m) => khongDau([m.ten, m.phu, m.nhom, m.ketCau].join(' ')).includes(q)) : ds;
    return r.slice(0, 80);
  };
  const themMuc = (m: Muc) => setDongs((d) => [...d, { ten: [m.phu, m.ten].filter(Boolean).join(' · ') || m.nhom, dv: m.dv, gia: m.gia, sl: 1 }]);
  const theMuc = (m: Muc, i: number) => (
    <button key={i} onClick={() => themMuc(m)} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 active:bg-slate-100">
      <span className="block text-[13.5px] font-semibold leading-snug text-slate-700">{[m.phu, m.ten].filter(Boolean).join(' · ')}</span>
      {m.ketCau && <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-400">{m.ketCau}</span>}
      <span className="mt-0.5 block text-[12.5px] font-bold text-[#0B4045]">{tien(m.gia)} / {m.dv}
        <span className="ml-1 font-normal text-slate-400">· {(m.pl ? TEN_PL[m.pl]?.split('—')[1] || m.nhom : m.nhom).toLowerCase().trim()}</span></span>
    </button>
  );
  const tienNha = dongs.reduce((s, d) => s + d.gia * d.sl, 0);

  // ── Hỗ trợ ───────────────────────────────────────────────
  // MẶC ĐỊNH × 3 — đúng mức Khánh Hòa ĐANG CHI TRẢ. Đã đối chiếu nguyên văn bản gốc Công báo tỉnh
  // (Công báo Khánh Hòa số 015+016 ngày 29/8/2025, khoản 10 Điều 2 QĐ 14/2025/QĐ-UBND sửa Điều 13
  // QĐ 17/2024): "bằng 03 lần giá đất nông nghiệp cùng loại trong Bảng giá đất hiện hành".
  // Mức 5 lần chỉ là TRẦN của khoản 3 Điều 22 NĐ 88/2024 — để nút bấm xem thử, KHÔNG đặt làm mặc định
  // vì hiện số cao gấp rưỡi tiền thật là làm người dân hiểu sai quyền lợi.
  const [heSoNghe, setHeSoNghe] = useState(String(SO_LAN_KHANH_HOA));
  const [truSxNn, setTruSxNn] = useState(true);       // có phải hộ TRỰC TIẾP sản xuất nông nghiệp không
  const [maHanMuc, setMaHanMuc] = useState('hangnam');// hạn mức giao đất áp cho thửa này
  const [dtHanMuc, setDtHanMuc] = useState('');
  const [cayTrong, setCayTrong] = useState('');
  const [thuong, setThuong] = useState(String(THUONG_BAN_GIAO));   // thưởng bàn giao trước hạn (QĐ 14/2025)
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
  const tienNghe = truSxNn && giaNN > 0 && heSo > 0 ? giaNN * dtTinhNghe * heSo : 0;

  // Hỗ trợ ổn định đời sống — Điều 19 NĐ 88/2024
  const thangOnDinh = soThangOnDinh(tyThuHoi, phaiDoiNha, vungKhoKhan);
  const tienOnDinh = so(soKhau) * GAO_KG_THANG * so(giaGao) * thangOnDinh;

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

  const tong = tienDat + tienNha + tienNghe + tienOnDinh + tienDiChuyen + tienSxkd + so(cayTrong) + so(thuong) + so(khac);

  const [moTong, setMoTong] = useState(true);   // thanh tổng tiền dính đáy: mở sẵn phần chi tiết
  const nut = (k: typeof tab, nhan: string) => (
    <button key={k} onClick={() => setTab(k)}
      className={`cl-press whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold ${tab === k ? 'bg-[#0B4045] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{nhan}</button>
  );

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      <h1 className="text-xl font-extrabold text-[#0B4045] sm:text-3xl">Đền bù khi Nhà nước thu hồi đất — Cam Lâm</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Tra giá đất bồi thường theo <b>từng thôn / từng dự án</b>, đơn giá <b>nhà và công trình</b>, rồi tính nhanh tổng tiền. Số liệu lấy nguyên từ văn bản của cơ quan nhà nước — bấm nút để xem bản gốc.
      </p>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nut('dat', '① Tiền đất')}{nut('nha', '② Nhà & công trình')}{nut('khac', '③ Chi phí khác')}{nut('cancu', '④ Căn cứ pháp luật')}
      </div>

      {/* ───────────────── ① TIỀN ĐẤT ───────────────── */}
      {tab === 'dat' && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[13px] font-bold uppercase tracking-wide text-slate-400">Thửa đất nằm trong dự án nào</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button onClick={() => setDuAn('camlam')} className={`cl-press rounded-xl border p-3 text-left ${duAn === 'camlam' ? 'border-[#0B4045] bg-[#0B4045]/[0.04]' : 'border-slate-200'}`}>
              <b className="text-[14px] text-[#0B4045]">Khu đô thị mới Cam Lâm</b>
              <span className="mt-0.5 block text-[12px] text-slate-500">Theo bảng giá đất MỚI (NQ 15/2025) · {DEN_BU_NGUON.vanBan}</span>
            </button>
            <button onClick={() => setDuAn('phuchop')} className={`cl-press rounded-xl border p-3 text-left ${duAn === 'phuchop' ? 'border-[#0B4045] bg-[#0B4045]/[0.04]' : 'border-slate-200'}`}>
              <b className="text-[14px] text-[#0B4045]">4 khu đô thị phức hợp <span className="text-[11px] font-normal text-amber-700">(bảng giá cũ)</span></b>
              <span className="mt-0.5 block text-[12px] text-slate-500">Suối Tân · Cam Thượng · Cam Tân · Cam Hòa — quyết định 23/9/2025</span>
            </button>
          </div>

          {duAn === 'camlam' ? (
            <>
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Loại đất</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['cay', 'thuysan', 'rung'] as LoaiDat[]).map((k) => (
                  <button key={k} onClick={() => { setLoai(k); const d = dsThon(k); if (!d.includes(thon)) setThon(d[0]); }}
                    className={`cl-press rounded-full px-3.5 py-2 text-[13px] font-semibold ${loai === k ? 'bg-[#0B4045] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
                    {TEN_NGAN_LOAI_DAT[k]}
                  </button>
                ))}
              </div>
              {/* THÔN: vừa GÕ TÌM vừa sổ danh sách (chủ dự án 16/9/2026) — 45 thôn, cuộn tìm thì lâu. Gõ không dấu vẫn ra. */}
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Thôn</p>
              <div className="relative mt-2">
                <input value={moThon ? timThon : thonDung}
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
                        className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left text-[14px] last:border-b-0 hover:bg-slate-50 ${t === thonDung ? 'bg-amber-50/70 font-semibold text-[#0B4045]' : 'text-slate-700'}`}>
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
                      className={`cl-press flex-1 rounded-lg px-3 py-2 text-[14px] font-semibold ${viTri === v ? 'bg-[#0B4045] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
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
                <button onClick={() => setPhBanGia('cu')} className={`cl-press rounded-xl border p-3 text-left ${phBanGia === 'cu' ? 'border-[#0B4045] bg-[#0B4045]/[0.04]' : 'border-slate-200'}`}>
                  <b className="text-[13.5px] text-[#0B4045]">Trước 01/01/2026</b>
                  <span className="mt-0.5 block text-[12px] text-slate-500">Tiền hỗ trợ tính theo bảng giá đất CŨ (QĐ 04/2020, sửa bởi QĐ 23/2025)</span>
                </button>
                <button onClick={() => setPhBanGia('moi')} className={`cl-press rounded-xl border p-3 text-left ${phBanGia === 'moi' ? 'border-[#0B4045] bg-[#0B4045]/[0.04]' : 'border-slate-200'}`}>
                  <b className="text-[13.5px] text-[#0B4045]">Từ 01/01/2026</b>
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
                    className={`cl-press rounded-full px-3.5 py-2 text-[13px] font-semibold ${phLoai === k ? 'bg-[#0B4045] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{n}</button>
                ))}
              </div>
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Vị trí thửa đất so với đường</p>
              <div className="mt-2 grid gap-2">
                {(Object.keys(TEN_VI_TRI_PH) as ViTriPH[]).map((k) => {
                  const g = phLoai === 'lua' ? (k.endsWith('tiep') ? GIA_LUA_2VU.tiepGiap : GIA_LUA_2VU.khongTiepGiap) : GIA_PHUC_HOP[k][phLoai];
                  return (
                    <button key={k} onClick={() => setPhVt(k)}
                      className={`cl-press rounded-lg border px-3 py-2 text-left text-[13.5px] ${phVt === k ? 'border-[#0B4045] bg-[#0B4045]/[0.04] font-semibold text-[#0B4045]' : 'border-slate-200 text-slate-600'}`}>
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
                <p className="text-[14px] text-slate-600">Giá đền bù 1 m²: <b className="text-[#0B4045]">{tien(giaM2)}</b></p>
                <p className="mt-1 text-[15px] text-slate-600">Tiền bồi thường về đất:
                  <b className="ml-1.5 text-[18px] text-[#0B4045]">{dienTich > 0 ? tien(tienDat) : '—'}</b></p>
                {dienTich > 0 && <p className="mt-0.5 text-[12px] text-slate-500">{tien(giaM2)} × {dienTich.toLocaleString('vi-VN')} m²</p>}
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {duAn === 'camlam'
              ? <a href={TL + 'TB-306-gia-dat-boi-thuong-Cam-Lam-07-5-2026.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0B4045] hover:bg-slate-200">📄 {DEN_BU_NGUON.vanBan}</a>
              : DU_AN_PHUC_HOP.map((d) => (
                <a key={d.ma} href={TL + d.tep} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0B4045] hover:bg-slate-200">📄 {d.ten.replace('Khu đô thị phức hợp ', 'QĐ ' + d.ma + ' — ')}</a>
              ))}
          </div>

          {duAn === 'camlam' && (
            <details className="group mt-3 overflow-hidden rounded-xl border border-slate-200">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[13.5px] font-bold text-[#0B4045] hover:bg-slate-50">
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
                        {r.slice(1).map((v, i) => <td key={i} className="px-2 py-1.5 text-right tabular-nums text-[#0B4045]">{v == null ? '—' : (v as number).toLocaleString('vi-VN')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 font-bold text-[#0B4045]">Đất rừng sản xuất</p>
                <table className="w-full min-w-[320px] text-[12.5px]"><tbody>
                  {GIA_RUNG_SAN_XUAT.map((r) => (
                    <tr key={r[0]} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 text-slate-700">{r[0]}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[#0B4045]">{r[1].toLocaleString('vi-VN')}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums text-[#0B4045]">{r[2].toLocaleString('vi-VN')}</td>
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
            Đơn giá bồi thường nhà, nhà ở, công trình xây dựng theo <b>Quyết định 08/2026/QĐ-UBND</b> ngày 20/01/2026 của UBND tỉnh Khánh Hòa. Gõ tên hạng mục (nhà 1 tầng, tường rào, giếng, chuồng trại…) rồi bấm để cộng vào bảng tính.
          </p>
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm: tường rào, mái tôn, giếng, sân bê tông…" className={`${O} mt-2.5`} />
          <div className="mt-2 max-h-[46vh] overflow-y-auto overscroll-contain rounded-xl border border-slate-100">
            {mucs.length === 0 && <p className="p-3 text-[13px] text-slate-400">Đang tải bảng đơn giá…</p>}
            {loc(mucs, tim).map(theMuc)}
            {mucs.length > 0 && loc(mucs, tim).length === 0 && <p className="p-3 text-[13px] text-slate-400">Không tìm thấy hạng mục nào.</p>}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-slate-500">Bấm một hạng mục là cộng vào bảng tính. Bản gốc: <a href={TL + 'QD-08-2026-don-gia-boi-thuong-nha-cong-trinh.pdf'} target="_blank" rel="noreferrer" className="font-semibold text-[#0B4045] underline">QĐ 08/2026 (PDF)</a>. Nhà, công trình xây theo giấy phép có thời hạn mà giấy phép đã hết hạn thì <b>chỉ được hỗ trợ 20%</b> mức trên (Điều 3 QĐ 08/2026).</p>

          {dongs.length > 0 && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13px] font-bold text-[#0B4045]">Hạng mục đã chọn</p>
              {dongs.map((d, i) => (
                <div key={i} className="mt-2 flex items-start gap-2 border-t border-slate-200 pt-2 first:border-t-0 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-snug text-slate-600">{d.ten.slice(0, 110)}</p>
                    <p className="text-[12px] text-slate-400">{tien(d.gia)} / {d.dv}</p>
                  </div>
                  <input value={String(d.sl)} onChange={(e) => setDongs((a) => a.map((x, j) => (j === i ? { ...x, sl: so(e.target.value) } : x)))}
                    inputMode="decimal" className="w-20 shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-[16px]" />
                  <button onClick={() => setDongs((a) => a.filter((_, j) => j !== i))} aria-label="Bỏ" className="shrink-0 px-1 text-slate-400">✕</button>
                </div>
              ))}
              <p className="mt-2 border-t border-slate-200 pt-2 text-[14px] text-slate-600">Cộng nhà &amp; công trình: <b className="text-[#0B4045]">{tien(tienNha)}</b></p>
            </div>
          )}
        </div>
      )}

      {/* ───────────────── ③ CHI PHÍ KHÁC ───────────────── */}
      {tab === 'khac' && (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold text-[#0B4045]">Hỗ trợ cho người có đất bị thu hồi</p>
            <p className="mt-1 text-[12.5px] leading-snug text-slate-500">Mức cụ thể do UBND tỉnh quy định và ghi trong phương án bồi thường của dự án — điền vào đây để cộng vào tổng.</p>

            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0B4045]">Hỗ trợ đào tạo, chuyển đổi nghề &amp; tìm kiếm việc làm</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">= <b>giá đất nông nghiệp trong BẢNG GIÁ ĐẤT của nhà nước</b> (không phải giá bồi thường) × diện tích <b>trong hạn mức</b> × số lần.
                Khánh Hòa đang áp dụng <b>03 lần</b> — nguyên văn Điều 13: “<i>bằng 03 lần giá đất nông nghiệp cùng loại trong Bảng giá đất hiện hành… đối với toàn bộ diện tích đất nông nghiệp thu hồi nhưng không vượt quá hạn mức giao đất nông nghiệp</i>”
                (khoản 10 Điều 2 <b>QĐ 14/2025/QĐ-UBND</b> sửa Điều 13 QĐ 17/2024). Con số 5 lần chỉ là <b>mức trần</b> Trung ương cho phép (khoản 3 Điều 22 NĐ 88/2024), <b>không phải mức tỉnh chi trả</b>.</p>
              <label className="mt-2 flex items-start gap-2 text-[12.5px] leading-snug text-slate-600">
                <input type="checkbox" checked={truSxNn} onChange={(e) => setTruSxNn(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>Hộ gia đình, cá nhân <b>trực tiếp sản xuất nông nghiệp</b> (điều kiện bắt buộc — khoản 1 Điều 109 Luật Đất đai 2024). Bỏ tick thì khoản này bằng 0.</span>
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-slate-600">Số lần:</span>
                {[String(SO_LAN_KHANH_HOA), String(SO_LAN_TRAN)].map((k) => (
                  <button key={k} onClick={() => setHeSoNghe(k)}
                    className={`cl-press rounded-full px-3 py-1.5 text-[13px] font-bold ${heSoNghe === k ? 'bg-[#0B4045] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
                    × {k} lần{k === String(SO_LAN_KHANH_HOA) ? ' — Khánh Hòa đang áp dụng' : ' — trần của Nghị định'}
                  </button>
                ))}
              </div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[12px] leading-snug text-slate-500">
                  {dungBangGiaMoi ? (<>Lấy theo <b>BẢNG GIÁ ĐẤT của tỉnh</b> — Nghị quyết 15/2025/NQ-HĐND (KHÔNG phải giá bồi thường): <b className="text-[#0B4045]">{BANG_GIA_NN[loaiBG].ten}</b></>)
                    : (<>Phương án duyệt <b>trước 01/01/2026</b> → lấy <b>bảng giá đất cũ</b> (QĐ 04/2020, sửa bởi QĐ 23/2025). Web chưa có bảng này, hãy điền giá ghi trong phương án: <b className="text-[#0B4045]">{BANG_GIA_NN[loaiBG].ten}</b></>)}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {duAn !== 'camlam' && dungBangGiaMoi && (
                    <select value={vtBG} onChange={(e) => setVtBG(Number(e.target.value) as 1 | 2)}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-[14px] outline-none focus:border-[#0B4045]">
                      <option value={1}>Vị trí 1</option><option value={2}>Vị trí 2</option>
                    </select>
                  )}
                  <input value={giaNNTay} onChange={(e) => setGiaNNTay(e.target.value)} inputMode="decimal"
                    placeholder={giaTuBangGia ? giaTuBangGia.toLocaleString('vi-VN') : 'nhập giá theo bảng giá cũ'}
                    className="w-32 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-[16px] outline-none focus:border-[#0B4045]" />
                  <span className="text-[12.5px] text-slate-500">đ/m² {so(giaNNTay) > 0 ? '(bạn tự nhập)' : dungBangGiaMoi ? `(bảng giá mới, vị trí ${duAn === 'camlam' ? viTri : vtBG})` : '(chưa có — cần điền)'}</span>
                </div>
                <p className={`mt-1 text-[11.5px] leading-snug text-slate-400 ${dungBangGiaMoi ? '' : 'hidden'}`}>
                  Bảng giá 4 xã vùng Cam Lâm: cây hằng năm / lâu năm {BANG_GIA_NN.cay.vt1.toLocaleString('vi-VN')} (VT1) · {BANG_GIA_NN.cay.vt2.toLocaleString('vi-VN')} (VT2) — thuỷ sản {BANG_GIA_NN.thuysan.vt1.toLocaleString('vi-VN')} · {BANG_GIA_NN.thuysan.vt2.toLocaleString('vi-VN')} — rừng sản xuất {BANG_GIA_NN.rung.vt1.toLocaleString('vi-VN')} · {BANG_GIA_NN.rung.vt2.toLocaleString('vi-VN')} đ/m².
                </p>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-[12.5px] text-slate-600">Số lần
                  <input value={heSoNghe} onChange={(e) => setHeSoNghe(e.target.value)} inputMode="decimal" placeholder="VD: 3" className={`${O} mt-1`} /></label>
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
              {!truSxNn && <p className="mt-1.5 text-[12px] text-slate-500">Không phải hộ trực tiếp sản xuất nông nghiệp → khoản này bằng 0.</p>}
              {tienNghe > 0 && (
                <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0B4045]">{tien(tienNghe)}</b>
                  <span className="ml-1 text-[12px] text-slate-400">({tien(giaNN)} × {dtTinhNghe.toLocaleString('vi-VN')} m² × {heSo})</span></p>
              )}
            </div>

            {/* ── Hỗ trợ ổn định đời sống — Điều 19 Nghị định 88/2024/NĐ-CP ── */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0B4045]">Hỗ trợ ổn định đời sống</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                Mỗi nhân khẩu, mỗi tháng được số tiền bằng <b>30 kg gạo</b> theo <b>giá trung bình tại thị trường địa phương</b> ở thời điểm hỗ trợ
                (Điều 19 Nghị định 88/2024/NĐ-CP). Số tháng tuỳ theo thu hồi bao nhiêu phần đất nông nghiệp đang dùng và có phải dời nhà không.
                <b> Giá gạo phải lấy đúng con số ghi trong phương án bồi thường của dự án</b> — web không tự đặt giá.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-[12.5px] text-slate-600">Số nhân khẩu trong hộ
                  <input value={soKhau} onChange={(e) => setSoKhau(e.target.value)} inputMode="decimal" placeholder="VD: 4" className={`${O} mt-1`} /></label>
                <label className="text-[12.5px] text-slate-600">Giá 1 kg gạo (đồng)
                  <input value={giaGao} onChange={(e) => setGiaGao(e.target.value)} inputMode="decimal" placeholder="theo phương án của dự án" className={`${O} mt-1`} /></label>
                <label className="text-[12.5px] text-slate-600 sm:col-span-2">Phần đất nông nghiệp đang dùng bị thu hồi
                  <select value={tyThuHoi} onChange={(e) => setTyThuHoi(e.target.value as any)} className={`${O} mt-1`}>
                    <option value="duoi30">Dưới 30% — không có mức cứng, do UBND tỉnh quyết theo từng dự án</option>
                    <option value="30-70">Từ 30% đến 70%</option>
                    <option value="tren70">Trên 70%</option>
                  </select></label>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                  <input type="checkbox" checked={phaiDoiNha} onChange={(e) => setPhaiDoiNha(e.target.checked)} className="h-4 w-4" /> Phải di chuyển chỗ ở</label>
                <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                  <input type="checkbox" checked={vungKhoKhan} onChange={(e) => setVungKhoKhan(e.target.checked)} className="h-4 w-4" /> Chuyển đến vùng kinh tế - xã hội khó khăn</label>
              </div>
              {thangOnDinh > 0
                ? <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0B4045]">{tien(tienOnDinh)}</b>
                    <span className="ml-1 text-[12px] text-slate-400">({so(soKhau) || 0} khẩu × {GAO_KG_THANG} kg × {tien(so(giaGao))} × {thangOnDinh} tháng)</span></p>
                : <p className="mt-1.5 text-[12px] text-slate-500">Thu hồi dưới 30% thì Nghị định không ấn định số tháng — lấy theo phương án bồi thường của dự án rồi điền vào ô “Khoản khác”.</p>}
            </div>

            {/* ── Bồi thường chi phí di chuyển tài sản — khoản 1 Điều 8 (QĐ 14/2025) ── */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0B4045]">Bồi thường chi phí di chuyển tài sản (khi phải dời chỗ ở)</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">Khoản 1 Điều 8 Quy định kèm QĐ 17/2024, được thay bằng <b>khoản 6 Điều 2 QĐ 14/2025/QĐ-UBND</b>.</p>
              <select value={maDiChuyen} onChange={(e) => setMaDiChuyen(e.target.value)} className={`${O} mt-2`}>
                <option value="">Không phải di chuyển chỗ ở</option>
                {DI_CHUYEN.map((d) => <option key={d.ma} value={d.ma}>{d.ten} — {d.tien.toLocaleString('vi-VN')} đ/hộ</option>)}
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
                <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0B4045]">{tien(tienDiChuyen)}</b>
                  <span className="ml-1 text-[12px] text-slate-400">({mucDiChuyen!.tien.toLocaleString('vi-VN')} đ{tangThem > 0 ? ` + ${tangThem} tầng × 20%` : ''}{tuLoChoO ? ' × 2 vì tự lo chỗ ở' : ''})</span></p>
              )}
            </div>

            {/* ── Hỗ trợ ổn định sản xuất, kinh doanh — Điều 11 QĐ 17/2024 ── */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0B4045]">Hỗ trợ ổn định sản xuất, kinh doanh</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                Dành cho <b>tổ chức kinh tế, hộ/cá nhân sản xuất kinh doanh, doanh nghiệp có vốn nước ngoài</b>:
                hỗ trợ bằng tiền <b>30% một năm thu nhập sau thuế</b>, lấy theo thu nhập bình quân <b>03 năm liền kề trước đó</b>
                (khoản 2 Điều 11 Quy định kèm QĐ 17/2024/QĐ-UBND).
                Hộ nhận bồi thường bằng <b>đất nông nghiệp</b> thì được hỗ trợ bằng <b>hiện vật</b> — giống cây trồng, giống vật nuôi, khuyến nông, thú y — không quy ra tiền ở đây (khoản 1).
                Người lao động bị mất việc được trợ cấp ngừng việc <b>tối đa 06 tháng</b> (khoản 3).
              </p>
              <label className="mt-2 block text-[12.5px] text-slate-600">Thu nhập sau thuế bình quân 1 năm (đồng)
                <input value={thuNhapNam} onChange={(e) => setThuNhapNam(e.target.value)} inputMode="decimal" placeholder="lấy bình quân 3 năm gần nhất" className={`${O} mt-1`} /></label>
              {tienSxkd > 0 && <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0B4045]">{tien(tienSxkd)}</b> <span className="text-[12px] text-slate-400">(30% × {tien(so(thuNhapNam))})</span></p>}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {([['Bồi thường cây trồng, vật nuôi (QĐ 35/2026)', cayTrong, setCayTrong],
                 ['Thưởng bàn giao mặt bằng trước hạn (5.000.000 đ — Điều 14, QĐ 14/2025)', thuong, setThuong],
                 ['Khoản khác trong phương án bồi thường', khac, setKhac]] as [string, string, (v: string) => void][]).map(([nhan, v, set]) => (
                <label key={nhan} className="text-[12.5px] text-slate-600">{nhan} (đồng)
                  <input value={v} onChange={(e) => set(e.target.value)} inputMode="decimal" placeholder="0" className={`${O} mt-1`} /></label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold text-[#0B4045]">Đơn giá một số chi phí — Quyết định 12/2026/QĐ-UBND</p>
            <p className="mt-1 text-[12.5px] leading-snug text-slate-600">Ngày 24/02/2026 của UBND tỉnh Khánh Hòa, gồm 4 phụ lục:</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-slate-600">
              <li>Phụ lục I — Đơn giá tự xây dựng, cải tạo, sửa chữa, nâng cấp công trình.</li>
              <li>Phụ lục II — Đơn giá bồi thường, hỗ trợ khi phải <b>di dời mồ mả</b>.</li>
              <li>Phụ lục III — Đơn giá <b>tháo dỡ, di chuyển, lắp đặt tài sản</b>.</li>
              <li>Phụ lục IV — Đơn giá bồi thường <b>chi phí đầu tư vào đất còn lại</b>.</li>
            </ul>
            <input value={timCp} onChange={(e) => setTimCp(e.target.value)} placeholder="Tìm: mộ xây, di chuyển máy lạnh, ao hồ, san lấp…" className={`${O} mt-2.5`} />
            <div className="mt-2 max-h-[44vh] overflow-y-auto overscroll-contain rounded-xl border border-slate-100">
              {chiPhi.length === 0 && <p className="p-3 text-[13px] text-slate-400">Đang tải bảng đơn giá…</p>}
              {loc(chiPhi, timCp).map(theMuc)}
              {chiPhi.length > 0 && loc(chiPhi, timCp).length === 0 && <p className="p-3 text-[13px] text-slate-400">Không tìm thấy hạng mục nào.</p>}
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-slate-500">Số lấy từ bản Word đăng trên Công báo tỉnh Khánh Hòa (không phải bản scan), bấm để cộng vào bảng tính.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={TL + 'QD-12-2026-don-gia-boi-thuong-ho-tro-chi-phi.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-[#0B4045] px-3 py-1.5 text-[12.5px] font-bold text-white">📄 QĐ 12/2026 (PDF)</a>
              <a href={TL + '2093-SXD-huong-dan-ap-dung-QD08-QD12.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0B4045] hover:bg-slate-200">📑 Hướng dẫn áp dụng của Sở Xây dựng</a>
              <a href={TL + 'QD-17-2024-quy-dinh-boi-thuong-ho-tro-tai-dinh-cu.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0B4045] hover:bg-slate-200">📑 QĐ 17/2024 — quy định gốc của tỉnh</a>
              <a href={TL + 'QD-14-2025-sua-doi-boi-thuong-ho-tro-tai-dinh-cu.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0B4045] hover:bg-slate-200">📑 QĐ 14/2025 — bản sửa đang áp dụng</a>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────── ④ CĂN CỨ ───────────────── */}
      {tab === 'cancu' && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-bold text-[#0B4045]">Người bị thu hồi đất nông nghiệp được nhận những khoản gì?</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-slate-600">
            <li><b>Tiền bồi thường về đất</b> = diện tích thu hồi × giá đất cụ thể được phê duyệt cho dự án.</li>
            <li><b>Bồi thường nhà, công trình xây dựng</b> gắn liền với đất — đơn giá tại QĐ 08/2026/QĐ-UBND.</li>
            <li><b>Bồi thường cây trồng, vật nuôi</b> bị thiệt hại — Điều 103 Luật Đất đai 2024.</li>
            <li><b>Bồi thường chi phí đầu tư vào đất còn lại</b> — Điều 104 Luật Đất đai 2024, đơn giá tại QĐ 12/2026.</li>
            <li><b>Hỗ trợ ổn định đời sống và sản xuất</b> — Điều 108 Luật Đất đai 2024.</li>
            <li><b>Hỗ trợ đào tạo, chuyển đổi nghề và tìm kiếm việc làm</b> — Điều 109 Luật Đất đai 2024 &amp; khoản 3 Điều 22 Nghị định 88/2024/NĐ-CP: hỗ trợ bằng tiền <b>không quá 5 lần</b> giá đất nông nghiệp cùng loại trong bảng giá đất, tính cho toàn bộ diện tích thu hồi nhưng <b>không vượt hạn mức giao đất nông nghiệp</b> (Điều 176 Luật Đất đai 2024); mức cụ thể do UBND tỉnh quy định. <b>Khánh Hòa quy định 03 lần</b> — Điều 13 Quy định kèm QĐ 17/2024/QĐ-UBND, được thay bằng khoản 10 Điều 2 QĐ 14/2025/QĐ-UBND.</li>
              <li><b>Hỗ trợ ổn định đời sống</b> — Điều 108 Luật Đất đai 2024 &amp; Điều 19 Nghị định 88/2024/NĐ-CP: mỗi nhân khẩu mỗi tháng được số tiền bằng <b>30 kg gạo</b> theo giá trung bình tại thị trường địa phương. Thu hồi 30–70% đất nông nghiệp đang dùng: 6 tháng (không dời nhà) / 12 tháng (dời nhà) / tối đa 24 tháng nếu dời đến vùng khó khăn. Thu hồi trên 70%: 12 / 24 / tối đa 36 tháng.</li>
              <li><b>Bồi thường chi phí di chuyển tài sản</b> — khoản 1 Điều 8 Quy định kèm QĐ 17/2024, thay bằng khoản 6 Điều 2 QĐ 14/2025/QĐ-UBND: <b>10.000.000 đ/hộ</b> nếu chuyển trong cùng xã, <b>12.000.000 đ/hộ</b> nếu ra ngoài xã, <b>5.000.000 đ/hộ</b> nếu chỉ thu hồi một phần đất ở mà phần còn lại vẫn xây nhà được; nhà nhiều tầng cộng thêm <b>20%</b> cho mỗi tầng từ tầng thứ 3 trở lên.</li>
              <li><b>Hỗ trợ ổn định sản xuất, kinh doanh</b> — Điều 20 Nghị định 88/2024/NĐ-CP &amp; Điều 11 Quy định kèm QĐ 17/2024/QĐ-UBND: tổ chức kinh tế, hộ/cá nhân sản xuất kinh doanh được <b>30% một năm thu nhập sau thuế</b> (bình quân 03 năm liền kề); hộ nhận bồi thường bằng đất nông nghiệp được hỗ trợ giống cây trồng, giống vật nuôi, khuyến nông, thú y; người lao động được trợ cấp ngừng việc tối đa <b>06 tháng</b>.</li>
              <li><b>Hỗ trợ tái định cư khi tự lo chỗ ở</b> — khoản 2 Điều 12 Quy định kèm QĐ 17/2024/QĐ-UBND: ngoài bồi thường còn được thêm một khoản <b>bằng đúng chi phí di chuyển tài sản</b>.</li>
              <li><b>Thưởng bàn giao mặt bằng trước thời hạn</b> — <b>5.000.000 đồng</b> (điểm c khoản 1 Điều 14 Quy định kèm QĐ 17/2024, sửa bởi khoản 11 Điều 2 QĐ 14/2025/QĐ-UBND).</li>
            <li><b>Chi phí di dời mồ mả, tháo dỡ – di chuyển tài sản</b> — đơn giá tại QĐ 12/2026.</li>
            <li><b>Thưởng bàn giao mặt bằng đúng hạn</b> và hỗ trợ khác theo quy định của tỉnh.</li>
          </ol>
          <p className="mt-2.5 text-[12.5px] leading-snug text-slate-500">
            Quy định chung của tỉnh Khánh Hòa: <b>Quyết định 17/2024/QĐ-UBND</b> ngày 29/8/2024, sửa đổi bởi <b>Quyết định 14/2025/QĐ-UBND</b>.
          </p>
          <p className="mt-3 text-[13px] font-bold text-[#0B4045]">Văn bản gốc (bấm để xem)</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[['TB-306-gia-dat-boi-thuong-Cam-Lam-07-5-2026.pdf', 'TB 306/TB-HĐTĐ — giá đất KĐT mới Cam Lâm'],
              ['QD-2952-gia-dat-boi-thuong-KDT-Suoi-Tan.pdf', 'QĐ 2952 — KĐT phức hợp Suối Tân'],
              ['QD-2953-gia-dat-boi-thuong-KDT-Cam-Thuong.pdf', 'QĐ 2953 — KĐT phức hợp Cam Thượng'],
              ['QD-2954-gia-dat-boi-thuong-KDT-Cam-Tan.pdf', 'QĐ 2954 — KĐT phức hợp Cam Tân'],
              ['QD-2955-gia-dat-boi-thuong-KDT-Cam-Hoa.pdf', 'QĐ 2955 — KĐT phức hợp Cam Hòa'],
              ['QD-08-2026-don-gia-boi-thuong-nha-cong-trinh.pdf', 'QĐ 08/2026 — đơn giá nhà, công trình'],
              ['QD-12-2026-don-gia-boi-thuong-ho-tro-chi-phi.pdf', 'QĐ 12/2026 — đơn giá một số chi phí'],
              ['2093-SXD-huong-dan-ap-dung-QD08-QD12.pdf', 'CV 2093/SXD — hướng dẫn áp dụng QĐ 08 & 12']].map(([f, n]) => (
              <a key={f} href={TL + f} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0B4045] hover:bg-slate-200">📄 {n}</a>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/bang-gia-dat" className="rounded-lg bg-slate-100 px-3.5 py-2 text-[13px] font-semibold text-[#0B4045] hover:bg-slate-200">📊 Bảng giá đất 2026</Link>
            <Link href="/van-ban" className="rounded-lg bg-slate-100 px-3.5 py-2 text-[13px] font-semibold text-[#0B4045] hover:bg-slate-200">📑 Tra cứu văn bản</Link>
            <Link href="/map" className="rounded-lg bg-slate-100 px-3.5 py-2 text-[13px] font-semibold text-[#0B4045] hover:bg-slate-200">🗺️ Bản đồ quy hoạch</Link>
          </div>
        </div>
      )}

      {/* ───────────────── TỔNG — THANH DÍNH ĐÁY, TAB NÀO CŨNG THẤY ─────────────────
          Chủ dự án 16/9/2026: tách tab cho rõ nhưng đừng để phải cuộn tìm tổng tiền.
          16/9/2026 chốt: KHÔNG dính đáy che nội dung — để nằm hẳn cuối trang, bấm để mở/thu chi tiết. */}
      <div className="mt-4">
        <button onClick={() => setMoTong((v) => !v)} className="w-full rounded-2xl bg-[#0B4045] p-3.5 text-left text-white shadow-[0_8px_30px_rgba(11,64,69,.35)]">
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
              {tienNha > 0 && <p>· Nhà &amp; công trình: {tien(tienNha)}</p>}
              {tienNghe > 0 && <p>· Hỗ trợ chuyển đổi nghề: {tien(tienNghe)}</p>}
              {tienOnDinh > 0 && <p>· Hỗ trợ ổn định đời sống: {tien(tienOnDinh)}</p>}
              {tienDiChuyen > 0 && <p>· Di chuyển tài sản{tuLoChoO ? ' + tự lo chỗ ở' : ''}: {tien(tienDiChuyen)}</p>}
              {tienSxkd > 0 && <p>· Ổn định sản xuất, kinh doanh: {tien(tienSxkd)}</p>}
              {so(cayTrong) > 0 && <p>· Cây trồng, vật nuôi: {tien(so(cayTrong))}</p>}
              {so(thuong) > 0 && <p>· Thưởng bàn giao: {tien(so(thuong))}</p>}
              {so(khac) > 0 && <p>· Khoản khác: {tien(so(khac))}</p>}
              {tong === 0 && <p>Chưa có số liệu — hãy nhập diện tích ở mục ① hoặc chọn hạng mục ở mục ② ③.</p>}
              <p className="pt-1 text-[11.5px] leading-snug text-white/60">Con số chỉ mang tính tham khảo. Số chính thức là số ghi trong phương án bồi thường, hỗ trợ, tái định cư được cơ quan có thẩm quyền phê duyệt.</p>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
