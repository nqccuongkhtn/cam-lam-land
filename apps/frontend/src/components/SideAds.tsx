import Link from 'next/link';

/**
 * Quảng cáo "2 CÁNH GÀ" — 2 banner DỌC CAO (skyscraper) hai bên, phong cách như batdongsan.
 * Chỉ hiện trên màn hình RỘNG ≥1700px (đủ chỗ ngoài khung nội dung max-w-7xl).
 * Nội dung: tự quảng bá dịch vụ Cam Lâm Land — admin có thể thay bằng ảnh/đối tác sau.
 */
export default function SideAds() {
  return (
    <>
      {/* ─────────── TRÁI — Gói tin VIP (navy · gold) ─────────── */}
      <aside className="hidden min-[1700px]:block fixed left-4 top-24 z-10 w-44">
        <Link href="/goi" className="group block rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5">
          <div className="relative flex flex-col min-h-[560px] bg-gradient-to-b from-[#0A2540] via-[#123a63] to-[#0A2540] text-white text-center px-4 pt-4 pb-5 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#C8A14B]/25 blur-2xl" />
            <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-[#C8A14B]/10 blur-2xl" />
            <div className="relative">
              <div className="text-[10px] font-bold tracking-[0.25em] text-[#C8A14B]/90">QUẢNG CÁO</div>
              <div className="mt-3 inline-flex items-center gap-1 bg-[#C8A14B] text-[#0A2540] text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow">🔥 -50% TIN VIP</div>
              <div className="mt-5 text-5xl leading-none">🚀</div>
              <h3 className="mt-4 font-extrabold text-2xl leading-tight">Gói tin <span className="text-[#C8A14B]">VIP</span></h3>
              <p className="mt-2 text-[12.5px] text-white/75 leading-snug">Đẩy tin lên TOP — khách thấy ngay, bán nhanh hơn.</p>
              <ul className="mt-4 space-y-1.5 text-left text-[12.5px] text-white/90">
                {['Hiển thị đầu trang', 'Ảnh lớn nổi bật', 'Gắn nhãn VIP uy tín'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5"><span className="text-[#FFD56A]">✓</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="relative mt-auto pt-5">
              <div className="bg-[#C8A14B] group-hover:bg-[#d8b25c] text-[#0A2540] font-extrabold text-sm py-2.5 rounded-full transition">Xem bảng giá →</div>
            </div>
          </div>
        </Link>
        <Link href="/dau-tu" className="mt-2.5 flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2.5 hover:border-[#C8A14B] transition shadow">
          <span className="text-xl shrink-0">💰</span>
          <span className="leading-tight text-left"><span className="block font-extrabold text-[#0A2540] text-[13px]">Góp vốn đầu tư</span><span className="text-[11px] text-slate-500">CamInvest — sinh lời BĐS</span></span>
        </Link>
      </aside>

      {/* ─────────── PHẢI — Dịch vụ pháp lý (red) ─────────── */}
      <aside className="hidden min-[1700px]:block fixed right-4 top-24 z-10 w-44">
        <Link href="/dichvu" className="group block rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5">
          <div className="relative flex flex-col min-h-[560px] bg-gradient-to-b from-[#b91c1c] via-[#dc2626] to-[#991b1b] text-white text-center px-4 pt-4 pb-5 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-black/15 blur-2xl" />
            <div className="relative">
              <div className="text-[10px] font-bold tracking-[0.25em] text-white/80">QUẢNG CÁO</div>
              <div className="mt-3 inline-flex items-center gap-1 bg-white text-[#b91c1c] text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow">⚖️ TRỌN GÓI</div>
              <div className="mt-5 text-5xl leading-none">📜</div>
              <h3 className="mt-4 font-extrabold text-2xl leading-tight">Dịch vụ<br />pháp lý</h3>
              <p className="mt-2 text-[12.5px] text-white/85 leading-snug">Sang tên sổ đỏ, công chứng, tách thửa — nhanh gọn.</p>
              <ul className="mt-4 space-y-1.5 text-left text-[12.5px] text-white/95">
                {['Sang tên · chuyển nhượng', 'Tách thửa · hợp thửa', 'Kiểm tra pháp lý'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5"><span className="text-white">✓</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="relative mt-auto pt-5">
              <div className="bg-white group-hover:bg-slate-100 text-[#b91c1c] font-extrabold text-sm py-2.5 rounded-full transition">Tư vấn ngay →</div>
            </div>
          </div>
        </Link>
        <Link href="/hop-dong-dat-coc" className="mt-2.5 flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2.5 hover:border-[#C8A14B] transition shadow">
          <span className="text-xl shrink-0">📝</span>
          <span className="leading-tight text-left"><span className="block font-extrabold text-[#0A2540] text-[13px]">Hợp đồng đặt cọc</span><span className="text-[11px] text-slate-500">Mẫu chuẩn — miễn phí</span></span>
        </Link>
      </aside>
    </>
  );
}
