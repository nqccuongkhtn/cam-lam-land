'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import data from '@/data/camlamBangGia.json';

// ─── Bảng giá đất Cam Lâm (NQ 15/2025 + QĐ 50/2026): BẢNG tra cứu + CÔNG CỤ tính ───
type Row = { diaBan: string | null; duong: string | null; tu: string | null; den: string | null; vt: (number | null)[] };
type XaData = { xa: string; datNongNghiep: { loai: string; vt1: number | null; vt2: number | null }[]; datO: Row[] };
const DB = data as unknown as Record<string, XaData>;
const XA = Object.keys(DB);
const VTL = ['VT1', 'VT2', 'VT3', 'VT4', 'VT5'];

const LOAI = [
  { key: 'o', label: 'Đất ở (Điều 8.1) — 100%', ratio: 1, base: 'o' },
  { key: 'tmdv', label: 'Thương mại – dịch vụ (Điều 8.2) — 80% đất ở', ratio: 0.8, base: 'o' },
  { key: 'sxkd', label: 'Sản xuất – kinh doanh phi nông nghiệp (Điều 8.2) — 60% đất ở', ratio: 0.6, base: 'o' },
  { key: 'truso', label: 'Trụ sở, tôn giáo, nhà tang lễ / hỏa táng / lưu tro, sự nghiệp chưa tự chủ (Điều 9.1–9.2) — 100%', ratio: 1, base: 'o' },
  { key: 'ctsn', label: 'Công trình sự nghiệp tự chủ tài chính (Điều 9.2) — 60% đất ở', ratio: 0.6, base: 'o' },
  { key: 'congcong', label: 'Công cộng có mục đích kinh doanh: giao thông, thủy lợi, chợ… (Điều 9.3) — 60%', ratio: 0.6, base: 'o' },
  { key: 'matnuoc', label: 'Sông ngòi, mặt nước dùng phi nông nghiệp (Điều 9.4) — 60% đất ở', ratio: 0.6, base: 'o' },
  { key: 'pnnkhac', label: 'Phi nông nghiệp khác: kho nông sản, lán trại… (Điều 9.7) — 60%', ratio: 0.6, base: 'o' },
  { key: 'nghiadia', label: 'Nghĩa địa xen kẽ khu dân cư (Điều 9.8) — 60% (ngoài khu dân cư: dùng giá NN liền kề)', ratio: 0.6, base: 'o' },
  { key: 'nn_cln', label: 'Đất trồng cây lâu năm (Điều 7)', ratio: 1, base: 'nn' },
  { key: 'nn_chn', label: 'Đất trồng cây hàng năm / lúa (Điều 7)', ratio: 1, base: 'nn' },
  { key: 'nn_nts', label: 'Đất nuôi trồng thủy sản (Điều 7)', ratio: 1, base: 'nn' },
  { key: 'nn_rsx', label: 'Đất rừng sản xuất / phòng hộ / đặc dụng (Điều 7)', ratio: 1, base: 'nn' },
  { key: 'khac', label: 'Loại khác (nhập giá trực tiếp)', ratio: 1, base: 'o' },
];
const DC = [
  { key: 'none', label: 'Không có điều chỉnh', k: 1 },
  { key: 'vt1hem', label: '1 mặt đường (VT1) + 1 mặt hẻm — Điều 6.2 ×1,05', k: 1.05 },
  { key: 'mt2', label: '2 đường / 2 hẻm, hoặc 1 mặt giáp biển–sông>100m — Điều 6.1 ×1,1', k: 1.1 },
  { key: 'mt3', label: '2 đường+1 hẻm (hoặc 2 hẻm+1 đường), hoặc 2 mặt +giáp biển — Điều 6.1 ×1,15', k: 1.15 },
  { key: 'mt4', label: '3 mặt tiền trở lên, hoặc 3 mặt +giáp biển — Điều 6.1 ×1,2', k: 1.2 },
  { key: 'khuat', label: 'Phần đất bị che khuất sau mặt tiền, rộng ≥2m — Điều 6.4 ×0,7', k: 0.7 },
  { key: 'novao', label: 'Không ra đường trực tiếp: đường gom/mương>1m/đường ray — Điều 6.6 ×0,9', k: 0.9 },
  { key: 'hem', label: 'Hẻm VT2–5 chưa trải nhựa/bê tông — Điều 4.6 ×0,9', k: 0.9 },
  { key: 'xa200', label: 'VT2–5 cách đường phố >200m — Điều 4.5 ×0,9', k: 0.9 },
  { key: 'kmd', label: 'Phần sâu của thửa VT1 mặt tiền hẹp (Kmđ = R/D < 0,25) — Điều 4.5 ×0,9', k: 0.9 },
];
const BANDS = [
  { lo: 0, hi: 30, k: 1.0, label: '0–30m' },
  { lo: 30, hi: 60, k: 0.6, label: '>30–60m' },
  { lo: 60, hi: 100, k: 0.4, label: '>60–100m' },
  { lo: 100, hi: Infinity, k: 0.3, label: '>100m' },
];
const GHEP = [
  { key: 'gr_dothi', label: 'Đô thị — cùng trục chia đoạn, trong 20m (Điều 5.1) — trung bình 2 đoạn', fn: (a: number, b: number) => (a + b) / 2 },
  { key: 'gr_giao', label: 'Đô thị — 2 đường phố giao nhau, trong 20m (Điều 5.1) — giá thấp ×1,1 (≤ giá cao)', fn: (a: number, b: number) => Math.min(Math.min(a, b) * 1.1, Math.max(a, b)) },
  { key: 'gr_pxa', label: 'Giáp ranh phường ↔ xã, trong 100m (Điều 5.2) — trung bình cộng', fn: (a: number, b: number) => (a + b) / 2 },
  { key: 'gr_ventruc', label: 'Ven trục nông thôn — chia đoạn, trong 50m (Điều 5.3) — trung bình cộng', fn: (a: number, b: number) => (a + b) / 2 },
  { key: 'hai_mt', label: '2 mặt tiền (2 đường / 2 hẻm) — Điều 6.1 giá cao ×1,1', fn: (a: number, b: number) => Math.max(a, b) * 1.1 },
  { key: 'ba_mt', label: '2 đường+1 hẻm / 2 hẻm+1 đường, hoặc 2 mặt +giáp biển — Điều 6.1 ×1,15', fn: (a: number, b: number) => Math.max(a, b) * 1.15 },
  { key: 'bon_mt', label: '3 mặt tiền trở lên, hoặc +giáp biển — Điều 6.1 ×1,2', fn: (a: number, b: number) => Math.max(a, b) * 1.2 },
];
const KMBDTT_OPTS = [
  { v: 1.6, l: 'Xã Cam Lâm / Suối Dầu / Cam Hiệp / Cam An (Khu vực 1) — 1,6' },
  { v: 1.5, l: 'Phường Khu vực 1 (Nha Trang, Cam Ranh, Ninh Hòa…) — 1,5' },
  { v: 1.3, l: 'Xã Khu vực 2 (Ninh Phước, Bác Ái…) — 1,3' },
  { v: 1.2, l: 'Phường Khu vực 2 (Phan Rang, Đô Vinh…) — 1,2' },
];
const KQH_OPTS = [
  { v: 1.0, l: 'Hệ số sử dụng đất dưới 7 lần — 1,00' },
  { v: 1.05, l: 'Hệ số sử dụng đất 7 đến dưới 9 lần — 1,05' },
  { v: 1.1, l: 'Hệ số sử dụng đất 9 đến dưới 11 lần — 1,10' },
  { v: 1.15, l: 'Hệ số sử dụng đất 11 đến 13 lần — 1,15' },
];
const KYT_OPTS = [
  { v: 1.0, l: 'Không có yếu tố đặc biệt — 1,0' },
  { v: 1.5, l: 'Đất nông nghiệp cùng thửa có nhà ở (không phải đất ở) — 1,5' },
  { v: 1.3, l: 'Đất nông nghiệp vị trí 1 giáp Quốc lộ 1 / tỉnh lộ / đường liên xã / liên phường — 1,3' },
];
// Hạn mức giao đất ở (Điều 3 Quyết định 28/2024/QĐ-UBND Khánh Hòa)
const HANMUC = [
  { v: '400', l: 'Xã đồng bằng (Cam Lâm / Suối Dầu / Cam Hiệp / Cam An…) — 400 m²' },
  { v: '1000', l: 'Xã miền núi / hải đảo (Khánh Sơn, Khánh Vĩnh…) — 1.000 m²' },
  { v: '150', l: 'Phường (Nha Trang, Cam Ranh, Ninh Hòa) — 150 m²' },
  { v: '180', l: 'TT cũ Cam Đức / Diên Khánh / Vạn Ninh — 180 m²' },
  { v: '200', l: 'TT cũ Khánh Sơn, Khánh Vĩnh — 200 m²' },
];

const nf = new Intl.NumberFormat('vi-VN');
const fmt = (n: number | null | undefined) => (n == null ? '—' : nf.format(Math.round(n)));
const onlyDigits = (s: string) => s.replace(/\D/g, '');
const numDec = (s: string) => Number(String(s).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
const initials = (s: string) => norm(s).split(/\s+/).filter(Boolean).map((w) => (/^\d/.test(w) ? w : w[0])).join(''); // viết tắt: chữ đầu mỗi từ, GIỮ NGUYÊN từ bắt đầu bằng số (Bà Huyện Thanh Quan → bhtq; Quốc lộ 1A → ql1a)
function moneyVN(n: number): string {
  if (!isFinite(n) || n <= 0) return '0 đ';
  if (n >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' triệu';
  return nf.format(Math.round(n)) + ' đ';
}
const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0B4045]';
const lbl = 'text-xs font-bold text-slate-600';

export default function BangGiaSection() {
  const [picked, setPicked] = useState<{ price: number; label: string } | null>(null);
  return (
    <div className="space-y-4">
      <TraCuu onPick={(price, label) => setPicked({ price, label })} />
      <TinhGia picked={picked} />
    </div>
  );
}

function TraCuu({ onPick }: { onPick: (p: number, l: string) => void }) {
  const [xa, setXa] = useState(XA[0]);
  const [q, setQ] = useState('');
  const [kv, setKv] = useState('');
  const [sel, setSel] = useState('');
  const d = DB[xa];
  const diaBans = useMemo(() => Array.from(new Set(d.datO.map((r) => r.diaBan).filter(Boolean))) as string[], [d]);
  const rows = useMemo(() => {
    const nqns = norm(q.trim()).replace(/\s+/g, ''); // bỏ khoảng trắng: gõ liền "truongchinh" HOẶC viết tắt "tc" đều tra được
    const base = d.datO.filter((r) => {
      if (kv && r.diaBan !== kv) return false;
      if (!nqns) return true;
      const full = norm(`${r.duong || ''} ${r.tu || ''} ${r.den || ''} ${r.diaBan || ''}`).replace(/\s+/g, '');
      return full.includes(nqns) || initials(r.duong || '').includes(nqns); // khớp tên (không cần khoảng trắng) HOẶC viết tắt
    });
    if (!nqns) return base;
    // Ưu tiên: trùng khít (tên/viết tắt) → bắt đầu bằng → có chứa → chỉ khớp đoạn/địa bàn
    const score = (r: Row) => {
      const dn = norm(r.duong || '').replace(/\s+/g, ''); const ini = initials(r.duong || '');
      if (dn === nqns || ini === nqns) return 0;
      if (dn.startsWith(nqns) || ini.startsWith(nqns)) return 1;
      if (dn.includes(nqns) || ini.includes(nqns)) return 2;
      return 3;
    };
    return [...base].sort((a, b) => score(a) - score(b));
  }, [d, q, kv]);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-3 sm:p-5">
        <h3 className="font-extrabold text-[#0B4045] text-sm sm:text-lg">🔎 Bảng giá đất ở chính thức</h3>
        <p className="text-[13px] text-slate-500 mt-1">Theo NQ 15/2025 (đồng/m²). Chọn xã, gõ tên đường; <b>bấm ô giá (VT1–VT5)</b> để đưa xuống công cụ tính.</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {XA.map((x) => <button key={x} onClick={() => { setXa(x); setSel(''); setKv(''); }} className={`px-3 py-1.5 rounded-full text-[13px] font-bold ${xa === x ? 'bg-[#0B4045] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{x.replace('Xã ', '')}</button>)}
        </div>
        {diaBans.length > 0 && (
          <select value={kv} onChange={(e) => setKv(e.target.value)} className={`${inp} mt-2 bg-white`}>
            <option value="">🗺️ Tất cả khu vực / địa bàn</option>
            {diaBans.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Gõ tên đường / đoạn… (VD: Trường Chinh)" className={`${inp} mt-2.5`} />
        <div className="mt-2.5 rounded-xl border border-slate-200 overflow-hidden">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 z-10">
                <tr className="text-left"><th className="py-2 px-2 font-bold min-w-[150px]">Đường / Đoạn</th>{VTL.map((v) => <th key={v} className="py-2 px-1.5 font-bold text-right">{v}</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-slate-400">Không tìm thấy tuyến đường.</td></tr> :
                  rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 odd:bg-slate-50/40 align-top">
                      <td className="py-1.5 px-2">
                        <div className="font-semibold text-[#0B4045] leading-tight">{r.duong || <span className="text-slate-400 font-normal">(theo đoạn)</span>}</div>
                        {(r.tu || r.den) && <div className="text-[11px] text-slate-500 leading-tight">{r.tu || '—'} → {r.den || '—'}</div>}
                        {r.diaBan && <div className="text-[10px] text-slate-400">{r.diaBan}</div>}
                      </td>
                      {r.vt.map((v, ci) => {
                        if (v == null) return <td key={ci} className="py-1.5 px-1.5 text-right text-slate-300">—</td>;
                        const key = `${xa}|${i}|${ci}`; const on = sel === key;
                        return <td key={ci} className="p-0 text-right"><button onClick={() => { setSel(key); onPick(v, `${r.duong || 'Đoạn'} · ${VTL[ci]}`); }} title="Bấm để đưa giá xuống công cụ" className={`w-full px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap ${on ? 'bg-[#C8A14B] text-[#0B4045] font-extrabold' : 'text-[#0B4045] hover:bg-amber-50 font-semibold'}`}>{fmt(v)}</button></td>;
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">{d.xa}: {d.datO.length} tuyến/đoạn · hiện {rows.length}. Khu vực 1 = trung tâm; Khu vực 2 = còn lại (đã phản ánh trong giá từng tuyến).</p>
        <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 uppercase">Đất nông nghiệp — {d.xa} (đồng/m²)</div>
          <table className="w-full text-[13px]">
            <thead><tr className="text-slate-400 text-left text-[11px]"><th className="py-1.5 px-3 font-semibold">Loại đất</th><th className="py-1.5 px-3 font-semibold text-right">Vị trí 1</th><th className="py-1.5 px-3 font-semibold text-right">Vị trí 2</th></tr></thead>
            <tbody>
              {d.datNongNghiep.map((n, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1.5 px-3 text-slate-600">{n.loai}</td>
                  <td className="py-1.5 px-3 text-right"><button onClick={() => onPick(n.vt1 || 0, `${n.loai} · VT1`)} className="font-semibold text-[#0B4045] tabular-nums hover:text-[#C8A14B]">{fmt(n.vt1)}</button></td>
                  <td className="py-1.5 px-3 text-right"><button onClick={() => onPick(n.vt2 || 0, `${n.loai} · VT2`)} className="tabular-nums text-[#0B4045] hover:text-[#C8A14B]">{fmt(n.vt2)}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TinhGia({ picked }: { picked: { price: number; label: string } | null }) {
  const [mode, setMode] = useState<'gia' | 'chuyen'>('gia');
  const tab = (m: string) => `flex-1 py-3 ${mode === m ? 'text-[#0B4045] border-b-2 border-[#C8A14B]' : 'text-slate-400 hover:text-slate-600'}`;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex text-[13px] font-bold border-b border-slate-100 text-center">
        <button onClick={() => setMode('gia')} className={tab('gia')}>🧮 Định giá thửa</button>
        <button onClick={() => setMode('chuyen')} className={tab('chuyen')}>🔁 Tiền chuyển mục đích</button>
      </div>
      <div className="p-3 sm:p-5">{mode === 'gia' ? <DinhGia picked={picked} /> : <ChuyenMucDich picked={picked} />}</div>
    </div>
  );
}

type Item = { id: number; loai: string; giaStr: string; dc: string; depth: boolean; dtStr: string; wStr: string; dStr: string; note: string; yt: number };
let ITEM_ID = 1;
const newItem = (patch: Partial<Item> = {}): Item => ({ id: ITEM_ID++, loai: 'o', giaStr: '', dc: 'none', depth: false, dtStr: '', wStr: '', dStr: '', note: '', yt: 1, ...patch });
function itemCalc(it: Item) {
  const gia = Number(onlyDigits(it.giaStr)) || 0;
  const L = LOAI.find((x) => x.key === it.loai)!;
  const kdc = DC.find((x) => x.key === it.dc)!.k;
  const unit = gia * L.ratio * kdc;
  if (unit <= 0) return { area: 0, value: 0, unit: 0 };
  if (it.depth) {
    const w = numDec(it.wStr), d = numDec(it.dStr), area = w * d;
    if (area <= 0) return { area: 0, value: 0, unit };
    let val = 0;
    for (const b of BANDS) { const depth = Math.max(0, Math.min(d, b.hi) - b.lo); val += depth * w * unit * b.k; }
    return { area, value: val, unit: val / area };
  }
  const dt = numDec(it.dtStr);
  return { area: dt, value: unit * dt, unit };
}

function DinhGia({ picked }: { picked: { price: number; label: string } | null }) {
  const [items, setItems] = useState<Item[]>([newItem()]);
  const upd = (id: number, patch: Partial<Item>) => setItems((a) => a.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const del = (id: number) => setItems((a) => (a.length > 1 ? a.filter((it) => it.id !== id) : a));
  const add = (patch: Partial<Item> = {}) => setItems((a) => [...a, newItem(patch)]);
  const calc = useMemo(() => items.map((it) => ({ it, ...itemCalc(it) })), [items]);
  const total = calc.reduce((s, x) => s + x.value, 0);
  const totalArea = calc.reduce((s, x) => s + x.area, 0);
  const avg = totalArea > 0 ? total / totalArea : 0;
  // Bấm giá trong bảng → TỰ điền vào phần đất đang trống (hoặc thêm phần mới)
  const lastPicked = useRef(picked);
  useEffect(() => {
    if (picked && picked !== lastPicked.current) {
      const lb = picked.label;
      const loai = /hàng năm/.test(lb) ? 'nn_chn' : /lâu năm/.test(lb) ? 'nn_cln' : /thủy sản/.test(lb) ? 'nn_nts' : /rừng/.test(lb) ? 'nn_rsx' : 'o';
      setItems((a) => {
        const idx = a.findIndex((it) => !it.giaStr);
        if (idx >= 0) { const c = [...a]; c[idx] = { ...c[idx], giaStr: String(picked.price), note: picked.label, loai }; return c; }
        return [...a, newItem({ giaStr: String(picked.price), note: picked.label, loai })];
      });
    }
    lastPicked.current = picked;
  }, [picked]);

  // Giáp ranh / 2 mặt tiền (Điều 5–6) — công cụ phụ, ra 1 giá để thêm vào thửa
  const [grKieu, setGrKieu] = useState('gr_dothi');
  const [grA, setGrA] = useState(''); const [grB, setGrB] = useState('');
  const ga = Number(onlyDigits(grA)) || 0, gb = Number(onlyDigits(grB)) || 0;
  const grFn = GHEP.find((x) => x.key === grKieu)!;
  const grRes = ga > 0 && gb > 0 ? grFn.fn(ga, gb) : 0;

  // Hệ số K (QĐ 50/2026) — luôn hiện đầy đủ trong từng phần
  const useK = true;
  const [mbdtt, setMbdtt] = useState(1.6); const [qh, setQh] = useState(1);
  const totalK = calc.reduce((s, x) => { const b = LOAI.find((l) => l.key === x.it.loai)!.base; return s + x.value * mbdtt * qh * (b === 'nn' ? (x.it.yt || 1) : 1); }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-[#0B4045]">Các hạng mục đất trong thửa</span>
        <span className="text-[11px] text-slate-400 shrink-0">Nhiều loại đất? Thêm từng phần.</span>
      </div>
      {picked && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] text-emerald-800">✓ Đã điền <b>{fmt(picked.price)} đ/m²</b> · {picked.label} vào phần đất bên dưới. Bấm ô giá khác để thêm phần mới.</div>
      )}

      {/* Công cụ giáp ranh / 2 mặt tiền (Điều 5–6) — gộp thẳng vào đây */}
      <details className="rounded-xl border border-slate-200 overflow-hidden">
        <summary className="cursor-pointer list-none px-3 py-2 text-[13px] font-bold text-[#0B4045] bg-slate-50 flex items-center justify-between">🔗 Tính giá giáp ranh / 2 mặt tiền (Điều 5–6)<span className="text-[#C8A14B] text-[11px]">mở ▾</span></summary>
        <div className="p-3 space-y-2">
          <select value={grKieu} onChange={(e) => setGrKieu(e.target.value)} className={`${inp} bg-white`}>{GHEP.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <input value={grA ? nf.format(ga) : ''} onChange={(e) => setGrA(onlyDigits(e.target.value))} inputMode="numeric" placeholder="Giá A / đường 1" className={inp} />
            <input value={grB ? nf.format(gb) : ''} onChange={(e) => setGrB(onlyDigits(e.target.value))} inputMode="numeric" placeholder="Giá B / đường 2" className={inp} />
          </div>
          {grRes > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-[#0B4045] text-white px-3 py-2">
              <span className="text-[13px]">Giá áp dụng: <b className="text-[#C8A14B]">{fmt(grRes)} đ/m²</b></span>
              <button onClick={() => add({ giaStr: String(Math.round(grRes)), note: 'Giáp ranh/2MT', loai: 'o' })} className="ml-auto bg-[#C8A14B] text-[#0B4045] font-bold text-[11px] px-2.5 py-1 rounded-md">＋ Thêm phần</button>
            </div>
          )}
        </div>
      </details>

      {calc.map(({ it, value }, idx) => {
        const L = LOAI.find((x) => x.key === it.loai)!;
        return (
          <div key={it.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-[#C8A14B]">Phần {idx + 1}</span>
              {it.note && <span className="text-[10px] text-slate-400 truncate">· {it.note}</span>}
              <span className="ml-auto text-[12px] font-bold text-[#0B4045]">{moneyVN(value)}</span>
              {items.length > 1 && <button onClick={() => del(it.id)} className="text-red-400 hover:text-red-600 text-sm shrink-0">✕</button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block col-span-2"><span className={lbl}>Loại đất</span>
                <select value={it.loai} onChange={(e) => upd(it.id, { loai: e.target.value })} className={`${inp} mt-1 bg-white`}>{LOAI.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
              </label>
              <label className="block"><span className={lbl}>{L.base === 'nn' ? 'Đơn giá đất nông nghiệp' : L.ratio !== 1 ? 'Giá đất ở nền' : 'Đơn giá (đồng/m²)'}</span>
                <input value={it.giaStr ? nf.format(Number(onlyDigits(it.giaStr))) : ''} onChange={(e) => upd(it.id, { giaStr: onlyDigits(e.target.value) })} inputMode="numeric" placeholder="tra ở bảng trên" className={`${inp} mt-1 font-semibold`} />
              </label>
              <label className="block"><span className={lbl}>Điều chỉnh</span>
                <select value={it.dc} onChange={(e) => upd(it.id, { dc: e.target.value })} className={`${inp} mt-1 bg-white`}>{DC.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
              </label>
              {it.depth ? (
                <>
                  <label className="block"><span className={lbl}>Bề ngang (m)</span><input value={it.wStr} onChange={(e) => upd(it.id, { wStr: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" placeholder="VD: 5" className={`${inp} mt-1`} /></label>
                  <label className="block"><span className={lbl}>Chiều sâu (m)</span><input value={it.dStr} onChange={(e) => upd(it.id, { dStr: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" placeholder="VD: 40" className={`${inp} mt-1`} /></label>
                </>
              ) : (
                <label className="block col-span-2"><span className={lbl}>Diện tích (m²)</span><input value={it.dtStr} onChange={(e) => upd(it.id, { dtStr: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" placeholder="VD: 100" className={`${inp} mt-1`} /></label>
              )}
            </div>
            {L.base === 'o' && (
              <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer"><input type="checkbox" checked={it.depth} onChange={(e) => upd(it.id, { depth: e.target.checked })} className="w-3.5 h-3.5 accent-[#0B4045]" />Đất ở ven trục chính, chiều sâu lớn (Điều 4c): ≤30m ×1 · &gt;30–60 ×0,6 · &gt;60–100 ×0,4 · &gt;100 ×0,3</label>
            )}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-600">Giá trị sau hệ số điều chỉnh — phần này (bồi thường / đấu giá)</span>
                <span className="text-[12px] font-bold text-[#0B4045] shrink-0">= {moneyVN(value * mbdtt * qh * (L.base === 'nn' ? (it.yt || 1) : 1))}</span>
              </div>
              {L.base === 'nn' ? (
                <label className="block"><span className={lbl}>Hệ số yếu tố ảnh hưởng đến giá đất</span><select value={it.yt} onChange={(e) => upd(it.id, { yt: Number(e.target.value) })} className={`${inp} mt-1 bg-white`}>{KYT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
              ) : (
                <div className="text-[11px] text-slate-500">Hệ số yếu tố ảnh hưởng = 1,0 (đất phi nông nghiệp — cố định)</div>
              )}
            </div>
          </div>
        );
      })}
      <button onClick={() => add()} className="w-full border border-dashed border-slate-300 rounded-lg py-2 text-[13px] font-semibold text-slate-500 hover:text-[#0B4045] hover:border-[#0B4045]">＋ Thêm loại đất khác trong thửa</button>

      {total > 0 ? (
        <div className="rounded-xl bg-[#0B4045] text-white p-4">
          <div className="text-[12px] space-y-0.5 pb-3 mb-3 border-b border-white/10">
            {calc.filter((x) => x.value > 0).map(({ it, value }, i) => {
              const L = LOAI.find((x) => x.key === it.loai)!;
              const eyt = L.base === 'nn' ? (it.yt || 1) : 1;
              return <div key={i} className="flex justify-between gap-3"><span className="text-slate-300 truncate">Phần {i + 1} · {L.label.split(' (')[0]} · {nf.format(Math.round(itemCalc(it).area * 100) / 100)} m²</span><span className="font-semibold tabular-nums shrink-0">{moneyVN(value)}{useK && <span className="text-[#C8A14B]"> → {moneyVN(value * mbdtt * qh * eyt)}</span>}</span></div>;
            })}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><div className="text-[11px] uppercase tracking-wide text-slate-300">Tổng giá trị thửa · {nf.format(Math.round(totalArea * 100) / 100)} m²</div><div className="text-2xl font-extrabold text-[#C8A14B]">{moneyVN(total)}</div></div>
            <div className="text-right text-[11px] text-slate-300">Bình quân<br /><b className="text-white text-[13px]">{fmt(avg)} đ/m²</b></div>
          </div>
          {useK && (
            <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
              <p className="text-[11px] text-slate-300"><b className="text-white">Hệ số điều chỉnh giá đất</b> = Hệ số biến động thị trường × Hệ số quy hoạch × Hệ số yếu tố ảnh hưởng (nhập ở từng phần trên). <b className="text-[#C8A14B]">Nhiều yếu tố ảnh hưởng cùng áp cho một phần → lấy hệ số CAO NHẤT, không nhân dồn</b> (QĐ 50). Dùng khi bồi thường / đấu giá / dự án.</p>
              <label className="block"><span className="text-[11px] text-slate-300">Hệ số biến động thị trường (theo khu vực — chung cả thửa)</span><select value={mbdtt} onChange={(e) => setMbdtt(Number(e.target.value))} className={`${inp} mt-1 bg-white text-[#0B4045]`}>{KMBDTT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
              <label className="block"><span className="text-[11px] text-slate-300">Hệ số quy hoạch (chung cả thửa)</span><select value={qh} onChange={(e) => setQh(Number(e.target.value))} className={`${inp} mt-1 bg-white text-[#0B4045]`}>{KQH_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.08] border border-white/10 px-3 py-2">
                <span className="text-[13px] font-bold text-slate-100">Tổng sau hệ số điều chỉnh giá đất</span>
                <span className="text-xl font-extrabold text-[#C8A14B]">{moneyVN(totalK)}</span>
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-3">Giá theo Bảng giá Nhà nước — tính thuế, phí, tiền sử dụng đất; hệ số điều chỉnh chỉ dùng khi bồi thường / đấu giá / dự án.</p>
        </div>
      ) : <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-5 text-center text-sm text-slate-400">Nhập loại đất, đơn giá (tra ở bảng) và diện tích để tính.</div>}
    </div>
  );
}

function ChuyenMucDich({ picked }: { picked: { price: number; label: string } | null }) {
  const [oStr, setOStr] = useState('');
  const [nStr, setNStr] = useState('');
  const [hmStr, setHmStr] = useState('400');
  const [hmKV, setHmKV] = useState('400');
  const [dtStr, setDtStr] = useState('');
  const [nguon, setNguon] = useState('vuonao');
  const [lan, setLan] = useState('dau');
  const [grK, setGrK] = useState('gr_dothi');
  const [grA, setGrA] = useState('');
  const [grB, setGrB] = useState('');
  const [mbdtt, setMbdtt] = useState(1.6);
  const [qh, setQh] = useState(1);
  const [yt, setYt] = useState(1);
  const gO = Number(onlyDigits(oStr)) || 0, gN = Number(onlyDigits(nStr)) || 0;
  const H = numDec(hmStr), A = numDec(dtStr);
  const ga = Number(onlyDigits(grA)) || 0, gb = Number(onlyDigits(grB)) || 0;
  const grFn = GHEP.find((x) => x.key === grK)!;
  const grRes = ga > 0 && gb > 0 ? grFn.fn(ga, gb) : 0;
  const K = mbdtt * qh * yt;
  const r = useMemo(() => {
    if (gO <= 0 || A <= 0) return null;
    const diff = Math.max(gO - gN, 0);
    let rows: { label: string; area: number; rate: number }[];
    if (nguon === 'nnkhac' || lan === 'sau') {
      rows = [{ label: nguon === 'nnkhac' ? 'Toàn bộ (đất nông nghiệp khác)' : 'Toàn bộ (lần 2 trở đi)', area: A, rate: 1.0 }];
    } else {
      const b1 = H > 0 ? Math.min(A, H) : A;
      const b2 = H > 0 ? Math.min(Math.max(A - H, 0), H) : 0;
      const b3 = H > 0 ? Math.max(A - 2 * H, 0) : 0;
      rows = [{ label: 'Trong hạn mức', area: b1, rate: 0.3 }, { label: 'Vượt ≤ 1 lần hạn mức', area: b2, rate: 0.5 }, { label: 'Vượt > 1 lần hạn mức', area: b3, rate: 1.0 }];
    }
    const rr = rows.filter((x) => x.area > 0).map((x) => ({ ...x, value: diff * x.area * x.rate }));
    return { diff, total: rr.reduce((s, x) => s + x.value, 0), rows: rr };
  }, [gO, gN, H, A, lan, nguon]);
  return (
    <div>
      <p className="text-[13px] text-slate-500">Tiền sử dụng đất khi chuyển từ nông nghiệp / vườn ao sang <b>đất ở</b>: Tiền nộp = (giá đất ở − giá đất nông nghiệp) × diện tích × tỷ lệ thu.</p>
      {picked && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] mt-2">
          <span className="min-w-0 flex-1 truncate text-amber-900">Giá vừa chọn: <b>{fmt(picked.price)} đ/m²</b> · {picked.label}</span>
          <button onClick={() => setOStr(String(picked.price))} className="shrink-0 bg-[#0B4045] text-white font-bold text-[11px] px-2 py-1 rounded-md">→ Đất ở</button>
          <button onClick={() => setNStr(String(picked.price))} className="shrink-0 bg-slate-600 text-white font-bold text-[11px] px-2 py-1 rounded-md">→ Đất nông nghiệp</button>
        </div>
      )}
      <details className="mt-2 rounded-xl border border-slate-200 overflow-hidden">
        <summary className="cursor-pointer list-none px-3 py-2 text-[13px] font-bold text-[#0B4045] bg-slate-50 flex items-center justify-between">🔗 Tính giá đất ở giáp ranh / 2 mặt tiền (Điều 5–6)<span className="text-[#C8A14B] text-[11px]">mở ▾</span></summary>
        <div className="p-3 space-y-2">
          <select value={grK} onChange={(e) => setGrK(e.target.value)} className={`${inp} bg-white`}>{GHEP.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <input value={grA ? nf.format(ga) : ''} onChange={(e) => setGrA(onlyDigits(e.target.value))} inputMode="numeric" placeholder="Giá A / đường 1" className={inp} />
            <input value={grB ? nf.format(gb) : ''} onChange={(e) => setGrB(onlyDigits(e.target.value))} inputMode="numeric" placeholder="Giá B / đường 2" className={inp} />
          </div>
          {grRes > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-[#0B4045] text-white px-3 py-2">
              <span className="text-[13px]">Giá đất ở: <b className="text-[#C8A14B]">{fmt(grRes)} đ/m²</b></span>
              <button onClick={() => setOStr(String(Math.round(grRes)))} className="ml-auto bg-[#C8A14B] text-[#0B4045] font-bold text-[11px] px-2.5 py-1 rounded-md">→ Dùng làm giá đất ở</button>
            </div>
          )}
        </div>
      </details>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <label className="block"><span className={lbl}>Giá đất Ở (đồng/m²) *</span><input value={oStr ? nf.format(gO) : ''} onChange={(e) => setOStr(onlyDigits(e.target.value))} inputMode="numeric" placeholder="tra ở bảng trên" className={`${inp} mt-1 font-semibold`} /></label>
        <label className="block"><span className={lbl}>Giá đất nông nghiệp (đồng/m²) *</span><input value={nStr ? nf.format(gN) : ''} onChange={(e) => setNStr(onlyDigits(e.target.value))} inputMode="numeric" placeholder="VD: 54.000" className={`${inp} mt-1`} /></label>
        <label className="block"><span className={lbl}>Hạn mức giao đất ở (m²)</span><input value={hmStr} onChange={(e) => setHmStr(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="VD: 200" className={`${inp} mt-1`} /></label>
        <label className="block"><span className={lbl}>Diện tích chuyển (m²) *</span><input value={dtStr} onChange={(e) => setDtStr(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="VD: 300" className={`${inp} mt-1`} /></label>
      </div>
      <label className="block mt-3"><span className={lbl}>Khu vực — tự điền hạn mức giao đất ở (QĐ 28/2024)</span>
        <select value={hmKV} onChange={(e) => { setHmKV(e.target.value); setHmStr(e.target.value); }} className={`${inp} mt-1 bg-white`}>{HANMUC.map((h) => <option key={h.v} value={h.v}>{h.l}</option>)}</select>
      </label>
      <label className="block mt-2"><span className={lbl}>Nguồn gốc đất chuyển</span>
        <select value={nguon} onChange={(e) => setNguon(e.target.value)} className={`${inp} mt-1 bg-white`}>
          <option value="vuonao">Đất vườn, ao trong thửa có nhà ở / nguồn gốc vườn ao liền kề</option>
          <option value="nnkhac">Đất nông nghiệp khác (thuần nông nghiệp)</option>
        </select>
      </label>
      {nguon === 'vuonao' && (
        <label className="block mt-2"><span className={lbl}>Lần chuyển mục đích</span>
          <select value={lan} onChange={(e) => setLan(e.target.value)} className={`${inp} mt-1 bg-white`}>
            <option value="dau">Lần thứ nhất — thu 30/50/100% theo hạn mức</option>
            <option value="sau">Đã từng hưởng ưu đãi (thửa này / thửa khác) — 100% toàn bộ</option>
          </select>
        </label>
      )}
      <p className="text-[11px] text-slate-400 mt-2">Mức thu <b>30/50/100%</b> (30% trong hạn mức · 50% vượt ≤1 lần · 100% vượt &gt;1 lần) chỉ áp cho <b>đất vườn, ao trong thửa có nhà ở / nguồn gốc vườn ao liền kề</b>, và <b>chỉ 1 lần duy nhất cho mỗi hộ</b> trên 1 thửa tự chọn (kể cả có nhiều thửa ở nhiều tỉnh) — NQ 254/2025/QH15 &amp; NĐ 50/2026/NĐ-CP, hiệu lực 31/01/2026. Đất nông nghiệp khác hoặc đã hưởng ưu đãi: thu <b>100% chênh lệch</b>. Số nộp thực tế do cơ quan thuế quyết định.</p>
      {r ? (
        <div className="mt-3 rounded-xl bg-[#0B4045] text-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-300">Tiền sử dụng đất phải nộp (ước tính)</div>
          <div className="text-2xl font-extrabold text-[#C8A14B]">{moneyVN(r.total)}</div>
          <div className="text-[11px] text-slate-300">Chênh lệch giá: {fmt(r.diff)} đ/m²</div>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-[12px]"><thead><tr className="text-slate-300 text-left"><th className="py-1 pr-2">Phần diện tích</th><th className="py-1 px-2 text-right">DT (m²)</th><th className="py-1 px-2 text-right">Tỷ lệ</th><th className="py-1 pl-2 text-right">Thành tiền</th></tr></thead><tbody>
            {r.rows.map((x, i) => <tr key={i} className="border-t border-white/10"><td className="py-1 pr-2">{x.label}</td><td className="py-1 px-2 text-right">{nf.format(Math.round(x.area * 100) / 100)}</td><td className="py-1 px-2 text-right">{Math.round(x.rate * 100)}%</td><td className="py-1 pl-2 text-right font-semibold text-[#C8A14B]">{moneyVN(x.value)}</td></tr>)}
          </tbody></table></div>
          <details className="mt-3 rounded-lg bg-white/[0.06] border border-white/10">
            <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-bold flex items-center justify-between">📊 Áp hệ số điều chỉnh giá đất (QĐ 50/2026) — dự án / ngoài hạn mức<span className="text-[#C8A14B] text-[11px]">mở ▾</span></summary>
            <div className="p-3 pt-1 space-y-2">
              <p className="text-[11px] text-slate-300">Hộ gia đình trong hạn mức thường hệ số = 1. Áp cho dự án / thu hồi / đấu giá. Hệ số điều chỉnh giá đất = Hệ số biến động thị trường × Hệ số quy hoạch × Hệ số yếu tố ảnh hưởng (3 ô chọn dưới đây theo thứ tự).</p>
              <select value={mbdtt} onChange={(e) => setMbdtt(Number(e.target.value))} className={`${inp} bg-white text-[#0B4045]`}>{KMBDTT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
              <select value={qh} onChange={(e) => setQh(Number(e.target.value))} className={`${inp} bg-white text-[#0B4045]`}>{KQH_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
              <select value={yt} onChange={(e) => setYt(Number(e.target.value))} className={`${inp} bg-white text-[#0B4045]`}>{KYT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
              <div className="flex items-center justify-between border-t border-white/10 pt-2"><span className="text-[12px] text-slate-300">Tiền nộp sau hệ số điều chỉnh (× {K.toLocaleString('vi-VN', { maximumFractionDigits: 3 })})</span><span className="text-lg font-extrabold text-[#C8A14B]">{moneyVN(r.total * K)}</span></div>
            </div>
          </details>
          <p className="text-[11px] text-slate-300 mt-3">Ước tính theo NQ 254/2025/QH15 &amp; NĐ 50/2026/NĐ-CP. Số nộp thực tế do cơ quan thuế xác định.</p>
        </div>
      ) : <div className="mt-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">Nhập giá đất ở, giá đất nông nghiệp và diện tích để tính.</div>}
    </div>
  );
}
