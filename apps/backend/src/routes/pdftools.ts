// CÔNG CỤ PDF XỬ LÝ MÁY CHỦ (dùng tạm — sau tách web dễ gỡ: xoá file này + 1 dòng đăng ký index.ts).
// convert: Office↔PDF (LibreOffice) + PDF→Excel/CSV/Text (pdftotext, giữ khung bảng), chọn trang, tự OCR khi tệp là ảnh · ocr: PDF ảnh -> PDF tìm được chữ (ocrmypdf, tiếng Việt) · encrypt/decrypt: đặt/gỡ mật khẩu (qpdf).
import { Router } from 'express';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { writeFile, readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const pdftoolsRouter = Router();
// GIỚI HẠN 25MB (trước 60MB). Công cụ này KHÔNG cần đăng nhập, mà mỗi lần gọi là máy chủ è cổ
// chạy LibreOffice/OCR — để file quá lớn thì chỉ cần vài người gửi liên tục là máy ở nhà đơ, cả web sập.
// 25MB vẫn thừa cho hồ sơ nhà đất (sổ đỏ scan cỡ 2-8MB).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const CT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
};

function run(cmd: string, args: string[], opts: any = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: opts.timeout || 150000, maxBuffer: 64 * 1024 * 1024 }, (err: any, stdout, stderr) => {
      if (err && !(opts.okCodes || []).includes(err.code)) { err.stderr = String(stderr || ''); return reject(err); }
      resolve(String(stdout || '') + String(stderr || ''));
    });
  });
}
function enoent(e: any) { return /ENOENT/.test(String(e?.message || e)); }
function sendDl(res: any, buf: Buffer, name: string, ext: string) {
  res.setHeader('Content-Type', CT[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
  res.setHeader('Content-Length', String(buf.length));
  res.send(buf);
}
const safeBase = (n: string) => (basename(n || 'file').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}\-_ ]/gu, '_').slice(0, 80) || 'file');

// ---- Mấy việc phụ dùng chung cho phần CHUYỂN ĐỔI ----

// Cắt bớt trang bằng qpdf trước khi chuyển đổi: "1,3,5-7". Trả về đường dẫn tệp đã cắt.
async function catTrang(inPath: string, dir: string, pages: string) {
  const sach = pages.replace(/\s/g, '').replace(/[^0-9,\-]/g, '');   // chỉ cho số, dấu phẩy, gạch nối
  if (!sach) return inPath;
  const out = join(dir, 'cat.pdf');
  await run('qpdf', [inPath, '--pages', '.', sach, '--', out], { timeout: 60000, okCodes: [3] });
  return out;
}

// Lấy thử chữ có sẵn trong PDF (5 trang đầu) để biết: có chữ không, và chữ có đọc được không.
async function thuChu(inPath: string): Promise<{ n: number; text: string }> {
  try { const t = await run('pdftotext', ['-q', '-l', '5', inPath, '-'], { timeout: 30000 }); return { n: t.replace(/\s/g, '').length, text: t }; }
  catch { return { n: -1, text: '' }; }   // không có pdftotext -> coi như không biết
}

// CHỮ CÓ NHƯNG ĐỌC RA TOÀN RÁC — bẫy hay gặp nhất ở văn bản hành chính Việt Nam.
// Tệp PDF làm từ phông cũ (VNI, TCVN3, ABC) hoặc quét rồi dán chữ đè lên thì bên trong tệp
// VẪN CÓ lớp chữ, nhưng lấy ra là "Th6n Vinh Phf 561.261" chứ không phải "Thôn Vĩnh Phú".
// Máy sẽ tưởng tệp có chữ rồi (không OCR) → tệp Word/Excel xuất ra đọc không hiểu gì.
// Cách nhận ra: tiếng Việt thật bao giờ cũng dày dấu — cỡ 15-30% chữ cái có dấu.
// Ra dưới 4% mà lại nhiều chữ cái Latin thì gần như chắc chắn lớp chữ bị hỏng phông.
const CO_DAU = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/g;
function chuHong(text: string): boolean {
  const chuCai = (text.match(/[A-Za-zÀ-ỹ]/g) || []).length;
  if (chuCai < 400) return false;                       // quá ít chữ để kết luận
  const dau = (text.match(CO_DAU) || []).length;
  return dau / chuCai < 0.04;
}

// Nhận dạng chữ (OCR) cho PDF ảnh. ep=true: OCR lại cả trang đã có chữ (chữ hỏng, chữ nằm trong ảnh).
async function ocrFile(inPath: string, dir: string, ep = false) {
  const out = join(dir, 'ocr.pdf');
  const che = ep ? '--force-ocr' : '--skip-text';
  // --rotate-pages: trang bị chụp ngược/xoay ngang thì tự xoay lại cho đúng chiều đọc.
  // --deskew: ảnh chụp bị lệch vài độ thì nắn thẳng — chữ thẳng hàng nhận dạng đúng hơn nhiều.
  // --oversample 400: ảnh chụp thưa điểm ảnh thì phóng lên 400 dpi trước khi đọc, bớt đọc nhầm dấu.
  // Ba cờ này chỉ ăn thêm ít giây nhưng ăn thua ở tệp chụp bằng điện thoại.
  // Để NGUYÊN chế độ cắt trang mặc định (psm 3). Đã đo đủ 5 chế độ: psm 4 và psm 6 dựng bảng kém hơn
  // hẳn (62,3% và tệ hơn nữa), psm 11 đọc số chuẩn nhất nhưng làm mất cấu trúc dòng nên bảng dồn cục.
  // psm 11 được dùng riêng ở bước ĐỌC LẦN HAI để đối chiếu số (xem ocrLanHai bên dưới).
  const thamSo = [che, '-l', 'vie+eng', '--optimize', '0', '--rotate-pages', '--deskew', '--oversample', '400'];
  try { await run('ocrmypdf', [...thamSo, inPath, out], { timeout: 260000 }); }
  catch (e: any) {
    // Máy chủ thiếu thư viện nắn ảnh (hoặc trang lạ) → chạy lại bản gọn, thà đọc được còn hơn hỏng cả tệp.
    await run('ocrmypdf', [che, '-l', 'vie+eng', '--optimize', '0', inPath, out], { timeout: 220000 });
  }
  return out;
}

// ĐỌC BẢNG TRONG PDF THEO TOẠ ĐỘ THẬT.
// `pdftotext -bbox-layout` trả về XML có sẵn ba tầng: trang > khối > DÒNG > chữ, mỗi thứ kèm khung bao.
// Điều quan trọng: chính poppler (và Tesseract, với tệp đã OCR) ĐÃ cắt sẵn mỗi ô bảng thành một <line>.
// Nên việc của ta chỉ là: gom các <line> nằm ngang hàng nhau thành một HÀNG, rồi xem ô nào thuộc cột nào.
// Trước đây tự gom từng CHỮ lại thành dòng nên ô có tên dài xuống 2-3 dòng hay bị trộn vào nhau,
// chữ xếp lại theo chiều ngang thành ra lộn tùng phèo ("Thôn (phía Đông Văn Tứ Quốc Đông lộ 1A)").
type O = { x1: number; y1: number; x2: number; y2: number; t: string; nChu: number };

const boThe = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

type ChuNho = { x1: number; x2: number; t: string };
type Dong = { y1: number; y2: number; chu: ChuNho[] };

/** Tách XML thành: mỗi trang một mảng DÒNG, mỗi dòng giữ nguyên thứ tự chữ. */
function docBbox(xml: string): Dong[][] {
  const trang: Dong[][] = [];
  for (const p of xml.split(/<page\b/i).slice(1)) {
    const ds: Dong[] = [];
    for (const m of p.matchAll(/<line\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)"\s*>([\s\S]*?)<\/line>/gi)) {
      const chu: ChuNho[] = [];
      for (const w of m[5].matchAll(/<word\s+xMin="([\d.]+)"\s+yMin="[\d.]+"\s+xMax="([\d.]+)"\s+yMax="[\d.]+"\s*>([\s\S]*?)<\/word>/gi)) {
        const t = boThe(w[3]).trim();
        if (t) chu.push({ x1: +w[1], x2: +w[2], t });
      }
      if (chu.length) ds.push({ y1: +m[2], y2: +m[4], chu });
    }
    if (ds.length) trang.push(ds);
  }
  return trang;
}

function trungVi(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

/** Gom các DÒNG nằm ngang hàng nhau (khung dọc phủ nhau quá nửa) thành một HÀNG của bảng. */
function gomHang(ds: Dong[]): Dong[][] {
  const sx = [...ds].sort((a, b) => (a.y1 + a.y2) / 2 - (b.y1 + b.y2) / 2 || a.chu[0].x1 - b.chu[0].x1);
  const hang: Array<{ y1: number; y2: number; ds: Dong[] }> = [];
  for (const d of sx) {
    const cuoi = hang[hang.length - 1];
    if (cuoi) {
      const phu = Math.min(cuoi.y2, d.y2) - Math.max(cuoi.y1, d.y1);
      const thap = Math.min(cuoi.y2 - cuoi.y1, d.y2 - d.y1) || 1;
      if (phu / thap > 0.5) { cuoi.ds.push(d); cuoi.y1 = Math.min(cuoi.y1, d.y1); cuoi.y2 = Math.max(cuoi.y2, d.y2); continue; }
    }
    hang.push({ y1: d.y1, y2: d.y2, ds: [d] });
  }
  return hang.map((h) => h.ds.sort((a, b) => a.chu[0].x1 - b.chu[0].x1));
}

/** Cắt một dòng thành các Ô: chữ liền nhau là một ô, cách nhau quá một khe là sang ô khác. */
function cachO(d: Dong, khe: number): O[] {
  const o: O[] = [];
  for (const c of d.chu) {
    const cuoi = o[o.length - 1];
    if (cuoi && c.x1 - cuoi.x2 < khe) { cuoi.x2 = Math.max(cuoi.x2, c.x2); cuoi.t += ' ' + c.t; cuoi.nChu += c.t.length; }
    else o.push({ x1: c.x1, y1: d.y1, x2: c.x2, y2: d.y2, t: c.t, nChu: c.t.length });
  }
  return o;
}

/**
 * Tìm ranh giới cột bằng cách CHO CÁC HÀNG BỎ PHIẾU.
 * Mỗi hàng có vài khe trống giữa các ô; chỗ nào NHIỀU HÀNG CÙNG BỎ TRỐNG mới là ranh giới cột thật.
 * Nếu chỉ chiếu tất cả xuống một trục rồi tìm chỗ trống thì một dòng tiêu đề vắt ngang hai cột
 * là lấp mất khe, cả bảng bị gộp làm một cột.
 */
function timCot(hangO: O[][], rongTrang: number, khe: number): number[] {
  const kheHang = hangO.filter((h) => h.length >= 2)
    .map((h) => h.slice(1).map((o, i) => [h[i].x2, o.x1] as [number, number]).filter(([a, b]) => b - a >= khe));
  const co = kheHang.filter((k) => k.length);
  if (co.length < 3) return [];
  const ungVien = co.flat().map(([a, b]) => (a + b) / 2).sort((a, b) => a - b);
  const diem = ungVien.map((x) => ({ x, phieu: co.filter((ks) => ks.some(([a, b]) => x > a && x < b)).length }));
  const nguong = Math.max(2, Math.round(co.length * 0.4));
  const chon: Array<{ x: number; phieu: number }> = [];
  for (const d of diem) {
    if (d.phieu < nguong) continue;
    const cuoi = chon[chon.length - 1];
    if (cuoi && d.x - cuoi.x < khe) { if (d.phieu > cuoi.phieu) { cuoi.x = d.x; cuoi.phieu = d.phieu; } }
    else chon.push({ ...d });
  }
  if (!chon.length) return [];
  return [0, ...chon.map((c) => c.x), rongTrang + 1];
}

// ---- DÙNG CHÍNH NÉT KẺ CỦA BẢNG (chắc ăn hơn mọi cách đoán) ----
// Bảng trong văn bản nhà nước đều có kẻ khung. Nét kẻ nằm sẵn trên ảnh, dò ra là biết ĐÚNG
// hàng nào tới đâu, cột nào tới đâu — khỏi phải đoán theo vị trí chữ. Cách đoán luôn vấp hai lỗi:
// hai hàng sát nhau thì chữ dính vào nhau, và một trang có hai bảng khác số cột thì chia sai.
// Việc dò ảnh giao cho tools/luoi-bang.py (dùng thư viện ảnh PIL có sẵn trong ảnh Docker).
type LuoiHang = { y1: number; y2: number; cot: number[] };
type LuoiTrang = { rong: number; hang: LuoiHang[] };

async function doLuoi(pdf: string): Promise<LuoiTrang[]> {
  try {
    const tep = fileURLToPath(new URL('../../tools/luoi-bang.py', import.meta.url));
    const raw = await run('python3', [tep, pdf], { timeout: 180000 });
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    if (a < 0 || b <= a) return [];
    const j = JSON.parse(raw.slice(a, b + 1));
    return (j.trang || []).map((t: any) => ({
      rong: t.rongPt || 600,
      hang: (t.hang || []).map((h: any) => ({ y1: h.y1Pt, y2: h.y2Pt, cot: h.docPt || [] })),
    }));
  } catch { return []; }          // không dò được thì quay về cách đoán, không để hỏng cả việc
}

/** Một ô của bảng: chữ trong ô + chỗ nó nằm trên trang (để còn cắt ra đọc lại khi nghi ngờ). */
type OToaDo = { x1: number; y1: number; x2: number; y2: number; tr: number };

/** Dựng hàng theo LƯỚI KẺ đã dò được. Trả null nếu trang này không phải bảng kẻ khung. */
function trangTheoLuoi(ds: Dong[], lt: LuoiTrang, tr: number): { hang: string[][]; box: Array<Array<OToaDo | null>> } | null {
  if (lt.hang.filter((h) => h.cot.length >= 2).length < 3) return null;   // dưới 3 hàng có kẻ thì chưa gọi là bảng
  const xep: Array<{ h: LuoiHang | null; ds: Dong[] }> = lt.hang.map((h) => ({ h, ds: [] }));
  const ngoai: Array<{ d: Dong }> = [];
  for (const d of ds) {
    const tam = (d.y1 + d.y2) / 2;
    const k = xep.find((x) => x.h && tam >= x.h.y1 && tam < x.h.y2);
    if (k) k.ds.push(d); else ngoai.push({ d });
  }
  // Gộp lại rồi xếp theo đúng thứ tự trên trang: chữ ngoài khung kẻ (tiêu đề, đoạn văn) để nguyên một ô.
  const tatCa: Array<{ y: number; o: string[]; b: Array<OToaDo | null> }> =
    ngoai.map(({ d }) => ({ y: d.y1, o: [d.chu.map((c) => c.t).join(' ')], b: [null] }));
  // Chiều cao thường gặp của một hàng — để biết hàng nào cao bất thường.
  const caoThuong = (() => {
    const a = xep.filter((x) => x.h && x.ds.length).map((x) => x.h!.y2 - x.h!.y1).sort((p, q) => p - q);
    return a.length ? a[Math.floor(a.length / 2)] : 0;
  })();
  const dungHang = (h: LuoiHang, ds2: Dong[], y: number) => {
    // Lấy ĐÚNG phần trong khung: từ nét kẻ ngoài cùng bên trái tới nét ngoài cùng bên phải.
    // Chữ nằm ngoài khung là lề trang hoặc vết dấu mộc đóng đè - bỏ đi, không phải nội dung bảng.
    const moc = h.cot;
    const soCot = moc.length - 1;
    if (soCot < 1) return;
    const r: string[] = new Array(soCot).fill('');
    // Xếp các dòng trong ô theo THỨ TỰ ĐỌC (trên xuống dưới) rồi mới ghép chữ.
    // Không xếp thì ô có tên dài xuống hai dòng ra ngược: "(phía Đông Quốc lộ 1A) Thôn Văn Tứ Đông".
    for (const d of [...ds2].sort((a, b) => a.y1 - b.y1)) for (const c of d.chu) {
      if (/^[|¦‖]+$/.test(c.t)) continue;                 // nét kẻ dọc bị máy đọc thành dấu gạch
      const tam = (c.x1 + c.x2) / 2;
      if (tam < moc[0] || tam > moc[soCot]) continue;      // ngoài khung bảng
      let k = 0;
      while (k < soCot - 1 && tam >= moc[k + 1]) k++;
      const t = suaSo(c.t);
      r[k] = r[k] ? r[k] + ' ' + t : t;
    }
    while (r.length && r[r.length - 1] === '') r.pop();
    if (r.length) tatCa.push({ y, o: r, b: r.map((_, k) => ({ x1: moc[k], y1: h.y1, x2: moc[k + 1], y2: h.y2, tr })) });
  };
  for (const { h, ds: trong } of xep) {
    if (!h || !trong.length) continue;
    // LƯỚI AN TOÀN: nét kẻ mờ quá thì máy dò sót, hai ba hàng dồn vào một ô lưới.
    // Hàng nào cao hơn hẳn mức thường thì tách tiếp theo vị trí chữ, nhưng VẪN dùng cột của lưới.
    if (caoThuong > 0 && (h.y2 - h.y1) > caoThuong * 1.6) {
      for (const nhom of gomHang(trong)) dungHang(h, nhom, nhom[0].y1);
    } else dungHang(h, trong, h.y1);
  }
  const xep2 = tatCa.sort((a, b) => a.y - b.y);
  return { hang: xep2.map((x) => x.o), box: xep2.map((x) => x.b) };
}

/**
 * Một trang PDF -> các hàng của bảng.
 * MỘT TRANG CÓ THỂ CÓ NHIỀU BẢNG, cột của chúng nằm ở chỗ khác nhau (vd trang 7 của Thông báo 306:
 * bảng đất nông nghiệp 4 cột giá, ngay dưới là bảng đất rừng chỉ 2 cột). Nếu bắt cả trang bỏ phiếu
 * chung một bộ ranh giới cột thì hai bảng "triệt tiêu" phiếu của nhau, cột nào cũng không đủ phiếu
 * → hai giá trị dồn chung một ô. Nên phải CẮT TRANG THÀNH TỪNG KHỐI rồi mỗi khối tự tính cột.
 * Chỗ cắt là những dòng chạy gần hết bề ngang mà chỉ có một ô (tiêu đề, câu văn xuôi).
 */
function trangThanhHang(ds: Dong[]): string[][] {
  const moiChu = trungVi(ds.flatMap((d) => d.chu.map((c) => (c.x2 - c.x1) / Math.max(1, c.t.length)))) || 5;
  const khe = moiChu * 1.8;
  const rongTrang = Math.max(...ds.map((d) => d.chu[d.chu.length - 1].x2)) + 2;
  const hang = gomHang(ds).map((h) => h.flatMap((d) => cachO(d, khe)).sort((a, b) => a.x1 - b.x1));

  // Cắt trang thành các khối: dòng một ô mà dài quá 45% bề ngang trang thì coi là vách ngăn.
  let nay: O[][] = [];
  const ra: string[][] = [];
  const xong = () => { if (nay.length) { ra.push(...khoiThanhHang(nay, rongTrang, khe)); nay = []; } };
  for (const h of hang) {
    const vach = h.length === 1 && (h[0].x2 - h[0].x1) > rongTrang * 0.45;
    if (vach) { xong(); ra.push([h[0].t]); }
    else nay.push(h);
  }
  xong();
  return ra;
}

/** Một khối (các hàng liền nhau của cùng một bảng) -> các hàng chữ, tự tính cột riêng cho khối đó. */
function khoiThanhHang(hang: O[][], rongTrang: number, khe: number): string[][] {
  const moc = timCot(hang, rongTrang, khe);
  if (!moc.length) return hang.map((h) => [h.map((o) => o.t).join(' ')]);

  const soCot = moc.length - 1;
  const tho: string[][] = hang.map((h) => {
    const r: string[] = new Array(soCot).fill('');
    for (const o of h) {
      const tam = (o.x1 + o.x2) / 2;
      let k = 0;
      while (k < soCot - 1 && tam >= moc[k + 1]) k++;
      const t = suaSo(o.t);
      r[k] = r[k] ? r[k] + ' ' + t : t;
    }
    return r;
  });

  // BỎ CỘT RỖNG: máy chia cột hơi "tay to" nên hay đẻ ra cột gần như không hàng nào có chữ.
  // Phải đếm theo TỈ LỆ — dòng tiêu đề vắt ngang rải chữ vào mọi cột, chỉ hỏi "có hàng nào có chữ
  // không" thì cột rỗng nào cũng thành "có chữ".
  const dem = new Array(soCot).fill(0);
  for (const h of tho) for (let i = 0; i < soCot; i++) if (h[i].trim()) dem[i]++;
  const nguongCot = Math.max(2, Math.round(tho.length * 0.15));
  const giu = dem.map((d) => d >= nguongCot);
  const gon = giu.some(Boolean) ? tho.map((h) => h.filter((_, i) => giu[i])) : tho;

  // Ô dài bị xuống dòng: hàng nào bỏ trống cột đầu mà hàng trên có chữ thì nối vào hàng trên.
  const ra: string[][] = [];
  for (const h of gon) {
    while (h.length && h[h.length - 1] === '') h.pop();
    if (!h.length) continue;
    const truoc = ra[ra.length - 1];
    const noiTiep = truoc && h.length > 1 && !h[0].trim() && truoc.some((x) => x.trim());
    if (noiTiep) { h.forEach((v, i) => { if (v) truoc[i] = (truoc[i] ? truoc[i] + ' ' : '') + v; }); }
    else ra.push(h);
  }
  return ra;
}

/** Cả tệp PDF -> bảng (mỗi trang cách nhau một dòng trống). */
function bboxThanhBang(xml: string, luoi: LuoiTrang[] = []): { hang: string[][]; box: Array<Array<OToaDo | null>> } {
  const trang = docBbox(xml);
  const hang: string[][] = [];
  const box: Array<Array<OToaDo | null>> = [];
  trang.forEach((ds, i) => {
    // Có nét kẻ thì dùng nét kẻ; không có (bảng không kẻ khung, hoặc dò hỏng) thì quay về cách đoán.
    const theoLuoi = luoi[i] ? trangTheoLuoi(ds, luoi[i], i + 1) : null;
    if (theoLuoi) { hang.push(...theoLuoi.hang); box.push(...theoLuoi.box); }
    else { const h2 = trangThanhHang(ds); hang.push(...h2); box.push(...h2.map((r) => r.map(() => null))); }
    hang.push([]); box.push([]);
  });
  while (hang.length && !hang[hang.length - 1].length) { hang.pop(); box.pop(); }
  return { hang, box };
}

// ĐÃ THỬ VÀ BỎ: đọc OCR thêm 2 lần nữa bằng chế độ "chữ rải rác" (tesseract psm 11 và 12) rồi
// đối chiếu từng con số. Nghe rất hợp lý — đo riêng thì psm 11/12 đọc ĐÚNG 72/72 con số trong bảng
// giá của Thông báo 306, còn chế độ thường chỉ 66/72. NHƯNG đo cả quy trình thì KHÔNG ĂN THUA:
//   · để nó sửa thoải mái  -> 83,0% (tụt, vì sửa được 5 chỗ thì làm hỏng 5 chỗ khác)
//   · chỉ sửa ô số hỏng    -> 86,8% (đúng bằng lúc không đối chiếu)
// Lý do: hai chế độ rải rác cùng một kiểu nên chúng sai giống nhau, "đối chiếu" hoá ra không độc lập.
// Cái giá phải trả là OCR 3 lần, chậm gấp ba. Nên bỏ. Đừng làm lại.

// Cách CŨ (dự phòng): đọc chữ dạng "giữ nguyên khung" rồi cắt cột theo cột khoảng trắng thẳng hàng.
// Chỉ dùng khi bản pdftotext trên máy chủ không hỗ trợ -bbox-layout.
function chuThanhBang(text: string): string[][] {
  const hang: string[][] = [];
  for (const khoi of text.split('\f')) {                                   // mỗi trang một khối
    const dong = khoi.split('\n').filter((d) => d.trim() !== '');
    if (!dong.length) continue;
    const rong = Math.max(...dong.map((d) => d.length));
    const trong: boolean[] = new Array(rong).fill(true);
    for (const d of dong) for (let i = 0; i < rong; i++) if (d[i] && d[i] !== ' ') trong[i] = false;
    // Gom các cột trắng liền nhau, chỉ lấy khe rộng >= 2 ký tự làm ranh giới cột
    const khe: Array<[number, number]> = []; let i = 0;
    while (i < rong) { if (trong[i]) { let j = i; while (j < rong && trong[j]) j++; if (j - i >= 2) khe.push([i, j]); i = j; } else i++; }
    const moc = [0, ...khe.map(([a, b]) => Math.floor((a + b) / 2)), rong].filter((v, k, a) => a.indexOf(v) === k).sort((a, b) => a - b);
    for (const d of dong) {
      const o: string[] = [];
      for (let k = 0; k < moc.length - 1; k++) o.push(d.slice(moc[k], moc[k + 1]).trim());
      while (o.length && o[o.length - 1] === '') o.pop();
      if (o.length) hang.push(o);
    }
    hang.push([]);                                                          // một dòng trống ngăn giữa hai trang
  }
  while (hang.length && !hang[hang.length - 1].length) hang.pop();
  return hang;
}

// SỬA LỖI ĐỌC SỐ. Máy OCR hay lẫn mấy chữ giống hình con số: 889.96] thay vì 889.961,
// 8l1.000 thay vì 811.000, O thay cho 0... Chỉ sửa trong ô NHÌN ĐÃ RA SỐ (từ 3 chữ số trở lên và
// quá nửa ký tự là số) để không đụng vào tên người, tên thôn hay số hiệu văn bản.
const NHAM: Record<string, string> = { ']': '1', '[': '1', '|': '1', 'l': '1', 'I': '1', 'i': '1',
  'O': '0', 'o': '0', 'Q': '0', 'D': '0', 'S': '5', 's': '5', 'B': '8', 'Z': '2', 'z': '2', ',': '.' };
function suaSo(o: string): string {
  // Bỏ nét kẻ khung mà máy OCR đọc thành dấu gạch đứng, rồi mới xét.
  const t = o.trim().replace(/[|¦‖]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return o;
  const chuan = (x: string) => /^\d{1,3}(\.\d{3})+$/.test(x) || /^\d{4,9}$/.test(x);
  const lien = t.replace(/\s/g, '');
  if (chuan(lien)) return lien;                                    // vốn đã là số, chỉ cần dọn sạch
  if (!/^[\d\s.,\]\[lIiOoQDSsBZz]+$/.test(t)) return o;            // còn chữ cái khác -> không đụng
  const so = (t.match(/\d/g) || []).length;
  if (so < 3 || so / Math.max(1, lien.length) < 0.5) return o;
  const ra = lien.replace(/[\]\[lIiOoQDSsBZz,]/g, (c) => NHAM[c] || c);
  return chuan(ra) ? ra : o;
}

// TỰ SOI LẠI CẢ CỘT RỒI ĐỌC LẠI RIÊNG MẤY Ô LỆCH KHUÔN.
// Ý chính: trong một cột số, các ô đều cùng một "khuôn" — vd đều là dạng 3 chữ số, dấu chấm,
// 3 chữ số (901.850). Ô nào lệch khuôn (755999 mất dấu chấm, «00240, 581293) hoặc có giá trị
// lẻ loi trong khi cả cột đều là một giá trị khác chỉ lệch ĐÚNG MỘT chữ số (379.286 giữa một rừng
// 579.286) thì gần như chắc là đọc nhầm.
// Với mấy ô đó — và CHỈ mấy ô đó cho đỡ tốn thời gian — cắt riêng ô ra khỏi ảnh trang, phóng to,
// bắt máy chỉ được đọc ra chữ số rồi đọc lại. Đo thật: ô bị đọc nhầm thành 379.286 đọc lại ra
// đúng 579.286. Đọc lại mà vẫn lệch khuôn thì KHÔNG sửa, chỉ ghi ra cuối tệp để người dùng tự soi
// (đây là giá đền bù, máy không được phép đoán).
const khuonCua = (t: string) => t.replace(/\d/g, 'D');
const soSach = (t: string) => /^\d{1,3}(\.\d{3})+$/.test(t);
// "Nhìn đã ra số": quá nửa ký tự là chữ số. Dùng để loại mấy ô chữ có lẫn con số (tên văn bản, năm).
const nhinNhuSo = (t: string) => {
  const x = t.replace(/[\s|¦]/g, '');
  return x.length >= 4 && (x.match(/\d/g) || []).length / x.length >= 0.5;
};

type ONgo = { r: number; c: number; cu: string; khuon: string; hayGap: string; pho: string[] };

/** Tìm những ô đáng ngờ trong từng cột. */
function timONgo2(hang: string[][]): ONgo[] {
  const soCot = Math.max(0, ...hang.map((h) => h.length));
  const ra: ONgo[] = [];
  for (let c = 0; c < soCot; c++) {
    const oCot = hang.map((h, r) => ({ r, t: (h[c] || '').trim() })).filter((x) => x.t);
    if (oCot.length < 4) continue;
    const sach = oCot.filter((x) => soSach(x.t));
    if (sach.length < 3 || sach.length / oCot.length < 0.5) continue;       // không phải cột số
    // Khuôn hay gặp nhất của cột
    const demKhuon = new Map<string, number>();
    for (const x of sach) demKhuon.set(khuonCua(x.t), (demKhuon.get(khuonCua(x.t)) || 0) + 1);
    const khuon = [...demKhuon.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // Giá trị hay gặp trong cột (để bắt kiểu lệch đúng một chữ số)
    const demGT = new Map<string, number>();
    for (const x of sach) demGT.set(x.t, (demGT.get(x.t) || 0) + 1);
    const pho = [...demGT.entries()].filter(([, n]) => n >= 3).map(([v]) => v);   // giá trị hay gặp của cột
    for (const x of oCot) {
      // Ô phải NHÌN ĐÃ RA SỐ mới xét: từ 3 chữ số trở lên VÀ quá nửa ký tự là số.
      // Không lọc chặt thì ô tiêu đề như "Vị trí 1" hay cả câu "Giá đất theo Nghị quyết số
      // 15/2025/NQ-HĐND" nằm lọt trong cột số cũng bị kêu là lệch khuôn — báo động giả, rất phiền.
      if ((x.t.match(/\d/g) || []).length < 3 || !nhinNhuSo(x.t)) continue;
      const lechKhuon = khuonCua(x.t) !== khuon;
      let hayGap = '';
      if (!lechKhuon && demGT.get(x.t) === 1) {
        for (const [v2, n] of demGT) {
          if (v2 === x.t || n < 3 || v2.length !== x.t.length) continue;
          if ([...v2].filter((k, i) => k !== x.t[i]).length === 1) { hayGap = v2; break; }
        }
        if (!hayGap) continue;
      } else if (!lechKhuon) continue;
      ra.push({ r: x.r, c, cu: x.t, khuon, hayGap, pho });
    }
  }
  return ra;
}

/**
 * TÁCH Ô BỊ GỘP. Thỉnh thoảng một hàng có nét kẻ dọc quá mờ, máy dò sót, thế là hai giá trị
 * nằm chung một ô ("811.000 579.286"). Nhận ra rất dễ: hàng đó ÍT HƠN ĐÚNG MỘT CỘT so với
 * các hàng khác, và có một ô chứa đúng hai con số. Cắt đôi ô đó là hàng khớp lại như cũ.
 */
function tachOGop(hang: string[][], box: Array<Array<OToaDo | null>>): number {
  const dem = new Map<number, number>();
  for (const h of hang) if (h.length >= 3) dem.set(h.length, (dem.get(h.length) || 0) + 1);
  if (!dem.size) return 0;
  const chuan = [...dem.entries()].sort((a, b) => b[1] - a[1])[0][0];
  let n = 0;
  for (let r = 0; r < hang.length; r++) {
    // Một hàng có thể sót nhiều nét kẻ nên phải tách tới khi đủ cột, không chỉ tách một lần.
    let vong = 0;
    while (hang[r].length < chuan && hang[r].length >= 2 && vong++ < 4) {
      let daTach = false;
      for (let c = 0; c < hang[r].length; c++) {
        const m = /^(\d{1,3}(?:\.\d{3})+)\s+(\d{1,3}(?:\.\d{3})+)$/.exec((hang[r][c] || '').trim());
        if (!m) continue;
        hang[r].splice(c, 1, m[1], m[2]);
        if (box[r]) {
          const b = box[r][c];
          const giua = b ? (b.x1 + b.x2) / 2 : 0;
          box[r].splice(c, 1, b ? { ...b, x2: giua } : null, b ? { ...b, x1: giua } : null);
        }
        n++; daTach = true;
        break;
      }
      if (!daTach) break;
    }
  }
  return n;
}

/** Đọc lại mấy ô đáng ngờ bằng cách cắt riêng từng ô. Trả về số ô đã sửa + lời nhắc cho ô còn ngờ. */
async function soiLaiSo(pdf: string, hang: string[][], box: Array<Array<OToaDo | null>>): Promise<{ sua: number; nhac: string[] }> {
  const ngo = timONgo2(hang).filter((x) => box[x.r] && box[x.r][x.c]);
  if (!ngo.length) return { sua: 0, nhac: [] };
  const lam = ngo.slice(0, 60);                      // chặn trên cho khỏi chạy quá lâu với tệp dày
  let sua = 0; const nhac: string[] = [];
  let docLai: string[] = [];
  try {
    const tep = fileURLToPath(new URL('../../tools/doc-lai-o.py', import.meta.url));
    const ds = lam.map((x) => { const b = box[x.r][x.c]!; return { trang: b.tr, x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 }; });
    const raw = await run('python3', [tep, pdf, JSON.stringify(ds)], { timeout: 180000 });
    const a = raw.indexOf('{'), b2 = raw.lastIndexOf('}');
    docLai = a >= 0 && b2 > a ? (JSON.parse(raw.slice(a, b2 + 1)).doc || []) : [];
  } catch { docLai = []; }
  const chiSo = (t: string) => t.replace(/\D/g, '');
  lam.forEach((x, i) => {
    const moi = (docLai[i] || '').trim();
    // NHẬN KẾT QUẢ ĐỌC LẠI THẾ NÀO CHO CHẮC — đây là chỗ dễ làm hỏng nhất, đã vấp một lần:
    // ô vốn đọc đúng số nhưng mất dấu chấm ("581293"), đọc lại ra "381.293" (sai số) mà máy lại tin
    // bản đọc lại, thành ra đang đúng hoá sai. Nên xếp theo thứ tự tin cậy:
    //   1. Hai lần đọc RA CÙNG DÃY SỐ, chỉ khác dấu chấm  -> nhận (chỉ là chuyện định dạng).
    //   2. Bản đọc lại KHỚP một giá trị hay gặp của cột    -> nhận (có bằng chứng cả cột đỡ lưng).
    //   3. Dãy số của bản GỐC khớp một giá trị hay gặp     -> giữ bản gốc, chỉ thêm lại dấu chấm.
    //   4. Hai bản cãi nhau mà không bên nào có bằng chứng -> KHÔNG sửa, ghi ra cho người xem.
    const sachMoi = !!moi && soSach(moi) && moi !== x.cu;
    // 1. Hai lần đọc RA CÙNG DÃY SỐ, chỉ khác dấu chấm -> nhận bản có dấu chấm.
    if (sachMoi && chiSo(moi) === chiSo(x.cu)) { hang[x.r][x.c] = moi; sua++; return; }
    // 2. Dãy số của BẢN GỐC khớp một giá trị hay gặp của cột -> giữ số cũ, chỉ thêm lại dấu chấm.
    //    Phải xét trước bước 3, vì có ca bản gốc đọc đúng số mà mất dấu chấm ("581293"), đọc lại
    //    thì sai số ("381.293") — tin bản đọc lại là đang đúng hoá sai.
    const theoCot = x.pho.find((v) => chiSo(v) === chiSo(x.cu));
    if (theoCot && theoCot !== x.cu) { hang[x.r][x.c] = theoCot; sua++; return; }
    // 3. Bản đọc lại KHỚP một giá trị hay gặp của cột -> nhận (có bằng chứng cả cột đỡ lưng).
    if (sachMoi && x.pho.includes(moi)) { hang[x.r][x.c] = moi; sua++; return; }
    // 4. Bản gốc HỎNG HẲN (không ra số sạch) mà đọc lại ra số sạch -> nhận bản đọc lại.
    if (sachMoi && !soSach(x.cu)) { hang[x.r][x.c] = moi; sua++; return; }
    // Đọc lại mà vẫn ra y như cũ thì THƯỜNG là yên tâm — trừ khi bằng chứng cả cột vẫn chỉ vào nó
    // (ô lẻ loi giữa một cột toàn giá trị khác, lệch đúng một chữ số). Gặp ca đó thì vẫn phải nhắc:
    // đã đo thật, có ô mà đọc mấy lần đều ra "381.293" trong khi cả cột là "581.293" — chỗ giấy bị mờ.
    // Máy KHÔNG tự đổi theo số đông (đây là giá đền bù, không được đoán), chỉ chỉ chỗ cho người xem.
    if (moi === x.cu && !x.hayGap) return;
    if (!x.hayGap && soSach(x.cu)) return;           // chỉ lệch khuôn mà vẫn là số sạch -> bỏ qua
    nhac.push(`Dòng ${x.r + 1}, cột ${x.c + 1}: máy đọc ra "${x.cu}"`
      + (x.hayGap ? ` trong khi các ô khác cùng cột đều là "${x.hayGap}"` : ' — lệch khuôn so với các ô khác cùng cột')
      + (moi && moi !== x.cu ? `; đọc lại lần nữa ra "${moi}"` : moi ? '; đọc lại lần nữa vẫn ra như vậy' : '')
      + '. Hãy mở tệp gốc xem lại ô này.');
  });
  return { sua, nhac };
}

const raCsv = (hang: string[][]) => '﻿' + hang.map((h) => h.map((o) => (/[",;\n]/.test(o) ? '"' + o.replace(/"/g, '""') + '"' : o)).join(',')).join('\r\n');

// POST /api/pdftools/convert?to=pdf|docx|xlsx|pptx|txt|csv&pages=1-5&ocr=auto|on|off
// Office ↔ PDF bằng LibreOffice. Riêng PDF -> Excel/CSV/Text thì đi đường pdftotext (ra bảng dùng được).
pdftoolsRouter.post('/convert', upload.single('file'), async (req: any, res, next) => {
  const to = String(req.query.to || 'pdf').toLowerCase().replace(/[^a-z]/g, '');
  if (!req.file) return res.status(400).json({ error: 'Thiếu tệp' });
  if (!['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv'].includes(to)) return res.status(400).json({ error: 'Định dạng đích không hỗ trợ' });
  // Lọc SẠCH phần đuôi tệp: chỉ giữ chữ và số. Người dùng đặt tên tệp kiểu "a.pdf/../../x" thì
  // phần đuôi lấy ra có thể chứa dấu gạch chéo và chấm — ghép thẳng vào đường dẫn là thoát ra ngoài thư mục.
  const inExt = ((extname(req.file.originalname || '').slice(1) || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin').slice(0, 8);
  const laPdf = inExt === 'pdf';
  const pages = String(req.query.pages || '');
  const ocrY = String(req.query.ocr || 'auto').toLowerCase();               // auto: tự đoán · on: luôn OCR · off: không OCR
  const kieu = String(req.query.kieu || 'giong').toLowerCase();            // giong: giống hệt bản gốc · chay: chữ chảy, dễ sửa
  if (!laPdf && (to === 'txt' || to === 'csv')) return res.status(400).json({ error: 'Chỉ đọc chữ được từ tệp PDF' });
  const dir = await mkdtemp(join(tmpdir(), 'lo_'));
  try {
    let inPath = join(dir, 'src.' + inExt);
    await writeFile(inPath, req.file.buffer);

    // 1) Chỉ lấy mấy trang người dùng chọn (nhanh hơn, tệp kết quả gọn hơn)
    if (laPdf && pages) { try { inPath = await catTrang(inPath, dir, pages); } catch { /* cắt hỏng -> dùng cả tệp */ } }

    // 2) PDF chụp/scan thì phải nhận dạng chữ trước, không thì tệp Word/Excel ra chỉ toàn ảnh.
    let daOcr = false, viHong = false;
    if (laPdf && to !== 'pdf' && ocrY !== 'off') {
      const { n: chu, text: mau } = await thuChu(inPath);
      const laAnh = chu >= 0 && chu < 120;               // không có chữ = tệp chụp/scan
      viHong = !laAnh && chu > 0 && chuHong(mau);        // có chữ nhưng là chữ rác do lỗi phông
      if (ocrY === 'on' || laAnh || viHong) {
        // Chữ rác thì phải OCR ĐÈ LÊN (--force-ocr), vì để --skip-text là nó thấy "đã có chữ" rồi bỏ qua.
        try { inPath = await ocrFile(inPath, dir, viHong || (ocrY === 'on' && !laAnh)); daOcr = true; }
        catch (e: any) { if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài ocrmypdf — hãy rebuild backend.' }); /* OCR hỏng -> chuyển đại phần còn lại */ }
      }
    }
    if (daOcr) res.setHeader('X-Da-OCR', viHong ? 'hong' : '1');   // hong = chữ trong tệp bị lỗi phông, đã đọc lại bằng OCR

    // 3a) PDF -> Text / Excel / CSV: đi đường pdftotext (giữ được khung bảng)
    if (laPdf && (to === 'txt' || to === 'csv' || to === 'xlsx')) {
      let text = '';
      try { text = await run('pdftotext', ['-q', '-layout', '-enc', 'UTF-8', inPath, '-'], { timeout: 90000 }); }
      catch (e: any) { if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài poppler-utils — hãy rebuild backend.' }); throw e; }
      if (text.replace(/\s/g, '').length < 5) return res.status(422).json({ error: 'Tệp PDF này không có chữ nào đọc được. Hãy bật "Nhận dạng chữ (OCR)" rồi thử lại.' });
      if (to === 'txt') return sendDl(res, Buffer.from('﻿' + text, 'utf8'), safeBase(req.file.originalname) + '.txt', 'txt');
      // Ưu tiên đọc theo TOẠ ĐỘ (chính xác hơn); pdftotext quá cũ không có -bbox-layout thì về cách cũ.
      let hang: string[][] = [];
      let box: Array<Array<OToaDo | null>> = [];
      try {
        const xml = await run('pdftotext', ['-q', '-bbox-layout', '-enc', 'UTF-8', inPath, '-'], { timeout: 90000 });
        const luoi = await doLuoi(inPath);      // dò nét kẻ khung ngay trên ảnh trang
        const kq = bboxThanhBang(xml, luoi);
        hang = kq.hang; box = kq.box;
      } catch { hang = []; box = []; }
      if (hang.length < 2) { hang = chuThanhBang(text); box = hang.map((r) => r.map(() => null)); }
      const daTach = tachOGop(hang, box);
      if (daTach) console.log('[pdftools] tach ' + daTach + ' o bi gop (thieu net ke doc)');
      const { sua, nhac } = await soiLaiSo(inPath, hang, box);
      if (sua) { res.setHeader('X-Da-Sua', String(sua)); console.log('[pdftools] soi lai: doc lai rieng tung o, sua ' + sua + ' con so'); }
      if (nhac.length) {
        res.setHeader('X-O-Ngo', String(nhac.length));
        hang.push([], ['⚠ MÁY ĐỌC CHƯA CHẮC CHẮN Ở ' + nhac.length + ' Ô SỐ — NÊN KIỂM LẠI BẰNG TỆP GỐC'], ...nhac.map((x) => [x]));
      }
      const csv = raCsv(hang);
      if (to === 'csv') return sendDl(res, Buffer.from(csv, 'utf8'), safeBase(req.file.originalname) + '.csv', 'csv');
      // CSV -> XLSX bằng LibreOffice, ép đọc UTF-8 và cắt cột theo dấu phẩy (44) để không vỡ tiếng Việt
      const csvPath = join(dir, 'bang.csv');
      await writeFile(csvPath, Buffer.from(csv, 'utf8'));
      await run('soffice', ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${join(dir, 'profile')}`,
        // 44=dấu phẩy · 34=nháy kép · 76=UTF-8 · 1=từ dòng 1 · ''=để kiểu ô tự nhận · 1066=tiếng Việt
        // Khai 1066 mới quan trọng: số Việt Nam viết "1.063.340", máy chủ chạy tiếng Anh sẽ hiểu
        // dấu chấm là dấu thập phân → ra 1,06 hoặc thành chữ. Khai đúng thì vào Excel là SỐ cộng trừ được.
        '--infilter=CSV:44,34,76,1,,1066,false,true,true', '--convert-to', 'xlsx', '--outdir', dir, csvPath], { timeout: 90000 });
      const fs2 = await readdir(dir);
      const xn = fs2.find((f) => f.toLowerCase().endsWith('.xlsx'));
      if (!xn) return res.status(422).json({ error: 'Không tạo được tệp Excel từ tệp PDF này.' });
      return sendDl(res, await readFile(join(dir, xn)), safeBase(req.file.originalname) + '.xlsx', 'xlsx');
    }

    // 3a-bis) PDF -> Word kiểu "chữ chảy": đi qua pdftohtml rồi mới sang Word.
    // Khác nhau ở đâu: đường mặc định (writer_pdf_import) dựng lại y hệt trang gốc nhưng mỗi đoạn chữ
    // nằm trong một KHUNG riêng — nhìn giống hệt mà sửa thì rất cực, thêm một chữ là vỡ khung.
    // Đường này lấy chữ theo dòng chảy như một văn bản Word bình thường: sửa, chèn, xoá thoải mái,
    // giữ được in đậm/nghiêng và ảnh, đổi lại không giữ đúng từng vị trí trên trang.
    if (laPdf && to === 'docx' && kieu === 'chay') {
      const hdir = join(dir, 'html');
      await run('pdftohtml', ['-q', '-s', '-i', '-noframes', '-enc', 'UTF-8', '-fmt', 'png', inPath, hdir], { timeout: 90000 });
      const hfile = hdir + '.html';
      await run('soffice', ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${join(dir, 'profile')}`,
        '--convert-to', 'docx:MS Word 2007 XML', '--outdir', dir, hfile], { timeout: 120000 });
      const fs3 = await readdir(dir);
      const dn = fs3.find((f) => f.toLowerCase().endsWith('.docx'));
      if (dn) return sendDl(res, await readFile(join(dir, dn)), safeBase(req.file.originalname) + '.docx', 'docx');
      // không ra được thì rơi xuống đường thường bên dưới
    }

    // 3b) Các đường còn lại: LibreOffice
    const args = ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${join(dir, 'profile')}`];
    if (laPdf && to === 'docx') args.push('--infilter=writer_pdf_import'); // ép PDF -> Writer để ra Word giống hệt bản gốc
    args.push('--convert-to', to, '--outdir', dir, inPath);
    await run('soffice', args, { timeout: 120000 });     // 2 phút cho tệp tới 25MB
    const files = await readdir(dir);
    const outName = files.find((f) => f.toLowerCase().endsWith('.' + to) && f !== basename(inPath));
    if (!outName) return res.status(422).json({ error: 'Không chuyển đổi được tệp này (định dạng nguồn có thể không được hỗ trợ).' });
    const out = await readFile(join(dir, outName));
    sendDl(res, out, safeBase(req.file.originalname) + '.' + to, to);
  } catch (e: any) {
    if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài LibreOffice — hãy rebuild backend.' });
    next(e);
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
});

// POST /api/pdftools/ocr — OCR PDF (ảnh scan) thành PDF tìm/copy được chữ, ưu tiên tiếng Việt.
pdftoolsRouter.post('/ocr', upload.single('file'), async (req: any, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu tệp PDF' });
  const dir = await mkdtemp(join(tmpdir(), 'ocr_'));
  try {
    const inPath = join(dir, 'in.pdf'), outPath = join(dir, 'out.pdf');
    await writeFile(inPath, req.file.buffer);
    // --skip-text: trang đã có chữ thì giữ nguyên, chỉ OCR trang ảnh. -l vie+eng: nhận cả tiếng Việt.
    await run('ocrmypdf', ['--skip-text', '-l', 'vie+eng', '--optimize', '0', inPath, outPath], { timeout: 120000, okCodes: [] });   // 2 phút, trước 4 phút 40
    const out = await readFile(outPath);
    sendDl(res, out, safeBase(req.file.originalname) + '-ocr.pdf', 'pdf');
  } catch (e: any) {
    if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài ocrmypdf — hãy rebuild backend.' });
    return res.status(422).json({ error: 'Không OCR được: ' + String(e?.stderr || e?.message || e).slice(0, 200) });
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
});

// POST /api/pdftools/encrypt?pw=... — đặt mật khẩu mở PDF (qpdf, AES-256).
pdftoolsRouter.post('/encrypt', upload.single('file'), async (req: any, res, next) => {
  const pw = String(req.query.pw || req.body?.pw || '');
  if (!req.file) return res.status(400).json({ error: 'Thiếu tệp PDF' });
  if (!pw) return res.status(400).json({ error: 'Thiếu mật khẩu' });
  const dir = await mkdtemp(join(tmpdir(), 'enc_'));
  try {
    const inPath = join(dir, 'in.pdf'), outPath = join(dir, 'out.pdf');
    await writeFile(inPath, req.file.buffer);
    await run('qpdf', ['--encrypt', pw, pw, '256', '--', inPath, outPath], { okCodes: [3] });
    const out = await readFile(outPath);
    sendDl(res, out, safeBase(req.file.originalname) + '-baomat.pdf', 'pdf');
  } catch (e: any) {
    if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài qpdf — hãy rebuild backend.' });
    next(e);
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
});

// POST /api/pdftools/decrypt?pw=... — gỡ mật khẩu PDF (cần đúng mật khẩu hiện tại).
pdftoolsRouter.post('/decrypt', upload.single('file'), async (req: any, res, next) => {
  const pw = String(req.query.pw || req.body?.pw || '');
  if (!req.file) return res.status(400).json({ error: 'Thiếu tệp PDF' });
  const dir = await mkdtemp(join(tmpdir(), 'dec_'));
  try {
    const inPath = join(dir, 'in.pdf'), outPath = join(dir, 'out.pdf');
    await writeFile(inPath, req.file.buffer);
    await run('qpdf', ['--decrypt', `--password=${pw}`, inPath, outPath], { okCodes: [3] });
    const out = await readFile(outPath);
    sendDl(res, out, safeBase(req.file.originalname) + '-mo-khoa.pdf', 'pdf');
  } catch (e: any) {
    if (enoent(e)) return res.status(503).json({ error: 'Máy chủ chưa cài qpdf — hãy rebuild backend.' });
    return res.status(422).json({ error: 'Không gỡ được — sai mật khẩu hoặc tệp không mã hoá.' });
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
});
