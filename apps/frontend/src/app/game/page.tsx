'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getLeaderboard, submitScore, type LbRow } from '@/lib/game';
import { useAuth } from '@/lib/auth';

export default function GamePage() {
  const { user } = useAuth();
  const prefillRef = useRef(false);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const resetRef = useRef<() => void>(() => {});
  const overRef = useRef<(s: number) => void>(() => {});
  const [over, setOver] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const [lb, setLb] = useState<LbRow[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ rank: number | null; score: number } | null>(null);
  overRef.current = (s: number) => setOver(s);

  useEffect(() => {
    getLeaderboard().then(setLb).catch(() => {});
    try {
      setBest(parseInt(localStorage.getItem('flappy_best') || '0', 10) || 0);
      setName(localStorage.getItem('flappy_name') || '');
      setPhone(localStorage.getItem('flappy_phone') || '');
    } catch { /* ignore */ }
  }, []);

  // Đã đăng nhập → tự điền sẵn tên + SĐT từ tài khoản (ưu tiên hơn dữ liệu đã lưu).
  useEffect(() => {
    if (!user || prefillRef.current) return;
    prefillRef.current = true;
    if (user.fullName) setName(user.fullName);
    if (user.phone) setPhone(user.phone);
  }, [user]);

  // ── Game canvas (Flappy Bird thương hiệu Cam Lâm Land) ──
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 340, H = 400, raf = 0, last = 0;
    let bird: any, pipes: any[] = [], score = 0, state = 'ready', gap = 0, pw = 0, sp = 0, speed = 0, gravity = 0, flapV = 0, pipeCount = 0;
    let bestLocal = 0; try { bestLocal = parseInt(localStorage.getItem('flappy_best') || '0', 10) || 0; } catch { /* */ }

    // Âm thanh game (Web Audio)
    let actx: any = null, muted = false; try { muted = localStorage.getItem('flappy_muted') === '1'; } catch { /* */ }
    const ensureAudio = () => { if (!actx) { try { actx = new ((window as any).AudioContext || (window as any).webkitAudioContext)(); } catch { /* */ } } if (actx && actx.state === 'suspended') actx.resume(); };
    const tone = (f: number, d: number, dur: number, type: string, vol: number) => { if (!actx || muted || !f) return; const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; const t0 = actx.currentTime + d; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.03); };
    const sweep = (f1: number, f2: number, d: number, dur: number, type: string, vol: number) => { if (!actx || muted || !f1) return; const o = actx.createOscillator(), g = actx.createGain(); o.type = type; const t0 = actx.currentTime + d; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.03); };
    const sfxFlap = () => sweep(300, 540, 0, 0.09, 'sine', 0.055);
    const sfxScore = () => { tone(1175, 0, 0.09, 'sine', 0.06); tone(1568, 0.07, 0.13, 'sine', 0.05); };
    const sfxHit = () => { sweep(340, 70, 0, 0.26, 'triangle', 0.11); tone(80, 0.03, 0.34, 'sine', 0.09); };

    function fit() { const w = cv!.clientWidth || 340; const h = Math.min(Math.round(w * 1.05), Math.round((window.innerHeight || 640) * 0.5)); cv!.style.height = h + 'px'; cv!.width = Math.round(w * DPR); cv!.height = Math.round(h * DPR); ctx!.setTransform(DPR, 0, 0, DPR, 0, 0); W = w; H = h; }
    function reset() { gap = H * 0.30; pw = Math.max(44, W * 0.145); sp = Math.max(150, W * 0.62); speed = Math.max(1.7, W * 0.0075); gravity = H * 0.0011; flapV = -H * 0.0165; bird = { x: W * 0.30, y: H * 0.44, vy: 0, r: Math.max(9, H * 0.026), rot: 0 }; pipes = []; score = 0; state = 'ready'; pipeCount = 0; }
    function addPipe(x: number) { const m = H * 0.13; const gy = m + Math.random() * (H - gap - 2 * m); pipeCount++; pipes.push({ x, gy, passed: false, ad: pipeCount % 10 === 0 }); }
    function start() { state = 'play'; pipes = []; addPipe(W + 30); addPipe(W + 30 + sp); }
    function flap() { ensureAudio(); if (state === 'ready') { start(); bird.vy = flapV; sfxFlap(); } else if (state === 'play') { bird.vy = flapV; sfxFlap(); } else { /* over: chờ nút React */ } }
    function gameOver() { if (state === 'over') return; state = 'over'; sfxHit(); if (score > bestLocal) { bestLocal = score; try { localStorage.setItem('flappy_best', String(bestLocal)); } catch { /* */ } setBest(bestLocal); } overRef.current(score); }
    function rrp(x: number, y: number, w: number, h: number, r: number) { if (h < 0) return; r = Math.min(r, w / 2, h / 2); ctx!.beginPath(); ctx!.moveTo(x + r, y); ctx!.arcTo(x + w, y, x + w, y + h, r); ctx!.arcTo(x + w, y + h, x, y + h, r); ctx!.arcTo(x, y + h, x, y, r); ctx!.arcTo(x, y, x + w, y, r); ctx!.closePath(); }
    function rr(x: number, y: number, w: number, h: number, r: number) { rrp(x, y, w, h, r); ctx!.fill(); }
    function pipeText(px: number, cy: number, len: number) {
      if (len < 40) return;
      ctx!.save(); ctx!.translate(px + pw / 2, cy); ctx!.rotate(-Math.PI / 2);
      ctx!.font = '800 ' + Math.round(pw * 0.46) + 'px -apple-system,"Segoe UI",Roboto,sans-serif';
      const avail = len - 14;
      if (ctx!.measureText('Cam Lâm Land').width > avail) { const fs = Math.max(7, Math.floor(pw * 0.46 * avail / ctx!.measureText('Cam Lâm Land').width)); ctx!.font = '800 ' + fs + 'px -apple-system,"Segoe UI",Roboto,sans-serif'; }
      const tot = ctx!.measureText('Cam Lâm Land').width, camW = ctx!.measureText('Cam Lâm ').width;
      ctx!.textAlign = 'left'; ctx!.textBaseline = 'middle';
      ctx!.fillStyle = '#ffffff'; ctx!.fillText('Cam Lâm ', -tot / 2, 0);
      ctx!.fillStyle = '#C8A14B'; ctx!.fillText('Land', -tot / 2 + camW, 0);
      ctx!.restore();
    }
    function drawPipeAd(p: any) { pipeText(p.x, p.gy / 2, p.gy); const bt = p.gy + gap; pipeText(p.x, bt + (H - bt) / 2, H - bt); }
    function update(dt: number) {
      if (state === 'play') {
        bird.vy += gravity * dt; bird.y += bird.vy * dt; bird.rot = Math.max(-0.5, Math.min(1.1, bird.vy * 0.06));
        for (let i = 0; i < pipes.length; i++) pipes[i].x -= speed * dt;
        if (pipes.length && pipes[pipes.length - 1].x < W - sp) addPipe(pipes[pipes.length - 1].x + sp);
        if (pipes.length && pipes[0].x < -pw - 6) pipes.shift();
        for (let j = 0; j < pipes.length; j++) { const p = pipes[j];
          if (!p.passed && p.x + pw < bird.x) { p.passed = true; score++; sfxScore(); }
          if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + pw) { if (bird.y - bird.r < p.gy || bird.y + bird.r > p.gy + gap) gameOver(); }
        }
        if (bird.y + bird.r > H) { bird.y = H - bird.r; gameOver(); }
        if (bird.y - bird.r < 0) { bird.y = bird.r; bird.vy = 0; }
      } else if (state === 'ready') { bird.y = H * 0.44 + Math.sin(Date.now() / 320) * (H * 0.012); }
    }
    function draw() {
      const g = ctx!.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#c7e7fb'); g.addColorStop(1, '#eef8ff'); ctx!.fillStyle = g; ctx!.fillRect(0, 0, W, H);
      for (let i = 0; i < pipes.length; i++) { const p = pipes[i];
        ctx!.fillStyle = '#12324f'; rr(p.x, -4, pw, p.gy + 4, 9); rr(p.x, p.gy + gap, pw, H - (p.gy + gap) + 4, 9);
        ctx!.fillStyle = '#C8A14B'; rr(p.x - 3, p.gy - 13, pw + 6, 13, 5); rr(p.x - 3, p.gy + gap, pw + 6, 13, 5);
        if (p.ad) drawPipeAd(p);
      }
      ctx!.save(); ctx!.translate(bird.x, bird.y); ctx!.rotate(bird.rot);
      const bg = ctx!.createRadialGradient(-bird.r * 0.3, -bird.r * 0.3, bird.r * 0.2, 0, 0, bird.r); bg.addColorStop(0, '#ffe0a0'); bg.addColorStop(1, '#C8A14B');
      ctx!.fillStyle = bg; ctx!.beginPath(); ctx!.arc(0, 0, bird.r, 0, 6.2832); ctx!.fill();
      ctx!.fillStyle = '#e8823a'; ctx!.beginPath(); ctx!.moveTo(bird.r * 0.65, -bird.r * 0.05); ctx!.lineTo(bird.r * 1.28, -bird.r * 0.18); ctx!.lineTo(bird.r * 1.28, bird.r * 0.2); ctx!.closePath(); ctx!.fill();
      ctx!.fillStyle = '#fff'; ctx!.beginPath(); ctx!.arc(bird.r * 0.32, -bird.r * 0.28, bird.r * 0.28, 0, 6.2832); ctx!.fill();
      ctx!.fillStyle = '#12324f'; ctx!.beginPath(); ctx!.arc(bird.r * 0.40, -bird.r * 0.28, bird.r * 0.14, 0, 6.2832); ctx!.fill();
      ctx!.restore();
      ctx!.fillStyle = '#0B4045'; ctx!.font = '800 ' + Math.round(H * 0.09) + 'px -apple-system,"Segoe UI",Roboto,sans-serif'; ctx!.textAlign = 'center'; ctx!.textBaseline = 'top';
      ctx!.fillText(String(score), W / 2, H * 0.06);
      if (state === 'ready') { ctx!.fillStyle = 'rgba(8,16,28,0.05)'; ctx!.fillRect(0, 0, W, H); ctx!.fillStyle = '#0B4045'; ctx!.font = '600 13px -apple-system,"Segoe UI",Roboto,sans-serif'; ctx!.fillText('Chạm vào khung để bắt đầu', W / 2, H * 0.62); }
    }
    function loop(now: number) { const dt = last ? Math.min((now - last) / 16.667, 2.4) : 1; last = now; update(dt); draw(); raf = requestAnimationFrame(loop); }

    // Chạm TRONG khung: bắt đầu ván mới (hoặc vỗ cánh). stopPropagation để không vỗ 2 lần.
    const onCanvas = (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); flap(); };
    // Đang chơi: chạm BẤT KỲ đâu trên màn hình cũng vỗ cánh. Lúc chờ/kết thúc thì bỏ qua.
    const onAnywhere = () => { if (state === 'play') flap(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } };
    let rt: any; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { fit(); if (state !== 'play') reset(); }, 150); };
    cv.addEventListener('pointerdown', onCanvas, { passive: false });
    window.addEventListener('pointerdown', onAnywhere);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    resetRef.current = () => { reset(); };
    fit(); reset(); raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('pointerdown', onCanvas); window.removeEventListener('pointerdown', onAnywhere); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, []);

  async function submit() {
    if (!name.trim() || !phone.trim()) { alert('Nhập họ tên và số điện thoại để ghi tên lên bảng nhé!'); return; }
    setBusy(true);
    try {
      const r = await submitScore(name.trim(), phone.trim(), over || 0);
      setSent({ rank: r.rank, score: over || 0 });
      getLeaderboard().then(setLb).catch(() => {});
      try { localStorage.setItem('flappy_name', name.trim()); localStorage.setItem('flappy_phone', phone.trim()); } catch { /* */ }
    } catch (e: any) { alert('Lỗi: ' + (e?.message || e)); }
    finally { setBusy(false); }
  }
  function playAgain() { setOver(null); setSent(null); resetRef.current(); }

  return (
    <div className="bg-slate-50 min-h-[calc(100dvh-56px)]">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-5">
        <div className="rounded-2xl bg-[#0B4045] text-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[#C8A14B] font-extrabold text-sm">🏆 THI TUẦN · BAY CÙNG CAM LÂM LAND</div>
          <h1 className="text-xl sm:text-2xl font-extrabold mt-1">Game giải trí</h1>
          {/* ĐÃ BỎ phần thưởng/quà tuần theo yêu cầu chủ dự án — đây chỉ là game giải
              trí cho vui, KHÔNG phải chương trình trúng thưởng. Đừng thêm lại:
              hứa quà trên web là phát sinh nghĩa vụ phải trao thật. */}
          <p className="text-slate-200 text-sm mt-1">Chơi cho vui lúc chờ. Ghi tên lên bảng xếp hạng nếu muốn so điểm với mọi người.</p>
        </div>

        <div className="mt-4 grid lg:grid-cols-5 gap-4 items-start">
          <div className="lg:col-span-3">
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-2.5">
              <div className="flex items-center justify-between px-1 pb-2 text-xs font-semibold text-slate-500">
                <span>Flappy Bird</span><span>Kỷ lục của bạn: <b className="text-[#C8A14B]">{best}</b></span>
              </div>
              <div className="relative">
                <canvas ref={cvRef} className="w-full block rounded-xl bg-[#dceffb] touch-none cursor-pointer" style={{ touchAction: 'none' }} />
                {over !== null && (
                  <div className="absolute inset-0 rounded-xl bg-[#060c16]/72 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-white">
                    {!sent ? (
                      <>
                        <div className="text-lg font-extrabold">Kết thúc!</div>
                        <div className="text-sm text-slate-200">Bạn được <b className="text-[#C8A14B] text-base">{over}</b> điểm</div>
                        <div className="w-full max-w-[280px] mt-3 space-y-2">
                          <p className="text-[12px] text-slate-300 text-center">{user ? <>Xác nhận thông tin tài khoản để <b>ghi tên lên bảng xếp hạng</b>:</> : <>Nhập tên để <b>ghi tên lên bảng xếp hạng</b>:</>}</p>
                          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Họ tên *" className="w-full rounded-lg px-3 py-2 text-sm text-[#0B4045] outline-none" />
                          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại *" inputMode="tel" className="w-full rounded-lg px-3 py-2 text-sm text-[#0B4045] outline-none" />
                          <button onClick={submit} disabled={busy} className="w-full bg-[#C8A14B] hover:brightness-105 disabled:opacity-60 text-[#0B4045] font-extrabold py-2.5 rounded-lg text-sm">{busy ? 'Đang gửi…' : '🏆 Ghi tên lên bảng'}</button>
                          <button onClick={playAgain} className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-2 rounded-lg text-sm">↻ Chơi lại</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl">🎉</div>
                        <div className="text-lg font-extrabold mt-1">Đã ghi tên!</div>
                        <div className="text-sm text-slate-200 text-center mt-1">Bạn <b className="text-[#C8A14B]">{sent.score}</b> điểm{sent.rank ? <> · đang hạng <b className="text-[#C8A14B]">#{sent.rank}</b></> : null}.</div>
                        <div className="text-[12px] text-slate-300 text-center mt-1">Cố thêm điểm để leo hạng nhé!</div>
                        <button onClick={playAgain} className="mt-3 bg-[#C8A14B] text-[#0B4045] font-extrabold py-2.5 px-6 rounded-lg text-sm">↻ Chơi lại, phá kỷ lục</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] text-slate-400 mt-2">Chạm vào khung để vào ván · khi chơi, chạm màn hình bất kỳ (hoặc phím cách) để bay.</p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-extrabold text-[#0B4045]">🏆 Bảng xếp hạng</h2>
                <button onClick={() => getLeaderboard().then(setLb).catch(() => {})} className="text-[11px] font-bold text-[#C8A14B]">Làm mới</button>
              </div>
              {lb.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">Chưa có ai ghi điểm.<br />Chơi và ghi tên để dẫn đầu!</p>
              ) : (
                <div className="space-y-1.5">
                  {lb.map((r) => (
                    <div key={r.rank} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${r.rank <= 3 ? 'bg-[#C8A14B]/12 border border-[#C8A14B]/30' : 'bg-slate-50'}`}>
                      <span className={`w-6 text-center font-extrabold ${r.rank <= 3 ? 'text-[#C8A14B]' : 'text-slate-400'}`}>{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
                      <span className="flex-1 min-w-0 truncate font-semibold text-[#0B4045] text-sm">{r.name} <span className="text-slate-400 font-normal">· {r.phone}</span></span>
                      <span className="font-extrabold text-[#0B4045] tabular-nums">{r.score}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Bảng KHÔNG reset theo tuần/tháng nữa — xếp hạng từ trước tới giờ. */}
              <p className="text-[11px] text-slate-400 mt-2.5 text-center">Xếp hạng tính từ trước tới giờ.</p>
            </div>
            <Link href="/listings" className="mt-3 block text-center bg-[#0B4045] hover:bg-[#0e5157] text-white font-bold py-2.5 rounded-xl text-sm">🏠 Xem nhà đất Cam Lâm</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
