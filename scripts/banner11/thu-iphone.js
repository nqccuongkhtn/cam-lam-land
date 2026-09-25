// Cài một lần (ngoài dự án): npm i playwright && npx playwright install webkit
// Chạy: node scripts/banner11/thu-iphone.js st-duo,st-b10 1,3   → ảnh ra ../ios/
// Chụp banner trang chủ trên lõi Safari (WebKit), giả lập iPhone có tai thỏ.
// Dùng: node chup.js st-duo,st-b10 [nhịp giây, vd 1,3,6]
const { webkit, devices } = require('playwright');
const lops = (process.argv[2] || 'st-duo').split(',');
const nhip = (process.argv[3] || '1,3,6').split(',').map(Number);
const RA = __dirname + '/../ios/';
require('fs').mkdirSync(RA, { recursive: true });
// Safari trên Windows không có tai thỏ → giả lập bằng CSS: env(safe-area-inset-top)=47px
const TAI = `
  .cl-b11 .banner{--dinh:103px!important}
  header{padding-top:47px!important}
  .cl-b11 .st-depth > .fill-svg{top:39px!important;height:calc(100% - 39px)!important}
  .cl-b11 .banner{height:calc(103px + 100vw * 0.37)!important}
`;
(async () => {
  const b = await webkit.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  await p.goto('http://localhost/?ios=' + Date.now(), { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: TAI });
  const them = require('fs').existsSync(__dirname + '/them.css') ? require('fs').readFileSync(__dirname + '/them.css', 'utf8') : '';
  if (them) await p.addStyleTag({ content: them });
  // chặn tự chuyển mẫu
  await p.evaluate(() => { const g = window.setTimeout; window.setTimeout = (f, t, ...a) => (t >= 6000 ? 0 : g(f, t, ...a)); });
  for (const lop of lops) {
    for (let i = 0; i < 22; i++) {
      const ten = await p.evaluate(() => { const bs = [...document.querySelectorAll('.cl-b11 .banner')]; return bs[bs.length - 1].className; });
      if (ten.split(' ').includes(lop.split('.')[0]) && (!lop.includes('.') || ten.includes(lop.split('.')[1]))) break;
      await p.evaluate(() => document.querySelector('button[aria-label="Mẫu sau"]').click());
      await p.waitForTimeout(900);
    }
    let t0 = 0;
    for (const t of nhip) {
      await p.waitForTimeout((t - t0) * 1000); t0 = t;
      await p.screenshot({ path: `${RA}${lop}-${t}s.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
    }
    console.log('xong', lop);
  }
  await b.close();
})();
