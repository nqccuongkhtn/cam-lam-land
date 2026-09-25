'use client';
import { useEffect, useRef, useState } from 'react';
import ServicesSection from '@/components/ServicesSection';
import LegalConsultCTA from '@/components/LegalConsultCTA';
import QrCamera from '@/components/QrCamera';

declare global { interface Window { jsQR: any } }
const CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const VBDLIS_URL = 'https://tracuuqr.vbdlis.vn/TraCuuQRGiayChungNhan';
const FIELD_LABELS = ['Ngày giờ tạo mã', 'Mã đơn vị cấp', 'Hệ thống', 'Mã hồ sơ / GCN', 'Số phát hành (seri)', '', 'Ngày giờ cấp GCN', 'Mã xác thực'];

// Định dạng đẹp cho từng trường: chuỗi 14 số yyyyMMddHHmmss → dd/MM/yyyy HH:mm:ss; 8 số yyyyMMdd → dd/MM/yyyy.
function fmtVal(v: string): string {
  const s = (v || '').trim();
  if (/^\d{14}$/.test(s)) return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
  if (/^\d{8}$/.test(s)) return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
  return s;
}

export default function QrPage() {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false); // nhúng cổng VBĐLIS ngay trong trang (người dùng tự tick CAPTCHA)
  const [err, setErr] = useState('');
  const [camOpen, setCamOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<any>(null);

  // Bộ giải mã cho phần TẢI ẢNH: ưu tiên BarcodeDetector (Android/Chrome); jsQR cho iOS/Safari.
  // (Camera trực tiếp tự nạp bộ quét riêng trong QrCamera.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const BD = (window as any).BarcodeDetector;
        if (BD) {
          const fmts = await (BD.getSupportedFormats ? BD.getSupportedFormats().catch(() => null) : null);
          if (!fmts || fmts.includes('qr_code')) detectorRef.current = new BD({ formats: ['qr_code'] });
        }
      } catch {}
      if ((window as any).jsQR || cancelled) return;
      const s = document.createElement('script'); s.src = CDN; s.async = true;
      s.onerror = () => { if (!cancelled) setErr('Không tải được thư viện quét QR.'); };
      document.body.appendChild(s);
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleDecoded(text: string) {
    setCamOpen(false);
    setCode(text); setErr(''); setCopied(false);
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch {}
  }

  // Đọc mã QR từ 1 ẢNH tải lên (phóng to nếu ảnh nhỏ → dễ bắt mã).
  function decodeFileWithJsQR(f: File): Promise<string | null> {
    return new Promise((resolve) => {
      const jsQR = (window as any).jsQR;
      if (!jsQR) return resolve(null);
      const url = URL.createObjectURL(f); const img = new Image();
      img.onload = () => {
        const scale = Math.max(Math.min(2000 / Math.max(img.width, img.height), 4), 1);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const cv = canvasRef.current!; cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D; ctx.drawImage(img, 0, 0, w, h);
        const t = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' })?.data ?? null;
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
      if (text) handleDecoded(text);
      else setErr('Không tìm thấy mã QR trong ảnh. Cắt sát mã QR và chụp rõ nét.');
    } catch (er: any) { setErr('Không đọc được ảnh: ' + (er?.message || er)); }
  }

  const fields = code ? code.split('|') : [];

  return (
    <>
    {camOpen && <QrCamera onDetected={handleDecoded} onClose={() => setCamOpen(false)} />}
    <div className="mx-auto max-w-5xl px-3 sm:px-4 py-5 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Tra cứu QR Giấy chứng nhận</h1>
      <p className="text-sm text-slate-500 mb-3 sm:mb-4">Quét mã QR trên Giấy chứng nhận để đọc thông tin thửa đất.</p>

      <canvas ref={canvasRef} className="hidden" />

      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold mb-2">1. Quét / tải mã QR</h2>
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 px-4 text-center mb-3">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-sm text-slate-500">Mở camera quét mã QR trên Giấy chứng nhận, hoặc tải ảnh có sẵn.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setErr(''); setCamOpen(true); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 rounded-lg text-sm font-semibold">📷 Mở camera</button>
            <label className="flex-1 bg-white border px-3 py-2.5 rounded-lg text-sm font-semibold text-center cursor-pointer hover:bg-slate-50">🖼️ Tải ảnh QR
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          </div>
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
              <dl className="mb-3 divide-y divide-slate-100 text-sm">
                {fields.map((f, i) => {
                  const val = (f || '').trim();
                  if (!val) return null;
                  const label = FIELD_LABELS[i] || `Dữ liệu #${i + 1}`;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                      <dt className="whitespace-nowrap text-slate-500">{label}</dt>
                      <dd className="flex min-w-0 items-center gap-1.5">
                        <span className="break-all text-right font-semibold text-[#0A2540]">{fmtVal(val)}</span>
                        <button onClick={() => { navigator.clipboard.writeText(val).catch(() => {}); }} title="Sao chép trường này" className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[#0A2540]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                        </button>
                      </dd>
                    </div>
                  );
                })}
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
          <p className="text-sm text-slate-500 mb-3">Thông tin chi tiết (chủ sở hữu, diện tích, ranh giới) nằm trong cơ sở dữ liệu đất đai quốc gia, do <b>cổng VBĐLIS chính thức</b> trả về. Mã tra cứu đã được copy sẵn — chỉ cần dán vào, tick &quot;không phải người máy&quot; rồi bấm Tìm kiếm.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => { try { navigator.clipboard.writeText(code); setCopied(true); } catch {} setShowEmbed(true); }}
              className="flex-1 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold py-3 rounded-xl text-sm">
              🔎 Tra cứu ngay tại đây
            </button>
            <button
              onClick={() => { try { navigator.clipboard.writeText(code); setCopied(true); } catch {} window.open(VBDLIS_URL, '_blank', 'noopener'); }}
              className="flex-1 sm:flex-none bg-white border border-[#0A2540] text-[#0A2540] hover:bg-slate-50 font-semibold py-3 px-4 rounded-xl text-sm">
              Mở tab mới ↗
            </button>
          </div>

          {/* Nhúng cổng chính thức — người dùng TỰ tick CAPTCHA & Tìm kiếm ngay trong khung. */}
          {showEmbed && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Cổng chính thức nhúng bên dưới — dán mã (đã copy), tick xác thực rồi Tìm kiếm.</span>
                <button onClick={() => setShowEmbed(false)} className="text-xs text-slate-500 hover:text-[#0A2540]">Ẩn ✕</button>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50" style={{ height: '78vh', minHeight: 480 }}>
                <iframe src={VBDLIS_URL} title="Cổng tra cứu QR VBĐLIS" className="absolute inset-0 h-full w-full" referrerPolicy="no-referrer" />
              </div>
              <p className="mt-1.5 text-[11px] text-amber-600">Nếu khung trên trống (cổng đang tạm chặn nhúng), bấm <b>“Mở tab mới ↗”</b> để tra như bình thường — mã đã copy sẵn.</p>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-2">Cổng chính thức: tracuuqr.vbdlis.vn — thông tin phản hồi từ mã QR có giá trị pháp lý như trên Giấy chứng nhận. Bạn tự xác thực &quot;không phải người máy&quot; ngay trong khung; Cam Lâm Land không lưu trữ dữ liệu tra cứu của bạn.</p>
        </div>
      )}

    </div>
    <div className="mx-auto max-w-7xl px-3 sm:px-6 pb-6 sm:pb-8">
      <ServicesSection className="mt-6 sm:mt-8" />
      <LegalConsultCTA topic="Dịch vụ pháp lý (từ QR sổ đỏ)" className="mt-4" />
    </div>
    </>
  );
}
