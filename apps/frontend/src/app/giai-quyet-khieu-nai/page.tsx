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
        { h: 'Phạm vi khiếu nại', body: <p>Tiếp nhận khiếu nại về tin đăng sai sự thật, dấu hiệu lừa đảo, tranh chấp giữa các bên, và các lỗi liên quan đến dịch vụ của nền tảng.</p> },
        { h: 'Quy trình xử lý', body: <ul className="list-disc pl-5 space-y-1"><li>Bước 1: Tiếp nhận khiếu nại qua các kênh nêu trên.</li><li>Bước 2: Xác minh thông tin và các bên liên quan.</li><li>Bước 3: Phản hồi, phối hợp xử lý.</li><li>Bước 4: Thông báo kết quả cho người khiếu nại.</li></ul> },
        { h: 'Thời gian xử lý', body: <p>Trong vòng 3 – 7 ngày làm việc kể từ khi tiếp nhận đầy đủ thông tin. Với trường hợp phức tạp, thời gian có thể kéo dài hơn và chúng tôi sẽ thông báo cụ thể.</p> },
        { h: 'Cơ quan chức năng', body: <p>Nếu các bên không đạt được thỏa thuận, vụ việc sẽ được chuyển đến cơ quan có thẩm quyền để giải quyết theo quy định của pháp luật.</p> },
      ]}
    />
  );
}
