import PolicyPage from '@/components/PolicyPage';

export const metadata = { title: 'Điều khoản sử dụng | Cam Lâm Land' };

export default function Page() {
  return (
    <PolicyPage
      title="Điều khoản sử dụng"
      updated="07/2026"
      intro="Khi truy cập và sử dụng Cam Lâm Land, bạn đồng ý tuân thủ các điều khoản dưới đây."
      sections={[
        { h: 'Chấp nhận điều khoản', body: <p>Việc bạn truy cập, đăng ký hoặc sử dụng bất kỳ tính năng nào của website đồng nghĩa với việc bạn đã đọc, hiểu và đồng ý với các điều khoản này.</p> },
        { h: 'Tài khoản', body: <p>Bạn chịu trách nhiệm bảo mật tài khoản và mật khẩu của mình, chịu trách nhiệm với mọi hoạt động phát sinh từ tài khoản, và thông báo ngay cho chúng tôi nếu phát hiện truy cập trái phép.</p> },
        { h: 'Nội dung người dùng', body: <p>Bạn giữ quyền đối với nội dung mình đăng, đồng thời cấp cho Cam Lâm Land quyền hiển thị nội dung đó trên nền tảng. Bạn không được đăng nội dung vi phạm pháp luật hoặc quyền sở hữu trí tuệ của bên thứ ba.</p> },
        { h: 'Giới hạn trách nhiệm', body: <p>Thông tin trên website (bao gồm bản đồ quy hoạch, số liệu, tin đăng) mang tính tham khảo. Cam Lâm Land không chịu trách nhiệm cho thiệt hại phát sinh từ việc bạn sử dụng thông tin để ra quyết định. Vui lòng đối chiếu với cơ quan chức năng trước khi giao dịch.</p> },
        { h: 'Sở hữu trí tuệ', body: <p>Giao diện, logo, thương hiệu và mã nguồn của website thuộc quyền sở hữu của Cam Lâm Land. Không sao chép, sử dụng lại khi chưa được sự đồng ý bằng văn bản.</p> },
        { h: 'Thay đổi điều khoản', body: <p>Điều khoản có thể được cập nhật theo thời gian. Phiên bản mới có hiệu lực kể từ khi được đăng tải trên website.</p> },
      ]}
    />
  );
}
