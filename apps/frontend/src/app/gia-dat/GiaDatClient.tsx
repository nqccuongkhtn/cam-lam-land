'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { formatVnd, PROPERTY_LABELS, type PropertyType } from '@/lib/types';

interface Area { ward: string; count: number; medPerM2: number; minPerM2: number; maxPerM2: number }
const TYPES: ('' | PropertyType)[] = ['', 'land', 'house', 'apartment', 'villa', 'commercial', 'farm'];
const perM2 = (v: number) => (v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr/m²' : Math.round(v / 1e3) + ' N/m²');

export default function GiaDatClient() {
  const [type, setType] = useState<'' | PropertyType>('');
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [ward, setWard] = useState('');
  const [dt, setDt] = useState('');

  useEffect(() => {
    setLoading(true);
    api<{ areas: Area[] }>(`/listings/gia-khu-vuc${type ? '?type=' + type : ''}`)
      .then((r) => setAreas((r.areas || []).filter((a) => a.medPerM2 > 0)))
      .catch(() => setAreas([]))
      .finally(() => setLoading(false));
  }, [type]);

  const sorted = useMemo(() => [...areas].sort((a, b) => b.medPerM2 - a.medPerM2), [areas]);
  const maxMed = sorted[0]?.medPerM2 || 1;
  const sel = areas.find((a) => a.ward === ward);
  const dtNum = parseFloat(dt.replace(',', '.')) || 0;
  const est = sel && dtNum > 0 ? { mid: sel.medPerM2 * dtNum, lo: sel.minPerM2 * dtNum, hi: sel.maxPerM2 * dtNum } : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-extrabold text-[#0A2540]">Giá đất khu vực Cam Lâm</h1>
      <p className="text-slate-600 mt-2 mb-5 max-w-2xl">Giá <b>tham khảo</b> (trung vị) tính từ các tin đang rao trên Cam Lâm Land theo từng xã. Đây <b>không phải giá đất nhà nước</b> mà là mặt bằng rao bán thực tế để bạn ước lượng nhanh.</p>

      {/* Lọc loại BĐS */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TYPES.map((t) => (
          <button key={t || 'all'} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${type === t ? 'bg-[#0A2540] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {t === '' ? 'Tất cả' : PROPERTY_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Định giá nhanh */}
      <div className="bg-[#0A2540] text-white rounded-2xl p-5 mb-6">
        <h2 className="font-extrabold text-lg mb-1">⚡ Định giá nhanh</h2>
        <p className="text-white/70 text-sm mb-3">Chọn khu vực + nhập diện tích để ước lượng giá trị theo mặt bằng rao bán.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <select value={ward} onChange={(e) => setWard(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none">
            <option value="">— Chọn xã/khu vực —</option>
            {sorted.map((a) => <option key={a.ward} value={a.ward}>{a.ward} ({a.count} tin)</option>)}
          </select>
          <input value={dt} onChange={(e) => setDt(e.target.value)} inputMode="decimal" placeholder="Diện tích (m²)" className="rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none" />
        </div>
        {est ? (
          <div className="mt-3 bg-white/10 rounded-xl p-3">
            <p className="text-sm text-white/80">Giá trị ước tính ({sel!.ward}, {dtNum} m²):</p>
            <p className="text-2xl font-extrabold text-[#FFD56A]">≈ {formatVnd(est.mid)}</p>
            <p className="text-xs text-white/60 mt-0.5">Khoảng rao trong xã: {formatVnd(est.lo)} – {formatVnd(est.hi)} · trung vị {perM2(sel!.medPerM2)}</p>
          </div>
        ) : (
          <p className="text-xs text-white/50 mt-2">{ward && !sel ? 'Khu vực này chưa đủ dữ liệu tin đăng.' : 'Nhập khu vực + diện tích để xem ước tính.'}</p>
        )}
      </div>

      {/* Bảng giá theo khu vực */}
      <h2 className="font-bold text-[#0A2540] mb-2">Giá trung vị theo khu vực {type && <span className="text-slate-400 font-normal">· {PROPERTY_LABELS[type as PropertyType]}</span>}</h2>
      {loading ? (
        <p className="text-slate-400 text-sm py-8 text-center">Đang tải…</p>
      ) : sorted.length === 0 ? (
        <p className="text-slate-400 text-sm py-8 text-center bg-white border border-dashed border-slate-300 rounded-2xl">Chưa đủ dữ liệu tin đăng để tính giá khu vực.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((a) => (
            <div key={a.ward} className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-[#0A2540]">{a.ward}</span>
                <span className="font-extrabold text-[#C8A14B]">{perM2(a.medPerM2)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#C8A14B] to-[#e0c479] rounded-full" style={{ width: Math.max(6, Math.round((a.medPerM2 / maxMed) * 100)) + '%' }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{a.count} tin · khoảng {perM2(a.minPerM2)} – {perM2(a.maxPerM2)}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[12px] text-slate-400 mt-6">Số liệu tính tự động từ tin đang rao, chỉ mang tính tham khảo và phụ thuộc số lượng tin. Không thay thế thẩm định giá chuyên nghiệp.</p>
    </div>
  );
}
