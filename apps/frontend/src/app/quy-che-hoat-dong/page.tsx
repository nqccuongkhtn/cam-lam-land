import PolicyPage from '@/components/PolicyPage';

export const metadata = { title: 'Quy chế hoạt động | Cam Lâm Land' };

export default function Page() {
  return (
    <PolicyPage
      title="Quy chế hoạt động"
      updated="07/2026"
      intro="Cam Lâm Land là nền tảng trực tuyến kết nối người có nhu cầu mua, bán, cho thuê bất động sản và tra cứu quy hoạch tại huyện Cam Lâm, tỉnh Khánh Hòa."
      sections={[
        { h: 'Nguyên tắc chung', body: <p>Nền tảng hoạt động tuân thủ pháp luật Việt Nam. Cam Lâm Land là kênh trung gian đăng tin và kết nối, không phải là bên mua/bán và không trực tiếp tham gia vào giao dịch giữa các bên.</p> },
        { h: 'Đối tượng tham gia', body: <p>Cá nhân, tổ chức có nhu cầu mua, bán, cho thuê hoặc môi giới bất động sản; người dùng có nhu cầu tra cứu thông tin quy hoạch, bản đồ và tin tức thị trường.</p> },
        { h: 'Quyền và nghĩa vụ của thành viên', body: <p>Thành viên được đăng tin, tra cứu và liên hệ trong khuôn khổ nền tảng; đồng thời có nghĩa vụ cung cấp thông tin trung thực và tuân thủ Quy định đăng tin.</p> },
        { h: 'Quyền và nghĩa vụ của Ban quản trị', body: <p>Ban quản trị được quyền kiểm duyệt, ẩn hoặc gỡ tin vi phạm; có nghĩa vụ vận hành nền tảng ổn định và bảo mật thông tin người dùng theo Chính sách bảo mật.</p> },
        { h: 'Giao dịch và thanh toán', body: <p>Mọi giao dịch mua bán, cho thuê do các bên tự thỏa thuận và chịu trách nhiệm. Cam Lâm Land không đảm bảo và không chịu trách nhiệm về kết quả của các giao dịch này.</p> },
        { h: 'Giải quyết tranh chấp', body: <p>Các bên ưu tiên thương lượng, hòa giải. Trường hợp không đạt được thỏa thuận, tranh chấp sẽ được giải quyết theo quy định của pháp luật.</p> },
      ]}
    />
  );
}
