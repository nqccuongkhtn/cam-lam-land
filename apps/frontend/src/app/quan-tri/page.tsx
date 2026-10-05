'use client';
import Link from 'next/link';
import HubShell, { type HubTool } from '@/components/HubShell';
import { useAuth, coVaiTro, laAdmin } from '@/lib/auth';
import { useLoginGate } from '@/lib/loginGate';

const ALL: HubTool[] = [
  { key: 'admin', name: 'Quản trị hệ thống', desc: 'Người dùng, phân quyền, cấu hình', icon: '⚙️', path: '/admin', login: true },
  { key: 'van-ban', name: 'Quản lý văn bản', desc: 'Thêm/sửa/xoá văn bản, đồng bộ Công báo', icon: '📑', path: '/van-ban/quan-ly', login: true },
  { key: 'crm', name: 'CRM khách hàng', desc: 'Khách hàng, giao dịch, lịch hẹn', icon: '👥', path: '/sales/crm', login: true },
  { key: 'consignments', name: 'Khách gửi bán', desc: 'Danh sách ký gửi bán nhà đất', icon: '🤝', path: '/consignments', login: true },
  { key: 'invest-leads', name: 'Đăng ký góp vốn', desc: 'Lead góp vốn đầu tư (CamInvest)', icon: '📈', path: '/invest-leads', login: true },
  { key: 'map-ads', name: 'Quảng cáo bản đồ', desc: 'Vị trí quảng cáo trên bản đồ', icon: '📍', path: '/map-ads', login: true },
  { key: 'sales', name: 'Tin của tôi', desc: 'Tin đăng & sản phẩm đã lưu', icon: '🏠', path: '/sales', login: true },
  // TẠM — dễ gỡ (1/10/2026): báo cáo hoạt động 2 tài khoản theo dõi. Không nằm trong danh sách duocDung → CHỈ admin thấy.
  { key: 'theo-doi-tk', name: 'Theo dõi tài khoản', desc: 'Hoạt động của tài khoản đang theo dõi (chỉ admin)', icon: '🕵️', path: '/quan-tri/theo-doi-tai-khoan', login: true },
  { key: 'moi-gioi-cn', name: 'Duyệt môi giới chuyên nghiệp', desc: 'Xác minh số điện thoại, duyệt / thu hồi nhãn môi giới chuyên nghiệp', icon: '🏅', path: '/quan-tri/moi-gioi-chuyen-nghiep', login: true },
  { key: 'logo-le', name: 'Logo ngày lễ', desc: 'Lịch tự đổi logo dịp Tết, Quốc khánh, Trung thu…', icon: '🎏', path: '/quan-tri/logo-le', login: true },
];

export default function QuanTriPage() {
  const { user, loading } = useAuth();
  const { openLogin } = useLoginGate();
  // Một người có thể giữ nhiều vai trò → xét cả danh sách, và công cụ hiện ra là GỘP của các vai trò đó.
  const canManage = coVaiTro(user, 'admin', 'gis', 'vanban');
  const chiGis = coVaiTro(user, 'gis') && !laAdmin(user);

  if (loading) return <div className="mx-auto max-w-lg px-4 py-16 text-center text-slate-400">Đang tải…</div>;
  if (!canManage) return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <p className="font-extrabold text-[#0A2540] text-lg">Khu vực quản lý</p>
      <p className="text-sm text-slate-500 mt-1.5">Chỉ dành cho tài khoản <b>quản trị / quản lý</b>.</p>
      {!user && <button onClick={() => openLogin()} className="mt-5 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg">Đăng nhập</button>}
      <div className="mt-4"><Link href="/" className="text-[#C8A14B] font-semibold">← Về trang chủ</Link></div>
    </div>
  );

  // Submenu "Quản trị hệ thống" — bấm item mẹ là sổ xuống ngay trong sidebar (không tạo sidebar thứ 2)
  const adminSecs: [string, string][] = chiGis
    ? [['upload', 'Tải bản đồ'], ['logs', 'Nhật ký']]
    : [['overview', 'Tổng quan'], ['listings', 'Tin đăng'], ['ads', 'Quảng cáo'], ['users', 'Người dùng'], ['payments', 'Thanh toán'], ['config', 'Cấu hình'], ['logs', 'Nhật ký'], ['upload', 'Tải bản đồ']];
  const adminChildren: HubTool[] = adminSecs.map(([k, n]) => ({ key: 'admin-' + k, name: n, desc: '', icon: '⚙️', path: '/admin?tab=' + k }));

  // Lọc công cụ theo quyền
  const duocDung = new Set<string>();
  if (coVaiTro(user, 'vanban')) ['van-ban', 'sales'].forEach((k) => duocDung.add(k));
  if (coVaiTro(user, 'gis')) ['admin', 'map-ads', 'sales'].forEach((k) => duocDung.add(k));
  const tools = ALL.filter((t) => laAdmin(user) || duocDung.has(t.key))
    .map((t) => (t.key === 'admin' ? { ...t, children: adminChildren } : t));

  return <HubShell title="🛠️ Quản trị Cam Lâm Land" subtitle="Bảng điều khiển quản lý" tools={tools} storageKey="quantri" />;
}
