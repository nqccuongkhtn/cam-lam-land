import PolicyPage from '@/components/PolicyPage';

export const metadata = { title: 'Quy định đăng tin | Cam Lâm Land' };

export default function Page() {
  return (
    <PolicyPage
      title="Quy định đăng tin"
      updated="07/2026"
      intro="Để đảm bảo thông tin minh bạch và trải nghiệm tốt cho người dùng, mọi tin đăng bất động sản trên Cam Lâm Land cần tuân thủ các quy định sau."
      sections={[
        { h: 'Nội dung tin đăng', body: <p>Thông tin về giá, diện tích, vị trí, hiện trạng và pháp lý phải chính xác, trung thực, không phóng đại hay gây hiểu nhầm. Tiêu đề rõ ràng, không chèn số điện thoại hay nội dung quảng cáo vào tiêu đề.</p> },
        { h: 'Hình ảnh', body: <p>Sử dụng hình ảnh thật của chính bất động sản đang rao. Không dùng ảnh của người khác, ảnh gắn logo/watermark của đơn vị khác, hoặc ảnh không liên quan đến tin đăng.</p> },
        { h: 'Nội dung bị cấm', body: <ul className="list-disc pl-5 space-y-1"><li>Tin giả, bất động sản không có thật.</li><li>Bất động sản đang tranh chấp, kê biên nhưng không nêu rõ.</li><li>Nội dung vi phạm pháp luật, trái thuần phong mỹ tục.</li></ul> },
        { h: 'Trách nhiệm của người đăng', body: <p>Người đăng chịu hoàn toàn trách nhiệm về tính chính xác và pháp lý của tin đăng. Cam Lâm Land là nền tảng trung gian kết nối, không phải là bên mua bán và không xác nhận tính pháp lý của từng bất động sản.</p> },
        { h: 'Xử lý vi phạm', body: <p>Tin vi phạm sẽ bị ẩn hoặc gỡ bỏ mà không cần báo trước. Tài khoản vi phạm nhiều lần có thể bị hạn chế tính năng hoặc khóa vĩnh viễn.</p> },
      ]}
    />
  );
}
