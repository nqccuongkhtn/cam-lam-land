import PolicyPage from '@/components/PolicyPage';

// Tên trang (khuôn "%s | Cam Lâm Land" ở layout gốc tự thêm đuôi) + địa chỉ chính thức riêng, không khai là bản sao trang chủ.
export const metadata = { title: 'Chính sách bảo mật', alternates: { canonical: '/chinh-sach-bao-mat' } };

export default function Page() {
  return (
    <PolicyPage
      title="Chính sách bảo mật"
      updated="07/2026"
      intro="Cam Lâm Land tôn trọng và cam kết bảo vệ dữ liệu cá nhân của bạn, tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân và pháp luật Việt Nam có liên quan."
      sections={[
        { h: 'Bên kiểm soát dữ liệu', body: <p>Nền tảng <b>Cam Lâm Land</b> (batdongsancamlam.vn) là bên kiểm soát/xử lý dữ liệu cá nhân đối với thông tin bạn cung cấp trên nền tảng. Mọi thắc mắc về dữ liệu cá nhân, liên hệ hotline <b>0988 888 888</b> hoặc email <b>lienhe@camlamland.vn</b>.</p> },
        { h: 'Dữ liệu cá nhân thu thập', body: <p>Chúng tôi thu thập những dữ liệu cần thiết để cung cấp dịch vụ: họ tên, số điện thoại, email, ảnh đại diện (khi bạn đăng ký/đăng tin/liên hệ); nội dung tin đăng &amp; hình ảnh bạn tải lên; và dữ liệu kỹ thuật (loại thiết bị, trình duyệt, địa chỉ IP, thao tác sử dụng) để vận hành và cải thiện dịch vụ. Khi bạn đăng nhập, chúng tôi ghi thêm thông số phần cứng của thiết bị (màn hình, số nhân bộ xử lý, bộ nhớ, múi giờ, tên card đồ hoạ, mã rút gọn của bộ phông chữ — không gồm tên phông) để nhận ra thiết bị quen và bảo vệ tài khoản. Chúng tôi <b>không chủ động thu thập dữ liệu cá nhân nhạy cảm</b>; nếu bạn tự cung cấp (ví dụ ảnh giấy tờ để tra cứu), dữ liệu chỉ dùng đúng cho yêu cầu đó.</p> },
        { h: 'Mục đích & phương thức xử lý', body: <p>Dữ liệu được dùng để: tạo &amp; quản lý tài khoản; hiển thị tin đăng; kết nối người mua – người bán – môi giới; xác thực, chống gian lận, hỗ trợ khách hàng; gửi thông báo bạn đã đăng ký; và phân tích để nâng cao trải nghiệm. Việc xử lý được thực hiện bằng phương thức điện tử trên hệ thống của chúng tôi và các nhà cung cấp dịch vụ hỗ trợ.</p> },
        { h: 'Cơ sở & sự đồng ý', body: <p>Chúng tôi xử lý dữ liệu dựa trên <b>sự đồng ý của bạn</b> khi sử dụng nền tảng và để thực hiện dịch vụ bạn yêu cầu. Bạn có thể <b>rút lại sự đồng ý</b> bất kỳ lúc nào; khi đó một số tính năng có thể không tiếp tục sử dụng được.</p> },
        { h: 'Chia sẻ & bên xử lý dữ liệu', body: <p>Chúng tôi <b>không mua bán dữ liệu cá nhân</b>. Dữ liệu chỉ được chia sẻ: (i) theo lựa chọn của bạn (ví dụ hiển thị số điện thoại trên tin đăng); (ii) với các nhà cung cấp hạ tầng/dịch vụ hỗ trợ vận hành (máy chủ lưu trữ, gửi SMS/thông báo, bản đồ) theo hợp đồng bảo mật, chỉ trong phạm vi cần thiết; hoặc (iii) khi có yêu cầu hợp pháp của cơ quan nhà nước có thẩm quyền.</p> },
        { h: 'Thời gian lưu trữ', body: <p>Dữ liệu được lưu trong thời gian tài khoản còn hoạt động và trong khoảng thời gian hợp lý sau đó để phục vụ nghĩa vụ pháp lý, giải quyết tranh chấp và an toàn hệ thống. Khi không còn cần thiết hoặc khi bạn yêu cầu xóa hợp lệ, dữ liệu sẽ được xóa/ẩn danh.</p> },
        { h: 'Quyền của bạn (chủ thể dữ liệu)', body: <p>Theo Nghị định 13/2023/NĐ-CP, bạn có quyền: được biết về việc xử lý; đồng ý/không đồng ý; truy cập, xem &amp; chỉnh sửa; rút lại sự đồng ý; yêu cầu xóa; hạn chế hoặc phản đối việc xử lý; yêu cầu cung cấp dữ liệu của mình; khiếu nại, tố cáo, khởi kiện; và yêu cầu bồi thường thiệt hại theo quy định. Để thực hiện, liên hệ hotline <b>0988 888 888</b> hoặc email <b>lienhe@camlamland.vn</b>; chúng tôi phản hồi trong thời hạn luật định.</p> },
        { h: 'Dữ liệu của trẻ em', body: <p>Nền tảng dành cho người từ đủ 16 tuổi trở lên. Việc xử lý dữ liệu của người dưới 16 tuổi phải có sự đồng ý của cha, mẹ hoặc người giám hộ theo quy định. Nếu phát hiện đã thu thập dữ liệu của trẻ em mà chưa có sự đồng ý hợp lệ, chúng tôi sẽ xóa.</p> },
        { h: 'Bảo mật & Cookie', body: <p>Chúng tôi áp dụng các biện pháp kỹ thuật &amp; quản lý hợp lý (mã hoá kết nối HTTPS, phân quyền, giới hạn truy cập) để bảo vệ dữ liệu; tuy nhiên không phương thức nào an toàn tuyệt đối 100%. Website dùng cookie để ghi nhớ lựa chọn và phân tích lưu lượng; bạn có thể tắt cookie trong trình duyệt, một số tính năng có thể hạn chế.</p> },
        { h: 'Chuyển dữ liệu & cập nhật chính sách', body: <p>Một số nhà cung cấp hạ tầng có thể đặt máy chủ ngoài lãnh thổ Việt Nam; khi đó việc chuyển dữ liệu được thực hiện phù hợp quy định pháp luật. Chính sách này có thể được cập nhật; phiên bản mới có hiệu lực kể từ khi đăng tải. <span className="text-slate-400">Nội dung mang tính tham khảo, không thay thế tư vấn pháp lý cho trường hợp cụ thể.</span></p> },
      ]}
    />
  );
}
