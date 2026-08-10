'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element, react-hooks/exhaustive-deps */
// TRANG CÔNG CỤ PDF (kiểu PDF24/iLovePDF). Lưới tất cả công cụ — "Sửa chữ" đầu tiên. Bấm 1 công cụ -> TRANG CON:
// vùng thả tệp -> XEM TRƯỚC file (thumbnail từng trang) -> tuỳ chọn -> xử lý. Sửa chữ mở trình soạn đầy đủ.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as ops from './pdfops';
import { apiBase } from '@/lib/api';
import { getToken } from '@/lib/token';
import { toast } from '@/lib/toast';

type Tool = { id: string; name: string; desc: string; icon: string; input: 'pdf' | 'pdfs' | 'images' | 'office-word' | 'office-excel' | 'office-ppt'; engine: 'client' | 'server' | 'edit'; op?: string; to?: string; opts?: string[] };
type Cat = { cat: string; color: string; tools: Tool[] };

const CATS: Cat[] = [
  { cat: 'Chỉnh sửa & xem', color: 'text-[#0A2540]', tools: [
    { id: 'edit', name: 'Sửa chữ PDF', desc: 'Mở & sửa trực tiếp chữ trên file, thêm chữ/ảnh/ký tên', icon: '✍️', input: 'pdf', engine: 'edit' },
  ] },
  { cat: 'Trang & sắp xếp', color: 'text-sky-700', tools: [
    { id: 'merge', name: 'Ghép PDF', desc: 'Nối nhiều PDF thành 1', icon: '🔗', input: 'pdfs', engine: 'client' },
    { id: 'split', name: 'Tách trang', desc: 'Mỗi trang 1 file riêng', icon: '✂️', input: 'pdf', engine: 'client' },
    { id: 'extract', name: 'Trích trang', desc: 'Lấy ra các trang chọn', icon: '📑', input: 'pdf', engine: 'client', opts: ['range'] },
    { id: 'remove', name: 'Xoá trang', desc: 'Bỏ bớt các trang', icon: '🗑️', input: 'pdf', engine: 'client', opts: ['range'] },
    { id: 'rotate', name: 'Xoay trang', desc: 'Xoay 90/180/270°', icon: '🔄', input: 'pdf', engine: 'client', opts: ['rotate'] },
    { id: 'reverse', name: 'Đảo ngược trang', desc: 'Trang cuối lên đầu', icon: '↕️', input: 'pdf', engine: 'client' },
    { id: 'blank', name: 'Chèn trang trắng', desc: 'Thêm 1 trang trắng', icon: '➕', input: 'pdf', engine: 'client', opts: ['blank'] },
  ] },
  { cat: 'Chuyển đổi', color: 'text-emerald-700', tools: [
    { id: 'img2pdf', name: 'Ảnh → PDF', desc: 'Ghép JPG/PNG thành PDF', icon: '🖼️', input: 'images', engine: 'client' },
    { id: 'pdf2png', name: 'PDF → PNG', desc: 'Mỗi trang 1 ảnh PNG', icon: '🌄', input: 'pdf', engine: 'client' },
    { id: 'pdf2jpg', name: 'PDF → JPG', desc: 'Mỗi trang 1 ảnh JPG', icon: '📷', input: 'pdf', engine: 'client' },
    { id: 'pdf2word', name: 'PDF → Word', desc: 'Máy chủ · xuất .docx', icon: '📘', input: 'pdf', engine: 'server', op: 'convert', to: 'docx' },
    { id: 'pdf2excel', name: 'PDF → Excel', desc: 'Máy chủ · xuất .xlsx', icon: '📗', input: 'pdf', engine: 'server', op: 'convert', to: 'xlsx' },
    { id: 'word2pdf', name: 'Word → PDF', desc: 'Máy chủ · .doc/.docx', icon: '📄', input: 'office-word', engine: 'server', op: 'convert', to: 'pdf' },
    { id: 'excel2pdf', name: 'Excel → PDF', desc: 'Máy chủ · .xls/.xlsx', icon: '📄', input: 'office-excel', engine: 'server', op: 'convert', to: 'pdf' },
    { id: 'ppt2pdf', name: 'PowerPoint → PDF', desc: 'Máy chủ · .ppt/.pptx', icon: '📄', input: 'office-ppt', engine: 'server', op: 'convert', to: 'pdf' },
  ] },
  { cat: 'Tối ưu', color: 'text-amber-700', tools: [
    { id: 'compress', name: 'Nén PDF', desc: 'Giảm dung lượng file (nhiều tệp)', icon: '🗜️', input: 'pdfs', engine: 'client', opts: ['compress'] },
  ] },
  { cat: 'Chú thích', color: 'text-violet-700', tools: [
    { id: 'pagenum', name: 'Đánh số trang', desc: 'Thêm "1 / n" mỗi trang', icon: '#️⃣', input: 'pdf', engine: 'client' },
    { id: 'watermark', name: 'Dấu mờ', desc: 'Chèn chữ mờ chìm nền', icon: '💧', input: 'pdf', engine: 'client', opts: ['watermark'] },
  ] },
  { cat: 'Bảo mật & OCR (máy chủ)', color: 'text-rose-700', tools: [
    { id: 'ocr', name: 'OCR nhận dạng chữ', desc: 'PDF scan → tìm/copy được chữ (tiếng Việt)', icon: '🔍', input: 'pdf', engine: 'server', op: 'ocr' },
    { id: 'encrypt', name: 'Đặt mật khẩu', desc: 'Khoá PDF bằng mật khẩu', icon: '🔒', input: 'pdf', engine: 'server', op: 'encrypt', opts: ['password'] },
    { id: 'decrypt', name: 'Gỡ mật khẩu', desc: 'Bỏ mật khẩu (cần đúng mật khẩu)', icon: '🔓', input: 'pdf', engine: 'server', op: 'decrypt', opts: ['password'] },
  ] },
];

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const acceptOf = (t: Tool) => t.input === 'images' ? 'image/*' : t.input === 'office-word' ? '.doc,.docx,.odt,.rtf' : t.input === 'office-excel' ? '.xls,.xlsx,.csv,.ods' : t.input === 'office-ppt' ? '.ppt,.pptx,.odp' : 'application/pdf';
const multiOf = (t: Tool) => t.input === 'pdfs' || t.input === 'images';
const typeLabel = (t: Tool) => t.input === 'images' ? 'ảnh (JPG, PNG…)' : t.input === 'office-word' ? 'tệp Word' : t.input === 'office-excel' ? 'tệp Excel' : t.input === 'office-ppt' ? 'tệp PowerPoint' : t.input === 'pdfs' ? 'các tệp PDF' : 'tệp PDF';
const dlBlob = (blob: Blob, name: string) => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
const cdName = (cd: string | null, fb: string) => { if (!cd) return fb; const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd); try { return m ? decodeURIComponent(m[1]) : fb; } catch { return fb; } };

// XEM TRƯỚC tệp: PDF -> thumbnail từng trang; ảnh -> xem ảnh; Office -> thẻ tên tệp.
function FilePreview({ files, input }: { files: File[]; input: Tool['input'] }) {
  const [thumbs, setThumbs] = useState<string[]>([]); const [pageN, setPageN] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let dead = false;
    (async () => {
      setThumbs([]); setPageN(0); const f = files[0]; if (!f) return;
      if (input === 'pdf' || input === 'pdfs') {
        setBusy(true);
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const doc = await (window as any).pdfjsLib.getDocument({ data: bytes }).promise; if (dead) return;
          setPageN(doc.numPages); const out: string[] = []; const max = Math.min(doc.numPages, 12);
          for (let i = 1; i <= max; i++) { const page = await doc.getPage(i); const vp = page.getViewport({ scale: 0.4 }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise; if (dead) return; out.push(c.toDataURL('image/jpeg', 0.6)); }
          setThumbs(out);
        } catch { /* */ } finally { if (!dead) setBusy(false); }
      }
    })();
    return () => { dead = true; };
  }, [files, input]);

  if (input === 'images') return <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{files.map((f, i) => <div key={i} className="overflow-hidden rounded-lg border bg-slate-50"><img src={URL.createObjectURL(f)} alt="" className="h-28 w-full object-contain" /><div className="truncate px-1.5 py-1 text-[10px] text-slate-400">{f.name}</div></div>)}</div>;
  if (input.startsWith('office')) return <div className="flex items-center gap-3 rounded-lg border bg-slate-50 p-4"><span className="text-4xl">📄</span><div className="min-w-0"><p className="truncate font-semibold text-[#0A2540]">{files[0]?.name}</p><p className="text-xs text-slate-400">{files[0] && fmtSize(files[0].size)} · Tệp Office không xem trước được, bấm xử lý để chuyển sang PDF.</p></div></div>;
  return (
    <div>
      {busy && <p className="mb-2 text-center text-sm text-slate-400">Đang tạo bản xem trước…</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {thumbs.map((src, i) => <div key={i} className="overflow-hidden rounded-lg border bg-white shadow-sm"><img src={src} alt="" className="w-full" /><div className="bg-slate-50 py-0.5 text-center text-[10px] text-slate-400">Trang {i + 1}</div></div>)}
      </div>
      {pageN > thumbs.length && <p className="mt-2 text-center text-xs text-slate-400">… và {pageN - thumbs.length} trang nữa (tổng {pageN} trang)</p>}
    </div>
  );
}

// Bộ icon SVG gọn cho thanh nút trên thẻ ảnh.
const svgI = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'h-[15px] w-[15px]' };
const IcRotL = () => (<svg {...svgI}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>);
const IcRotR = () => (<svg {...svgI}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>);
const IcTrash = () => (<svg {...svgI}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>);

// Quản lý nhiều tệp (ảnh/PDF): thanh nút xoay/xem/xoá trên mỗi ảnh, kéo đổi vị trí, thêm/xoá, xem phóng to.
function MultiFileManager({ input, files, rots, onReorder, onDelete, onRotate, onAdd, onClear }: any) {
  const urls = useRef<Map<File, string>>(new Map());
  const urlFor = (f: File) => { let u = urls.current.get(f); if (!u) { u = URL.createObjectURL(f); urls.current.set(f, u); } return u; };
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current.clear(); }, []);
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number | null>(null); const [scale, setScale] = useState(1); const [pan, setPan] = useState({ x: 0, y: 0 }); const panDrag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [thumbs, setThumbs] = useState<Map<File, string>>(new Map());
  useEffect(() => { if (zoom === null) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null); else if (e.key === '+' || e.key === '=') setScale((s) => Math.min(5, +(s + 0.25).toFixed(2))); else if (e.key === '-') setScale((s) => Math.max(0.25, +(s - 0.25).toFixed(2))); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [zoom]);
  // Với tệp PDF: tạo ảnh XEM TRƯỚC trang 1 để người dùng nhận biết tệp (giống ảnh).
  useEffect(() => {
    if (input !== 'pdfs') return; let cancelled = false;
    (async () => {
      const pdfjsLib = (window as any).pdfjsLib; if (!pdfjsLib) return;
      for (const f of files as File[]) {
        if (thumbs.has(f)) continue;
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
          const page = await doc.getPage(1); const base = page.getViewport({ scale: 1 });
          const s = Math.min(2, 320 / Math.max(base.width, base.height));
          const vp = page.getViewport({ scale: s });
          const c = document.createElement('canvas'); c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
          const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext: g, viewport: vp }).promise;
          const url = c.toDataURL('image/jpeg', 0.7);
          if (!cancelled) setThumbs((m) => { const n = new Map(m); n.set(f, url); return n; });
        } catch { /* tệp lỗi → giữ icon 📄 */ }
      }
    })();
    return () => { cancelled = true; };
  }, [files, input]);
  const isImg = input === 'images';
  const stop = (e: any) => e.stopPropagation();
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{files.length} {isImg ? 'ảnh' : 'tệp'} · kéo để đổi thứ tự</p>
        <button onClick={onClear} className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Xoá tất cả</button>
      </div>
      <div className={isImg ? 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-5' : 'grid grid-cols-1 gap-2 sm:grid-cols-2'}>
        {files.map((f: File, i: number) => (
          <div key={i} draggable
            onDragStart={(e) => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => { e.preventDefault(); onReorder(dragFrom.current, i); dragFrom.current = null; setOver(null); }}
            onDragEnd={() => { dragFrom.current = null; setOver(null); }}
            className={`cursor-move select-none rounded-lg ${over === i ? 'ring-2 ring-emerald-500' : ''}`}>
            {isImg ? (
              <>
                <div className="mb-1 flex items-center justify-end gap-1.5">
                  <button onMouseDown={stop} onClick={(e) => { stop(e); onRotate(i, -1); }} title="Xoay trái 90°" className="grid h-[26px] w-[26px] place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"><IcRotL /></button>
                  <button onMouseDown={stop} onClick={(e) => { stop(e); onRotate(i, 1); }} title="Xoay phải 90°" className="grid h-[26px] w-[26px] place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"><IcRotR /></button>
                  <button onMouseDown={stop} onClick={(e) => { stop(e); onDelete(i); }} title="Xoá ảnh" className="grid h-[26px] w-[26px] place-items-center rounded-md border border-slate-200 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50"><IcTrash /></button>
                </div>
                <div onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); setZoom(i); }} className="grid h-32 place-items-center overflow-hidden rounded-lg border bg-white shadow-sm"><img src={urlFor(f)} draggable={false} alt="" className="max-h-32 max-w-full object-contain transition-transform" style={{ transform: `rotate(${rots[i] || 0}deg)` }} /></div>
                <div className="truncate px-1 pt-1 text-center text-[11px] text-slate-500">{f.name}</div>
              </>
            ) : (
              <div className="relative overflow-hidden rounded-lg border bg-slate-50">
                <span className="absolute left-1 top-1 z-10 grid h-5 min-w-[20px] place-items-center rounded-full bg-[#0A2540]/85 px-1 text-[10px] font-bold text-white">{i + 1}</span>
                <button onMouseDown={stop} onClick={(e) => { stop(e); onDelete(i); }} title="Xoá" className="absolute right-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs font-bold text-red-600 shadow hover:bg-red-50">✕</button>
                {thumbs.get(f)
                  ? <div onClick={(e) => { stop(e); window.open(urlFor(f), '_blank'); }} title="Bấm để xem tệp" className="grid h-32 cursor-pointer place-items-center overflow-hidden bg-white"><img src={thumbs.get(f)} draggable={false} alt="" className="max-h-32 max-w-full object-contain" /></div>
                  : <div className="flex h-32 flex-col items-center justify-center gap-1 bg-white text-slate-400"><span className="text-3xl">📄</span><span className="text-[10px]">Đang tạo xem trước…</span></div>}
                <div className="truncate px-2 py-1 text-center text-[11px] text-slate-500" title={f.name}>{f.name} · {fmtSize(f.size)}</div>
              </div>
            )}
          </div>
        ))}
        <button onClick={onAdd} className="flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-emerald-500 hover:text-emerald-600"><span className="text-2xl leading-none">＋</span><span className="text-[11px] font-medium">Thêm {isImg ? 'ảnh' : 'tệp'}</span></button>
      </div>
      {zoom !== null && files[zoom] && (
        <div onClick={() => setZoom(null)} onWheel={(e) => { stop(e); setScale((s) => Math.min(5, Math.max(0.25, +(s + (e.deltaY < 0 ? 0.2 : -0.2)).toFixed(2)))); }} className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black/80 p-4">
          <img
            onClick={stop}
            onDoubleClick={(e) => { stop(e); setPan({ x: 0, y: 0 }); setScale((s) => (s > 1 ? 1 : 2)); }}
            onPointerDown={(e) => { stop(e); (e.currentTarget as any).setPointerCapture?.(e.pointerId); panDrag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
            onPointerMove={(e) => { if (!panDrag.current) return; setPan({ x: panDrag.current.px + (e.clientX - panDrag.current.x), y: panDrag.current.py + (e.clientY - panDrag.current.y) }); }}
            onPointerUp={() => { panDrag.current = null; }}
            onPointerCancel={() => { panDrag.current = null; }}
            src={urlFor(files[zoom])}
            alt=""
            draggable={false}
            className="max-w-none cursor-grab touch-none select-none object-contain active:cursor-grabbing"
            style={{ maxHeight: '84vh', maxWidth: '94vw', transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rots[zoom] || 0}deg) scale(${scale})` }}
          />
          <button onClick={() => setZoom(null)} title="Đóng (Esc)" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-xl shadow hover:bg-white">✕</button>
          <div onClick={stop} className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-2 py-1.5 text-white shadow-lg">
            <button onClick={() => setScale((s) => Math.max(0.25, +(s - 0.25).toFixed(2)))} title="Thu nhỏ (−)" className="grid h-8 w-8 place-items-center rounded-full text-2xl leading-none hover:bg-white/20">−</button>
            <span className="w-12 select-none text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(5, +(s + 0.25).toFixed(2)))} title="Phóng to (+)" className="grid h-8 w-8 place-items-center rounded-full text-2xl leading-none hover:bg-white/20">+</button>
            <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} title="Về 100% & giữa" className="ml-1 rounded-full px-2.5 py-1 text-[11px] font-medium hover:bg-white/20">Gốc</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PdfHub({ onEdit, setBusy, embedded }: any) {
  const pdfjsLib = () => (window as any).pdfjsLib; const PDFLib = () => (window as any).PDFLib;
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState(''); const [active, setActive] = useState<Tool | null>(null);
  const [files, setFiles] = useState<File[]>([]); const [rots, setRots] = useState<number[]>([]); const [dirName, setDirName] = useState(''); const dirHandle = useRef<any>(null); const [useDir, setUseDir] = useState(false); const [outName, setOutName] = useState(''); const [drag, setDrag] = useState(false); const addMode = useRef(false);
  const [range, setRange] = useState(''); const [angle, setAngle] = useState(90); const [after, setAfter] = useState(1); const [quality, setQuality] = useState(0.4); const [wm, setWm] = useState('BẢN SAO'); const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [resultUrl, setResultUrl] = useState(''); const [working, setWorking] = useState(false); const [compressRows, setCompressRows] = useState<Array<{ name: string; before: number; after: number; url: string; blob: Blob }>>([]); const [compressSel, setCompressSel] = useState<Set<number>>(new Set()); const [outFiles, setOutFiles] = useState<Array<{ name: string; url: string }>>([]);

  const ctxOf = (s: any) => ({ pages: s?.pages || [], docs: s?.docs || {}, PDFLib: PDFLib(), pdfjsLib: pdfjsLib() });
  const loadSrc = async (file: File) => { const bytes = new Uint8Array(await file.arrayBuffer()); const doc = await pdfjsLib().getDocument({ data: bytes.slice() }).promise; const srcId = 'S' + Math.random().toString(36).slice(2, 6); const pgs = Array.from({ length: doc.numPages }, (_, i) => ({ id: 'p' + i, srcId, pageIndex: i, rot: 0 })); return { pages: pgs, docs: { [srcId]: { bytes, doc } } }; };

  const clearResult = () => setResultUrl((u) => { if (u) URL.revokeObjectURL(u); return ''; });
  const clearCompress = () => { setCompressSel(new Set()); setCompressRows((rows) => { rows.forEach((r) => URL.revokeObjectURL(r.url)); return []; }); };
  const clearOut = () => setOutFiles((rows) => { rows.forEach((r) => URL.revokeObjectURL(r.url)); return []; });
  const mb = (b: number) => (b / 1048576).toFixed(2) + ' MB';
  const pctDown = (before: number, after: number) => (before > 0 ? Math.max(0, Math.round((1 - after / before) * 100)) : 0);
  const dlUrl = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); };
  // Lưu 1 tệp kết quả: có thư mục mặc định → ghi THẲNG vào đó; không thì tải về Downloads.
  const saveRow = async (r: { name: string; blob: Blob }) => {
    if (useDir && dirHandle.current) { try { const fh = await dirHandle.current.getFileHandle(r.name, { create: true }); const ws = await fh.createWritable(); await ws.write(r.blob); await ws.close(); return; } catch { /* lỗi ghi → tải thường */ } }
    const u = URL.createObjectURL(r.blob); const a = document.createElement('a'); a.href = u; a.download = r.name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  const saveRows = async (rows: Array<{ name: string; blob: Blob }>) => { for (const r of rows) await saveRow(r); if (useDir && dirHandle.current && rows.length) toast.success(`Đã lưu ${rows.length} tệp vào 📁 ${dirName}`); };
  // Đã tạo tệp xong mà người dùng chỉnh sửa (thêm/bớt/xoay ảnh, đổi tên, đổi nơi lưu) → xoá kết quả cũ để nút "tải về" hiện lại.
  useEffect(() => { setResultUrl((u) => { if (u) URL.revokeObjectURL(u); return ''; }); setCompressSel(new Set()); setCompressRows((rows) => { rows.forEach((r) => URL.revokeObjectURL(r.url)); return []; }); setOutFiles((rows) => { rows.forEach((r) => URL.revokeObjectURL(r.url)); return []; }); setMsg(''); }, [files, rots, outName, useDir]);
  const enter = (t: Tool) => { if (t.engine === 'edit') return onEdit(); setActive(t); setFiles([]); setRots([]); setOutName(''); setMsg(''); setErr(''); clearResult(); clearCompress(); clearOut(); setPw(''); setRange(''); setDrag(false); };
  const back = () => { setActive(null); setFiles([]); setRots([]); setOutName(''); setMsg(''); setErr(''); clearResult(); clearCompress(); clearOut(); };
  // Chọn 1 lần thư mục lưu → lần sau lưu THẲNG vào đó (không hộp thoại). Bỏ tick = hỏi nơi lưu mỗi lần.
  const chooseDir = async () => {
    const w = window as any;
    if (!w.showDirectoryPicker) { setUseDir(false); return; }
    try {
      const h = await w.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
      try { if (h.requestPermission) await h.requestPermission({ mode: 'readwrite' }); } catch { /* cấp quyền sẵn để lần lưu sau không hỏi lại */ }
      dirHandle.current = h; setDirName(h.name || 'Thư mục đã chọn'); setUseDir(true); setErr('');
    } catch { /* Chrome chặn thư mục hệ thống HOẶC người dùng huỷ → im lặng, KHÔNG báo lỗi (app không kẹt, không popup) */ }
  };
  const clearDir = () => { dirHandle.current = null; setDirName(''); };
  const openPicker = (append = false) => { const el = fileInput.current; if (!el || !active) return; addMode.current = append && multiOf(active); el.accept = acceptOf(active); el.multiple = multiOf(active); el.value = ''; el.click(); };
  const takeArr = (arr: File[]) => {
    if (!arr.length || !active) return;
    if (addMode.current) { setFiles((p) => [...p, ...arr]); setRots((p) => [...p, ...arr.map(() => 0)]); }
    else if (multiOf(active)) { setFiles(arr); setRots(arr.map(() => 0)); }
    else { setFiles([arr[0]]); setRots([0]); }
    addMode.current = false; setMsg(''); setErr('');
  };
  // Quản lý danh sách tệp: đổi vị trí (kéo), xoá 1 tệp, xoay 1 ảnh, xoá tất cả.
  const moveItem = (from: number | null, to: number) => { if (from == null || from === to) return; const mv = (a: any[]) => { const b = [...a]; const [m] = b.splice(from, 1); b.splice(to, 0, m); return b; }; setFiles((p) => mv(p)); setRots((p) => mv(p)); };
  const delItem = (i: number) => { setFiles((p) => p.filter((_, k) => k !== i)); setRots((p) => p.filter((_, k) => k !== i)); setMsg(''); setErr(''); };
  const rotItem = (i: number, d = 1) => setRots((p) => p.map((r, k) => (k === i ? r + d * 90 : r))); // cộng dồn, không %360 để xoay LIÊN TỤC (không lật ngược ở lần 4)
  const clearAll = () => { setFiles([]); setRots([]); setMsg(''); setErr(''); };
  const takeFiles = (list: FileList | null) => { if (list && list.length) takeArr(Array.from(list)); };
  // Thả tệp vào BẤT KỲ ĐÂU trong khung: đã có ảnh → NỐI THÊM; chưa có → nạp mới. (Ngăn trình duyệt mở tệp.)
  const dropFiles = (e: any) => { e.preventDefault(); setDrag(false); if (active && multiOf(active) && files.length) addMode.current = true; takeFiles(e.dataTransfer.files); };
  // DÁN (Ctrl+V) ảnh/tệp từ clipboard thay vì chọn từ thư mục — tiện khi chụp màn hình.
  useEffect(() => {
    if (!active) return;
    const onPaste = (ev: ClipboardEvent) => { const dt = ev.clipboardData; if (!dt) return; const fs: File[] = []; for (const it of Array.from(dt.items || [])) { if (it.kind === 'file') { const g = it.getAsFile(); if (g) fs.push(g); } } if (!fs.length && dt.files) for (const g of Array.from(dt.files)) fs.push(g); if (fs.length) { ev.preventDefault(); if (multiOf(active)) { setFiles((p) => [...p, ...fs]); setRots((p) => [...p, ...fs.map(() => 0)]); } else { setFiles([fs[0]]); setRots([0]); } setMsg(''); setErr(''); } };
    window.addEventListener('paste', onPaste); return () => window.removeEventListener('paste', onPaste);
  }, [active]);

  const run = async (label: string, fn: () => Promise<any>) => { setWorking(true); setBusy(label); setMsg(''); setErr(''); setResultUrl((old) => { if (old) URL.revokeObjectURL(old); return ''; }); setOutFiles((rows) => { rows.forEach((r) => URL.revokeObjectURL(r.url)); return []; }); try { const r = await fn(); setMsg('✅ Hoàn tất.'); if (Array.isArray(r)) setOutFiles(r); else if (typeof r === 'string' && r) setResultUrl(r); } catch (e: any) { if (e?.cancelled) { setMsg(''); setErr(''); } else { setErr(''); toast.error(e?.message || String(e), 'Không thể xử lý'); } } finally { setWorking(false); setBusy(null); } };
  const doClient = async (t: Tool) => {
    // Nén NHIỀU tệp PDF → trả BẢNG đối chiếu (không tự tải; người dùng tải từ bảng).
    if (t.id === 'compress') { if (!files.length) throw new Error('Hãy chọn ít nhất 1 tệp PDF'); const rows = await ops.opCompressMany(files as any, quality, ctxOf(null)); setCompressRows((old) => { old.forEach((r) => URL.revokeObjectURL(r.url)); return rows; }); setCompressSel(new Set(rows.map((_, i) => i))); return; }
    // useDir mà CHƯA chọn thư mục → tải thẳng về Downloads (plain=true). Đã chọn thư mục → lưu thẳng vào đó. Bỏ tick → hỏi nơi lưu (Save As).
    if (t.input === 'images') { if (!files.length) throw new Error('Hãy chọn ít nhất 1 ảnh'); return ops.opImagesToPdf(ctxOf(null), files as any, rots, dirHandle.current, outName, useDir && !dirHandle.current); }
    if (t.input === 'pdfs') { if (!files.length) throw new Error('Hãy chọn ít nhất 1 tệp PDF'); return ops.opMerge(ctxOf(null), files as any, dirHandle.current, outName, useDir && !dirHandle.current); }
    if (!files.length) throw new Error('Hãy chọn 1 tệp PDF'); const ctx = ctxOf(await loadSrc(files[0]));
    if (t.id === 'split') return ops.opSplit(ctx);
    if (t.id === 'extract') return ops.opExtract(ctx, range);
    if (t.id === 'remove') return ops.opRemove(ctx, range);
    if (t.id === 'rotate') return ops.opRotate(ctx, angle, range);
    if (t.id === 'reverse') return ops.opReverse(ctx);
    if (t.id === 'blank') return ops.opBlank(ctx, after);
    if (t.id === 'pagenum') return ops.opPageNumbers(ctx);
    if (t.id === 'watermark') return ops.opWatermark(ctx, wm);
    if (t.id === 'pdf2png') return ops.opToImages(ctx, 'png');
    if (t.id === 'pdf2jpg') return ops.opToImages(ctx, 'jpg');
  };
  const doServer = async (t: Tool) => {
    const file = files[0]; if (!file) throw new Error('Hãy chọn tệp cần xử lý');
    if (t.op === 'encrypt' && !pw) throw new Error('Hãy nhập mật khẩu muốn đặt');
    const fd = new FormData(); fd.append('file', file, file.name || 'tai-lieu'); if (t.opts?.includes('password')) fd.append('pw', pw);
    const qs = new URLSearchParams(); if (t.to) qs.set('to', t.to); const token = getToken();
    const res = await fetch(`${apiBase}/pdftools/${t.op}?${qs.toString()}`, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: fd });
    if (!res.ok) { let m = ''; try { m = (await res.json()).error; } catch { m = ''; } throw new Error(m || `Máy chủ lỗi (mã ${res.status})`); }
    const blob = await res.blob(); const fb = (file.name || 'ket-qua').replace(/\.[^.]+$/, '') + '.' + (t.to || 'pdf');
    dlBlob(blob, cdName(res.headers.get('Content-Disposition'), fb));
  };
  const process = () => { const t = active!; const label = t.engine === 'server' ? 'Đang xử lý trên máy chủ… (10–60 giây)' : 'Đang xử lý…'; run(label, () => (t.engine === 'server' ? doServer(t) : doClient(t)) as Promise<void>); };

  const visible = useMemo(() => { const nq = norm(q.trim()); if (!nq) return CATS; return CATS.map((c) => ({ ...c, tools: c.tools.filter((t) => norm(t.name + ' ' + t.desc).includes(nq)) })).filter((c) => c.tools.length); }, [q]);

  return (
    <div className="flex flex-col bg-slate-100" style={{ height: 'calc(100dvh - var(--chrome-h, 56px))' }}>
      <div className="flex items-center gap-2 border-b bg-white px-4 py-2.5 shadow-sm">
        {!embedded && <button onClick={() => { window.location.href = '/'; }} title="Thoát" className="rounded px-2 py-1.5 text-sm hover:bg-slate-100">✕</button>}
        {active ? <button onClick={back} className="rounded px-2 py-1 text-sm font-medium hover:bg-slate-100">← Tất cả công cụ</button> : <b className="text-[#0A2540]">🧰 Công cụ PDF</b>}
        {!active && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm công cụ…" className="ml-2 w-32 flex-1 rounded-lg border px-3 py-1.5 text-sm sm:w-56 sm:flex-none" />}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        {active ? (
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-2xl">{active.icon}</span>
              <div><p className="text-lg font-bold text-[#0A2540]">{active.name}</p><p className="text-sm text-slate-500">{active.desc}</p></div>
              {active.engine === 'server' && <span className="ml-auto rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">Xử lý máy chủ</span>}
            </div>

            {multiOf(active) ? (
              /* Ảnh→PDF / Ghép PDF: MỘT hộp gồm ảnh + chọn thư mục, luôn hiện (kể cả khi trống) */
              <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={dropFiles} className={`mb-3 rounded-2xl border bg-white p-3 transition ${drag ? 'border-[#0A2540] ring-2 ring-[#0A2540]/20' : ''}`}>
                {!files.length ? (
                  <div onClick={() => openPicker()} className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? 'border-[#0A2540] bg-slate-50' : 'border-slate-300 hover:border-[#0A2540] hover:bg-slate-50'}`}>
                    <div className="text-4xl">⬆️</div><p className="text-base font-semibold text-[#0A2540]">Kéo thả {typeLabel(active)} vào đây</p><p className="text-sm text-slate-400">bấm để chọn từ máy · hoặc <b className="font-semibold text-slate-500">dán ảnh (Ctrl+V)</b></p>
                  </div>
                ) : (
                  <MultiFileManager input={active.input} files={files} rots={rots} onReorder={moveItem} onDelete={delItem} onRotate={rotItem} onAdd={() => openPicker(true)} onClear={clearAll} />
                )}
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  {active.id === 'compress' && (
                    <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700"><span className="font-medium">Mức nén:</span>
                      <select value={quality} onChange={(e) => setQuality(+e.target.value)} className="rounded-lg border px-3 py-1.5 text-sm">
                        <option value={0.4}>Nén mạnh (nhẹ nhất)</option>
                        <option value={0.6}>Vừa</option>
                        <option value={0.8}>Nén nhẹ (nét hơn)</option>
                      </select>
                    </label>
                  )}
                  <div>
                    <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" checked={useDir} onChange={(e) => { const on = e.target.checked; setUseDir(on); if (!on) clearDir(); }} className="h-4 w-4 accent-emerald-600" />
                      <span>Chọn thư mục mặc định để lưu</span>
                      <span className="text-[11px] text-slate-400">{active.id === 'compress' ? '(bỏ trống = tải về Downloads)' : '(bỏ trống = hỏi nơi lưu khi bấm tải)'}</span>
                    </label>
                    {useDir && (
                      <div className="mt-2.5 space-y-2.5 pl-7">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <button type="button" onClick={chooseDir} className="inline-flex w-32 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#0A2540] px-3 py-1.5 text-xs font-semibold text-[#0A2540] hover:bg-slate-50">📁 {dirName ? 'Đổi thư mục' : 'Chọn thư mục'}</button>
                          {dirName ? <b className="break-all text-[#0A2540]">📁 {dirName}</b> : <span className="text-[11px] text-emerald-600">Chưa chọn — sẽ tự động lưu vào Downloads</span>}
                        </div>
                        {active.id !== 'compress' && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <label htmlFor="pdfOutName" className="w-32 shrink-0">Tên tệp lưu:</label>
                            <span className="flex flex-1 items-center rounded-lg border bg-white px-3 focus-within:ring-2 focus-within:ring-emerald-400">
                              <input id="pdfOutName" value={outName} onChange={(e) => setOutName(e.target.value)} placeholder={active.input === 'images' ? 'AA 07535768' : 'ghep-pdf'} className="w-full bg-transparent py-1.5 outline-none" />
                              <span className="text-slate-400">.pdf</span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : !files.length ? (
              <div onClick={() => openPicker()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); takeFiles(e.dataTransfer.files); }} className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${drag ? 'border-[#0A2540] bg-slate-50' : 'border-slate-300 hover:border-[#0A2540] hover:bg-slate-50'}`}>
                <div className="text-5xl">⬆️</div><p className="text-lg font-semibold text-[#0A2540]">Kéo thả {typeLabel(active)} vào đây</p><p className="text-sm text-slate-400">bấm để chọn từ máy</p>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
                  <span className="text-lg">📄</span><span className="min-w-0 flex-1 truncate font-medium text-[#0A2540]">{files[0].name}</span>
                  <button onClick={() => openPicker(false)} className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-slate-50">Chọn tệp khác</button>
                </div>
                <div className="mb-3 rounded-xl border bg-white p-3"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Xem trước tệp</p><FilePreview files={files} input={active.input} /></div>

                {active.opts?.includes('range') && <label className="mb-3 block text-sm text-slate-600">Trang {active.id === 'extract' ? 'cần lấy' : 'cần xoá'} (vd: 1,3,5-7)<input value={range} onChange={(e) => setRange(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="1,3,5-7" /></label>}
                {active.opts?.includes('rotate') && <div className="mb-3 grid grid-cols-2 gap-3"><label className="block text-sm text-slate-600">Góc xoay<select value={angle} onChange={(e) => setAngle(+e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value={90}>90° phải</option><option value={180}>180°</option><option value={270}>90° trái</option></select></label><label className="block text-sm text-slate-600">Trang (trống = tất cả)<input value={range} onChange={(e) => setRange(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="tất cả" /></label></div>}
                {active.opts?.includes('blank') && <label className="mb-3 block text-sm text-slate-600">Chèn trang trắng sau trang số<input type="number" min={0} value={after} onChange={(e) => setAfter(+e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>}
                {active.opts?.includes('compress') && <label className="mb-3 block text-sm text-slate-600">Mức nén<select value={quality} onChange={(e) => setQuality(+e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value={0.4}>Nén mạnh (nhẹ nhất)</option><option value={0.6}>Vừa</option><option value={0.8}>Nén nhẹ (nét hơn)</option></select></label>}
                {active.opts?.includes('watermark') && <label className="mb-3 block text-sm text-slate-600">Chữ dấu mờ<input value={wm} onChange={(e) => setWm(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="BẢN SAO" /></label>}
                {active.opts?.includes('password') && <label className="mb-3 block text-sm text-slate-600">{active.id === 'encrypt' ? 'Mật khẩu muốn đặt' : 'Mật khẩu hiện tại (nếu có)'}<input type="text" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Nhập mật khẩu…" /></label>}
              </div>
            )}

            {files.length > 0 && (
              <>
                {err && <p className="mb-2 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
                {msg && active.id !== 'compress' && <p className="mb-2 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
                {compressRows.length > 0 && (
                  <>
                    <div className="mb-2 mt-2 overflow-hidden rounded-xl border">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-2 py-2"><input type="checkbox" checked={compressRows.length > 0 && compressSel.size === compressRows.length} onChange={(e) => setCompressSel(e.target.checked ? new Set(compressRows.map((_, i) => i)) : new Set())} className="h-4 w-4 align-middle accent-emerald-600" title="Chọn tất cả" /></th>
                            <th className="px-2 py-2 text-left font-semibold">Tệp</th>
                            <th className="px-2 py-2 text-right font-semibold">Trước</th>
                            <th className="px-2 py-2 text-right font-semibold">Sau</th>
                            <th className="px-2 py-2 text-right font-semibold">Giảm</th>
                            <th className="px-2 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {compressRows.map((r, i) => (
                            <tr key={i} className={`border-t ${compressSel.has(i) ? 'bg-emerald-50/40' : ''}`}>
                              <td className="px-2 py-2 text-center"><input type="checkbox" checked={compressSel.has(i)} onChange={() => setCompressSel((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className="h-4 w-4 align-middle accent-emerald-600" /></td>
                              <td className="max-w-[120px] truncate px-2 py-2 text-[#0A2540]" title={r.name}>{r.name}</td>
                              <td className="px-2 py-2 text-right tabular-nums text-slate-500">{mb(r.before)}</td>
                              <td className="px-2 py-2 text-right font-semibold tabular-nums text-[#0A2540]">{mb(r.after)}</td>
                              <td className="px-2 py-2 text-right font-bold tabular-nums text-emerald-600">−{pctDown(r.before, r.after)}%</td>
                              <td className="px-2 py-2"><div className="flex justify-end gap-1"><button onClick={() => window.open(r.url, '_blank')} className="rounded-lg border px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Xem</button><button onClick={() => saveRow(r)} className="rounded-lg border px-2 py-1 text-xs font-semibold text-[#0A2540] hover:bg-slate-50">Tải</button></div></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t bg-slate-50">
                          <tr>
                            <td className="px-2 py-2" />
                            <td className="px-2 py-2 text-xs font-bold text-slate-600">Tổng {compressRows.length} tệp</td>
                            <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums text-slate-500">{mb(compressRows.reduce((s, r) => s + r.before, 0))}</td>
                            <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-[#0A2540]">{mb(compressRows.reduce((s, r) => s + r.after, 0))}</td>
                            <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-emerald-600">−{pctDown(compressRows.reduce((s, r) => s + r.before, 0), compressRows.reduce((s, r) => s + r.after, 0))}%</td>
                            <td className="px-2 py-2" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button onClick={() => saveRows(compressRows.filter((_, i) => compressSel.has(i)))} disabled={compressSel.size === 0} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40">⬇ Tải {compressSel.size} tệp đã chọn</button>
                      <button onClick={() => saveRows(compressRows)} className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">Tải hết</button>
                    </div>
                  </>
                )}
                {outFiles.length > 0 && (
                  <div className="mb-3 mt-2 overflow-hidden rounded-xl border">
                    <div className="flex items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-bold text-slate-600">Đã tạo {outFiles.length} tệp</span>
                      <button onClick={() => outFiles.forEach((r) => dlUrl(r.url, r.name))} className="rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white hover:bg-emerald-700">Tải hết</button>
                    </div>
                    <div className="max-h-64 divide-y overflow-auto">
                      {outFiles.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-[#0A2540]" title={r.name}>{r.name}</span>
                          <button onClick={() => window.open(r.url, '_blank')} className="rounded-lg border px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Xem</button>
                          <button onClick={() => dlUrl(r.url, r.name)} className="rounded-lg border px-2 py-1 text-xs font-semibold text-[#0A2540] hover:bg-slate-50">Tải</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {active.id === 'compress' ? (
                  <button onClick={process} disabled={working} className="mt-1 w-full rounded-xl bg-emerald-600 py-3 text-base font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40">{working ? 'Đang nén…' : compressRows.length ? '↻ Nén lại' : `Nén ${files.length} tệp`}</button>
                ) : (
                  <>
                    {/* Đã tải xong → nút tải bị LÀM MỜ & KHÔNG bấm được (tránh tải trùng); chỉnh sửa gì đó sẽ tự bật lại. */}
                    <button onClick={process} disabled={working || !!resultUrl || outFiles.length > 0} className="mt-1 w-full rounded-xl bg-emerald-600 py-3 text-base font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">{working ? 'Đang xử lý…' : resultUrl ? '✓ Đã tải xong' : outFiles.length ? '✓ Đã tạo xong' : `${active.name} & tải về`}</button>
                    {resultUrl && <button onClick={() => window.open(resultUrl, '_blank')} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50">📄 Mở tệp vừa tạo để kiểm tra</button>}
                  </>
                )}
              </>
            )}
          </div>
        ) : visible.map((c) => (
          <div key={c.cat} className="mb-5">
            <p className={`mb-2 text-xs font-bold uppercase tracking-wide ${c.color}`}>{c.cat}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {c.tools.map((t) => <button key={t.id} onClick={() => enter(t)} title={t.desc} className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-left transition hover:border-[#0A2540] hover:bg-slate-50 ${t.engine === 'edit' ? 'border-[#C8A14B] bg-[#C8A14B]/5' : ''}`}><span className="text-2xl leading-none">{t.icon}</span><span className="min-w-0"><span className="block text-sm font-semibold text-[#0A2540]">{t.name}</span><span className="block truncate text-xs text-slate-400">{t.desc}</span></span></button>)}
            </div>
          </div>
        ))}
      </div>
      <input ref={fileInput} type="file" hidden onChange={(e) => takeFiles(e.target.files)} />
    </div>
  );
}
