import PolicyPage from '@/components/PolicyPage';

export const metadata = { title: 'Giải quyết khiếu nại | Cam Lâm Land' };

export default function Page() {
  return (
    <PolicyPage
      title="Giải quyết khiếu nại"
      updated="07/2026"
      intro="Cam Lâm Land luôn lắng nghe và xử lý mọi phản ánh, khiếu nại của người dùng một cách nhanh chóng, minh bạch."
      sections={[
        { h: 'Kênh tiếp nhận', body: <p>Hotline: 0988 888 888 · Email: lienhe@camlamland.vn · Hoặc gửi phản ánh trực tiếp qua mục hỗ trợ / trò chuyện trên website.</p> },
        { h: 'Phạm vi &amp; trách nhiệm', body: <p>Cam Lâm Land chỉ tiếp nhận và giải quyết các vấn đề liên quan đến website và dịch vụ của nền tảng (lỗi kỹ thuật, tài khoản, hiển thị...). Đối với nội dung tin đăng, Cam Lâm Land không chịu trách nhiệm; chúng tôi chỉ đóng vai trò trung gian phối hợp các bên liên quan để xác thực thông tin và gỡ/hủy tin nếu phát hiện sai phạm.</p> },
        { h: 'Quy trình xử lý', body: <ul className="list-disc pl-5 space-y-1"><li>Tiếp nhận phản ánh qua các kênh nêu trên.</li><li>Với tin đăng: phối hợp các bên liên quan để xác thực thông tin.</li><li>Gỡ hoặc hủy tin nếu phát hiện sai phạm; với lỗi nền tảng thì kiểm tra và khắc phục.</li></ul> },
      ]}
    />
  );
}
