'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Thanh công cụ PDF Editor (tách khỏi page.tsx để file gọn).
import { fromHex } from './parts';

const TOOLS = [{ k: 'edit', label: 'Sửa chữ', icon: '✍️' }, { k: 'select', label: 'Chọn', icon: '🖱️' }, { k: 'text', label: 'Thêm chữ', icon: '🔤' }, { k: 'image', label: 'Ảnh', icon: '🖼️' }, { k: 'sign', label: 'Ký', icon: '🖊️' }, { k: 'white', label: 'Bôi trắng', icon: '⬜' }, { k: 'draw', label: 'Vẽ', icon: '✏️' }, { k: 'rect', label: 'Khung', icon: '▭' }, { k: 'highlight', label: 'Highlight', icon: '🖍️' }];

export function Toolbar({ tool, setTool, selText, updateSel, color, setColor, fontSize, setFontSize, zoom, setZoom, sel, deleteSel, hasPages, onOpenPdf, onMergePdf, onTools, onSign, onImageTool, onExport, embedded, onCloseFile, onTim, timMo }: any) {
  return (
    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto whitespace-nowrap border-b bg-white px-3 py-1.5 shadow-sm [scrollbar-width:thin]">
      {!embedded && <button onClick={() => { window.location.href = '/'; }} title="Thoát" className="mr-1 rounded px-2 py-1.5 text-sm hover:bg-slate-100">✕</button>}
      <button onClick={onTools} title="Về danh sách công cụ" className="mr-1 rounded px-2 py-1.5 text-sm hover:bg-slate-100">←</button>
      <b className="mr-1.5 hidden text-[#0A2540] min-[1800px]:inline">📄 PDF Editor</b>
      <button onClick={onOpenPdf} className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">{hasPages ? 'Mở PDF khác' : 'Mở PDF'}</button>
      {/* ĐÓNG FILE đang sửa để mở file khác (chủ dự án 6/10/2026: "tắt văn bản này để mở văn bản khác… chưa thấy nút") */}
      {hasPages && <button onClick={onCloseFile} title="Đóng file đang mở" className="rounded border border-slate-300 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">✕ Đóng file</button>}
      <button onClick={onMergePdf} disabled={!hasPages} className="rounded border px-2.5 py-1.5 text-sm disabled:opacity-40">Ghép PDF</button>
      <button onClick={onTools} className="rounded border px-2.5 py-1.5 text-sm hover:bg-slate-50">🧰 Công cụ</button>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      {/* GỌN 1 DÒNG (chủ dự án 6/10/2026): công cụ ít dùng chỉ hiện biểu tượng (rê chuột thấy tên), "Sửa chữ" luôn có chữ;
          màn hình rất rộng (≥1800px) thì hiện đủ chữ cho tất cả. */}
      {TOOLS.map((t) => { const coChu = t.k === 'edit'; return <button key={t.k} title={t.label} aria-label={t.label} onClick={() => { setTool(t.k); if (t.k === 'image') onImageTool(); if (t.k === 'sign') onSign(); }} className={`rounded px-2 py-1.5 text-sm font-medium ${tool === t.k ? 'bg-[#0A2540] text-white' : 'hover:bg-slate-100'}`}>{t.icon}<span className={coChu ? '' : 'hidden min-[1800px]:inline'}> {t.label}</span></button>; })}
      {/* TÌM & THAY THẾ (Ctrl+F) — chủ dự án 6/10/2026: "tính năng quan trọng nhất" → nút vàng nổi bật, đứng ngay trước ô phông chữ */}
      <button onClick={onTim} disabled={!hasPages} title="Tìm chữ / Tìm & thay thế (Ctrl+F)" className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-bold shadow-sm ring-1 transition disabled:opacity-40 ${timMo ? 'bg-[#0A2540] text-white ring-[#0A2540]' : 'bg-[#C8A14B] text-[#0A2540] ring-[#b8923f] hover:bg-[#d4b05e]'}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-4 w-4" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>Tìm & thay thế
      </button>
      {/* CỤM ĐỊNH DẠNG: màu · phông · cỡ chữ · thu phóng luôn nằm CHUNG MỘT HÀNG, không bị tách khi thanh công cụ xuống dòng
          (chủ dự án 6/10/2026: ô màu + phông bị kẹt ở hàng trên, cỡ chữ + % thu phóng ở hàng dưới). */}
      <div className="flex shrink-0 items-center gap-1.5">
        <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (selText) updateSel({ color: fromHex(e.target.value) }); }} className="h-7 w-8 cursor-pointer rounded border" title="Màu" />
        <select value={selText ? selText.o.fam : 'serif'} onChange={(e) => { if (selText) updateSel({ fam: e.target.value }); }} disabled={!selText} title="Phông chữ (chọn ô chữ để đổi cho khớp file)" className="w-[132px] rounded border px-1 py-1 text-sm disabled:opacity-40"><option value="serif">Times New Roman</option><option value="sans">Arial</option><option value="tahoma">Tahoma</option><option value="calibri">Calibri</option><option value="verdana">Verdana</option></select>
        <label className="flex items-center gap-1 text-sm">Cỡ<input type="number" min={6} max={96} step={0.5} value={selText ? Math.round(selText.o.size * 10) / 10 : fontSize} onChange={(e) => { const v = +e.target.value; setFontSize(v); if (selText) updateSel({ size: v }); }} className="w-14 rounded border px-1 py-0.5" title="Cỡ chữ (chọn ô chữ để đổi)" /></label>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <button onClick={() => setZoom((z: number) => Math.max(0.4, z - 0.15))} className="rounded border px-2 py-1 text-sm">−</button>
        <span className="w-12 text-center text-sm">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z: number) => Math.min(4, z + 0.15))} className="rounded border px-2 py-1 text-sm">＋</button>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-1">
        {sel && <button onClick={deleteSel} className="rounded border border-red-300 px-2.5 py-1.5 text-sm text-red-600">🗑 Xoá</button>}
        <button onClick={onExport} disabled={!hasPages} className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">⬇ Xuất PDF</button>
      </div>
    </div>
  );
}
