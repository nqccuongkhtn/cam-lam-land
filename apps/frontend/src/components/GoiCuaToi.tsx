'use client';
// Mục "GÓI CỦA TÔI" ở trang /account (15/10/2026 — chủ dự án: "có cơ chế tính thời gian hết hạn của các gói khách mua chưa và khách có xem
// được quản lý gói mua của họ chưa"). Máy chủ: GET /api/payments/my (gói đang có + 20 đơn gần nhất) + /api/payments/packages (tên gói).
// Hạn gói do MÁY CHỦ giữ và tự so mỗi lần dùng tính năng (tới hạn là tự khoá) — khung này chỉ để khách XEM: gói thành viên (chức năng chung),
// các gói riêng (tin đăng · đẩy tin · video), lịch sử đơn. Gói thành viên còn ≤ 7 ngày → nhắc gia hạn.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Goi = { id: string; name: string; kind: string; price: number; days: number };
type Don = { id: number; packageId: string; amount: number; status: string; note: string | null; createdAt: string };
type HienTai = { goiChungHetHan?: string | null; postQuota?: number; postUsed?: number; postExpiresAt?: string | null;
  pkgTier?: string | null; boostQuota?: number; boostUsed?: number; boostExpiresAt?: string | null; videoExpiresAt?: string | null };

const ngay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
const conNgay = (iso?: string | null) => { if (!iso) return 0; const ms = new Date(iso).getTime() - Date.now(); return ms > 0 ? Math.ceil(ms / 86400000) : 0; };
const tien = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
const TEN_HANG: Record<string, string> = { normal: 'Đẩy Thường', silver: 'VIP Bạc', gold: 'VIP Vàng', diamond: 'VIP Kim Cương' };

function TrangThai({ iso, dangDung }: { iso?: string | null; dangDung: string }) {
  const n = conNgay(iso);
  if (n) return <p className="text-[13px] font-semibold text-emerald-700">✓ {dangDung} · còn <b>{n}</b> ngày (hết hạn {ngay(iso)})</p>;
  return <p className="text-[13px] text-slate-500">{iso ? <>Đã hết hạn ngày {ngay(iso)}</> : 'Chưa có'}</p>;
}

export default function GoiCuaToi() {
  const [d, setD] = useState<{ current: HienTai | null; orders: Don[] } | null>(null);
  const [goi, setGoi] = useState<Goi[]>([]);
  useEffect(() => {
    api<{ current: HienTai | null; orders: Don[] }>('/payments/my').then(setD).catch(() => setD(null));
    api<{ packages: Goi[] }>('/payments/packages').then((r) => setGoi(r.packages || [])).catch(() => {});
  }, []);
  if (!d) return null;
  const c = d.current || {};
  const nChung = conNgay(c.goiChungHetHan);
  const tenGoi = (id: string) => goi.find((g) => g.id === id)?.name || (id === 'wallet' ? 'Nạp ví lập danh mục' : id);
  const coRieng = !!(c.postExpiresAt || c.boostExpiresAt || c.videoExpiresAt);
  return (
    <div id="goi-cua-toi" className="scroll-mt-20 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-[#0A2540]">Gói của tôi</h2>
        <Link href="/dichvu#thanh-vien" className="shrink-0 text-[13px] font-semibold text-[#0A2540] underline">Bảng giá</Link>
      </div>

      {/* GÓI THÀNH VIÊN (chức năng chung) */}
      <div className="mt-3 rounded-xl border border-[#C8A14B]/50 bg-[#C8A14B]/5 p-3">
        <p className="text-[14px] font-bold text-[#0A2540]">⭐ Gói thành viên</p>
        <p className="mt-0.5 text-[12px] leading-snug text-slate-500">Tra cứu văn bản · tính giá đền bù · bản đồ quy hoạch Cam Lâm đầy đủ</p>
        <div className="mt-1.5"><TrangThai iso={c.goiChungHetHan} dangDung="Đang dùng" /></div>
        {nChung > 0 && nChung <= 7 && (
          <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-[12.5px] font-semibold text-amber-800">⏰ Gói sắp hết hạn — gia hạn sớm để không bị gián đoạn (mua thêm được cộng dồn ngày).</p>
        )}
        <Link href="/dichvu#thanh-vien" className="mt-2 inline-block rounded-lg bg-[#0A2540] px-4 py-2 text-[13px] font-bold text-white">
          {nChung > 0 ? 'Gia hạn gói' : c.goiChungHetHan ? 'Đăng ký lại' : 'Đăng ký thành viên'}
        </Link>
      </div>

      {/* GÓI RIÊNG — chỉ hiện gói đã từng có */}
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">Gói riêng</p>
      {coRieng ? (
        <ul className="mt-1.5 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {c.postExpiresAt && (
            <li className="p-3"><p className="text-[13.5px] font-bold text-[#0A2540]">📝 Gói số tin đăng</p>
              <TrangThai iso={c.postExpiresAt} dangDung={`${c.postQuota || 0} tin/tháng · đã đăng ${c.postUsed ?? 0}`} /></li>
          )}
          {c.boostExpiresAt && (
            <li className="p-3"><p className="text-[13.5px] font-bold text-[#0A2540]">🚀 Gói đẩy tin</p>
              <TrangThai iso={c.boostExpiresAt} dangDung={`${TEN_HANG[c.pkgTier || ''] || 'Đẩy tin'} · đã đẩy ${c.boostUsed ?? 0}/${c.boostQuota ?? 0}`} /></li>
          )}
          {c.videoExpiresAt && (
            <li className="p-3"><p className="text-[13.5px] font-bold text-[#0A2540]">🎬 Tạo video bản đồ</p>
              <TrangThai iso={c.videoExpiresAt} dangDung="Đang dùng" /></li>
          )}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-slate-500">Chưa mua gói riêng nào (gói số tin đăng, đẩy tin, tạo video).</p>
      )}

      {/* LỊCH SỬ ĐƠN */}
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">Lịch sử mua gói</p>
      {d.orders.length ? (
        <ul className="mt-1.5 space-y-1.5">
          {d.orders.map((o) => {
            const daTra = o.status === 'paid';
            const admin = /^ADMIN/.test(o.note || '');
            return (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px]">
                <span className="min-w-0"><b className="text-[#0A2540]">{tenGoi(o.packageId)}</b>
                  <span className="text-slate-500"> · {ngay(o.createdAt)}{o.amount > 0 ? ` · ${tien(o.amount)}` : ''}</span></span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11.5px] font-bold ${daTra ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {daTra ? (admin ? 'Đã kích hoạt' : 'Đã thanh toán') : 'Chờ thanh toán'}
                </span>
                {!daTra && o.note && !admin && (
                  <span className="basis-full text-[12px] text-slate-500">Nội dung chuyển khoản: <b className="text-red-600">{o.note}</b> — chuyển đúng nội dung để gói tự kích hoạt.</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-slate-500">Chưa có đơn mua nào.</p>
      )}
    </div>
  );
}
