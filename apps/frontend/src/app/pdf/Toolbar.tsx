'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Thanh công cụ PDF Editor (tách khỏi page.tsx để file gọn).
import { fromHex } from './parts';

const TOOLS = [{ k: 'edit', label: 'Sửa chữ', icon: '✍️' }, { k: 'select', label: 'Chọn', icon: '🖱️' }, { k: 'text', label: 'Thêm chữ', icon: '🔤' }, { k: 'image', label: 'Ảnh', icon: '🖼️' }, { k: 'sign', label: 'Ký', icon: '🖊️' }, { k: 'white', label: 'Bôi trắng', icon: '⬜' }, { k: 'draw', label: 'Vẽ', icon: '✏️' }, { k: 'rect', label: 'Khung', icon: '▭' }, { k: 'highlight', label: 'Highlight', icon: '🖍️' }];

export function Toolbar({ tool, setTool, selText, updateSel, color, setColor, fontSize, setFontSize, zoom, setZoom, sel, deleteSel, hasPages, onOpenPdf, onMergePdf, onTools, onSign, onImageTool, onExport, embedded, onCloseFile }: any) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b bg-white px-3 py-2 shadow-sm">
      {!embedded && <button onClick={() => { window.location.href = '/'; }} title="Thoát" className="mr-1 rounded px-2 py-1.5 text-sm hover:bg-slate-100">✕</button>}
      <button onClick={onTools} title="Về danh sách công cụ" className="mr-1 rounded px-2 py-1.5 text-sm hover:bg-slate-100">←</button>
      <b className="mr-2 text-[#0A2540]">📄 PDF Editor</b>
      <button onClick={onOpenPdf} className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">{hasPages ? 'Mở PDF khác' : 'Mở PDF'}</button>
      {/* ĐÓNG FILE đang sửa để mở file khác (chủ dự án 6/10/2026: "tắt văn bản này để mở văn bản khác… chưa thấy nút") */}
      {hasPages && <button onClick={onCloseFile} title="Đóng file đang mở" className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">✕ Đóng file</button>}
      <button onClick={onMergePdf} disabled={!hasPages} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40">Ghép PDF</button>
      <button onClick={onTools} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50">🧰 Công cụ</button>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      {TOOLS.map((t) => <button key={t.k} onClick={() => { setTool(t.k); if (t.k === 'image') onImageTool(); if (t.k === 'sign') onSign(); }} className={`rounded px-2.5 py-1.5 text-sm font-medium ${tool === t.k ? 'bg-[#0A2540] text-white' : 'hover:bg-slate-100'}`}>{t.icon} {t.label}</button>)}
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (selText) updateSel({ color: fromHex(e.target.value) }); }} className="h-7 w-8 cursor-pointer rounded border" title="Màu" />
      <select value={selText ? selText.o.fam : 'serif'} onChange={(e) => { if (selText) updateSel({ fam: e.target.value }); }} disabled={!selText} title="Phông chữ (chọn ô chữ để đổi cho khớp file)" className="rounded border px-1 py-1 text-sm disabled:opacity-40"><option value="serif">Times New Roman</option><option value="sans">Arial</option><option value="tahoma">Tahoma</option><option value="calibri">Calibri</option><option value="verdana">Verdana</option></select>
      <label className="flex items-center gap-1 text-sm">Cỡ<input type="number" min={6} max={96} step={0.5} value={selText ? Math.round(selText.o.size * 10) / 10 : fontSize} onChange={(e) => { const v = +e.target.value; setFontSize(v); if (selText) updateSel({ size: v }); }} className="w-16 rounded border px-1 py-0.5" title="Cỡ chữ (chọn ô chữ để đổi)" /></label>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <button onClick={() => setZoom((z: number) => Math.max(0.4, z - 0.15))} className="rounded border px-2 py-1 text-sm">−</button>
      <span className="w-12 text-center text-sm">{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom((z: number) => Math.min(4, z + 0.15))} className="rounded border px-2 py-1 text-sm">＋</button>
      <div className="ml-auto flex items-center gap-2">
        {sel && <button onClick={deleteSel} className="rounded border border-red-300 px-2.5 py-1.5 text-sm text-red-600">🗑 Xoá</button>}
        <button onClick={onExport} disabled={!hasPages} className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">⬇ Xuất PDF</button>
      </div>
    </div>
  );
}
