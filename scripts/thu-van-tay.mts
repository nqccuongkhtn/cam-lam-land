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
// Tự tạo khoá + báo nơi cất khoá (13/10/2026)
let khaNang: any = { conditionalCreate: true };
(PKC as any).getClientCapabilities = async () => khaNang;
const daBaoDs: any[] = [], daBaoTen: any[] = [];
(PKC as any).signalAllAcceptedCredentials = async (x: any) => { daBaoDs.push(x); };
(PKC as any).signalCurrentUserDetails = async (x: any) => { daBaoTen.push(x); };
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
const cacLenhTao: any[] = [];
let taoSe: string | null = null;                           // null = tạo được; 'NotAllowedError'… = máy từ chối
(credentials as any).create = async (o: any) => {
  cacLenhTao.push({ mediation: o.mediation, ten: o.publicKey?.user?.name, loaiTru: (o.publicKey?.excludeCredentials || []).length });
  if (taoSe) throw new DOMException('không đủ điều kiện', taoSe);
  return { id: b64('MOI'), rawId: ab('MOI'), type: 'public-key', authenticatorAttachment: 'platform',
    response: { attestationObject: ab('ao'), clientDataJSON: ab('cd'), getTransports: () => ['internal', 'hybrid'] },
    getClientExtensionResults: () => ({}) };
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
  if (url.endsWith('/passkey/tu-dong/bat-dau')) { goiMay.push(['tu-dong/bat-dau', JSON.parse(o.body)]);
    return j(200, { khoa: 'ktd', options: { challenge: b64('ctd'), rp: { id: 'x', name: 'Cam Lâm Land' }, user: { id: b64('TK'), name: 'A@b.vn', displayName: 'A@b.vn' },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }], timeout: 60000, attestation: 'none', excludeCredentials: [{ id: b64('B'), type: 'public-key' }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred', authenticatorAttachment: 'platform' } } }); }
  if (url.endsWith('/passkey/tu-dong/xong')) { goiMay.push(['tu-dong/xong', JSON.parse(o.body)]); return j(201, { ok: true }); }
  if (url.endsWith('/passkey/danh-sach')) { goiMay.push(['danh-sach', null]);
    return j(200, { ds: [{ cred_id: b64('B') }, { cred_id: b64('MOI') }], uid: 7, maTk: dsMaTk, rpId: 'x', email: 'a@b.vn', ten: 'Anh A' }); }
  return j(404, {});
};
const goiMay: any[] = [];
let dsMaTk: string | null = 'TK';

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

// 10. TỰ TẠO KHOÁ sau khi đăng nhập bằng mật khẩu (conditional create)
khaNang = { conditionalCreate: false }; goiMay.length = 0; cacLenhTao.length = 0;
await vt.tuTaoKhoa('A@b.vn');
kiem(goiMay.length === 0 && cacLenhTao.length === 0, 'trình duyệt báo KHÔNG hỗ trợ tự tạo khoá → không hỏi máy chủ, không tạo gì');
const giuKN = (PKC as any).getClientCapabilities; delete (PKC as any).getClientCapabilities;
await vt.tuTaoKhoa('A@b.vn');
kiem(goiMay.length === 0, 'trình duyệt cũ (không có getClientCapabilities) → im lặng');
(PKC as any).getClientCapabilities = giuKN;

khaNang = { conditionalCreate: true }; taoSe = null; daBaoDs.length = 0; daBaoTen.length = 0;
let goTreo = vt.batGoiYBanPhim(() => {}, () => {}); await ngu(60);
const treoTruoc = dangTreo()[0];
await vt.tuTaoKhoa(' A@b.vn ');
await ngu(50);
kiem(!!treoTruoc && treoTruoc.signal?.aborted === true, 'tự tạo khoá: gỡ lệnh gợi ý bàn phím còn treo trước khi tạo');
kiem(goiMay[0]?.[0] === 'tu-dong/bat-dau' && goiMay[0]?.[1]?.tenDangNhap === 'A@b.vn', 'xin thử thách tự tạo, gửi đúng tên đăng nhập (đã bỏ khoảng trắng)');
kiem(cacLenhTao.length === 1 && cacLenhTao[0].mediation === 'conditional' && cacLenhTao[0].loaiTru === 1, 'gọi tạo khoá kiểu NGẦM (mediation conditional), có danh sách loại trừ khoá đã có');
kiem(goiMay.some((g) => g[0] === 'tu-dong/xong' && g[1]?.khoa === 'ktd' && g[1]?.response?.id === b64('MOI')), 'nộp khoá vừa tạo lên máy chủ đúng thử thách');
kiem(daBaoDs.length === 1 && daBaoDs[0].userId === 'TK' && daBaoDs[0].rpId === 'x'
  && JSON.stringify(daBaoDs[0].allAcceptedCredentialIds) === JSON.stringify([b64('B'), b64('MOI')]),
  'báo nơi cất khoá: tài khoản TK chỉ còn đúng các khoá máy chủ giữ (đủ cả khoá cũ lẫn khoá mới)');
kiem(daBaoTen.length === 1 && daBaoTen[0].name === 'a@b.vn' && daBaoTen[0].displayName === 'Anh A', 'báo nơi cất khoá tên đăng nhập + tên hiển thị mới nhất');
goTreo();

goiMay.length = 0; cacLenhTao.length = 0; taoSe = 'NotAllowedError';
let nem = false; try { await vt.tuTaoKhoa('A@b.vn'); } catch { nem = true; }
kiem(!nem && cacLenhTao.length === 1 && !goiMay.some((g) => g[0] === 'tu-dong/xong'), 'máy từ chối (mật khẩu gõ tay / tab ẩn danh) → im lặng, không nộp gì, không báo lỗi');
taoSe = 'InvalidStateError'; goiMay.length = 0;
nem = false; try { await vt.tuTaoKhoa('A@b.vn'); } catch { nem = true; }
kiem(!nem && !goiMay.some((g) => g[0] === 'tu-dong/xong'), 'máy đã có khoá của tài khoản này (loại trừ) → im lặng');

dsMaTk = null; daBaoDs.length = 0; daBaoTen.length = 0;
await mk.dongBoMaKhoa(7, true);
kiem(daBaoDs.length === 0 && daBaoTen.length === 0, 'tài khoản chưa có mã cố định → KHÔNG báo nơi cất khoá (tránh ẩn nhầm khoá)');

console.log(hong ? `\n${hong} mục HỎNG` : '\nTẤT CẢ ĐẠT');
process.exit(hong ? 1 : 0);
