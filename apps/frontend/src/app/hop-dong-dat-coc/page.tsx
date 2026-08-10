'use client';
import { useState, CSSProperties } from 'react';
import Link from 'next/link';
import LegalConsultCTA from '@/components/LegalConsultCTA';
import ServicesSection from '@/components/ServicesSection';

const inp = 'w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm outline-none focus:border-[#0A2540]';
const lbl = 'block text-[12px] font-semibold text-slate-500 mb-1';
const HOTLINE = '0988 888 888';
const today = new Date().toISOString().slice(0, 10);

const DEFAULT5 = `Việc xử lý tiền đặt cọc thực hiện theo Điều 328 Bộ luật Dân sự 2015:
- Nếu hai bên ký kết và thực hiện Hợp đồng chuyển nhượng: tiền đặt cọc được trừ vào giá chuyển nhượng.
- Nếu Bên B (bên đặt cọc) từ chối giao kết/thực hiện: Bên B mất số tiền đặt cọc.
- Nếu Bên A (bên nhận đặt cọc) từ chối giao kết/thực hiện: Bên A phải trả lại tiền đặt cọc và bồi thường cho Bên B một khoản tiền tương đương giá trị tiền đặt cọc (phạt cọc), trừ trường hợp hai bên có thỏa thuận khác.`;

const DEFAULT6 = `1. Bên A cam đoan là người có quyền sử dụng đất hợp pháp; thửa đất đã có Giấy chứng nhận, không tranh chấp, không bị kê biên để bảo đảm thi hành án, không thế chấp/bảo lãnh, không thuộc quy hoạch thu hồi – giải tỏa; chưa nhận đặt cọc hoặc hứa bán cho bất kỳ ai khác. Bên A chịu trách nhiệm về tính pháp lý của bất động sản.
2. Bên B cam đoan đã tìm hiểu kỹ hiện trạng, pháp lý thửa đất và tự nguyện nhận chuyển nhượng.
3. Hai bên tự nguyện giao kết, không bị lừa dối hay ép buộc; cung cấp thông tin, giấy tờ trung thực và cùng thực hiện đúng cam kết.`;

const dmy = (iso: string) => { if (!iso) return ''; const p = iso.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso; }; // iso→dd/mm/yyyy (đã là dd/mm/yyyy thì giữ nguyên)
const dmyToIso = (s: string) => { const p = (s || '').split('/'); return (p.length === 3 && p[0].length === 2 && p[1].length === 2 && p[2].length === 4) ? `${p[2]}-${p[1]}-${p[0]}` : ''; };
const fmtDate = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 8); if (d.length <= 2) return d; if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`; return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`; };

export default function HopDongDatCoc() {
  const [f, setF] = useState<Record<string, string>>({
    ngayLap: dmy(today), noiLap: 'Cam Lâm, Khánh Hòa',
    aTen: '', aSinh: '', aCccd: '', aCccdNgay: '', aCccdNoi: '', aDiaChi: '', aSdt: '',
    a2Ten: '', a2Sinh: '', a2Cccd: '', a2CccdNgay: '', a2CccdNoi: '', a2Sdt: '',
    a3Ten: '', a3Sinh: '', a3Cccd: '', a3CccdNgay: '', a3CccdNoi: '', a3Sdt: '',
    a4Ten: '', a4Sinh: '', a4Cccd: '', a4CccdNgay: '', a4CccdNoi: '', a4Sdt: '',
    a5Ten: '', a5Sinh: '', a5Cccd: '', a5CccdNgay: '', a5CccdNoi: '', a5Sdt: '',
    bTen: '', bSinh: '', bCccd: '', bCccdNgay: '', bCccdNoi: '', bDiaChi: '', bSdt: '',
    cTen: '', cCccd: '', cSdt: '', cHhThanhCong: '', cHhHuyCoc: '', cHhBenTra: 'Bên A',

    bdsDiaChi: '', thuaSo: '', toBanDo: '', dienTich: '', gcn: '', gcnCap: 'Sở Tài nguyên và Môi trường tỉnh Khánh Hòa', gcnNgay: '', mucDich: 'Đất ở', thoiHan: 'Lâu dài',
    gia: '', coc: '', hanNgay: '30', thueBenBan: 'Thuế thu nhập cá nhân do Bên A chịu', phiBenMua: 'Lệ phí trước bạ, phí công chứng do Bên B chịu (nếu không có thỏa thuận khác)',
    dieu5: DEFAULT5, dieu6: DEFAULT6,
    salesName: '', salesTitle: 'Chuyên viên Tư vấn Bất động sản', salesPhone: '', salesSlogan: 'Tận tâm • Uy tín • Tài lộc', soTo: '1',
  });
  const s = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));
  const [editDieu, setEditDieu] = useState(false);
  const [hasBenC, setHasBenC] = useState(true); // MẶC ĐỊNH có Bên C (bên làm chứng – môi giới); bỏ tick để không có
  const [nCo, setNCo] = useState(0); // Số người ĐỒNG SỞ HỮU thêm cùng đứng tên Bên A (0..4) — mỗi người 1 dòng, đủ chữ ký (Điều 35 Luật HN&GĐ)
  const [inBia, setInBia] = useState(false); // In cả cuốn → kèm bìa trước & sau mang thương hiệu cá nhân của sales
  const [ttImg, setTtImg] = useState(true); // Ưu tiên ảnh Thần Tài thật (/than-tai.png); nếu chưa có file thì tự vẽ vector thay thế
  const [ttImg2, setTtImg2] = useState(true); // Ảnh Thần Tài MẶT SAU (/than-tai-sau.png); chưa có file thì dùng mề đay tài lộc
  // Hiển thị dễ đọc trong ô nhập: tiền có dấu chấm, CCCD cách mỗi 3 số, SĐT nhóm 4-3-3.
  // State LUÔN lưu SỐ THÔ → khi in hợp đồng CCCD/SĐT in liền (không cách), tiền in có dấu chấm.
  const fmtView = (k: string, o: any) => {
    const raw = f[k] || '';
    if (o.money) return raw ? Number(raw).toLocaleString('vi-VN') : '';
    if (o.cccd) return raw.replace(/(\d{3})(?=\d)/g, '$1 ');
    if (o.phone) return raw.replace(/(\d{4})(\d{3})(\d+)/, '$1 $2 $3');
    return raw;
  };
  // Diện tích: dấu '.' = hàng nghìn, dấu ',' = thập phân (tối đa 2 số) — 2 ký hiệu khác nhau, không nhầm.
  const fmtArea = (raw: string) => {
    if (!raw) return '';
    const [int, dec] = raw.split(',');
    const intFmt = int ? Number(int).toLocaleString('vi-VN') : '0';
    return raw.includes(',') ? `${intFmt},${dec ?? ''}` : intFmt;
  };
  // Tự kiểm tra nhẹ, KHÔNG chặn in. Chỉ ✓ ở CMND/CCCD & SĐT; các ô khác im lặng khi đúng, chỉ nhắc khi có vấn đề.
  const check = (k: string): { ok: boolean; msg: string } | null => {
    const v = (f[k] || '').trim(); if (!v) return null;
    if (k === 'aCccd' || k === 'bCccd') {
      if (v.length !== 9 && v.length !== 12) return { ok: false, msg: `cần 9 số (CMND) hoặc 12 số (CCCD) — đang ${v.length}` };
      if (k === 'bCccd' && f.aCccd && f.aCccd === v) return { ok: false, msg: 'đang trùng số giấy tờ với Bên A' };
      return { ok: true, msg: '' };
    }
    if (k === 'aSdt' || k === 'bSdt') return { ok: /^0\d{9}$/.test(v), msg: `số điện thoại thường 10 số, bắt đầu bằng 0 — đang ${v.length}` };
    if (k === 'dienTich') return Number(v.replace(',', '.')) > 0 ? null : { ok: false, msg: 'diện tích phải lớn hơn 0' };
    if (k === 'gia') return Number(v) > 0 ? null : { ok: false, msg: 'giá phải lớn hơn 0' };
    if (k === 'coc') { const c = Number(f.coc), g = Number(f.gia); return g > 0 && c > g ? { ok: false, msg: 'tiền cọc đang lớn hơn giá' } : null; }
    if (k === 'aSinh' || k === 'bSinh' || k === 'aCccdNgay' || k === 'bCccdNgay' || k === 'gcnNgay' || k === 'ngayLap') { const iso = dmyToIso(v); return (!iso || iso <= today) ? null : { ok: false, msg: 'ngày không nên ở tương lai' }; }
    return null;
  };
  // GỌI NHƯ HÀM → giữ focus khi gõ. Hỗ trợ type=date, gợi ý, định dạng tiền/CCCD/SĐT + kiểm tra nhẹ.
  const field = (k: string, label: string, o: any = {}) => {
    const digit = o.num || o.money || o.cccd || o.phone;
    const c = check(k); const showOk = k === 'aCccd' || k === 'bCccd' || k === 'aSdt' || k === 'bSdt';
    let input;
    if (o.type === 'date') input = (
      // Ô ngày: NHẬP TAY dd/mm/yyyy (tự chèn /) + XÓA tay tự do; icon lịch để chọn từ calendar. Nền TRẮNG đồng bộ, không xám.
      <div className="relative">
        <input type="text" inputMode="numeric" value={f[k]} onChange={(e) => s(k, fmtDate(e.target.value))} placeholder="dd/mm/yyyy" spellCheck={false} autoComplete="off" className={`${inp} pr-9`} />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center text-slate-400 pointer-events-none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg></span>
        <input type="date" value={dmyToIso(f[k])} onChange={(e) => s(k, dmy(e.target.value))} className="absolute right-0 top-0 h-full w-9 opacity-0 cursor-pointer" aria-label="Chọn ngày từ lịch" />
      </div>
    );
    else if (o.area) input = <input inputMode="decimal" value={fmtArea(f[k])} placeholder={o.ph} className={inp}
      onChange={(e) => { let v = e.target.value.replace(/[^\d,]/g, ''); const i = v.indexOf(','); if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, '').slice(0, 2); s(k, v); }} />;
    else if (o.pct) input = <input inputMode="decimal" value={(f[k] || '').trim() ? f[k] + '%' : ''} placeholder={o.ph} spellCheck={false} autoComplete="off"
      onChange={(e) => { let v = e.target.value.replace(/[^\d.,]/g, '').replace(/\./g, ','); const i = v.indexOf(','); if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, ''); s(k, v); }} className={inp} />;
    else input = <input type={o.type || 'text'} list={o.list} value={digit ? fmtView(k, o) : f[k]} onChange={(e) => s(k, digit ? e.target.value.replace(/[^\d]/g, '') : e.target.value)} inputMode={digit ? 'numeric' : undefined} placeholder={o.ph} spellCheck={false} autoComplete="off" className={inp} />;
    return (
      <label key={k} className={o.w || ''}><span className={lbl}>{label}</span>
        {input}
        {c && !c.ok && <span className="block mt-0.5 text-[11px] text-amber-600">⚠ {c.msg}</span>}
        {c && c.ok && showOk && <span className="block mt-0.5 text-[11px] text-emerald-500">✓ hợp lệ</span>}
      </label>
    );
  };
  const area = (k: string, label: string, rows = 5) => (
    <label className="block"><span className={lbl}>{label} <span className="text-[#C8A14B]">(sửa được — sẽ in đúng nội dung bạn nhập)</span></span>
      <textarea value={f[k]} onChange={(e) => s(k, e.target.value)} rows={rows} spellCheck={false} className={`${inp} resize-y leading-relaxed`} />
    </label>
  );
  const money = (str: string) => { const n = Number(String(str).replace(/\D/g, '')); return n ? n.toLocaleString('vi-VN') : '……………………'; };
  const or = (v: string, dots = 20) => (v && v.trim() ? v : '…'.repeat(dots));
  const d = (dmyToIso(f.ngayLap) || '').split('-'); // [yyyy, mm, dd] cho phần "ngày … tháng … năm …" khi in
  const pctAmt = (p: string, base: string) => { const pn = Number(String(p).replace(',', '.')) || 0; const bn = Number(String(base).replace(/\D/g, '')) || 0; return pn > 0 && bn > 0 ? Math.round(bn * pn / 100) : 0; };
  const showHoaHong = hasBenC; // Có Bên C (môi giới) là LUÔN in Điều khoản thù lao — cả 2 trường hợp; % để trống thì in chỗ trống để điền tay
  const nDieuTC = showHoaHong ? 9 : 8; // số Điều "Giải quyết tranh chấp" (dịch xuống nếu có điều thù lao)
  const sigH = nCo > 0 ? 60 + nCo * 24 : 64; // chiều cao chỗ ký — cao thêm khi có nhiều người đồng sở hữu cùng ký

  // ───────── BÌA CUỐN HỒ SƠ (in cả cuốn) — sang trọng · tài lộc; TÊN SALES là chính, logo Cam Lâm Land nhỏ ─────────
  const clHouse = (sz: number) => (<svg viewBox="0 0 44 44" width={sz} height={sz}><path d="M11 21.5 L22 12 L33 21.5" fill="none" stroke="#C8A14B" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14.2 20 V31.4 H29.8 V20" fill="none" stroke="#C8A14B" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="22" cy="25.6" r="2.4" fill="#C8A14B" /></svg>);
  // (Đã bỏ hoa văn góc — dùng khung vàng đôi tối giản, sang trọng hiện đại.)
  const clMedal = () => (
    <svg viewBox="0 0 150 150" width="116" height="116">
      <defs><linearGradient id="clGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f0d488" /><stop offset="0.55" stopColor="#C8A14B" /><stop offset="1" stopColor="#8f6f2b" /></linearGradient></defs>
      <circle cx="75" cy="75" r="67" fill="none" stroke="#C8A14B" strokeWidth="3" strokeDasharray="1.5 6" opacity="0.75" />
      <circle cx="75" cy="75" r="57" fill="none" stroke="#C8A14B" strokeWidth="2" />
      <circle cx="75" cy="75" r="52" fill="none" stroke="#b23b3b" strokeWidth="0.9" />
      <path d="M47 66 Q75 44 103 66 Q90 75 75 75 Q60 75 47 66 Z" fill="url(#clGold)" stroke="#8f6f2b" strokeWidth="1" />
      <ellipse cx="75" cy="64" rx="20" ry="5.5" fill="#f4dc93" stroke="#8f6f2b" strokeWidth="0.8" />
      {[58, 75, 92].map((cx, i) => (<g key={i}><circle cx={cx} cy="98" r="11" fill="url(#clGold)" stroke="#8f6f2b" strokeWidth="0.9" /><rect x={cx - 4} y="94" width="8" height="8" rx="1" fill="#ffffff" stroke="#8f6f2b" strokeWidth="0.6" /></g>))}
    </svg>
  );
  // THẦN TÀI ôm thỏi vàng — mũ có 2 cánh đồng tiền, áo đỏ, râu đen; vẽ vector nên in nét, sang trọng.
  const clThanTai = (w: number) => (
    <svg viewBox="0 0 220 244" width={w} height={Math.round(w * 244 / 220)}>
      <defs>
        <linearGradient id="ttG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a8" /><stop offset="0.5" stopColor="#e6bf62" /><stop offset="1" stopColor="#b28a2c" /></linearGradient>
        <radialGradient id="ttGr" cx="0.5" cy="0.4" r="0.65"><stop offset="0" stopColor="#fff3c9" /><stop offset="1" stopColor="#cfa54e" /></radialGradient>
        <radialGradient id="ttGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fbeec4" /><stop offset="1" stopColor="#fbeec4" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="110" cy="122" r="110" fill="url(#ttGlow)" />
      <circle cx="110" cy="122" r="104" fill="none" stroke="#C8A14B" strokeWidth="1.4" strokeDasharray="1.5 5" opacity="0.55" />
      {/* áo đỏ */}
      <path d="M110 116 C 74 116 58 146 48 214 C 44 232 176 232 172 214 C 162 146 146 116 110 116 Z" fill="#c62828" stroke="#7f1a1a" strokeWidth="1.4" />
      <path d="M50 214 C 46 231 174 231 170 214" fill="none" stroke="url(#ttG)" strokeWidth="7" strokeLinecap="round" />
      <path d="M110 150 L110 214" stroke="url(#ttG)" strokeWidth="5" />
      <path d="M92 118 L110 150 L128 118 Z" fill="url(#ttG)" stroke="#8f6f2b" strokeWidth="1" />
      <path d="M99 118 L110 138 L121 118 Z" fill="#c62828" />
      <circle cx="110" cy="184" r="16" fill="url(#ttGr)" stroke="#8f6f2b" strokeWidth="1.3" />
      <rect x="104" y="178" width="12" height="12" rx="2" fill="#c62828" opacity="0.85" />
      {/* tay áo */}
      <path d="M78 150 C 56 162 60 190 84 194 L 104 182 L 96 156 Z" fill="#c62828" stroke="#7f1a1a" strokeWidth="1.2" />
      <path d="M142 150 C 164 162 160 190 136 194 L 116 182 L 124 156 Z" fill="#c62828" stroke="#7f1a1a" strokeWidth="1.2" />
      {/* đầu */}
      <ellipse cx="110" cy="82" rx="39" ry="37" fill="#f7d6a2" stroke="#e0b483" strokeWidth="1" />
      <circle cx="72" cy="86" r="7" fill="#f7d6a2" stroke="#e0b483" strokeWidth="0.8" />
      <circle cx="148" cy="86" r="7" fill="#f7d6a2" stroke="#e0b483" strokeWidth="0.8" />
      <circle cx="88" cy="93" r="8" fill="#f19b93" opacity="0.55" />
      <circle cx="132" cy="93" r="8" fill="#f19b93" opacity="0.55" />
      <path d="M89 71 Q98 66 107 71" fill="none" stroke="#2a2018" strokeWidth="2" strokeLinecap="round" />
      <path d="M113 71 Q122 66 131 71" fill="none" stroke="#2a2018" strokeWidth="2" strokeLinecap="round" />
      <path d="M90 80 Q98 73 106 80" fill="none" stroke="#3a2a1a" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M114 80 Q122 73 130 80" fill="none" stroke="#3a2a1a" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="110" cy="62" r="3.2" fill="#c62828" />
      <path d="M110 82 Q106 92 110 94 Q114 92 110 82" fill="#e7ad72" />
      <path d="M96 100 Q110 96 124 100 Q117 108 110 104 Q103 108 96 100 Z" fill="#2a2018" />
      <path d="M100 106 Q110 116 120 106 Q110 110 100 106 Z" fill="#a3231f" />
      <path d="M92 104 Q110 160 128 104 Q119 118 110 118 Q101 118 92 104 Z" fill="#2a2018" />
      {/* tay + thỏi vàng */}
      <ellipse cx="90" cy="176" rx="11" ry="8" fill="#f7d6a2" stroke="#d8a86a" strokeWidth="0.8" />
      <ellipse cx="130" cy="176" rx="11" ry="8" fill="#f7d6a2" stroke="#d8a86a" strokeWidth="0.8" />
      <path d="M86 168 Q110 146 134 168 Q121 180 110 180 Q99 180 86 168 Z" fill="url(#ttG)" stroke="#8f6f2b" strokeWidth="1.2" />
      <ellipse cx="110" cy="166" rx="19" ry="5.5" fill="#ffe9a8" stroke="#8f6f2b" strokeWidth="1" />
      {/* mũ + 2 cánh đồng tiền */}
      <path d="M74 62 Q110 36 146 62 L146 66 Q110 44 74 66 Z" fill="url(#ttG)" stroke="#8f6f2b" strokeWidth="1.2" />
      <path d="M80 58 Q110 40 140 58 L140 50 Q110 30 80 50 Z" fill="url(#ttGr)" stroke="#8f6f2b" strokeWidth="1" />
      <circle cx="110" cy="46" r="6.5" fill="#e01e1e" stroke="#ffdd7a" strokeWidth="2" />
      <circle cx="110" cy="30" r="4" fill="url(#ttG)" stroke="#8f6f2b" strokeWidth="0.8" />
      <ellipse cx="60" cy="56" rx="17" ry="14" fill="url(#ttG)" stroke="#8f6f2b" strokeWidth="1.2" />
      <rect x="54" y="50" width="12" height="12" rx="2" fill="#c62828" />
      <ellipse cx="160" cy="56" rx="17" ry="14" fill="url(#ttG)" stroke="#8f6f2b" strokeWidth="1.2" />
      <rect x="154" y="50" width="12" height="12" rx="2" fill="#c62828" />
    </svg>
  );
  const coverBase: CSSProperties = { boxSizing: 'border-box', position: 'relative', height: '258mm', overflow: 'hidden', background: '#ffffff', color: '#3a2d12', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact', fontFamily: '"Times New Roman", "Tinos", serif' };
  const salesN = (f.salesName || '').trim() || (f.cTen || '').trim();
  const salesP = (f.salesPhone || '').trim() || (f.cSdt || '').trim();
  const nTo = inBia ? Math.min(200, Math.max(1, Number((f.soTo || '1').replace(/[^\d]/g, '')) || 1)) : 1; // In cả cuốn → lặp lại "tờ cọc" đúng số lượng khách nhập (kẹp giữa 2 bìa)
  const frontCover = (
    <div style={{ ...coverBase, pageBreakAfter: 'always', breakAfter: 'page' }}>
      <div style={{ position: 'absolute', inset: '9mm', border: '2px solid #C8A14B' }} />
      <div style={{ position: 'absolute', inset: '10.5mm', border: '0.8px solid #C8A14B', opacity: 0.9 }} />
      <div style={{ position: 'absolute', inset: '17mm', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>{clHouse(15)}<span style={{ letterSpacing: '3px', fontSize: '9.5px', color: '#9c7a2f', fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>CAM LÂM LAND</span></div>
        <div style={{ marginTop: '4mm', fontSize: '25px', fontWeight: 800, color: '#0A2540', letterSpacing: '1px', lineHeight: 1.15 }}>HỢP ĐỒNG ĐẶT CỌC<br />NHÀ ĐẤT</div>
        <div style={{ marginTop: '2.5mm', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '20mm', height: '1.5px', background: '#C8A14B' }} /><span style={{ width: '7px', height: '7px', background: '#C8A14B', transform: 'rotate(45deg)' }} /><span style={{ width: '20mm', height: '1.5px', background: '#C8A14B' }} /></div>
        <div style={{ marginTop: '2mm' }}>{ttImg ? <img src="/than-tai.png" alt="Thần Tài" onError={() => setTtImg(false)} style={{ width: '81mm', height: 'auto', display: 'block' }} /> : clThanTai(195)}</div>
        <div style={{ marginTop: '3mm', fontSize: '20px', fontStyle: 'italic', fontWeight: 700, color: '#c0161d' }}>Giữ Chặt Tài Lộc — Chốt Cọc Thành Công</div>
        <div style={{ flex: 1 }} />
        <div style={{ width: '124mm', paddingTop: '3mm', borderTop: '1.5px solid #C8A14B' }}>
          <div style={{ fontSize: '23px', fontWeight: 800, color: '#0A2540', letterSpacing: '0.5px' }}>{salesN || 'HỌ VÀ TÊN CỦA BẠN'}</div>
          <div style={{ fontSize: '11.5px', letterSpacing: '1.5px', color: '#9c7a2f', fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', marginTop: '1mm' }}>{(f.salesTitle || '').trim() || 'Chuyên viên Tư vấn Bất động sản'}</div>
          {(f.salesSlogan || '').trim() && <div style={{ fontSize: '11.5px', fontStyle: 'italic', color: '#c0161d', marginTop: '0.8mm' }}>“{f.salesSlogan}”</div>}
          <div style={{ fontSize: '12px', color: '#3a2d12', marginTop: '1.5mm', fontFamily: 'Arial, sans-serif' }}>📞 {salesP || HOTLINE} · batdongsancamlam.dpdns.org</div>
        </div>
      </div>
    </div>
  );
  const backCover = (
    <div style={{ ...coverBase, pageBreakAfter: 'always', breakAfter: 'page' }}>
      <div style={{ position: 'absolute', inset: '9mm', border: '2px solid #C8A14B' }} />
      <div style={{ position: 'absolute', inset: '10.5mm', border: '0.8px solid #C8A14B', opacity: 0.9 }} />
      <div style={{ position: 'absolute', inset: '20mm', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ flex: 0.6 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{clHouse(34)}<span style={{ fontSize: '26px', fontWeight: 800, color: '#0A2540', fontFamily: 'Arial, sans-serif', letterSpacing: '1px' }}>CAM LÂM LAND</span></div>
        <div style={{ marginTop: '2mm', fontSize: '12px', color: '#9c7a2f', fontFamily: 'Arial, sans-serif', letterSpacing: '1px' }}>Sàn Bất động sản &amp; Bản đồ quy hoạch Cam Lâm, Khánh Hòa</div>
        <div style={{ marginTop: '12mm', fontSize: '17px', fontWeight: 700, color: '#b23b3b' }}>Vạn sự hanh thông — Tài lộc vượng phát</div>
        <div style={{ marginTop: '3mm', fontSize: '12.5px', color: '#3a2d12', maxWidth: '120mm', lineHeight: 1.6 }}>Cảm ơn Quý khách đã tin tưởng. Kính chúc Quý khách <b>an cư lạc nghiệp</b>, giao dịch <b>thuận buồm xuôi gió</b>, gia đạo bình an, tài lộc dồi dào.</div>
        <div style={{ marginTop: '7mm' }}>{ttImg2 ? <img src="/than-tai-sau.png" alt="Thần Tài" onError={() => setTtImg2(false)} style={{ width: '55mm', height: 'auto', display: 'block' }} /> : clMedal()}</div>
        <div style={{ flex: 1 }} />
        <div style={{ borderTop: '1px solid #C8A14B', paddingTop: '4mm', width: '112mm', fontSize: '12px', color: '#3a2d12', fontFamily: 'Arial, sans-serif' }}>
          <div><b style={{ color: '#0A2540' }}>{salesN || 'Chuyên viên tư vấn'}</b>{salesP ? ` · 📞 ${salesP}` : ''}</div>
          <div style={{ marginTop: '1mm', color: '#6a5220' }}>Hotline {HOTLINE} · Zalo {HOTLINE} · batdongsancamlam.dpdns.org</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
    <div className="mx-auto max-w-3xl px-3 sm:px-4 py-6">
      <datalist id="dl-cccd"><option value="Cục Cảnh sát QLHC về TTXH" /><option value="Công an tỉnh Khánh Hòa" /></datalist>
      <datalist id="dl-gcn"><option value="Sở Tài nguyên và Môi trường tỉnh Khánh Hòa" /><option value="Ủy ban nhân dân huyện " /><option value="Ủy ban nhân dân xã " /><option value="Văn phòng đăng ký đất đai chi nhánh Cam Lâm" /></datalist>
      <datalist id="dl-mucdich"><option value="Đất ở" /><option value="Đất ở tại nông thôn" /><option value="Đất ở tại đô thị" /><option value="Đất trồng cây lâu năm" /><option value="Đất trồng cây hàng năm" /></datalist>
      <datalist id="dl-thoihan"><option value="Lâu dài" /><option value="Đến tháng 10/2043" /></datalist>
      <datalist id="dl-benTra"><option value="Bên A" /><option value="Bên B" /><option value="Bên A và Bên B (mỗi bên 50%)" /></datalist>

      <div className="no-print">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#0A2540]">📝 Hợp đồng đặt cọc</h1>
        <p className="text-[13px] text-slate-500 mt-1">Điền thông tin rồi bấm <b>Xuất PDF / In</b>. Soạn theo <b>Điều 328 Bộ luật Dân sự 2015</b> &amp; Luật Đất đai 2024. <span className="text-amber-700">Mẫu tham khảo — nên công chứng/chứng thực &amp; nhờ luật sư rà cho giao dịch cụ thể.</span></p>

        <div className="mt-3 sm:mt-4 bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
          <div>
            <p className="font-bold text-[#0A2540] mb-2">🗓️ Thời gian &amp; địa điểm lập</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2">{field('ngayLap', 'Ngày lập', { type: 'date' })}{field('noiLap', 'Nơi lập')}</div>
          </div>
          <div>
            <p className="font-bold text-[#0A2540] mb-2">🅰️ Bên nhận đặt cọc (BÊN A – Bên bán)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2">
              {field('aTen', 'Họ tên (người đứng tên 1)', { w: 'sm:col-span-2', ph: 'NGUYỄN VĂN A' })}{field('aSinh', 'Ngày sinh', { type: 'date' })}{field('aSdt', 'Điện thoại', { phone: true })}
              {field('aCccd', 'CMND/CCCD số', { cccd: true })}{field('aCccdNgay', 'Ngày cấp', { type: 'date' })}{field('aCccdNoi', 'Nơi cấp', { w: 'sm:col-span-2', list: 'dl-cccd' })}
              {field('aDiaChi', 'Địa chỉ thường trú', { w: 'sm:col-span-2' })}
            </div>
            <div className="mt-3">
              <p className="text-[13px] font-semibold text-[#0A2540]">➕ Đồng sở hữu — nhiều người cùng đứng tên Bên A <span className="font-normal text-[12px] text-slate-400">(tài sản chung phải đủ chữ ký TẤT CẢ người đứng tên — Điều 35 Luật HN&amp;GĐ; thiếu 1 người có thể vô hiệu)</span></p>
              {Array.from({ length: nCo }).map((_, idx) => {
                const n = idx + 2;
                return (
                  <div key={n} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2 mt-2 pl-3 border-l-2 border-[#C8A14B]/40">
                    <p className="sm:col-span-2 text-[12px] font-bold text-slate-500 -mb-1">Người đứng tên {n} (đồng sở hữu)</p>
                    {field(`a${n}Ten`, 'Họ tên', { w: 'sm:col-span-2', ph: 'NGUYỄN VĂN B' })}{field(`a${n}Sinh`, 'Ngày sinh', { type: 'date' })}{field(`a${n}Sdt`, 'Điện thoại', { phone: true })}
                    {field(`a${n}Cccd`, 'CMND/CCCD số', { cccd: true })}{field(`a${n}CccdNgay`, 'Ngày cấp', { type: 'date' })}{field(`a${n}CccdNoi`, 'Nơi cấp', { w: 'sm:col-span-2', list: 'dl-cccd' })}
                  </div>
                );
              })}
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setNCo((v) => Math.min(4, v + 1))} disabled={nCo >= 4} className="text-[13px] font-bold text-[#0A2540] border border-[#C8A14B]/60 rounded-lg px-3 py-1.5 disabled:opacity-40">➕ Thêm người đứng tên</button>
                {nCo > 0 && <button type="button" onClick={() => setNCo((v) => Math.max(0, v - 1))} className="text-[13px] font-semibold text-slate-500 border border-slate-300 rounded-lg px-3 py-1.5">➖ Bớt người cuối</button>}
              </div>
            </div>
          </div>
          <div>
            <p className="font-bold text-[#0A2540] mb-2">🅱️ Bên đặt cọc (BÊN B – Bên mua)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2">
              {field('bTen', 'Họ tên', { w: 'sm:col-span-2', ph: 'TRẦN THỊ B' })}{field('bSinh', 'Ngày sinh', { type: 'date' })}{field('bSdt', 'Điện thoại', { phone: true })}
              {field('bCccd', 'CMND/CCCD số', { cccd: true })}{field('bCccdNgay', 'Ngày cấp', { type: 'date' })}{field('bCccdNoi', 'Nơi cấp', { w: 'sm:col-span-2', list: 'dl-cccd' })}
              {field('bDiaChi', 'Địa chỉ thường trú', { w: 'sm:col-span-2' })}
            </div>
          </div>
          <div>
            <label className="flex items-start gap-2 cursor-pointer font-bold text-[#0A2540] mb-2"><input type="checkbox" checked={hasBenC} onChange={(e) => setHasBenC(e.target.checked)} className="w-4 h-4 mt-0.5 shrink-0 accent-[#0A2540]" /><span>🤝 Bên làm chứng (BÊN C – Môi giới) <span className="font-normal text-[12px] text-slate-400">(mặc định có — bỏ tick nếu không cần)</span></span></label>
            {hasBenC && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2">
                {field('cTen', 'Họ tên môi giới', { w: 'sm:col-span-2', ph: 'NGUYỄN VĂN C' })}
                {field('cSdt', 'Điện thoại', { phone: true })}{field('cCccd', 'CMND/CCCD số', { cccd: true })}
                <div className="sm:col-span-2 mt-1 pt-2.5 border-t border-slate-100"><p className="text-[12px] font-semibold text-slate-500">💵 Thù lao (hoa hồng) môi giới — Bên C</p></div>
                {field('cHhThanhCong', 'Khi GIAO DỊCH THÀNH CÔNG (% giá bán)', { pct: true, ph: 'VD: 1' })}
                {field('cHhHuyCoc', 'Khi HỦY CỌC / mất cọc (% tiền cọc)', { pct: true, ph: 'VD: 30' })}
                {field('cHhBenTra', 'Bên chi trả hoa hồng', { w: 'sm:col-span-2', list: 'dl-benTra' })}
                {(f.cHhThanhCong || f.cHhHuyCoc) && <p className="sm:col-span-2 text-[11px] text-slate-400 -mt-1">Quy đổi: {f.cHhThanhCong && f.gia ? <>thành công ≈ <b>{(Math.round(Number(f.gia) * (Number(String(f.cHhThanhCong).replace(',', '.')) || 0) / 100)).toLocaleString('vi-VN')}đ</b>. </> : ''}{f.cHhHuyCoc && f.coc ? <>hủy cọc ≈ <b>{(Math.round(Number(f.coc) * (Number(String(f.cHhHuyCoc).replace(',', '.')) || 0) / 100)).toLocaleString('vi-VN')}đ</b>.</> : ''}</p>}
              </div>
            )}
          </div>
          <div>
            <p className="font-bold text-[#0A2540] mb-2">🏠 Bất động sản đặt cọc</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2">
              {field('bdsDiaChi', 'Địa chỉ thửa đất', { w: 'sm:col-span-2', ph: 'Thôn/xã…, Cam Lâm, Khánh Hòa' })}
              {field('thuaSo', 'Thửa đất số')}{field('toBanDo', 'Tờ bản đồ số')}{field('dienTich', 'Diện tích (m²)', { area: true, ph: 'VD: 100 hoặc 1.234,5' })}{field('mucDich', 'Mục đích SD', { list: 'dl-mucdich' })}
              {field('gcn', 'Giấy chứng nhận (số)')}{field('gcnNgay', 'GCN cấp ngày', { type: 'date' })}{field('gcnCap', 'Nơi cấp GCN', { list: 'dl-gcn' })}{field('thoiHan', 'Thời hạn SD', { list: 'dl-thoihan' })}
            </div>
          </div>
          <div>
            <p className="font-bold text-[#0A2540] mb-2">💰 Giá &amp; tiền cọc</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2">
              {field('gia', 'Giá chuyển nhượng (đ)', { money: true, ph: 'VD: 2.000.000.000' })}{field('coc', 'Tiền đặt cọc (đ)', { money: true, ph: 'VD: 200.000.000' })}
              {field('hanNgay', 'Thời hạn ký HĐ công chứng (ngày)', { num: true, w: 'sm:col-span-2' })}
              {field('thueBenBan', 'Thuế (bên bán)', { w: 'sm:col-span-2' })}{field('phiBenMua', 'Phí (bên mua)', { w: 'sm:col-span-2' })}
            </div>
            {f.gia && <p className="text-[12px] text-slate-500 mt-1">Giá bằng chữ: <b>{docTien(f.gia)}</b></p>}
            {f.coc && <p className="text-[12px] text-slate-500">Cọc bằng chữ: <b>{docTien(f.coc)}</b></p>}
          </div>
          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer font-bold text-[#0A2540]"><input type="checkbox" checked={editDieu} onChange={(e) => setEditDieu(e.target.checked)} className="w-4 h-4 mt-0.5 shrink-0 accent-[#0A2540]" /><span>✍️ Sửa nội dung Điều 5 &amp; 6 <span className="font-normal text-[12px] text-slate-400">(không tick thì dùng mẫu mặc định chuẩn luật)</span></span></label>
            {editDieu && (<>
              {area('dieu5', 'Điều 5 — Xử lý tiền đặt cọc')}
              {area('dieu6', 'Điều 6 — Cam kết của các bên', 6)}
            </>)}
          </div>
          {/* Bìa cuốn hồ sơ — tùy chọn, mang thương hiệu cá nhân của sales */}
          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer font-bold text-[#0A2540]"><input type="checkbox" checked={inBia} onChange={(e) => setInBia(e.target.checked)} className="w-4 h-4 mt-0.5 shrink-0 accent-[#C8A14B]" /><span>📕 In kèm bìa hồ sơ (in cả cuốn) <span className="font-normal text-[12px] text-slate-400">— bìa 2 mặt sang trọng, mang tên &amp; thương hiệu cá nhân của bạn</span></span></label>
            {inBia && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2 rounded-xl border border-[#C8A14B]/40 bg-[#faf6ea] p-3">
                {field('salesName', 'Tên bạn (in LỚN trên bìa)', { w: 'sm:col-span-2', ph: 'NGUYỄN VĂN A' })}
                {field('salesTitle', 'Chức danh')}
                {field('salesPhone', 'Điện thoại', { phone: true })}
                {field('salesSlogan', 'Slogan cá nhân (tuỳ chọn)', { w: 'sm:col-span-2' })}
                {field('soTo', 'Số tờ cọc in trong cuốn', { num: true, w: 'sm:col-span-2', ph: 'VD: 50 (để trống = 1 tờ)' })}
                <p className="sm:col-span-2 text-[11px] text-slate-500">Khi in sẽ ra: <b>bìa trước → {nTo} tờ hợp đồng cọc → bìa sau</b>. Bìa Thần Tài sang trọng – tài lộc; logo Cam Lâm Land nhỏ, <b>tên bạn là chính</b>. Bỏ trống tên sẽ tự lấy Bên C (môi giới).</p>
              </div>
            )}
          </div>
          <button onClick={() => window.print()} className="w-full bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold py-3 rounded-xl shadow-lg">🖨️ Xuất PDF / In {inBia ? 'cả cuốn (kèm bìa)' : 'hợp đồng'}</button>
        </div>
      </div>

      {/* ───────── BẢN IN ───────── */}
      <div id="baogia-print" className="hidden print:block" style={{ fontFamily: 'Times New Roman, serif', color: '#111', fontSize: '13.5px', lineHeight: 1.5 }}>
        {inBia && frontCover}
        {inBia && backCover}
        {Array.from({ length: nTo }).map((_, ci) => (
        <div key={ci} style={ci > 0 ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}>
        <div style={{ position: 'relative' }}>
          <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
            {[0, 1, 2, 3, 4, 5].map((r) => (
              <div key={r} style={{ transform: 'rotate(-28deg)', whiteSpace: 'nowrap', textAlign: 'center', marginTop: r === 0 ? '150px' : '200px', color: 'rgba(10,37,64,0.05)', fontSize: '40px', fontWeight: 900, letterSpacing: '5px' }}>
                CAM LÂM LAND · CAM LÂM LAND
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '2.5px solid #0A2540', paddingBottom: '8px' }}>
              <svg viewBox="0 0 44 44" width="46" height="46"><rect width="44" height="44" rx="11" fill="#0A2540" /><path d="M11 21.5 L22 12 L33 21.5" fill="none" stroke="#C8A14B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M14.2 20 V31.4 H29.8 V20" fill="none" stroke="#C8A14B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="22" cy="25.6" r="2.5" fill="#C8A14B" /></svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: '18px', color: '#0A2540' }}>CAM LÂM LAND</div>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#555' }}>Sàn Bất động sản &amp; Bản đồ quy hoạch Cam Lâm, Khánh Hòa · Hotline {HOTLINE}</div>
                <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9.5px', fontStyle: 'italic', color: '#9a7b3a' }}>Nội dung do bên mua và bên bán chủ động thỏa thuận, thực hiện</div>
              </div>
              <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#888', textAlign: 'right' }}>Mã HĐ: ĐC-{d[0] || '____'}-______<br />batdongsancamlam.dpdns.org</div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: '13px' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: '13px' }}>Độc lập – Tự do – Hạnh phúc</div>
              <div style={{ margin: '2px auto 0', width: '180px', borderBottom: '1px solid #111' }} />
              <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: '19px', marginTop: '14px' }}>HỢP ĐỒNG ĐẶT CỌC</div>
              <div style={{ fontStyle: 'italic', fontSize: '12px' }}>(V/v chuyển nhượng quyền sử dụng đất)</div>
            </div>

            <p style={{ marginTop: '10px' }}><i>Căn cứ Bộ luật Dân sự số 91/2015/QH13 (Điều 328 về đặt cọc); Luật Đất đai số 31/2024/QH15; Luật Kinh doanh bất động sản; và nhu cầu, thỏa thuận tự nguyện của các bên.</i></p>
            <p>Hôm nay, ngày {or(d[2], 2)} tháng {or(d[1], 2)} năm {or(d[0], 4)}, tại {or(f.noiLap)}, chúng tôi gồm:</p>

            <p style={{ fontWeight: 700, marginTop: '8px' }}>BÊN NHẬN ĐẶT CỌC (BÊN A – Bên bán):</p>
            <p>Ông/Bà: <b>{or(f.aTen)}</b> — Sinh ngày: {or(dmy(f.aSinh), 10)}</p>
            <p>Số CMND/CCCD: {or(f.aCccd, 12)} — cấp ngày {or(dmy(f.aCccdNgay), 8)} tại {or(f.aCccdNoi)}</p>
            <p>Địa chỉ thường trú: {or(f.aDiaChi, 40)}</p>
            <p>Điện thoại: {or(f.aSdt, 10)}</p>
            {nCo > 0 && (<>
              {Array.from({ length: nCo }).map((_, idx) => {
                const n = idx + 2;
                return (
                  <div key={n}>
                    <p style={{ marginTop: '4px' }}><b>Và Ông/Bà:</b> <b>{or(f[`a${n}Ten`])}</b> — Sinh ngày: {or(dmy(f[`a${n}Sinh`]), 10)}</p>
                    <p>Số CMND/CCCD: {or(f[`a${n}Cccd`], 12)} — cấp ngày {or(dmy(f[`a${n}CccdNgay`]), 8)} tại {or(f[`a${n}CccdNoi`])}</p>
                    <p>Điện thoại: {or(f[`a${n}Sdt`], 10)}</p>
                  </div>
                );
              })}
              <p style={{ fontStyle: 'italic', fontSize: '12px' }}>(Những người có tên trên cùng là người đứng tên/đồng sở hữu quyền sử dụng đất – tài sản chung; cùng thống nhất chuyển nhượng và cùng ký tên; sau đây gọi chung là “Bên A”.)</p>
            </>)}

            <p style={{ fontWeight: 700, marginTop: '6px' }}>BÊN ĐẶT CỌC (BÊN B – Bên mua):</p>
            <p>Ông/Bà: <b>{or(f.bTen)}</b> — Sinh ngày: {or(dmy(f.bSinh), 10)}</p>
            <p>Số CMND/CCCD: {or(f.bCccd, 12)} — cấp ngày {or(dmy(f.bCccdNgay), 8)} tại {or(f.bCccdNoi)}</p>
            <p>Địa chỉ thường trú: {or(f.bDiaChi, 40)}</p>
            <p>Điện thoại: {or(f.bSdt, 10)}</p>

            {hasBenC && (<>
              <p style={{ fontWeight: 700, marginTop: '6px' }}>BÊN LÀM CHỨNG (BÊN C – Môi giới):</p>
              <p>Ông/Bà: <b>{or(f.cTen)}</b> — Số CMND/CCCD: {or(f.cCccd, 12)} — Điện thoại: {or(f.cSdt, 10)}</p>
            </>)}

            <p style={{ marginTop: '6px' }}>Hai bên tự nguyện thỏa thuận ký Hợp đồng đặt cọc với các điều khoản sau:</p>

            <p style={{ fontWeight: 700, marginTop: '6px' }}>Điều 1. Đối tượng đặt cọc</p>
            <p>Bên A đồng ý chuyển nhượng, Bên B đồng ý nhận chuyển nhượng thửa đất:</p>
            <p>– Địa chỉ: {or(f.bdsDiaChi, 40)}</p>
            <p>– Thửa đất số {or(f.thuaSo, 4)}, tờ bản đồ số {or(f.toBanDo, 3)}; diện tích: <b>{f.dienTich ? fmtArea(f.dienTich) : '…'.repeat(4)}</b> m²; mục đích sử dụng: {or(f.mucDich)}.</p>
            <p>– Giấy chứng nhận QSDĐ số {or(f.gcn, 8)} do {or(f.gcnCap)} cấp ngày {or(dmy(f.gcnNgay), 8)}; thời hạn sử dụng: {or(f.thoiHan)}.</p>

            <p style={{ fontWeight: 700, marginTop: '6px' }}>Điều 2. Giá chuyển nhượng</p>
            <p>Giá chuyển nhượng hai bên thống nhất: <b>{money(f.gia)}</b> đồng (Bằng chữ: <i>{docTien(f.gia) || '……………………'}</i>).</p>

            <p style={{ fontWeight: 700, marginTop: '6px' }}>Điều 3. Số tiền đặt cọc</p>
            <p>Ngay khi ký Hợp đồng này, Bên B đặt cọc cho Bên A số tiền: <b>{money(f.coc)}</b> đồng (Bằng chữ: <i>{docTien(f.coc) || '……………………'}</i>) để bảo đảm giao kết và thực hiện Hợp đồng chuyển nhượng. Bên A xác nhận đã nhận đủ số tiền cọc nêu trên.</p>

            <p style={{ fontWeight: 700, marginTop: '6px' }}>Điều 4. Thời hạn thực hiện</p>
            <p>Trong thời hạn <b>{or(f.hanNgay, 2)}</b> ngày kể từ ngày ký Hợp đồng này, hai bên có nghĩa vụ cùng nhau ký Hợp đồng chuyển nhượng QSDĐ có công chứng/chứng thực và thực hiện thủ tục sang tên theo quy định. Tiền đặt cọc được trừ vào giá chuyển nhượng khi hai bên hoàn tất giao dịch.</p>

            <p style={{ fontWeight: 700, marginTop: '6px' }}>Điều 5. Xử lý tiền đặt cọc <span style={{ fontWeight: 400, fontStyle: 'italic', fontSize: '12px' }}>(Điều 328 BLDS 2015)</span></p>
            <p style={{ whiteSpace: 'pre-line' }}>{f.dieu5}</p>

            <p style={{ fontWeight: 700, marginTop: '6px' }}>Điều 6. Cam kết của các bên</p>
            <p style={{ whiteSpace: 'pre-line' }}>{f.dieu6}</p>

            <p style={{ fontWeight: 700, marginTop: '6px' }}>Điều 7. Thuế, phí &amp; bàn giao</p>
            <p>– {or(f.thueBenBan, 20)}; {or(f.phiBenMua, 20)}.</p>
            <p>– Bên A bàn giao thửa đất và toàn bộ giấy tờ pháp lý bản gốc cho Bên B khi hai bên ký Hợp đồng chuyển nhượng công chứng và Bên B thanh toán đủ theo thỏa thuận.</p>

            {showHoaHong && (<>
              <p style={{ fontWeight: 700, marginTop: '6px' }}>Điều 8. Thù lao (hoa hồng) môi giới – Bên C</p>
              <p>Các bên thống nhất mức thù lao môi giới trả cho Bên C như sau:</p>
              <p>– Khi hai bên hoàn tất giao dịch chuyển nhượng thành công (hoàn thành hợp đồng): Bên C được hưởng <b>{(f.cHhThanhCong || '').trim() || '……'}%</b> giá chuyển nhượng{pctAmt(f.cHhThanhCong, f.gia) > 0 ? <> (tương đương <b>{pctAmt(f.cHhThanhCong, f.gia).toLocaleString('vi-VN')}</b> đồng)</> : null}.</p>
              <p>– Trường hợp giao dịch không thành / không hoàn thành hợp đồng do một bên vi phạm dẫn đến bên đó bị mất cọc/chịu phạt cọc: Bên C được hưởng <b>{(f.cHhHuyCoc || '').trim() || '……'}%</b> trên số tiền đặt cọc bị mất hoặc khoản tiền phạt cọc{pctAmt(f.cHhHuyCoc, f.coc) > 0 ? <> (tương đương <b>{pctAmt(f.cHhHuyCoc, f.coc).toLocaleString('vi-VN')}</b> đồng)</> : null}.</p>
              <p>– Thù lao môi giới do <b>{or(f.cHhBenTra || 'Bên A')}</b> chi trả cho Bên C trong vòng 03 (ba) ngày kể từ thời điểm phát sinh nghĩa vụ nêu trên; đây là thỏa thuận dịch vụ môi giới tự nguyện, phù hợp Bộ luật Dân sự &amp; Luật Kinh doanh bất động sản, trừ khi các bên có thỏa thuận khác.</p>
            </>)}

            <p style={{ fontWeight: 700, marginTop: '6px' }}>Điều {nDieuTC}. Giải quyết tranh chấp &amp; điều khoản chung</p>
            <p>Mọi tranh chấp phát sinh được ưu tiên thương lượng; nếu không thành, một trong hai bên có quyền yêu cầu Tòa án nhân dân có thẩm quyền giải quyết. Hợp đồng có hiệu lực kể từ ngày ký, được lập thành {hasBenC ? '03 (ba)' : '02 (hai)'} bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản; đã đọc, hiểu rõ và nhất trí ký tên dưới đây.</p>

            <table style={{ width: '100%', marginTop: '18px', textAlign: 'center', fontWeight: 700 }}><tbody><tr>
              <td style={{ width: hasBenC ? '33%' : '50%', verticalAlign: 'top' }}>BÊN A (Bên bán)<div style={{ fontWeight: 400, fontStyle: 'italic', fontSize: '11px' }}>(Ký, ghi rõ họ tên)</div><div style={{ height: `${sigH}px` }} /></td>
              {hasBenC && <td style={{ width: '34%', verticalAlign: 'top' }}>BÊN C (Người làm chứng)<div style={{ fontWeight: 400, fontStyle: 'italic', fontSize: '11px' }}>(Ký, ghi rõ họ tên)</div><div style={{ height: `${sigH}px` }} /></td>}
              <td style={{ width: hasBenC ? '33%' : '50%', verticalAlign: 'top' }}>BÊN B (Bên mua)<div style={{ fontWeight: 400, fontStyle: 'italic', fontSize: '11px' }}>(Ký, ghi rõ họ tên)</div><div style={{ height: `${sigH}px` }} /></td>
            </tr></tbody></table>

            <div style={{ marginTop: '10px', borderTop: '1px dashed #999', paddingTop: '6px', fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#888', textAlign: 'center' }}>
              <b style={{ color: '#0A2540' }}>Cam Lâm Land</b> · {HOTLINE} · batdongsancamlam.dpdns.org — <i>Khuyến nghị công chứng khi giao dịch.</i>
            </div>
          </div>
        </div>
        </div>
        ))}
      </div>

    </div>
    <div className="no-print mx-auto max-w-7xl px-3 sm:px-6 pb-6 sm:pb-8">
      <ServicesSection className="mt-6 sm:mt-8" />
      <LegalConsultCTA topic="Sau khi lập hợp đồng đặt cọc" className="mt-4" />
    </div>
    </>
  );
}

// Đọc số tiền VND ra chữ.
function docTien(raw: string): string {
  let n = Math.round(Number(String(raw).replace(/\D/g, '')) || 0);
  if (n <= 0) return '';
  const ch = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const donvi = ['', ' nghìn', ' triệu', ' tỷ'];
  const doc3 = (num: number, full: boolean) => {
    const tram = Math.floor(num / 100), chuc = Math.floor((num % 100) / 10), dv = num % 10; let s = '';
    if (full || tram > 0) s += ch[tram] + ' trăm';
    if (chuc > 1) { s += ' ' + ch[chuc] + ' mươi'; if (dv === 1) s += ' mốt'; else if (dv === 5) s += ' lăm'; else if (dv > 0) s += ' ' + ch[dv]; }
    else if (chuc === 1) { s += ' mười'; if (dv === 5) s += ' lăm'; else if (dv > 0) s += ' ' + ch[dv]; }
    else if (dv > 0) { if (full || tram > 0) s += ' lẻ'; s += ' ' + ch[dv]; }
    return s.trim();
  };
  const groups: number[] = []; while (n > 0) { groups.unshift(n % 1000); n = Math.floor(n / 1000); }
  let s = '';
  for (let i = 0; i < groups.length; i++) { const g = groups[i]; if (g === 0) continue; s += ' ' + doc3(g, i > 0 && s !== '') + donvi[groups.length - 1 - i]; }
  s = s.trim().replace(/\s+/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + ' đồng';
}
