'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import ServicesSection from '@/components/ServicesSection';
import LegalConsultCTA from '@/components/LegalConsultCTA';
import { NEW_XA, CODE2COMMUNE, SHEET_MAP, type NewXa } from '@/lib/traSoBanDo';

const fieldCls = 'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0B4045]';
const chev = { backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23334155' stroke-width='2'><path d='M4 6l4 4 4-4'/></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', appearance: 'none' as const, paddingRight: '30px' };

const ACCENT: Record<string, string> = { 'Cam Lâm': 'bg-[#0B4045]', 'Suối Dầu': 'bg-[#0B4045]', 'Cam Hiệp': 'bg-[#0B4045]', 'Cam An': 'bg-[#0B4045]' };
// Nút của segmented control CHỌN XÃ (4 xã mới) — bấm xã nào hiện bảng tra của xã đó.
const seg = (on: boolean) => `flex-1 px-2 py-2 rounded-md text-[12px] sm:text-sm font-bold transition ${on ? 'bg-white text-[#0B4045] shadow-sm' : 'text-slate-500 hover:text-[#0B4045]'}`;

function Result({ state }: { state: null | 'none' | string }) {
  const base = 'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 min-w-[132px] text-center';
  if (state === null) return <span className={`${base} bg-slate-50 text-sm text-slate-300`}>Kết quả</span>;
  if (state === 'none') return <span className={`${base} bg-amber-50 text-xs font-semibold text-amber-700`}>Không có</span>;
  return <span className={`${base} bg-emerald-50 text-sm font-extrabold text-emerald-700`}>{state}</span>;
}

function XaCard({ xa }: { xa: NewXa }) {
  const oldComs = useMemo(() => {
    const codes = Array.from(new Set(SHEET_MAP[xa].map((r) => r[1])));
    return codes.map((c) => ({ code: c, name: CODE2COMMUNE[c] || c })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [xa]);
  const [code, setCode] = useState(oldComs[0]?.code || '');
  const [oldRaw, setOldRaw] = useState(''); // GIỮ nguyên chuỗi đã gõ (cho phép gõ cả số lẫn mã), tách số/mã khi tính
  const [newNum, setNewNum] = useState('');

  // Ô nhập THÔNG MINH: gõ số thường (34) dùng dropdown; gõ kèm mã (34 CHĐ / 34chđ) tự nhảy dropdown sang xã cũ tương ứng.
  const onOldInput = (raw: string) => {
    setOldRaw(raw);
    const letters = (raw.match(/[A-Za-zĐđ]+/) || [])[0];
    if (letters) { const f = oldComs.find((o) => o.code.toUpperCase() === letters.toUpperCase()); if (f) setCode(f.code); }
  };

  const old2new = useMemo<null | 'none' | string>(() => {
    const n = parseInt((oldRaw.match(/\d+/) || [])[0] || '', 10); if (!n || !code) return null;
    const hits = Array.from(new Set(SHEET_MAP[xa].filter((r) => r[1] === code && r[2] === n).map((r) => r[0])));
    return hits.length ? 'Tờ ' + hits.join(', ') : 'none';
  }, [xa, code, oldRaw]);

  const new2old = useMemo<null | 'none' | string>(() => {
    const n = parseInt(newNum, 10); if (!newNum.trim() || !n) return null;
    const hits = Array.from(new Set(SHEET_MAP[xa].filter((r) => r[0] === n).map((r) => `${r[2]} ${r[1]}`)));
    return hits.length ? hits.join('  •  ') : 'none';
  }, [xa, newNum]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-center gap-2 px-4 py-2.5 text-[15px] font-extrabold text-white ${ACCENT[xa] || 'bg-[#0B4045]'} !py-2`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 20l-5.5 2.5V6L9 3.5m0 16.5 6-2.5M9 20V3.5m6 14 5.5 2.5V6L15 3.5m0 14V3.5m0 0L9 6" /></svg>
        Xã {xa}
      </div>
      <div className="divide-y divide-slate-100">
        {/* Chiều 1: xã cũ → số tờ mới (dropdown + ô nhập thông minh) */}
        <div className="px-3 sm:px-4 py-2.5">
          <p className="mb-1.5 text-[12px] font-semibold text-slate-500">Tìm theo <b className="text-rose-600">xã cũ</b> → số tờ <b className="text-emerald-600">mới</b></p>
          <div className="flex flex-wrap items-center gap-1.5">
            <input aria-label="Số tờ cũ" value={oldRaw} onChange={(e) => onOldInput(e.target.value)} placeholder="Số tờ / mã" className={`${fieldCls} min-w-[96px] flex-1`} />
            <select aria-label="Xã cũ" value={code} onChange={(e) => { setCode(e.target.value); setOldRaw((v) => (v.match(/\d+/) || [''])[0]); }} className={`${fieldCls} w-full shrink-0 sm:w-56`} style={chev}>{oldComs.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}</select>
            <span className="shrink-0 text-slate-300">→</span>
            <Result state={old2new} />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Mẹo: gõ kèm mã (VD <b>34 CHĐ</b>) sẽ tự chọn xã cũ giúp bạn.</p>
        </div>
        {/* Chiều 2: xã mới → số tờ cũ */}
        <div className="px-3 sm:px-4 py-2.5">
          <p className="mb-1.5 text-[12px] font-semibold text-slate-500">Tìm theo <b className="text-sky-600">xã mới</b> → số tờ <b className="text-slate-700">cũ</b></p>
          <div className="flex items-center gap-1.5">
            <input aria-label="Số tờ mới" value={newNum} onChange={(e) => setNewNum(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Số tờ mới" className={`${fieldCls} min-w-0 flex-1`} />
            <span className="shrink-0 text-slate-300">→</span>
            <Result state={new2old} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TraSoBanDoPage() {
  const [xa, setXa] = useState<NewXa>(NEW_XA[0]);
  return (
    <>
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-5 sm:py-6">
      <div className="mb-3 text-xs text-slate-400"><Link href="/" className="hover:text-[#0B4045]">Trang chủ</Link> › <span className="text-slate-600">Tra số tờ bản đồ</span></div>
      <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B4045]">🗺️ Tra cứu số tờ bản đồ Cam Lâm <span className="text-[#C8A14B]">(cũ ↔ mới)</span></h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
        Từ <b>01/7/2025</b>, huyện Cam Lâm sáp nhập <b>14 xã/thị trấn cũ</b> thành <b>4 xã mới</b>. Chọn <b>xã mới</b> bên dưới rồi tra số tờ theo 2 chiều (cũ ↔ mới) — hoặc gõ nhanh cả mã như <b>34 CHĐ</b>, hệ thống tự chọn xã cũ và ra số tờ mới ngay.
      </p>

      {/* Segmented control CHỌN XÃ MỚI (4 xã) — bấm xã nào xem bảng tra của xã đó */}
      <div className="mt-4 flex gap-1 bg-slate-100 p-1 rounded-xl">
        {NEW_XA.map((x) => <button key={x} onClick={() => setXa(x)} className={seg(xa === x)}>{x}</button>)}
      </div>
      <div className="mt-3">
        <XaCard key={xa} xa={xa} />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
        Dữ liệu đối chiếu số tờ theo bảng tra của địa phương, mang tính <b>tham khảo</b>. Trước khi làm thủ tục, vui lòng đối chiếu với Văn phòng Đăng ký đất đai / cơ quan có thẩm quyền. Sáp nhập theo Nghị quyết 1667/NQ-UBTVQH15 (hiệu lực 01/7/2025).
      </p>

    </div>
    <div className="mx-auto max-w-7xl px-3 sm:px-6 pb-6 sm:pb-8">
      <ServicesSection className="mt-6 sm:mt-8" />
      <LegalConsultCTA topic="Dịch vụ pháp lý (từ Tra cứu số tờ bản đồ)" className="mt-4" />
    </div>
    </>
  );
}
