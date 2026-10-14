// Cần puppeteer-core (KHÔNG có trong package của dự án): cài vào thư mục nháp riêng: npm init -y && npm install puppeteer-core@23.11.1
// rồi chép file này sang đó chạy: node chup.mjs <lng> <lat> <tên ảnh> [mobile|desktop|ca-hai]  (bản thử giao diện chạy ở cổng 3000)
// Chụp ẢNH THỬ trang bản đồ (bản thử cổng 3000) khi bấm vào một thửa — Chrome chạy ngầm, không cần cửa sổ.
// Dùng: node chup.mjs <lng> <lat> <ten_anh_khong_duoi> [mobile|desktop|ca-hai]
import puppeteer from 'puppeteer-core';
const [lng, lat] = [Number(process.argv[2]), Number(process.argv[3])];
const ten = process.argv[4];
const kieu = process.argv[5] || 'ca-hai';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-first-run', '--disable-extensions', '--lang=vi-VN'],
});
async function chup(mobile) {
  const page = await browser.newPage();
  if (mobile) await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  else await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1 });
  await page.goto('http://localhost:3000/map', { waitUntil: 'networkidle2', timeout: 180000 }).catch(() => {});
  await page.waitForFunction(() => (window).__banDo && (window).__banDo.loaded(), { timeout: 120000 });
  // tắt khung "Cài Cam Lâm Land vào máy" nếu có
  await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/^\s*[×✕]\s*$/.test(b.textContent || '') && b.closest('[class*="fixed"]')) b.click(); });
  await page.evaluate(([x, y]) => { (window).__banDo.jumpTo({ center: [x, y], zoom: 18.3 }); }, [lng, lat]);
  await new Promise((r) => setTimeout(r, 4000));
  await page.waitForFunction(() => (window).__banDo.loaded(), { timeout: 60000 }).catch(() => {});
  const pt = await page.evaluate(([x, y]) => { const m = (window).__banDo; const p = m.project([x, y]); const r = m.getContainer().getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, [lng, lat]);
  if (mobile) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
  await page.waitForFunction(() => document.body.innerText.includes('Thông tin thửa'), { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3500));
  const duong = `${ten}-${mobile ? 'dien-thoai' : 'may-tinh'}.png`;
  await page.screenshot({ path: duong });
  const chu = await page.evaluate(() => document.body.innerText.match(/Thông tin thửa[\s\S]{0,700}/)?.[0] || '(không thấy bảng)');
  console.log('==', duong, '\n', chu.replace(/\n+/g, ' | ').slice(0, 600));
  await page.close();
}
if (kieu !== 'mobile') await chup(false);
if (kieu !== 'desktop') await chup(true);
await browser.close();
