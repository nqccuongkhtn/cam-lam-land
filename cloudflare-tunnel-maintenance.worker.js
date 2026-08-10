/**
 * Cloudflare Worker — Trang bảo trì + game cho Cam Lâm Land.
 *
 * MỤC ĐÍCH: khi origin (Cloudflare Tunnel / server) sập, Cloudflare mặc định trả
 * về trang "Error 1033". Worker này chạy ở tầng edge (trước origin) nên khi phát
 * hiện origin lỗi, nó trả về trang bảo trì + game NÀY cho MỌI khách — kể cả người
 * lần đầu vào (không phụ thuộc service worker). Nhạc YouTube cũng chạy vì trang
 * được phục vụ từ origin https thật (batdongsancamlam.dpdns.org), không phải file://.
 *
 * CÁCH TRIỂN KHAI (một lần):
 *  1) Cloudflare Dashboard → Workers & Pages → Create → Create Worker → đặt tên
 *     (vd: camlam-maintenance) → Deploy.
 *  2) Bấm "Edit code", xoá code mẫu, DÁN TOÀN BỘ file này vào → Deploy.
 *  3) Vào Worker → Settings → Domains & Routes → Add route:
 *        Route:  batdongsancamlam.dpdns.org/*
 *        Zone:   dpdns.org (hoặc zone chứa tên miền của bạn)
 *     (Nếu bạn quản lý DNS/ële qua zone khác, chọn đúng zone.)
 *  Xong. Khi web chạy bình thường Worker chỉ "đi ngang qua"; khi origin sập nó
 *  tự hiện trang bảo trì.
 *
 * Muốn CHỦ ĐỘNG bật bảo trì (bảo trì có kế hoạch) mà không cần sập server:
 *  đặt biến môi trường (Variables) MAINTENANCE = "on" cho Worker → luôn hiện trang này.
 */

// Các mã lỗi cho biết origin/tunnel không phục vụ được (bao gồm 1033 → 530).
const DOWN = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);

export default {
  async fetch(request, env) {
    // Bật bảo trì thủ công qua biến MAINTENANCE=on
    if (env && (env.MAINTENANCE === 'on' || env.MAINTENANCE === '1')) return maintenance();

    let resp;
    try {
      resp = await fetch(request);
    } catch (e) {
      return maintenance();
    }
    const accept = request.headers.get('Accept') || '';
    const isHtmlNav = request.method === 'GET' && accept.includes('text/html');
    if (isHtmlNav && DOWN.has(resp.status)) return maintenance();
    return resp;
  }
};

function maintenance() {
  return new Response(MAINT, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '120'
    }
  });
}

const MAINT = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
<meta name="theme-color" content="#000000" />
<title>Đang bảo trì · Cam Lâm Land</title>
<style>
  :root{ --gold:#C8A14B; --text:#f5f5f7; --muted:#9b9ba1; --card:rgba(255,255,255,.055); --line:rgba(255,255,255,.12); }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body{ margin:0; height:100%; }
  body{ background:#000; color:var(--text); overflow:hidden; position:relative; min-height:100dvh; padding:22px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,Inter,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
  body::before{ content:""; position:fixed; inset:0; pointer-events:none; background:radial-gradient(58% 46% at 50% 16%, rgba(200,161,75,.18), transparent 68%); }
  .wrap{ width:100%; max-width:430px; z-index:1; display:flex; flex-direction:column; align-items:center; }
  .brand{ display:flex; align-items:center; gap:9px; margin-bottom:24px; }
  .brand svg{ width:25px; height:25px; display:block; }
  .brand b{ font-size:15px; font-weight:600; letter-spacing:.2px; }
  .brand b i{ color:var(--gold); font-style:normal; }
  .dot{ width:6px; height:6px; border-radius:50%; background:var(--gold); box-shadow:0 0 0 0 rgba(200,161,75,.6); animation:pulse 2s infinite; margin-left:2px; }
  @keyframes pulse{ 0%{box-shadow:0 0 0 0 rgba(200,161,75,.55)} 70%{box-shadow:0 0 0 8px rgba(200,161,75,0)} 100%{box-shadow:0 0 0 0 rgba(200,161,75,0)} }
  h1{ font-size:31px; line-height:1.08; font-weight:600; letter-spacing:-.022em; margin:0 0 10px; text-align:center; }
  .sub{ color:var(--muted); font-size:15px; line-height:1.5; text-align:center; margin:0 0 22px; max-width:340px; }
  .card{ width:100%; background:var(--card); border:1px solid var(--line); border-radius:26px; padding:13px 13px 15px; backdrop-filter:blur(28px) saturate(150%); -webkit-backdrop-filter:blur(28px) saturate(150%); box-shadow:0 30px 70px -22px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.06); }
  .ghead{ display:flex; align-items:center; justify-content:space-between; padding:2px 6px 10px; }
  .ghead .t{ font-size:12.5px; font-weight:600; color:var(--muted); letter-spacing:.2px; }
  .ghead .s{ font-size:12.5px; font-weight:600; color:var(--text); }
  .ghead .s b{ color:var(--gold); font-variant-numeric:tabular-nums; }
  .mute{ appearance:none; border:0; background:transparent; cursor:pointer; font-size:14px; margin-left:9px; padding:2px 5px; border-radius:8px; line-height:1; vertical-align:-1px; }
  .mute:hover{ background:rgba(255,255,255,.12); }
  canvas{ width:100%; display:block; border-radius:17px; background:#dceffb; touch-action:none; cursor:pointer; }
  .hint{ text-align:center; color:var(--muted); font-size:12px; margin-top:11px; transition:opacity .3s; }
  .foot{ margin-top:20px; display:flex; gap:10px; }
  .btn{ appearance:none; border:0; cursor:pointer; font-family:inherit; font-weight:600; font-size:15px; padding:11px 22px; border-radius:980px; transition:transform .14s ease, opacity .2s; }
  .btn:active{ transform:scale(.955); }
  .btn-p{ background:#fff; color:#000; }
  .btn-s{ background:rgba(255,255,255,.09); color:#fff; border:1px solid var(--line); }
  #yt{ position:fixed; left:-9999px; top:0; width:240px; height:135px; border:0; }
  @media (max-height:700px){ .sub{ display:none } h1{ font-size:25px; margin-bottom:14px } .brand{ margin-bottom:16px } .foot{ margin-top:15px } }
  @media (max-width:380px){ h1{ font-size:27px } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.6a6.6 6.6 0 0 0-6.6 6.6c0 4.72 5.86 10.82 6.11 11.07a.68.68 0 0 0 .98 0c.25-.25 6.11-6.35 6.11-11.07A6.6 6.6 0 0 0 12 2.6Z" fill="#C8A14B"/><circle cx="12" cy="9.2" r="2.35" fill="#000"/></svg>
      <b>Cam Lâm <i>Land</i></b><span class="dot"></span>
    </div>
    <h1>Đang bảo trì</h1>
    <p class="sub">Hệ thống đang được nâng cấp để phục vụ bạn tốt hơn. Vui lòng quay lại sau ít phút — trong lúc chờ, nghe nhạc và chơi một ván nhé.</p>
    <div class="card">
      <div class="ghead">
        <span class="t">Flappy Bird</span>
        <span class="s">Điểm <b id="score">0</b> &nbsp;·&nbsp; Kỷ lục <b id="best">0</b><button id="mute" class="mute" title="Bật/tắt nhạc" aria-label="Bật/tắt nhạc">🔊</button></span>
      </div>
      <canvas id="c"></canvas>
      <p class="hint" id="hint">Chạm màn hình / phím cách để bay lên</p>
    </div>
    <div class="foot">
      <button class="btn btn-p" onclick="location.reload()">Thử lại</button>
      <button class="btn btn-s" onclick="location.href='/'">Trang chủ</button>
    </div>
  </div>
  <div id="yt" aria-hidden="true"></div>

  <script>
  (function(){
    var cv = document.getElementById('c'), ctx = cv.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var elScore = document.getElementById('score'), elBest = document.getElementById('best'), elHint = document.getElementById('hint');
    var W = 340, H = 400;
    var best = 0; try { best = parseInt(localStorage.getItem('flappy_best') || '0', 10) || 0; } catch(e){}
    elBest.textContent = best;

    var yt = null, ytReady = false, gestured = false, muted = false;
    try { muted = localStorage.getItem('flappy_muted') === '1'; } catch(e){}
    var elMute = document.getElementById('mute'); function paintMute(){ if (elMute) elMute.textContent = muted ? '🔇' : '🔊'; } paintMute();
    var VIDEO = 'h1fbnIc_dwg';
    window.onYouTubeIframeAPIReady = function(){
      try {
        yt = new YT.Player('yt', {
          videoId: VIDEO,
          playerVars: { autoplay: 1, mute: 1, controls: 0, loop: 1, playlist: VIDEO, playsinline: 1, modestbranding: 1, rel: 0, fs: 0 },
          events: {
            onReady: function(){ ytReady = true; try { yt.setVolume(65); yt.playVideo(); if (gestured && !muted) yt.unMute(); } catch(e){} },
            onStateChange: function(ev){ if (ev.data === 0){ try { yt.seekTo(0); yt.playVideo(); } catch(e){} } }
          }
        });
      } catch(e){}
    };
    function musicGesture(){ gestured = true; if (ytReady && !muted){ try { yt.unMute(); yt.playVideo(); } catch(e){} } }
    if (elMute) elMute.addEventListener('click', function(e){ e.stopPropagation(); muted = !muted; try { localStorage.setItem('flappy_muted', muted ? '1' : '0'); } catch(x){} paintMute(); if (ytReady){ try { if (muted) yt.mute(); else { yt.unMute(); yt.playVideo(); } } catch(z){} } });
    document.addEventListener('pointerdown', musicGesture);

    var bird, pipes, score, state, gap, pw, sp, speed, gravity, flapV, last = 0;
    function fit(){ var w = cv.clientWidth || (cv.parentElement ? cv.parentElement.clientWidth - 26 : 340); var h = Math.min(Math.round(w * 1.16), Math.round((window.innerHeight || 640) * 0.47)); cv.style.height = h + 'px'; cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); W = w; H = h; }
    function reset(){ gap = H * 0.30; pw = Math.max(44, W * 0.145); sp = Math.max(150, W * 0.62); speed = Math.max(1.7, W * 0.0075); gravity = H * 0.0011; flapV = -H * 0.0165; bird = { x: W * 0.30, y: H * 0.44, vy: 0, r: Math.max(9, H * 0.026), rot: 0 }; pipes = []; score = 0; state = 'ready'; elScore.textContent = '0'; elHint.style.opacity = 1; elHint.textContent = 'Chạm màn hình / phím cách để bay lên'; }
    function addPipe(x){ var m = H * 0.13; var gy = m + Math.random() * (H - gap - 2 * m); pipes.push({ x: x, gy: gy, passed: false }); }
    function start(){ state = 'play'; pipes = []; addPipe(W + 30); addPipe(W + 30 + sp); elHint.style.opacity = 0; musicGesture(); }
    function flap(){ if (state === 'ready'){ start(); bird.vy = flapV; } else if (state === 'play'){ bird.vy = flapV; } else { reset(); } }
    function gameOver(){ state = 'over'; if (score > best){ best = score; try { localStorage.setItem('flappy_best', String(best)); } catch(e){} elBest.textContent = best; } elHint.style.opacity = 1; elHint.textContent = 'Kết thúc · chạm để chơi lại'; }
    function rr(x, y, w, h, r){ if (h < 0) return; r = Math.min(r, w/2, h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); ctx.fill(); }
    function update(dt){
      if (state === 'play'){
        bird.vy += gravity * dt; bird.y += bird.vy * dt; bird.rot = Math.max(-0.5, Math.min(1.1, bird.vy * 0.06));
        for (var i = 0; i < pipes.length; i++) pipes[i].x -= speed * dt;
        if (pipes.length && pipes[pipes.length-1].x < W - sp) addPipe(pipes[pipes.length-1].x + sp);
        if (pipes.length && pipes[0].x < -pw - 6) pipes.shift();
        for (var j = 0; j < pipes.length; j++){ var p = pipes[j];
          if (!p.passed && p.x + pw < bird.x){ p.passed = true; score++; elScore.textContent = score; }
          if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + pw){ if (bird.y - bird.r < p.gy || bird.y + bird.r > p.gy + gap) gameOver(); }
        }
        if (bird.y + bird.r > H){ bird.y = H - bird.r; gameOver(); }
        if (bird.y - bird.r < 0){ bird.y = bird.r; bird.vy = 0; }
      } else if (state === 'ready'){ bird.y = H * 0.44 + Math.sin(Date.now() / 320) * (H * 0.012); }
    }
    function draw(){
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#c7e7fb'); g.addColorStop(1, '#eef8ff'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < pipes.length; i++){ var p = pipes[i];
        ctx.fillStyle = '#12324f'; rr(p.x, -4, pw, p.gy + 4, 9); rr(p.x, p.gy + gap, pw, H - (p.gy + gap) + 4, 9);
        ctx.fillStyle = '#C8A14B'; rr(p.x - 3, p.gy - 13, pw + 6, 13, 5); rr(p.x - 3, p.gy + gap, pw + 6, 13, 5);
      }
      ctx.save(); ctx.translate(bird.x, bird.y); ctx.rotate(bird.rot);
      var bg = ctx.createRadialGradient(-bird.r*0.3, -bird.r*0.3, bird.r*0.2, 0, 0, bird.r); bg.addColorStop(0, '#ffe0a0'); bg.addColorStop(1, '#C8A14B');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#e8823a'; ctx.beginPath(); ctx.moveTo(bird.r*0.65, -bird.r*0.05); ctx.lineTo(bird.r*1.28, -bird.r*0.18); ctx.lineTo(bird.r*1.28, bird.r*0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bird.r*0.32, -bird.r*0.28, bird.r*0.28, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#12324f'; ctx.beginPath(); ctx.arc(bird.r*0.40, -bird.r*0.28, bird.r*0.14, 0, 6.2832); ctx.fill();
      ctx.restore();
      if (state !== 'play'){ ctx.fillStyle = 'rgba(8,16,28,' + (state === 'over' ? '0.30' : '0.06') + ')'; ctx.fillRect(0, 0, W, H); }
    }
    function loop(now){ var dt = last ? Math.min((now - last) / 16.667, 2.4) : 1; last = now; update(dt); draw(); requestAnimationFrame(loop); }
    cv.addEventListener('pointerdown', function(e){ e.preventDefault(); flap(); });
    window.addEventListener('keydown', function(e){ if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp'){ e.preventDefault(); flap(); } });
    var rt; window.addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ fit(); if (state !== 'play') reset(); }, 150); });
    fit(); reset(); requestAnimationFrame(loop);
  })();
  </script>
  <script src="https://www.youtube.com/iframe_api"></script>
</body>
</html>`;
