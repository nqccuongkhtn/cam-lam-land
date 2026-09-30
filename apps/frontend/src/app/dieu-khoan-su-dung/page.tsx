import PolicyPage from '@/components/PolicyPage';

// Tên trang (khuôn "%s | Cam Lâm Land" ở layout gốc tự thêm đuôi) + địa chỉ chính thức riêng, không khai là bản sao trang chủ.
export const metadata = { title: 'Điều khoản sử dụng', alternates: { canonical: '/dieu-khoan-su-dung' } };

export default function Page() {
  return (
    <PolicyPage
      title="Điều khoản sử dụng"
      updated="07/2026"
      intro="Khi truy cập và sử dụng Cam Lâm Land, bạn đồng ý tuân thủ các điều khoản dưới đây và pháp luật Việt Nam có liên quan."
      sections={[
        { h: 'Chấp nhận điều khoản', body: <p>Việc bạn truy cập, đăng ký hoặc sử dụng bất kỳ tính năng nào của website đồng nghĩa với việc bạn đã đọc, hiểu và đồng ý với các điều khoản này. Nếu không đồng ý, vui lòng ngừng sử dụng.</p> },
        { h: 'Vai trò của nền tảng', body: <p>Cam Lâm Land là <b>nền tảng thông tin &amp; kết nối trung gian</b> về bất động sản và bản đồ quy hoạch tại khu vực Cam Lâm, Khánh Hòa. Cam Lâm Land <b>không phải là một bên trong giao dịch</b> mua bán/cho thuê giữa người dùng, không sở hữu và không bảo đảm cho các bất động sản được đăng. Mọi giao dịch, thỏa thuận, đặt cọc, thanh toán do các bên tự thực hiện và tự chịu trách nhiệm.</p> },
        { h: 'Tài khoản', body: <p>Bạn cung cấp thông tin trung thực khi đăng ký; tự bảo mật tài khoản, mật khẩu; chịu trách nhiệm với mọi hoạt động phát sinh từ tài khoản của mình và thông báo ngay cho chúng tôi nếu phát hiện truy cập trái phép.</p> },
        { h: 'Tin đăng & nội dung người dùng', body: <p>Bạn <b>chịu trách nhiệm về tính chính xác, hợp pháp</b> của tin đăng (thông tin, giá, hình ảnh, tính pháp lý của bất động sản) và cam kết có quyền đăng nội dung đó. Bạn giữ quyền với nội dung của mình và cấp cho Cam Lâm Land quyền hiển thị, lưu trữ nội dung đó trên nền tảng nhằm cung cấp dịch vụ.</p> },
        { h: 'Hành vi bị cấm', body: <p>Không đăng tin sai sự thật, trùng lặp, lừa đảo; không đăng bất động sản không có thật, đang tranh chấp, bị kê biên hoặc không có quyền chuyển nhượng; không xâm phạm quyền sở hữu trí tuệ, đời tư của người khác; không phát tán mã độc, thu thập dữ liệu trái phép, hay phá hoại hệ thống. Vi phạm có thể bị gỡ tin, khoá tài khoản và xử lý theo pháp luật.</p> },
        { h: 'Kiểm duyệt & gỡ nội dung', body: <p>Chúng tôi có quyền từ chối, chỉnh sửa hiển thị, tạm ẩn hoặc gỡ tin đăng/nội dung vi phạm điều khoản hoặc pháp luật, có hoặc không cần báo trước, để bảo đảm môi trường lành mạnh cho người dùng.</p> },
        { h: 'Dịch vụ trả phí (nếu có)', body: <p>Một số tiện ích nâng cao (ví dụ gói đẩy tin VIP) có thể thu phí. Phạm vi, mức phí và thời hạn được công bố tại thời điểm sử dụng; bạn thanh toán theo hướng dẫn. Trường hợp lỗi dịch vụ do chúng tôi, hai bên sẽ xử lý trên tinh thần thiện chí theo quy định.</p> },
        { h: 'Giới hạn trách nhiệm', body: <p>Thông tin trên website (bản đồ quy hoạch, số liệu tra cứu, tin đăng, biểu mẫu hợp đồng) mang <b>tính tham khảo</b>. Cam Lâm Land không chịu trách nhiệm cho thiệt hại phát sinh từ việc bạn dựa vào thông tin để ra quyết định, hoặc từ giao dịch giữa bạn với bên thứ ba. Vui lòng đối chiếu cơ quan chức năng và nhờ luật sư/công chứng cho giao dịch cụ thể.</p> },
        { h: 'Sở hữu trí tuệ', body: <p>Giao diện, logo, thương hiệu và mã nguồn của website thuộc quyền sở hữu của Cam Lâm Land. Không sao chép, khai thác lại khi chưa được đồng ý bằng văn bản.</p> },
        { h: 'Luật áp dụng & giải quyết tranh chấp', body: <p>Điều khoản này được điều chỉnh bởi <b>pháp luật Việt Nam</b>. Mọi tranh chấp được ưu tiên thương lượng; nếu không thành, đưa ra <b>Tòa án nhân dân có thẩm quyền</b> giải quyết.</p> },
        { h: 'Thay đổi điều khoản', body: <p>Điều khoản có thể được cập nhật theo thời gian; phiên bản mới có hiệu lực kể từ khi đăng tải. Việc bạn tiếp tục sử dụng đồng nghĩa chấp nhận bản cập nhật. Liên hệ: hotline 0988 888 888 · lienhe@camlamland.vn.</p> },
      ]}
    />
  );
}
