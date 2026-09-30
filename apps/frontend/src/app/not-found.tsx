import Link from 'next/link';

export const metadata = { title: 'Không tìm thấy trang' };

// Trang 404 tiếng Việt (thay trang mặc định tiếng Anh của Next.js). Dùng chung layout gốc (có menu/chân trang).
export default function NotFound() {
  return (
    <div className="min-h-[68vh] grid place-items-center px-4 py-16 text-center">
      <div className="max-w-md">
        <div className="text-6xl mb-1">🗺️</div>
        <p className="text-6xl font-extrabold text-[#0A2540] leading-none">404</p>
        <h1 className="mt-3 text-xl font-bold text-[#0A2540]">Không tìm thấy trang</h1>
        <p className="mt-2 text-slate-500">Trang bạn tìm không tồn tại hoặc đã được di chuyển. Bạn về trang chủ hoặc dùng các mục bên dưới nhé.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link href="/" className="bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-5 py-2.5 rounded-xl">← Về trang chủ</Link>
          <Link href="/listings" className="bg-white border border-slate-200 hover:bg-slate-50 text-[#0A2540] font-bold px-5 py-2.5 rounded-xl">Nhà đất bán</Link>
          <Link href="/map" className="bg-white border border-slate-200 hover:bg-slate-50 text-[#0A2540] font-bold px-5 py-2.5 rounded-xl">Bản đồ quy hoạch</Link>
          <Link href="/tien-ich" className="bg-white border border-slate-200 hover:bg-slate-50 text-[#0A2540] font-bold px-5 py-2.5 rounded-xl">Tiện ích</Link>
        </div>
      </div>
    </div>
  );
}
