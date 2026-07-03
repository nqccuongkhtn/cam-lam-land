import PolicyPage from '@/components/PolicyPage';

export const metadata = { title: 'Chính sách bảo mật | Cam Lâm Land' };

export default function Page() {
  return (
    <PolicyPage
      title="Chính sách bảo mật"
      updated="07/2026"
      intro="Cam Lâm Land tôn trọng và cam kết bảo vệ thông tin cá nhân của bạn khi sử dụng nền tảng."
      sections={[
        { h: 'Thông tin thu thập', body: <p>Chúng tôi thu thập họ tên, số điện thoại, email khi bạn đăng ký, đăng tin hoặc liên hệ; cùng với dữ liệu sử dụng (thiết bị, trình duyệt, thao tác) nhằm cải thiện dịch vụ.</p> },
        { h: 'Mục đích sử dụng', body: <p>Thông tin được dùng để vận hành tài khoản, hiển thị tin đăng, kết nối người mua – người bán, hỗ trợ khách hàng và nâng cao trải nghiệm sử dụng.</p> },
        { h: 'Chia sẻ thông tin', body: <p>Chúng tôi không mua bán thông tin cá nhân của bạn. Thông tin chỉ được chia sẻ khi có yêu cầu hợp pháp từ cơ quan chức năng, hoặc khi cần thiết để thực hiện dịch vụ (ví dụ hiển thị số điện thoại liên hệ trên tin đăng theo lựa chọn của chính bạn).</p> },
        { h: 'Bảo mật dữ liệu', body: <p>Chúng tôi áp dụng các biện pháp kỹ thuật hợp lý để bảo vệ dữ liệu. Tuy nhiên, không có phương thức truyền tải hay lưu trữ nào an toàn tuyệt đối 100%.</p> },
        { h: 'Cookie', body: <p>Website sử dụng cookie để ghi nhớ lựa chọn của bạn và phân tích lưu lượng truy cập. Bạn có thể tắt cookie trong cài đặt trình duyệt, tuy nhiên một số tính năng có thể hoạt động không đầy đủ.</p> },
        { h: 'Quyền của bạn', body: <p>Bạn có quyền yêu cầu xem, chỉnh sửa hoặc xóa thông tin cá nhân của mình bằng cách liên hệ hotline 0988 888 888 hoặc email lienhe@camlamland.vn.</p> },
      ]}
    />
  );
}
