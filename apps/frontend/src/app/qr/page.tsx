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

  useEffect(() => {
    if (window.jsQR) { setReady(true); return; }
    const s = document.createElement('script');
    s.src = CDN; s.async = true; s.onload = () => setReady(true); s.onerror = () => setErr('Không tải được thư viện quét QR.');
    document.body.appendChild(s);
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDecoded(text: string) {
    setCode(text); setErr(''); setCopied(false);
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch {}
  }
  function decode(img: ImageData): string | null {
    return window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setErr(''); if (!window.jsQR) return setErr('Thư viện chưa sẵn sàng.');
    const url = URL.createObjectURL(f); const img = new Image();
    img.onload = () => {
      const scale = Math.max(Math.min(2000 / Math.max(img.width, img.height), 4), 1);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = canvasRef.current!; cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d')!; ctx.drawImage(img, 0, 0, w, h);
      const t = decode(ctx.getImageData(0, 0, w, h)); URL.revokeObjectURL(url);
      if (t) handleDecoded(t); else setErr('Không tìm thấy mã QR trong ảnh. Cắt sát mã QR và chụp rõ nét.');
    };
    img.onerror = () => setErr('Không đọc được ảnh.'); img.src = url;
  }
  async function startCamera() {
    setErr(''); if (!window.jsQR) return setErr('Thư viện chưa sẵn sàng.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream; setScanning(true);
      const v = videoRef.current!; v.srcObject = stream; await v.play();
      const tick = () => {
        if (!streamRef.current) return;
        const v2 = videoRef.current!;
        if (v2.readyState === v2.HAVE_ENOUGH_DATA) {
          const cv = canvasRef.current!; cv.width = v2.videoWidth; cv.height = v2.videoHeight;
          const ctx = cv.getContext('2d')!; ctx.drawImage(v2, 0, 0, cv.width, cv.height);
          const t = decode(ctx.getImageData(0, 0, cv.width, cv.height));
          if (t) { stopCamera(); handleDecoded(t); return; }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) { setErr('Không mở được camera: ' + e.message); setScanning(false); }
  }
  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setScanning(false);
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
          {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
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
    </div>
  );
}
