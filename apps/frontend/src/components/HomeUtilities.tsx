'use client';
import { useState, type ReactNode } from 'react';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
const fmtVnd = (n: number) => (n >= 1e9 ? (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 2) + ' tỷ' : fmt(n) + ' đ');

// ===== Xem tuổi xây nhà (Kim Lâu · Hoang Ốc · Tam Tai) =====
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
const chiIndex = (y: number) => (((y - 4) % 12) + 12) % 12;
const kimLauBad = (tuoiMu: number) => { let r = tuoiMu % 9; if (r === 0) r = 9; return [1, 3, 6, 8].includes(r); };
const HO = ['Nhất Cát', 'Nhì Nghi', 'Tam Địa Sát', 'Tứ Tấn Tài', 'Ngũ Thọ Tử', 'Lục Hoang Ốc'];
const HO_GOOD = [true, true, false, true, false, false];
const hoangOc = (tuoiMu: number) => { const i = (((tuoiMu - 10) % 6) + 6) % 6; return { name: HO[i], good: HO_GOOD[i] }; };
function tamTaiBad(namSinh: number, namXay: number) {
  const c = chiIndex(namSinh);
  const groups = [{ m: [8, 0, 4], y: [2, 3, 4] }, { m: [2, 6, 10], y: [8, 9, 10] }, { m: [5, 9, 1], y: [11, 0, 1] }, { m: [11, 3, 7], y: [5, 6, 7] }];
  const g = groups.find((gr) => gr.m.includes(c));
  return g ? g.y.includes(chiIndex(namXay)) : false;
}

// ===== Tư vấn phong thủy — hướng nhà (Bát trạch / Kua) =====
const reduceDigits = (n: number) => { while (n > 9) n = String(n).split('').reduce((s, d) => s + +d, 0); return n; };
function kuaNumber(year: number, male: boolean) {
  const two = year % 100; const s = reduceDigits(Math.floor(two / 10) + (two % 10));
  let k = male ? (year >= 2000 ? 9 - s : 10 - s) : (year >= 2000 ? s + 6 : s + 5);
  k = reduceDigits(k <= 0 ? k + 9 : k);
  if (k === 5) k = male ? 2 : 8;
  return k;
}
const CUNG: Record<number, { ten: string; hanh: string; nhom: 'Đông' | 'Tây' }> = {
  1: { ten: 'Khảm', hanh: 'Thủy', nhom: 'Đông' }, 3: { ten: 'Chấn', hanh: 'Mộc', nhom: 'Đông' },
  4: { ten: 'Tốn', hanh: 'Mộc', nhom: 'Đông' }, 9: { ten: 'Ly', hanh: 'Hỏa', nhom: 'Đông' },
  2: { ten: 'Khôn', hanh: 'Thổ', nhom: 'Tây' }, 6: { ten: 'Càn', hanh: 'Kim', nhom: 'Tây' },
  7: { ten: 'Đoài', hanh: 'Kim', nhom: 'Tây' }, 8: { ten: 'Cấn', hanh: 'Thổ', nhom: 'Tây' },
};
const HUONG_DONG = ['Bắc', 'Nam', 'Đông', 'Đông Nam'];
const HUONG_TAY = ['Tây', 'Tây Bắc', 'Đông Bắc', 'Tây Nam'];

const inp = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]';
const lbl = 'block text-xs font-semibold text-slate-500 mb-1';

export default function HomeUtilities() {
  const [open, setOpen] = useState<'' | 'age' | 'cost' | 'loan' | 'fs'>('');
  const TOOLS = [
    { k: 'age', icon: '☯️', t: 'Xem tuổi xây nhà', d: 'Kim Lâu · Hoang Ốc · Tam Tai' },
    { k: 'cost', icon: '🏗️', t: 'Chi phí làm nhà', d: 'Ước tính theo m² & số tầng' },
    { k: 'loan', icon: '🧮', t: 'Tính lãi suất vay', d: 'Trả góp ngân hàng mua nhà' },
    { k: 'fs', icon: '🧭', t: 'Tư vấn phong thủy', d: 'Hướng nhà hợp tuổi' },
  ] as const;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h2 className="text-xl md:text-2xl font-extrabold text-[#0A2540] mb-6">Hỗ trợ tiện ích</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {TOOLS.map((tl) => (
          <button key={tl.k} onClick={() => setOpen(tl.k)}
            className="group flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-[#C8A14B] hover:shadow-md transition">
            <span className="w-11 h-11 grid place-items-center rounded-xl bg-slate-50 text-2xl group-hover:bg-[#0A2540]/5 shrink-0">{tl.icon}</span>
            <span className="min-w-0">
              <span className="block font-bold text-[#0A2540] text-sm leading-tight">{tl.t}</span>
              <span className="block text-[11px] text-slate-400 mt-0.5 truncate">{tl.d}</span>
            </span>
          </button>
        ))}
      </div>
      {open && (
        <Modal title={TOOLS.find((t) => t.k === open)!.t} onClose={() => setOpen('')}>
          {open === 'age' && <AgeTool />}
          {open === 'cost' && <CostTool />}
          {open === 'loan' && <LoanTool />}
          {open === 'fs' && <FsTool />}
        </Modal>
      )}
    </section>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <h3 className="font-extrabold text-[#0A2540]">{title}</h3>
          <button onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
        <p className="px-5 pb-4 text-[11px] text-slate-400">* Kết quả mang tính tham khảo.</p>
      </div>
    </div>
  );
}

function AgeTool() {
  const [ns, setNs] = useState(''); const [nx, setNx] = useState('2026');
  const namSinh = +ns, namXay = +nx;
  const ok = namSinh > 1900 && namSinh < 2100 && namXay >= namSinh;
  const tuoiMu = namXay - namSinh + 1;
  const kl = ok && kimLauBad(tuoiMu), ho = ok ? hoangOc(tuoiMu) : null, tt = ok && tamTaiBad(namSinh, namXay);
  const dep = ok && !kl && ho!.good && !tt;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Năm sinh (gia chủ)</label><input className={inp} value={ns} onChange={(e) => setNs(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="VD: 1990" /></div>
        <div><label className={lbl}>Năm dự định xây</label><input className={inp} value={nx} onChange={(e) => setNx(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2026" /></div>
      </div>
      {ok && (
        <div className={`rounded-xl p-4 ${dep ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <p className="font-bold text-center text-lg mb-1">{dep ? `✅ Năm ${namXay} ĐẸP để xây` : `⚠️ Năm ${namXay} không đẹp`}</p>
          <p className="text-xs text-center text-slate-500 mb-3">Tuổi mụ (âm lịch): <b>{tuoiMu}</b> · Con giáp: <b>{CHI[chiIndex(namSinh)]}</b></p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between"><span>Kim Lâu</span><b className={kl ? 'text-red-600' : 'text-emerald-600'}>{kl ? 'Phạm ✗' : 'Không phạm ✓'}</b></li>
            <li className="flex justify-between"><span>Hoang Ốc</span><b className={ho!.good ? 'text-emerald-600' : 'text-red-600'}>{ho!.name} {ho!.good ? '✓' : '✗'}</b></li>
            <li className="flex justify-between"><span>Tam Tai</span><b className={tt ? 'text-red-600' : 'text-emerald-600'}>{tt ? 'Phạm ✗' : 'Không phạm ✓'}</b></li>
          </ul>
          {!dep && <p className="text-xs text-slate-500 mt-3">💡 Nếu cần xây gấp, có thể <b>mượn tuổi</b> người hợp năm để làm lễ động thổ.</p>}
        </div>
      )}
    </div>
  );
}

function CostTool() {
  const [dt, setDt] = useState(''); const [tang, setTang] = useState('1'); const [loai, setLoai] = useState<'tho' | 'trongoi'>('trongoi');
  const dtSan = +dt, soTang = +tang || 1; const donGia = loai === 'tho' ? 3_500_000 : 6_000_000;
  const ok = dtSan > 0; const dtxd = dtSan * (0.5 + soTang + 0.3); const tong = dtxd * donGia;
  return (
    <div className="space-y-3">
      <div><label className={lbl}>Diện tích 1 sàn (m²)</label><input className={inp} value={dt} onChange={(e) => setDt(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="VD: 80" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Số tầng</label><select className={inp} value={tang} onChange={(e) => setTang(e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} tầng</option>)}</select></div>
        <div><label className={lbl}>Loại</label><select className={inp} value={loai} onChange={(e) => setLoai(e.target.value as any)}><option value="tho">Xây thô</option><option value="trongoi">Trọn gói</option></select></div>
      </div>
      {ok && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-slate-500">Diện tích xây dựng</span><b>{fmt(dtxd)} m²</b></div>
          <div className="flex justify-between"><span className="text-slate-500">Đơn giá ({loai === 'tho' ? 'xây thô' : 'trọn gói'})</span><b>{fmt(donGia)} đ/m²</b></div>
          <div className="flex justify-between text-lg pt-1.5 border-t border-slate-200"><span className="font-bold text-[#0A2540]">Tạm tính</span><b className="text-red-600">{fmtVnd(tong)}</b></div>
        </div>
      )}
      <p className="text-[11px] text-slate-400">DTXD ≈ (móng 50% + số tầng + mái 30%) × diện tích sàn. Đơn giá tham khảo 2025.</p>
    </div>
  );
}

function LoanTool() {
  const [sotien, setSotien] = useState(''); const [ls, setLs] = useState('9'); const [nam, setNam] = useState('15'); const [pt, setPt] = useState<'giamdan' | 'deu'>('giamdan');
  const P = +sotien * 1e6, r = +ls / 100 / 12, n = (+nam || 1) * 12;
  const ok = P > 0 && +ls > 0 && n > 0;
  let out: { thangDau: number; thangCuoi?: number; tongLai: number; tong: number } | null = null;
  if (ok) {
    if (pt === 'deu') { const M = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1); out = { thangDau: M, tongLai: M * n - P, tong: M * n }; }
    else { const goc = P / n; const tongLai = ((P * r) * (n + 1)) / 2; out = { thangDau: goc + P * r, thangCuoi: goc + goc * r, tongLai, tong: P + tongLai }; }
  }
  return (
    <div className="space-y-3">
      <div><label className={lbl}>Số tiền vay (triệu đồng)</label><input className={inp} value={sotien} onChange={(e) => setSotien(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="VD: 1000 (= 1 tỷ)" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Lãi suất (%/năm)</label><input className={inp} value={ls} onChange={(e) => setLs(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" /></div>
        <div><label className={lbl}>Thời hạn (năm)</label><input className={inp} value={nam} onChange={(e) => setNam(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></div>
      </div>
      <div><label className={lbl}>Cách tính</label><select className={inp} value={pt} onChange={(e) => setPt(e.target.value as any)}><option value="giamdan">Dư nợ giảm dần</option><option value="deu">Trả góp đều hàng tháng</option></select></div>
      {out && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-1.5">
          {pt === 'deu'
            ? <div className="flex justify-between"><span className="text-slate-500">Trả cố định / tháng</span><b className="text-red-600">{fmtVnd(out.thangDau)}</b></div>
            : <>
                <div className="flex justify-between"><span className="text-slate-500">Tháng đầu</span><b className="text-red-600">{fmtVnd(out.thangDau)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Tháng cuối (giảm dần)</span><b>{fmtVnd(out.thangCuoi!)}</b></div>
              </>}
          <div className="flex justify-between"><span className="text-slate-500">Tổng lãi</span><b>{fmtVnd(out.tongLai)}</b></div>
          <div className="flex justify-between pt-1.5 border-t border-slate-200"><span className="font-bold text-[#0A2540]">Tổng phải trả</span><b className="text-[#0A2540]">{fmtVnd(out.tong)}</b></div>
        </div>
      )}
    </div>
  );
}

function FsTool() {
  const [ns, setNs] = useState(''); const [gt, setGt] = useState<'nam' | 'nu'>('nam');
  const year = +ns; const ok = year > 1900 && year < 2100;
  const k = ok ? kuaNumber(year, gt === 'nam') : 0; const cung = ok ? CUNG[k] : null;
  const tot = cung ? (cung.nhom === 'Đông' ? HUONG_DONG : HUONG_TAY) : [];
  const xau = cung ? (cung.nhom === 'Đông' ? HUONG_TAY : HUONG_DONG) : [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Năm sinh</label><input className={inp} value={ns} onChange={(e) => setNs(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="VD: 1988" /></div>
        <div><label className={lbl}>Giới tính</label><select className={inp} value={gt} onChange={(e) => setGt(e.target.value as any)}><option value="nam">Nam</option><option value="nu">Nữ</option></select></div>
      </div>
      {cung && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-2.5">
          <p className="text-center">Cung mệnh: <b className="text-[#0A2540]">{cung.ten}</b> ({cung.hanh}) · <b>{cung.nhom} tứ mệnh</b></p>
          <div><p className="text-xs font-semibold text-emerald-600 mb-1">Hướng nhà TỐT nên chọn:</p><div className="flex flex-wrap gap-1.5">{tot.map((h) => <span key={h} className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">{h}</span>)}</div></div>
          <div><p className="text-xs font-semibold text-red-600 mb-1">Hướng nên TRÁNH:</p><div className="flex flex-wrap gap-1.5">{xau.map((h) => <span key={h} className="bg-red-50 text-red-600 text-xs px-2.5 py-1 rounded-full">{h}</span>)}</div></div>
        </div>
      )}
    </div>
  );
}
