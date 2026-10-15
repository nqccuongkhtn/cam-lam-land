'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

/**
 * HỘP BÁO "TÍNH NĂNG TRẢ PHÍ" (15/10/2026). Chủ dự án: "tài khoản thường vẫn vào xem văn bản được nhưng làm mờ số ký hiệu và ngày văn bản,
 * bấm vào xem thì không cho, cảnh báo chức năng trả phí". Chữ KHÔNG nói tài khoản nào được dùng — chỉ mời liên hệ admin / đăng ký gói.
 * Có bảng giá GÓI THÀNH VIÊN (gói chức năng chung — máy chủ lib/packages.ts kind 'chung') + nút sang trang mua gói (/dichvu#thanh-vien).
 */
type Goi = { id: string; name: string; kind: string; price: number };
// Bản dự phòng khi chưa tải được bảng giá (giá thật ở máy chủ)
const GOI_DU_PHONG: Goi[] = [
  { id: 'tv3t', name: 'Gói 3 tháng', kind: 'chung', price: 299000 }, { id: 'tv6t', name: 'Gói 6 tháng', kind: 'chung', price: 568000 },
  { id: 'tv1n', name: 'Gói 1 năm', kind: 'chung', price: 1068000 }, { id: 'tv2n', name: 'Gói 2 năm', kind: 'chung', price: 1968000 },
];
export default function HopTraPhi({ ten, onDong }: { ten: string; onDong: () => void }) {
  const [goi, setGoi] = useState<Goi[]>(GOI_DU_PHONG);
  useEffect(() => {
    api<{ packages: Goi[] }>('/payments/packages')
      .then((r) => { const ds = (r.packages || []).filter((p) => p.kind === 'chung' && p.price > 0); if (ds.length) setGoi(ds); }).catch(() => {});
  }, []);
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4" onClick={onDong}>
      <div role="dialog" aria-modal="true" aria-label="Tính năng trả phí" className="max-h-[92dvh] w-full max-w-[360px] overflow-y-auto rounded-lg bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-bold text-[#0A2540]">🔒 {ten} là tính năng trả phí</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">Đăng ký <b className="text-[#0A2540]">thành viên</b> để mở cùng lúc: tra cứu văn bản · tính giá đền bù · bản đồ quy hoạch Cam Lâm.</p>
        <div className="mt-2.5 rounded-lg bg-[#0A2540] p-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            {goi.map((p) => (
              <div key={p.id} className="rounded-md bg-white px-1 py-1.5 text-center text-[12.5px] font-extrabold uppercase text-[#0A2540]">
                {p.name.replace(/^Gói\s*/i, '')} · <span className="text-red-600">{Math.round(p.price / 1000)}K</span>
              </div>
            ))}
          </div>
          <Link href="/dichvu#thanh-vien" onClick={onDong} className="mt-2 block rounded-md bg-[#C8A14B] py-2 text-center text-[13px] font-bold text-[#0A2540]">Đăng ký thành viên →</Link>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <a href="tel:0567442996" className="rounded bg-[#0A2540] py-2 text-center text-[13px] font-semibold text-white">📞 0567 442 996</a>
          <a href="https://zalo.me/0582594956" target="_blank" rel="noreferrer" className="rounded border border-[#0068FF] py-2 text-center text-[13px] font-semibold text-[#0068FF]">Zalo admin</a>
          <button type="button" onClick={() => { onDong(); try { window.dispatchEvent(new CustomEvent('cl-open-chat', { detail: { tab: 'support' } })); } catch { /* bỏ qua */ } }}
            className="col-span-2 rounded border border-slate-300 py-2 text-[13px] font-semibold text-[#0A2540]">💬 Nhắn tin cho admin</button>
          <div className="col-span-2 hidden items-center gap-3 rounded border border-slate-200 p-2 sm:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/zalo-admin-qr.png" alt="Mã QR kết bạn Zalo admin" width={88} height={88} className="h-[88px] w-[88px]" />
            <p className="text-[12px] leading-snug text-slate-500">Quét mã bằng điện thoại để <b className="text-[#0A2540]">kết bạn Zalo admin</b>.</p>
          </div>
        </div>
        <button type="button" onClick={onDong} className="mt-2 w-full rounded py-2 text-[13px] font-semibold text-slate-500 active:bg-slate-100">Đóng</button>
      </div>
    </div>
  );
}
