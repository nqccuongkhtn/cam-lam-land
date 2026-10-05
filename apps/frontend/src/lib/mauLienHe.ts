// @ts-nocheck
/* ── XEM THỬ 100 MẪU KHUNG "NGƯỜI ĐĂNG TIN" Ở TRANG XEM MỘT TIN (TẠM — DỄ GỠ) ─────────────
   Chủ dự án chê khung xanh ngọc hiện tại "chưa sang" (5/10/2026), muốn lướt 100 mẫu ngay trên web thật.
   Mở một tin kèm ?xemmau=12 → khung liên hệ đổi thành mẫu 12; thanh nổi góc dưới để chuyển mẫu.
   Không có ?xemmau thì web y như cũ. Chọn xong thì dựng mẫu đó thành code thật rồi XOÁ file này
   + components/XemMauLienHe.tsx + chỗ gọi trong app/listings/[id]/ListingDetailClient.tsx.
   20 bố cục (mỗi bố cục lấy cảm hứng từ khung liên hệ của một trang BĐS lớn) × 5 bộ màu = 100 mẫu.
   Nút "Hiện số" và "Lưu tin" trong mẫu vẫn bấm được thật (data-act → XemMauLienHe xử lý). */

// Bộ màu: nền, chữ, chữ phụ, nút chính, chữ nút chính, đường kẻ, nền mềm, màu nhấn phụ
const C = {
  trang: ['Trắng tinh, viền mảnh, nút xanh đậm', { bg: '#fff', fg: '#0A2540', mu: '#64748b', ac: '#0A2540', acT: '#fff', ln: '#e2e8f0', so: '#f8fafc', a2: '#C8A14B' }],
  navy:  ['Xanh đậm + vàng ánh kim',            { bg: '#0A2540', fg: '#fff', mu: 'rgba(255,255,255,.62)', ac: '#C8A14B', acT: '#0A2540', ln: 'rgba(255,255,255,.14)', so: 'rgba(255,255,255,.06)', a2: '#C8A14B' }],
  kem:   ['Kem ngà + đen (kiểu nhà đấu giá)',   { bg: '#faf7f2', fg: '#1c1917', mu: '#78716c', ac: '#1c1917', acT: '#faf7f2', ln: '#e7dfd2', so: '#f3ede3', a2: '#a8842f' }],
  ngoc:  ['Xanh ngọc làm nhẹ (giữ màu cũ)',     { bg: '#fff', fg: '#0f3d3a', mu: '#64748b', ac: '#0e8b80', acT: '#fff', ln: '#dfeae7', so: '#f0f8f6', a2: '#0e8b80' }],
  den:   ['Đen than + vàng đồng',               { bg: '#161616', fg: '#f5f5f4', mu: '#a8a29e', ac: '#c9a86a', acT: '#161616', ln: 'rgba(255,255,255,.1)', so: 'rgba(255,255,255,.05)', a2: '#c9a86a' }],
};

// ── Biểu tượng nét mảnh ──
const I = {
  tel: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  zalo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.5 2 2 5.8 2 10.5c0 2.6 1.4 4.9 3.6 6.4-.1.9-.5 2.2-1.2 3.1 1.4-.2 2.8-.8 3.9-1.5 1.1.3 2.4.5 3.7.5 5.5 0 10-3.8 10-8.5S17.5 2 12 2z"/></svg>',
  tim: (f) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="${f ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
  phai: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  khien: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  nguoi: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  dong: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

// ── Mảnh ghép dùng chung ──
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Ảnh đại diện: có ảnh thì dùng ảnh, không thì chữ cái đầu. hinh: 'tron' | 'vuong' */
const av = (d, p, size = 52, hinh = 'tron', vien = '') => {
  const r = hinh === 'vuong' ? '6px' : '50%';
  const st = `width:${size}px;height:${size}px;border-radius:${r};flex:none;${vien}`;
  return d.anh
    ? `<img src="${esc(d.anh)}" alt="" style="${st};object-fit:cover">`
    : `<span style="${st};display:grid;place-items:center;background:${p.ac};color:${p.acT};font-weight:800;font-size:${Math.round(size * .4)}px">${esc(d.chu)}</span>`;
};
const tich = (p) => `<span title="Đã xác minh" style="display:inline-grid;place-items:center;color:${p.a2}">${I.khien}</span>`;
const ten = (d, p, cs = 16, serif = false) => `<span style="font-weight:${serif ? 600 : 800};font-size:${cs}px;line-height:1.25;color:${p.fg};${serif ? 'font-family:Georgia,\'Times New Roman\',serif;letter-spacing:.01em' : ''}">${esc(d.ten)}</span>`;
const nho = (p, t, them = '') => `<div style="font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${p.mu};${them}">${t}</div>`;
// Nút số điện thoại: chưa hiện → nút bấm "Hiện số" (data-act), đã hiện → link gọi thật
const btTel = (d, p, kieu = 'dac', them = '') => {
  const s = kieu === 'dac' ? `background:${p.ac};color:${p.acT};border:1px solid ${p.ac}` : `background:transparent;color:${p.fg};border:1px solid ${p.ln === 'rgba(255,255,255,.14)' || p.ln.startsWith('rgba') ? 'rgba(255,255,255,.35)' : p.fg}`;
  const nd = d.soDu ? `${I.tel}<span>${esc(d.soDu)}</span>` : `${I.tel}<span>${esc(d.so)}</span><span style="opacity:.7;font-weight:600">· Hiện số</span>`;
  return d.soDu ? `<a class="b" href="tel:${esc(d.soDu.replace(/\s/g, ''))}" style="${s};${them}">${nd}</a>` : `<button type="button" class="b" data-act="hien" style="${s};${them}">${nd}</button>`;
};
const vienPhu = (p) => (p.bg.startsWith('#f') || p.bg === '#fff' ? p.ln : 'rgba(255,255,255,.28)');
const btZalo = (d, p, kieu = 'vien', them = '') => {
  const s = kieu === 'xanh' ? 'background:#0068ff;color:#fff;border:1px solid #0068ff' : `background:transparent;color:${p.fg};border:1px solid ${vienPhu(p)}`;
  return `<a class="b" href="${esc(d.zalo)}" target="_blank" rel="noreferrer" style="${s};${them}"><span style="color:${kieu === 'xanh' ? '#fff' : '#0068ff'};display:inline-grid">${I.zalo}</span><span>Chat Zalo</span></a>`;
};
const btLuu = (d, p, them = '') => `<button type="button" class="b" data-act="luu" style="background:transparent;color:${d.daLuu ? '#dc2626' : p.fg};border:1px solid ${vienPhu(p)};${them}">${I.tim(d.daLuu)}<span>${d.daLuu ? 'Đã lưu' : 'Lưu tin'}</span></button>`;
const linkTrang = (d, p, them = '') => d.trang ? `<a href="${esc(d.trang)}" style="display:inline-flex;align-items:center;gap:3px;font-size:12.5px;font-weight:700;color:${p.a2 === '#C8A14B' && p.bg === '#fff' ? p.fg : p.a2};${them}">Xem trang cá nhân ${I.phai}</a>` : '';
const meta = (d, p, them = '') => `<div style="font-size:11px;color:${p.mu};text-align:center;${them}">Mã tin ${esc(d.ma)} · ${esc(d.dang)} · ${esc(d.xem)} lượt xem</div>`;
const soLieu = (d, p, them = '') => `<div style="display:grid;grid-template-columns:1fr 1fr;text-align:center;${them}"><div style="border-right:1px solid ${p.ln};padding:0 6px"><div style="font-size:11px;color:${p.mu}">Tham gia</div><div style="font-weight:800;font-size:15px;margin-top:2px">${esc(d.thamGia)}</div></div><div style="padding:0 6px"><div style="font-size:11px;color:${p.mu}">Tin đang đăng</div><div style="font-weight:800;font-size:15px;margin-top:2px">${esc(d.soTin)}</div></div></div>`;
const khung = (p, them = '') => `background:${p.bg};color:${p.fg};border:1px solid ${p.ln};border-radius:8px;${them}`;
const ke = (p, them = '') => `<div style="height:1px;background:${p.ln};${them}"></div>`;

// ── 20 bố cục ──
const L = {
  l01: ['Kiểu batdongsan.com.vn: ảnh giữa, nút số to', (d, p) => `<div style="${khung(p, 'padding:20px 18px;text-align:center')}">
    <div style="display:flex;justify-content:center">${av(d, p, 64)}</div>
    <div style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:5px">${ten(d, p, 16)}${tich(p)}</div>
    <div style="margin-top:4px;font-size:12.5px;color:${p.mu}">Xem thêm ${esc(d.soTin)} tin khác</div>
    <div style="display:grid;gap:8px;margin-top:16px">${btTel(d, p)}${btZalo(d, p)}</div>
    ${ke(p, 'margin:14px 0 10px')}${meta(d, p)}</div>`],

  l02: ['Kiểu Zillow: "Người đăng" + hàng ngang gọn', (d, p) => `<div style="${khung(p, 'padding:16px')}">
    ${nho(p, 'Người đăng tin')}
    <div style="display:flex;align-items:center;gap:12px;margin-top:10px">${av(d, p, 48)}<div style="min-width:0"><div style="display:flex;align-items:center;gap:5px">${ten(d, p, 15.5)}${tich(p)}</div><div style="font-size:12px;color:${p.mu};margin-top:2px">Tham gia ${esc(d.thamGia)} · ${esc(d.soTin)} tin</div></div></div>
    <div style="display:grid;gap:8px;margin-top:14px">${btTel(d, p)}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${btZalo(d, p)}${btLuu(d, p)}</div></div>
    ${linkTrang(d, p, 'margin-top:12px')}</div>`],

  l03: ['Kiểu Redfin: viền nhấn trên đầu, 2 nút cạnh nhau', (d, p) => `<div style="${khung(p, `border-top:3px solid ${p.a2};padding:16px`)}">
    <div style="font-weight:800;font-size:15px">Liên hệ người bán</div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:12px">${av(d, p, 46)}<div><div style="display:flex;align-items:center;gap:5px">${ten(d, p, 15)}${tich(p)}</div>${linkTrang(d, p, 'margin-top:2px')}</div></div>
    ${soLieu(d, p, `margin-top:14px;padding:10px 0;border-top:1px solid ${p.ln};border-bottom:1px solid ${p.ln}`)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">${btZalo(d, p)}${btTel(d, p, 'dac', 'font-size:12.5px')}</div>
    ${meta(d, p, 'margin-top:12px')}</div>`],

  l04: ['Kiểu Sotheby\'s: ảnh vuông, chữ có chân, nút viền', (d, p) => `<div style="${khung(p, 'padding:20px')}">
    ${nho(p, 'Chuyên viên phụ trách')}
    <div style="display:flex;gap:14px;margin-top:14px">${av(d, p, 76, 'vuong')}<div style="display:flex;flex-direction:column;justify-content:center">${ten(d, p, 19, true)}<div style="font-size:12px;color:${p.mu};margin-top:4px">Cam Lâm Land · ${esc(d.soTin)} bất động sản</div></div></div>
    ${ke(p, 'margin:18px 0')}
    <div style="display:grid;gap:8px">${btTel(d, p, 'dac', 'border-radius:0;letter-spacing:.04em')}${btZalo(d, p, 'vien', 'border-radius:0')}${btLuu(d, p, 'border-radius:0')}</div>
    ${meta(d, p, 'margin-top:14px')}</div>`],

  l05: ['Kiểu Airbnb: thẻ chủ nhà nổi + cột số liệu', (d, p) => `<div style="${khung(p, 'padding:16px')}">
    <div style="display:flex;align-items:center;gap:14px;padding:16px;border-radius:14px;background:${p.so};box-shadow:0 6px 20px rgba(0,0,0,.08)">
      <div style="text-align:center;flex:1">${`<div style="display:flex;justify-content:center;position:relative">${av(d, p, 64)}</div>`}<div style="margin-top:8px">${ten(d, p, 15.5)}</div><div style="font-size:11.5px;color:${p.mu};display:flex;align-items:center;justify-content:center;gap:3px;margin-top:2px">${tich(p)} Đã xác minh</div></div>
      <div style="width:1px;align-self:stretch;background:${p.ln}"></div>
      <div style="flex:none;width:92px;display:grid;gap:10px"><div><div style="font-weight:800;font-size:17px">${esc(d.soTin)}</div><div style="font-size:10.5px;color:${p.mu}">Tin đang đăng</div></div>${ke(p)}<div><div style="font-weight:800;font-size:17px">${esc(d.thamGia)}</div><div style="font-size:10.5px;color:${p.mu}">Tham gia</div></div></div>
    </div>
    <div style="display:grid;gap:8px;margin-top:14px">${btTel(d, p, 'dac', 'border-radius:8px')}${btZalo(d, p, 'vien', 'border-radius:8px')}</div>
    ${meta(d, p, 'margin-top:12px')}</div>`],

  l06: ['Kiểu Rightmove: dải thương hiệu + số gọi to', (d, p) => `<div style="${khung(p, 'overflow:hidden')}">
    <div style="background:${p.so};padding:14px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid ${p.ln}">${av(d, p, 44)}<div style="min-width:0">${nho(p, 'Tin đăng bởi', 'letter-spacing:.08em')}<div style="display:flex;align-items:center;gap:5px;margin-top:2px">${ten(d, p, 15)}${tich(p)}</div></div></div>
    <div style="padding:16px">
      <div style="font-size:12px;color:${p.mu}">Gọi người bán</div>
      ${d.soDu ? `<a href="tel:${esc(d.soDu.replace(/\s/g, ''))}" style="display:block;font-weight:800;font-size:22px;color:${p.fg};margin-top:2px">${esc(d.soDu)}</a>` : `<button type="button" data-act="hien" style="display:flex;align-items:baseline;gap:8px;margin-top:2px;color:${p.fg}"><span style="font-weight:800;font-size:22px">${esc(d.so)}</span><span style="font-size:12.5px;font-weight:700;color:${p.a2};text-decoration:underline">Hiện số</span></button>`}
      <div style="display:grid;gap:8px;margin-top:14px">${btZalo(d, p, 'xanh')}${btLuu(d, p)}</div>
      ${linkTrang(d, p, 'margin-top:12px')}
    </div></div>`],

  l07: ['Kiểu PropertyGuru: huy hiệu "phản hồi nhanh", 2 nút đều', (d, p) => `<div style="${khung(p, 'padding:16px')}">
    <div style="display:flex;align-items:center;gap:12px">${av(d, p, 52)}<div><div style="display:flex;align-items:center;gap:5px">${ten(d, p, 15.5)}${tich(p)}</div><span style="display:inline-flex;align-items:center;gap:3px;margin-top:4px;font-size:11px;font-weight:700;color:${p.a2};background:${p.so};border:1px solid ${p.ln};border-radius:99px;padding:2px 8px">${I.dong} Thường trả lời trong 5 phút</span></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">${btZalo(d, p, 'xanh')}${btTel(d, p, 'dac', 'font-size:12.5px')}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">${linkTrang(d, p)}<button type="button" data-act="luu" style="display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:700;color:${d.daLuu ? '#dc2626' : p.mu}">${I.tim(d.daLuu)} ${d.daLuu ? 'Đã lưu' : 'Lưu'}</button></div></div>`],

  l08: ['Kiểu Nhà Tốt: chấm "đang hoạt động", nút số + chat', (d, p) => `<div style="${khung(p, 'padding:16px')}">
    <div style="display:flex;align-items:center;gap:12px"><div style="position:relative">${av(d, p, 50)}<span style="position:absolute;right:1px;bottom:1px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid ${p.bg}"></span></div><div style="flex:1;min-width:0">${ten(d, p, 15.5)}<div style="font-size:11.5px;color:${p.mu};margin-top:2px">Đang hoạt động · ${esc(d.soTin)} tin · tham gia ${esc(d.thamGia)}</div></div>${d.trang ? `<a href="${esc(d.trang)}" aria-label="Trang cá nhân" style="color:${p.mu}">${I.phai}</a>` : ''}</div>
    <div style="display:grid;gap:8px;margin-top:14px">${btTel(d, p)}${btZalo(d, p)}</div>
    ${meta(d, p, 'margin-top:12px')}</div>`],

  l09: ['Kiểu Compass: tối giản, chữ tên lớn, nút đen', (d, p) => `<div style="${khung(p, 'padding:22px 20px')}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div>${nho(p, 'Liên hệ')}<div style="margin-top:8px">${ten(d, p, 21)}</div></div>${av(d, p, 44)}</div>
    <div style="margin-top:18px;display:grid;gap:0">
      ${[[`${I.tel}`, d.soDu ? esc(d.soDu) : `${esc(d.so)} — hiện số`, d.soDu ? `href="tel:${esc(d.soDu.replace(/\s/g, ''))}"` : 'data-act="hien"'], [I.zalo, 'Nhắn Zalo', `href="${esc(d.zalo)}" target="_blank" rel="noreferrer"`], [I.nguoi, 'Trang cá nhân', d.trang ? `href="${esc(d.trang)}"` : '']].filter((x) => x[2]).map(([i, t, a]) => `<${a.startsWith('data') ? 'button type="button"' : 'a'} ${a} style="display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid ${p.ln};font-size:13.5px;font-weight:600;color:${p.fg};width:100%;text-align:left">${i}<span style="flex:1">${t}</span>${I.phai}</${a.startsWith('data') ? 'button' : 'a'}>`).join('')}
    </div>
    ${btLuu(d, p, 'width:100%;margin-top:12px')}
    ${meta(d, p, 'margin-top:12px')}</div>`],

  l10: ['Kiểu realestate.com.au: dải màu trên, ảnh đè giữa', (d, p) => `<div style="${khung(p, 'overflow:hidden;text-align:center')}">
    <div style="height:58px;background:${p.ac};display:flex;align-items:center;justify-content:center;color:${p.acT};font-weight:800;font-size:13px;letter-spacing:.06em">CAM LÂM LAND</div>
    <div style="display:flex;justify-content:center;margin-top:-30px">${av(d, p, 60, 'tron', `border:3px solid ${p.bg};box-shadow:0 2px 8px rgba(0,0,0,.12)`)}</div>
    <div style="padding:8px 16px 16px"><div style="display:flex;align-items:center;justify-content:center;gap:5px">${ten(d, p, 16)}${tich(p)}</div><div style="font-size:12px;color:${p.mu};margin-top:2px">${esc(d.soTin)} tin đang đăng · tham gia ${esc(d.thamGia)}</div>
    <div style="display:grid;gap:8px;margin-top:14px">${btTel(d, p)}${btZalo(d, p)}</div>${linkTrang(d, p, 'margin-top:12px;justify-content:center')}</div></div>`],

  l11: ['Kiểu Knight Frank: nửa trên đậm, nửa dưới sáng', (d, p) => `<div style="border-radius:8px;overflow:hidden;border:1px solid ${p.ln}">
    <div style="background:${p.bg === '#fff' || p.bg.startsWith('#f') ? p.ac : p.bg};color:${p.bg === '#fff' || p.bg.startsWith('#f') ? p.acT : p.fg};padding:18px 16px;display:flex;align-items:center;gap:12px">${av(d, { ...p, ac: p.a2, acT: '#0A2540' }, 50)}<div><div style="font-size:10.5px;letter-spacing:.14em;opacity:.7;font-weight:700">MÔI GIỚI</div><div style="font-weight:800;font-size:16px;margin-top:2px">${esc(d.ten)}</div></div></div>
    <div style="background:${p.bg === '#fff' || p.bg.startsWith('#f') ? p.bg : '#fff'};padding:14px 16px;display:grid;gap:8px">${(() => { const q = p.bg === '#fff' || p.bg.startsWith('#f') ? p : { ...p, bg: '#fff', fg: '#0A2540', mu: '#64748b', ln: '#e2e8f0' }; return btTel(d, q) + btZalo(d, q) + soLieu(d, q, 'margin-top:6px;color:' + q.fg) + meta(d, q, 'margin-top:4px'); })()}</div></div>`],

  l12: ['Kiểu Domain: sao đánh giá + nút viền/đặc', (d, p) => `<div style="${khung(p, 'padding:16px')}">
    <div style="display:flex;align-items:center;gap:12px">${av(d, p, 54)}<div><div>${ten(d, p, 15.5)}</div><div style="color:${p.a2};font-size:13px;letter-spacing:1px;margin-top:2px">★★★★★ <span style="color:${p.mu};font-size:11.5px;letter-spacing:0">Đã xác minh</span></div><div style="font-size:11.5px;color:${p.mu};margin-top:1px">${esc(d.soTin)} tin đang đăng</div></div></div>
    <div style="display:grid;gap:8px;margin-top:14px">${btTel(d, p, 'vien')}${btZalo(d, p, 'xanh')}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">${linkTrang(d, p)}<button type="button" data-act="luu" style="color:${d.daLuu ? '#dc2626' : p.mu};display:inline-flex">${I.tim(d.daLuu)}</button></div></div>`],

  l13: ['Kiểu Homedy: tóm tắt giá ở đầu khung', (d, p) => `<div style="${khung(p, 'padding:16px')}">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:12px;color:${p.mu}">Giá bán</div><div style="font-size:12px;color:${p.mu}">${esc(d.dt)}</div></div>
    <div style="font-weight:800;font-size:22px;color:${p.bg === '#fff' || p.bg.startsWith('#f') ? '#dc2626' : p.a2};margin-top:2px">${esc(d.gia)}</div>
    ${ke(p, 'margin:14px 0')}
    <div style="display:flex;align-items:center;gap:10px">${av(d, p, 40)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:5px">${ten(d, p, 14.5)}${tich(p)}</div><div style="font-size:11.5px;color:${p.mu}">${esc(d.soTin)} tin · tham gia ${esc(d.thamGia)}</div></div></div>
    <div style="display:grid;gap:8px;margin-top:12px">${btTel(d, p)}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${btZalo(d, p)}${btLuu(d, p)}</div></div></div>`],

  l14: ['Kiểu Savills: tên chữ có chân, danh sách liên hệ', (d, p) => `<div style="${khung(p, 'padding:18px')}">
    <div style="display:flex;align-items:center;gap:12px">${av(d, p, 50)}<div>${ten(d, p, 18, true)}<div style="font-size:11.5px;color:${p.mu};margin-top:3px;display:flex;align-items:center;gap:3px">${tich(p)} Môi giới đã xác minh</div></div></div>
    <div style="margin-top:14px;border:1px solid ${p.ln};border-radius:6px;overflow:hidden">
      ${[[I.tel, d.soDu ? esc(d.soDu) : esc(d.so), d.soDu ? 'Gọi' : 'Hiện số', d.soDu ? `href="tel:${esc(d.soDu.replace(/\s/g, ''))}"` : 'data-act="hien"'], [I.zalo, 'Zalo', 'Nhắn tin', `href="${esc(d.zalo)}" target="_blank" rel="noreferrer"`], [I.nguoi, 'Trang cá nhân', `${esc(d.soTin)} tin`, d.trang ? `href="${esc(d.trang)}"` : '']].filter((x) => x[3]).map(([i, t, r, a], k) => { const tag = a.startsWith('data') ? 'button' : 'a'; return `<${tag} ${tag === 'button' ? 'type="button"' : ''} ${a} style="display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;${k ? `border-top:1px solid ${p.ln};` : ''}font-size:13.5px;color:${p.fg};text-align:left"><span style="color:${p.a2};display:inline-grid">${i}</span><span style="flex:1;font-weight:700">${t}</span><span style="font-size:12px;color:${p.mu}">${r}</span></${tag}>`; }).join('')}
    </div>
    ${btLuu(d, p, 'width:100%;margin-top:10px')}${meta(d, p, 'margin-top:12px')}</div>`],

  l15: ['Kiểu Trulia: câu hỏi nhanh bấm là mở Zalo', (d, p) => `<div style="${khung(p, 'padding:16px')}">
    <div style="display:flex;align-items:center;gap:10px">${av(d, p, 44)}<div><div style="display:flex;align-items:center;gap:5px">${ten(d, p, 15)}${tich(p)}</div><div style="font-size:11.5px;color:${p.mu}">${esc(d.soTin)} tin đang đăng</div></div></div>
    <div style="font-size:12.5px;font-weight:700;margin-top:14px">Hỏi nhanh người bán</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${['Còn bán không ạ?', 'Xem đất được không?', 'Giá có bớt không?', 'Sổ riêng chưa?'].map((q) => `<a href="${esc(d.zalo)}" target="_blank" rel="noreferrer" style="font-size:12px;padding:6px 10px;border-radius:99px;border:1px solid ${vienPhu(p)};color:${p.fg}">${q}</a>`).join('')}</div>
    <div style="display:grid;gap:8px;margin-top:14px">${btTel(d, p)}${btZalo(d, p)}</div>
    ${meta(d, p, 'margin-top:12px')}</div>`],

  l16: ['Kiểu Idealista: số điện thoại là phần chính', (d, p) => `<div style="${khung(p, 'padding:18px')}">
    ${nho(p, 'Điện thoại người bán')}
    ${d.soDu ? `<a href="tel:${esc(d.soDu.replace(/\s/g, ''))}" style="display:flex;align-items:center;gap:8px;margin-top:8px;font-weight:800;font-size:24px;color:${p.fg}">${I.tel} ${esc(d.soDu)}</a>` : `<button type="button" data-act="hien" style="display:flex;width:100%;align-items:center;justify-content:space-between;margin-top:8px;padding:10px 12px;border-radius:6px;background:${p.so};border:1px dashed ${vienPhu(p)};color:${p.fg}"><span style="font-weight:800;font-size:21px;letter-spacing:.02em">${esc(d.so)}</span><span style="font-size:12.5px;font-weight:800;color:${p.acT};background:${p.ac};padding:5px 10px;border-radius:4px">Hiện số</span></button>`}
    ${ke(p, 'margin:16px 0')}
    <div style="display:flex;align-items:center;gap:10px">${av(d, p, 38)}<div style="flex:1;min-width:0">${ten(d, p, 14)}<div style="font-size:11.5px;color:${p.mu}">Tham gia ${esc(d.thamGia)}</div></div>${linkTrang(d, p)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">${btZalo(d, p)}${btLuu(d, p)}</div></div>`],

  l17: ['Kiểu 99.co: viền ảnh màu nhấn, nút dạng hàng', (d, p) => `<div style="${khung(p, 'padding:16px')}">
    <div style="display:flex;align-items:center;gap:12px"><span style="padding:2px;border-radius:50%;background:linear-gradient(135deg,${p.a2},${p.ac})">${av(d, p, 50, 'tron', `border:2px solid ${p.bg}`)}</span><div><div style="display:flex;align-items:center;gap:5px">${ten(d, p, 15.5)}${tich(p)}</div><div style="font-size:11.5px;color:${p.mu};margin-top:1px">Tham gia ${esc(d.thamGia)} · ${esc(d.soTin)} tin</div></div></div>
    <div style="display:grid;gap:8px;margin-top:14px">${btTel(d, p, 'dac', 'justify-content:flex-start;padding-left:14px')}${btZalo(d, p, 'vien', 'justify-content:flex-start;padding-left:14px')}${btLuu(d, p, 'justify-content:flex-start;padding-left:14px')}</div>
    ${linkTrang(d, p, 'margin-top:12px')}</div>`],

  l18: ['Kiểu Christie\'s: cân giữa, chữ lồng, đường hoa văn', (d, p) => `<div style="${khung(p, 'padding:22px 18px;text-align:center')}">
    ${nho(p, 'Chuyên viên tư vấn', 'letter-spacing:.22em')}
    <div style="display:flex;justify-content:center;margin-top:14px"><span style="padding:3px;border-radius:50%;border:1px solid ${p.a2}">${av(d, p, 62, 'tron', `border:1px solid ${p.a2}`)}</span></div>
    <div style="margin-top:12px">${ten(d, p, 20, true)}</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin:10px 0 16px;color:${p.a2}"><span style="height:1px;width:40px;background:${p.a2}"></span>◆<span style="height:1px;width:40px;background:${p.a2}"></span></div>
    <div style="display:grid;gap:8px">${btTel(d, p, 'dac', 'border-radius:2px;letter-spacing:.05em')}${btZalo(d, p, 'vien', 'border-radius:2px')}</div>
    ${linkTrang(d, p, 'margin-top:12px;justify-content:center')}</div>`],

  l19: ['Kiểu Booking: 3 ô số liệu + nút', (d, p) => `<div style="${khung(p, 'padding:16px')}">
    <div style="display:flex;align-items:center;gap:10px">${av(d, p, 44)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:5px">${ten(d, p, 15)}${tich(p)}</div>${linkTrang(d, p)}</div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px">${[[d.thamGia, 'Tham gia'], [d.soTin, 'Tin đăng'], [d.xem, 'Lượt xem']].map(([v, t]) => `<div style="background:${p.so};border:1px solid ${p.ln};border-radius:6px;padding:8px 4px;text-align:center"><div style="font-weight:800;font-size:14px">${esc(v)}</div><div style="font-size:10.5px;color:${p.mu}">${t}</div></div>`).join('')}</div>
    <div style="display:grid;gap:8px;margin-top:12px">${btTel(d, p)}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${btZalo(d, p)}${btLuu(d, p)}</div></div>
    <div style="font-size:11px;color:${p.mu};text-align:center;margin-top:10px">Mã tin ${esc(d.ma)} · ${esc(d.dang)}</div></div>`],

  l20: ['Kiểu ứng dụng điện thoại: 3 nút tròn có chữ dưới', (d, p) => `<div style="${khung(p, 'padding:18px 16px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.06)')}">
    <div style="display:flex;align-items:center;gap:12px">${av(d, p, 52)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:5px">${ten(d, p, 16)}${tich(p)}</div><div style="font-size:11.5px;color:${p.mu}">${esc(d.soTin)} tin · tham gia ${esc(d.thamGia)}</div></div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:16px;text-align:center">
      ${[[I.tel, d.soDu ? 'Gọi' : 'Hiện số', d.soDu ? `href="tel:${esc(d.soDu.replace(/\s/g, ''))}"` : 'data-act="hien"', p.ac, p.acT], [I.zalo, 'Zalo', `href="${esc(d.zalo)}" target="_blank" rel="noreferrer"`, '#0068ff', '#fff'], [I.tim(d.daLuu), d.daLuu ? 'Đã lưu' : 'Lưu', 'data-act="luu"', p.so, d.daLuu ? '#dc2626' : p.fg]].map(([i, t, a, nen, chu]) => { const tag = a.startsWith('data') ? 'button' : 'a'; return `<${tag} ${tag === 'button' ? 'type="button"' : ''} ${a} style="display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:${p.fg}"><span style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:${nen};color:${chu};border:1px solid ${p.ln}">${i}</span>${t}</${tag}>`; }).join('')}
    </div>
    ${d.soDu ? `<div style="text-align:center;font-weight:800;font-size:16px;margin-top:12px">${esc(d.soDu)}</div>` : ''}
    ${ke(p, 'margin:14px 0 10px')}${meta(d, p)}</div>`],
};


// ── 3 MẪU "SANG" (101–103) — làm thêm 5/10/2026 sau khi chủ dự án chê cả 100 mẫu trên "không sang".
//    Khác hẳn 100 mẫu kia: có ẢNH THẬT Cam Lâm, khung viền VẼ BẰNG SVG (góc hoa văn, vân guilloche
//    như tờ tiền), nút ÁNH KIM có vệt sáng chạy, chữ có chân Playfair. Mỗi mẫu một bộ màu cố định.
const VANG = 'linear-gradient(115deg,#7a5a1e 0%,#c9a24e 18%,#f6e3a1 34%,#b8893a 52%,#e9cf86 70%,#8a6626 100%)';
const svgUrl = (svg) => `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
// Hạt nhiễu rất mịn phủ lên nền tối → nhìn như giấy/da thật, hết cảm giác "màu phẳng vẽ máy"
const HAT = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .09 0 0 0 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>');
// Vân guilloche (kiểu hoa văn trên tờ tiền / thiệp cưới): 14 đường sóng lệch pha đan vào nhau
const guilloche = (mau, w = 360, h = 130) => {
  let dd = '';
  for (let k = 0; k < 14; k++) {
    let d = '';
    for (let x = 0; x <= w; x += 3) {
      const y = h / 2 + h * 0.36 * Math.sin(x / 24 + k * 0.45) * Math.cos(x / 67 - k * 0.22);
      d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
    }
    dd += `<path d="${d}"/>`;
  }
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><g fill="none" stroke="${mau}" stroke-width=".6">${dd}</g></svg>`);
};
// Góc hoa văn: hai đường viền lồng nhau + nét cong + chấm tròn; lật gương để đủ 4 góc
const gocHv = (mau, size = 30) => ['top:5px;left:5px', 'top:5px;right:5px;transform:scaleX(-1)', 'bottom:5px;left:5px;transform:scaleY(-1)', 'bottom:5px;right:5px;transform:scale(-1,-1)']
  .map((vt) => `<svg viewBox="0 0 40 40" width="${size}" height="${size}" style="position:absolute;${vt};z-index:2;pointer-events:none" fill="none" stroke="${mau}" stroke-width="1" stroke-linecap="round"><path d="M1.5 38V11Q1.5 1.5 11 1.5H38"/><path d="M5.5 38V14Q5.5 5.5 14 5.5H38" opacity=".45"/><path d="M11 11q8 1 10 10M11 11q1 8 10 10" opacity=".8"/><circle cx="11" cy="11" r="1.8" fill="${mau}" stroke="none"/></svg>`).join('');
// Đường kẻ có hạt kim cương ở giữa
const keKc = (mau, rong = 54) => `<div style="display:flex;align-items:center;justify-content:center;gap:9px;color:${mau}"><span style="height:1px;width:${rong}px;background:linear-gradient(90deg,transparent,${mau})"></span><svg width="9" height="9" viewBox="0 0 10 10"><path d="M5 0 10 5 5 10 0 5z" fill="currentColor"/></svg><span style="height:1px;width:${rong}px;background:linear-gradient(90deg,${mau},transparent)"></span></div>`;
const SERIF = `font-family:'Playfair Display',Georgia,'Times New Roman',serif`;
// Nút số điện thoại riêng cho 3 mẫu này (cách chạy y như cũ: chưa hiện → bấm "Hiện số")
const telSang = (d, st, lop = 'b') => {
  const nd = d.soDu ? `${I.tel}<span>${esc(d.soDu)}</span>` : `${I.tel}<span>${esc(d.so)}</span><span style="opacity:.65;font-weight:600">· Hiện số</span>`;
  return d.soDu ? `<a class="${lop}" href="tel:${esc(d.soDu.replace(/\s/g, ''))}" style="${st}">${nd}</a>` : `<button type="button" class="${lop}" data-act="hien" style="${st}">${nd}</button>`;
};
const zaloSang = (d, st) => `<a class="b" href="${esc(d.zalo)}" target="_blank" rel="noreferrer" style="${st}">${I.zalo}<span>Chat Zalo</span></a>`;
const luuSang = (d, st) => `<button type="button" class="b" data-act="luu" style="${st}${d.daLuu ? ';color:#f87171' : ''}">${I.tim(d.daLuu)}<span>${d.daLuu ? 'Đã lưu' : 'Lưu tin'}</span></button>`;
const vongVang = (d, size, nen) => `<span style="display:inline-block;padding:2px;border-radius:50%;background:${VANG};box-shadow:0 6px 18px -6px rgba(0,0,0,.5)">${av(d, { ac: '#14110c', acT: '#f3e2a6' }, size, 'tron', `border:2px solid ${nen}`)}</span>`;
const metaSang = (d, mau, them = '') => `<div style="font-size:10.5px;color:${mau};${them}">Mã tin ${esc(d.ma)} · ${esc(d.dang)} · ${esc(d.xem)} lượt xem</div>`;

const S = {
  s1: ['SANG 1 · Thẻ đen ánh kim: ảnh biển Cam Lâm trên đầu, khung viền vàng góc hoa văn, nút vàng có vệt sáng chạy', (d) => {
    const kim = 'rgba(214,180,106,';
    const phu = `height:38px;border-radius:4px;color:#efe6cf;background:rgba(255,255,255,.04);border:1px solid ${kim}.38);font-size:13px`;
    return `<div style="position:relative;border-radius:8px;overflow:hidden;color:#efe6cf;background:${HAT},radial-gradient(120% 70% at 50% 0%,#1b2c47 0%,#0c1626 62%,#080f1b 100%);box-shadow:0 18px 40px -16px rgba(8,20,40,.7)">
    <div style="height:132px;background:linear-gradient(180deg,rgba(12,22,38,0) 0%,rgba(12,22,38,0) 52%,rgba(12,22,38,.6) 78%,#0e1a2d 100%),url(/bai-dai/hero.webp) center 66%/cover"></div>
    <div style="position:absolute;inset:7px;border:1px solid ${kim}.5);border-radius:5px;pointer-events:none;z-index:2"></div>${gocHv('#d6b46a')}
    <div style="position:relative;z-index:3;margin-top:-34px;padding:0 22px 20px;text-align:center">
      ${vongVang(d, 68, '#0e1a2d')}
      <div style="margin-top:10px;font-size:9.5px;font-weight:700;letter-spacing:.32em;text-transform:uppercase;color:${kim}.95)">Người đăng tin</div>
      <div style="margin-top:4px;display:flex;align-items:center;justify-content:center;gap:6px"><span style="${SERIF};font-weight:600;font-size:21px;line-height:1.2;color:#f7efd9">${esc(d.ten)}</span><span style="color:#d6b46a;display:inline-grid">${I.khien}</span></div>
      <div style="margin-top:4px;font-size:12px;color:rgba(239,230,207,.6)">Tham gia ${esc(d.thamGia)} · ${esc(d.soTin)} tin đang đăng</div>
      <div style="margin:14px 0 16px">${keKc('#d6b46a')}</div>
      <div style="display:grid;gap:8px">
        ${telSang(d, 'height:42px;border-radius:4px;color:#1b1408;font-size:14px;letter-spacing:.02em;border:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 8px 20px -8px rgba(201,162,78,.7)', 'b kim')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${zaloSang(d, phu)}${luuSang(d, phu)}</div>
      </div>
      ${d.trang ? `<a href="${esc(d.trang)}" style="display:inline-flex;align-items:center;gap:3px;margin-top:14px;font-size:12.5px;font-weight:600;color:#d6b46a">Xem trang cá nhân ${I.phai}</a>` : ''}
      ${metaSang(d, 'rgba(239,230,207,.45)', `margin-top:12px;padding-top:10px;border-top:1px solid ${kim}.18)`)}
    </div></div>`;
  }],

  s2: ['SANG 2 · Thiệp ngà: vân hoa văn như tờ tiền, viền vàng đôi, chữ có chân, nút đen chữ vàng', (d) => {
    const phu = 'height:38px;border-radius:3px;background:rgba(255,255,255,.6);color:#1d1a15;border:1px solid #d9cba9;font-size:13px';
    return `<div style="position:relative;border-radius:8px;overflow:hidden;color:#1d1a15;background:${guilloche('rgba(176,141,66,.22)')} top center/100% 150px no-repeat,linear-gradient(180deg,#fbf6ea 0%,#fdfbf6 45%,#faf6ec 100%);border:1px solid #e6dcc6;box-shadow:0 14px 34px -18px rgba(90,70,30,.45)">
    <div style="position:absolute;inset:6px;border:1px solid #cdb27a;border-radius:4px;pointer-events:none"></div>
    <div style="position:absolute;inset:10px;border:1px solid rgba(205,178,122,.45);border-radius:3px;pointer-events:none"></div>${gocHv('#b08d42', 28)}
    <div style="position:relative;z-index:3;padding:28px 24px 22px;text-align:center">
      <span style="display:inline-block;padding:3px;border-radius:50%;border:1px solid #b08d42;background:#fdfbf6">${av(d, { ac: '#14110c', acT: '#f3e2a6' }, 64, 'tron', 'border:1px solid #e6dcc6')}</span>
      <div style="margin-top:10px;font-size:9.5px;font-weight:700;letter-spacing:.32em;text-transform:uppercase;color:#9a7b3a">Người đăng tin</div>
      <div style="margin-top:4px;display:flex;align-items:center;justify-content:center;gap:6px"><span style="${SERIF};font-weight:600;font-size:22px;line-height:1.2">${esc(d.ten)}</span><span style="color:#b08d42;display:inline-grid">${I.khien}</span></div>
      <div style="margin-top:4px;font-size:12px;color:#7a7163">Tham gia ${esc(d.thamGia)} · ${esc(d.soTin)} tin đang đăng</div>
      <div style="margin:14px 0 16px">${keKc('#b08d42')}</div>
      <div style="display:grid;gap:8px">
        ${telSang(d, 'height:42px;border-radius:3px;background:linear-gradient(180deg,#23201a,#100e0a);color:#f0dc9c;font-size:14px;letter-spacing:.02em;border:0;box-shadow:inset 0 0 0 1px rgba(240,220,156,.28),0 8px 18px -10px rgba(0,0,0,.6)')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${zaloSang(d, phu)}${luuSang(d, phu)}</div>
      </div>
      ${d.trang ? `<a href="${esc(d.trang)}" style="display:inline-block;margin-top:14px;${SERIF};font-style:italic;font-size:13.5px;color:#7d6227;border-bottom:1px solid rgba(176,141,66,.5);padding-bottom:1px">Xem trang cá nhân →</a>` : ''}
      ${metaSang(d, '#9a907e', 'margin-top:12px')}
    </div></div>`;
  }],

  s3: ['SANG 3 · Kính mờ trên ảnh resort Cam Lâm: khung kính trong suốt, chữ trắng, nút trắng', (d) => {
    const kinh = 'background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.38);color:#fff;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)';
    return `<div style="position:relative;border-radius:8px;overflow:hidden;color:#fff;background:linear-gradient(180deg,rgba(6,24,44,.05) 0%,rgba(6,24,44,.35) 45%,rgba(6,24,44,.78) 100%),url(/bai-dai/bd-02.webp) center 40%/cover;padding:12px;box-shadow:0 18px 40px -18px rgba(6,24,44,.7)">
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;${kinh}">${I.nguoi}Người đăng tin</span>
      <span style="padding:5px 9px;border-radius:999px;font-size:10.5px;font-weight:600;${kinh}">${esc(d.soTin)} tin</span></div>
    <div style="margin-top:78px;border-radius:8px;padding:16px;background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.08));border:1px solid rgba(255,255,255,.35);-webkit-backdrop-filter:blur(16px) saturate(150%);backdrop-filter:blur(16px) saturate(150%);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 10px 30px rgba(0,0,0,.25)">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="display:inline-block;padding:2px;border-radius:50%;background:rgba(255,255,255,.85)">${av(d, { ac: '#0A2540', acT: '#fff' }, 52)}</span>
        <div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:6px"><span style="${SERIF};font-weight:600;font-size:19px;line-height:1.2;text-shadow:0 1px 8px rgba(0,0,0,.3)">${esc(d.ten)}</span><span style="display:inline-grid;color:#fde68a">${I.khien}</span></div>
          <div style="margin-top:2px;font-size:12px;color:rgba(255,255,255,.78)">Tham gia ${esc(d.thamGia)}${d.trang ? ` · <a href="${esc(d.trang)}" style="color:#fff;font-weight:600;border-bottom:1px solid rgba(255,255,255,.5)">Trang cá nhân</a>` : ''}</div></div>
      </div>
      <div style="display:grid;gap:8px;margin-top:14px">
        ${telSang(d, 'height:42px;border-radius:6px;background:#fff;color:#0A2540;font-size:14px;border:0;box-shadow:0 8px 20px -8px rgba(0,0,0,.45)')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${zaloSang(d, `height:38px;border-radius:6px;font-size:13px;${kinh}`)}${luuSang(d, `height:38px;border-radius:6px;font-size:13px;${kinh}`)}</div>
      </div>
    </div>
    ${metaSang(d, 'rgba(255,255,255,.7)', 'margin-top:10px;text-align:center')}</div>`;
  }],
};

// ── 3 MẪU "TIẾT CHẾ" (104–106) — chủ dự án chê 101–103 "hoạt hình quá" (5/10/2026).
//    Học các hãng nhà đất cao cấp thật: KHÔNG hoa văn, KHÔNG ánh kim, KHÔNG bóng đổ, KHÔNG hiệu ứng chạy.
//    Sang nhờ: ảnh thật, khoảng trống rộng, đường kẻ 1px, chữ có chân cỡ vừa, màu phẳng, ít màu.
const avNhe = (d, size, nen, chu) => d.anh
  ? `<img src="${esc(d.anh)}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex:none">`
  : `<span style="width:${size}px;height:${size}px;border-radius:50%;flex:none;display:grid;place-items:center;background:${nen};color:${chu};${SERIF};font-weight:600;font-size:${Math.round(size * .42)}px">${esc(d.chu)}</span>`;
const nutPhang = (d, kieu) => {
  // kieu: [nền nút số, chữ nút số, viền nút phụ, chữ nút phụ]
  const [n1, c1, v2, c2] = kieu;
  const chinh = `height:44px;border-radius:2px;background:${n1};color:${c1};border:1px solid ${n1};font-size:13.5px;font-weight:600;letter-spacing:.03em`;
  const phu = `height:40px;border-radius:2px;background:transparent;color:${c2};border:1px solid ${v2};font-size:13px;font-weight:600`;
  return `<div style="display:grid;gap:8px">${telSang(d, chinh)}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${zaloSang(d, phu)}${luuSang(d, phu)}</div></div>`;
};

Object.assign(S, {
  s4: ['TIẾT CHẾ 1 · Kiểu Sotheby\'s: ảnh Cam Lâm thật trên đầu, nền trắng, chữ có chân, nút xanh đậm phẳng', (d) => `<div style="background:#fff;color:#111827;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden">
    <div style="height:120px;background:url(/bai-dai/hero.webp) center 62%/cover"></div>
    <div style="padding:18px 20px 16px">
      <div style="font-size:10px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:#6b7280">Người đăng tin</div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:10px">${avNhe(d, 46, '#0A2540', '#fff')}
        <div style="min-width:0"><div style="${SERIF};font-weight:600;font-size:19px;line-height:1.25">${esc(d.ten)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">Tham gia ${esc(d.thamGia)} · ${esc(d.soTin)} tin đang đăng</div></div></div>
      <div style="height:1px;background:#e5e7eb;margin:16px 0"></div>
      ${nutPhang(d, ['#0A2540', '#fff', '#d1d5db', '#111827'])}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:11px;color:#9ca3af"><span>Mã tin ${esc(d.ma)} · ${esc(d.dang)}</span>${d.trang ? `<a href="${esc(d.trang)}" style="color:#0A2540;font-weight:600;font-size:12px;border-bottom:1px solid #0A2540">Trang cá nhân</a>` : ''}</div>
    </div></div>`],

  s5: ['TIẾT CHẾ 2 · Xanh đậm phẳng: không ảnh, một đường kẻ vàng mảnh, nút trắng', (d) => `<div style="background:#0A2540;color:#fff;border-radius:4px;padding:22px 20px 16px">
    <div style="display:flex;align-items:center;gap:14px">${avNhe(d, 52, 'rgba(255,255,255,.1)', '#fff')}
      <div style="min-width:0"><div style="font-size:10px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:#C8A14B">Người đăng tin</div>
      <div style="${SERIF};font-weight:600;font-size:20px;line-height:1.25;margin-top:3px">${esc(d.ten)}</div>
      <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:2px">Tham gia ${esc(d.thamGia)} · ${esc(d.soTin)} tin</div></div></div>
    <div style="height:1px;background:#C8A14B;opacity:.55;margin:18px 0"></div>
    ${nutPhang(d, ['#fff', '#0A2540', 'rgba(255,255,255,.3)', '#fff'])}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:11px;color:rgba(255,255,255,.45)"><span>Mã tin ${esc(d.ma)} · ${esc(d.xem)} lượt xem</span>${d.trang ? `<a href="${esc(d.trang)}" style="color:#fff;font-weight:600;font-size:12px;border-bottom:1px solid rgba(255,255,255,.5)">Trang cá nhân</a>` : ''}</div>
  </div>`],

  s6: ['TIẾT CHẾ 3 · Kiểu tạp chí: không khung, chỉ kẻ trên dưới, chữ to, nút đen', (d) => `<div style="background:#fff;color:#0f0f0f;border-top:2px solid #0f0f0f;border-bottom:1px solid #e5e5e5;padding:16px 2px 14px">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:10px;font-weight:700;letter-spacing:.24em;text-transform:uppercase">Liên hệ</span><span style="font-size:11px;color:#8a8a8a">Mã tin ${esc(d.ma)}</span></div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:14px">${avNhe(d, 56, '#efefef', '#0f0f0f')}
      <div style="min-width:0"><div style="${SERIF};font-weight:600;font-size:22px;line-height:1.2">${esc(d.ten)}</div>
      <div style="font-size:12px;color:#737373;margin-top:3px">${esc(d.soTin)} tin đang đăng · tham gia ${esc(d.thamGia)}</div></div></div>
    <div style="margin-top:16px">${nutPhang(d, ['#0f0f0f', '#fff', '#d4d4d4', '#0f0f0f'])}</div>
    ${d.trang ? `<a href="${esc(d.trang)}" style="display:inline-flex;align-items:center;gap:3px;margin-top:12px;font-size:12.5px;font-weight:600;color:#0f0f0f">Xem trang cá nhân ${I.phai}</a>` : ''}
  </div>`],
});

// ── MẪU 107 — CHÉP SÁT khung liên hệ của batdongsan.com.vn (chủ dự án yêu cầu 5/10/2026).
//    Đặc điểm của họ: thẻ trắng viền xám rất nhạt, KHÔNG bóng đổ, ảnh đại diện 52px giữa,
//    "Được đăng bởi" xám nhỏ, tên đậm vừa, link "Xem thêm N tin khác"; nút số xanh ngọc #009BA1
//    cao 48px bo 8px, nút Zalo trắng viền xám cùng cỡ; phông Lexend.
const LEXEND = `font-family:'Lexend',Inter,system-ui,sans-serif`;
Object.assign(S, {
  s7: ['GIỐNG BATDONGSAN.COM.VN · thẻ trắng viền nhạt, ảnh giữa, nút số xanh ngọc, nút Zalo trắng', (d) => {
    const nut = `height:48px;border-radius:8px;font-size:15px;font-weight:500;${LEXEND};gap:8px`;
    return `<div style="background:#fff;color:#2c2c2c;border:1px solid #f2f2f2;border-radius:8px;padding:16px;text-align:center;${LEXEND}">
    <div style="display:flex;justify-content:center">${d.anh ? `<img src="${esc(d.anh)}" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover">` : `<span style="width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#f2f2f2;color:#505050;font-size:20px;font-weight:500">${esc(d.chu)}</span>`}</div>
    <div style="margin-top:8px;font-size:12px;color:#999">Được đăng bởi</div>
    <div style="margin-top:2px;font-size:16px;font-weight:500;line-height:24px">${esc(d.ten)}</div>
    ${d.trang ? `<a href="${esc(d.trang)}" style="display:inline-block;margin-top:2px;font-size:12px;color:#505050">Xem thêm ${esc(d.soTin)} tin khác</a>` : `<div style="margin-top:2px;font-size:12px;color:#505050">${esc(d.soTin)} tin đang đăng</div>`}
    <div style="display:grid;gap:8px;margin-top:16px">
      ${d.soDu
        ? `<a class="b" href="tel:${esc(d.soDu.replace(/\s/g, ''))}" style="${nut};background:#009ba1;color:#fff;border:1px solid #009ba1">${I.tel}<span>${esc(d.soDu)}</span></a>`
        : `<button type="button" class="b" data-act="hien" style="${nut};background:#009ba1;color:#fff;border:1px solid #009ba1">${I.tel}<span>${esc(d.so)}</span><span style="font-weight:400">· Hiện số</span></button>`}
      <a class="b" href="${esc(d.zalo)}" target="_blank" rel="noreferrer" style="${nut};background:#fff;color:#2c2c2c;border:1px solid #ccc"><span style="color:#0068ff;display:inline-grid">${I.zalo}</span><span>Chat qua Zalo</span></a>
      <button type="button" class="b" data-act="luu" style="${nut};background:#fff;color:${d.daLuu ? '#e03c31' : '#2c2c2c'};border:1px solid #ccc">${I.tim(d.daLuu)}<span>${d.daLuu ? 'Đã lưu tin' : 'Lưu tin'}</span></button>
    </div></div>`;
  }],
});
export const DS_MAU: { n: number; l: string; c: string }[] = [];
{ let k = 0; for (const l in L) for (const c in C) DS_MAU.push({ n: ++k, l, c }); }
for (const l in S) DS_MAU.push({ n: DS_MAU.length + 1, l, c: '' }); // 101–103 = 3 mẫu sang, 104–106 = 3 mẫu tiết chế, 107 = giống batdongsan.com.vn
export const CSS_MAU = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,500&family=Lexend:wght@400;500&display=swap&subset=vietnamese');
.mlh .kim{background:${VANG};background-size:220% 100%;animation:mlhKim 7s ease-in-out infinite}@keyframes mlhKim{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.mlh .b{display:flex;align-items:center;justify-content:center;gap:6px;height:40px;padding:0 12px;border-radius:6px;font-size:13.5px;font-weight:700;white-space:nowrap;transition:filter .15s,opacity .15s}
.mlh .b:hover{filter:brightness(1.08)}.mlh button{cursor:pointer;background:none;border:0;padding:0;font:inherit}.mlh button.b{border-style:solid}
.mlh a{text-decoration:none}`;
export interface DuLieuLienHe { ten: string; chu: string; anh?: string; thamGia: string; soTin: string | number; trang?: string; so: string; soDu?: string | null; zalo: string; daLuu: boolean; ma: string; dang: string; xem: string; gia: string; dt: string }
export function moTaMau(n: number) { const m = DS_MAU[n - 1]; if (!m) return ''; return m.c ? `${L[m.l][0]} · Màu: ${C[m.c][0]}` : S[m.l][0]; }
export function htmlMau(n: number, d: DuLieuLienHe) { const m = DS_MAU[n - 1]; if (!m) return ''; return m.c ? L[m.l][1](d, C[m.c][1]) : S[m.l][1](d); }
