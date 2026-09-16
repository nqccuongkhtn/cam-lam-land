'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DEN_BU_NGUON, DU_AN_PHUC_HOP, GIA_LUA_2VU, GIA_NONG_NGHIEP, GIA_PHUC_HOP, GIA_RUNG_SAN_XUAT,
  TEN_NGAN_LOAI_DAT, TEN_VI_TRI_PH, dsThon, giaDenBu, type LoaiDat, type ViTriPH,
} from '@/lib/denBuCamLam';

const tien = (v: number) => Math.round(v).toLocaleString('vi-VN') + ' đ';
const so = (s: string) => {
  const v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : 0;
};
const khongDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
// Ô nhập: chữ 16px để iPhone không tự phóng to trang khi bấm vào ô.
const O = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-[16px] outline-none focus:border-[#0A2540]';
const TL = '/tai-lieu/';

type DongTinh = { ten: string; dv: string; gia: number; sl: number };
// Phụ lục QĐ 08/2026 giữ NGUYÊN VĂN từng dòng (không tự ghép lại): bảng in chữ xuống dòng vòng quanh cột giá,
// máy ghép lại là lẫn chữ của hạng mục bên cạnh. Tìm kiếm sẽ hiện nguyên đoạn có chứa giá để người đọc tự đối chiếu.
const RE_DONG_GIA = /^(.*?)\s{2,}((?:m2 XD|m2|m3|m dài|md|cái|bộ|trụ|cây|con|kg|tấn|ha|hầm|giếng|mộ|bể|cột|tấm|m))?\s*(\d{1,3}(?:\.\d{3})+)\s*$/;

export default function DenBuClient() {
  const [tab, setTab] = useState<'dat' | 'nha' | 'khac' | 'cancu'>('dat');

  // ── Tiền đất ──────────────────────────────────────────────
  const [duAn, setDuAn] = useState<'camlam' | 'phuchop'>('camlam');
  const [loai, setLoai] = useState<LoaiDat>('cay');
  const [thon, setThon] = useState('Thôn Vĩnh Phú');
  const [viTri, setViTri] = useState<1 | 2>(1);
  const [phVt, setPhVt] = useState<ViTriPH>('trong-tiep');
  const [phLoai, setPhLoai] = useState<'cayLauNam' | 'cayHangNam' | 'rung' | 'thuySan' | 'lua'>('cayLauNam');
  const [dt, setDt] = useState('');

  const ds = useMemo(() => dsThon(loai), [loai]);
  const thonDung = ds.includes(thon) ? thon : ds[0];
  const giaM2 = useMemo(() => {
    if (duAn === 'camlam') return giaDenBu(thonDung, loai, viTri);
    if (phLoai === 'lua') return phVt.endsWith('tiep') ? GIA_LUA_2VU.tiepGiap : GIA_LUA_2VU.khongTiepGiap;
    return GIA_PHUC_HOP[phVt][phLoai];
  }, [duAn, thonDung, loai, viTri, phVt, phLoai]);
  const dienTich = so(dt);
  const tienDat = giaM2 != null ? giaM2 * dienTich : 0;

  // ── Nhà & công trình ─────────────────────────────────────
  const [mucs, setMucs] = useState<string[]>([]);
  const [tim, setTim] = useState('');
  const [dongs, setDongs] = useState<DongTinh[]>([]);
  useEffect(() => {
    if (tab !== 'nha' || mucs.length) return;
    fetch('/den-bu-nha-qd08.json').then((r) => r.json()).then(setMucs).catch(() => setMucs([]));
  }, [tab, mucs.length]);
  // Tìm: lấy những dòng khớp chữ, kèm 2 dòng trên và 2 dòng dưới để đọc đủ ý; gộp các đoạn sát nhau.
  const doan = useMemo(() => {
    const k = khongDau(tim.trim());
    if (!mucs.length) return [] as number[][];
    const hit: number[] = [];
    mucs.forEach((d, i) => { if (!k || khongDau(d).includes(k)) hit.push(i); });
    const ra: number[][] = [];
    for (const i of hit.slice(0, 120)) {
      const a = Math.max(0, i - 2), b = Math.min(mucs.length - 1, i + 2);
      const cuoi = ra[ra.length - 1];
      if (cuoi && a <= cuoi[1] + 1) cuoi[1] = Math.max(cuoi[1], b);
      else ra.push([a, b]);
    }
    return ra.slice(0, 25);
  }, [mucs, tim]);
  const tienNha = dongs.reduce((s, d) => s + d.gia * d.sl, 0);

  // ── Hỗ trợ ───────────────────────────────────────────────
  const [heSoNghe, setHeSoNghe] = useState('');
  const [dtHanMuc, setDtHanMuc] = useState('');
  const [odS, setOdS] = useState('');
  const [cayTrong, setCayTrong] = useState('');
  const [thuong, setThuong] = useState('');
  const [khac, setKhac] = useState('');
  const heSo = so(heSoNghe);
  const tienNghe = giaM2 != null && heSo > 0 ? giaM2 * (so(dtHanMuc) || dienTich) * heSo : 0;
  const tong = tienDat + tienNha + tienNghe + so(odS) + so(cayTrong) + so(thuong) + so(khac);

  const nut = (k: typeof tab, nhan: string) => (
    <button key={k} onClick={() => setTab(k)}
      className={`cl-press whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold ${tab === k ? 'bg-[#0A2540] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{nhan}</button>
  );

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      <h1 className="text-xl font-extrabold text-[#0A2540] sm:text-3xl">Đền bù khi Nhà nước thu hồi đất — Cam Lâm</h1>
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
            <button onClick={() => setDuAn('camlam')} className={`cl-press rounded-xl border p-3 text-left ${duAn === 'camlam' ? 'border-[#0A2540] bg-[#0A2540]/[0.04]' : 'border-slate-200'}`}>
              <b className="text-[14px] text-[#0A2540]">Khu đô thị mới Cam Lâm</b>
              <span className="mt-0.5 block text-[12px] text-slate-500">Giá theo từng thôn · {DEN_BU_NGUON.vanBan}</span>
            </button>
            <button onClick={() => setDuAn('phuchop')} className={`cl-press rounded-xl border p-3 text-left ${duAn === 'phuchop' ? 'border-[#0A2540] bg-[#0A2540]/[0.04]' : 'border-slate-200'}`}>
              <b className="text-[14px] text-[#0A2540]">4 khu đô thị phức hợp</b>
              <span className="mt-0.5 block text-[12px] text-slate-500">Suối Tân · Cam Thượng · Cam Tân · Cam Hòa (23/9/2025)</span>
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
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Thôn</p>
              <select value={thonDung} onChange={(e) => setThon(e.target.value)} className={`${O} mt-2 bg-white`}>
                {ds.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Vị trí thửa đất</p>
              <div className="mt-2 flex gap-2">
                {([1, 2] as const).map((v) => (
                  <button key={v} onClick={() => setViTri(v)}
                    className={`cl-press flex-1 rounded-lg px-3 py-2 text-[14px] font-semibold ${viTri === v ? 'bg-[#0A2540] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Vị trí {v}</button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-slate-500">Vị trí ghi trong phương án bồi thường, hoặc hỏi cán bộ địa chính xã.</p>
            </>
          ) : (
            <>
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Loại đất</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {([['cayLauNam', 'Cây lâu năm'], ['cayHangNam', 'Cây hằng năm'], ['lua', 'Lúa nước 2 vụ'], ['rung', 'Rừng sản xuất'], ['thuySan', 'Nuôi trồng thuỷ sản']] as const).map(([k, n]) => (
                  <button key={k} onClick={() => setPhLoai(k)}
                    className={`cl-press rounded-full px-3.5 py-2 text-[13px] font-semibold ${phLoai === k ? 'bg-[#0A2540] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{n}</button>
                ))}
              </div>
              <p className="mt-4 text-[13px] font-bold uppercase tracking-wide text-slate-400">Vị trí thửa đất so với đường</p>
              <div className="mt-2 grid gap-2">
                {(Object.keys(TEN_VI_TRI_PH) as ViTriPH[]).map((k) => (
                  <button key={k} onClick={() => setPhVt(k)}
                    className={`cl-press rounded-lg border px-3 py-2 text-left text-[13.5px] ${phVt === k ? 'border-[#0A2540] bg-[#0A2540]/[0.04] font-semibold text-[#0A2540]' : 'border-slate-200 text-slate-600'}`}>
                    {TEN_VI_TRI_PH[k]}
                  </button>
                ))}
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
                        {r.slice(1).map((v, i) => <td key={i} className="px-2 py-1.5 text-right tabular-nums text-[#0A2540]">{v == null ? '—' : (v as number).toLocaleString('vi-VN')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 font-bold text-[#0A2540]">Đất rừng sản xuất</p>
                <table className="w-full min-w-[320px] text-[12.5px]"><tbody>
                  {GIA_RUNG_SAN_XUAT.map((r) => (
                    <tr key={r[0]} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 text-slate-700">{r[0]}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[#0A2540]">{r[1].toLocaleString('vi-VN')}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums text-[#0A2540]">{r[2].toLocaleString('vi-VN')}</td>
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
            {doan.map(([a, b], k) => (
              <div key={k} className="border-b border-slate-100 px-3 py-2 last:border-b-0">
                {mucs.slice(a, b + 1).map((d, j) => {
                  const m = RE_DONG_GIA.exec(d);
                  const chu = (m ? m[1] : d).trim().replace(/^[\d.]+\s+/, '');
                  if (!m) return chu ? <p key={j} className="text-[13px] leading-snug text-slate-600">{chu}</p> : null;
                  const gia = parseInt(m[3].replace(/\./g, ''), 10), dv = (m[2] || 'm2').trim();
                  // tên hạng mục để đưa vào bảng tính: chữ trên cùng đoạn đang hiện
                  const ten = [mucs[a], mucs[a + 1], chu].map((x) => (x || '').replace(/\s{2,}.*$/, '').trim().replace(/^[\d.]+\s+/, '')).filter(Boolean).join(' ').slice(0, 120);
                  return (
                    <div key={j} className="mt-1 flex items-center gap-2">
                      {chu && <span className="min-w-0 flex-1 text-[13px] leading-snug text-slate-600">{chu}</span>}
                      <b className="ml-auto shrink-0 text-[13px] text-[#0A2540]">{tien(gia)} / {dv}</b>
                      <button onClick={() => setDongs((x) => [...x, { ten: ten || chu, dv, gia, sl: 1 }])}
                        className="cl-press shrink-0 rounded-lg bg-[#0A2540] px-2.5 py-1 text-[12px] font-bold text-white">＋</button>
                    </div>
                  );
                })}
              </div>
            ))}
            {mucs.length > 0 && doan.length === 0 && <p className="p-3 text-[13px] text-slate-400">Không tìm thấy hạng mục nào.</p>}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-slate-500">Chữ hiện nguyên như trong phụ lục (không sửa chữ nào) — bản gốc: <a href={TL + 'QD-08-2026-don-gia-boi-thuong-nha-cong-trinh.pdf'} target="_blank" rel="noreferrer" className="font-semibold text-[#0A2540] underline">QĐ 08/2026 (PDF)</a></p>

          {dongs.length > 0 && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13px] font-bold text-[#0A2540]">Hạng mục đã chọn</p>
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
              <p className="mt-2 border-t border-slate-200 pt-2 text-[14px] text-slate-600">Cộng nhà &amp; công trình: <b className="text-[#0A2540]">{tien(tienNha)}</b></p>
            </div>
          )}
        </div>
      )}

      {/* ───────────────── ③ CHI PHÍ KHÁC ───────────────── */}
      {tab === 'khac' && (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold text-[#0A2540]">Hỗ trợ cho người có đất bị thu hồi</p>
            <p className="mt-1 text-[12.5px] leading-snug text-slate-500">Mức cụ thể do UBND tỉnh quy định và ghi trong phương án bồi thường của dự án — điền vào đây để cộng vào tổng.</p>

            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[13.5px] font-semibold text-[#0A2540]">Hỗ trợ đào tạo, chuyển đổi nghề &amp; tìm kiếm việc làm</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">= giá đất nông nghiệp × diện tích (trong hạn mức) × số lần. Điều 22 Nghị định 88/2024/NĐ-CP: <b>không quá 5 lần</b>.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[12.5px] text-slate-600">Số lần (0–5)
                  <input value={heSoNghe} onChange={(e) => setHeSoNghe(e.target.value)} inputMode="decimal" placeholder="VD: 3" className={`${O} mt-1`} /></label>
                <label className="text-[12.5px] text-slate-600">Diện tích trong hạn mức (m²)
                  <input value={dtHanMuc} onChange={(e) => setDtHanMuc(e.target.value)} inputMode="decimal" placeholder="mặc định = diện tích thu hồi" className={`${O} mt-1`} /></label>
              </div>
              {tienNghe > 0 && <p className="mt-1.5 text-[13px] text-slate-600">→ <b className="text-[#0A2540]">{tien(tienNghe)}</b></p>}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {([['Hỗ trợ ổn định đời sống, sản xuất', odS, setOdS],
                 ['Bồi thường cây trồng, vật nuôi', cayTrong, setCayTrong],
                 ['Thưởng bàn giao mặt bằng đúng hạn', thuong, setThuong],
                 ['Khoản khác (di dời mồ mả, tháo dỡ…)', khac, setKhac]] as [string, string, (v: string) => void][]).map(([nhan, v, set]) => (
                <label key={nhan} className="text-[12.5px] text-slate-600">{nhan} (đồng)
                  <input value={v} onChange={(e) => set(e.target.value)} inputMode="decimal" placeholder="0" className={`${O} mt-1`} /></label>
              ))}
            </div>
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
            <p className="mt-2 text-[12px] leading-snug text-slate-500">Bản gốc là file scan nên web <b>không gõ lại số</b> (tránh sai sót) — hãy mở PDF để xem đúng đơn giá, rồi điền vào ô “Khoản khác” ở trên.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={TL + 'QD-12-2026-don-gia-boi-thuong-ho-tro-chi-phi.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-[#0A2540] px-3 py-1.5 text-[12.5px] font-bold text-white">📄 QĐ 12/2026 (PDF)</a>
              <a href={TL + '2093-SXD-huong-dan-ap-dung-QD08-QD12.pdf'} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-[#0A2540] hover:bg-slate-200">📑 Hướng dẫn áp dụng của Sở Xây dựng</a>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────── ④ CĂN CỨ ───────────────── */}
      {tab === 'cancu' && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-bold text-[#0A2540]">Người bị thu hồi đất nông nghiệp được nhận những khoản gì?</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-slate-600">
            <li><b>Tiền bồi thường về đất</b> = diện tích thu hồi × giá đất cụ thể được phê duyệt cho dự án.</li>
            <li><b>Bồi thường nhà, công trình xây dựng</b> gắn liền với đất — đơn giá tại QĐ 08/2026/QĐ-UBND.</li>
            <li><b>Bồi thường cây trồng, vật nuôi</b> bị thiệt hại — Điều 103 Luật Đất đai 2024.</li>
            <li><b>Bồi thường chi phí đầu tư vào đất còn lại</b> — Điều 104 Luật Đất đai 2024, đơn giá tại QĐ 12/2026.</li>
            <li><b>Hỗ trợ ổn định đời sống và sản xuất</b> — Điều 108 Luật Đất đai 2024.</li>
            <li><b>Hỗ trợ đào tạo, chuyển đổi nghề và tìm kiếm việc làm</b> — Điều 22 Nghị định 88/2024/NĐ-CP: hỗ trợ bằng tiền <b>không quá 5 lần</b> giá đất nông nghiệp cùng loại trong bảng giá đất, tính cho toàn bộ diện tích thu hồi nhưng không vượt hạn mức giao đất nông nghiệp; mức cụ thể do UBND tỉnh quy định.</li>
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

      {/* ───────────────── TỔNG ───────────────── */}
      <div className="mt-4 rounded-2xl bg-[#0A2540] p-4 text-white shadow-sm">
        <p className="text-[13px] uppercase tracking-wide text-white/70">Tổng tiền dự kiến</p>
        <p className="mt-1 text-2xl font-extrabold text-[#FFD56A]">{tong > 0 ? tien(tong) : '—'}</p>
        <div className="mt-1.5 space-y-0.5 text-[12.5px] text-white/80">
          {tienDat > 0 && <p>· Đất: {tien(tienDat)}</p>}
          {tienNha > 0 && <p>· Nhà &amp; công trình: {tien(tienNha)}</p>}
          {tienNghe > 0 && <p>· Hỗ trợ chuyển đổi nghề: {tien(tienNghe)}</p>}
          {so(odS) > 0 && <p>· Hỗ trợ ổn định đời sống: {tien(so(odS))}</p>}
          {so(cayTrong) > 0 && <p>· Cây trồng, vật nuôi: {tien(so(cayTrong))}</p>}
          {so(thuong) > 0 && <p>· Thưởng bàn giao: {tien(so(thuong))}</p>}
          {so(khac) > 0 && <p>· Khoản khác: {tien(so(khac))}</p>}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-white/70">Con số chỉ mang tính <b>tham khảo</b>. Số tiền chính thức là số ghi trong <b>phương án bồi thường, hỗ trợ, tái định cư</b> được cơ quan có thẩm quyền phê duyệt.</p>
      </div>
    </div>
  );
}
