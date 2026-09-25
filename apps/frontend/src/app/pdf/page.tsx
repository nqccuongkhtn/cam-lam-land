'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element, react-hooks/exhaustive-deps */
// PDF EDITOR (dùng tạm). GIỮ NGUYÊN trang gốc; chỉ che+sửa ĐÚNG ô người dùng bấm. Xuất: sao chép trang gốc + vẽ overlay. Cuộn xem mọi trang. Nút 🧰 mở thêm công cụ.
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Ov, type PageRef, uid, fromHex, FAM, PageView, SignPad, XemTo } from './parts';
import { PdfHub } from './tools';
import { Toolbar } from './Toolbar';

const CDN = { pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', pdflib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', fontkit: 'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js' };
const FURL: Record<string, string> = { 'serif-400-0': 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/tinos/Tinos-Regular.ttf', 'serif-700-0': 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/tinos/Tinos-Bold.ttf', 'serif-400-1': 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/tinos/Tinos-Italic.ttf', 'serif-700-1': 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/tinos/Tinos-BoldItalic.ttf', 'sans-400-0': 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/arimo/Arimo-Regular.ttf', 'sans-700-0': 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/arimo/Arimo-Bold.ttf', 'sans-400-1': 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/arimo/Arimo-Italic.ttf', 'sans-700-1': 'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/arimo/Arimo-BoldItalic.ttf' };
const loadScript = (src: string) => new Promise<void>((res, rej) => { if (document.querySelector(`script[data-cdn="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.async = true; s.dataset.cdn = src; s.onload = () => res(); s.onerror = () => rej(new Error('Không tải được ' + src)); document.head.appendChild(s); });

// Kết xuất 1 dòng chữ ĐÃ SỬA thành ẢNH (dùng chính phông trên màn hình) rồi chèn vào PDF —
// luôn hiện đúng, khớp y hệt lúc sửa, KHÔNG phụ thuộc nhúng phông nên không bao giờ mất chữ.
function rasterizeLine(text: string, sizePt: number, color: number[], fam: string, bold: boolean, italic: boolean) {
  try {
    const scale = 4; const fontPx = sizePt * scale;
    const family = FAM[fam] || FAM.serif;
    const font = `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${fontPx}px ${family}`;
    const meas = document.createElement('canvas').getContext('2d')!; meas.font = font;
    const w = Math.max(1, Math.ceil(meas.measureText(text).width) + 4);
    const ascent = fontPx * 1.18, descent = fontPx * 0.42; const h = Math.ceil(ascent + descent);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d')!;
    ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = `rgb(${color.map((v) => Math.round(v * 255)).join(',')})`;
    ctx.fillText(text, 2, ascent);
    return { dataUrl: c.toDataURL('image/png'), wPt: w / scale, hPt: h / scale, ascentPt: ascent / scale };
  } catch { return null; }
}

export default function PdfEditorPage() {
  const [ready, setReady] = useState(false); const [mounted, setMounted] = useState(false); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setMounted(true); }, []);
  const docs = useRef<Record<string, { bytes: Uint8Array; doc: any }>>({});
  const [pages, setPages] = useState<PageRef[]>([]); const [ovByPage, setOvByPage] = useState<Record<string, Ov[]>>({});
  const [zoom, setZoom] = useState(1.15); const [tool, setTool] = useState<any>('edit'); const [color, setColor] = useState('#111111'); const [fontSize, setFontSize] = useState(14);
  const [xemTo, setXemTo] = useState<number | null>(null); // đang mở XEM TO ở trang nào (null = đóng)
  const [sel, setSel] = useState<string | null>(null); const [thumbs, setThumbs] = useState<Record<string, string>>({}); const [signOpen, setSignOpen] = useState(false); const [mode, setMode] = useState<'hub' | 'edit'>('hub');
  const itemsCache = useRef<Record<string, any[]>>({});
  const fileRef = useRef<HTMLInputElement | null>(null); const mergeRef = useRef<HTMLInputElement | null>(null); const imgRef = useRef<HTMLInputElement | null>(null);
  const pageEls = useRef<Record<string, HTMLDivElement | null>>({}); const pendImage = useRef<string | null>(null); const thumbDrag = useRef<number | null>(null);
  const [thumbOver, setThumbOver] = useState<number | null>(null);   // đang kéo lơ lửng trên trang nào (tô viền cho thấy sẽ thả vào đây)

  useEffect(() => { (async () => { try { await loadScript(CDN.pdfjs); (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.worker; await loadScript(CDN.pdflib); await loadScript(CDN.fontkit); setReady(true); } catch (e: any) { setErr(e?.message || 'Lỗi tải thư viện'); } })(); }, []);
  const setOv = useCallback((pid: string, fn: (a: Ov[]) => Ov[]) => setOvByPage((m) => ({ ...m, [pid]: fn(m[pid] || []) })), []);
  const renderThumb = useCallback(async (pg: PageRef) => { try { const page = await docs.current[pg.srcId].doc.getPage(pg.pageIndex + 1); const vp = page.getViewport({ scale: 0.2, rotation: (page.rotate + pg.rot) % 360 }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; setThumbs((t) => ({ ...t, [pg.id]: c.toDataURL('image/jpeg', 0.6) })); } catch { /* */ } }, []);
  const addFile = useCallback(async (file: File, merge: boolean) => { setBusy('Đang mở PDF…'); try { const bytes = new Uint8Array(await file.arrayBuffer()); const doc = await (window as any).pdfjsLib.getDocument({ data: bytes.slice() }).promise; const srcId = uid(); docs.current[srcId] = { bytes, doc }; const np: PageRef[] = Array.from({ length: doc.numPages }, (_, i) => ({ id: uid(), srcId, pageIndex: i, rot: 0 })); if (merge) setPages((p) => [...p, ...np]); else { itemsCache.current = {}; setOvByPage({}); setPages(np); } np.forEach(renderThumb); } catch (e: any) { setErr('Không mở được PDF: ' + (e?.message || e)); } finally { setBusy(null); } }, []);
  const onPickImage = useCallback(async (file: File) => { const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); }); const pid = pendImage.current || pages[0]?.id; if (!pid) return; setOv(pid, (a) => [...a, { id: uid(), kind: 'image', x: 150, y: 400, w: 140, h: 80, data }]); setTool('select'); }, [pages, setOv]);
  // buoc = 90 xoay phải, -90 xoay trái. Cộng thêm 360 rồi chia lấy dư để không ra số âm.
  const rotate = (i: number, buoc: number = 90) => { const xoay = (r: number) => (r + buoc + 360) % 360; setPages((p) => p.map((x, k) => (k === i ? { ...x, rot: xoay(x.rot) } : x))); const pg = pages[i]; if (pg) { delete itemsCache.current[pg.id]; setTimeout(() => renderThumb({ ...pg, rot: xoay(pg.rot) }), 0); } };
  const del = (i: number) => setPages((p) => p.filter((_, k) => k !== i));
  const moveThumb = (from: number, to: number) => setPages((p) => { const a = [...p]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; });

  const fontCache = useRef<Record<string, Uint8Array>>({});
  const getFont = async (fam: string, b: boolean, i: boolean): Promise<Uint8Array | null> => { const key = `${fam}-${b ? 700 : 400}-${i ? 1 : 0}`; if (fontCache.current[key]) return fontCache.current[key]; for (const u of [FURL[key], FURL[`serif-${b ? 700 : 400}-${i ? 1 : 0}`], FURL['serif-400-0']]) { try { const r = await fetch(u); if (r.ok) { const by = new Uint8Array(await r.arrayBuffer()); fontCache.current[key] = by; return by; } } catch { /* */ } } return null; };
  const exportPdf = useCallback(async (only?: number[]) => {
    const PDFLib = (window as any).PDFLib; if (!PDFLib) return; setBusy('Đang xuất PDF…');
    try {
      const out = await PDFLib.PDFDocument.create(); const sc: Record<string, any> = {};
      for (const pg of (only ? only.map((i) => pages[i]) : pages).filter(Boolean)) {
        if (!sc[pg.srcId]) sc[pg.srcId] = await PDFLib.PDFDocument.load(docs.current[pg.srcId].bytes);
        const [cp] = await out.copyPages(sc[pg.srcId], [pg.pageIndex]); const p = out.addPage(cp);
        for (const o of (ovByPage[pg.id] || [])) { try {
          if (o.kind === 'edit' || o.kind === 'text') { if (o.kind === 'edit') { if (o.text === o.orig) continue; p.drawRectangle({ x: o.wx, y: o.wy, width: o.ww, height: o.wh, color: PDFLib.rgb(...(o.bg as [number, number, number])) }); } const lines = o.text.split('\n'); for (let i = 0; i < lines.length; i++) { const ln = lines[i]; if (!ln) continue; const r = rasterizeLine(ln, o.size, o.color, o.fam, o.bold, o.italic); if (!r) continue; const raw = Uint8Array.from(atob(r.dataUrl.split(',')[1]), (ch) => ch.charCodeAt(0)); const im = await out.embedPng(raw); p.drawImage(im, { x: o.x, y: (o.y - i * o.size * 1.15) + r.ascentPt - r.hPt, width: r.wPt, height: r.hPt }); } }
          else if (o.kind === 'white') p.drawRectangle({ x: o.x, y: o.y, width: o.w, height: o.h, color: PDFLib.rgb(1, 1, 1) });
          else if (o.kind === 'rect') p.drawRectangle({ x: o.x, y: o.y, width: o.w, height: o.h, borderColor: PDFLib.rgb(...(o.color as [number, number, number])), borderWidth: 1.5 });
          else if (o.kind === 'highlight') p.drawRectangle({ x: o.x, y: o.y, width: o.w, height: o.h, color: PDFLib.rgb(...(o.color as [number, number, number])), opacity: 0.35 });
          else if (o.kind === 'draw') for (let i = 1; i < o.pts.length; i++) p.drawLine({ start: { x: o.pts[i - 1][0], y: o.pts[i - 1][1] }, end: { x: o.pts[i][0], y: o.pts[i][1] }, thickness: o.width, color: PDFLib.rgb(...(o.color as [number, number, number])) });
          else if (o.kind === 'image') { const raw = Uint8Array.from(atob(o.data.split(',')[1]), (c) => c.charCodeAt(0)); const im = o.data.startsWith('data:image/png') ? await out.embedPng(raw) : await out.embedJpg(raw); p.drawImage(im, { x: o.x, y: o.y, width: o.w, height: o.h }); }
        } catch { /* */ } }
        if (pg.rot) p.setRotation(PDFLib.degrees(((p.getRotation().angle || 0) + pg.rot) % 360));
      }
      const bytes = await out.save(); const blob = new Blob([bytes], { type: 'application/pdf' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'da-sua.pdf'; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { setErr('Lỗi xuất: ' + (e?.message || e)); } finally { setBusy(null); }
  }, [pages, ovByPage]);

  const selText = (() => { for (const pid in ovByPage) { const o = ovByPage[pid].find((x) => x.id === sel); if (o && (o.kind === 'text' || o.kind === 'edit')) return { pid, o: o as any }; } return null; })();
  const updateSel = (patch: any) => { if (selText) setOv(selText.pid, (a) => a.map((x) => x.id === sel ? { ...x, ...patch } as Ov : x)); };
  const deleteSel = () => { for (const pid in ovByPage) setOv(pid, (a) => a.filter((x) => x.id !== sel)); setSel(null); };

  if (!mounted) return <div style={{ height: 'calc(100dvh - var(--chrome-h, 56px))' }} className="grid place-items-center text-slate-400">Đang tải…</div>;
  if (err) return <div style={{ height: 'calc(100dvh - var(--chrome-h, 56px))' }} className="grid place-items-center bg-white p-8 text-center text-red-600 font-semibold">{err}</div>;
  if (!ready) return <div style={{ height: 'calc(100dvh - var(--chrome-h, 56px))' }} className="grid place-items-center bg-white text-slate-500">Đang tải trình soạn PDF…</div>;
  const embedded = new URLSearchParams(window.location.search).get('embed') === '1' || document.documentElement.classList.contains('embed');
  if (mode === 'hub') return <PdfHub onEdit={() => setMode('edit')} setBusy={setBusy} embedded={embedded} />;

  return (
    <div className="flex flex-col bg-slate-100" style={{ height: 'calc(100dvh - var(--chrome-h, 56px))' }}>
      <Toolbar tool={tool} setTool={setTool} selText={selText} updateSel={updateSel} color={color} setColor={setColor} fontSize={fontSize} setFontSize={setFontSize} zoom={zoom} setZoom={setZoom} sel={sel} deleteSel={deleteSel} hasPages={!!pages.length} onOpenPdf={() => fileRef.current?.click()} onMergePdf={() => mergeRef.current?.click()} onTools={() => setMode('hub')} onSign={() => setSignOpen(true)} onImageTool={() => { pendImage.current = pages[0]?.id || null; imgRef.current?.click(); }} onExport={() => exportPdf()} embedded={embedded} />
      {tool === 'edit' && pages.length > 0 && <div className="bg-amber-50 px-3 py-1 text-center text-xs text-amber-700">Chế độ <b>Sửa chữ</b> — bấm thẳng vào chữ cần sửa rồi gõ. <b>Chỉ chữ bạn thay đổi</b> mới được cập nhật, phần còn lại giữ nguyên 100% bản gốc. Cuộn xem mọi trang.</div>}
      {!pages.length ? (
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) addFile(f, false); }} className="m-auto flex w-[92%] max-w-xl flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="text-5xl">📄</div><p className="text-lg font-bold text-[#0B4045]">Kéo thả PDF vào đây, hoặc bấm “Mở PDF”</p>
          <p className="text-sm text-slate-500">Trang giữ nguyên như gốc; sửa đúng ô bạn bấm, thêm chữ/ảnh/chữ ký, bôi trắng, vẽ. Nút 🧰 Công cụ: ảnh↔PDF, đánh số, dấu mờ, nén… Cuộn xem mọi trang.</p>
          <button onClick={() => fileRef.current?.click()} className="mt-2 rounded-lg bg-red-600 px-6 py-2.5 font-bold text-white">Mở PDF</button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-36 shrink-0 overflow-y-auto border-r bg-white p-2 md:block">
            <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kéo trang để đổi thứ tự</p>
            {pages.map((pg, i) => (
              <div key={pg.id} draggable
                onDragStart={(e) => { thumbDrag.current = i; try { e.dataTransfer.effectAllowed = 'move'; } catch { /* */ } }}
                onDragOver={(e) => { e.preventDefault(); setThumbOver(i); }}
                onDragLeave={() => setThumbOver((o) => (o === i ? null : o))}
                onDragEnd={() => { thumbDrag.current = null; setThumbOver(null); }}
                onDrop={() => { if (thumbDrag.current != null) { moveThumb(thumbDrag.current, i); thumbDrag.current = null; } setThumbOver(null); }}
                onClick={() => pageEls.current[pg.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`group relative mb-2 cursor-move rounded border-2 ${thumbOver === i ? 'border-emerald-500' : 'border-transparent hover:border-[#0B4045]'}`}>
                {thumbs[pg.id] ? <img src={thumbs[pg.id]} alt="" className="w-full rounded" /> : <div className="grid h-24 place-items-center bg-slate-100 text-xs text-slate-400">…</div>}
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{i + 1}</span>
                <div className="cl-pdf-thumb-actions absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); rotate(i, -90); }} title="Xoay trái" className="rounded bg-white/90 px-1 text-[11px] shadow">↺</button>
                  <button onClick={(e) => { e.stopPropagation(); rotate(i, 90); }} title="Xoay phải" className="rounded bg-white/90 px-1 text-[11px] shadow">↻</button>
                  <button onClick={(e) => { e.stopPropagation(); setXemTo(i); }} title="Xem to" className="rounded bg-white/90 px-1 text-[11px] shadow">⤢</button>
                  <button onClick={(e) => { e.stopPropagation(); exportPdf([i]); }} title="Tải trang này" className="rounded bg-white/90 px-1 text-[11px] shadow">⬇</button>
                  <button onClick={(e) => { e.stopPropagation(); del(i); }} title="Xoá trang" className="rounded bg-white/90 px-1 text-[11px] text-red-600 shadow">✕</button>
                </div>
                {/* Đưa trang lên trên / xuống dưới một bậc — dùng khi không kéo thả được */}
                <div className="cl-pdf-thumb-actions absolute bottom-1 right-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); if (i > 0) moveThumb(i, i - 1); }} disabled={i === 0} title="Đưa lên trước một trang" className="rounded bg-white/90 px-1 text-[11px] shadow disabled:opacity-30">▲</button>
                  <button onClick={(e) => { e.stopPropagation(); if (i < pages.length - 1) moveThumb(i, i + 1); }} disabled={i >= pages.length - 1} title="Đẩy xuống sau một trang" className="rounded bg-white/90 px-1 text-[11px] shadow disabled:opacity-30">▼</button>
                </div>
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-4">
            {pages.map((pg, i) => (
              <div key={pg.id} ref={(el) => { pageEls.current[pg.id] = el; }} className="mx-auto mb-5 w-fit">
                <div className="mb-1 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <button onClick={() => rotate(i, -90)} title="Xoay trái 90°" aria-label="Xoay trái 90 độ" className="grid h-9 w-9 place-items-center rounded-lg bg-white text-base shadow-sm ring-1 ring-slate-300 transition active:scale-95 hover:bg-slate-50">↺</button>
                  <span className="min-w-[92px] text-center tabular-nums">Trang {i + 1}/{pages.length}</span>
                  <button onClick={() => rotate(i, 90)} title="Xoay phải 90°" aria-label="Xoay phải 90 độ" className="grid h-9 w-9 place-items-center rounded-lg bg-white text-base shadow-sm ring-1 ring-slate-300 transition active:scale-95 hover:bg-slate-50">↻</button>
                  <button onClick={() => setXemTo(i)} title="Xem to toàn màn hình" aria-label="Xem to toàn màn hình" className="grid h-9 w-9 place-items-center rounded-lg bg-white text-base shadow-sm ring-1 ring-slate-300 transition active:scale-95 hover:bg-slate-50">⤢</button>
                </div>
                <PageView pg={pg} doc={docs.current[pg.srcId]?.doc} zoom={zoom} tool={tool} color={color} fontSize={fontSize} ov={ovByPage[pg.id] || []} sel={sel} setSel={setSel} setOv={setOv} setTool={setTool} itemsCache={itemsCache} onImage={(pid: string) => { pendImage.current = pid; imgRef.current?.click(); }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {busy && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 text-white"><div className="rounded-lg bg-[#0B4045] px-6 py-3 font-semibold">{busy}</div></div>}
      {xemTo !== null && (
        <XemTo pages={pages} index={xemTo} docs={docs.current} onRotate={rotate} onClose={() => setXemTo(null)} />
      )}
      {signOpen && <SignPad onClose={() => setSignOpen(false)} onDone={(data) => { setSignOpen(false); const pid = pages[0]?.id; if (pid) { setOv(pid, (a) => [...a, { id: uid(), kind: 'image', x: 150, y: 300, w: 160, h: 60, data }]); setTool('select'); } }} />}
      <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && addFile(e.target.files[0], false)} />
      <input ref={mergeRef} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && addFile(e.target.files[0], true)} />
      <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onPickImage(e.target.files[0])} />
    </div>
  );
}
