-- ============================================================================
--  Demo real-estate listings around Cam Lâm, Khánh Hòa (WGS84 points)
--  (Admin user is created by the backend on boot; GIS layers by the worker.)
-- ============================================================================
INSERT INTO listings (title, description, price, area, property_type, address, ward, bedrooms, images, geom)
VALUES
 ('Đất nền ven biển Bãi Dài',
  'Lô đất mặt tiền hướng biển khu Bãi Dài, pháp lý sổ đỏ, phù hợp xây homestay/resort mini.',
  4200000000, 250, 'land', 'Đường ven biển Bãi Dài', 'Cam Hải Đông', NULL,
  ARRAY['https://picsum.photos/seed/camlam1/800/600','https://picsum.photos/seed/camlam1b/800/600'],
  ST_SetSRID(ST_MakePoint(109.1905, 12.0455), 4326)),

 ('Nhà phố trung tâm Cam Đức',
  'Nhà 1 trệt 1 lầu mặt tiền gần chợ Cam Đức, tiện kinh doanh, khu dân cư hiện hữu.',
  2800000000, 96, 'house', 'Thị trấn Cam Đức', 'Cam Đức', 3,
  ARRAY['https://picsum.photos/seed/camlam2/800/600'],
  ST_SetSRID(ST_MakePoint(109.0921, 12.0762), 4326)),

 ('Biệt thự nghỉ dưỡng ven biển',
  'Biệt thự 2 tầng sân vườn, cách biển 300m, nội thất cao cấp, sổ hồng riêng.',
  9800000000, 420, 'villa', 'Khu nghỉ dưỡng Cam Hải', 'Cam Hải Đông', 4,
  ARRAY['https://picsum.photos/seed/camlam3/800/600','https://picsum.photos/seed/camlam3b/800/600'],
  ST_SetSRID(ST_MakePoint(109.1840, 12.0605), 4326)),

 ('Đất nông nghiệp Cam Hải Tây',
  'Đất trồng cây lâu năm 1.000m², tiện làm nông trại/nghỉ dưỡng sinh thái, giá đầu tư.',
  1500000000, 1000, 'farm', 'Cam Hải Tây', 'Cam Hải Tây', NULL,
  ARRAY['https://picsum.photos/seed/camlam4/800/600'],
  ST_SetSRID(ST_MakePoint(109.1290, 12.0905), 4326)),

 ('Căn hộ gần trung tâm hành chính',
  'Căn hộ 2 phòng ngủ, view thoáng, gần trung tâm hành chính huyện Cam Lâm.',
  1750000000, 65, 'apartment', 'Trung tâm Cam Đức', 'Cam Đức', 2,
  ARRAY['https://picsum.photos/seed/camlam5/800/600'],
  ST_SetSRID(ST_MakePoint(109.0952, 12.0728), 4326)),

 ('Đất thổ cư Cam Thành Bắc',
  'Lô đất thổ cư 150m² đường bê tông, gần trường học, dân cư đông đúc.',
  1250000000, 150, 'land', 'Cam Thành Bắc', 'Cam Thành Bắc', NULL,
  ARRAY['https://picsum.photos/seed/camlam6/800/600'],
  ST_SetSRID(ST_MakePoint(109.0748, 12.1102), 4326)),

 ('Mặt bằng kinh doanh QL1A',
  'Mặt bằng mặt tiền Quốc lộ 1A, vị trí đắc địa cho showroom/cửa hàng, diện tích lớn.',
  6500000000, 320, 'commercial', 'Quốc lộ 1A, Cam Đức', 'Cam Đức', NULL,
  ARRAY['https://picsum.photos/seed/camlam7/800/600'],
  ST_SetSRID(ST_MakePoint(109.1005, 12.0848), 4326)),

 ('Đất vườn Suối Tân',
  'Đất vườn 2.000m² có suối tự nhiên, không khí trong lành, thích hợp farmstay.',
  1900000000, 2000, 'farm', 'Suối Tân', 'Suối Tân', NULL,
  ARRAY['https://picsum.photos/seed/camlam8/800/600'],
  ST_SetSRID(ST_MakePoint(109.0402, 12.1305), 4326));
