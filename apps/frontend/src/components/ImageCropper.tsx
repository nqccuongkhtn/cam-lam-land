'use client';
import { useEffect, useRef, useState } from 'react';

interface Pt { x: number; y: number }

export default function ImageCropper({ file, size = 512, title = 'Cân chỉnh ảnh', round = true, onCancel, onDone }: {
  file: File; size?: number; title?: string; round?: boolean;
  onCancel: () => void; onDone: (blob: Blob) => void;
}) {
  const VIEW = 280;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const posRef = useRef(pos); posRef.current = pos;
  const scaleRef = useRef(scale); scaleRef.current = scale;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const s = Math.max(VIEW / im.width, VIEW / im.height);
      setMinScale(s); setScale(s);
      setPos({ x: (VIEW - im.width * s) / 2, y: (VIEW - im.height * s) / 2 });
      setImg(im);
    };
    im.onerror = () => onCancel();
    im.src = url;
    return () => { try { URL.revokeObjectURL(url); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function clamp(p: Pt, sc: number, im: HTMLImageElement): Pt {
    const w = im.width * sc, h = im.height * sc;
    return { x: Math.min(0, Math.max(VIEW - w, p.x)), y: Math.min(0, Math.max(VIEW - h, p.y)) };
  }
  const getPt = (e: any): Pt => { const t = e.touches?.[0]; return { x: t ? t.clientX : e.clientX, y: t ? t.clientY : e.clientY }; };
  function down(e: any) { const p = getPt(e); drag.current = { sx: p.x, sy: p.y, px: posRef.current.x, py: posRef.current.y }; }
  function move(e: any) {
    if (!drag.current || !img) return;
    const p = getPt(e);
    setPos(clamp({ x: drag.current.px + (p.x - drag.current.sx), y: drag.current.py + (p.y - drag.current.sy) }, scaleRef.current, img));
  }
  const up = () => { drag.current = null; };
  function zoom(v: number) {
    if (!img) return;
    const c = VIEW / 2, r = v / scaleRef.current;
    setScale(v); setPos(clamp({ x: c - (c - posRef.current.x) * r, y: c - (c - posRef.current.y) * r }, v, img));
  }
  function done() {
    if (!img) return;
    setBusy(true);
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    const k = size / VIEW;
    ctx.drawImage(img, pos.x * k, pos.y * k, img.width * scale * k, img.height * scale * k);
    cv.toBlob((b) => { if (b) onDone(b); else { setBusy(false); onCancel(); } }, 'image/jpeg', 0.9);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-5 w-full max-w-xs">
        <h3 className="font-extrabold text-[#0A2540] mb-3 text-center">{title}</h3>
        <div className="relative mx-auto overflow-hidden bg-slate-900 select-none touch-none cursor-grab active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW, borderRadius: round ? '50%' : 12 }}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          onTouchStart={down} onTouchMove={move} onTouchEnd={up}>
          {img && <img src={img.src} alt="" draggable={false} style={{ position: 'absolute', left: pos.x, top: pos.y, width: img.width * scale, height: img.height * scale, maxWidth: 'none' }} />}
          <div className="absolute inset-0 pointer-events-none ring-2 ring-white/70" style={{ borderRadius: round ? '50%' : 12 }} />
        </div>
        <input type="range" min={minScale} max={minScale * 4} step="0.001" value={scale} onChange={(e) => zoom(Number(e.target.value))} className="w-full mt-3 accent-[#0A2540]" />
        <p className="text-[11px] text-slate-400 text-center">Kéo để di chuyển · trượt để phóng to</p>
        <div className="flex gap-2 mt-3">
          <button disabled={busy} onClick={done} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl">{busy ? 'Đang xử lý…' : 'Dùng ảnh này'}</button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-600">Huỷ</button>
        </div>
      </div>
    </div>
  );
}
