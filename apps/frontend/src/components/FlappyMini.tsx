'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { submitScore } from '@/lib/game';

// Bản mini nhúng trong ô chat cộng đồng — chạm để bay, ghi điểm chung bảng xếp hạng (tính từ trước tới giờ).
// ⚠️ ĐÂY LÀ GAME GIẢI TRÍ, KHÔNG có quà/thưởng. Chủ dự án đã bỏ phần trúng thưởng —
//    đừng thêm lại, hứa quà trên web là phát sinh nghĩa vụ phải trao thật.
export default function FlappyMini({ maxH = 180 }: { maxH?: number }) {
  const { user } = useAuth();
  const prefillRef = useRef(false);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const resetRef = useRef<() => void>(() => {});
  const overRef = useRef<(s: number) => void>(() => {});
  const [over, setOver] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ rank: number | null; score: number } | null>(null);
  overRef.current = (s: number) => setOver(s);

  useEffect(() => {
    try {
      setBest(parseInt(localStorage.getItem('flappy_best') || '0', 10) || 0);
      setName(localStorage.getItem('flappy_name') || '');
      setPhone(localStorage.getItem('flappy_phone') || '');
    } catch { /* */ }
  }, []);
  useEffect(() => {
    if (!user || prefillRef.current) return;
    prefillRef.current = true;
    if (user.fullName) setName(user.fullName);
    if (user.phone) setPhone(user.phone);
  }, [user]);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 300, H = 180, raf = 0, last = 0;
    let bird: any, pipes: any[] = [], score = 0, state = 'ready', gap = 0, pw = 0, sp = 0, speed = 0, gravity = 0, flapV = 0, pipeCount = 0;
    let bestLocal = 0; try { bestLocal = parseInt(localStorage.getItem('flappy_best') || '0', 10) || 0; } catch { /* */ }

    let actx: any = null, muted = false; try { muted = localStorage.getItem('flappy_muted') === '1'; } catch { /* */ }
    const ensureAudio = () => { if (!actx) { try { actx = new ((window as any).AudioContext || (window as any).webkitAudioContext)(); } catch { /* */ } } if (actx && actx.state === 'suspended') actx.resume(); };
    const tone = (f: number, d: number, dur: number, type: string, vol: number) => { if (!actx || muted || !f) return; const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; const t0 = actx.currentTime + d; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.03); };
    const sweep = (f1: number, f2: number, d: number, dur: number, type: string, vol: number) => { if (!actx || muted || !f1) return; const o = actx.createOscillator(), g = actx.createGain(); o.type = type; const t0 = actx.currentTime + d; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.03); };
    const sfxFlap = () => sweep(300, 540, 0, 0.09, 'sine', 0.05);
    const sfxScore = () => { tone(1175, 0, 0.09, 'sine', 0.055); tone(1568, 0.07, 0.13, 'sine', 0.045); };
    const sfxHit = () => { sweep(340, 70, 0, 0.26, 'triangle', 0.1); tone(80, 0.03, 0.34, 'sine', 0.08); };

    function fit() { const w = cv!.clientWidth || 300; const h = Math.min(Math.round(w * 0.62), maxH); cv!.style.height = h + 'px'; cv!.width = Math.round(w * DPR); cv!.height = Math.round(h * DPR); ctx!.setTransform(DPR, 0, 0, DPR, 0, 0); W = w; H = h; }
    function reset() { gap = H * 0.34; pw = Math.max(34, W * 0.13); sp = Math.max(120, W * 0.56); speed = Math.max(1.5, W * 0.007); gravity = H * 0.0016; flapV = -H * 0.024; bird = { x: W * 0.28, y: H * 0.44, vy: 0, r: Math.max(7, H * 0.05), rot: 0 }; pipes = []; score = 0; state = 'ready'; pipeCount = 0; }
    function addPipe(x: number) { const m = H * 0.12; const gy = m + Math.random() * (H - gap - 2 * m); pipeCount++; pipes.push({ x, gy, passed: false, ad: pipeCount % 10 === 0 }); }
    function start() { state = 'play'; pipes = []; addPipe(W + 24); addPipe(W + 24 + sp); }
    function flap() { ensureAudio(); if (state === 'ready') { start(); bird.vy = flapV; sfxFlap(); } else if (state === 'play') { bird.vy = flapV; sfxFlap(); } }
    function gameOver() { if (state === 'over') return; state = 'over'; sfxHit(); if (score > bestLocal) { bestLocal = score; try { localStorage.setItem('flappy_best', String(bestLocal)); } catch { /* */ } setBest(bestLocal); } overRef.current(score); }
    function rrp(x: number, y: number, w: number, h: number, r: number) { if (h < 0) return; r = Math.min(r, w / 2, h / 2); ctx!.beginPath(); ctx!.moveTo(x + r, y); ctx!.arcTo(x + w, y, x + w, y + h, r); ctx!.arcTo(x + w, y + h, x, y + h, r); ctx!.arcTo(x, y + h, x, y, r); ctx!.arcTo(x, y, x + w, y, r); ctx!.closePath(); }
    function rr(x: number, y: number, w: number, h: number, r: number) { rrp(x, y, w, h, r); ctx!.fill(); }
    function pipeText(px: number, cy: number, len: number) {
      if (len < 34) return;
      ctx!.save(); ctx!.translate(px + pw / 2, cy); ctx!.rotate(-Math.PI / 2);
      ctx!.font = '800 ' + Math.round(pw * 0.5) + 'px -apple-system,"Segoe UI",Roboto,sans-serif';
      const avail = len - 10;
      if (ctx!.measureText('Cam Lâm Land').width > avail) { const fs = Math.max(6, Math.floor(pw * 0.5 * avail / ctx!.measureText('Cam Lâm Land').width)); ctx!.font = '800 ' + fs + 'px -apple-system,"Segoe UI",Roboto,sans-serif'; }
      const tot = ctx!.measureText('Cam Lâm Land').width, camW = ctx!.measureText('Cam Lâm ').width;
      ctx!.textAlign = 'left'; ctx!.textBaseline = 'middle';
      ctx!.fillStyle = '#ffffff'; ctx!.fillText('Cam Lâm ', -tot / 2, 0);
      ctx!.fillStyle = '#C8A14B'; ctx!.fillText('Land', -tot / 2 + camW, 0);
      ctx!.restore();
    }
    function drawPipeAd(p: any) { pipeText(p.x, p.gy / 2, p.gy); const bt = p.gy + gap; pipeText(p.x, bt + (H - bt) / 2, H - bt); }
    function update(dt: number) {
      if (state === 'play') {
        bird.vy += gravity * dt; bird.y += bird.vy * dt; bird.rot = Math.max(-0.5, Math.min(1.1, bird.vy * 0.05));
        for (let i = 0; i < pipes.length; i++) pipes[i].x -= speed * dt;
        if (pipes.length && pipes[pipes.length - 1].x < W - sp) addPipe(pipes[pipes.length - 1].x + sp);
        if (pipes.length && pipes[0].x < -pw - 6) pipes.shift();
        for (let j = 0; j < pipes.length; j++) { const p = pipes[j];
          if (!p.passed && p.x + pw < bird.x) { p.passed = true; score++; sfxScore(); }
          if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + pw) { if (bird.y - bird.r < p.gy || bird.y + bird.r > p.gy + gap) gameOver(); }
        }
        if (bird.y + bird.r > H) { bird.y = H - bird.r; gameOver(); }
        if (bird.y - bird.r < 0) { bird.y = bird.r; bird.vy = 0; }
      } else if (state === 'ready') { bird.y = H * 0.44 + Math.sin(Date.now() / 320) * (H * 0.014); }
    }
    function draw() {
      const g = ctx!.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#c7e7fb'); g.addColorStop(1, '#eef8ff'); ctx!.fillStyle = g; ctx!.fillRect(0, 0, W, H);
      for (let i = 0; i < pipes.length; i++) { const p = pipes[i];
        ctx!.fillStyle = '#12324f'; rr(p.x, -4, pw, p.gy + 4, 7); rr(p.x, p.gy + gap, pw, H - (p.gy + gap) + 4, 7);
        ctx!.fillStyle = '#C8A14B'; rr(p.x - 2, p.gy - 10, pw + 4, 10, 4); rr(p.x - 2, p.gy + gap, pw + 4, 10, 4);
        if (p.ad) drawPipeAd(p);
      }
      ctx!.save(); ctx!.translate(bird.x, bird.y); ctx!.rotate(bird.rot);
      const bg = ctx!.createRadialGradient(-bird.r * 0.3, -bird.r * 0.3, bird.r * 0.2, 0, 0, bird.r); bg.addColorStop(0, '#ffe0a0'); bg.addColorStop(1, '#C8A14B');
      ctx!.fillStyle = bg; ctx!.beginPath(); ctx!.arc(0, 0, bird.r, 0, 6.2832); ctx!.fill();
      ctx!.fillStyle = '#e8823a'; ctx!.beginPath(); ctx!.moveTo(bird.r * 0.65, -bird.r * 0.05); ctx!.lineTo(bird.r * 1.28, -bird.r * 0.18); ctx!.lineTo(bird.r * 1.28, bird.r * 0.2); ctx!.closePath(); ctx!.fill();
      ctx!.fillStyle = '#fff'; ctx!.beginPath(); ctx!.arc(bird.r * 0.32, -bird.r * 0.3, bird.r * 0.3, 0, 6.2832); ctx!.fill();
      ctx!.fillStyle = '#12324f'; ctx!.beginPath(); ctx!.arc(bird.r * 0.42, -bird.r * 0.3, bird.r * 0.15, 0, 6.2832); ctx!.fill();
      ctx!.restore();
      ctx!.fillStyle = '#0B4045'; ctx!.font = '800 ' + Math.round(H * 0.13) + 'px -apple-system,"Segoe UI",Roboto,sans-serif'; ctx!.textAlign = 'center'; ctx!.textBaseline = 'top';
      ctx!.fillText(String(score), W / 2, H * 0.07);
      if (state === 'ready') { ctx!.fillStyle = 'rgba(8,16,28,0.05)'; ctx!.fillRect(0, 0, W, H); ctx!.fillStyle = '#0B4045'; ctx!.font = '600 11px -apple-system,"Segoe UI",Roboto,sans-serif'; ctx!.fillText('Chạm vào đây để bắt đầu', W / 2, H * 0.6); }
    }
    function loop(now: number) { const dt = last ? Math.min((now - last) / 16.667, 2.4) : 1; last = now; update(dt); draw(); raf = requestAnimationFrame(loop); }

    // Chạm TRONG khung: bắt đầu ván mới (hoặc vỗ cánh). stopPropagation để không vỗ 2 lần.
    const onCanvas = (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); flap(); };
    // Đang chơi: chạm BẤT KỲ đâu trên màn hình cũng vỗ cánh. Lúc chờ/kết thúc thì bỏ qua.
    const onAnywhere = () => { if (state === 'play') flap(); };
    let rt: any; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { fit(); if (state !== 'play') reset(); }, 150); };
    cv.addEventListener('pointerdown', onCanvas, { passive: false });
    window.addEventListener('pointerdown', onAnywhere);
    window.addEventListener('resize', onResize);
    resetRef.current = () => { reset(); };
    fit(); reset(); raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('pointerdown', onCanvas); window.removeEventListener('pointerdown', onAnywhere); window.removeEventListener('resize', onResize); };
  }, [maxH]);

  async function submit() {
    if (!name.trim() || !phone.trim()) { alert('Nhập họ tên và số điện thoại nhé!'); return; }
    setBusy(true);
    try {
      const r = await submitScore(name.trim(), phone.trim(), over || 0);
      setSent({ rank: r.rank, score: over || 0 });
      try { localStorage.setItem('flappy_name', name.trim()); localStorage.setItem('flappy_phone', phone.trim()); } catch { /* */ }
    } catch (e: any) { alert('Lỗi: ' + (e?.message || e)); }
    finally { setBusy(false); }
  }
  function playAgain() { setOver(null); setSent(null); resetRef.current(); }

  return (
    <div>
      <div className="relative">
        <canvas ref={cvRef} className="w-full block rounded-lg bg-[#dceffb] cursor-pointer border border-slate-300" style={{ touchAction: 'none' }} />
        {over !== null && (
          <div className="absolute inset-0 rounded-lg bg-[#060c16]/74 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-white text-center">
            {!sent ? (
              <>
                <div className="text-[13px] font-extrabold">Kết thúc · <span className="text-[#C8A14B]">{over}</span> điểm</div>
                <div className="w-full max-w-[230px] mt-1.5 space-y-1.5">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Họ tên *" className="w-full rounded-md px-2.5 py-1.5 text-[12px] text-[#0B4045] outline-none" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại *" inputMode="tel" className="w-full rounded-md px-2.5 py-1.5 text-[12px] text-[#0B4045] outline-none" />
                  <button onClick={submit} disabled={busy} className="w-full bg-[#C8A14B] hover:brightness-105 disabled:opacity-60 text-[#0B4045] font-extrabold py-1.5 rounded-md text-[12px]">{busy ? 'Đang gửi…' : '🏆 Ghi tên lên bảng'}</button>
                  <button onClick={playAgain} className="w-full bg-white/15 hover:bg-white/25 text-white font-semibold py-1 rounded-md text-[11px]">↻ Chơi lại</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-extrabold">🎉 Đã ghi tên!</div>
                <div className="text-[11px] text-slate-200 mt-0.5">Bạn <b className="text-[#C8A14B]">{sent.score}</b> điểm{sent.rank ? <> · hạng <b className="text-[#C8A14B]">#{sent.rank}</b></> : null}.</div>
                <div className="text-[10px] text-slate-300 mt-0.5 px-2">Cố thêm điểm để leo hạng nhé!</div>
                <button onClick={playAgain} className="mt-2 bg-[#C8A14B] text-[#0B4045] font-extrabold py-1.5 px-4 rounded-md text-[12px]">↻ Chơi lại</button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-0.5 pt-1 text-[10px] text-slate-500">
        <span>Vào ván: chạm khung · rồi chạm đâu cũng bay · Kỷ lục: <b className="text-[#C8A14B]">{best}</b></span>
        <Link href="/game" className="font-bold text-[#0B4045] hover:underline">Bảng xếp hạng ↗</Link>
      </div>
    </div>
  );
}
