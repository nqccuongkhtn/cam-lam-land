// BÀI THỬ GIẢ LẬP TRÌNH DUYỆT cho apps/frontend/src/lib/vanTay.ts (12/10/2026): điều phối giữa NÚT Face ID và GỢI Ý TRÊN
// BÀN PHÍM, danh sách khoá còn dùng được (allowCredentials), khoá cũ máy chủ đã tắt (KHOA_DA_TAT). Giả cả trình duyệt lẫn
// máy chủ — không đụng web thật, không cần iPhone. Sửa vanTay.ts / maKhoaMay.ts thì chạy lại, phải ra "TẤT CẢ ĐẠT":
//   apps/backend/node_modules/.bin/tsx scripts/thu-van-tay.mts
const LIB = new URL('../apps/frontend/src/lib/', import.meta.url).href;

// ── đồng hồ nhanh: mọi hẹn giờ chạy nhanh gấp 100 lần (4 phút → 2,4 giây) ──
const realST = globalThis.setTimeout;
(globalThis as any).setTimeout = (fn: any, ms = 0, ...a: any[]) => realST(fn, Math.max(0, ms / 100), ...a);
const ngu = (ms: number) => new Promise((r) => realST(r, ms));

// ── kho trình duyệt giả ──
const kho = new Map<string, string>();
const storage = { getItem: (k: string) => kho.get(k) ?? null, setItem: (k: string, v: string) => void kho.set(k, String(v)), removeItem: (k: string) => void kho.delete(k) };
Object.assign(globalThis as any, { window: globalThis, localStorage: storage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { cookie: '', querySelector: (s: string) => (s.includes('webauthn') ? {} : null) }, location: { protocol: 'https:', origin: 'https://x' } });
(globalThis as any).isSecureContext = true;

const daBao: any[] = [];
function PKC() {}
(PKC as any).isConditionalMediationAvailable = async () => true;
(PKC as any).isUserVerifyingPlatformAuthenticatorAvailable = async () => true;
(PKC as any).signalUnknownCredential = async (x: any) => { daBao.push(x); };
(globalThis as any).PublicKeyCredential = PKC;

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const ab = (s: string) => { const b = Buffer.from(s); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const taoKhoa = (id: string) => ({
  id: b64(id), rawId: ab(id), type: 'public-key', authenticatorAttachment: 'platform',
  response: { authenticatorData: ab('ad'), clientDataJSON: ab('cd'), signature: ab('sg'), userHandle: ab('uh-' + id) },
  getClientExtensionResults: () => ({}),
});

// ── navigator.credentials.get giả ──
type Goi = { kieu: 'goi-y' | 'nut'; signal?: AbortSignal; cho: string[]; tra: (id: string) => void; loi: (e: any) => void; xong: boolean };
const cacLenh: Goi[] = [];
let nutSe: { id?: string; loi?: string } = { id: 'B' };   // nút Face ID: người dùng chọn khoá nào / huỷ
const credentials = {
  get(o: any) {
    return new Promise((tra, loi) => {
      const g: Goi = {
        kieu: o.mediation === 'conditional' ? 'goi-y' : 'nut', signal: o.signal, xong: false,
        cho: (o.publicKey.allowCredentials || []).map((c: any) => Buffer.from(c.id).toString()),
        tra: (id) => { g.xong = true; tra(taoKhoa(id)); }, loi: (e) => { g.xong = true; loi(e); },
      };
      cacLenh.push(g);
      o.signal?.addEventListener('abort', () => { if (!g.xong) g.loi(new DOMException('aborted', 'AbortError')); });
      if (g.kieu === 'nut') realST(() => { if (g.xong) return; nutSe.loi ? g.loi(new DOMException('huỷ', nutSe.loi)) : g.tra(nutSe.id!); }, 20);
    });
  },
};
Object.defineProperty(globalThis.navigator, 'credentials', { value: credentials, configurable: true });

// ── máy chủ giả ──
let soBatDau = 0;
const khoaSong = new Set(['B']);
(globalThis as any).fetch = async (url: string, o: any) => {
  const j = (s: number, b: any) => ({ ok: s < 400, status: s, json: async () => b });
  if (url.endsWith('/passkey/dang-nhap/bat-dau')) { soBatDau++; return j(200, { khoa: 'k' + soBatDau, options: { challenge: b64('c' + soBatDau), rpId: 'x', allowCredentials: [], userVerification: 'required', timeout: 60000 } }); }
  if (url.endsWith('/passkey/dang-nhap/xong')) {
    const id = Buffer.from(JSON.parse(o.body).response.id, 'base64url').toString();
    return khoaSong.has(id) ? j(200, { token: 't', user: { id: 7 } }) : j(404, { error: 'Máy này chưa bật.', maLoi: 'KHOA_DA_TAT' });
  }
  return j(404, {});
};

const vt: any = await import(LIB + 'vanTay.ts');
const mk: any = await import(LIB + 'maKhoaMay.ts');
let hong = 0;
const kiem = (dk: boolean, ten: string) => { console.log((dk ? 'ĐẠT  ' : 'HỎNG ') + ten); if (!dk) hong++; };
const dangTreo = () => cacLenh.filter((g) => g.kieu === 'goi-y' && !g.xong);

// 1. Mở ô đăng nhập → treo đúng 1 lệnh gợi ý, danh sách để trống
const kq: any[] = []; const loi: any[] = [];
let go = vt.batGoiYBanPhim((r: any) => kq.push(r), (e: any) => loi.push(e));
await ngu(60);
kiem(dangTreo().length === 1, 'mở ô: treo đúng 1 lệnh gợi ý');
kiem(dangTreo()[0]?.cho.length === 0, 'lệnh gợi ý không kèm danh sách khoá');

// 2. Máy đã nhớ khoá B còn dùng được → bấm nút: gỡ lệnh gợi ý, nút chỉ đưa ra B
mk.nhoMaKhoa(7, [{ cred_id: b64('B'), transports: 'internal,hybrid' }]);
const goiYCu = dangTreo()[0];
const r1 = await vt.dangNhapVanTay();
kiem(goiYCu.xong && goiYCu.signal?.aborted === true, 'bấm nút: lệnh gợi ý đang treo bị gỡ');
const nut1 = cacLenh.filter((g) => g.kieu === 'nut')[0];
kiem(JSON.stringify(nut1?.cho) === JSON.stringify(['B']), 'nút chỉ đưa ra khoá còn dùng được (B), không có khoá cũ');
kiem(r1?.token === 't', 'nút: đăng nhập được');
await ngu(60);
kiem(dangTreo().length === 1, 'nút xong (ô còn mở): treo lại đúng 1 lệnh gợi ý');

// 3. Người dùng huỷ bảng Face ID của nút → không lỗi lạ, treo lại gợi ý
nutSe = { loi: 'NotAllowedError' };
let e3: any = null; try { await vt.dangNhapVanTay(); } catch (e) { e3 = e; }
kiem(!!e3 && vt.laHuy(e3), 'huỷ ở nút: báo là tự huỷ (không hiện hộp lỗi)');
await ngu(60);
kiem(dangTreo().length === 1, 'huỷ ở nút: treo lại đúng 1 lệnh gợi ý');

// 4. Chọn KHOÁ CŨ (A) trên bàn phím → máy chủ báo KHOA_DA_TAT → báo lỗi dễ hiểu, nhờ máy xoá khoá A, treo lại
dangTreo()[0].tra('A');
await ngu(80);
kiem(loi.length === 1 && loi[0]?.maLoi === 'KHOA_DA_TAT', 'chọn khoá cũ: gọi hàm báo lỗi với mã KHOA_DA_TAT');
kiem(vt.loiDeHieu(loi[0]) === 'Mã khoá này đã cũ. Bấm lại nút Face ID là được.', 'câu báo: "Mã khoá này đã cũ. Bấm lại nút Face ID là được."');
kiem(daBao.length === 1 && daBao[0].credentialId === b64('A') && daBao[0].rpId === 'x', 'nhờ máy xoá khoá cũ A (máy hỗ trợ)');
await ngu(60);
kiem(dangTreo().length === 1, 'sau lỗi: treo lại đúng 1 lệnh gợi ý');

// 5. Chọn khoá B trên bàn phím → đăng nhập được, không qua nút
dangTreo()[0].tra('B');
await ngu(80);
kiem(kq.length === 1 && kq[0].token === 't', 'chọn B trên bàn phím: đăng nhập được');

kiem(dangTreo().length === 0, 'đăng nhập xong: không treo lại (ô đăng nhập sắp đóng)');

// 6. Hết 4 phút → tự treo lại với thử thách mới (thử thách cũ sắp hết hạn trên máy chủ)
go(); go = vt.batGoiYBanPhim((r: any) => kq.push(r), (e: any) => loi.push(e)); await ngu(60);   // mở lại ô đăng nhập
const truoc = soBatDau; const lenhCu = dangTreo()[0];
await ngu(2600);
kiem(lenhCu?.signal?.aborted === true && dangTreo().length === 1 && soBatDau > truoc, 'hết 4 phút: gỡ lệnh cũ, treo lệnh mới với thử thách mới');

// 7. Trình duyệt cứ báo lỗi liên tục → treo lại tối đa 5 lần rồi thôi (không gọi máy chủ liên tục)
const truoc7 = soBatDau;
for (let i = 0; i < 12; i++) { const g = dangTreo()[0]; if (g) g.loi(new DOMException('x', 'NotAllowedError')); await ngu(40); }
kiem(soBatDau - truoc7 <= 6, `lỗi lặp: chỉ xin thử thách thêm ${soBatDau - truoc7} lần (≤ 6)`);

// 8. Đóng ô đăng nhập → gỡ lệnh, không treo lại nữa
go(); go = vt.batGoiYBanPhim(() => {}, () => {}); await ngu(60);
const g8 = dangTreo()[0];
go(); await ngu(200);
kiem(g8?.signal?.aborted === true && dangTreo().length === 0, 'đóng ô: gỡ lệnh gợi ý, không treo lại');

// 9. Máy chưa nhớ khoá nào → nút để iPhone tự đưa ra mọi khoá (như cũ)
kho.delete('cl-ma-khoa-may'); nutSe = { id: 'B' };
await vt.dangNhapVanTay();
const nut9 = cacLenh.filter((g) => g.kieu === 'nut').at(-1);
kiem(nut9?.cho.length === 0, 'máy chưa nhớ khoá: nút không kèm danh sách (iPhone tự đưa ra)');
kiem(JSON.stringify(mk.maKhoaCuaMay().map((m: any) => m.id)) === JSON.stringify([b64('B')]), 'đăng nhập bằng B xong: máy nhớ B');

console.log(hong ? `\n${hong} mục HỎNG` : '\nTẤT CẢ ĐẠT');
process.exit(hong ? 1 : 0);
