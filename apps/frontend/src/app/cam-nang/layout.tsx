import KhoaMem from '@/components/KhoaMem';
import { ldKhoaMem } from '@/lib/ldKhoaMem';
import { ldJson } from '@/lib/jsonld';

// Tiện ích dạng BÀI ĐỌC — "khoá mềm": Google đọc được toàn bài (kéo khách), người chưa đăng nhập chỉ xem phần đầu.
// Trong khung /tien-ich vẫn khoá cứng như mọi tiện ích khác (HubShell). Xem components/KhoaMem.tsx.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mở thẳng phần "Dịch vụ pháp lý" (?toi=dich-vu-phap-ly): khi tải TRANG MỚI HOÀN TOÀN thì ẩn trang ngay lúc
          trình duyệt đọc tới đây — trước khi kịp vẽ phần đầu cẩm nang. KhoaMem nhảy tới khối dịch vụ rồi hiện lại.
          Lưới an toàn: 4 giây sau tự hiện lại dù có trục trặc gì. */}
      <script dangerouslySetInnerHTML={{ __html: "if(/[?&]toi=dich-vu-phap-ly/.test(location.search)||location.hash==='#dich-vu-phap-ly'){document.documentElement.style.visibility='hidden';setTimeout(function(){document.documentElement.style.visibility=''},4000)}" }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ldKhoaMem) }} />
      <KhoaMem ten="cẩm nang pháp lý">{children}</KhoaMem>
    </>
  );
}
