'use client';

/**
 * HỘP BÁO "TÍNH NĂNG TRẢ PHÍ" (15/10/2026). Chủ dự án: "tài khoản thường vẫn vào xem văn bản được nhưng làm mờ số ký hiệu và ngày văn bản,
 * bấm vào xem thì không cho, cảnh báo chức năng trả phí". Chữ KHÔNG nói tài khoản nào được dùng — chỉ mời liên hệ admin để đăng ký.
 */
export default function HopTraPhi({ ten, onDong }: { ten: string; onDong: () => void }) {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4" onClick={onDong}>
      <div role="dialog" aria-modal="true" aria-label="Tính năng trả phí" className="w-full max-w-[340px] rounded-lg bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-bold text-[#0A2540]">🔒 {ten} là tính năng trả phí</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">Vui lòng liên hệ admin Cam Lâm Land để đăng ký dùng.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href="tel:0567442996" className="rounded bg-[#0A2540] py-2 text-center text-[13px] font-semibold text-white">📞 0567 442 996</a>
          <a href="https://zalo.me/0567442996" target="_blank" rel="noreferrer" className="rounded border border-[#0068FF] py-2 text-center text-[13px] font-semibold text-[#0068FF]">Zalo admin</a>
          <button type="button" onClick={() => { onDong(); try { window.dispatchEvent(new CustomEvent('cl-open-chat', { detail: { tab: 'support' } })); } catch { /* bỏ qua */ } }}
            className="col-span-2 rounded border border-slate-300 py-2 text-[13px] font-semibold text-[#0A2540]">💬 Nhắn tin cho admin</button>
        </div>
        <button type="button" onClick={onDong} className="mt-2 w-full rounded py-2 text-[13px] font-semibold text-slate-500 active:bg-slate-100">Đóng</button>
      </div>
    </div>
  );
}
