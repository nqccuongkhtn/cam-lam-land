const CACHE = 'camlam-v93';  /* v93 (11/10/2026): xoá trang cũ đã lưu — trang Bản đồ còn chạy bản mã cũ (chưa có phụ lục phiếu) vì dấu "bản mới" chỉ so file CSS · v92 (2/10/2026): khung Tiện ích mở bản trang cũ gọi tới file mã đã bị thay → "Có lỗi khi hiển thị trang" */   // tăng số này là xoá sạch cache cũ của mọi máy ở lần vào sau
const API_CACHE = 'camlam-api-v1'; // cache RIÊNG cho API công khai (dễ dọn, giới hạn dung lượng)
const OFFLINE = '/offline.html';
// Precache khung app để MỞ APP là vẽ ngay (không chờ mạng → hết màn đen ~1s lúc khởi động).
const PRECACHE = [OFFLINE, '/', '/icons/icon-192.png'];

// API công khai được phép cache (GET, không cá nhân hoá). Tin cá nhân/đăng nhập KHÔNG cache.
function isPublicApi(p) {
  return p === '/api/listings' || p === '/api/listings/areas' || p === '/api/listings/gia-khu-vuc'
    || p === '/api/listings/geojson' || p === '/api/config'
    || p.startsWith('/api/news') || p.startsWith('/api/layers') || p.startsWith('/api/map-ads')
    || p.startsWith('/api/partners') || p.startsWith('/api/projects');
}
// Giữ cache API gọn: xoá bớt mục cũ nhất khi vượt ngưỡng.
async function trimCache(name, max) {
  const c = await caches.open(name); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('install', (e) => {
  // Thêm TỪNG file (không atomic) để 1 file lỗi không làm hỏng cả precache — '/' vẫn được cache.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // API CÔNG KHAI (GET, không kèm Authorization): stale-while-revalidate → app mượt tức thì,
  // dùng được offline, và GIẢM TẢI backend. API cá nhân/đăng nhập để mạng lo (không cache).
  if (url.pathname.startsWith('/api/')) {
    if (!req.headers.get('authorization') && isPublicApi(url.pathname)) {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(API_CACHE).then((c) => c.put(req, copy).then(() => trimCache(API_CACHE, 80))).catch(() => {}); }
        return res;
      }).catch(() => null);
      e.waitUntil(net);
      e.respondWith((async () => {
        const cache = await caches.open(API_CACHE);
        const cached = await cache.match(req);
        return cached || (await net) || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      })());
    }
    return; // API khác: để mạng xử lý bình thường
  }

  // TIN TỨC ĐỘNG (/feed/news…): NETWORK-FIRST — luôn lấy bản mới (bài ghim + slug mới nhất),
  // chỉ dùng cache khi offline. Tránh cache-first phục vụ bản cũ khiến mở bài ra "không tìm thấy".
  if (url.pathname.startsWith('/feed/')) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const copy = res.clone(); caches.open(API_CACHE).then((c) => c.put(req, copy).then(() => trimCache(API_CACHE, 80))).catch(() => {}); }
        return res;
      } catch {
        const cache = await caches.open(API_CACHE);
        return (await cache.match(req)) || new Response(JSON.stringify({ news: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // ĐIỀU HƯỚNG TRANG (mở app / đổi trang): trả CACHE TỨC THÌ rồi cập nhật ngầm (stale-while-revalidate).
  // Đây là mấu chốt hết cảnh màn đen: WebView có HTML ngay → splash nhúng sẵn hiện lập tức.
  // TRANG MỞ TRONG KHUNG TIỆN ÍCH (?embed=1 hoặc mở trong iframe): LUÔN HỎI MẠNG TRƯỚC (2/10/2026).
  // Trả bản đã lưu ở đây là mở bản trang CŨ trong khi trang ngoài đã mới → gọi file mã đã bị thay → trang lỗi.
  if (req.mode === 'navigate' && (url.searchParams.get('embed') === '1' || req.destination === 'iframe')) {
    e.respondWith(fetch(req).catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE)) || Response.error()));
    return;
  }
  if (req.mode === 'navigate') {
    /* ⚠️ BẢN CŨ "DÍNH" TRÊN IPHONE (25/9/2026): trang lưu sẵn hiện ngay cho nhanh, bản
       mới chỉ lưu ngầm → người dùng LUÔN chậm một bản so với web thật (sửa xong mà
       iPhone vẫn thấy lỗi cũ). Nay: bản mới tải về mà KHÁC bản đang hiện (khác dấu
       phiên bản của gói giao diện) thì báo trang tự tải lại một lần. */
    // DẤU PHIÊN BẢN = mọi file CSS + JS của Next mà trang gọi tới (11/10/2026). Trước chỉ so file CSS: bản dựng chỉ đổi MÃ JS
    // (vd thêm phụ lục phiếu ở trang Bản đồ) thì CSS y nguyên → không báo → người dùng chạy bản mã cũ cả lượt vào đó.
    const dau = (html) => [...new Set(html.match(/static\/(?:css|chunks)\/[\w\/.-]+\.(?:css|js)/g) || [])].sort().join(',');
    const net = fetch(req).then(async (res) => {
      if (res && res.ok) {
        const copy = res.clone();
        const cache = await caches.open(CACHE);
        const cu = await cache.match(req);
        const [a, b] = await Promise.all([cu ? cu.clone().text().catch(() => '') : '', res.clone().text().catch(() => '')]);
        await cache.put(req, copy).catch(() => {});
        if (cu && dau(a) && dau(b) && dau(a) !== dau(b)) {
          const kh = await self.clients.get(e.resultingClientId || e.clientId).catch(() => null);
          const ds = kh ? [kh] : await self.clients.matchAll({ type: 'window' });
          ds.forEach((c) => c.postMessage({ loai: 'ban-moi' }));
        }
      }
      return res;
    }).catch(() => null);
    e.waitUntil(net); // giữ SW sống để việc cập nhật ngầm hoàn tất
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;                    // có sẵn → trả ngay, KHÔNG chờ mạng
      return (await net) || (await cache.match(OFFLINE)) || (await cache.match('/')) || Response.error();
    })());
    return;
  }

  // ⚠️ FILE DỮ LIỆU TÊN CỐ ĐỊNH (.json/.geojson trong thư mục public): HỎI MẠNG TRƯỚC.
  // Mấy file này KHÔNG có mã băm trong tên (chu-giai-qh.json, qh_vector.geojson, ranh-xa.geojson,
  // danh-sach-nong.json…) nên nếu dùng cache-first như tài nguyên của Next thì máy nào đã vào web
  // một lần là GIỮ BẢN CŨ MÃI MÃI — sửa dữ liệu bao nhiêu lần cũng không thấy. Đã vấp thật ngày
  // 13/9/2026: đổi bảng chú giải xong, tải lại trang mấy lần vẫn ra bảng cũ.
  // Cách làm: hỏi mạng trước, lấy được thì cập nhật luôn vào cache; mất mạng mới lấy bản đã lưu.
  // (Ảnh tile và ảnh overlay KHÔNG rơi vào đây — chúng nằm trong thư mục có đánh số bản
  //  qd2101v7, qd918v3… nên đổi bản là đổi đường dẫn, cache-first vẫn vừa đúng vừa nhanh.)
  if (/\.(json|geojson)$/i.test(url.pathname) && !url.pathname.startsWith('/tiles/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res && res.status === 200) { const copy = res.clone(); cache.put(req, copy).catch(() => {}); }
        return res;
      } catch (x) {
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  // ⚠️ ẢNH TÊN CỐ ĐỊNH TRONG public/ (logo ngày lễ, ảnh banner): HỎI MẠNG TRƯỚC.
  //    Y HỆT cái bẫy của .json/.geojson ở trên, chỉ khác là ảnh. Mấy thư mục
  //    này KHÔNG có mã băm trong tên: đổi hình mà giữ nguyên tên file thì
  //    cache-first giữ bản cũ MÃI MÃI — Ctrl+Shift+R cũng vô ích, vì chính
  //    Service Worker chặn lại rồi trả bản đã lưu, không hỏi máy chủ.
  //    Đã vấp thật 25/9/2026: sửa logo ngày lễ, dựng lại web xong, máy chủ
  //    trả đúng ảnh mới (đã đối chiếu mã băm ổ đĩa = container = nginx) mà
  //    trình duyệt vẫn hiện ảnh cũ.
  //    Hỏi mạng trước, lấy được thì cập nhật luôn vào cache; mất mạng mới
  //    lấy bản đã lưu — nên vẫn dùng được khi không có mạng.
  if (/^\/(logo-le|banner11|tin-mau|bai-dai)\//.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res && res.status === 200) { const copy = res.clone(); cache.put(req, copy).catch(() => {}); }
        return res;
      } catch (x) {
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  // TÀI NGUYÊN TĨNH (JS/CSS/ảnh/font… của Next, đa số bất biến theo hash): cache-first cho nhanh.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    const res = await fetch(req).catch(() => null);
    if (res && res.status === 200) { const copy = res.clone(); cache.put(req, copy).catch(() => {}); }
    return res || cached || Response.error();
  })());
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) {}
  const title = d.title || 'Cam Lâm Land';
  const opts = { body: d.body || 'Bạn có tin nhắn mới', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: d.tag || 'chat', renotify: true, data: { url: d.url || '/' }, vibrate: [70, 40, 70] };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) { c.focus(); if (c.navigate) { try { c.navigate(url); } catch (x) {} } return; } }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
