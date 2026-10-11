// ── CHỈ CHO MÁY CHỦ TẢI LINK CÔNG KHAI TRÊN INTERNET (11/10/2026 — rà soát bảo mật) ──
// Vài chỗ máy chủ tự đi tải một đường link do NGƯỜI nhập (vd link file văn bản do người quản lý văn bản dán vào).
// Nếu không kiểm, ai được nhập link có thể bắt máy chủ gõ cửa CHÍNH MẠNG NỘI BỘ của nó: database, máy chủ web
// bên trong (http://backend:4000, http://postgis…), bộ định tuyến 192.168.x.x… (kiểu tấn công "SSRF").
// Hàm này chỉ cho qua link http/https trỏ ra tên miền công khai hoặc địa chỉ IP công khai.

/** Địa chỉ IP (dạng chữ) thuộc vùng nội bộ / đặc biệt không được phép gọi tới? */
function laIpNoiBo(h: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(':')) {                                     // IPv6 (trong URL viết trong ngoặc vuông, đã bỏ ngoặc)
    const s = h.toLowerCase();
    if (s.startsWith('::ffff:') || s.startsWith('::')) return true;      // IPv4 viết dạng IPv6 / địa chỉ đặc biệt → không cho
    return s === '::' || s === '::1' || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s);
  }
  return false;
}

/**
 * NGOẠI LỆ DUY NHẤT: tệp PDF chủ web tự đặt trong thư mục public/tai-lieu/ của trang web, máy chủ lấy qua mạng Docker
 * (link dạng http://frontend:3000/tai-lieu/…pdf — đang có 16 văn bản dùng kiểu này). Chỉ đúng máy "frontend", đúng
 * thư mục /tai-lieu/ (đường dẫn đã chuẩn hoá nên không lách bằng "../" ra chỗ khác được).
 */
export function laTaiLieuCuaWeb(link: string | null | undefined): boolean {
  try {
    const u = new URL(String(link || ''));
    return u.protocol === 'http:' && u.hostname === 'frontend' && (u.port === '3000' || u.port === '')
      && !u.username && !u.password && u.pathname.startsWith('/tai-lieu/');
  } catch { return false; }
}

/** Link này có phải http/https trỏ ra Internet công khai (không phải mạng nội bộ của máy chủ) không? */
export function laUrlCongKhai(link: string | null | undefined): boolean {
  let u: URL;
  try { u = new URL(String(link || '')); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;                // link kèm tài khoản (http://a:b@…) → không cần, không cho
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^[\d.]+$/.test(h) || h.includes(':')) return !laIpNoiBo(h);   // viết thẳng địa chỉ IP
  if (/^\d+$/.test(h.replace(/\./g, ''))) return false;      // dạng số lạ (vd 2130706433 = 127.0.0.1)
  return h.includes('.');                                    // tên không có dấu chấm (backend, postgis, nginx…) = máy trong mạng Docker
}
