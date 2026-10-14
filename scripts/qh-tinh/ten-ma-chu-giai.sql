-- Tên mã loại đất lấy THEO CHÚ GIẢI IN TRÊN CHÍNH BẢN ĐỒ PDF của Sở (14/10/2026). Mã nào chú giải không ghi tên thì GIỮ NGUYÊN MÃ.
-- Chạy SAU khi nạp các file nap-<ban>.sql (dua-len-web-14-10.sh bước 2 tự chạy; bản chép để chạy ở D:\KhoQH\qh-pdf\ten-ma-chu-giai.sql).
-- RSN: Cam Ranh / Ninh Hòa / Khánh Vĩnh ghi "Đất rừng sản xuất là rừng tự nhiên"; Khánh Sơn ghi "Đất có rừng sản xuất là rừng tự nhiên".
UPDATE qh_pdf SET ten = 'Đất rừng sản xuất là rừng tự nhiên' WHERE ma = 'RSN' AND ban <> 'khanhson2030';
UPDATE qh_pdf SET ten = 'Đất có rừng sản xuất là rừng tự nhiên' WHERE ma = 'RSN' AND ban = 'khanhson2030';
-- DSK: Thông tư 08/2024/TT-BTNMT, Phụ lục II mục A, dòng 4.10 "Đất xây dựng công trình sự nghiệp khác" (MVB, RST, TSK không có trong danh mục → giữ mã).
UPDATE qh_pdf SET ten = 'Đất xây dựng công trình sự nghiệp khác' WHERE ma = 'DSK';

-- DIÊN KHÁNH (Điều chỉnh QHSDĐ 2030, QĐ 1564/QĐ-UBND 10/6/2025): chú giải in theo Thông tư 08/2024 — chữ là HÌNH (không có lớp chữ),
-- tên dưới đây CHÉP NGUYÊN VĂN cột "Tên loại đất" của khung chú giải (soi ảnh khổ gốc, 14/10/2026 khuya).
UPDATE qh_pdf AS z SET ten = t.ten FROM (VALUES
  ('NNP', 'Nhóm đất nông nghiệp'), ('CHN', 'Đất trồng cây hằng năm'), ('LUA', 'Đất trồng lúa'), ('LUC', 'Đất chuyên trồng lúa'),
  ('LUK', 'Đất trồng lúa còn lại'), ('HNK', 'Đất trồng cây hằng năm khác'), ('CLN', 'Đất trồng cây lâu năm'), ('LNP', 'Đất lâm nghiệp'),
  ('RDD', 'Đất rừng đặc dụng'), ('RPH', 'Đất rừng phòng hộ'), ('RSX', 'Đất rừng sản xuất'), ('RSN', 'Đất rừng sản xuất là rừng tự nhiên'),
  ('NTS', 'Đất nuôi trồng thủy sản'), ('CNT', 'Đất chăn nuôi tập trung'), ('LMU', 'Đất làm muối'), ('NKH', 'Đất nông nghiệp khác'),
  ('PNN', 'Nhóm đất phi nông nghiệp'), ('OTC', 'Đất ở'), ('ONT', 'Đất ở tại nông thôn'), ('ODT', 'Đất ở tại đô thị'),
  ('TSC', 'Đất xây dựng trụ sở cơ quan'), ('CQA', 'Đất quốc phòng, an ninh'), ('CQP', 'Đất quốc phòng'), ('CAN', 'Đất an ninh'),
  ('DSN', 'Đất xây dựng công trình sự nghiệp'), ('DVH', 'Đất xây dựng cơ sở văn hóa'), ('DXH', 'Đất xây dựng cơ sở xã hội'),
  ('DYT', 'Đất xây dựng cơ sở y tế'), ('DGD', 'Đất xây dựng cơ sở giáo dục và đào tạo'), ('DTT', 'Đất xây dựng cơ sở thể dục, thể thao'),
  ('DKH', 'Đất xây dựng cơ sở khoa học và công nghệ'), ('DMT', 'Đất xây dựng cơ sở môi trường'),
  ('DKT', 'Đất xây dựng cơ sở khí tượng thủy văn'), ('DNG', 'Đất xây dựng cơ sở ngoại giao'),
  ('DSK', 'Đất xây dựng công trình sự nghiệp khác'), ('CSK', 'Đất sản xuất, kinh doanh phi nông nghiệp'),
  ('SCC', 'Đất khu công nghiệp, cụm công nghiệp'), ('SKK', 'Đất khu công nghiệp'), ('SKN', 'Đất cụm công nghiệp'),
  ('SCT', 'Đất khu công nghệ thông tin tập trung'), ('TMD', 'Đất thương mại, dịch vụ'), ('SKC', 'Đất cơ sở sản xuất phi nông nghiệp'),
  ('SKS', 'Đất sử dụng cho hoạt động khoáng sản'), ('CCC', 'Đất sử dụng vào mục đích công cộng'), ('DGT', 'Đất công trình giao thông'),
  ('DTL', 'Đất công trình thủy lợi'), ('DCT', 'Đất công trình cấp nước, thoát nước'), ('DPC', 'Đất công trình phòng, chống thiên tai'),
  ('DDD', 'Đất có di tích lịch sử - văn hóa, danh lam thắng cảnh, di sản thiên nhiên'), ('DRA', 'Đất công trình xử lý chất thải'),
  ('DNL', 'Đất công trình năng lượng, chiếu sáng công cộng'),
  ('DBV', 'Đất công trình hạ tầng bưu chính, viễn thông, công nghệ thông tin'), ('DCH', 'Đất chợ dân sinh, chợ đầu mối'),
  ('DKV', 'Đất khu vui chơi, giải trí công cộng, sinh hoạt cộng đồng'), ('TON', 'Đất tôn giáo'), ('TIN', 'Đất tín ngưỡng'),
  ('NTD', 'Đất nghĩa trang, nhà tang lễ, cơ sở hỏa táng; đất cơ sở lưu trữ tro cốt'), ('TVC', 'Đất có mặt nước chuyên dùng'),
  ('MNC', 'Đất có mặt nước chuyên dùng dạng ao, hồ, đầm, phá'), ('SON', 'Đất có mặt nước dạng sông, ngòi, kênh, rạch, suối'),
  ('PNK', 'Đất phi nông nghiệp khác'), ('CSD', 'Nhóm đất chưa sử dụng'),
  ('CGT', 'Đất do Nhà nước thu hồi theo quy định của pháp luật đất đai chưa giao, chưa cho thuê'), ('BCS', 'Đất bằng chưa sử dụng'),
  ('DCS', 'Đất đồi núi chưa sử dụng'), ('MCS', 'Đất có mặt nước chưa sử dụng')
) AS t(ma, ten) WHERE z.ban = 'dienkhanh2030' AND z.ma = t.ma;
