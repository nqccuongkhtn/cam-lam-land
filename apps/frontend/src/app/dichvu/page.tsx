'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Pkg { id: string; name: string; kind: 'post' | 'boost'; tier?: 'normal' | 'silver' | 'gold' | 'diamond'; boosts?: number; posts?: number; days: number; price: number; perks: string[]; popular?: boolean }
interface Bank { bankId: string; account: string; name: string; demo?: boolean }

// Hiển thị sẵn kể cả khi API chậm/chưa deploy (id phải khớp backend)
const STATIC: Pkg[] = [
  { id: 'post100', name: 'Đăng 100 tin', kind: 'post', posts: 100, days: 30, price: 99000, perks: ['Đăng tối đa 100 tin/tháng', 'Tin hiển thị bình thường', 'Hiệu lực 30 ngày'] },
  { id: 'post200', name: 'Đăng 200 tin', kind: 'post', posts: 200, days: 30, price: 189000, perks: ['Đăng tối đa 200 tin/tháng', 'Phù hợp môi giới', 'Hiệu lực 30 ngày'] },
  { id: 'post300', name: 'Đăng 300 tin', kind: 'post', posts: 300, days: 30, price: 269000, perks: ['Đăng tối đa 300 tin/tháng', 'Môi giới đăng nhiều', 'Hiệu lực 30 ngày'] },
  { id: 'post500', name: 'Đăng 500 tin', kind: 'post', posts: 500, days: 30, price: 449000, popular: true, perks: ['Đăng tối đa 500 tin/tháng', 'Cho môi giới chuyên', 'Hiệu lực 30 ngày'] },
  { id: 'post1000', name: 'Đăng 1000 tin', kind: 'post', posts: 1000, days: 30, price: 888000, perks: ['Đăng tối đa 1000 tin/tháng', 'Cho sàn / đại lý lớn', 'Hiệu lực 30 ngày'] },
  { id: 'boostnormal', name: 'Đẩy Thường', kind: 'boost', tier: 'normal', boosts: 20, days: 20, price: 99000, perks: ['20 lượt đẩy lên đầu', 'Tin hiển thị thường (không VIP)', 'Hiệu lực 20 ngày'] },
  { id: 'silver', name: 'VIP Bạc', kind: 'boost', tier: 'silver', boosts: 20, days: 20, price: 159000, perks: ['Tin hiển thị hạng VIP Bạc', '20 lượt đẩy tin', 'Tự nổi lại mỗi 24 giờ', 'Hiệu lực 20 ngày'] },
  { id: 'gold', name: 'VIP Vàng', kind: 'boost', tier: 'gold', boosts: 20, days: 20, price: 249000, popular: true, perks: ['Tin hiển thị hạng VIP Vàng', '20 lượt đẩy tin', 'Tự nổi lại mỗi 12 giờ', 'Ưu tiên trên hạng Bạc', 'Hiệu lực 20 ngày'] },
  { id: 'diamond', name: 'VIP Kim Cương', kind: 'boost', tier: 'diamond', boosts: 20, days: 20, price: 599000, perks: ['Tin hiển thị hạng VIP Kim Cương', '20 lượt đẩy tin', 'Tự nổi lại mỗi 6 giờ', 'Luôn nằm trên cùng', 'Tiêu đề nổi bật màu đỏ', 'Hiệu lực 20 ngày'] },
];
const RING: Record<string, string> = { post: 'from-sky-600 to-blue-600', normal: 'from-slate-500 to-slate-700', silver: 'from-slate-400 to-slate-600', gold: 'from-amber-500 to-yellow-500', diamond: 'from-rose-600 to-red-500' };
const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';
const keyOf = (p: Pkg) => (p.kind === 'post' ? 'post' : p.tier || 'silver');
const badgeOf = (p: Pkg) => (p.id === 'post500' ? 'PHỔ BIẾN' : p.id === 'post1000' ? 'RẺ NHẤT / TIN' : p.id === 'gold' ? 'ĐƯỢC CHỌN NHIỀU' : p.id === 'diamond' ? 'MẠNH NHẤT' : '');
const dleft = (iso?: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)) : 0);

export default function PricingPage() {
  const { user } = useAuth(); const router = useRouter();
  const [packages, setPackages] = useState<Pkg[]>(STATIC);
  const [bank, setBank] = useState<Bank | null>(null);
  const [current, setCurrent] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => { api<{ packages: Pkg[]; bank: Bank }>('/payments/packages').then((r) => { if (r.packages?.length) setPackages(r.packages); setBank(r.bank); }).catch(() => {}); }, []);
  const loadMine = useCallback(() => { if (user) api<{ current: any }>('/payments/my').then((r) => setCurrent(r.current)).catch(() => {}); }, [user]);
  useEffect(() => { loadMine(); }, [loadMine]);

  async function buy(p: Pkg) {
    if (!user) { router.push('/login?next=/dichvu'); return; }
    setBusy(p.id);
    try { const r = await api<any>('/payments/order', { method: 'POST', body: JSON.stringify({ packageId: p.id }) }); setOrder(r); setPaid(false); }
    catch (e: any) { alert(e.message); } finally { setBusy(''); }
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

  const Card = ({ p }: { p: Pkg }) => {
    const k = keyOf(p); const badge = badgeOf(p); const perTin = p.posts ? Math.round(p.price / p.posts) : 0;
    return (
      <div className={`relative bg-white rounded-2xl overflow-hidden flex flex-col transition duration-200 ${p.popular ? 'ring-2 ring-[#C8A14B] shadow-2xl lg:scale-[1.04] z-10' : 'border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5'}`}>
        {badge && <div className="absolute top-0 right-0 bg-gradient-to-l from-red-600 to-rose-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl z-10 tracking-wide">{badge}</div>}
        <div className={`bg-gradient-to-br ${RING[k]} text-white px-5 py-5`}>
          <p className="font-extrabold text-lg">{p.name}</p>
          <p className="text-3xl font-extrabold mt-1 leading-none">{fmt(p.price)}</p>
          <p className="text-xs opacity-85 mt-1.5">/ {p.days} ngày{perTin ? ` · chỉ ≈ ${perTin.toLocaleString('vi-VN')}đ/tin` : p.boosts ? ` · ${p.boosts} lượt đẩy` : ''}</p>
        </div>
        <ul className="p-5 space-y-2.5 flex-1">
          {p.perks.map((t) => <li key={t} className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 font-bold mt-0.5 shrink-0">✓</span>{t}</li>)}
        </ul>
        <div className="p-5 pt-0">
          <button onClick={() => buy(p)} disabled={busy === p.id} className={`w-full font-bold py-3 rounded-xl text-white disabled:opacity-60 transition ${p.popular ? 'bg-gradient-to-r from-red-600 to-rose-500 hover:brightness-110 shadow-lg shadow-red-500/30' : 'bg-[#0A2540] hover:bg-[#0d2f54]'}`}>{busy === p.id ? 'Đang tạo đơn…' : 'Mua ngay →'}</button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      {/* HERO */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0A2540] via-[#10355f] to-[#0A2540] text-white">
        <div className="relative max-w-5xl mx-auto px-4 py-14 text-center">
          <span className="inline-block bg-[#C8A14B] text-[#0A2540] text-xs font-extrabold px-3 py-1 rounded-full tracking-wide">⚡ ƯU ĐÃI RA MẮT — SỐ LƯỢNG CÓ HẠN</span>
          <h1 className="text-3xl md:text-5xl font-extrabold mt-4 leading-tight drop-shadow">Đưa tin của bạn lên <span className="text-[#FFD56A]">TOP Cam Lâm</span></h1>
          <p className="mt-3 text-slate-200 max-w-2xl mx-auto">Đăng nhiều tin hơn, đẩy lên hạng VIP, luôn nổi bật trên danh sách & bản đồ. Thanh toán tự động — kích hoạt tức thì.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-300">
            <span>🔒 Thanh toán an toàn</span><span>⚡ Tự kích hoạt vài phút</span><span>📞 Hỗ trợ 24/7</span><span>⭐ Hàng trăm môi giới tin dùng</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {user && (postDays > 0 || boostDays > 0) && (
          <div className="mb-8 bg-white border border-emerald-200 rounded-2xl p-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {postDays > 0 && <span className="font-bold text-emerald-700">✓ Gói đăng: {current.postQuota} tin/tháng · còn {postDays} ngày</span>}
            {boostDays > 0 && <span className="font-bold text-emerald-700">✓ Gói {current.pkgTier?.toUpperCase()}: đẩy {current.boostUsed}/{current.boostQuota} · còn {boostDays} ngày</span>}
          </div>
        )}

        <div className="flex items-end gap-2 mb-1"><h2 className="text-2xl font-extrabold text-[#0A2540]">📝 Gói đăng tin</h2><span className="text-sm text-emerald-600 font-semibold mb-0.5">— đăng càng nhiều, giá mỗi tin càng rẻ</span></div>
        <p className="text-sm text-slate-500 mb-5">Miễn phí 30 tin/tháng. Mua gói để đăng thêm (đã gồm số tin miễn phí).</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch">{postPkgs.map((p) => <Card key={p.id} p={p} />)}</div>

        <div className="flex items-end gap-2 mb-1 mt-12"><h2 className="text-2xl font-extrabold text-[#0A2540]">🚀 Gói đẩy tin VIP</h2><span className="text-sm text-amber-600 font-semibold mb-0.5">— luôn nổi bật trên đầu</span></div>
        <p className="text-sm text-slate-500 mb-5">Hạng càng cao càng được hệ thống tự làm nổi thường xuyên, không tốn lượt.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">{boostPkgs.map((p) => <Card key={p.id} p={p} />)}</div>

        {/* DỊCH VỤ QUẢNG CÁO BẢN ĐỒ */}
        <div className="mt-12 rounded-2xl overflow-hidden bg-gradient-to-r from-[#a3121b] to-[#6d0d14] text-white p-6 md:flex items-center gap-6 shadow-xl">
          <div className="flex-1">
            <span className="text-[11px] font-bold text-white/70 tracking-wide">DỊCH VỤ ĐẶC BIỆT</span>
            <h3 className="text-2xl font-extrabold mt-1">🗺️ Quảng cáo logo trên bản đồ</h3>
            <p className="text-white/85 mt-2 text-sm max-w-xl">Đặt logo doanh nghiệp / sales của bạn ngay trên bản đồ quy hoạch — <b>độc quyền theo xã</b>, khách mở bản đồ là thấy. Tiếp cận đúng người đang tìm đất.</p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col gap-2 shrink-0 w-full md:w-auto">
            <a href="tel:0988888888" className="bg-white text-[#a3121b] font-extrabold px-6 py-3 rounded-xl text-center">📞 Liên hệ admin: 0988 888 888</a>
            <a href="https://zalo.me/0988888888" target="_blank" rel="noreferrer" className="bg-[#0068FF] text-white font-bold px-6 py-2.5 rounded-xl text-center">Chat Zalo tư vấn</a>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3">Dịch vụ quảng cáo bản đồ hiện <b>liên hệ trực tiếp admin</b> để tư vấn vị trí & gói phù hợp. Thanh toán gói trên web: tự động kích hoạt khi nhận chuyển khoản.</p>
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
                {order.bank.demo && <p className="text-[11px] text-amber-600 mt-2 text-center font-medium">Số tài khoản đang ở chế độ thử nghiệm — vui lòng liên hệ <a href="tel:0988888888" className="underline">admin</a> trước khi chuyển khoản.</p>}
                <p className="text-xs text-slate-500 mt-2 text-center">Quét QR hoặc chuyển khoản <b>đúng nội dung</b>. Gói sẽ <b>tự kích hoạt</b> sau khi nhận tiền.</p>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Đang chờ thanh toán…</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
