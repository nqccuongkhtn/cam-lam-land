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
      const s = document.createElement('script');
      s.src = CDN; s.async = true;
      s.onload = () => { if (!cancelled) setReady(true); };
      s.onerror = () => { if (!cancelled) setErr('Không tải được thư viện quét QR.'); };
      document.body.appendChild(s);
    })();
    return () => { cancelled = true; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDecoded(text: string) {
    setCode(text); setErr(''); setCopied(false);
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch {}
  }

  // jsQR: thu nhỏ cả khung hình rồi giải mã -> nhanh hơn, vẫn nhận mã ở bất kỳ vị trí nào trong hình.
  function decodeVideoFrame(v: HTMLVideoElement): string | null {
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh || !window.jsQR) return null;
    const cv = canvasRef.current!;
    const ctx = cv.getContext('2d', { willReadFrequently: true } as any)!;
    // Lần 1: cắt vùng vuông giữa khung (nơi người dùng ngắm QR) & giải mã ở độ phân giải cao → bắt được cả QR nhỏ.
    const crop = Math.round(Math.min(vw, vh) * 0.8);
    const T = 900;
    cv.width = T; cv.height = T;
    ctx.drawImage(v, Math.round((vw - crop) / 2), Math.round((vh - crop) / 2), crop, crop, 0, 0, T, T);
    let img = ctx.getImageData(0, 0, T, T);
    let r = window.jsQR(img.data, T, T, { inversionAttempts: 'attemptBoth' });
    if (r?.data) return r.data;
    // Lần 2: quét toàn khung (QR nằm lệch) ở độ phân giải vừa phải.
    const scale = Math.min(1080 / Math.max(vw, vh), 1);
    const w = Math.round(vw * scale), h = Math.round(vh * scale);
    cv.width = w; cv.height = h;
    ctx.drawImage(v, 0, 0, w, h);
    img = ctx.getImageData(0, 0, w, h);
    r = window.jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
    return r?.data ?? null;
  }

  const scanLoop = async () => {
    if (!streamRef.current) return;
    const v = videoRef.current;
    if (v && v.readyState >= 2) {
      const now = performance.now();
      if (now - lastTickRef.current >= 140) { // ~7 lần/giây (2 lượt decode/khung)
        lastTickRef.current = now;
        try {
          let text: string | null = null;
          if (detectorRef.current) { const r = await detectorRef.current.detect(v); if (r && r.length) text = r[0].rawValue; }
          else text = decodeVideoFrame(v);
          if (text) { onDetected(text); return; }
        } catch {}
      }
    }
    if (streamRef.current) rafRef.current = requestAnimationFrame(scanLoop);
  };

  function onDetected(text: string) {
    if (!streamRef.current) return;
    try { (navigator as any).vibrate?.(80); } catch {}
    stopCamera();
    handleDecoded(text);
  }

  async function startCamera() {
    setErr('');
    if (!detectorRef.current && !window.jsQR) return setErr('Bộ quét chưa sẵn sàng, thử lại sau giây lát.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      try { await stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any }); } catch {}
      streamRef.current = stream; setScanning(true);
      const v = videoRef.current!; v.srcObject = stream; await v.play();
      lastTickRef.current = 0;
      rafRef.current = requestAnimationFrame(scanLoop);
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
        const scale = Math.max(Math.min(2000 / Math.max(img.width, img.height), 4), 1);
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
      else setErr('Không tìm thấy mã QR trong ảnh. Cắt sát mã QR và chụp rõ nét.');
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
          <h2 className="font-semibold mb-2">1. Quét / tải mã QR</h2>
          <div className="relative w-full bg-slate-900 rounded mb-2 aspect-video overflow-hidden flex items-center justify-center">
            <video ref={videoRef} className={`w-full h-full object-cover ${scanning ? '' : 'hidden'}`} muted playsInline />
            {!scanning && <span className="text-slate-400 text-sm">Camera / ảnh QR</span>}
          </div>
          <div className="flex gap-2">
            {!scanning
              ? <button onClick={startCamera} disabled={!ready} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">📷 Camera</button>
              : <button onClick={stopCamera} className="bg-slate-600 text-white px-3 py-1.5 rounded text-sm">Dừng</button>}
            <label className="bg-white border px-3 py-1.5 rounded text-sm cursor-pointer hover:bg-slate-50">🖼️ Tải ảnh QR
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          </div>
          {scanning && <p className="text-xs text-slate-400 mt-2">Đưa mã QR vào khung hình — hệ thống tự nhận, không cần bấm chụp.</p>}
          {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
        </div>

        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold mb-2">2. Thông tin xác thực Giấy chứng nhận</h2>
          {!code && <p className="text-sm text-slate-400">Chưa có mã. Quét bằng camera hoặc tải ảnh mã QR ở bên trái.</p>}
          {code && (
            <>
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-2 text-sm font-semibold mb-3">
                <span>✓</span> Đã đọc được mã QR hợp lệ trên Giấy chứng nhận
              </div>
              <dl className="divide-y divide-slate-100 text-sm mb-3">
                {fields.map((f, i) => (FIELD_LABELS[i] && f ? (
                  <div key={i} className="flex justify-between gap-3 py-1.5">
                    <dt className="text-slate-500 whitespace-nowrap">{FIELD_LABELS[i]}</dt>
                    <dd className="font-semibold text-[#0A2540] text-right break-all">{f}</dd>
                  </div>
                ) : null))}
              </dl>
              <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold">{copied ? '✓ Đã copy mã tra cứu' : '📋 Copy mã tra cứu'}</button>
              <p className="text-[11px] text-slate-400 mt-2">Đây là thông tin xác thực in kèm mã QR (xác nhận sổ thật + mã để tra cứu). Chi tiết thửa đất (chủ, diện tích, ranh giới) xem ở bước 3.</p>
            </>
          )}
        </div>
      </div>

      {code && (
        <div className="bg-white border rounded-xl p-4 mt-4">
          <h2 className="font-semibold mb-1">3. Xem chi tiết thửa đất trên cổng chính thức</h2>
          <p className="text-sm text-slate-500 mb-3">Thông tin chi tiết (chủ sở hữu, diện tích, ranh giới) nằm trong cơ sở dữ liệu đất đai quốc gia. Bấm nút dưới để mở <b>cổng VBĐLIS chính thức</b> — mã tra cứu đã được copy sẵn, chỉ cần dán vào, tick &quot;không phải người máy&quot; rồi bấm Tìm kiếm.</p>
          <button
            onClick={() => { try { navigator.clipboard.writeText(code); setCopied(true); } catch {} window.open(VBDLIS_URL, '_blank', 'noopener'); }}
            className="w-full bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold py-3 rounded-xl text-sm">
            📋 Copy mã &amp; mở cổng VBĐLIS chính thức ↗
          </button>
          <p className="text-[11px] text-slate-400 mt-2">Cổng chính thức: tracuuqr.vbdlis.vn — thông tin phản hồi từ mã QR có giá trị pháp lý như trên Giấy chứng nhận. Cam Lâm Land không lưu trữ dữ liệu tra cứu của bạn.</p>
        </div>
      )}
    </div>
  );
}
