'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth, laAdmin } from '@/lib/auth';
import { useFlags } from '@/lib/flags';

interface Pkg { id: string; name: string; kind: 'post' | 'boost' | 'video' | 'chung'; tier?: 'normal' | 'silver' | 'gold' | 'diamond'; boosts?: number; posts?: number; days: number; price: number; perks: string[]; popular?: boolean }
interface Bank { bankId: string; account: string; name: string; demo?: boolean }

const STATIC: Pkg[] = [
  // GÓI THÀNH VIÊN = GÓI CHỨC NĂNG CHUNG (15/10/2026) — bản dự phòng khi chưa tải được bảng giá; giá thật ở máy chủ lib/packages.ts
  { id: 'tv3t', name: 'Gói 3 tháng', kind: 'chung', days: 90, price: 299000, perks: ['Tra cứu toàn bộ kho văn bản: số ký hiệu, ngày ban hành, mở đọc tệp', 'Tính giá đền bù, bồi thường (đủ số liệu, máy tính)', 'Bản đồ quy hoạch Cam Lâm đầy đủ: QĐ205, phân khu 1/2000, chi tiết 1/500, xem gần, quy hoạch từng thửa'] },
  { id: 'tv6t', name: 'Gói 6 tháng', kind: 'chung', days: 180, price: 568000, perks: ['Tra cứu toàn bộ kho văn bản: số ký hiệu, ngày ban hành, mở đọc tệp', 'Tính giá đền bù, bồi thường (đủ số liệu, máy tính)', 'Bản đồ quy hoạch Cam Lâm đầy đủ: QĐ205, phân khu 1/2000, chi tiết 1/500, xem gần, quy hoạch từng thửa'] },
  { id: 'tv1n', name: 'Gói 1 năm', kind: 'chung', days: 365, price: 1068000, perks: ['Tra cứu toàn bộ kho văn bản: số ký hiệu, ngày ban hành, mở đọc tệp', 'Tính giá đền bù, bồi thường (đủ số liệu, máy tính)', 'Bản đồ quy hoạch Cam Lâm đầy đủ: QĐ205, phân khu 1/2000, chi tiết 1/500, xem gần, quy hoạch từng thửa'] },
  { id: 'tv2n', name: 'Gói 2 năm', kind: 'chung', days: 730, price: 1968000, perks: ['Tra cứu toàn bộ kho văn bản: số ký hiệu, ngày ban hành, mở đọc tệp', 'Tính giá đền bù, bồi thường (đủ số liệu, máy tính)', 'Bản đồ quy hoạch Cam Lâm đầy đủ: QĐ205, phân khu 1/2000, chi tiết 1/500, xem gần, quy hoạch từng thửa'] },
  { id: 'post20', name: 'Đăng 20 tin', kind: 'post', posts: 20, days: 30, price: 119000, perks: ['Đăng tối đa 20 tin/tháng', 'Hiệu lực 30 ngày'] },
  { id: 'post50', name: 'Đăng 50 tin', kind: 'post', posts: 50, days: 30, price: 239000, perks: ['Đăng tối đa 50 tin/tháng', 'Hiệu lực 30 ngày'] },
  { id: 'post100', name: 'Đăng 100 tin', kind: 'post', posts: 100, days: 30, price: 449000, popular: true, perks: ['Đăng tối đa 100 tin/tháng', 'Phù hợp môi giới', 'Hiệu lực 30 ngày'] },
  { id: 'post300', name: 'Đăng 300 tin', kind: 'post', posts: 300, days: 30, price: 1299000, perks: ['Đăng tối đa 300 tin/tháng', 'Cho môi giới chuyên', 'Hiệu lực 30 ngày'] },
  { id: 'post1000', name: 'Đăng 1000 tin', kind: 'post', posts: 1000, days: 30, price: 3999000, perks: ['Đăng tối đa 1000 tin/tháng', 'Cho sàn / đại lý lớn', 'Hiệu lực 30 ngày'] },
  { id: 'boostnormal', name: 'Đẩy Thường', kind: 'boost', tier: 'normal', boosts: 20, days: 20, price: 499000, perks: ['20 lượt đẩy lên đầu', 'Tin hiển thị thường', 'Hiệu lực 20 ngày'] },
  { id: 'silver', name: 'VIP Bạc', kind: 'boost', tier: 'silver', boosts: 20, days: 20, price: 2999000, perks: ['Hiển thị hạng VIP Bạc', '20 lượt đẩy', 'Tự nổi lại mỗi 24h', 'Hiệu lực 20 ngày'] },
  { id: 'gold', name: 'VIP Vàng', kind: 'boost', tier: 'gold', boosts: 20, days: 20, price: 4999000, popular: true, perks: ['Hiển thị hạng VIP Vàng', '20 lượt đẩy', 'Tự nổi lại mỗi 12h', 'Ưu tiên trên hạng Bạc', 'Hiệu lực 20 ngày'] },
  { id: 'diamond', name: 'VIP Kim Cương', kind: 'boost', tier: 'diamond', boosts: 20, days: 20, price: 9999000, perks: ['Hiển thị hạng VIP Kim Cương', '20 lượt đẩy', 'Tự nổi lại mỗi 6h', 'Luôn trên cùng · tiêu đề đỏ', 'Hiệu lực 20 ngày'] },
];
const STATIC_BANK: Bank = { bankId: 'BIDV', account: '8855951682', name: 'NGUYEN QUOC CUONG', demo: false };
const ACCENT: Record<string, string> = { chung: '#C8A14B', video: '#8b5cf6', post: '#0ea5e9', normal: '#64748b', silver: '#94a3b8', gold: '#f59e0b', diamond: '#e11d48' };
const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';
const keyOf = (p: Pkg) => (p.kind === 'chung' ? 'chung' : p.kind === 'video' ? 'video' : p.kind === 'post' ? 'post' : p.tier || 'silver');
const dleft = (iso?: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)) : 0);

export default function ServicesPage() {
  const { user } = useAuth(); const router = useRouter();
  const { flags, loaded } = useFlags();
  const isAdmin = laAdmin(user);
  const [packages, setPackages] = useState<Pkg[]>(STATIC);
  const [bank, setBank] = useState<Bank>(STATIC_BANK);
  const [current, setCurrent] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState('');
  const [mapAds, setMapAds] = useState<any[]>([]);

  useEffect(() => { api<{ packages: Pkg[]; bank: Bank }>('/payments/packages').then((r) => { if (r.packages?.length) setPackages(r.packages); if (r.bank) setBank(r.bank); }).catch(() => {}); }, []);
  useEffect(() => { api<{ ads: any[] }>('/map-ads/active').then((r) => { const seen = new Set<string>(); setMapAds((r.ads || []).filter((a) => { const k = a.name + '|' + a.phone; if (seen.has(k)) return false; seen.add(k); return true; })); }).catch(() => {}); }, []);
  const loadMine = useCallback(() => { if (user) api<{ current: any }>('/payments/my').then((r) => setCurrent(r.current)).catch(() => {}); }, [user]);
  useEffect(() => { loadMine(); }, [loadMine]);

  async function buy(p: Pkg) {
    if (!user) { router.push('/login?next=/dichvu'); return; }
    setBusy(p.id);
    try { const r = await api<any>('/payments/order', { method: 'POST', body: JSON.stringify({ packageId: p.id }) }); setOrder(r); setPaid(false); }
    catch { setOrder({ orderId: 0, amount: p.price, note: `CLL ${p.id}`, package: p, bank }); setPaid(false); } finally { setBusy(''); }
  }
  useEffect(() => {
    if (!order || paid) return;
    const iv = setInterval(async () => { try { const r = await api<any>('/payments/my'); const o = (r.orders || []).find((x: any) => x.id === order.orderId); if (o?.status === 'paid') { setPaid(true); setCurrent(r.current); } } catch {} }, 4000);
    return () => clearInterval(iv);
  }, [order, paid]);

  const qrUrl = order ? `https://img.vietqr.io/image/${order.bank.bankId}-${order.bank.account}-compact2.png?amount=${order.amount}&addInfo=${encodeURIComponent(order.note)}&accountName=${encodeURIComponent(order.bank.name)}` : '';
  const postDays = dleft(current?.postExpiresAt), boostDays = dleft(current?.boostExpiresAt);
  const postPkgs = packages.filter((p) => p.kind === 'post');
  const boostPkgs = packages.filter((p) => p.kind === 'boost');
  const videoPkgs = packages.filter((p) => p.kind === 'video');
  const videoDays = dleft(current?.videoExpiresAt);
  const chungPkgs = packages.filter((p) => p.kind === 'chung');
  const chungDays = dleft(current?.goiChungHetHan);
  // Dịch vụ đăng tin / đẩy tin CHƯA MỞ (cờ services_live tắt) → khách chỉ thấy khối "Đăng ký thành viên" (gói chức năng chung) — hộp
  // "tính năng trả phí" ở các trang trỏ về đây (#thanh-vien). Admin vẫn thấy đủ cả trang như cũ.
  const chiThanhVien = !flags.services_live && !isAdmin;
  const giaK = (n: number) => `${Math.round(n / 1000)}K`;
  const adsLeft = mapAds.filter((_, i) => i % 2 === 0);
  const adsRight = mapAds.filter((_, i) => i % 2 === 1);
  const RailCard = ({ a }: { a: any }) => (
    <a href={`tel:${a.phone}`} className="block bg-white rounded-xl border border-slate-200 p-3 text-center hover:shadow-md transition">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {a.image ? <img src={a.image} alt="" className="w-16 h-16 rounded-full object-cover mx-auto ring-2 ring-[#C8A14B]/40" /> : <div className="w-16 h-16 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center text-xl font-extrabold mx-auto">{(a.name || 'C').charAt(0).toUpperCase()}</div>}
      <p className="font-bold text-[#0A2540] text-sm mt-2 line-clamp-2 leading-tight">{a.name}</p>
      <p className="text-red-600 font-bold text-sm mt-0.5">{a.phone}</p>
      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">Quảng cáo</p>
    </a>
  );
  const RailCTA = () => (
    <a href="tel:0567442996" className="block bg-slate-100 border border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-200 transition">
      <p className="text-2xl leading-none text-slate-400">＋</p><p className="text-xs font-bold text-slate-600 mt-1">Đặt quảng cáo</p><p className="text-[10px] text-slate-400">Liên hệ admin</p>
    </a>
  );

  const Card = ({ p }: { p: Pkg }) => {
    const k = keyOf(p); const perTin = p.posts ? Math.round(p.price / p.posts) : 0;
    return (
      <div className={`relative bg-white rounded-2xl p-5 flex flex-col border transition ${p.popular ? 'border-[#C8A14B] shadow-lg' : 'border-slate-200 hover:shadow-md hover:-translate-y-0.5'}`}>
        {p.popular && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#C8A14B] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow">PHỔ BIẾN</span>}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ACCENT[k] }} />
          <p className="font-bold text-[#0A2540]">{p.name}</p>
        </div>
        <p className="text-2xl md:text-[28px] font-extrabold text-[#0A2540] mt-3 leading-none">{p.price > 0 ? fmt(p.price) : 'Liên hệ'}</p>
        <p className="text-xs text-slate-400 mt-1.5">{p.days} ngày{perTin ? ` · ~${perTin.toLocaleString('vi-VN')}đ/tin` : p.boosts ? ` · ${p.boosts} lượt đẩy` : ''}</p>
        <ul className="mt-4 space-y-2 flex-1 text-sm text-slate-600">
          {p.perks.map((t) => <li key={t} className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span>{t}</li>)}
        </ul>
        {p.price <= 0 ? (
          <a href="tel:0567442996" className="mt-5 w-full font-bold py-2.5 rounded-xl transition text-center bg-[#0A2540] text-white hover:bg-[#0d2f54]">Gọi để kích hoạt</a>
        ) : (
        <button onClick={() => buy(p)} disabled={busy === p.id} className={`mt-5 w-full font-bold py-2.5 rounded-xl transition ${p.popular ? 'bg-[#0A2540] text-white hover:bg-[#0d2f54]' : 'bg-slate-100 text-[#0A2540] hover:bg-[#0A2540] hover:text-white'}`}>{busy === p.id ? 'Đang tạo…' : 'Mua ngay'}</button>
        )}
      </div>
    );
  };

  if (!loaded) return <div className="bg-slate-50 min-h-[60vh] grid place-items-center text-slate-400">Đang tải…</div>;
  return (
    <div className="bg-slate-50 min-h-[calc(100dvh-56px)]">
      {!flags.services_live && isAdmin && <div className="bg-amber-100 border-b border-amber-300 text-amber-800 text-sm font-semibold text-center py-2 px-4">⚠️ Trang đang ẩn với khách — bật “Dịch vụ” ở Quản trị để công khai.</div>}
      <div className="bg-[#0A2540] text-white">
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <span className="inline-block bg-[#C8A14B] text-[#0A2540] text-xs font-extrabold px-3 py-1 rounded-full">⚡ ƯU ĐÃI RA MẮT</span>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-3">{chiThanhVien ? 'Đăng ký thành viên' : 'Bảng giá dịch vụ'}</h1>
          <p className="mt-2 text-slate-300 max-w-xl mx-auto text-sm">{chiThanhVien ? 'Mở tra cứu văn bản, tính giá đền bù và bản đồ quy hoạch Cam Lâm đầy đủ. Thanh toán bằng mã QR, kích hoạt cho chính tài khoản của bạn.'
            : 'Mở các tính năng tra cứu, đăng nhiều tin hơn & đẩy tin lên hạng VIP. Thanh toán tự động, kích hoạt tức thì.'}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
            <span>🔒 An toàn</span><span>⚡ Tự kích hoạt</span><span>📞 Hỗ trợ 24/7</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-4 py-10 xl:flex xl:gap-5 xl:items-start">
        <aside className="hidden xl:block w-44 shrink-0 xl:sticky xl:top-20 space-y-3">{adsLeft.map((a) => <RailCard key={a.id} a={a} />)}<RailCTA /></aside>
        <div className="flex-1 min-w-0 max-w-5xl mx-auto w-full">
        {user && (postDays > 0 || boostDays > 0 || chungDays > 0) && (
          <div className="mb-8 bg-white border border-emerald-200 rounded-xl p-3.5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {chungDays > 0 && <span className="font-bold text-emerald-700">✓ Gói chức năng chung: còn {chungDays} ngày</span>}
            {postDays > 0 && <span className="font-bold text-emerald-700">✓ Gói đăng: {current.postQuota} tin · còn {postDays} ngày</span>}
            {boostDays > 0 && <span className="font-bold text-emerald-700">✓ Gói {current.pkgTier?.toUpperCase()}: đẩy {current.boostUsed}/{current.boostQuota} · còn {boostDays} ngày</span>}
          </div>
        )}

        {/* CHỨC NĂNG CHUNG / CHỨC NĂNG RIÊNG (15/10/2026, chủ dự án: "trả phí chia ra là các chức năng chung, còn trả phí mua gói số tin
            đăng, đẩy tin hay quảng cáo bản đồ là chức năng riêng") */}
        {/* ĐĂNG KÝ THÀNH VIÊN (15/10/2026) — chủ dự án gửi mẫu "ĐĂNG KÝ THÀNH VIÊN" 4 gói: "thiết kế cho web của mình gói như này, bỏ gói 1 tháng
            thay bằng 3 tháng giá 299, thay số 50 thành 68 hết". Khung xanh đậm, 4 dòng trắng bo góc, giá chữ đỏ; bấm một dòng = mua gói đó
            (mã QR chuyển khoản như các gói khác). Giá ở máy chủ lib/packages.ts (kind 'chung'). */}
        {chungPkgs.length > 0 && (
          <section id="thanh-vien" className="mb-12 scroll-mt-20 rounded-2xl bg-[#0A2540] px-4 py-6 text-center sm:px-8 sm:py-8">
            <h2 className="mx-auto inline-block rounded-xl bg-[#FFF6E5] px-5 py-2 text-[22px] font-extrabold uppercase tracking-wide text-[#0A2540] sm:text-[30px]">Đăng ký thành viên</h2>
            <p className="mt-2 text-[13px] font-semibold text-[#C8A14B] sm:text-[15px]">Cam Lâm Land · Gói chức năng chung</p>
            {chungDays > 0 && <p className="mt-2 text-[13px] font-bold text-emerald-300">✓ Gói của bạn còn {chungDays} ngày — mua thêm sẽ được cộng dồn.</p>}
            <div className="mx-auto mt-4 grid max-w-2xl gap-3">
              {chungPkgs.map((p) => (
                <button key={p.id} type="button" onClick={() => buy(p)} disabled={busy === p.id}
                  className="w-full rounded-xl bg-white px-3 py-3.5 text-[18px] font-extrabold uppercase tracking-wide text-[#0A2540] shadow transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 sm:py-4 sm:text-[24px]">
                  {busy === p.id ? 'Đang tạo đơn…' : <>{p.name} - <span className="text-red-600">{giaK(p.price)}</span></>}
                </button>
              ))}
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-[13px] leading-relaxed text-slate-200 sm:text-[14px]">Mở cùng lúc: <b className="text-white">tra cứu toàn bộ văn bản</b> · <b className="text-white">tính giá đền bù</b> ·
              <b className="text-white"> bản đồ quy hoạch Cam Lâm đầy đủ</b> (QĐ205, phân khu 1/2000, chi tiết 1/500, xem gần, quy hoạch từng thửa).</p>
            <p className="mx-auto mt-2 max-w-2xl text-[13px] font-semibold leading-relaxed text-white sm:text-[14px]">Anh chị chọn gói nào thì chuyển khoản theo mã QR hiện ra — gói tự kích hoạt cho chính tài khoản đang đăng nhập.
              Cần hỗ trợ, gọi <a href="tel:0567442996" className="text-[#C8A14B] underline">0567 442 996</a> hoặc nhắn Zalo admin. Xin cảm ơn!</p>
          </section>
        )}
        {!chiThanhVien && (<>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Chức năng riêng · mua riêng từng gói</p>
        <h2 className="text-xl font-extrabold text-[#0A2540] mb-1">Gói đăng tin</h2>
        <p className="text-sm text-slate-500 mb-5">Miễn phí 1 tin/tháng · mua gói để đăng thêm (đăng càng nhiều, giá mỗi tin càng rẻ).</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-12 items-stretch">{postPkgs.map((p) => <Card key={p.id} p={p} />)}</div>

        <h2 className="text-xl font-extrabold text-[#0A2540] mb-1">Gói đẩy tin VIP</h2>
        <p className="text-sm text-slate-500 mb-5">Tin nổi bật trên đầu danh sách & bản đồ. Hạng cao được hệ thống tự làm nổi thường xuyên hơn.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">{boostPkgs.map((p) => <Card key={p.id} p={p} />)}</div>

        {videoPkgs.length > 0 && (
          <>
            <h2 className="text-xl font-extrabold text-[#0A2540] mb-1 mt-12">🎬 Gói Tạo video bản đồ</h2>
            <p className="text-sm text-slate-500 mb-5">
              Biến mỗi mảnh đất thành một đoạn phim giới thiệu: khoanh lô, vẽ tuyến, bay camera trên ảnh vệ tinh rồi xuất MP4 1080p.
              {videoDays > 0 && <b className="text-emerald-600"> Gói của bạn còn {videoDays} ngày.</b>}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">{videoPkgs.map((p) => <Card key={p.id} p={p} />)}</div>
          </>
        )}
        </>)}

        <div className="mt-12 bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-xl font-extrabold text-[#0A2540]">💳 Phương thức thanh toán</h3>
          <p className="text-slate-500 text-sm mt-1">Chuyển khoản ngân hàng qua mã VietQR — hệ thống <b>tự động kích hoạt gói</b> ngay khi nhận được tiền.</p>
          <div className="mt-4 grid md:grid-cols-2 gap-5 items-start">
            <div className="text-sm space-y-1.5 bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex justify-between"><span className="text-slate-500">Ngân hàng</span><b className="text-[#0A2540]">{bank.bankId}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Số tài khoản</span><b className="text-[#0A2540]">{bank.account}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Chủ tài khoản</span><b className="text-[#0A2540]">{bank.name}</b></div>
              {bank.demo && <p className="text-[11px] text-amber-600 pt-1 border-t border-slate-200 mt-1">* Số TK đang ở chế độ thử nghiệm — liên hệ admin trước khi chuyển khoản.</p>}
            </div>
            <ol className="text-sm text-slate-600 space-y-2.5">
              <li className="flex gap-2"><b className="text-[#0A2540] shrink-0">1.</b> Chọn gói bên trên rồi bấm <b>Chọn gói</b>.</li>
              <li className="flex gap-2"><b className="text-[#0A2540] shrink-0">2.</b> Quét <b>mã VietQR</b> hiện ra, hoặc chuyển khoản đúng <b>số tiền + nội dung</b>.</li>
              <li className="flex gap-2"><b className="text-[#0A2540] shrink-0">3.</b> Gói <b>tự kích hoạt</b> trong vài phút sau khi nhận tiền (hoặc admin xác nhận).</li>
            </ol>
          </div>
        </div>

        {!chiThanhVien && (<>
        {/* Bán 2 ô quảng cáo cạnh Tin tức ở trang chủ (admin nhập ở /admin → Quảng cáo). Trang chủ có link "Đặt quảng cáo tại vị trí này" trỏ về đây. */}
        <div id="quang-cao" className="mt-6 scroll-mt-20 rounded-2xl bg-white border border-slate-200 p-6 md:flex items-center gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-extrabold text-[#0A2540]">🏠 Banner quảng cáo trang chủ</h3>
            <p className="text-slate-500 mt-1.5 text-sm max-w-xl">Hai vị trí cạnh mục <b>Tin tức</b> — nằm ngay màn hình đầu trang chủ, mọi người vào web đều thấy, cả trên điện thoại.
              Hợp cho <b>dự án, đất nền, môi giới, ngân hàng, công chứng, xây dựng – nội thất</b> tại Cam Lâm – Khánh Hoà.</p>
            <ul className="mt-2.5 text-sm text-slate-600 space-y-1">
              <li>✓ Tiêu đề, ảnh, nút bấm dẫn thẳng tới trang dự án / số điện thoại / Zalo của bạn</li>
              <li>✓ Thuê theo tuần hoặc theo tháng — mỗi vị trí chỉ một khách, không chạy chung</li>
              <li>✓ Cam Lâm Land soạn chữ và làm ảnh giúp nếu bạn cần</li>
            </ul>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col gap-2 shrink-0 w-full md:w-auto">
            <a href="tel:0567442996" className="bg-[#0A2540] text-white font-bold px-6 py-2.5 rounded-xl text-center">📞 0567 442 996</a>
            <a href="https://zalo.me/0582594956" target="_blank" rel="noreferrer" className="bg-[#0068FF] text-white font-bold px-6 py-2.5 rounded-xl text-center">Chat Zalo</a>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-6 md:flex items-center gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-extrabold text-[#0A2540]">🗺️ Quảng cáo logo trên bản đồ</h3>
            <p className="text-slate-500 mt-1.5 text-sm max-w-xl">Đặt logo doanh nghiệp / sales ngay trên bản đồ quy hoạch — độc quyền theo xã. Hiện <b>liên hệ trực tiếp admin</b> để tư vấn vị trí & gói.</p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col gap-2 shrink-0 w-full md:w-auto">
            <a href="tel:0567442996" className="bg-[#0A2540] text-white font-bold px-6 py-2.5 rounded-xl text-center">📞 0567 442 996</a>
            <a href="https://zalo.me/0582594956" target="_blank" rel="noreferrer" className="bg-[#0068FF] text-white font-bold px-6 py-2.5 rounded-xl text-center">Chat Zalo</a>
          </div>
        </div>
        </>)}
        </div>
        <aside className="hidden xl:block w-44 shrink-0 xl:sticky xl:top-20 space-y-3">{adsRight.map((a) => <RailCard key={a.id} a={a} />)}<RailCTA /></aside>
      </div>

      {order && (
        <div className="fixed inset-0 z-[70] bg-black/50 grid place-items-center p-4" onClick={() => setOrder(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            {paid ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto text-3xl font-bold">✓</div>
                <p className="font-extrabold text-[#0A2540] mt-4 text-lg">Thanh toán thành công!</p>
                <p className="text-sm text-slate-500 mt-1">Gói <b>{order.package.name}</b> đã được kích hoạt.</p>
                <button onClick={() => { setOrder(null); loadMine(); }} className="mt-5 bg-[#0A2540] text-white font-bold px-6 py-2.5 rounded-xl">Xong</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2"><b className="text-[#0A2540]">Thanh toán {order.package.name}</b><button onClick={() => setOrder(null)} className="text-slate-400 text-xl leading-none">✕</button></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="VietQR" className="w-full rounded-xl border border-slate-200" />
                <div className="mt-3 text-sm space-y-1 bg-slate-50 rounded-xl p-3">
                  <div className="flex justify-between"><span className="text-slate-500">Ngân hàng</span><b>{order.bank.bankId}</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Số TK</span><b>{order.bank.account}</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Chủ TK</span><b>{order.bank.name}</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Số tiền</span><b className="text-red-600">{fmt(order.amount)}</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Nội dung</span><b className="text-red-600">{order.note}</b></div>
                </div>
                {order.bank.demo && <p className="text-[11px] text-amber-600 mt-2 text-center font-medium">Số tài khoản đang ở chế độ thử nghiệm — liên hệ <a href="tel:0567442996" className="underline">admin</a> trước khi chuyển khoản.</p>}
                <p className="text-xs text-slate-500 mt-2 text-center">Quét QR hoặc chuyển khoản <b>đúng nội dung</b>. Gói <b>tự kích hoạt</b> sau khi nhận tiền.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
