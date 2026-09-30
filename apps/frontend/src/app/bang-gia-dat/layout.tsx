import KhoaMem from '@/components/KhoaMem';
import { ldKhoaMem } from '@/lib/ldKhoaMem';
import { ldJson } from '@/lib/jsonld';

// Tiện ích dạng BÀI ĐỌC — "khoá mềm": Google đọc được toàn bài (kéo khách), người chưa đăng nhập chỉ xem phần đầu.
// Trong khung /tien-ich vẫn khoá cứng như mọi tiện ích khác (HubShell). Xem components/KhoaMem.tsx.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ldKhoaMem) }} />
      <KhoaMem ten="bảng giá đất">{children}</KhoaMem>
    </>
  );
}
