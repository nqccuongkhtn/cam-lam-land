-- ============================================================================
--  DỰ ÁN NỔI BẬT TRÊN TRANG CHỦ — THÔNG TIN THẬT, CÓ KIỂM CHỨNG
-- ----------------------------------------------------------------------------
--  Chạy:
--    docker compose exec -T postgis psql -U camlam -d camlam_gis < scripts/du-an/du-an-noi-bat.sql
--  Chạy lại nhiều lần vẫn an toàn (xoá hết rồi nạp lại).
--
--  TRƯỚC ĐÂY bảng này có 5 dự án ghi chung chung ("Khu nghỉ dưỡng Bãi Dài Resort",
--  "Khu đô thị trung tâm Cam Đức"…) kèm ảnh Unsplash bất kỳ — không tra được ở đâu.
--  Nay thay bằng dự án CÓ THẬT, mỗi dòng đều tra được nguồn công khai (tra ngày
--  22/9/2026). Tên chủ đầu tư, diện tích, số quyết định đều lấy đúng như nguồn ghi.
--
--  ⚠️ VỀ ẢNH — ĐỌC KỸ:
--  Ảnh phối cảnh chính thức của các dự án là ảnh có bản quyền của chủ đầu tư,
--  KHÔNG lấy về dùng được. Nên ở đây chỉ dùng ảnh mình có thật:
--    · Ba dự án ven biển dùng ảnh chụp KHÔNG ẢNH dải Bãi Dài trong public/bai-dai/ —
--      đúng là khu đất các dự án đó nằm, nên dùng là trung thực.
--    · Khu đô thị mới Cam Lâm và Khu công nghiệp Suối Dầu thì KHÔNG CÓ ảnh thật,
--      tạm để trống (thẻ hiện ô xám). Có ảnh chụp thật thì thay vào cột image_url.
--    · CHỈ ĐƯA DỰ ÁN BẤT ĐỘNG SẢN — không đưa khu công nghiệp vào mục này.
--
--  ⚠️ VỀ ĐỊA GIỚI: từ 1/7/2025 bỏ cấp huyện, xã Cam Hải Đông và Suối Tân đã nhập
--  vào xã mới. Ở đây vẫn ghi tên xã CŨ vì hồ sơ dự án và thị trường đang gọi vậy.
-- ============================================================================

BEGIN;

DELETE FROM featured_projects;

INSERT INTO featured_projects (name, status, scale, location, image_url, sort) VALUES

-- 1) Siêu dự án lớn nhất Khánh Hoà. Liên danh 5 doanh nghiệp do Vinhomes đứng đầu:
--    Vinhomes · Phát Đạt · Trường Lộc · Đô thị Xanh · Phú Thọ Land.
--    Tổng vốn 285.267 tỷ đồng, trong đó 25.000 tỷ dành cho bồi thường, tái định cư.
--    Trải trên địa bàn huyện Cam Lâm và TP Cam Ranh. Kế hoạch 2026–2030 làm hạ tầng
--    chính, khu đô thị lõi và nhà mẫu đầu tiên.
--    Nguồn: VnExpress "Liên danh Vinhomes dự kiến triển khai khu đô thị 10 tỷ USD ở Khánh Hòa từ 2026".
('Khu đô thị mới Cam Lâm',
 'Đang bồi thường · tái định cư',
 '10.350 ha · vốn 285.267 tỷ · liên danh Vinhomes',
 'Huyện Cam Lâm và TP Cam Ranh',
 -- Ảnh: KHÔNG dùng phối cảnh của chủ đầu tư (có bản quyền). Đây là ảnh chụp
 -- thật dải Bãi Dài — nằm trong vùng dự án, nên dùng là trung thực.
 '/bai-dai/bd-05.webp', 10),

-- 2) Golden Bay giai đoạn 1 — Hưng Thịnh. 79 ha, Bắc bán đảo Cam Ranh.
--    Nguồn: trang dự án của Hưng Thịnh và các sàn phân phối.
('Golden Bay (giai đoạn 1)',
 'Đã triển khai',
 '79 ha · đất nền ven biển · CĐT Hưng Thịnh',
 'Bắc bán đảo Cam Ranh, xã Cam Hải Đông',
 '/bai-dai/bd-04.webp', 20),

-- 3) Golden Bay 602 — giai đoạn 2, 55,59 ha, mặt đường Nguyễn Tất Thành.
--    Khoảng 2.083 nền, diện tích phổ biến 108–144 m².
('Golden Bay 602',
 'Đã triển khai',
 '55,59 ha · ~2.083 nền 108–144 m² · CĐT Hưng Thịnh',
 'Đường Nguyễn Tất Thành, xã Cam Hải Đông',
 '/bai-dai/bd-12.webp', 30),

-- 4) The Arena Cam Ranh — khu nghỉ dưỡng ĐANG HOẠT ĐỘNG (có trên Agoda, Tripadvisor).
--    Lô TT13, D14D, TT9B, Khu 4, Bắc bán đảo Cam Ranh. CĐT: Công ty CP Trần Thái Cam Ranh.
('The Arena Cam Ranh',
 'Đang hoạt động',
 '29,3 ha · nghỉ dưỡng biển · CĐT Trần Thái Cam Ranh',
 'Khu 4 Bắc bán đảo Cam Ranh, xã Cam Hải Đông',
 '/bai-dai/bd-02.webp', 40),

-- 5) Mövenpick Resort Cam Ranh — khu nghỉ dưỡng 5 sao ĐANG HOẠT ĐỘNG trên dải Bãi Dài.
--    Địa chỉ: Lô D12, Đại lộ Nguyễn Tất Thành, xã Cam Hải Đông, huyện Cam Lâm.
--    Quy mô phòng theo công bố: 500 phòng hướng biển — 132 studio, 250 phòng khách sạn,
--    118 biệt thự có hồ bơi riêng.
--    ⚠️ Chưa tra được chủ đầu tư và diện tích đất nên KHÔNG GHI, tránh bịa số.
--    Nguồn: trang chính thức của Accor/Mövenpick, Tripadvisor (mục Cam Hai Dong, Cam Lam District).
('Mövenpick Resort Cam Ranh',
 'Đang hoạt động',
 '500 phòng hướng biển · 118 biệt thự có hồ bơi riêng',
 'Lô D12 Đại lộ Nguyễn Tất Thành, xã Cam Hải Đông',
 '/bai-dai/bd-10.webp', 50);

COMMIT;

-- Xem lại:
--   SELECT sort, name, status, scale, location FROM featured_projects ORDER BY sort;
