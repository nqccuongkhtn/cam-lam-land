/* eslint-disable @typescript-eslint/no-explicit-any */
// Các thao tác PDF thuần trình duyệt (pdf-lib + pdf.js). Dùng cho bảng Công cụ (ToolsModal).

// Làm sạch tên tệp người dùng nhập (bỏ đuôi + ký tự cấm), có tên dự phòng.
export const safeName = (s: string, fb: string) => ((s || '').trim().replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|]+/g, ' ').trim() || fb);
// Tải THƯỜNG về thư mục Tải xuống (dùng cho thao tác tải NHIỀU tệp như tách trang — tránh bung nhiều hộp thoại).
export const dl = (bytes: any, name: string, type = 'application/pdf') => { const b = new Blob([bytes], { type }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
// Như dl nhưng KHÔNG thu hồi URL & TRẢ VỀ url — để bên gọi hiện nút "Mở tệp kiểm tra" (tools.tsx tự thu hồi sau).
export const dlReturn = (bytes: any, name: string, type = 'application/pdf'): string => { const b = new Blob([bytes], { type }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); return u; };
// Lưu kết quả:
//  • Có THƯ MỤC MẶC ĐỊNH (dir) → ghi THẲNG vào đó với tên đã đặt, KHÔNG hiện hộp thoại.
//  • Không có → mở hộp thoại để chọn nơi lưu; bấm HUỶ → ném { cancelled:true } (để khỏi báo "Hoàn tất").
//  • Trình duyệt không hỗ trợ → tải về thư mục Tải xuống.
export async function saveResult(bytes: any, name: string, dir?: any, plain?: boolean): Promise<string> {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const preview = URL.createObjectURL(blob); // URL để MỞ XEM lại tệp vừa tạo (bên gọi tự thu hồi khi cần)
  // plain = "tải theo trình duyệt" (về Tải xuống / theo cài đặt) — BỎ QUA thư mục & hộp thoại chọn nơi lưu.
  if (!plain && dir && dir.getFileHandle) {
    try { const fh = await dir.getFileHandle(name, { create: true }); const ws = await fh.createWritable(); await ws.write(blob); await ws.close(); return preview; }
    catch { /* lỗi quyền/ghi → rơi xuống hộp thoại/tải thường */ }
  }
  const w = window as any;
  if (!plain && w.showSaveFilePicker) {
    let handle: any = null;
    try { handle = await w.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Tệp PDF', accept: { 'application/pdf': ['.pdf'] } }] }); }
    catch (e: any) { if (e && e.name === 'AbortError') { URL.revokeObjectURL(preview); const c: any = new Error('Đã huỷ lưu tệp'); c.cancelled = true; throw c; } handle = null; }
    if (handle) { const ws = await handle.createWritable(); await ws.write(blob); await ws.close(); return preview; }
  }
  const a = document.createElement('a'); a.href = preview; a.download = name; a.click();
  return preview;
}

// Dựng 1 PDF mới từ các trang hiện có (giữ xoay). order = mảng chỉ số trang muốn lấy (mặc định: tất cả).
async function buildDoc(pages: any[], docs: any, PDFLib: any, order?: number[]) {
  const out = await PDFLib.PDFDocument.create(); const cache: Record<string, any> = {};
  const list = (order ? order.map((i) => pages[i]) : pages).filter(Boolean);
  for (const pg of list) { if (!cache[pg.srcId]) cache[pg.srcId] = await PDFLib.PDFDocument.load(docs[pg.srcId].bytes); const [cp] = await out.copyPages(cache[pg.srcId], [pg.pageIndex]); const p = out.addPage(cp); const extra = pg.rot || 0; if (extra) p.setRotation(PDFLib.degrees(((p.getRotation().angle || 0) + extra) % 360)); }
  return out;
}

// "1,3,5-7" -> [0,2,4,5,6] (0-based, trong [0,n))
export function parseRange(s: string, n: number): number[] {
  const idx = new Set<number>();
  (s || '').split(',').forEach((seg) => { const m = seg.trim().match(/^(\d+)\s*-\s*(\d+)$/); if (m) { let a = +m[1], b = +m[2]; if (a > b) { const t = a; a = b; b = t; } for (let i = a; i <= b; i++) idx.add(i - 1); } else if (/^\d+$/.test(seg.trim())) idx.add(+seg.trim() - 1); });
  return [...idx].filter((i) => i >= 0 && i < n).sort((a, b) => a - b);
}

export async function opMerge(ctx: any, files: FileList, dir?: any, outName?: string, plain?: boolean) {
  const { pages, docs, PDFLib } = ctx; const out = await buildDoc(pages, docs, PDFLib);
  for (const file of Array.from(files)) { const buf = new Uint8Array(await (file as File).arrayBuffer()); const src = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true }); const cps = await out.copyPages(src, src.getPageIndices()); cps.forEach((p: any) => out.addPage(p)); }
  return await saveResult(await out.save(), safeName(outName || '', 'ghep-pdf') + '.pdf', dir, plain);
}
export async function opSplit(ctx: any) {
  const { pages, docs, PDFLib } = ctx; const outFiles: Array<{ name: string; url: string }> = [];
  for (let i = 0; i < pages.length; i++) { const out = await buildDoc(pages, docs, PDFLib, [i]); const blob = new Blob([await out.save()], { type: 'application/pdf' }); outFiles.push({ name: `trang-${i + 1}.pdf`, url: URL.createObjectURL(blob) }); }
  return outFiles;
}
export async function opExtract(ctx: any, range: string) {
  const { pages, docs, PDFLib } = ctx; const order = parseRange(range, pages.length); if (!order.length) throw new Error('Nhập trang cần trích, vd: 1,3,5-7');
  return dlReturn(await (await buildDoc(pages, docs, PDFLib, order)).save(), 'trich-trang.pdf');
}
export async function opRemove(ctx: any, range: string) {
  const { pages, docs, PDFLib } = ctx; const rm = new Set(parseRange(range, pages.length)); if (!rm.size) throw new Error('Nhập trang cần xoá, vd: 2,4-6');
  const order = pages.map((_: any, i: number) => i).filter((i: number) => !rm.has(i)); if (!order.length) throw new Error('Không thể xoá hết tất cả các trang');
  return dlReturn(await (await buildDoc(pages, docs, PDFLib, order)).save(), 'xoa-trang.pdf');
}
export async function opRotate(ctx: any, angle: number, range: string, ten = 'xoay-trang.pdf') {
  const { pages, docs, PDFLib } = ctx; const sel = range.trim() ? new Set(parseRange(range, pages.length)) : null;
  const out = await PDFLib.PDFDocument.create(); const cache: Record<string, any> = {};
  for (let i = 0; i < pages.length; i++) { const pg = pages[i]; if (!cache[pg.srcId]) cache[pg.srcId] = await PDFLib.PDFDocument.load(docs[pg.srcId].bytes); const [cp] = await out.copyPages(cache[pg.srcId], [pg.pageIndex]); const p = out.addPage(cp); const extra = (pg.rot || 0) + (!sel || sel.has(i) ? angle : 0); if (extra) p.setRotation(PDFLib.degrees(((p.getRotation().angle || 0) + extra) % 360)); }
  return dlReturn(await out.save(), ten);
}
export async function opReverse(ctx: any) {
  const { pages, docs, PDFLib } = ctx; const order = pages.map((_: any, i: number) => i).reverse();
  return dlReturn(await (await buildDoc(pages, docs, PDFLib, order)).save(), 'dao-nguoc-trang.pdf');
}
export async function opBlank(ctx: any, after: number) {
  const { pages, docs, PDFLib } = ctx; const out = await buildDoc(pages, docs, PDFLib); const ps = out.getPages(); const ref = ps[Math.min(Math.max(after, 1), ps.length) - 1] || ps[0]; const sz = ref ? ref.getSize() : { width: 595, height: 842 }; const at = Math.min(Math.max(after, 0), out.getPageCount()); out.insertPage(at, [sz.width, sz.height]);
  return dlReturn(await out.save(), 'chen-trang-trang.pdf');
}
// NÉN ảnh trước khi nhúng: xoay (nếu cần) + thu nhỏ cạnh dài về tối đa maxSide + tái mã hoá JPEG chất lượng q.
// → giảm mạnh dung lượng PDF (ảnh điện thoại 3–5 MB thường còn vài trăm KB), vẫn đọc/in rõ.
async function imageToJpegBytes(file: File, rot: number, maxSide = 2000, q = 0.72): Promise<Uint8Array> {
  const url = URL.createObjectURL(file);
  try {
    const im: HTMLImageElement = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = url; });
    let w = im.naturalWidth || 1, h = im.naturalHeight || 1;
    const longest = Math.max(w, h);
    if (longest > maxSide) { const k = maxSide / longest; w = Math.round(w * k); h = Math.round(h * k); } // chỉ thu nhỏ, không phóng to
    const swap = rot === 90 || rot === 270;
    const c = document.createElement('canvas');
    c.width = swap ? h : w; c.height = swap ? w : h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); // nền trắng (JPEG không có kênh trong suốt)
    g.translate(c.width / 2, c.height / 2); g.rotate((rot * Math.PI) / 180); g.drawImage(im, -w / 2, -h / 2, w, h);
    const bin = atob(c.toDataURL('image/jpeg', q).split(',')[1]);
    const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } finally { URL.revokeObjectURL(url); }
}
export async function opImagesToPdf(ctx: any, files: File[], rots?: number[], dir?: any, outName?: string, plain?: boolean) {
  const { PDFLib } = ctx; const out = await PDFLib.PDFDocument.create();
  const arr = Array.from(files);
  for (let i = 0; i < arr.length; i++) {
    const file = arr[i] as File; const rot = (((rots?.[i] || 0) % 360) + 360) % 360;
    const bytes = await imageToJpegBytes(file, rot); // luôn nén về JPEG (nhẹ hơn nhiều)
    const img = await out.embedJpg(bytes);
    const p = out.addPage([img.width, img.height]); p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return await saveResult(await out.save(), safeName(outName || '', 'anh-thanh-pdf') + '.pdf', dir, plain);
}

// Rasterize 1 trang PDF (pdf.js) ra canvas theo scale + góc xoay đang có.
async function renderPage(docs: any, pg: any, scale: number): Promise<HTMLCanvasElement> {
  const doc = docs[pg.srcId].doc;
  const page = await doc.getPage(pg.pageIndex + 1);
  const rotation = (((pg.rot || 0) % 360) + 360) % 360;
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
  const g = canvas.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: g, viewport }).promise;
  return canvas;
}
const canvasToBytes = (canvas: HTMLCanvasElement, mime: string, q: number): Uint8Array => {
  const bin = atob(canvas.toDataURL(mime, q).split(',')[1]);
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};
// NÉN PDF: mỗi trang → ảnh JPEG (rasterize) rồi dựng lại PDF. Rất hiệu quả với PDF scan/ảnh.
export async function opCompress(ctx: any, quality = 0.6) {
  const { pages, docs, PDFLib } = ctx;
  const scale = quality <= 0.4 ? 1.3 : quality <= 0.6 ? 1.7 : 2.1; // mức nén càng mạnh → rasterize càng nhỏ
  const out = await PDFLib.PDFDocument.create();
  for (const pg of pages) {
    const canvas = await renderPage(docs, pg, scale);
    const img = await out.embedJpg(canvasToBytes(canvas, 'image/jpeg', quality));
    const vp1 = (await docs[pg.srcId].doc.getPage(pg.pageIndex + 1)).getViewport({ scale: 1, rotation: (((pg.rot || 0) % 360) + 360) % 360 });
    const p = out.addPage([vp1.width, vp1.height]);
    p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
  }
  dl(await out.save(), 'nen-pdf.pdf');
}

// Nén NHIỀU tệp PDF cùng lúc → trả BẢNG kết quả {tên, dung lượng trước/sau, url tải}. KHÔNG tự tải (để người dùng đối chiếu rồi tải).
export async function opCompressMany(files: File[], quality: number, ctxBase: any): Promise<Array<{ name: string; before: number; after: number; url: string; blob: Blob }>> {
  const { PDFLib, pdfjsLib } = ctxBase;
  const scale = quality <= 0.4 ? 1.3 : quality <= 0.6 ? 1.7 : 2.1;
  const rows: Array<{ name: string; before: number; after: number; url: string; blob: Blob }> = [];
  for (const file of Array.from(files)) {
    const src = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data: src.slice() }).promise;
    const out = await PDFLib.PDFDocument.create();
    for (let i = 0; i < doc.numPages; i++) {
      const page = await doc.getPage(i + 1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
      const g = canvas.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: g, viewport }).promise;
      const img = await out.embedJpg(canvasToBytes(canvas, 'image/jpeg', quality));
      const vp1 = page.getViewport({ scale: 1 });
      const p = out.addPage([vp1.width, vp1.height]);
      p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
    }
    const blob = new Blob([await out.save()], { type: 'application/pdf' });
    rows.push({ name: safeName(file.name, 'nen') + '-nen.pdf', before: file.size, after: blob.size, url: URL.createObjectURL(blob), blob });
  }
  return rows;
}

// PDF → ảnh (mỗi trang 1 tệp png/jpg).
export async function opToImages(ctx: any, fmt: 'png' | 'jpg' = 'png') {
  const { pages, docs } = ctx; const mime = fmt === 'png' ? 'image/png' : 'image/jpeg'; const outFiles: Array<{ name: string; url: string }> = [];
  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderPage(docs, pages[i], 2);
    const blob = new Blob([canvasToBytes(canvas, mime, 0.92) as BlobPart], { type: mime });
    outFiles.push({ name: `trang-${i + 1}.${fmt}`, url: URL.createObjectURL(blob) });
  }
  return outFiles;
}

// Đánh số trang "i / n" ở giữa mép dưới.
export async function opPageNumbers(ctx: any) {
  const { pages, docs, PDFLib } = ctx;
  const out = await buildDoc(pages, docs, PDFLib);
  const font = await out.embedFont(PDFLib.StandardFonts.Helvetica);
  const ps = out.getPages(); const n = ps.length;
  ps.forEach((p: any, i: number) => { const { width } = p.getSize(); const txt = `${i + 1} / ${n}`; const size = 10; const tw = font.widthOfTextAtSize(txt, size); p.drawText(txt, { x: (width - tw) / 2, y: 16, size, font, color: PDFLib.rgb(0.35, 0.35, 0.35) }); });
  return dlReturn(await out.save(), 'danh-so-trang.pdf');
}

// Chữ dấu mờ chìm nền (chéo 45°, mờ).
export async function opWatermark(ctx: any, text: string) {
  const { pages, docs, PDFLib } = ctx;
  const t = (text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').trim(); if (!t) throw new Error('Hãy nhập chữ dấu mờ');
  const out = await buildDoc(pages, docs, PDFLib);
  const font = await out.embedFont(PDFLib.StandardFonts.HelveticaBold);
  out.getPages().forEach((p: any) => { const { width, height } = p.getSize(); const size = Math.max(24, Math.min(width, height) / 8); const tw = font.widthOfTextAtSize(t, size); p.drawText(t, { x: width / 2 - (tw / 2) * Math.cos(Math.PI / 4), y: height / 2 - (tw / 2) * Math.sin(Math.PI / 4), size, font, color: PDFLib.rgb(0.6, 0.6, 0.6), rotate: PDFLib.degrees(45), opacity: 0.22 }); });
  return dlReturn(await out.save(), 'dau-mo.pdf');
}
