'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Pkg { id: string; name: string; kind: 'post' | 'boost'; tier?: 'normal' | 'silver' | 'gold' | 'diamond'; boosts?: number; posts?: number; days: number; price: number; perks: string[]; popular?: boolean }
interface Bank { bankId: string; account: string; name: string; demo?: boolean }

const STATIC: Pkg[] = [
  { id: 'post100', name: 'Đăng 100 tin', kind: 'post', posts: 100, days: 30, price: 99000, perks: ['Đăng tối đa 100 tin/tháng', 'Hiệu lực 30 ngày'] },
  { id: 'post200', name: 'Đăng 200 tin', kind: 'post', posts: 200, days: 30, price: 189000, perks: ['Đăng tối đa 200 tin/tháng', 'Hiệu lực 30 ngày'] },
  { id: 'post300', name: 'Đăng 300 tin', kind: 'post', posts: 300, days: 30, price: 269000, perks: ['Đăng tối đa 300 tin/tháng', 'Hiệu lực 30 ngày'] },
  { id: 'post500', name: 'Đăng 500 tin', kind: 'post', posts: 500, days: 30, price: 449000, popular: true, perks: ['Đăng tối đa 500 tin/tháng', 'Cho môi giới chuyên', 'Hiệu lực 30 ngày'] },
  { id: 'post1000', name: 'Đăng 1000 tin', kind: 'post', posts: 1000, days: 30, price: 888000, perks: ['Đăng tối đa 1000 tin/tháng', 'Cho sàn / đại lý lớn', 'Hiệu lực 30 ngày'] },
  { id: 'boostnormal', name: 'Đẩy Thường', kind: 'boost', tier: 'normal', boosts: 20, days: 20, price: 99000, perks: ['20 lượt đẩy lên đầu', 'Tin hiển thị thường', 'Hiệu lực 20 ngày'] },
  { id: 'silver', name: 'VIP Bạc', kind: 'boost', tier: 'silver', boosts: 20, days: 20, price: 159000, perks: ['Hiển thị hạng VIP Bạc', '20 lượt đẩy', 'Tự nổi lại mỗi 24h', 'Hiệu lực 20 ngày'] },
  { id: 'gold', name: 'VIP Vàng', kind: 'boost', tier: 'gold', boosts: 20, days: 20, price: 249000, popular: true, perks: ['Hiển thị hạng VIP Vàng', '20 lượt đẩy', 'Tự nổi lại mỗi 12h', 'Ưu tiên trên hạng Bạc', 'Hiệu lực 20 ngày'] },
  { id: 'diamond', name: 'VIP Kim Cương', kind: 'boost', tier: 'diamond', boosts: 20, days: 20, price: 599000, perks: ['Hiển thị hạng VIP Kim Cương', '20 lượt đẩy', 'Tự nổi lại mỗi 6h', 'Luôn trên cùng · tiêu đề đỏ', 'Hiệu lực 20 ngày'] },
];
const STATIC_BANK: Bank = { bankId: 'MB', account: '0359033303', name: 'NGUYEN QUOC CUONG', demo: true };
const ACCENT: Record<string, string> = { post: '#0ea5e9', normal: '#64748b', silver: '#94a3b8', gold: '#f59e0b', diamond: '#e11d48' };
const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';
const keyOf = (p: Pkg) => (p.kind === 'post' ? 'post' : p.tier || 'silver');
const dleft = (iso?: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)) : 0);

export default function ServicesPage() {
  const { user } = useAuth(); const router = useRouter();
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
    <a href="tel:0988888888" className="block bg-slate-100 border border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-200 transition">
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
        <p className="text-2xl md:text-[28px] font-extrabold text-[#0A2540] mt-3 leading-none">{fmt(p.price)}</p>
        <p className="text-xs text-slate-400 mt-1.5">{p.days} ngày{perTin ? ` · ~${perTin.toLocaleString('vi-VN')}đ/tin` : p.boosts ? ` · ${p.boosts} lượt đẩy` : ''}</p>
        <ul className="mt-4 space-y-2 flex-1 text-sm text-slate-600">
          {p.perks.map((t) => <li key={t} className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span>{t}</li>)}
        </ul>
        <button onClick={() => buy(p)} disabled={busy === p.id} className={`mt-5 w-full font-bold py-2.5 rounded-xl transition ${p.popular ? 'bg-[#0A2540] text-white hover:bg-[#0d2f54]' : 'bg-slate-100 text-[#0A2540] hover:bg-[#0A2540] hover:text-white'}`}>{busy === p.id ? 'Đang tạo…' : 'Mua ngay'}</button>
      </div>
    );
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="bg-[#0A2540] text-white">
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <span className="inline-block bg-[#C8A14B] text-[#0A2540] text-xs font-extrabold px-3 py-1 rounded-full">⚡ ƯU ĐÃI RA MẮT</span>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-3">Bảng giá dịch vụ</h1>
          <p className="mt-2 text-slate-300 max-w-xl mx-auto text-sm">Đăng nhiều tin hơn & đẩy tin lên hạng VIP. Thanh toán tự động, kích hoạt tức thì.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
            <span>🔒 An toàn</span><span>⚡ Tự kích hoạt</span><span>📞 Hỗ trợ 24/7</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-4 py-10 xl:flex xl:gap-5 xl:items-start">
        <aside className="hidden xl:block w-44 shrink-0 xl:sticky xl:top-20 space-y-3">{adsLeft.map((a) => <RailCard key={a.id} a={a} />)}<RailCTA /></aside>
        <div className="flex-1 min-w-0 max-w-5xl mx-auto w-full">
        {user && (postDays > 0 || boostDays > 0) && (
          <div className="mb-8 bg-white border border-emerald-200 rounded-xl p-3.5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {postDays > 0 && <span className="font-bold text-emerald-700">✓ Gói đăng: {current.postQuota} tin · còn {postDays} ngày</span>}
            {boostDays > 0 && <span className="font-bold text-emerald-700">✓ Gói {current.pkgTier?.toUpperCase()}: đẩy {current.boostUsed}/{current.boostQuota} · còn {boostDays} ngày</span>}
          </div>
        )}

        <h2 className="text-xl font-extrabold text-[#0A2540] mb-1">Gói đăng tin</h2>
        <p className="text-sm text-slate-500 mb-5">Miễn phí 30 tin/tháng · mua gói để đăng thêm (đăng càng nhiều, giá mỗi tin càng rẻ).</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-12 items-stretch">{postPkgs.map((p) => <Card key={p.id} p={p} />)}</div>

        <h2 className="text-xl font-extrabold text-[#0A2540] mb-1">Gói đẩy tin VIP</h2>
        <p className="text-sm text-slate-500 mb-5">Tin nổi bật trên đầu danh sách & bản đồ. Hạng cao được hệ thống tự làm nổi thường xuyên hơn.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">{boostPkgs.map((p) => <Card key={p.id} p={p} />)}</div>

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

        <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-6 md:flex items-center gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-extrabold text-[#0A2540]">🗺️ Quảng cáo logo trên bản đồ</h3>
            <p className="text-slate-500 mt-1.5 text-sm max-w-xl">Đặt logo doanh nghiệp / sales ngay trên bản đồ quy hoạch — độc quyền theo xã. Hiện <b>liên hệ trực tiếp admin</b> để tư vấn vị trí & gói.</p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col gap-2 shrink-0 w-full md:w-auto">
            <a href="tel:0988888888" className="bg-[#0A2540] text-white font-bold px-6 py-2.5 rounded-xl text-center">📞 0988 888 888</a>
            <a href="https://zalo.me/0988888888" target="_blank" rel="noreferrer" className="bg-[#0068FF] text-white font-bold px-6 py-2.5 rounded-xl text-center">Chat Zalo</a>
          </div>
        </div>
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
                {order.bank.demo && <p className="text-[11px] text-amber-600 mt-2 text-center font-medium">Số tài khoản đang ở chế độ thử nghiệm — liên hệ <a href="tel:0988888888" className="underline">admin</a> trước khi chuyển khoản.</p>}
                <p className="text-xs text-slate-500 mt-2 text-center">Quét QR hoặc chuyển khoản <b>đúng nội dung</b>. Gói <b>tự kích hoạt</b> sau khi nhận tiền.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
