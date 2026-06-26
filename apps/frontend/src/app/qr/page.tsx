'use client';
import { useEffect, useRef, useState } from 'react';

declare global { interface Window { jsQR: any } }
const CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const VBDLIS_URL = 'https://tracuuqr.vbdlis.vn/TraCuuQRGiayChungNhan';
const FIELD_LABELS = ['Ngày giờ', 'Mã đơn vị', 'Hệ thống', 'Mã hồ sơ / GCN', 'Số phát hành (seri)', '', 'Ngày giờ', 'Mã xác thực'];

export default function QrPage() {
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const lastTickRef = useRef<number>(0);

  // Bộ quét: ưu tiên BarcodeDetector (Android/Chrome) — nhanh & chuẩn; jsQR cho iOS/Safari + đọc ảnh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const BD = (window as any).BarcodeDetector;
        if (BD) {
          const fmts = await (BD.getSupportedFormats ? BD.getSupportedFormats().catch(() => null) : null);
          if (!fmts || fmts.includes('qr_code')) { detectorRef.current = new BD({ formats: ['qr_code'] }); if (!cancelled) setReady(true); }
        }
      } catch {}
      if (window.jsQR) { if (!cancelled) setReady(true); return; }
      const sc = document.createElement('script');
      sc.src = CDN; sc.async = true;
      sc.onload = () => { if (!cancelled) setReady(true); };
      sc.onerror = () => { if (!cancelled) setErr('Không tải được thư viện quét QR.'); };
      document.body.appendChild(sc);
    })();
    return () => { cancelled = true; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Khi mở khung quét: gắn luồng camera vào <video> rồi chạy vòng lặp nhận diện.
  useEffect(() => {
    if (!scanning) return;
    const v = videoRef.current, stream = streamRef.current;
    if (!v || !stream) return;
    v.srcObject = stream; v.setAttribute('playsinline', 'true');
    v.play().catch(() => {});
    lastTickRef.current = 0;
    rafRef.current = requestAnimationFrame(scanLoop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  async function handleDecoded(text: string) {
    setCode(text); setErr(''); setCopied(false);
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch {}
  }

  // jsQR: chỉ giải mã VÙNG GIỮA khung (72%) đã thu nhỏ -> nhanh & trúng hơn quét cả ảnh.
  function decodeVideoROI(v: HTMLVideoElement): string | null {
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh || !window.jsQR) return null;
    const side = Math.floor(Math.min(vw, vh) * 0.72);
    const sx = Math.floor((vw - side) / 2), sy = Math.floor((vh - side) / 2);
    const t = 384;
    const cv = canvasRef.current!; cv.width = t; cv.height = t;
    const ctx = cv.getContext('2d', { willReadFrequently: true } as any)!;
    ctx.drawImage(v, sx, sy, side, side, 0, 0, t, t);
    const img = ctx.getImageData(0, 0, t, t);
    return window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  }

  const scanLoop = async () => {
    if (!streamRef.current) return;
    const v = videoRef.current;
    if (v && v.readyState >= 2) {
      const now = performance.now();
      if (now - lastTickRef.current >= 110) { // ~9 lần/giây, đủ mượt & nhẹ máy
        lastTickRef.current = now;
        try {
          let text: string | null = null;
          if (detectorRef.current) { const r = await detectorRef.current.detect(v); if (r && r.length) text = r[0].rawValue; }
          else text = decodeVideoROI(v);
          if (text) { onDetected(text); return; }
        } catch {}
      }
    }
    if (streamRef.current) rafRef.current = requestAnimationFrame(scanLoop);
  };

  function onDetected(text: string) {
    if (!streamRef.current) return;
    try { (navigator as any).vibrate?.(90); } catch {}
    setFlash(true);
    stopCamera();
    handleDecoded(text);
    setTimeout(() => setFlash(false), 450);
  }

  async function startCamera() {
    setErr('');
    if (!detectorRef.current && !window.jsQR) return setErr('Bộ quét chưa sẵn sàng, thử lại sau giây lát.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } } });
      streamRef.current = stream; setScanning(true);
    } catch (e: any) {
      setScanning(false);
      setErr(e?.name === 'NotAllowedError' ? 'Bạn chưa cấp quyền camera cho trang. Hãy cho phép camera rồi thử lại.' : 'Không mở được camera: ' + (e?.message || e));
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  function decodeFileWithJsQR(f: File): Promise<string | null> {
    return new Promise((resolve) => {
      if (!window.jsQR) return resolve(null);
      const url = URL.createObjectURL(f); const img = new Image();
      img.onload = () => {
        const scale = Math.max(Math.min(1600 / Math.max(img.width, img.height), 3), 1);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const cv = canvasRef.current!; cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d', { willReadFrequently: true } as any)!; ctx.drawImage(img, 0, 0, w, h);
        const t = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' })?.data ?? null;
        URL.revokeObjectURL(url); resolve(t);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    e.target.value = ''; setErr('');
    try {
      let text: string | null = null;
      if (detectorRef.current && 'createImageBitmap' in window) {
        try { const bmp = await createImageBitmap(f); const r = await detectorRef.current.detect(bmp); (bmp as any).close?.(); if (r && r.length) text = r[0].rawValue; } catch {}
      }
      if (!text) text = await decodeFileWithJsQR(f);
      if (text) { stopCamera(); handleDecoded(text); }
      else setErr('Không tìm thấy mã QR trong ảnh. Hãy chụp/cắt sát mã QR, rõ nét.');
    } catch (er: any) { setErr('Không đọc được ảnh: ' + (er?.message || er)); }
  }

  const fields = code ? code.split('|') : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">Tra cứu QR Giấy chứng nhận</h1>
      <p className="text-sm text-slate-500 mb-4">Quét mã QR trên Giấy chứng nhận để đọc thông tin thửa đất.</p>
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold mb-2">1. Quét mã QR</h2>
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-sm text-slate-500 mb-3">Quét <b>tự động</b> bằng camera — đưa mã vào khung là nhận ngay, không cần bấm chụp.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={startCamera} disabled={!ready} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">📷 Quét bằng camera</button>
              <label className="bg-white border border-slate-300 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-slate-50">🖼️ Tải ảnh QR
                <input type="file" accept="image/*" onChange={onFile} className="hidden" />
              </label>
            </div>
            {!ready && <p className="text-xs text-slate-400 mt-2">Đang tải bộ quét…</p>}
          </div>
          {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
          {code && <p className="text-sm text-emerald-700 mt-2 font-semibold">✓ Đã quét được mã QR.</p>}
        </div>

        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold mb-2">2. Thông tin mã QR</h2>
          {!code && <p className="text-sm text-slate-400">Chưa có mã.</p>}
          {code && (
            <>
              <table className="w-full text-sm mb-2">
                <tbody>
                  {fields.map((f, i) => (FIELD_LABELS[i] && f ? (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1 text-slate-500 pr-2 whitespace-nowrap">{FIELD_LABELS[i]}</td>
                      <td className="py-1 font-medium text-right break-all">{f}</td>
                    </tr>
                  ) : null))}
                </tbody>
              </table>
              <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); }}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">{copied ? '✓ Đã copy mã' : 'Copy mã'}</button>
            </>
          )}
        </div>
      </div>

      {code && (
        <div className="bg-white border rounded-xl p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">3. Tra cứu trên Cổng VBĐLIS</h2>
            <a href={VBDLIS_URL} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-medium">Mở tab mới ↗</a>
          </div>
          <p className="text-sm text-amber-700 bg-amber-50 rounded p-2 mb-2">
            {copied ? '✓ Mã đã được copy. ' : ''}Dán mã (Ctrl+V) vào ô tra cứu bên dưới → xác nhận &quot;không phải người máy&quot; → bấm <b>Tìm kiếm</b> để xem thông tin Giấy chứng nhận.
          </p>
          <iframe src={VBDLIS_URL} className="w-full h-[640px] border rounded" title="VBDLIS" />
          <p className="text-xs text-slate-400 mt-1">* Nếu khung trên trống (trang VBĐLIS chặn nhúng), bấm &quot;Mở tab mới&quot; — mã đã được copy sẵn để dán.</p>
        </div>
      )}

      {/* Khung quét toàn màn hình kiểu Zalo — tự nhận, không cần bấm chụp */}
      {scanning && (
        <div className="fixed inset-0 z-[70] bg-black select-none">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: 'min(74vw, 320px)', height: 'min(74vw, 320px)' }}>
              <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: '0 0 0 100vmax rgba(0,0,0,0.55)' }} />
              <span className="absolute -top-1 -left-1 w-9 h-9 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
              <span className="absolute -top-1 -right-1 w-9 h-9 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
              <span className="absolute -bottom-1 -left-1 w-9 h-9 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
              <span className="absolute -bottom-1 -right-1 w-9 h-9 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />
              <div className="qr-scanline absolute left-3 right-3 h-0.5 rounded bg-emerald-400" style={{ boxShadow: '0 0 10px 2px rgba(52,211,153,0.9)' }} />
            </div>
          </div>
          <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 text-white">
            <span className="font-semibold text-lg drop-shadow">Quét mã QR</span>
            <button onClick={stopCamera} aria-label="Đóng" className="w-10 h-10 grid place-items-center rounded-full bg-white/15 backdrop-blur text-2xl leading-none">✕</button>
          </div>
          <div className="absolute bottom-0 inset-x-0 p-6 text-center">
            <p className="text-white/90 text-sm mb-3 drop-shadow">Đưa mã QR của Giấy chứng nhận vào khung — hệ thống tự nhận, không cần bấm chụp.</p>
            <label className="inline-block bg-white/15 hover:bg-white/25 backdrop-blur text-white px-4 py-2 rounded-full text-sm font-semibold cursor-pointer">🖼️ Chọn ảnh từ máy
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          </div>
          {flash && <div className="absolute inset-0 bg-emerald-400/40" />}
          {err && <div className="absolute top-16 inset-x-4 text-center"><span className="inline-block bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg">{err}</span></div>}
        </div>
      )}
    </div>
  );
}
