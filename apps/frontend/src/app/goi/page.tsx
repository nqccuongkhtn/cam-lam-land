'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Pkg { id: string; name: string; kind: 'post' | 'boost'; tier?: 'normal' | 'silver' | 'gold' | 'diamond'; boosts?: number; posts?: number; days: number; price: number; perks: string[]; popular?: boolean }
interface Bank { bankId: string; account: string; name: string; demo?: boolean }
const RING: Record<string, string> = { post: 'border-sky-300', normal: 'border-slate-300', silver: 'border-slate-300', gold: 'border-amber-400', diamond: 'border-rose-400' };
const HEAD: Record<string, string> = { post: 'from-sky-600 to-blue-600', normal: 'from-slate-500 to-slate-700', silver: 'from-slate-400 to-slate-600', gold: 'from-amber-500 to-yellow-500', diamond: 'from-rose-600 to-red-500' };
const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';
const keyOf = (p: Pkg) => (p.kind === 'post' ? 'post' : p.tier || 'silver');
const daysLeft = (iso?: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)) : 0);

export default function PricingPage() {
  const { user } = useAuth(); const router = useRouter();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => { api<{ packages: Pkg[]; bank: Bank }>('/payments/packages').then((r) => setPackages(r.packages || [])).catch(() => {}); }, []);
  const loadMine = useCallback(() => { if (user) api<{ current: any }>('/payments/my').then((r) => setCurrent(r.current)).catch(() => {}); }, [user]);
  useEffect(() => { loadMine(); }, [loadMine]);

  async function buy(p: Pkg) {
    if (!user) { router.push('/login?next=/goi'); return; }
    setBusy(p.id);
    try { const r = await api<any>('/payments/order', { method: 'POST', body: JSON.stringify({ packageId: p.id }) }); setOrder(r); setPaid(false); }
    catch (e: any) { alert(e.message); } finally { setBusy(''); }
  }
  useEffect(() => {
    if (!order || paid) return;
    const iv = setInterval(async () => {
      try { const r = await api<any>('/payments/my'); const o = (r.orders || []).find((x: any) => x.id === order.orderId); if (o?.status === 'paid') { setPaid(true); setCurrent(r.current); } } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [order, paid]);

  const qrUrl = order ? `https://img.vietqr.io/image/${order.bank.bankId}-${order.bank.account}-compact2.png?amount=${order.amount}&addInfo=${encodeURIComponent(order.note)}&accountName=${encodeURIComponent(order.bank.name)}` : '';
  const postDays = daysLeft(current?.postExpiresAt), boostDays = daysLeft(current?.boostExpiresAt);

  const Card = ({ p }: { p: Pkg }) => (
    <div className={`relative bg-white rounded-2xl border-2 ${RING[keyOf(p)]} overflow-hidden flex flex-col ${p.popular ? 'md:-mt-2 shadow-xl' : 'shadow-sm'}`}>
      {p.popular && <span className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full z-10">PHỔ BIẾN</span>}
      <div className={`bg-gradient-to-r ${HEAD[keyOf(p)]} text-white px-5 py-4`}>
        <p className="font-extrabold text-lg">{p.name}</p>
        <p className="text-3xl font-extrabold mt-1">{fmt(p.price)}<span className="text-sm font-medium opacity-80"> / 20 ngày</span></p>
      </div>
      <ul className="p-5 space-y-2.5 flex-1">
        {p.perks.map((k) => <li key={k} className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 font-bold mt-0.5">✓</span>{k}</li>)}
      </ul>
      <div className="p-5 pt-0">
        <button onClick={() => buy(p)} disabled={busy === p.id} className={`w-full font-bold py-3 rounded-xl text-white ${p.popular ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0A2540] hover:bg-[#0d2f54]'} disabled:opacity-60`}>{busy === p.id ? 'Đang tạo đơn…' : 'Mua gói'}</button>
      </div>
    </div>
  );

  const postPkgs = packages.filter((p) => p.kind === 'post');
  const boostPkgs = packages.filter((p) => p.kind === 'boost');

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)] py-12">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#0A2540]">Bảng giá gói</h1>
          <p className="text-slate-500 mt-2"><b>Gói đăng tin</b> tăng số tin đăng · <b>Gói đẩy tin VIP</b> nâng hạng & lượt đẩy. Mỗi gói dùng <b>20 ngày</b>, hết hạn mua thêm.</p>
        </div>

        {user && (postDays > 0 || boostDays > 0) && (
          <div className="mb-7 bg-white border border-emerald-200 rounded-2xl p-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {postDays > 0 && <span className="font-bold text-emerald-700">✓ Gói đăng: {current.postQuota} tin/tháng · còn {postDays} ngày</span>}
            {boostDays > 0 && <span className="font-bold text-emerald-700">✓ Gói {current.pkgTier?.toUpperCase()}: đẩy {current.boostUsed}/{current.boostQuota} · còn {boostDays} ngày</span>}
          </div>
        )}

        <h2 className="text-lg font-extrabold text-[#0A2540] mb-3">📝 Gói đăng tin <span className="font-normal text-sm text-slate-400">— đăng nhiều tin hơn</span></h2>
        <div className="grid md:grid-cols-3 gap-5 mb-10">{postPkgs.map((p) => <Card key={p.id} p={p} />)}</div>

        <h2 className="text-lg font-extrabold text-[#0A2540] mb-3">🚀 Gói đẩy tin VIP <span className="font-normal text-sm text-slate-400">— nổi bật trên đầu</span></h2>
        <div className="grid md:grid-cols-3 gap-5">{boostPkgs.map((p) => <Card key={p.id} p={p} />)}</div>

        <p className="text-center text-xs text-slate-400 mt-8">Thanh toán qua chuyển khoản — hệ thống <b>tự động kích hoạt gói</b> ngay khi nhận được tiền. Hỗ trợ: <a href="tel:0988888888" className="text-[#0A2540] font-bold">0988 888 888</a>.</p>
      </div>

      {order && (
        <div className="fixed inset-0 z-[70] bg-black/50 grid place-items-center p-4" onClick={() => setOrder(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            {paid ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto text-3xl font-bold">✓</div>
                <p className="font-extrabold text-[#0A2540] mt-4 text-lg">Thanh toán thành công!</p>
                <p className="text-sm text-slate-500 mt-1">Gói <b>{order.package.name}</b> đã được kích hoạt (20 ngày).</p>
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
                <p className="text-xs text-slate-500 mt-2 text-center">Quét QR hoặc chuyển khoản <b>đúng nội dung</b> ở trên. Gói sẽ <b>tự kích hoạt</b> sau khi nhận tiền.</p>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Đang chờ thanh toán…</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
