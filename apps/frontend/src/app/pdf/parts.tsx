'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
// Thành phần PDF Editor. SỬA CHỮ TẠI CHỖ: trang giữ nguyên bản gốc; CHỈ chữ đã sửa mới được che nền + vẽ lại đúng vị trí/cỡ/màu. Chữ chưa đụng tới = nguyên vẹn.
import { useEffect, useRef, useState } from 'react';

export type Fam = 'serif' | 'sans' | 'tahoma' | 'calibri' | 'verdana';
export type Item = { x: number; y: number; size: number; w: number; h: number; str: string; fam: Fam; bold: boolean; italic: boolean; fg: number[]; bg: number[] };
export type PageRef = { id: string; srcId: string; pageIndex: number; rot: number };
export type Ov =
  | { id: string; kind: 'edit'; ii: number; orig: string; sx?: number; x: number; y: number; size: number; text: string; color: number[]; bg: number[]; fam: Fam; bold: boolean; italic: boolean; wx: number; wy: number; ww: number; wh: number }
  | { id: string; kind: 'text'; x: number; y: number; size: number; text: string; color: number[]; fam: Fam; bold: boolean; italic: boolean }
  | { id: string; kind: 'white'; x: number; y: number; w: number; h: number }
  | { id: string; kind: 'rect' | 'highlight'; x: number; y: number; w: number; h: number; color: number[] }
  | { id: string; kind: 'image'; x: number; y: number; w: number; h: number; data: string }
  | { id: string; kind: 'draw'; pts: [number, number][]; color: number[]; width: number };

export const uid = () => Math.random().toString(36).slice(2, 9);
export const fromHex = (h: string): number[] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const rs = (c: number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
export const FAM: Record<string, string> = { serif: '"Times New Roman", Tinos, serif', sans: 'Arial, Arimo, sans-serif', tahoma: 'Tahoma, "DejaVu Sans", sans-serif', calibri: 'Calibri, Carlito, sans-serif', verdana: 'Verdana, "DejaVu Sans", sans-serif' };
export const famCss = (f: Fam) => FAM[f] || FAM.serif;

// Lấy màu chữ (tối nhất) & màu nền (sáng nhất) quanh ô chữ, để che nền đúng màu và vẽ lại đúng màu.
function sampleFgBg(d: Uint8ClampedArray, W: number, H: number, x0: number, y0: number, x1: number, y1: number) {
  const rx = Math.max(0, Math.floor(Math.min(x0, x1))), ry = Math.max(0, Math.floor(Math.min(y0, y1)));
  const rw = Math.min(W - rx, Math.ceil(Math.abs(x1 - x0)) || 3), rh = Math.min(H - ry, Math.ceil(Math.abs(y1 - y0)) || 6);
  let dk = 999, lt = -1, fg = [0.06, 0.06, 0.06], bg = [1, 1, 1];
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) { const i = (y * W + x) * 4, lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; if (lum < dk) { dk = lum; fg = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]; } if (lum > lt) { lt = lum; bg = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]; } }
  return { fg, bg };
}
// Gộp các mảnh chữ (pdf.js cắt vụn theo từng lệnh vẽ) thành TỪNG DÒNG hoàn chỉnh -> sửa cả câu như Word.
// coVach(trước, sau) = giữa 2 mẩu chữ có ĐƯỜNG KẺ Ô dọc → không gom (6/10/2026: gom chữ 2 ô kế nhau thành 1 dòng làm
// ô trắng che chữ phủ lấn, MẤT nét kẻ giữa 2 cột bảng).
function groupLines(raw: Item[], coVach: (a: Item, b: Item) => boolean = () => false): Item[] {
  if (!raw.length) return [];
  const sorted = [...raw].sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));
  const lines: Item[] = []; let cur: Item[] = [];
  const flush = () => {
    if (!cur.length) return; cur.sort((a, b) => a.x - b.x); const first = cur[0], last = cur[cur.length - 1]; const size = Math.max(...cur.map((i) => i.size));
    let text = ''; for (let k = 0; k < cur.length; k++) { const it = cur[k]; if (k > 0) { const p = cur[k - 1]; const gap = it.x - (p.x + p.w); if (gap > size * 0.22 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' '; } text += it.str; }
    const fg = cur.reduce((m, i) => (i.fg[0] + i.fg[1] + i.fg[2] < m[0] + m[1] + m[2] ? i.fg : m), cur[0].fg);
    const bg = cur.reduce((m, i) => (i.bg[0] + i.bg[1] + i.bg[2] > m[0] + m[1] + m[2] ? i.bg : m), cur[0].bg);
    lines.push({ x: first.x, y: first.y, size, w: last.x + last.w - first.x, h: size, str: text, fam: first.fam, bold: first.bold, italic: first.italic, fg, bg }); cur = [];
  };
  for (const it of sorted) {
    if (!cur.length) { cur = [it]; continue; }
    const ref = cur[0], prev = cur[cur.length - 1]; const sameLine = Math.abs(it.y - ref.y) <= Math.max(2, ref.size * 0.5); const gap = it.x - (prev.x + prev.w);
    if (sameLine && gap <= ref.size * 8 && !coVach(prev, it)) cur.push(it); else { flush(); cur = [it]; }
  }
  flush(); return lines;
}
// Trích chữ (vị trí + cỡ + màu) rồi gộp thành DÒNG để bấm-sửa cả dòng. KHÔNG render lại, KHÔNG xoá — trang gốc nguyên vẹn.
export async function extractItems(page: any, vp: any, ctx: CanvasRenderingContext2D, W: number, H: number): Promise<Item[]> {
  const tc = await page.getTextContent(); const img = ctx.getImageData(0, 0, W, H).data; const its: Item[] = [];
  const co = (page as any).commonObjs; const nameCache: Record<string, string> = {};
  const realName = (fn: string) => { if (fn in nameCache) return nameCache[fn]; let r = ''; try { if (co?.has?.(fn)) { const fo: any = co.get(fn); r = String(fo?.name || fo?.loadedName || ''); } } catch { /* */ } nameCache[fn] = r; return r; };
  for (const it of tc.items as any[]) {
    if (!it.str || !it.str.trim()) continue; const [a, b, , , e, f] = it.transform; const size = Math.hypot(a, b) || Math.abs(it.height) || 12;
    const [x0, y0] = vp.convertToViewportPoint(e, f + size), [x1, y1] = vp.convertToViewportPoint(e + it.width, f);
    const { fg, bg } = sampleFgBg(img, W, H, x0, y0, x1, y1);
    // TỰ NHẬN PHÔNG: ưu tiên TÊN THẬT của phông nhúng; KHÔNG tin generic "sans-serif" của pdf.js (hay gán sai) → mặc định Times (chuẩn văn bản hành chính VN).
    const all = (realName(it.fontName || '') + ' ' + (it.fontName || '') + ' ' + (tc.styles?.[it.fontName]?.fontFamily || '')).toLowerCase();
    const fam: Fam = /tahoma/.test(all) ? 'tahoma' : /calibri|carlito/.test(all) ? 'calibri' : /verdana/.test(all) ? 'verdana' : /arial|helvet|nimbus\s?sans|liberation\s?sans|segoe|roboto|myriad|dejavu\s?sans|open\s?sans|noto\s?sans/.test(all) ? 'sans' : 'serif';
    its.push({ x: e, y: f, size, w: it.width, h: it.height || size, str: it.str, fg, bg, fam, bold: /bold|black|semibold|heavy/.test(all), italic: /italic|oblique/.test(all) });
  }
  // Dò ĐƯỜNG KẺ DỌC trong khoảng hở giữa 2 mẩu chữ: một cột điểm ảnh tối chạy suốt chiều cao dòng chữ = nét kẻ ô bảng.
  const coVach = (a: Item, b: Item) => {
    const [ax] = vp.convertToViewportPoint(a.x + a.w, a.y), [bx] = vp.convertToViewportPoint(b.x, b.y);
    const [, yt] = vp.convertToViewportPoint(a.x, a.y + a.size), [, yb] = vp.convertToViewportPoint(a.x, a.y);
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx)));
    const y0 = Math.max(0, Math.floor(Math.min(yt, yb))), y1 = Math.min(H - 1, Math.ceil(Math.max(yt, yb)));
    if (x1 - x0 < 1 || y1 - y0 < 3) return false;
    for (let x = x0; x <= x1; x++) {
      let toi = 0;
      for (let y = y0; y <= y1; y++) { const i = (y * W + x) * 4; if (0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2] < 205) toi++; } // < 205: nhận cả nét kẻ XÁM MẢNH (file Word in ra PDF hay có)
      if (toi >= (y1 - y0 + 1) * 0.85) return true;
    }
    return false;
  };
  return groupLines(its, coVach);
}

// 1 TRANG: render canvas gốc (1 lần / zoom). Ô bấm-sửa nổi lên trên; chữ đã sửa được che + gõ đè bằng HTML (không đụng canvas).
export function PageView({ pg, doc, zoom, tool, color, fontSize, ov, sel, setSel, setOv, setTool, itemsCache, onImage }: any) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null); const layerRef = useRef<HTMLDivElement | null>(null);
  const vpRef = useRef<any>(null); const [items, setItems] = useState<Item[]>([]); const [, force] = useState(0);
  const dragRef = useRef<any>(null); const moveDrag = useRef<any>(null);
  useEffect(() => { render(); }, [zoom, pg.rot]);
  async function render() {
    if (!canvasRef.current) return;
    const page = await doc.getPage(pg.pageIndex + 1);
    const vp = page.getViewport({ scale: zoom, rotation: (page.rotate + pg.rot) % 360 }); vpRef.current = vp;
    const canvas = canvasRef.current; canvas.width = vp.width; canvas.height = vp.height; const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    if (!itemsCache.current[pg.id]) { try { itemsCache.current[pg.id] = await extractItems(page, vp, ctx, canvas.width, canvas.height); } catch { itemsCache.current[pg.id] = []; } }
    setItems(itemsCache.current[pg.id]); force((v) => v + 1);
  }
  const pdfPt = (e: React.PointerEvent) => { const r = layerRef.current!.getBoundingClientRect(); return vpRef.current.convertToPdfPoint(e.clientX - r.left, e.clientY - r.top); };
  const startEdit = (it: Item, ii: number) => {
    // Ô che chữ cũ: vừa khít chữ (dưới = chân chữ g/y, trên = dấu mũ chữ hoa tiếng Việt) và KHÔNG lấn sang dòng trên/dưới.
    // Bản cũ cao 1,36 cỡ chữ → đè mất chân chữ dòng trên + dấu dòng dưới trong đoạn văn dòng sát (chủ dự án báo 6/10/2026).
    let top = it.y + it.size * 0.95, bot = it.y - it.size * 0.24;
    for (const o of items) {
      if (o === it || o.x > it.x + it.w || o.x + o.w < it.x) continue;          // không cùng cột chữ → bỏ qua
      if (o.y > it.y + 0.5 && o.y < it.y + it.size * 2) top = Math.min(top, Math.max(it.y + it.size * 0.7, o.y - o.size * 0.24 - 0.4));
      if (o.y < it.y - 0.5 && o.y > it.y - it.size * 2) bot = Math.max(bot, Math.min(it.y - it.size * 0.08, o.y + o.size * 0.95 + 0.4));
    }
    const box = { wx: it.x, wy: bot, ww: Math.max(it.w, it.size * 0.5), wh: top - bot };
    // ĐỘ GIÃN NGANG sx: phông nhúng trong PDF và phông của máy hiển thị rộng hẹp khác nhau → con trỏ gõ trôi lệch dần
    // so với chữ gốc (chủ dự án: "con trỏ lệch 2 ký tự", 6/10/2026). Đo bề rộng chữ gốc bằng phông máy rồi giãn/co cho khớp đúng
    // bề rộng trong PDF; khi xuất cũng giãn đúng tỉ lệ đó nên chữ mới cùng nhịp chữ cũ.
    let sx = 1;
    try { const c = document.createElement('canvas').getContext('2d')!; c.font = `${it.italic ? 'italic ' : ''}${it.bold ? '700' : '400'} 100px ${famCss(it.fam)}`; const w = c.measureText(it.str).width / 100 * it.size; if (w > 0 && it.w > 0) sx = Math.min(1.25, Math.max(0.8, it.w / w)); } catch { /* giữ 1 */ }
    const id = uid(); setOv(pg.id, (a: Ov[]) => [...a, { id, kind: 'edit', ii, orig: it.str, sx, x: it.x, y: it.y, size: it.size, text: it.str, color: it.fg, bg: it.bg, fam: it.fam, bold: it.bold, italic: it.italic, ...box }]);
    setSel(id);
  };
  const onDown = (e: React.PointerEvent) => {
    if (!vpRef.current) return; const [px, py] = pdfPt(e); const r = layerRef.current!.getBoundingClientRect(); const cx = e.clientX - r.left, cy = e.clientY - r.top;
    if (tool === 'text') { const id = uid(); setOv(pg.id, (a: Ov[]) => [...a, { id, kind: 'text', x: px, y: py, size: fontSize, text: 'Nhập chữ…', color: fromHex(color), fam: 'sans', bold: false, italic: false }]); setSel(id); setTool('select'); return; }
    if (tool === 'white' || tool === 'rect' || tool === 'highlight') { dragRef.current = { kind: tool, x0: cx, y0: cy, px0: px, py0: py }; return; }
    if (tool === 'draw') { dragRef.current = { kind: 'draw', pts: [[px, py]] }; return; }
    if (tool === 'image') onImage(pg.id);
  };
  const onMove = (e: React.PointerEvent) => { const d = dragRef.current; if (!d || !vpRef.current) return; const [px, py] = pdfPt(e); const r = layerRef.current!.getBoundingClientRect(); if (d.kind === 'draw') d.pts.push([px, py]); else { d.cx = e.clientX - r.left; d.cy = e.clientY - r.top; d.px = px; d.py = py; } force((v) => v + 1); };
  const onUp = () => { const d = dragRef.current; dragRef.current = null; if (!d) return; if (d.kind === 'draw') { if (d.pts.length > 1) setOv(pg.id, (a: Ov[]) => [...a, { id: uid(), kind: 'draw', pts: d.pts, color: fromHex(color), width: 2 }]); setTool('select'); return; } if (d.px == null) return; const x = Math.min(d.px0, d.px), y = Math.min(d.py0, d.py), w = Math.abs(d.px - d.px0), h = Math.abs(d.py - d.py0); if (w < 2 || h < 2) return; const id = uid(); if (d.kind === 'white') setOv(pg.id, (a: Ov[]) => [...a, { id, kind: 'white', x, y, w, h }]); else setOv(pg.id, (a: Ov[]) => [...a, { id, kind: d.kind, x, y, w, h, color: d.kind === 'highlight' ? [1, 0.92, 0.23] : fromHex(color) }]); setSel(id); setTool('select'); };
  const startMove = (e: React.PointerEvent, o: Ov) => { if (tool !== 'select') return; e.stopPropagation(); setSel(o.id); const r = layerRef.current!.getBoundingClientRect(); moveDrag.current = { sx: e.clientX - r.left, sy: e.clientY - r.top, o }; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onMoveOv = (e: React.PointerEvent) => { const m = moveDrag.current; if (!m || !vpRef.current) return; const r = layerRef.current!.getBoundingClientRect(); const [px, py] = vpRef.current.convertToPdfPoint(e.clientX - r.left, e.clientY - r.top); const [px0, py0] = vpRef.current.convertToPdfPoint(m.sx, m.sy); const dx = px - px0, dy = py - py0; const o = m.o; if (o.kind === 'draw') setOv(pg.id, (a: Ov[]) => a.map((z) => z.id === o.id ? { ...z, pts: (o as any).pts.map((p: number[]) => [p[0] + dx, p[1] + dy]) } as Ov : z)); else setOv(pg.id, (a: Ov[]) => a.map((z) => z.id === o.id ? { ...z, x: (o as any).x + dx, y: (o as any).y + dy } as Ov : z)); };
  const endMove = () => { moveDrag.current = null; };
  const vp = vpRef.current;
  const edited = new Set<number>(); (ov as Ov[]).forEach((o) => { if (o.kind === 'edit') edited.add(o.ii); });

  return (
    <div ref={layerRef} className="relative w-fit bg-white shadow-lg" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ cursor: tool === 'select' || tool === 'edit' ? 'default' : 'crosshair' }}>
      <canvas ref={canvasRef} className="block" />
      <div className="pointer-events-none absolute inset-0">
        {vp && tool === 'edit' && items.map((it, i) => { if (edited.has(i)) return null; const [vx, vy] = vp.convertToViewportPoint(it.x, it.y + it.size); const [vx2] = vp.convertToViewportPoint(it.x + it.w, it.y); return <div key={i} onClick={(e) => { e.stopPropagation(); startEdit(it, i); }} className="pointer-events-auto absolute cursor-text rounded-sm hover:bg-yellow-300/40 hover:outline hover:outline-1 hover:outline-yellow-500/70" style={{ left: vx, top: vy, width: Math.max(6, vx2 - vx), height: it.size * zoom * 1.3 }} title={`Bấm để sửa: ${it.str}`} />; })}
        {vp && (ov as Ov[]).map((o) => <OverlayView key={o.id} o={o} vp={vp} zoom={zoom} sel={sel === o.id} tool={tool} onDown={(e: any) => startMove(e, o)} onMoveP={onMoveOv} onUpP={endMove} onText={(t: string) => setOv(pg.id, (a: Ov[]) => a.map((z) => z.id === o.id ? { ...z, text: t } as Ov : z))} onSelect={() => setSel(o.id)} />)}
        {vp && <DragPreview drag={dragRef.current} vp={vp} />}
      </div>
    </div>
  );
}

export function OverlayView({ o, vp, zoom, sel, tool, onDown, onMoveP, onUpP, onText, onSelect }: any) {
  const editRef = useRef<HTMLDivElement | null>(null); const [cur, setCur] = useState(o.text);
  useEffect(() => { setCur(o.text); }, [o.text]);
  // Nạp chữ ban đầu 1 lần qua ref rồi để contentEditable tự quản (KHÔNG render {o.text} làm children — tránh React reset text node làm con trỏ nhảy khi gõ/xoá).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (editRef.current) editRef.current.innerText = o.text; }, []);
  useEffect(() => { const el = editRef.current; if (el && document.activeElement !== el && el.innerText !== o.text) el.innerText = o.text; }, [o.text]);
  useEffect(() => { if (sel && editRef.current && (o.kind === 'edit' || o.kind === 'text')) { const el = editRef.current; el.focus(); const rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(false); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(rg); } }, [sel]);
  const peText = tool === 'select' || tool === 'edit' ? 'auto' : 'none'; const peShape = tool === 'select' ? 'auto' : 'none';

  if (o.kind === 'draw') { const pts = o.pts.map((p: number[]) => vp.convertToViewportPoint(p[0], p[1])); const d = pts.map((p: number[], i: number) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' '); return <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"><path d={d} fill="none" stroke={rs(o.color)} strokeWidth={o.width * zoom} strokeLinecap="round" strokeLinejoin="round" /></svg>; }

  if (o.kind === 'text' || o.kind === 'edit') {
    const dirty = o.kind === 'edit' ? cur !== o.orig : true;
    const [sx, sy] = vp.convertToViewportPoint(o.x, o.y); const fpx = o.size * zoom;
    const border = sel ? '1px solid #0A2540' : '1px dashed transparent';
    return (
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {o.kind === 'edit' && dirty && (() => { const [wx, wy] = vp.convertToViewportPoint(o.wx, o.wy + o.wh); return <div className="absolute" style={{ left: wx, top: wy, width: o.ww * zoom, height: o.wh * zoom, background: rs(o.bg) }} />; })()}
        <div style={{ position: 'absolute', left: sx, top: sy - fpx * 0.80, pointerEvents: peText, transform: o.kind === 'edit' && o.sx ? `scaleX(${o.sx})` : undefined, transformOrigin: 'left top' }}>
          {sel && tool === 'select' && <div onPointerDown={onDown} onPointerMove={onMoveP} onPointerUp={onUpP} title="Kéo di chuyển" style={{ position: 'absolute', left: -16, top: -6, width: 13, height: 13, cursor: 'move', background: '#0A2540', borderRadius: 3 }} />}
          <div ref={editRef} contentEditable suppressContentEditableWarning spellCheck={false} onFocus={onSelect} onInput={(e) => setCur(e.currentTarget.innerText)} onBlur={(e) => onText(e.currentTarget.innerText)} style={{ fontSize: fpx, lineHeight: 1.0, color: dirty ? rs(o.color) : 'transparent', caretColor: rs(o.color), border, padding: 0, fontFamily: famCss(o.fam), fontWeight: o.bold ? 700 : 400, fontStyle: o.italic ? 'italic' : 'normal', whiteSpace: 'pre', outline: 'none', cursor: 'text', minWidth: 8 }} />
        </div>
      </div>
    );
  }
  const [tlx, tly] = vp.convertToViewportPoint(o.x, o.y + (o.h || 0)); const w = (o.w || 0) * zoom, h = (o.h || 0) * zoom; const border = sel ? '1.5px solid #0A2540' : '1px dashed transparent';
  return (
    <div onPointerDown={onDown} onPointerMove={onMoveP} onPointerUp={onUpP} onClick={(e) => { e.stopPropagation(); onSelect(); }} className="absolute" style={{ left: tlx, top: tly, width: w, height: h, cursor: tool === 'select' ? 'move' : 'default', border, pointerEvents: peShape }}>
      {o.kind === 'white' && <div className="h-full w-full bg-white" />}
      {o.kind === 'rect' && <div className="h-full w-full" style={{ border: `1.5px solid ${rs(o.color)}` }} />}
      {o.kind === 'highlight' && <div className="h-full w-full" style={{ background: rs(o.color), opacity: 0.35 }} />}
      {o.kind === 'image' && <img src={o.data} alt="" className="h-full w-full object-fill" draggable={false} />}
    </div>
  );
}
export function DragPreview({ drag, vp }: any) {
  if (!drag) return null;
  if (drag.kind === 'draw' && drag.pts?.length > 1) { const pts = drag.pts.map((p: number[]) => vp.convertToViewportPoint(p[0], p[1])); const d = pts.map((p: number[], i: number) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' '); return <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"><path d={d} fill="none" stroke="#0A2540" strokeWidth={2} strokeLinecap="round" /></svg>; }
  if (drag.px == null) return null; const x = Math.min(drag.x0, drag.cx), y = Math.min(drag.y0, drag.cy), w = Math.abs(drag.cx - drag.x0), h = Math.abs(drag.cy - drag.y0);
  const bg = drag.kind === 'white' ? 'rgba(255,255,255,0.85)' : drag.kind === 'highlight' ? 'rgba(255,235,59,0.35)' : 'transparent';
  return <div className="absolute border border-[#0A2540]" style={{ left: x, top: y, width: w, height: h, background: bg }} />;
}
export function SignPad({ onClose, onDone }: { onClose: () => void; onDone: (d: string) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null); const drawing = useRef(false);
  useEffect(() => { const ctx = ref.current!.getContext('2d')!; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#0A2540'; }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="rounded-xl bg-white p-4 shadow-2xl"><p className="mb-2 font-bold text-[#0A2540]">Ký tên (kéo chuột)</p>
        <canvas ref={ref} width={420} height={160} className="touch-none rounded border bg-white" onPointerDown={(e) => { drawing.current = true; const [x, y] = pos(e); const c = ref.current!.getContext('2d')!; c.beginPath(); c.moveTo(x, y); }} onPointerMove={(e) => { if (!drawing.current) return; const [x, y] = pos(e); const c = ref.current!.getContext('2d')!; c.lineTo(x, y); c.stroke(); }} onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)} />
        <div className="mt-3 flex justify-end gap-2"><button onClick={() => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); }} className="rounded border px-3 py-1.5 text-sm">Xoá</button><button onClick={onClose} className="rounded border px-3 py-1.5 text-sm">Huỷ</button><button onClick={() => onDone(ref.current!.toDataURL('image/png'))} className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white">Chèn</button></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  XEM TO — mở hồ sơ ra TOÀN MÀN HÌNH, CUỘN/VUỐT qua từng trang như đọc sách,
//  thấy trang nào nằm ngang thì xoay ngay trang đó.
//  · Cuộn chuột hoặc vuốt ngón tay để lướt qua các trang (không bắt buộc bấm nút).
//  · Số trang trên thanh công cụ TỰ ĐỔI theo trang đang nhìn thấy.
//  · Nút xoay tác động lên ĐÚNG trang đang xem, và là xoay THẬT — xuất file ra vẫn giữ chiều.
//  · Phóng to/thu nhỏ chỉ để nhìn, không đụng vào file.
//  Trang chỉ được vẽ khi sắp lướt tới (đỡ nặng máy với hồ sơ nhiều trang).
// ═══════════════════════════════════════════════════════════════════════════════
function NutXem({ onClick, disabled, title, children }: any) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={title}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg leading-none text-white transition hover:bg-white/15 active:scale-90 disabled:opacity-30">
      {children}
    </button>
  );
}

/** Một trang trong bộ xem. Chỉ vẽ khi đã lướt tới gần (tiết kiệm máy). */
function TrangXem({ pg, doc, zoom, onDo }: any) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [gan, setGan] = useState(false);

  // Báo cho bộ xem biết khung của trang này (để tính trang đang nhìn thấy) + bật vẽ khi tới gần
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    onDo(pg.id, el);
    const ob = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setGan(true); }, { rootMargin: '800px 0px' });
    ob.observe(el);
    return () => ob.disconnect();
  }, [pg.id]);

  useEffect(() => { if (gan) ve(); /* eslint-disable-next-line */ }, [gan, zoom, pg.rot, doc]);
  async function ve() {
    if (!doc || !canvasRef.current) return;
    const page = await doc.getPage(pg.pageIndex + 1);
    const vp = page.getViewport({ scale: zoom, rotation: (page.rotate + pg.rot) % 360 });
    const c = canvasRef.current; c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
  }

  return (
    <div ref={boxRef} className="mb-5 flex justify-center">
      <canvas ref={canvasRef} className="block rounded bg-white shadow-2xl" style={{ minHeight: gan ? undefined : 320, minWidth: gan ? undefined : 240 }} />
    </div>
  );
}

export function XemTo({ pages, index, docs, onRotate, onClose }: any) {
  const cuonRef = useRef<HTMLDivElement | null>(null);
  const khungRef = useRef<Record<string, HTMLElement>>({});
  const [zoom, setZoom] = useState(0);      // 0 = chưa tính → tự tính cho vừa màn hình
  const [hien, setHien] = useState(index);  // trang đang nhìn thấy
  const daNhay = useRef(false);             // đã nhảy tới trang mở đầu chưa

  const ghiKhung = (id: string, el: HTMLElement) => { khungRef.current[id] = el; };

  // Tính cỡ cho vừa màn hình, dựa trên trang đang mở
  useEffect(() => {
    (async () => {
      const pg = pages[index]; const doc = docs?.[pg?.srcId]?.doc;
      if (!pg || !doc) return;
      const page = await doc.getPage(pg.pageIndex + 1);
      const g = page.getViewport({ scale: 1, rotation: (page.rotate + pg.rot) % 360 });
      const vua = Math.min((window.innerWidth - 40) / g.width, (window.innerHeight - 110) / g.height);
      setZoom(Math.max(0.15, Math.min(vua, 4)));
    })();
    /* eslint-disable-next-line */
  }, []);

  // Mở ra là nhảy thẳng tới trang bạn vừa bấm
  useEffect(() => {
    if (daNhay.current || !zoom) return;
    const el = khungRef.current[pages[index]?.id];
    if (el) { el.scrollIntoView({ block: 'start' }); daNhay.current = true; }
  }, [zoom, index, pages]);

  // CUỘN/VUỐT tới đâu thì số trang đổi tới đó — không cần bấm nút
  useEffect(() => {
    const box = cuonRef.current; if (!box) return;
    const doTrang = () => {
      const giua = box.scrollTop + box.clientHeight / 2;
      let tot = 0, min = Infinity;
      pages.forEach((pg: any, i: number) => {
        const el = khungRef.current[pg.id]; if (!el) return;
        const tam = el.offsetTop + el.offsetHeight / 2;
        const d = Math.abs(tam - giua);
        if (d < min) { min = d; tot = i; }
      });
      setHien(tot);
    };
    box.addEventListener('scroll', doTrang, { passive: true });
    doTrang();
    return () => box.removeEventListener('scroll', doTrang);
  }, [pages, zoom]);

  const toiTrang = (i: number) => {
    const k = Math.max(0, Math.min(pages.length - 1, i));
    khungRef.current[pages[k]?.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const thuNho = () => setZoom((z) => Math.max(0.15, +(z - 0.2).toFixed(2)));
  const phongTo = () => setZoom((z) => Math.min(6, +(z + 0.2).toFixed(2)));

  // Phím tắt: ← → / PageUp PageDown chuyển trang · + − phóng thu · Esc đóng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') toiTrang(hien - 1);
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') toiTrang(hien + 1);
      else if (e.key === '+' || e.key === '=') phongTo();
      else if (e.key === '-') thuNho();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!pages.length) return null;
  const vach = <span className="mx-1 h-5 w-px shrink-0" style={{ background: 'rgba(255,255,255,.25)' }} />;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'rgba(0,0,0,.88)' }}>
      <div className="pointer-events-none flex shrink-0 justify-center p-3">
        <div className="pointer-events-auto flex items-center gap-0.5 overflow-x-auto rounded-2xl px-2 py-1.5 shadow-2xl" style={{ background: '#2f2f2f' }}>
          <NutXem onClick={() => toiTrang(hien - 1)} disabled={hien <= 0} title="Trang trước">‹</NutXem>
          <span className="min-w-[74px] select-none text-center text-sm font-semibold tabular-nums text-white">{hien + 1} / {pages.length}</span>
          <NutXem onClick={() => toiTrang(hien + 1)} disabled={hien >= pages.length - 1} title="Trang sau">›</NutXem>
          {vach}
          <NutXem onClick={thuNho} title="Thu nhỏ">－</NutXem>
          <NutXem onClick={phongTo} title="Phóng to">＋</NutXem>
          {vach}
          <NutXem onClick={() => onRotate(hien, -90)} title="Xoay trái trang đang xem">↺</NutXem>
          <NutXem onClick={() => onRotate(hien, 90)} title="Xoay phải trang đang xem">↻</NutXem>
          {vach}
          <NutXem onClick={onClose} title="Đóng (Esc)">✕</NutXem>
        </div>
      </div>
      <div ref={cuonRef} className="scroll-soft min-h-0 flex-1 overflow-auto overscroll-contain p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {pages.map((pg: PageRef) => (
          <TrangXem key={pg.id} pg={pg} doc={docs?.[pg.srcId]?.doc} zoom={zoom || 1} onDo={ghiKhung} />
        ))}
      </div>
    </div>
  );
}
