'use client';
// KHUNG XEM VĂN BẢN NGAY TRONG TRANG (chủ dự án 6/10/2026: "mở xem ở web mình, không mở trang mới nữa").
// · Bấm là khung mở NGAY, có thanh % đang tải (đọc dần từng phần file, biết tổng dung lượng thì ra %).
// · Vẽ bằng PDF.js (cùng thư viện công cụ Sửa PDF) thay vì trình xem PDF của trình duyệt — điện thoại Android
//   không xem được PDF nhúng, iPhone chỉ hiện trang đầu. Trang nào cuộn tới mới vẽ trang đó cho nhẹ máy.
// · Nút "Tải về" lưu đúng file (đã có dấu bản quyền Cam Lâm Land do máy chủ gắn).
import { useEffect, useRef, useState } from 'react';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let napPdfjs: Promise<any> | null = null;
function layPdfjs(): Promise<any> {
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
  if (!napPdfjs) napPdfjs = new Promise((ok, loi) => {
    const s = document.createElement('script'); s.src = PDFJS; s.async = true;
    s.onload = () => { const l = (window as any).pdfjsLib; l.GlobalWorkerOptions.workerSrc = WORKER; ok(l); };
    s.onerror = () => { napPdfjs = null; loi(new Error('Không tải được bộ đọc PDF')); };
    document.head.appendChild(s);
  });
  return napPdfjs;
}

export type MoVanBan = { id: number; ten: string; tenFile: string; url: string; token: string };

export default function XemVanBan({ vb, onDong, onLoi }: { vb: MoVanBan; onDong: () => void; onLoi: (m: string) => void }) {
  const [phanTram, setPhanTram] = useState<number | null>(0);   // null = không biết tổng dung lượng
  const [daTai, setDaTai] = useState(0);
  const [soTrang, setSoTrang] = useState(0);
  const [blobUrl, setBlobUrl] = useState('');
  const docRef = useRef<any>(null);
  const khungRef = useRef<HTMLDivElement>(null);

  // Khoá cuộn trang nền + phím Esc để đóng
  useEffect(() => {
    const cu = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const phim = (e: KeyboardEvent) => { if (e.key === 'Escape') onDong(); };
    window.addEventListener('keydown', phim);
    return () => { document.body.style.overflow = cu; window.removeEventListener('keydown', phim); };
  }, [onDong]);

  // Tải file, đếm % theo từng phần nhận được
  useEffect(() => {
    let huy = false; const ctl = new AbortController(); let url = '';
    (async () => {
      try {
        const libP = layPdfjs();
        const r = await fetch(vb.url, { headers: { Authorization: `Bearer ${vb.token}` }, signal: ctl.signal });
        if (r.status === 401) throw new Error('Vui lòng đăng nhập lại để xem văn bản.');
        if (!r.ok || !(r.headers.get('content-type') || '').includes('pdf')) throw new Error('Chưa có file cho văn bản này.');
        const tong = Number(r.headers.get('content-length')) || 0;
        if (!tong) setPhanTram(null);
        const doc = r.body?.getReader();
        const manh: Uint8Array[] = []; let n = 0;
        if (doc) {
          for (;;) { const { done, value } = await doc.read(); if (done) break; manh.push(value); n += value.length; if (!huy) { setDaTai(n); if (tong) setPhanTram(Math.min(99, Math.round((n / tong) * 100))); } }
        } else { const b = new Uint8Array(await r.arrayBuffer()); manh.push(b); n = b.length; }
        const bytes = new Uint8Array(n); let o = 0; for (const m of manh) { bytes.set(m, o); o += m.length; }
        if (huy) return;
        url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); setBlobUrl(url);
        const lib = await libP;
        const pdf = await lib.getDocument({ data: bytes }).promise;
        if (huy) return;
        docRef.current = pdf; setPhanTram(100); setSoTrang(pdf.numPages);
      } catch (e: any) {
        if (huy || e?.name === 'AbortError') return;
        onLoi(e?.message || 'Không mở được văn bản.'); onDong();
      }
    })();
    return () => { huy = true; ctl.abort(); if (url) URL.revokeObjectURL(url); docRef.current?.destroy?.(); };
  }, [vb.url, vb.token, onDong, onLoi]);

  // % ẢO (chủ dự án 7/10/2026): văn bản mở LẦN ĐẦU thì máy chủ còn phải đi lấy file ở cổng nhà nước + gắn dấu,
  // mấy giây đầu chưa có byte nào → thanh đứng ở 0% như bị treo. Nên cho % tự nhích dần (nhanh lúc đầu, chậm dần,
  // không bao giờ quá 92%); có số thật lớn hơn thì theo số thật, mở xong nhảy 100%.
  const [ao, setAo] = useState(0);
  useEffect(() => {
    if (soTrang) return;
    const t = setInterval(() => setAo((x) => (x >= 92 ? x : x + Math.max(0.3, (92 - x) * 0.06))), 200);
    return () => clearInterval(t);
  }, [soTrang]);
  const hienPt = soTrang ? 100 : Math.round(Math.min(99, Math.max(ao, phanTram ?? 0)));

  const taiVe = () => { if (!blobUrl) return; const a = document.createElement('a'); a.href = blobUrl; a.download = vb.tenFile; a.click(); };
  const mb = (b: number) => (b / 1048576).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-slate-700" role="dialog" aria-modal="true" aria-label={vb.ten}>
      <div className="flex items-center gap-2 bg-white px-3 py-2 shadow">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-[#0A2540]">{vb.ten}</p>
          <p className="text-[11px] text-slate-500">{soTrang ? `${soTrang} trang` : `Đang tải… ${hienPt}%`}</p>
        </div>
        <button type="button" onClick={taiVe} disabled={!blobUrl} className="h-8 shrink-0 rounded-md border border-slate-200 px-3 text-[13px] font-semibold text-[#0A2540] hover:bg-slate-50 disabled:opacity-40">Tải về</button>
        <button type="button" onClick={onDong} aria-label="Đóng" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-xl leading-none text-slate-500 hover:bg-slate-100">✕</button>
      </div>
      {/* thanh % ngay dưới đầu khung */}
      <div className="h-1 w-full bg-slate-200">
        <div className="h-full bg-[#C8A14B] transition-[width] duration-200" style={{ width: `${hienPt}%` }} />
      </div>
      <div ref={khungRef} className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-6">
        {!soTrang && (
          <div className="mx-auto mt-16 max-w-xs text-center text-sm text-white/90">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Đang tải văn bản… {hienPt}%
            {daTai > 0 && <span className="mt-1 block text-[12px] text-white/60">{mb(daTai)} MB</span>}
          </div>
        )}
        {soTrang > 0 && Array.from({ length: soTrang }, (_, i) => <TrangPdf key={i} doc={docRef.current} so={i + 1} khung={khungRef} />)}
      </div>
    </div>
  );
}

/** Một trang: giữ chỗ đúng tỉ lệ, cuộn gần tới mới vẽ (nhẹ cho điện thoại khi văn bản dài 60–70 trang). */
function TrangPdf({ doc, so, khung }: { doc: any; so: number; khung: React.RefObject<HTMLDivElement> }) {
  const ref = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [tiLe, setTiLe] = useState(1.414);
  const [ve, setVe] = useState(false);
  useEffect(() => {
    let huy = false;
    doc.getPage(so).then((p: any) => { if (!huy) { const v = p.getViewport({ scale: 1 }); setTiLe(v.height / v.width); } });
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((ds) => { if (ds.some((d) => d.isIntersecting)) { setVe(true); io.disconnect(); } }, { root: khung.current, rootMargin: '800px 0px' });
    io.observe(el);
    return () => { huy = true; io.disconnect(); };
  }, [doc, so, khung]);
  useEffect(() => {
    if (!ve || !cv.current || !ref.current) return;
    let tac: any; let huy = false;
    doc.getPage(so).then((p: any) => {
      if (huy || !cv.current || !ref.current) return;
      const rong = ref.current.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 2);
      const v = p.getViewport({ scale: (rong / p.getViewport({ scale: 1 }).width) * dpr });
      const c = cv.current; c.width = v.width; c.height = v.height;
      tac = p.render({ canvasContext: c.getContext('2d'), viewport: v });
    });
    return () => { huy = true; tac?.cancel?.(); };
  }, [ve, doc, so]);
  return (
    <div ref={ref} className="relative mx-auto mb-3 w-full max-w-[900px] bg-white shadow-lg" style={{ aspectRatio: `1 / ${tiLe}` }}>
      <canvas ref={cv} className="block h-full w-full" />
      {!ve && <span className="absolute inset-0 grid place-items-center text-xs text-slate-300">Trang {so}</span>}
    </div>
  );
}
