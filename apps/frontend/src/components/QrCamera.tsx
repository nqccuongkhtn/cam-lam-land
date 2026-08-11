'use client';
import { useEffect, useRef, useState } from 'react';
import { useLockBody } from '@/lib/useLockBody';

// Camera quét QR TOÀN MÀN HÌNH kiểu iPhone: nút chụp tròn, thu phóng (pinch + phím 1×/2×),
// chạm lấy nét, đèn flash (nếu máy hỗ trợ), đổi camera trước/sau, xem lại & chụp lại.
// Vừa TỰ NHẬN QR liên tục (như máy quét), vừa cho bấm nút chụp thủ công cho ca khó.
const JSQR_CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
function ensureJsQR(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.jsQR) return resolve(w.jsQR);
    const s = document.createElement('script');
    s.src = JSQR_CDN; s.async = true;
    s.onload = () => resolve(w.jsQR);
    s.onerror = () => reject(new Error('load-fail'));
    document.body.appendChild(s);
  });
}

export default function QrCamera({ onDetected, onClose }: { onDetected: (text: string) => void; onClose: () => void }) {
  useLockBody(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const pausedRef = useRef(false);   // true khi đang xem lại ảnh chụp → tạm ngưng tự nhận
  const doneRef = useRef(false);     // true khi đã đóng/đã bắt được mã
  const pinchRef = useRef<{ d: number; z: number } | null>(null);
  const cbRef = useRef({ onDetected, onClose });
  cbRef.current = { onDetected, onClose };

  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [err, setErr] = useState('');
  const [captured, setCaptured] = useState<string | null>(null);
  const [okFound, setOkFound] = useState(false);
  const [noQr, setNoQr] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasFlip, setHasFlip] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [ring, setRing] = useState<{ x: number; y: number; k: number } | null>(null);
  const [hit, setHit] = useState<{ x: number; y: number }[] | null>(null); // 4 góc mã QR đã bắt (toạ độ màn hình) → vẽ khung ôm mã

  function stopStream() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; trackRef.current = null;
  }
  function finish(text: string) {
    if (doneRef.current) return;
    doneRef.current = true;
    try { (navigator as any).vibrate?.(80); } catch {}
    stopStream();
    cbRef.current.onDetected(text);
  }
  function close() {
    if (doneRef.current) return;
    doneRef.current = true;
    stopStream();
    cbRef.current.onClose();
  }

  // Bật camera khi mở + mỗi lần đổi camera trước/sau.
  useEffect(() => {
    let cancelled = false;
    doneRef.current = false; pausedRef.current = false;
    setCaptured(null); setNoQr(false); setOkFound(false); setErr(''); setHit(null);
    (async () => {
      if (!detectorRef.current) {
        try {
          const BD = (window as any).BarcodeDetector;
          if (BD) {
            const fmts = await (BD.getSupportedFormats ? BD.getSupportedFormats().catch(() => null) : null);
            if (!fmts || fmts.includes('qr_code')) detectorRef.current = new BD({ formats: ['qr_code'] });
          }
        } catch {}
      }
      if (!detectorRef.current) { try { await ensureJsQR(); } catch { if (!cancelled) setErr('Không tải được thư viện quét QR.'); } }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0]; trackRef.current = track;
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any }); } catch {}
        try {
          const caps: any = track.getCapabilities?.() || {};
          setTorchOk(!!caps.torch);
          if (caps.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > (caps.zoom.min || 1)) { setZoomCaps({ min: caps.zoom.min || 1, max: caps.zoom.max }); setZoom(caps.zoom.min || 1); }
          else setZoomCaps(null);
        } catch {}
        try { const ds = await navigator.mediaDevices.enumerateDevices(); setHasFlip(ds.filter((d) => d.kind === 'videoinput').length > 1); } catch {}
        const v = videoRef.current!; v.srcObject = stream; await v.play();
        setTorchOn(false);
        if (!cancelled) { lastRef.current = 0; rafRef.current = requestAnimationFrame(tick); }
      } catch (e: any) {
        if (!cancelled) setErr(e?.name === 'NotAllowedError' ? 'Bạn chưa cấp quyền camera. Hãy cho phép rồi thử lại.' : 'Không mở được camera: ' + (e?.message || e));
      }
    })();
    return () => { cancelled = true; stopStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  // Ánh xạ 1 điểm toạ độ VIDEO (gốc) → toạ độ MÀN HÌNH (video hiển thị object-cover).
  function mapVideoToScreen(p: { x: number; y: number }) {
    const v = videoRef.current!; const rect = v.getBoundingClientRect();
    const vw = v.videoWidth || 1, vh = v.videoHeight || 1;
    const scale = Math.max(rect.width / vw, rect.height / vh);
    const ox = rect.left + (rect.width - vw * scale) / 2;
    const oy = rect.top + (rect.height - vh * scale) / 2;
    return { x: ox + p.x * scale, y: oy + p.y * scale };
  }
  // BẮT ĐƯỢC mã → dừng nhận diện, vẽ KHUNG XANH ôm đúng mã ~0.5s (hiệu ứng chuyên nghiệp) rồi trả kết quả.
  function onHit(text: string, pts: { x: number; y: number }[] | null) {
    if (doneRef.current || pausedRef.current) return;
    pausedRef.current = true;
    setOkFound(true);
    if (pts && pts.length >= 3) { try { setHit(pts.map(mapVideoToScreen)); } catch {} }
    setTimeout(() => finish(text), 480);
  }

  // Vòng lặp TỰ NHẬN QR (dùng ref cho mọi cờ điều khiển → không lo closure cũ).
  const tick = async () => {
    if (doneRef.current) return;
    const v = videoRef.current;
    if (!pausedRef.current && v && v.readyState >= 2) {
      const now = performance.now();
      if (now - lastRef.current >= 150) {
        lastRef.current = now;
        try {
          let text: string | null = null; let pts: { x: number; y: number }[] | null = null;
          if (detectorRef.current) { const r = await detectorRef.current.detect(v); if (r && r.length) { text = r[0].rawValue; pts = (r[0].cornerPoints || []).map((c: any) => ({ x: c.x, y: c.y })); } }
          else { const res = decodeCurrentLoc(0.8); if (res) { text = res.data; pts = res.pts; } }
          if (text) { onHit(text, pts); return; }
        } catch {}
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  // Giải mã khung hình hiện tại bằng jsQR (cắt vuông giữa khung) + trả toạ độ 4 góc mã (hệ VIDEO gốc).
  function decodeCurrentLoc(ratio: number): { data: string; pts: { x: number; y: number }[] } | null {
    const v = videoRef.current; const jsQR = (window as any).jsQR;
    if (!v || !jsQR) return null;
    const vw = v.videoWidth, vh = v.videoHeight; if (!vw || !vh) return null;
    const cv = canvasRef.current!; const ctx = cv.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
    const crop = Math.round(Math.min(vw, vh) * ratio);
    const sx0 = Math.round((vw - crop) / 2), sy0 = Math.round((vh - crop) / 2);
    const T = 900; cv.width = T; cv.height = T;
    ctx.drawImage(v, sx0, sy0, crop, crop, 0, 0, T, T);
    const r = jsQR(ctx.getImageData(0, 0, T, T).data, T, T, { inversionAttempts: 'attemptBoth' });
    if (!r?.data) return null;
    const f = crop / T; const L = r.location;
    const m = (c: any) => ({ x: sx0 + c.x * f, y: sy0 + c.y * f });
    return { data: r.data, pts: [m(L.topLeftCorner), m(L.topRightCorner), m(L.bottomRightCorner), m(L.bottomLeftCorner)] };
  }

  // Nút chụp: đóng băng khung ở độ phân giải gốc → xem lại → giải mã.
  async function shoot() {
    const v = videoRef.current; if (!v || !v.videoWidth || doneRef.current) return;
    pausedRef.current = true;
    setFlashOn(true); setTimeout(() => setFlashOn(false), 180);
    const vw = v.videoWidth, vh = v.videoHeight;
    const cv = canvasRef.current!; cv.width = vw; cv.height = vh;
    const ctx = cv.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
    ctx.drawImage(v, 0, 0, vw, vh);
    setCaptured(cv.toDataURL('image/jpeg', 0.9)); setNoQr(false); setOkFound(false);
    let text: string | null = null;
    try {
      if (detectorRef.current && 'createImageBitmap' in window) {
        const bmp = await createImageBitmap(cv); const r = await detectorRef.current.detect(bmp); (bmp as any).close?.(); if (r && r.length) text = r[0].rawValue;
      }
    } catch {}
    if (!text) { const jsQR = (window as any).jsQR; if (jsQR) { const r = jsQR(ctx.getImageData(0, 0, vw, vh).data, vw, vh, { inversionAttempts: 'attemptBoth' }); text = r?.data ?? null; } }
    if (text) { setOkFound(true); setTimeout(() => finish(text!), 550); }
    else setNoQr(true);
  }
  function retake() { setCaptured(null); setNoQr(false); setOkFound(false); setHit(null); pausedRef.current = false; lastRef.current = 0; }

  async function toggleTorch() {
    const t = trackRef.current; if (!t) return;
    try { await t.applyConstraints({ advanced: [{ torch: !torchOn }] as any }); setTorchOn((x) => !x); } catch {}
  }
  async function applyZoom(z: number) {
    const t = trackRef.current, caps = zoomCaps; if (!t || !caps) return;
    const v = Math.min(caps.max, Math.max(caps.min, z));
    try { await t.applyConstraints({ advanced: [{ zoom: v }] as any }); setZoom(v); } catch {}
  }
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  function onTouchStart(e: React.TouchEvent) { if (e.touches.length === 2 && zoomCaps) pinchRef.current = { d: dist(e.touches), z: zoom }; }
  function onTouchMove(e: React.TouchEvent) { if (e.touches.length === 2 && pinchRef.current && zoomCaps) { e.preventDefault(); applyZoom(pinchRef.current.z * (dist(e.touches) / pinchRef.current.d)); } }
  function onTouchEnd(e: React.TouchEvent) { if (e.touches.length < 2) pinchRef.current = null; }
  async function onTapFocus(e: React.MouseEvent) {
    const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect();
    setRing({ x: e.clientX - r.left, y: e.clientY - r.top, k: Date.now() });
    setTimeout(() => setRing((cur) => (cur && Date.now() - cur.k >= 750 ? null : cur)), 800);
    const t = trackRef.current;
    if (t) { try { await t.applyConstraints({ advanced: [{ focusMode: 'single-shot', pointsOfInterest: [{ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }] }] as any }); } catch {} }
  }

  const presets = zoomCaps ? [1, 2, 3, 5].filter((z) => z >= zoomCaps.min - 0.01 && z <= zoomCaps.max + 0.01) : [];
  const corner = 'absolute w-7 h-7 border-white/95';

  return (
    <div className="fixed inset-0 z-[80] bg-black h-[100dvh] w-screen overflow-hidden select-none">
      <style>{`@keyframes qrScan{0%{transform:translateY(-42%)}50%{transform:translateY(42%)}100%{transform:translateY(-42%)}}.qr-scan{animation:qrScan 2.4s ease-in-out infinite}@keyframes qrFocus{0%{transform:scale(1.4);opacity:0}25%{transform:scale(1);opacity:1}100%{transform:scale(.9);opacity:0}}.qr-focus{animation:qrFocus .8s ease-out forwards}@keyframes qrHit{from{opacity:0}to{opacity:1}}.qr-hit{animation:qrHit .18s ease-out}@keyframes qrPulse{0%,100%{opacity:1}50%{opacity:.45}}.qr-corner{animation:qrPulse 1.6s ease-in-out infinite}`}</style>
      <canvas ref={canvasRef} className="hidden" />

      {/* Lớp video: chạm để lấy nét, chụm 2 ngón để thu phóng */}
      <div className="absolute inset-0" onClick={onTapFocus} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        {captured && <img src={captured} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {!captured && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: 'min(74vw, 320px)', height: 'min(74vw, 320px)' }}>
              <div className="absolute inset-0 rounded-3xl" style={{ boxShadow: '0 0 0 100vmax rgba(0,0,0,0.45)' }} />
              <span className={`${corner} top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl`} />
              <span className={`${corner} top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl`} />
              <span className={`${corner} bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl`} />
              <span className={`${corner} bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl`} />
              <div className="qr-scan absolute left-3 right-3 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 16px 3px rgba(16,185,129,0.9)' }} />
            </div>
          </div>
        )}
        {/* KHUNG XANH ôm đúng mã QR khi vừa bắt được (hiệu ứng chuyên nghiệp) */}
        {!captured && hit && hit.length >= 3 && (
          <svg className="pointer-events-none absolute inset-0 z-[84] h-full w-full">
            <polygon points={hit.map((p) => `${p.x},${p.y}`).join(' ')} className="qr-hit" fill="rgba(16,185,129,0.18)" stroke="#34d399" strokeWidth={3.5} strokeLinejoin="round" />
          </svg>
        )}
        {ring && <span key={ring.k} className="pointer-events-none absolute w-16 h-16 -ml-8 -mt-8 rounded-full border-2 border-yellow-300 qr-focus" style={{ left: ring.x, top: ring.y }} />}
      </div>

      {/* Nháy flash khi chụp */}
      <div className={`absolute inset-0 z-[85] bg-white pointer-events-none transition-opacity ${flashOn ? 'opacity-90 duration-0' : 'opacity-0 duration-300'}`} />

      {/* Thanh trên: đóng · tiêu đề · đèn flash */}
      <div className="absolute top-0 inset-x-0 z-[86] flex items-center justify-between px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)', paddingBottom: '0.6rem' }}>
        <button onClick={close} aria-label="Đóng" className="w-10 h-10 rounded-full bg-black/35 backdrop-blur grid place-items-center text-white text-xl leading-none">✕</button>
        <span className="text-white/95 text-sm font-semibold drop-shadow">Quét mã QR sổ đỏ</span>
        {torchOk ? <button onClick={toggleTorch} aria-label="Đèn flash" className={`w-10 h-10 rounded-full grid place-items-center text-lg backdrop-blur ${torchOn ? 'bg-yellow-400 text-black' : 'bg-black/35 text-white'}`}>⚡</button> : <span className="w-10 h-10" />}
      </div>

      {err && <div className="absolute top-20 inset-x-4 z-[86] bg-red-600/90 text-white text-sm rounded-xl px-4 py-3 text-center">{err}</div>}

      {/* Thanh dưới */}
      <div className="absolute bottom-0 inset-x-0 z-[86] px-6 pt-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.1rem)' }}>
        {!captured ? (
          <>
            {presets.length > 1 && (
              <div className="flex justify-center gap-2 mb-4">
                {presets.map((z) => (
                  <button key={z} onClick={() => applyZoom(z)} className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur transition ${Math.abs(zoom - z) < 0.3 ? 'bg-white text-black' : 'bg-black/40 text-white'}`}>{z}×</button>
                ))}
              </div>
            )}
            <p className="text-white/85 text-xs text-center mb-4 drop-shadow">Đưa mã QR vào khung — tự nhận, hoặc bấm nút tròn để chụp.</p>
            <div className="flex items-center justify-center gap-8">
              <span className="w-11 h-11" />
              <button onClick={shoot} aria-label="Chụp" className="group relative w-[74px] h-[74px] rounded-full active:scale-90 transition-transform">
                <span className="absolute inset-0 rounded-full border-[3px] border-white shadow-lg" />
                <span className="absolute inset-[5px] rounded-full bg-white transition-all duration-150 group-active:inset-[10px] group-active:bg-white/70" />
              </button>
              {hasFlip ? <button onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} aria-label="Đổi camera" className="w-11 h-11 rounded-full bg-black/40 backdrop-blur grid place-items-center text-white text-lg">🔄</button> : <span className="w-11 h-11" />}
            </div>
          </>
        ) : (
          <div className="text-center">
            {okFound ? (
              <div className="mb-4 inline-flex items-center gap-2 bg-emerald-500 text-white font-bold px-4 py-2 rounded-full"><span>✓</span> Đã đọc được mã QR</div>
            ) : noQr ? (
              <p className="text-white font-semibold mb-4 drop-shadow">Không thấy mã QR trong ảnh. Chụp lại: đưa mã vào giữa khung, giữ máy chắc tay, đủ sáng.</p>
            ) : (
              <p className="text-white/80 mb-4">Đang đọc…</p>
            )}
            {!okFound && (
              <div className="flex items-center justify-center gap-4">
                <button onClick={retake} className="bg-white text-black font-bold px-6 py-3 rounded-full">↺ Chụp lại</button>
                <button onClick={close} className="bg-black/40 text-white font-semibold px-6 py-3 rounded-full backdrop-blur">Đóng</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
