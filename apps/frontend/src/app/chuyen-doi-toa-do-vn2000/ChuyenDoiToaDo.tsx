'use client';
import { useMemo, useState } from 'react';
import { vn2000ToWgs84, wgs84ToVn2000 } from '@/lib/vn2000';

// CÔNG CỤ CHUYỂN TOẠ ĐỘ VN-2000 ↔ WGS84 (13/10/2026) — trang đích SEO "chuyển tọa độ VN2000 sang WGS84" (học từ qhviet.com, nhưng
// công cụ CHẠY THẬT trên trang, không cần đăng nhập). Tính ngay trên máy người dùng bằng lib/vn2000.ts (Khánh Hòa: kinh tuyến trục
// 108°15′, múi 3°, k = 0,9999, 7 tham số chuẩn) — không gửi toạ độ đi đâu.

// Sổ đỏ ghi X = hướng BẮC (~1,3 triệu m ở Khánh Hòa), Y = hướng ĐÔNG (~600 nghìn m). Người dán hay đảo cột → tự nhận theo độ lớn.
const LA_X = (v: number) => v > 900_000 && v < 2_700_000;
const LA_Y = (v: number) => v > 100_000 && v < 900_000;

/** Đọc một con số kiểu Việt Nam lẫn kiểu Anh: "1333903.23", "1.333.903,23", "598227,84". */
function docSo(t: string): number {
  let s = t;
  const cham = s.lastIndexOf('.'), phay = s.lastIndexOf(',');
  if (cham >= 0 && phay >= 0) {
    s = cham > phay ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (phay >= 0) {
    s = (s.match(/,/g) || []).length === 1 && s.length - phay - 1 <= 3 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  return parseFloat(s);
}
// "1333903.23,598227.84" (thập phân bằng chấm, hai số cách nhau dấu phẩy) → dấu phẩy là dấu ngăn, không phải phần thập phân.
const soTrongDong = (dong: string) => {
  const d = dong.replace(/ /g, ' ');
  const kieuViet = /\d{1,3}(?:\.\d{3})+,\d/.test(d);   // "1.333.903,23": chấm phân nghìn + phẩy thập phân → giữ nguyên
  const chuan = !kieuViet && /\d\.\d+,\s*\d/.test(d) ? d.replace(/,/g, ' ') : d;
  return (chuan.match(/-?\d[\d.,]*\d|\d/g) || []).map(docSo).filter((v) => Number.isFinite(v));
};

type DiemVn = { ten: string; x: number; y: number; lat: number; lng: number };
function docVn2000(chu: string): { ds: DiemVn[]; loi: string[] } {
  const ds: DiemVn[] = [], loi: string[] = [];
  chu.split(/\r?\n/).forEach((dong, i) => {
    if (!dong.trim()) return;
    const so = soTrongDong(dong);
    let k = -1;
    for (let j = so.length - 2; j >= 0; j--) if ((LA_X(so[j]) && LA_Y(so[j + 1])) || (LA_Y(so[j]) && LA_X(so[j + 1]))) { k = j; break; }
    if (k < 0) { loi.push(`Dòng ${i + 1}: không thấy cặp X, Y hợp lệ`); return; }
    const x = LA_X(so[k]) ? so[k] : so[k + 1], y = LA_X(so[k]) ? so[k + 1] : so[k];
    const ten = k > 0 && so[0] >= 0 && so[0] < 100000 && Number.isInteger(so[0]) ? String(so[0]) : String(ds.length + 1);
    const w = vn2000ToWgs84(y, x);
    ds.push({ ten, x, y, lat: w.lat, lng: w.lng });
  });
  return { ds, loi };
}

type DiemWgs = { ten: string; lat: number; lng: number; x: number; y: number };
function docWgs84(chu: string): { ds: DiemWgs[]; loi: string[] } {
  const ds: DiemWgs[] = [], loi: string[] = [];
  chu.split(/\r?\n/).forEach((dong, i) => {
    if (!dong.trim()) return;
    const so = (dong.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const lat = so.find((v) => v > 5 && v < 25), lng = so.find((v) => v > 100 && v < 112);
    if (lat === undefined || lng === undefined) { loi.push(`Dòng ${i + 1}: cần vĩ độ (khoảng 11–13) và kinh độ (khoảng 108–110)`); return; }
    const v = wgs84ToVn2000(lng, lat);
    ds.push({ ten: String(ds.length + 1), lat, lng, x: v.y, y: v.x });
  });
  return { ds, loi };
}

const f2 = (v: number) => v.toFixed(2);
const f7 = (v: number) => v.toFixed(7);
const ggMap = (lat: number, lng: number) => `https://www.google.com/maps?q=${f7(lat)},${f7(lng)}`;

// Ví dụ: một lô ~518 m² ở trung tâm xã Cam Lâm (thị trấn Cam Đức cũ) — chỉ để xem công cụ chạy thế nào.
const VI_DU_VN = `1  1333903.23  598227.84
2  1333903.23  598247.99
3  1333877.83  598248.46
4  1333877.37  598228.22`;
const VI_DU_WGS = '12.0603500, 109.1540200';

export default function ChuyenDoiToaDo() {
  const [chieu, setChieu] = useState<'vn' | 'wgs'>('vn');
  const [chuVn, setChuVn] = useState(VI_DU_VN);
  const [chuWgs, setChuWgs] = useState(VI_DU_WGS);
  const [daChep, setDaChep] = useState(false);

  const kqVn = useMemo(() => docVn2000(chuVn), [chuVn]);
  const kqWgs = useMemo(() => docWgs84(chuWgs), [chuWgs]);

  // Diện tích + chu vi tính THẲNG trên mặt phẳng VN-2000 (đúng cách sổ đỏ đo) — để đối chiếu với diện tích ghi trên sổ.
  const hinh = useMemo(() => {
    const p = kqVn.ds;
    if (p.length < 3) return null;
    let a = 0, cv = 0;
    const canh: number[] = [];
    for (let i = 0; i < p.length; i++) {
      const u = p[i], v = p[(i + 1) % p.length];
      a += u.y * v.x - v.y * u.x;
      const d = Math.hypot(v.x - u.x, v.y - u.y);
      canh.push(d); cv += d;
    }
    const lat = p.reduce((s, q) => s + q.lat, 0) / p.length, lng = p.reduce((s, q) => s + q.lng, 0) / p.length;
    return { dienTich: Math.abs(a) / 2, chuVi: cv, canh, lat, lng };
  }, [kqVn]);

  async function chep() {
    const dong = chieu === 'vn'
      ? ['Điểm\tX (m)\tY (m)\tVĩ độ\tKinh độ', ...kqVn.ds.map((d) => `${d.ten}\t${f2(d.x)}\t${f2(d.y)}\t${f7(d.lat)}\t${f7(d.lng)}`)]
      : ['Điểm\tVĩ độ\tKinh độ\tX (m)\tY (m)', ...kqWgs.ds.map((d) => `${d.ten}\t${f7(d.lat)}\t${f7(d.lng)}\t${f2(d.x)}\t${f2(d.y)}`)];
    try { await navigator.clipboard.writeText(dong.join('\n')); setDaChep(true); setTimeout(() => setDaChep(false), 1800); } catch { /* trình duyệt chặn chép */ }
  }

  const o = 'w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[15px] leading-relaxed outline-none focus:border-[#0A2540]';
  const th = 'py-1.5 pr-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500';
  const td = 'py-1.5 pr-2 font-mono text-[13px] text-slate-700';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-[13.5px] font-bold">
        {([['vn', 'VN-2000 → WGS84'], ['wgs', 'WGS84 → VN-2000']] as const).map(([k, nhan]) => (
          <button key={k} type="button" role="tab" aria-selected={chieu === k} onClick={() => setChieu(k)}
            className={`rounded-md py-2 ${chieu === k ? 'bg-white text-[#0A2540] shadow-sm' : 'text-slate-500'}`}>{nhan}</button>
        ))}
      </div>

      {chieu === 'vn' ? (
        <>
          <label htmlFor="o-vn2000" className="mt-3 block text-[13px] font-semibold text-slate-700">Dán bảng tọa độ trên sổ đỏ — mỗi dòng một điểm: số hiệu điểm, X, Y</label>
          <textarea id="o-vn2000" value={chuVn} onChange={(e) => setChuVn(e.target.value)} rows={6} spellCheck={false} className={`${o} mt-1`} />
          <p className="mt-1 text-[12px] leading-snug text-slate-500">Đang có sẵn <b>ví dụ</b> một lô ở trung tâm xã Cam Lâm — xoá đi rồi dán tọa độ của bạn. Dấu chấm hay dấu phẩy thập phân đều được, đảo cột X/Y cũng tự nhận.</p>
          {kqVn.loi.length > 0 && <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[12.5px] text-amber-800">{kqVn.loi.join(' · ')}</p>}
          {kqVn.ds.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full [font-variant-numeric:tabular-nums]">
                <thead><tr className="border-b border-slate-200"><th className={th}>Điểm</th><th className={th}>Vĩ độ</th><th className={th}>Kinh độ</th><th className={th}><span className="sr-only">Google Maps</span></th></tr></thead>
                <tbody>
                  {kqVn.ds.map((d, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className={td}>{d.ten}</td><td className={td}>{f7(d.lat)}</td><td className={td}>{f7(d.lng)}</td>
                      <td className="py-1.5 text-right"><a href={ggMap(d.lat, d.lng)} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-[#0A2540] underline">Google Maps</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hinh && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[13.5px] text-slate-700">
              <p><b className="text-[#0A2540]">Diện tích: {hinh.dienTich.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} m²</b> · chu vi {hinh.chuVi.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m</p>
              <p className="mt-1 text-[12.5px] text-slate-500">Cạnh: {hinh.canh.map((c, i) => `${kqVn.ds[i].ten}–${kqVn.ds[(i + 1) % kqVn.ds.length].ten}: ${c.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m`).join(' · ')}</p>
              <p className="mt-1 text-[12px] text-slate-500">Tính trên mặt phẳng VN-2000 như sổ đỏ — lệch nhiều so với diện tích ghi trên sổ thì nên kiểm lại bảng tọa độ.</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {hinh && <a href={`/map?lng=${f7(hinh.lng)}&lat=${f7(hinh.lat)}`} className="rounded-lg bg-[#0A2540] px-3 py-2 text-[13px] font-bold text-white">🗺️ Xem thửa trên bản đồ Cam Lâm Land</a>}
            {hinh && <a href={ggMap(hinh.lat, hinh.lng)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-bold text-[#0A2540]">📍 Mở trên Google Maps</a>}
            {kqVn.ds.length > 0 && <button type="button" onClick={chep} className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-bold text-[#0A2540]">{daChep ? '✓ Đã chép' : '📋 Chép kết quả'}</button>}
          </div>
        </>
      ) : (
        <>
          <label htmlFor="o-wgs84" className="mt-3 block text-[13px] font-semibold text-slate-700">Dán vĩ độ, kinh độ (chép từ Google Maps) — mỗi dòng một điểm</label>
          <textarea id="o-wgs84" value={chuWgs} onChange={(e) => setChuWgs(e.target.value)} rows={4} spellCheck={false} className={`${o} mt-1`} />
          <p className="mt-1 text-[12px] leading-snug text-slate-500">Trên Google Maps: nhấn giữ một điểm → bấm vào dòng số (vd 12.06035, 109.15402) là chép được. Đang có sẵn một điểm <b>ví dụ</b>.</p>
          {kqWgs.loi.length > 0 && <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[12.5px] text-amber-800">{kqWgs.loi.join(' · ')}</p>}
          {kqWgs.ds.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full [font-variant-numeric:tabular-nums]">
                <thead><tr className="border-b border-slate-200"><th className={th}>Điểm</th><th className={th}>X (m)</th><th className={th}>Y (m)</th></tr></thead>
                <tbody>{kqWgs.ds.map((d, i) => <tr key={i} className="border-b border-slate-100"><td className={td}>{d.ten}</td><td className={td}>{f2(d.x)}</td><td className={td}>{f2(d.y)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {kqWgs.ds.length > 0 && <div className="mt-3"><button type="button" onClick={chep} className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-bold text-[#0A2540]">{daChep ? '✓ Đã chép' : '📋 Chép kết quả'}</button></div>}
        </>
      )}
    </div>
  );
}
