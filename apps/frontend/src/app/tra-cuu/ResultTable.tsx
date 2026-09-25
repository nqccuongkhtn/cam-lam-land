'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Kết quả tra cứu. DESKTOP: bảng zebra. MOBILE: thẻ. Bấm 1 dòng/thẻ -> POPUP chi tiết (lưới ô có viền, tự xếp dọc trên mobile).
import { useState } from 'react';
import { chipCls, toHref, Linkify } from './parts';
import { imgUrl } from '@/lib/api';
import { useLockBody } from '@/lib/useLockBody';

const ZEBRA: Record<string, [string, string]> = {
  red: ['bg-red-50 hover:bg-red-100/70', 'bg-red-100/60 hover:bg-red-100'],
  amber: ['bg-amber-50/60 hover:bg-amber-100/60', 'bg-amber-100/50 hover:bg-amber-100/70'],
  blue: ['bg-sky-50/50 hover:bg-sky-100/60', 'bg-sky-100/50 hover:bg-sky-100/70'],
  slate: ['bg-white hover:bg-slate-50', 'bg-slate-50 hover:bg-slate-100'],
};
const CARD_BG: Record<string, string> = { red: 'border-red-200 bg-red-50/70', amber: 'border-amber-200 bg-amber-50/50', blue: 'border-sky-200 bg-sky-50/40', slate: 'border-slate-200 bg-white' };
const SEV_LABEL: Record<string, string> = { red: 'Ngăn chặn', amber: 'Cảnh báo', blue: 'Lưu ý', slate: 'Thường' };

// Chuyển link sang dạng NHÚNG xem trước (Google Drive -> /preview); còn lại giữ nguyên (PDF/ảnh nhúng trực tiếp).
function embedUrl(u: string): string {
  const url = toHref(u);
  let m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/); if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = url.match(/[?&]id=([\w-]+)/); if (/drive\.google|docs\.google/.test(url) && m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return url;
}
// Trình XEM CÔNG VĂN nhúng ngay trong web (có thương hiệu) — tạo cảm giác tài liệu lưu tại hệ thống, không nhảy ra ngoài.
function DocViewer({ url, onClose }: any) {
  useLockBody(); // khoá cuộn nền khi đang xem công văn
  const href = toHref(url); const emb = embedUrl(url);
  // Ảnh (có đuôi ảnh) → <img> (kèm .webp cho Cloudflare). PDF & khác → iframe nhúng trực tiếp.
  // Nhúng trực tiếp chạy được nhờ backend KHÔNG gắn X-Frame-Options cho /api/images (cần deploy backend).
  const isImg = /\.(jpe?g|png|webp|gif|bmp)(\?|#|$)/i.test(href);
  const src = emb + (emb.includes('#') ? '' : '#view=Fit'); // mặc định fit trọn trang A4 (trình xem PDF của trình duyệt)
  return (
    <div className="fixed inset-0 z-[70] flex bg-black/70 p-2 sm:p-4" onClick={onClose}>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 bg-[#0B4045] px-3 py-2 text-white">
          <span className="text-lg">🗂️</span><p className="min-w-0 flex-1 truncate text-sm font-semibold">Công văn · Kho lưu trữ Cam Lâm Land</p>
          <a href={href} target="_blank" rel="noopener noreferrer" className="rounded px-2 py-1 text-xs hover:bg-white/15">Mở tab mới ↗</a>
          <button onClick={onClose} className="rounded px-2 py-1 text-lg leading-none hover:bg-white/15">✕</button>
        </div>
        {isImg
          ? <div className="grid flex-1 place-items-center overflow-auto bg-slate-100 p-2"><img src={imgUrl(href)} alt="Công văn đính kèm" className="mx-auto h-auto max-w-full" /></div>
          : <iframe src={src} title="Công văn" className="w-full flex-1 bg-slate-100" />}
      </div>
    </div>
  );
}

// 1 ô thông tin có viền (như biểu mẫu văn bản đến); tự xếp 1 cột trên mobile, 2 cột trên desktop.
const Field = ({ label, value, full }: any) => (!value ? null : (
  <div className={`${full ? 'sm:col-span-2' : ''} rounded-md border border-slate-200 bg-white px-3 py-1.5`}>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <div className="text-sm text-slate-800" style={{ whiteSpace: 'pre-line' }}>{typeof value === 'string' ? <Linkify text={value} /> : value}</div>
  </div>
));

// Ghép ĐÚNG CẶP thửa–tờ: "Thửa 30, tờ 31" / "Thửa 30, tờ 32"…
function parcelLines(soThua: any, soTo: any): string[] {
  const th = String(soThua ?? '').split(/[,\n]/).map((s) => s.trim());
  const to = String(soTo ?? '').split(/[,\n]/).map((s) => s.trim());
  const n = Math.max(th.length, to.length); const out: string[] = [];
  for (let i = 0; i < n; i++) { const t = th[i] || '', o = to[i] || ''; if (!t && !o) continue; out.push(`Thửa ${t || '—'}${o ? ', tờ ' + o : ''}`); }
  return out;
}
function AddedForm({ a }: any) {
  const sp = (s: any) => String(s ?? '').split(/\s*\+\s*/).map((x: string) => x.trim());
  const names = sp(a.ten), gts = sp(a.soGiayTo), nss = sp(a.namSinh), dcs = sp(a.diaChi);
  const nOwn = Math.max(names.filter(Boolean).length, 1);
  const ownerList = Array.from({ length: nOwn }, (_, i) => ({ ten: names[i] || '', gt: gts[i] || '', ns: nss[i] || '', dc: dcs[i] || '' }));
  const pl = parcelLines(a.soThua, a.soTo);
  const pxa = String(a.xa ?? '').split(/\s*,\s*/).map((s: string) => s.trim());
  const parcelList = pl.map((line, i) => ({ line, xa: pxa[i] ?? pxa[pxa.length - 1] ?? '' }));
  const phs = sp(a.soPhatHanh), vss = sp(a.soVaoSo), ncs = sp(a.ngayCap);
  const nGcn = Math.max(phs.filter(Boolean).length, vss.filter(Boolean).length, ncs.filter(Boolean).length, 0);
  const gcnList = Array.from({ length: nGcn }, (_, i) => ({ ph: phs[i] || '', vs: vss[i] || '', nc: ncs[i] || '' }));
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Field label="Số, ký hiệu" value={a.soKyHieu} />
      <Field label="Ngày văn bản" value={a.ngayVb} />
      <Field label="Số đến" value={a.soDen} />
      <Field label="Ngày đến" value={a.ngayDen} />
      <Field label="Đơn vị gửi / cơ quan ban hành" value={a.donViGui} full />
      <Field label="Loại văn bản ngăn chặn" value={a.loaiVb} />
      <Field label="Số văn bản gốc" value={a.soVbGoc} />
      <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{nOwn > 1 ? `Chủ sở hữu — đồng sở hữu (${nOwn})` : 'Chủ sở hữu'}</p>
        <div className="mt-0.5 space-y-1.5">
          {ownerList.map((o, i) => (
            <div key={i} className={i > 0 ? 'border-t border-slate-100 pt-1.5' : ''}>
              <div className="text-sm font-medium text-slate-800">{nOwn > 1 ? `${i + 1}. ` : ''}{o.ten || <span className="text-slate-300">(chưa có tên)</span>}</div>
              {(o.gt || o.ns || o.dc) && <div className="text-xs text-slate-500">{[o.gt && 'CCCD: ' + o.gt, o.ns && 'Năm sinh: ' + o.ns, o.dc && 'Địa chỉ: ' + o.dc].filter(Boolean).join(' · ')}</div>}
            </div>
          ))}
        </div>
      </div>
      {parcelList.length > 0 ? (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{parcelList.length > 1 ? `Thửa đất (${parcelList.length})` : 'Thửa đất'}</p>
          <div className="mt-0.5 space-y-1">
            {parcelList.map((p, i) => (
              <div key={i} className={i > 0 ? 'border-t border-slate-100 pt-1' : ''}>
                <span className="text-sm text-slate-800">{parcelList.length > 1 ? `${i + 1}. ` : ''}{p.line}</span>
                {p.xa && <span className="text-xs text-slate-500"> · {p.xa}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : (a.xa && <Field label="Xã / phường" value={a.xa} full />)}
      {gcnList.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{nGcn > 1 ? `Giấy chứng nhận (${nGcn})` : 'Giấy chứng nhận'}</p>
          <div className="mt-0.5 space-y-1.5">
            {gcnList.map((g, i) => (
              <div key={i} className={i > 0 ? 'border-t border-slate-100 pt-1.5' : ''}>
                <div className="text-sm text-slate-800">{nGcn > 1 ? `${i + 1}. ` : ''}{[g.ph && 'Số phát hành: ' + g.ph, g.vs && 'Vào sổ: ' + g.vs].filter(Boolean).join(' · ') || '—'}</div>
                {g.nc && <div className="text-xs text-slate-500">Ngày cấp: {g.nc}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      <Field label="Trích yếu nội dung" value={a.noiDung} full />
      <Field label="Ghi chú" value={a.ghiChu} full />
      <Field label="Nguồn (sheet)" value={a.nguon} />
      <Field label="Người thêm" value={a.nguoiThem} />
    </div>
  );
}
function GenericForm({ pairs }: any) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{pairs.map(([k, v]: any, i: number) => <Field key={i} label={k} value={String(v)} />)}</div>;
}
function RecordModal({ row, canManage, isAdmin, onEdit, onDel, onExpire, onClose, openDoc }: any) {
  useLockBody(); // khoá cuộn nền khi mở chi tiết bản ghi
  const a = row.added; const danger = row.sev === 'red';
  const embed = typeof document !== 'undefined' && document.documentElement.classList.contains('embed'); // trong hub Tiện ích: thanh dưới không đè iframe → mở rộng gần full
  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 ${embed ? 'pb-3' : 'pb-24'} sm:p-4 sm:pb-4`} onClick={onClose}>
      {danger && <style>{`@keyframes dangerPulse{0%,100%{border-color:#fca5a5;box-shadow:0 0 12px 3px rgba(220,38,38,.4)}50%{border-color:#dc2626;box-shadow:0 0 52px 16px rgba(220,38,38,.92)}}`}</style>}
      <div className={`flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ${danger ? 'border-2 border-red-500' : ''}`} style={danger ? { animation: 'dangerPulse 0.95s ease-in-out infinite' } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 bg-[#0B4045] px-4 py-2.5 text-white">
          <span className="text-lg">📄</span>
          <p className="font-semibold">Chi tiết bản ghi</p>
          <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${chipCls[row.sev]}`}>{a ? (SEV_LABEL[row.sev] || 'Thường') : (row.badge || row.srcShort)}</span>
          <button onClick={onClose} className="ml-auto rounded px-2 py-0.5 text-lg leading-none hover:bg-white/15">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {a?.hetHieuLucAt && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500"><span className="rounded bg-slate-500 px-2 py-0.5 text-[11px] font-bold text-white">HẾT HIỆU LỰC</span><span>Đánh dấu ngày <b className="text-slate-600">{new Date(a.hetHieuLucAt).toLocaleDateString('vi-VN')}</b>{a.hetHieuLucBoi ? <> · bởi <b className="text-slate-600">{a.hetHieuLucBoi}</b></> : null}</span></div>}
          {a ? <AddedForm a={a} /> : <GenericForm pairs={row.pairs} />}
          {row.link && (
            <div className="mt-3">
              <p className="mb-1.5 text-sm font-semibold text-[#0B4045]">📎 Tệp / công văn đính kèm</p>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm">
                <span className="text-lg">📄</span><span className="min-w-0 flex-1 truncate text-slate-600">Công văn liên quan</span>
                <button onClick={() => openDoc(row.link)} className="rounded bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100">Xem tại đây</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t bg-slate-50 px-4 py-2.5">
          {a && canManage && <>
            <button onClick={() => { onEdit(a); onClose(); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-[#0B4045] hover:bg-slate-50">✎ Sửa</button>
            {a.hetHieuLucAt
              ? <button onClick={() => { onExpire(a.id, true); onClose(); }} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50">↺ Khôi phục hiệu lực</button>
              : <button onClick={() => { onExpire(a.id, false); onClose(); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">⊘ Đánh dấu hết hiệu lực</button>}
            {isAdmin && <button onClick={() => { onDel(a.id); onClose(); }} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">🗑 Xoá</button>}
          </>}
          <button onClick={onClose} className="ml-auto rounded-lg bg-[#0B4045] px-5 py-1.5 text-sm font-bold text-white">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ row, onOpen, openDoc }: any) {
  const th = String(row.thua || '').replace(/\n/g, ', '), to = String(row.to || '').replace(/\n/g, ', ');
  const exp = row.expired;
  return (
    <div onClick={onOpen} className={`cursor-pointer rounded-xl border p-3 shadow-sm ${exp ? 'border-slate-200 bg-slate-100/80' : (CARD_BG[row.sev] || CARD_BG.slate)}`}>
      <div className="flex items-start gap-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${exp ? 'bg-slate-400 text-white' : chipCls[row.sev]}`}>{row.srcShort}</span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold leading-snug ${exp ? 'text-slate-400' : 'text-[#0B4045]'}`} style={{ whiteSpace: 'pre-line' }}>{row.ten || <span className="text-slate-300">(chưa có tên)</span>}</p>
          <p className={`mt-0.5 text-xs ${exp ? 'text-slate-400' : 'text-slate-500'}`}>{[th && 'Thửa ' + th, to && 'tờ ' + to, row.xa].filter(Boolean).join(' · ') || '—'}</p>
        </div>
        <span className={`shrink-0 text-lg leading-none ${exp ? 'text-slate-300' : 'text-[#C8A14B]'}`}>›</span>
      </div>
      {row.detail && <p className={`mt-1.5 line-clamp-2 text-xs ${exp ? 'text-slate-400' : 'text-slate-600'}`} style={{ whiteSpace: 'pre-line' }}>{row.detail}</p>}
      {exp ? <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="rounded bg-slate-400 px-1.5 py-0.5 text-[10px] font-bold text-white">HẾT HIỆU LỰC</span><span className="text-[10px] text-slate-400">{new Date(row.expiredAt).toLocaleDateString('vi-VN')}{row.expiredBy ? ' · ' + row.expiredBy : ''}</span></div>
       : (row.sev === 'red' || row.added || row.link) ? <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {row.sev === 'red' && <span className="text-[10px] font-bold text-red-600">⚠ {row.badge}</span>}
        {row.added && <span className="text-[10px] font-bold text-emerald-600">● Mới thêm</span>}
        {row.link && <button onClick={(e) => { e.stopPropagation(); openDoc(row.link); }} className="text-[10px] font-medium text-sky-600 underline">📎 Công văn</button>}
      </div> : null}
    </div>
  );
}

export function ResultTable({ shownRows, total, limit, openKey, setOpenKey, canManage, isAdmin, onEdit, onDel, onExpire, mobile }: any) {
  const [viewDoc, setViewDoc] = useState(''); const openDoc = (u: string) => setViewDoc(u);
  const openRow = shownRows.find((r: any) => r.key === openKey);
  return (
    <>
      {mobile ? (
        <div className="space-y-2 p-2">
          {shownRows.map((row: any) => <ResultCard key={row.key} row={row} onOpen={() => setOpenKey(row.key)} openDoc={openDoc} />)}
          {total === 0 && <p className="py-10 text-center text-slate-400">Không tìm thấy bản ghi phù hợp.</p>}
          {limit < total && <p className="py-3 text-center text-sm text-slate-400">Đang tải thêm… (cuộn tiếp)</p>}
        </div>
      ) : (
        <table className="w-full border-collapse text-sm [&_td]:border [&_td]:border-slate-200 [&_th]:border [&_th]:border-slate-300">
          <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
            <tr><th className="w-28 px-2 py-2">Nguồn</th><th className="px-2 py-2">Tên / Chủ</th><th className="w-20 px-2 py-2">Thửa</th><th className="w-14 px-2 py-2">Tờ</th><th className="w-28 px-2 py-2">Xã</th><th className="px-2 py-2">Nội dung / Chi tiết</th><th className="w-16 px-2 py-2"></th></tr>
          </thead>
          <tbody>
            {shownRows.map((row: any, idx: number) => {
              const exp = row.expired;
              const zebra = exp ? 'bg-slate-100/70 text-slate-400' : (ZEBRA[row.sev] || ZEBRA.slate)[idx % 2];
              return (
                <tr key={row.key} className={`cursor-pointer align-top ${zebra}`} onClick={() => setOpenKey(row.key)}>
                  <td className="px-2 py-2"><span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${exp ? 'bg-slate-400 text-white' : chipCls[row.sev]}`}>{row.srcShort}</span>{exp ? <div className="mt-0.5 text-[10px] font-bold text-slate-500">HẾT HIỆU LỰC</div> : <>{row.badge && row.sev === 'red' && <div className="mt-0.5 text-[10px] font-bold text-red-600">⚠ {row.badge}</div>}{row.added && <div className="mt-0.5 text-[10px] font-bold text-emerald-600">● Mới thêm</div>}</>}</td>
                  <td className={`px-2 py-2 font-semibold ${exp ? 'text-slate-400' : 'text-[#0B4045]'}`} style={{ whiteSpace: 'pre-line' }}>{row.ten || <span className="text-slate-300">—</span>}</td>
                  <td className={`px-2 py-2 font-bold ${exp ? 'text-slate-400' : 'text-[#0B4045]'}`} style={{ whiteSpace: 'pre-line' }}>{row.thua}</td>
                  <td className="px-2 py-2" style={{ whiteSpace: 'pre-line' }}>{row.to}</td>
                  <td className="px-2 py-2">{row.xa}</td>
                  <td className={`px-2 py-2 ${exp ? 'text-slate-400' : 'text-slate-600'}`}><div className="line-clamp-2" style={{ whiteSpace: 'pre-line' }}>{row.detail ? <Linkify text={row.detail} /> : <span className="text-slate-300">—</span>}</div>{exp && <div className="mt-0.5 text-[11px] text-slate-400">Hết hiệu lực {new Date(row.expiredAt).toLocaleDateString('vi-VN')}{row.expiredBy ? ' · ' + row.expiredBy : ''}</div>}{row.link && <button onClick={(e) => { e.stopPropagation(); openDoc(row.link); }} className="text-xs font-medium text-sky-600 underline">📎 Công văn đính kèm</button>}</td>
                  <td className="px-2 py-2 text-right text-xs font-semibold text-[#C8A14B]">Xem ›</td>
                </tr>
              );
            })}
            {total === 0 && <tr><td colSpan={7} className="py-10 text-center text-slate-400">Không tìm thấy bản ghi phù hợp.</td></tr>}
            {limit < total && <tr><td colSpan={7} className="py-4 text-center text-sm text-slate-400">Đang tải thêm… (cuộn tiếp)</td></tr>}
          </tbody>
        </table>
      )}
      {openRow && <RecordModal row={openRow} canManage={canManage} isAdmin={isAdmin} onEdit={onEdit} onDel={onDel} onExpire={onExpire} onClose={() => setOpenKey(null)} openDoc={openDoc} />}
      {viewDoc && <DocViewer url={viewDoc} onClose={() => setViewDoc('')} />}
    </>
  );
}
