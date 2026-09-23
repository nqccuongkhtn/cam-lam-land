'use client';
/* ============================================================================
 *  BANNER SLIDE Ở ĐẦU TRANG CHỦ — 11 MẪU ĐỘNG DO CHỦ DỰ ÁN THIẾT KẾ
 * ----------------------------------------------------------------------------
 *  Mỗi mẫu là một banner hoàn chỉnh (ảnh + chữ + nút + hiệu ứng riêng), chạy
 *  hết một vòng rồi tự chuyển sang mẫu sau.
 *
 *  ⚠️ MỖI LÚC CHỈ DỰNG ĐÚNG MỘT MẪU trong trang, không dựng sẵn cả 11.
 *  Lý do: 11 mẫu này rất nặng (ảnh lớn, canvas hạt sáng, hàng trăm hiệu ứng).
 *  Dựng hết cùng lúc thì điện thoại giật và tốn mạng vô ích — mà 90% người xem
 *  đang dùng điện thoại. Mẫu sau chỉ được TẢI TRƯỚC PHẦN ẢNH, chưa dựng hình.
 *
 *  MÃ ĐIỀU KHIỂN bên dưới là bản chuyển từ chính file thiết kế gốc sang React,
 *  giữ nguyên cách chạy: bộ lập lịch theo mốc thời gian (`data-at`), hạt sáng
 *  bay lên vẽ bằng canvas, thẻ kính dịch theo chuột.
 *
 *  BỐN CHỖ TỰ TẮT CHO ĐỠ TỐN PIN — đừng bỏ:
 *   · máy đặt "giảm chuyển động" → đứng yên hoàn toàn;
 *   · chuyển sang tab khác → dừng;
 *   · banner bị cuộn ra khỏi màn hình → dừng;
 *   · người dùng bấm tạm dừng → dừng.
 * ========================================================================== */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import './banner11.css';
import './banner11-them.css';
import { MAU_BANNER } from './mauBanner';
import { HINH_DUNG_CHUNG } from './hinhDungChung';

/* Banner gốc thiết kế ở khổ ngang 1920px. Mọi kích thước bên trong nhân với
   `--u` = bề ngang thật / 1920, nên banner co giãn mà bố cục không vỡ. */
const KHO_GOC = 1920;

/* ── Bộ lập lịch: bật hiệu ứng theo đúng mốc thời gian ghi trong `data-at` ── */
class LichChay {
  b: HTMLElement;
  gio: number[] = [];
  muc: HTMLElement[];
  constructor(b: HTMLElement) {
    this.b = b;
    this.muc = [...b.querySelectorAll<HTMLElement>('[data-at]')];
  }
  chay(hooks: Record<string, (el: HTMLElement, b: HTMLElement) => void>) {
    this.dung();
    this.muc.forEach((el) => el.classList.remove('go', 'out', 'focus'));
    void this.b.offsetWidth;                       // ép trình duyệt vẽ lại từ đầu
    const dai = +(this.b.dataset.cycle || 9000);
    const vong = (lanDau: boolean) => {
      this.muc.forEach((el) => {
        const chiMotLan = el.hasAttribute('data-once');
        if (chiMotLan && !lanDau) return;
        if (!chiMotLan) el.classList.remove('go', 'out');
        (el.dataset.at || '').split(',').forEach((at) => {
          this.gio.push(window.setTimeout(() => this.bat(el, hooks), +at));
        });
        if (el.dataset.out) this.gio.push(window.setTimeout(() => el.classList.add('out'), +el.dataset.out));
      });
      this.gio.push(window.setTimeout(() => vong(false), dai));
    };
    vong(true);
  }
  bat(el: HTMLElement, hooks: Record<string, (el: HTMLElement, b: HTMLElement) => void>) {
    el.classList.remove('go', 'out');
    void el.getBoundingClientRect();
    el.classList.add('go');
    (el.dataset.hook || '').split(' ').forEach((n) => hooks[n] && hooks[n](el, this.b));
    el.querySelectorAll<HTMLElement>('.count-txt').forEach((t) => hooks.countTxt(t, this.b));
  }
  dung() { this.gio.forEach(clearTimeout); this.gio = []; }
}

/* ── Hạt sáng bay lên, vẽ bằng canvas (mẫu 2 và 11) ──────────────────────── */
class HatSang {
  c: HTMLCanvasElement; x: CanvasRenderingContext2D | null;
  p: any[] = []; on = false; raf = 0; w = 0; h = 0; k = 1; max = 60;
  last = 0; t0 = 0; x0: number; x1: number; sprite: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    this.c = canvas; this.x = canvas.getContext('2d');
    this.x0 = parseFloat(canvas.dataset.x0 || '0.23');
    this.x1 = parseFloat(canvas.dataset.x1 || '1');
    const s = document.createElement('canvas'); s.width = s.height = 64;
    const g = s.getContext('2d')!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.1, 'rgba(255,252,245,.95)');
    r.addColorStop(.28, 'rgba(255,238,215,.38)'); r.addColorStop(.6, 'rgba(255,228,200,.08)');
    r.addColorStop(1, 'rgba(255,228,200,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); this.sprite = s;
  }
  doLai() {
    if (!this.x) return;
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.c.clientWidth; this.h = this.c.clientHeight; this.k = this.h / 560;
    this.c.width = Math.round(this.w * d); this.c.height = Math.round(this.h * d);
    this.x.setTransform(d, 0, 0, d, 0, 0);
    // Màn nhỏ thì ít hạt lại cho đỡ tốn máy
    const thua = this.w < 640 ? 7000 : 4000;
    this.max = Math.max(24, Math.min(200, Math.round(this.w * (this.x1 - this.x0) * this.h / thua)));
  }
  tao(uom: boolean) {
    const r = Math.random(), loai = r < .7 ? 0 : r < .95 ? 1 : 2;
    const co = loai === 0 ? 6 + Math.random() * 4 : loai === 1 ? 11 + Math.random() * 7 : 22 + Math.random() * 12;
    return {
      loai, x: (this.x0 + Math.random() * (this.x1 - this.x0)) * this.w,
      y: uom ? Math.random() * this.h : this.h + Math.random() * this.h * .1,
      vy: (38 + Math.random() * 12) * this.k * (loai === 0 ? .7 + Math.random() * .5 : 1),
      dx: (Math.random() - .5) * 10 * this.k, size: co * this.k,
      a: loai === 0 ? .6 + Math.random() * .4 : .8 + Math.random() * .2,
      pha: Math.random() * 1.25, spd: .7 + Math.random() * .7, tran: this.h * Math.random() * .3,
    };
  }
  nhay(t: number) {
    const f = (t % 1.25) * 24;
    if (f < 2) return .3077 + .1539 * f;
    if (f < 3) return .6154 - .1515 * (f - 2);
    if (f < 4) return .4639 + 1.1387 * (f - 3);
    if (f < 5) return 1.6026 - .6229 * (f - 4);
    if (f < 6) return .9797;
    return .3569;
  }
  batDau() {
    if (this.on || !this.x) return;
    this.on = true; this.doLai();
    this.p = []; for (let i = 0; i < this.max; i++) this.p.push(this.tao(true));
    this.last = performance.now(); this.t0 = this.last;
    const lap = (t: number) => { if (!this.on) return; this.buoc(t); this.raf = requestAnimationFrame(lap); };
    this.raf = requestAnimationFrame(lap);
  }
  dung() { this.on = false; cancelAnimationFrame(this.raf); if (this.w && this.x) this.x.clearRect(0, 0, this.w, this.h); }
  buoc(t: number) {
    const x = this.x!; const dt = Math.min(.05, (t - this.last) / 1000); this.last = t;
    x.clearRect(0, 0, this.w, this.h);
    const hienDan = Math.min(1, (t - this.t0) / 900);
    const dai = this.h * .1; x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.p.length; i++) {
      let q = this.p[i]; q.y -= q.vy * dt; q.x += q.dx * dt; q.pha += dt * q.spd;
      if (q.y < q.tran - 4 || q.x < -20 || q.x > this.w + 20) q = this.p[i] = this.tao(false);
      const vao = Math.min(1, (this.h - q.y) / dai + .15);
      const ra = Math.min(1, Math.max(0, (q.y - q.tran) / dai));
      const tw = this.nhay(q.pha);
      const a = q.a * vao * ra * hienDan * Math.min(1, .45 + tw * .55);
      if (a <= .01) continue;
      const d = q.size * (q.loai === 0 ? .8 + tw * .25 : .7 + tw * .35);
      x.globalAlpha = a; x.drawImage(this.sprite, q.x - d / 2, q.y - d / 2, d, d);
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
}

/* ── Lấy mọi đường dẫn ảnh trong một mẫu, để tải trước ────────────────────── */
function anhCuaMau(html: string): string[] {
  const ra = new Set<string>();
  for (const m of html.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) ra.add(m[1]);
  for (const m of html.matchAll(/href=["']([^"']+\.(?:webp|png|jpg|jpeg))["']/g)) ra.add(m[1]);
  return [...ra].filter((u) => u.startsWith('/') || /^https?:/.test(u));
}

/* ── Bỏ bớt lớp ảnh nặng khi màn hình nhỏ ───────────────────────────────────
   Mẫu 19 xếp BA TẦNG ảnh bản đồ chồng lên nhau để phóng từ toàn cảnh Cam Lâm
   vào một thửa đất mà tầng nào cũng nét. Ba tầng đó nặng gần 800 KB — trên máy
   tính thì không sao, nhưng trên điện thoại dùng 3G/4G là chờ rất lâu, mà màn
   hình bé cũng chẳng nhìn ra khác biệt.
   Nên với màn dưới 761px: bỏ hai tầng sâu, chỉ giữ tầng toàn cảnh (tiết kiệm
   ~640 KB), và CSS hạ độ phóng xuống cho vừa với một tầng ảnh. */
const LOP_NANG = /<g class="m19-l[23]"[\s\S]*?<\/g><\/g>/g;
function lamNhe(html: string, hep: boolean): string {
  return hep ? html.replace(LOP_NANG, '') : html;
}

/* ── Khung chứa mã HTML của một mẫu banner ────────────────────────────────────
   ⚠️ PHẢI TÁCH RA RIÊNG VÀ BỌC `memo`. Đã vấp lỗi rất khó tìm: trang chủ có vài
   thứ tự cập nhật theo giây (dòng chữ gợi ý gõ trong ô tìm kiếm…), mỗi lần đó là
   React dựng lại thẻ này, tức XOÁ SẠCH RUỘT BANNER rồi đặt lại cái mới. Hậu quả:
   mọi thứ phần chạy hiệu ứng vừa gắn vào (cỡ chữ theo bề ngang, các lớp hiệu ứng
   đang chạy, canvas hạt sáng) bị mất ngay sau đó — banner đứng im và TRỐNG TRƠN,
   mà không hề có lỗi nào hiện ra. Bọc `memo` thì chỉ khi ĐỔI MẪU nó mới dựng lại. */
const RuotBanner = memo(
  function RuotBanner({ html, lop, nhan }: { html: string; lop: string; nhan: (el: HTMLDivElement | null) => void }) {
    return (
      <div
        ref={nhan}
        className={lop}
        /* Mã của mẫu banner là chuỗi HTML cố định do chính dự án viết ra,
           không phải nội dung người dùng nhập — nên dựng thẳng như vậy an toàn. */
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
  (truoc, sau) => truoc.html === sau.html && truoc.lop === sau.lop,
);

export default function Banner11({ children }: { children?: React.ReactNode }) {
  const [chiSo, setChiSo] = useState(0);
  /* Màn hình hẹp (điện thoại) → bỏ bớt lớp ảnh nặng, xem lamNhe() ở trên. */
  const [hep, setHep] = useState(false);
  useEffect(() => {
    const do_ = () => setHep(window.innerWidth < 761);
    do_();
    window.addEventListener('resize', do_);
    return () => window.removeEventListener('resize', do_);
  }, []);
  /* Không còn nút tạm dừng trên giao diện (chủ dự án muốn tối giản hết mức).
     Vẫn giữ biến này vì banner còn tự dừng khi chuyển sang tab khác hoặc khi bị
     cuộn ra khỏi màn hình — đó là phần tiết kiệm pin, đừng gỡ. */
  const [tamDung] = useState(false);
  const [it, setIt] = useState(false);        // máy đặt "giảm chuyển động"
  /* ⚠️ DÙNG STATE CHỨ KHÔNG DÙNG useRef để giữ thẻ bọc banner.
     Đã vấp: với useRef + `key` đổi mỗi lần sang mẫu, có lúc hiệu ứng chạy trước
     khi thẻ kịp gắn vào trang → `boc.current` còn rỗng → thoát ra ngay, banner
     đứng im và trống trơn, mà KHÔNG báo lỗi gì cả (mất cả buổi mới tìm ra).
     Dùng state thì lúc thẻ gắn vào trang React tự chạy lại, không hụt lần nào. */
  const [boc, setBoc] = useState<HTMLDivElement | null>(null);
  const hen = useRef<number>(0);
  /* Hai mũi tên chuyển mẫu chỉ hiện khi CHUỘT ĐANG DI CHUYỂN trong banner.
     Chuột đứng im 1,6 giây là ẩn đi — để banner sạch hết mức. */
  const [hienNut, setHienNut] = useState(false);
  /* Mẫu ĐANG TRƯỢT RA. Giữ nó lại trong trang thêm một nhịp để hai mẫu cùng
     chạy ngang qua nhau — có vậy mới ra động tác "lướt". Xong thì bỏ. */
  const [dangRa, setDangRa] = useState<number | null>(null);
  /* Đang đụng vào ô tìm kiếm (rê chuột vào hoặc đang gõ). Lúc đó ô tìm kiếm rõ
     hẳn lên còn banner mờ xuống, để người dùng tập trung vào việc tìm. */
  const [dangTim, setDangTim] = useState(false);
  const [huongLuot, setHuongLuot] = useState(1);
  const henRa = useRef<number>(0);
  const henNut = useRef<number>(0);
  const [coChamTay, setCoChamTay] = useState(false);
  useEffect(() => {
    /* Máy cảm ứng không có chuột nên không bao giờ có sự kiện rê chuột →
       phải cho hiện sẵn, nếu không người dùng điện thoại không đổi mẫu được. */
    setCoChamTay(window.matchMedia?.('(hover: none)').matches ?? false);
  }, []);
  /* Chuột đang nằm TRÊN chính hai mũi tên → không được đếm giờ ẩn. Người dùng
     rê tới nút rồi giữ yên để bấm, mà nút biến mất dưới con trỏ thì rất khó
     chịu. Chỉ đếm giờ khi chuột ở CHỖ KHÁC trong banner. */
  const treNut = useRef(false);
  const reChuot = useCallback(() => {
    setHienNut(true);
    clearTimeout(henNut.current);
    if (treNut.current) return;
    henNut.current = window.setTimeout(() => setHienNut(false), 1600);
  }, []);
  const vaoNut = useCallback(() => {
    treNut.current = true;
    clearTimeout(henNut.current);
    setHienNut(true);
  }, []);
  const roiNut = useCallback(() => {
    treNut.current = false;
    clearTimeout(henNut.current);
    henNut.current = window.setTimeout(() => setHienNut(false), 1600);
  }, []);

  const mau = MAU_BANNER[chiSo];
  const sang = useCallback((i: number) => {
    setChiSo((cu) => {
      const moi = (i + MAU_BANNER.length) % MAU_BANNER.length;
      if (moi === cu) return cu;
      /* Đi tới hay đi lui: tính theo đường ngắn nhất để mũi tên "‹" luôn trượt
         ngược chiều với "›", kể cả lúc vòng từ mẫu cuối về mẫu đầu. */
      const tien = (moi - cu + MAU_BANNER.length) % MAU_BANNER.length;
      setHuongLuot(tien <= MAU_BANNER.length / 2 ? 1 : -1);
      setDangRa(cu);
      return moi;
    });
  }, []);
  /* Dọn mẫu cũ sau khi trượt xong. Đúng bằng thời lượng hiệu ứng trong CSS. */
  useEffect(() => {
    if (dangRa === null) return;
    clearTimeout(henRa.current);
    henRa.current = window.setTimeout(() => setDangRa(null), 660);   // khớp với thời lượng hiệu ứng trượt trong CSS
    return () => clearTimeout(henRa.current);
  }, [dangRa, chiSo]);
  const khongGan = useCallback(() => {}, []);

  useEffect(() => { setIt(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false); }, []);

  /* ── Tải trước ảnh của mẫu KẾ TIẾP, để lúc chuyển không bị trắng một nhịp ──
     ⚠️ KHÔNG tải trước khi máy đang tiết kiệm dữ liệu hoặc mạng yếu (2G/3G).
     Phần lớn người xem dùng điện thoại, nhiều người dùng 3G hoặc gói dữ liệu
     hạn chế — tải sẵn cả tấm ảnh mà họ có thể không xem tới là phí tiền của họ.
     Mạng yếu thì đành chờ một nhịp lúc đổi mẫu, đổi lại không tốn dữ liệu. */
  useEffect(() => {
    const mang = (navigator as any).connection;
    const tietKiem = mang?.saveData === true;
    const mangYeu = /^(slow-)?2g$|^3g$/.test(mang?.effectiveType || '');
    if (tietKiem || mangYeu) return;
    const sau = MAU_BANNER[(chiSo + 1) % MAU_BANNER.length];
    const id = window.setTimeout(() => { anhCuaMau(sau.html).forEach((u) => { const im = new Image(); im.src = u; }); }, 1200);
    return () => clearTimeout(id);
  }, [chiSo]);

  /* ── Dựng và chạy mẫu đang hiện ──────────────────────────────────────────── */
  useEffect(() => {
    const khung = boc;
    if (!khung) return;
    const b = khung.querySelector<HTMLElement>('.banner');
    if (!b) return;

    /* ── Cỡ chữ, cỡ nút… đều nhân theo `--u` = bề ngang thật / 1920 ──────────
       ⚠️ PHẢI ĐẶT NGAY TẠI ĐÂY, đừng chỉ trông vào ResizeObserver. Trình duyệt
       KHÔNG chạy ResizeObserver khi tab đang ẩn — mà người dùng hay mở link ra
       tab nền rồi lát sau mới bấm sang. Lúc đó `--u` còn bằng 1, tức banner giữ
       nguyên cỡ thiết kế 1920px trong cái khung chỉ 1248px: chữ to quá khổ,
       nút và số điện thoại bị cắt mất. Đã vấp đúng lỗi này. */
    let doHen = 0;
    const doLaiCo = () => {
      /* Đo bằng getBoundingClientRect chứ KHÔNG dùng clientWidth: ở tab đang ẩn
         clientWidth trả về 0 (đã đo thật), còn getBoundingClientRect ép trình
         duyệt tính bố cục nên ra số đúng. */
      const o = b.getBoundingClientRect();
      const w = Math.round(o.width) || b.clientWidth, h = Math.round(o.height) || 1;
      /* ⚠️ Bề ngang ra 0 là CHUYỆN THẬT, không phải lỗi: trang mở trong tab đang
         ẩn thì trình duyệt bỏ qua việc tính bố cục, mọi kích thước đều bằng 0.
         Bỏ qua luôn thì banner giữ cỡ thiết kế 1920px, lúc người dùng bấm sang
         tab là thấy chữ to quá khổ, nút và số điện thoại bị cắt mất.
         Nên phải hẹn đo lại — dùng setTimeout chứ KHÔNG dùng
         requestAnimationFrame, vì tab ẩn thì requestAnimationFrame không chạy. */
      if (!w) { clearTimeout(doHen); doHen = window.setTimeout(doLaiCo, 250); return; }
      /* ── CỠ CHỮ, CỠ NÚT CỦA MẪU ────────────────────────────────────────
         `--u` là hệ số nhân cho mọi kích thước bên trong mẫu.
         Bình thường `--u` = bề ngang / 1920 (đúng khổ thiết kế). Nhưng banner
         nay đã được hạ thấp (cắt phần trống ở đáy) nên chữ và nút của bản thiết
         kế trông to quá so với khung → nhân thêm một hệ số cho nhỏ lại vừa mắt.
         Điện thoại KHÔNG nhân (để 1): ở màn nhỏ bản thiết kế đã có bố cục riêng,
         chữ vốn đã nhỏ, thu thêm nữa là không đọc được. */
      const rongMh = window.innerWidth;
      const tiLeChu = rongMh >= 1101 ? 0.76 : rongMh >= 761 ? 0.84 : 1;
      b.style.setProperty('--u', String((w / KHO_GOC) * tiLeChu));
      /* ⚠️ GẮN VÀO THẺ BANNER, KHÔNG gắn vào thẻ bọc ngoài.
         Thẻ bọc ngoài do React dựng: mỗi lần React vẽ lại (vd lúc đổi mẫu, thẻ
         cũ được đổi class để trượt ra) là nó GHI ĐÈ class, mọi lớp mình gắn
         thêm bằng mã chạy đều bay mất. Mất `san-sang` thì toàn bộ chữ trong
         banner bị ẩn → đúng cái lỗi "mẫu cũ trượt ra chỉ còn khung trống". */
      b.classList.add('san-sang');

      /* Điện thoại: vài mẫu khai sẵn khung cắt ảnh riêng (data-vbm) để chủ thể
         nằm phía trên, không bị khối chữ che. Không đổi thì trên màn nhỏ chỉ
         thấy nửa cái thuyền, nửa cái nhà. */
      const manNho = window.innerWidth <= 760;
      b.querySelectorAll<SVGElement>('svg[data-vbm]').forEach((sv) => {
        if (!sv.dataset.vbGoc) sv.dataset.vbGoc = sv.getAttribute('viewBox') || '';
        sv.setAttribute('viewBox', manNho ? (sv.dataset.vbm || '') : sv.dataset.vbGoc);
      });

      if (b.classList.contains('st-duo')) {
        b.style.setProperty('--du-skew', (-Math.atan(.14 * w / h) * 180 / Math.PI).toFixed(2) + 'deg');
      }
      hat?.on && hat.doLai();
    };
    const ro = new ResizeObserver(doLaiCo);

    const hooks: Record<string, any> = {
      /* đếm số nhảy dần trong chữ SVG (mẫu 10) */
      countTxt: (t: HTMLElement) => {
        const dich = +(t.dataset.count || 0), truoc = t.dataset.pre || '', sau = t.dataset.suf || '';
        const t0 = performance.now();
        const nhip = (n: number) => {
          const p = Math.min(1, (n - t0) / 1100), e = 1 - Math.pow(1 - p, 3);
          t.textContent = truoc + Math.round(dich * e) + sau;
          if (p < 1) requestAnimationFrame(nhip);
        };
        requestAnimationFrame(nhip);
      },
      /* chạy lại chấm di chuyển theo đường (mẫu 16) */
      motion: (el: HTMLElement) => {
        const m = el.querySelector('animateMotion') as any;
        if (m && m.beginElement) { try { m.beginElement(); } catch { /* trình duyệt cũ */ } }
      },
      /* lần lượt đưa một tấm polaroid lên trước (mẫu 6) */
      polfocus: (_el: HTMLElement, bb: any) => {
        const the = [...bb.querySelectorAll('.pol')] as HTMLElement[];
        if (!the.length) return;
        bb._pf = ((bb._pf ?? -1) + 1) % the.length;
        the.forEach((c) => c.classList.remove('focus'));
        const c = the[bb._pf]; c.classList.add('focus');
        setTimeout(() => c.classList.remove('focus'), 2200);
      },
    };

    if (it) b.classList.add('static');   // máy đặt "giảm chuyển động"
    const lich = new LichChay(b);
    const cv = b.querySelector<HTMLCanvasElement>('.fireflies');
    const hat = cv ? new HatSang(cv) : null;

    /* Thẻ kính dịch theo chuột (mẫu 9) — điện thoại không có chuột nên bỏ qua */
    let rafPx = 0, tx = 0, ty = 0, cx = 0, cy = 0, lanCuoi = -1e9;
    const theoChuot = (e: PointerEvent) => {
      const r = b.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - .5) * 2;
      ty = ((e.clientY - r.top) / r.height - .5) * 2;
      lanCuoi = performance.now();
    };
    const buocPx = (t: number) => {
      if (t - lanCuoi > 1500) { tx = Math.sin(t / 2600) * .5; ty = Math.cos(t / 3400) * .3; }
      cx += (tx - cx) * .06; cy += (ty - cy) * .06;
      b.style.setProperty('--px', (cx * -26).toFixed(2));
      b.style.setProperty('--py', (cy * -14).toFixed(2));
      rafPx = requestAnimationFrame(buocPx);
    };
    const coParallax = b.classList.contains('st-ui');
    const svgs = [...b.querySelectorAll('svg')] as any[];

    let dangChay = false;
    /* Đã có hiệu ứng nào kịp chạy chưa. Dùng để biết banner có đang trống không. */
    const daHienNoiDung = () => !!b.querySelector('[data-at].go');
    const chay = () => {
      if (dangChay || it) return;
      dangChay = true;
      doLaiCo();                             // đo lại lần nữa cho chắc
      b.classList.remove('static');          // trả lại chế độ chạy hiệu ứng
      b.classList.add('running');
      lich.chay(hooks);
      hat?.batDau();
      if (coParallax) { b.addEventListener('pointermove', theoChuot); rafPx = requestAnimationFrame(buocPx); }
      svgs.forEach((s) => s.unpauseAnimations && s.unpauseAnimations());
    };
    const ngung = () => {
      /* ⚠️ ĐỪNG bỏ khối này. Mọi chữ, nút, thẻ trong banner đều bắt đầu ở trạng
         thái TRONG SUỐT rồi mới hiện dần theo hiệu ứng. Nên nếu banner bị dừng
         TRƯỚC KHI hiệu ứng kịp chạy — người dùng mở trang ở tab nền, hoặc cuộn
         qua quá nhanh, hoặc bấm tạm dừng ngay — thì cái nhìn thấy là MỘT Ô TỐI
         RỖNG, trông y như web hỏng. Bật chế độ "đứng yên" thì banner hiện đủ
         nội dung như một tấm banner tĩnh, chỉ không có chuyển động. */
      if (!daHienNoiDung()) b.classList.add('static');
      if (!dangChay) return;
      dangChay = false;
      b.classList.remove('running');
      lich.dung();
      hat?.dung();
      if (coParallax) { b.removeEventListener('pointermove', theoChuot); cancelAnimationFrame(rafPx); }
      svgs.forEach((s) => s.pauseAnimations && s.pauseAnimations());
    };

    doLaiCo();                       // đặt ngay, không chờ ResizeObserver
    ro.observe(b);
    window.addEventListener('resize', doLaiCo);   // phòng khi ResizeObserver bị bỏ qua

    /* Chỉ chạy khi ẢNH ĐÃ VỀ — nếu không, hiệu ứng chạy trên nền trắng rồi mới
       có ảnh, nhìn như banner bị lỗi. Chờ tối đa 6 giây rồi chạy luôn. */
    let choXong = false;
    let muonChay = false;
    const xong = () => {
      if (choXong) return;
      choXong = true;
      b.classList.remove('loading');
      if (muonChay) chay();
    };
    const dsAnh = anhCuaMau(mau.html);
    /* Ảnh của mẫu sau luôn được tải trước (xem phần "tải trước" ở trên), nên
       phần lớn lúc đổi mẫu là ảnh đã nằm sẵn trong máy. Kiểm tra ngay: nếu đủ
       cả rồi thì CHẠY LIỀN, khỏi chờ một nhịp.
       ⚠️ Đừng bỏ đoạn này: chờ một nhịp thì trong lúc mẫu mới trượt vào, chữ và
       nút chưa kịp hiện — người dùng thấy một khung trống trượt ngang qua, đúng
       cái lỗi "hiệu ứng chuyển vẫn lỗi" mà chủ dự án báo. */
    const daCoSan = dsAnh.length > 0 && dsAnh.every((u) => {
      const im = new Image();
      im.src = u;
      return im.complete;
    });
    if (!dsAnh.length || daCoSan) xong();
    else {
      b.classList.add('loading');
      let con = dsAnh.length;
      dsAnh.forEach((u) => {
        const im = new Image();
        im.onload = im.onerror = () => { if (--con === 0) xong(); };
        im.src = u;
      });
      window.setTimeout(xong, 2500);   // xem ghi chú: KHÔNG để lâu hơn vòng chạy của mẫu ngắn nhất (5,7 s)
    }

    /* Cuộn khỏi màn hình thì dừng, cuộn về thì chạy lại.
       ⚠️ ĐỪNG chỉ trông vào IntersectionObserver: tab đang ẩn thì nó cũng không
       chạy, nên `muonChay` mãi là false. Người dùng mở link ra tab nền rồi bấm
       sang xem thì banner đứng im, trống trơn — trông như web hỏng. Nên tự đo
       vị trí bằng tay mỗi khi quay lại tab. */
    const dangThay = () => {
      const r = b.getBoundingClientRect();
      return r.bottom > 0 && r.top < (window.innerHeight || 0);
    };
    const xemLai = () => {
      doLaiCo();        // quay lại tab mới tính được bố cục — đo lại cho đúng cỡ
      muonChay = !document.hidden && dangThay() && !tamDung;
      if (muonChay && choXong) chay(); else if (!muonChay) ngung();
    };
    const io = new IntersectionObserver(xemLai, { threshold: 0.15 });
    io.observe(b);
    document.addEventListener('visibilitychange', xemLai);
    muonChay = !document.hidden && dangThay() && !tamDung;   // đo ngay lần đầu

    if (tamDung) ngung();

    return () => {
      ngung(); clearTimeout(doHen); ro.disconnect(); io.disconnect();
      window.removeEventListener('resize', doLaiCo);
      document.removeEventListener('visibilitychange', xemLai);
    };
  }, [boc, chiSo, tamDung, it, mau.html]);

  /* ── Hết một vòng thì sang mẫu sau ───────────────────────────────────────── */
  useEffect(() => {
    if (tamDung) return;
    const b = boc?.querySelector<HTMLElement>('.banner');
    const dai = +(b?.dataset.cycle || 9000);
    // Máy đặt "giảm chuyển động": banner đứng yên nên cho xem lâu hơn một chút
    const dat = () => { hen.current = window.setTimeout(() => sang(chiSo + 1), it ? 7000 : dai); };
    const go = () => clearTimeout(hen.current);
    /* Sang tab khác thì ngừng đếm giờ: chuyển mẫu lúc không ai nhìn là phí,
       quay lại tab đã trôi mất mấy mẫu. */
    const doiTab = () => (document.hidden ? go() : dat());
    if (!document.hidden) dat();
    document.addEventListener('visibilitychange', doiTab);
    return () => { go(); document.removeEventListener('visibilitychange', doiTab); };
  }, [boc, chiSo, tamDung, it, sang]);

  return (
    <section className="relative" aria-label="Giới thiệu Cam Lâm Land">
      {/* Hình dùng chung cho mọi mẫu (ngôi sao, vầng sáng…). Các mẫu gọi tới nó
          bằng <use href="#star"> — thiếu khối này là đốm sáng mất sạch mà
          KHÔNG báo lỗi gì. Khối svg này rộng 0 cao 0, không hiện gì cả. */}
      <div aria-hidden className="sr-only" dangerouslySetInnerHTML={{ __html: HINH_DUNG_CHUNG }} />
      {/* ── BANNER TRÀN SÁT VIỀN, NẰM DƯỚI THANH MENU ────────────────────────
          Thanh menu của web ở đầu trang vốn trong suốt (chỉ hiện nền khi cuộn
          xuống), nên cho banner chạy lên tận mép trên là menu nằm lồng trong
          banner đúng như ảnh bìa của các trang bất động sản lớn.
          Chặn bề ngang ở 1920px vì bản gốc vẽ trên khổ 1920×620 — rộng hơn nữa
          thì chữ và nút phình to quá cỡ chứ không đẹp thêm. */}
      <div
        className="relative mx-auto w-full max-w-[1920px] overflow-hidden"
        onPointerMove={reChuot}
        onPointerLeave={() => { treNut.current = false; clearTimeout(henNut.current); setHienNut(false); }}
      >
        {/* ── HAI MẪU CÙNG CÓ MẶT LÚC ĐANG LƯỚT ─────────────────────────────
            Mẫu cũ nằm đè lên trên và trượt ra, mẫu mới trượt vào từ phía kia.
            ⚠️ Phải để ĐÚNG `key` là số thứ tự mẫu: nhờ vậy React giữ nguyên thẻ
            của mẫu cũ (giữ luôn mọi hiệu ứng nó đang chạy dở) thay vì dựng lại
            từ đầu — dựng lại thì mẫu cũ hiện ra trống trơn lúc trượt. */}
        {dangRa !== null && dangRa !== chiSo && (
          <RuotBanner
            key={dangRa}
            html={lamNhe(MAU_BANNER[dangRa].html, hep)}
            /* `static` LUÔN bật cho mẫu đang trượt ra: mọi chữ trong mẫu đều
               bắt đầu ở trạng thái trong suốt rồi mới hiện dần, nên nếu không
               ép hiện đủ thì lúc trượt ra nó thành một khung trống trượt ngang
               qua màn hình. */
            lop={`cl-b11 cl-b11-lop-tren ${huongLuot > 0 ? 'cl-b11-ra-trai' : 'cl-b11-ra-phai'}`}
            nhan={khongGan}
          />
        )}
        <RuotBanner
          key={chiSo}
          html={lamNhe(mau.html, hep)}
          lop={`cl-b11 ${huongLuot > 0 ? 'cl-b11-vao-phai' : 'cl-b11-vao-trai'}`}
          nhan={setBoc}
        />

        {/* Vệt tối mỏng ở mép trên: menu chữ trắng, mà nhiều mẫu banner có nền
            sáng ngay chỗ đó → không có vệt này là đọc không ra tên menu. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />

        {/* Vệt tối ở mép DƯỚI — chỉ màn máy tính, vì chỉ ở đó ô tìm kiếm mới nằm
            đè vào trong banner. Không có vệt này thì hàng chữ trắng
            "Nhà đất bán · Cho thuê · Dự án" rơi trúng nền sáng là mất hút. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden h-44 bg-gradient-to-t from-black/60 via-black/25 to-transparent md:block" />

        {/* ── HAI MŨI TÊN CHUYỂN MẪU ───────────────────────────────────────
            Tối giản hết mức: chỉ hai mũi tên nhỏ nép vào hai mép banner, và
            chỉ hiện ra KHI CHUỘT ĐANG DI CHUYỂN trong banner. Chuột đứng im
            1,6 giây hoặc đưa ra ngoài là tự ẩn.
            Máy cảm ứng (điện thoại, máy tính bảng) thì hiện sẵn, vì ở đó không
            bao giờ có sự kiện rê chuột. */}
        {[['trai', -1, '‹'], ['phai', 1, '›']].map(([ben, huong, dau]) => (
          <button
            key={ben as string}
            onClick={() => sang(chiSo + (huong as number))}
            onPointerEnter={vaoNut}
            onPointerLeave={roiNut}
            aria-label={huong === -1 ? 'Mẫu trước' : 'Mẫu sau'}
            className={`absolute top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-lg text-white/90 backdrop-blur transition-opacity duration-300 hover:bg-black/55 hover:text-white ${ben === 'trai' ? 'left-2' : 'right-2'} ${hienNut || coChamTay ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >{dau as string}</button>
        ))}

        {/* Vệt tối mép dưới cho chữ trong ô tìm kiếm nổi lên khỏi ảnh. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden h-40 bg-gradient-to-t from-black/55 via-black/20 to-transparent md:block" />

        {/* ⚠️ ĐÃ BỎ lớp làm tối cả banner khi chạm vào ô tìm kiếm — chủ dự án
            thấy không cần, chỉ cần chính khung tìm kiếm rõ lên là đủ. */}
      {/* ── Ô TÌM KIẾM NẰM TRONG BANNER, BÌNH THƯỜNG THÌ MỜ ────────────────
          Ý của chủ dự án: để ô tìm kiếm ngay trong banner nhưng ĐỂ MỜ, khi nào
          người dùng rê chuột vào hoặc bắt đầu gõ thì ô rõ hẳn lên và banner mờ
          xuống. Nhờ vậy lúc chỉ ngắm banner thì ô tìm kiếm không giành chỗ,
          lúc cần tìm thì nó nổi bật hẳn.
          ⚠️ Chỉ làm vậy ở màn MÁY TÍNH. Điện thoại không có chuột để rê, mà bản
          thiết kế lại dồn hết chữ của banner xuống đáy — nên ở màn nhỏ ô tìm
          kiếm vẫn nằm hẳn bên dưới banner, rõ sẵn. */}
      {children ? (
        <div
          onPointerEnter={() => setDangTim(true)}
          onPointerLeave={() => setDangTim(false)}
          onFocusCapture={() => setDangTim(true)}
          onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDangTim(false); }}
          /* Đặt ở DẢI TRỐNG Ở ĐÁY banner — dải này chừa sẵn cho cả 19 mẫu nên
             không bao giờ đè lên chữ.
             ⚠️ Vì sao đáy chứ không phải trên: gần như mọi mẫu neo chữ theo mép
             TRÊN, nên đáy là chỗ trống nhất và chừa ở đáy thì không phải động
             vào bố cục phía trên — giữ được thiết kế gốc sát nhất. */
          className={`mx-auto max-w-[980px] px-3 pb-6 pt-4 transition-all duration-500 sm:px-4 md:absolute md:inset-x-0 md:bottom-4 md:z-30 md:pb-0 md:pt-0 ${dangTim ? 'md:opacity-100' : 'md:opacity-[.82]'}`}
        >
          {children}
        </div>
      ) : null}
      </div>
    </section>
  );
}
