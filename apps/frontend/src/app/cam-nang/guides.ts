// Nội dung Cẩm nang pháp lý nhà đất — dùng cho trang /cam-nang và /cam-nang/[slug].
// Thông tin mang tính tham khảo, hướng dẫn chung; quy định có thể thay đổi (đặc biệt theo Luật Đất đai 2024).
export interface GuideBlock { h: string; p?: string; list?: string[] }
export interface Guide { slug: string; title: string; desc: string; updated: string; intro: string; body: GuideBlock[] }

export const GUIDES: Guide[] = [
  {
    slug: 'sang-ten-so-do',
    title: 'Thủ tục sang tên Sổ đỏ (chuyển nhượng quyền sử dụng đất)',
    desc: 'Hồ sơ, trình tự các bước, nơi nộp và thời gian sang tên sổ đỏ khi mua bán, chuyển nhượng nhà đất tại Khánh Hòa.',
    updated: '2026',
    intro: 'Sang tên Sổ đỏ là thủ tục đăng ký biến động khi chuyển nhượng quyền sử dụng đất/quyền sở hữu nhà từ người bán sang người mua. Dưới đây là quy trình chung để bạn nắm được các bước và hồ sơ cần chuẩn bị.',
    body: [
      { h: 'Điều kiện được chuyển nhượng', list: ['Đã có Giấy chứng nhận (sổ đỏ/sổ hồng) hợp lệ', 'Đất không có tranh chấp', 'Quyền sử dụng đất không bị kê biên để bảo đảm thi hành án', 'Còn trong thời hạn sử dụng đất'] },
      { h: 'Hồ sơ cần chuẩn bị', list: ['Hợp đồng chuyển nhượng đã công chứng/chứng thực', 'Đơn đăng ký biến động đất đai (theo mẫu)', 'Bản gốc Giấy chứng nhận đã cấp', 'CCCD/CMND, giấy tờ chứng minh quan hệ (nếu được miễn thuế)', 'Tờ khai thuế thu nhập cá nhân và lệ phí trước bạ'] },
      { h: 'Trình tự các bước', list: ['Bước 1: Công chứng hợp đồng chuyển nhượng tại tổ chức hành nghề công chứng', 'Bước 2: Kê khai và nộp thuế thu nhập cá nhân, lệ phí trước bạ', 'Bước 3: Nộp hồ sơ tại Văn phòng/Chi nhánh Văn phòng đăng ký đất đai hoặc Bộ phận Một cửa', 'Bước 4: Nhận Giấy chứng nhận đã sang tên theo giấy hẹn'] },
      { h: 'Nơi nộp và thời gian', p: 'Hồ sơ nộp tại Chi nhánh Văn phòng đăng ký đất đai cấp huyện nơi có đất (hoặc Bộ phận Một cửa). Thời gian giải quyết thường khoảng 10–15 ngày làm việc, chưa kể thời gian thực hiện nghĩa vụ tài chính.' },
      { h: 'Lưu ý quan trọng', p: 'Trước khi đặt cọc/ký hợp đồng, hãy kiểm tra sổ thật – giả và đối chiếu thông tin thửa đất. Với sổ mẫu mới có mã QR, bạn có thể quét để đối chiếu ngay tại mục Tra cứu QR của Cam Lâm Land.' },
    ],
  },
  {
    slug: 'thue-phi-mua-ban-nha-dat',
    title: 'Các loại thuế, phí khi mua bán nhà đất phải nộp',
    desc: 'Thuế thu nhập cá nhân, lệ phí trước bạ, phí công chứng và các khoản khi chuyển nhượng nhà đất — ai nộp, tính thế nào.',
    updated: '2026',
    intro: 'Khi mua bán, chuyển nhượng nhà đất, hai bên cần thực hiện nghĩa vụ tài chính với Nhà nước. Dưới đây là các khoản phổ biến để bạn dự trù chi phí.',
    body: [
      { h: 'Thuế thu nhập cá nhân (TNCN)', p: 'Thông thường 2% trên giá chuyển nhượng ghi trong hợp đồng (không thấp hơn giá đất do Nhà nước quy định). Theo thông lệ do bên bán nộp, nhưng hai bên có thể thỏa thuận.' },
      { h: 'Lệ phí trước bạ', p: 'Thông thường 0,5% giá trị nhà đất, do bên mua nộp khi đăng ký sang tên.' },
      { h: 'Phí công chứng hợp đồng', p: 'Tính theo giá trị tài sản trong hợp đồng, theo biểu phí công chứng của Nhà nước; hai bên thỏa thuận ai chịu.' },
      { h: 'Các khoản khác', list: ['Phí thẩm định hồ sơ cấp Giấy chứng nhận', 'Lệ phí cấp/đổi Giấy chứng nhận', 'Phí đo đạc (nếu cần đo lại, tách thửa)'] },
      { h: 'Trường hợp được miễn', p: 'Chuyển nhượng, tặng cho giữa những người thân (vợ chồng; cha mẹ – con; ông bà – cháu; anh chị em ruột…) có thể được miễn thuế TNCN và lệ phí trước bạ. Cần giấy tờ chứng minh quan hệ.' },
      { h: 'Lưu ý', p: 'Mức thuế/phí và trường hợp miễn giảm theo quy định hiện hành và có thể thay đổi. Hãy đối chiếu quy định mới nhất hoặc hỏi cơ quan thuế/Văn phòng đăng ký đất đai trước khi giao dịch.' },
    ],
  },
  {
    slug: 'kiem-tra-so-do-that-gia',
    title: 'Cách kiểm tra Sổ đỏ thật hay giả nhanh, chính xác',
    desc: 'Hướng dẫn phân biệt sổ đỏ thật – giả bằng mã QR, kiểm tra phôi, con dấu và đối chiếu tại cơ quan chức năng.',
    updated: '2026',
    intro: 'Kiểm tra tính pháp lý và thật – giả của Sổ đỏ là bước bắt buộc trước khi đặt cọc hay ký hợp đồng, giúp tránh rủi ro mất tiền, tranh chấp.',
    body: [
      { h: '1. Quét mã QR trên sổ mẫu mới', p: 'Sổ đỏ mẫu mới có mã QR in ở góc trên. Quét mã để đối chiếu thông tin xác thực. Bạn có thể dùng mục Tra cứu QR của Cam Lâm Land để đọc mã, rồi đối chiếu trên cổng tra cứu chính thức của cơ quan đất đai.' },
      { h: '2. Kiểm tra phôi và hoa văn', list: ['Phôi giấy đặc biệt, hoa văn sắc nét, không nhòe màu', 'Có dấu nổi/chi tiết chống giả theo mẫu', 'Số phát hành (seri) rõ ràng, không tẩy xóa'] },
      { h: '3. Kiểm tra con dấu và chữ ký', p: 'Con dấu của cơ quan cấp phải rõ nét, đúng tên cơ quan; chữ ký người có thẩm quyền không có dấu hiệu scan/in lại.' },
      { h: '4. Đối chiếu tại Văn phòng đăng ký đất đai', p: 'Cách chắc chắn nhất: mang thông tin thửa đất đến Chi nhánh Văn phòng đăng ký đất đai nơi có đất để đối chiếu với hồ sơ địa chính/ cơ sở dữ liệu.' },
      { h: 'Dấu hiệu nghi ngờ sổ giả', list: ['Mã QR không quét được hoặc thông tin không khớp', 'Thông tin trên sổ mâu thuẫn với hiện trạng đất', 'Người bán vội vàng, né tránh việc đối chiếu tại cơ quan'] },
    ],
  },
  {
    slug: 'kiem-tra-quy-hoach-dat',
    title: 'Cách kiểm tra đất có dính quy hoạch không',
    desc: 'Các cách kiểm tra thông tin quy hoạch của thửa đất: xem bản đồ quy hoạch, tra theo vị trí/toạ độ, hỏi cơ quan chức năng.',
    updated: '2026',
    intro: 'Đất "dính quy hoạch" (làm đường, công viên, đất công…) có thể bị hạn chế xây dựng, chuyển nhượng hoặc bị thu hồi. Kiểm tra kỹ trước khi mua để tránh rủi ro.',
    body: [
      { h: '1. Xem trên bản đồ quy hoạch', p: 'Dùng Bản đồ quy hoạch của Cam Lâm Land: chọn khu vực, bật lớp quy hoạch để xem thửa đất nằm trong loại đất/chức năng nào. Đây là cách nhanh để có cái nhìn ban đầu.' },
      { h: '2. Tra theo vị trí / toạ độ thửa', p: 'Nếu có sổ, bạn có thể nhập toạ độ VN-2000 (hoặc chụp bảng toạ độ) để vẽ ranh thửa lên bản đồ và đối chiếu với lớp quy hoạch.' },
      { h: '3. Xem ghi chú trên Sổ đỏ', p: 'Một số thông tin hạn chế/quy hoạch được ghi tại mục ghi chú của Giấy chứng nhận.' },
      { h: '4. Hỏi cơ quan chức năng', p: 'Để có thông tin chính thức, xin trích lục/hỏi tại Phòng Tài nguyên & Môi trường cấp huyện hoặc UBND xã/phường nơi có đất.' },
      { h: 'Lưu ý', p: 'Thông tin quy hoạch trên bản đồ mang tính tham khảo; quyết định cuối cùng nên căn cứ thông tin chính thức từ cơ quan quản lý đất đai.' },
    ],
  },
];

export const getGuide = (slug: string): Guide | undefined => GUIDES.find((g) => g.slug === slug);
