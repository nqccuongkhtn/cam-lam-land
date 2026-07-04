import { pool } from './db.ts';

const SQL = `
-- ── Tài khoản & vai trò (GĐ1) ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier           TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar         TEXT;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role='user' WHERE role='sales';
ALTER TABLE users ADD  CONSTRAINT users_role_check CHECK (role IN ('user','admin','gis'));
CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY, email TEXT NOT NULL, code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL, used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verif_email_idx ON email_verifications (email);

-- ── Tin đăng đầy đủ trường (GĐ2) ──
ALTER TABLE listings ADD COLUMN IF NOT EXISTS bathrooms     INT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS direction     TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS legal         TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS frontage      NUMERIC(8,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_name  TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS boosted       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS tier          TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS bumped_at     TIMESTAMPTZ;
UPDATE listings SET tier='gold' WHERE boosted=true AND tier='normal';

-- ── Ảnh lưu trực tiếp trong Postgres (GĐ2) ──
CREATE TABLE IF NOT EXISTS listing_images (
  id         SERIAL PRIMARY KEY,
  owner_id   INT REFERENCES users(id) ON DELETE SET NULL,
  listing_id INT REFERENCES listings(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL,
  bytes      BYTEA NOT NULL,
  size       INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listing_images_listing_idx ON listing_images (listing_id);

-- ── Lead: khách quan tâm / xem số liên hệ (theo từng tin) ──
CREATE TABLE IF NOT EXISTS listing_leads (
  id         SERIAL PRIMARY KEY,
  listing_id INT REFERENCES listings(id) ON DELETE CASCADE,
  user_id    INT REFERENCES users(id)    ON DELETE CASCADE,
  name       TEXT,
  phone      TEXT,
  views      INT NOT NULL DEFAULT 1,
  first_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);
CREATE INDEX IF NOT EXISTS listing_leads_listing_idx ON listing_leads (listing_id);

-- ── Index tăng tốc truy vấn nóng (chịu tải lớn) ──
CREATE INDEX IF NOT EXISTS listings_created_by_idx ON listings (created_by);
CREATE INDEX IF NOT EXISTS listings_ward_idx       ON listings (ward);
CREATE INDEX IF NOT EXISTS listings_list_idx       ON listings (status, boosted DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS users_role_idx          ON users (role);

-- ── Quảng cáo bản đồ: logo tròn theo xã, độc quyền, có thời hạn ──
CREATE TABLE IF NOT EXISTS map_ads (
  id               SERIAL PRIMARY KEY,
  advertiser_name  TEXT NOT NULL,
  advertiser_phone TEXT NOT NULL,
  image_url        TEXT,
  wards            TEXT[] NOT NULL DEFAULT '{}',
  points           JSONB  NOT NULL DEFAULT '[]',
  package          TEXT,
  style            TEXT NOT NULL DEFAULT 'seal',
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active',
  created_by       INT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS map_ads_active_idx ON map_ads (status, expires_at);
ALTER TABLE map_ads ADD COLUMN IF NOT EXISTS style TEXT NOT NULL DEFAULT 'seal';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS boost_quota INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS boost_used INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS post_quota INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS post_used INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS post_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pkg_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pkg_tier TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pkg_expires_at TIMESTAMPTZ;
UPDATE users SET boost_expires_at = pkg_expires_at WHERE boost_expires_at IS NULL AND pkg_expires_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  amount INT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_sub_user_idx ON push_subscriptions (user_id);
CREATE TABLE IF NOT EXISTS listing_usage (
  user_id INT NOT NULL,
  ym      TEXT NOT NULL,
  posts   INT NOT NULL DEFAULT 0,
  boosts  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, ym)
);

-- ── Khách gửi bán / ký gửi BĐS (thu thập thông tin từ khách) ──
CREATE TABLE IF NOT EXISTS consignments (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  property_type TEXT,
  ward          TEXT,
  address       TEXT,
  area          NUMERIC,
  price_expect  TEXT,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consignments_idx ON consignments (status, created_at DESC);

-- ── CamInvest: khách đăng ký quan tâm góp vốn đầu tư ──
CREATE TABLE IF NOT EXISTS invest_leads (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  amount      TEXT,
  tenure      TEXT,
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invest_leads_idx ON invest_leads (status, created_at DESC);

-- ── Chat (cộng đồng + hỗ trợ admin), lưu trữ ──
CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  room       TEXT NOT NULL,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_room_idx ON chat_messages (room, id);
CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS news (id SERIAL PRIMARY KEY, title TEXT NOT NULL, url TEXT UNIQUE NOT NULL, source TEXT, image TEXT, summary TEXT, published_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS chat_reads (room TEXT NOT NULL, user_id INT NOT NULL, received_id INT NOT NULL DEFAULT 0, read_id INT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (room, user_id));

-- ── Dọn dữ liệu: không cho giá âm (đưa về dương) ──
UPDATE listings SET price = ABS(price) WHERE price < 0;
`;

/** Idempotent schema upgrade — runs every boot (roles, verification, listing fields, images). */
export async function migrate(): Promise<void> {
  await pool.query(SQL).catch((e: any) => console.error('[migrate] SQL chính lỗi (bỏ qua, chạy tiếp):', e?.message || e));
  // Bỏ dấu tiếng Việt cho tìm kiếm KHÔNG DẤU — IMMUTABLE, không cần extension. Khớp CHÍNH XÁC với vnNoAccent() ở lib/vn.ts.
  await pool.query(`CREATE OR REPLACE FUNCTION vn_unaccent(t text) RETURNS text AS $$
    SELECT translate(lower($1),
      'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ',
      'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
  $$ LANGUAGE sql IMMUTABLE`).catch((e: any) => console.error('[migrate] vn_unaccent lỗi:', e?.message || e));
  // Tư vấn đầu tư — chạy RIÊNG từng câu (idempotent) để KHÔNG bị cuốn theo lỗi/rollback của khối SQL lớn.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_advisor BOOLEAN NOT NULL DEFAULT false`).catch((e: any) => console.error('[migrate] is_advisor lỗi:', e?.message || e));
  // Cột gói dịch vụ — tạo RIÊNG từng cột để CHẮC CHẮN có (không bị rollback theo khối SQL lớn).
  for (const c of ['pkg_id TEXT', 'pkg_tier TEXT', 'pkg_expires_at TIMESTAMPTZ', 'boost_quota INT NOT NULL DEFAULT 0', 'boost_used INT NOT NULL DEFAULT 0', 'post_quota INT NOT NULL DEFAULT 0', 'post_used INT NOT NULL DEFAULT 0', 'post_expires_at TIMESTAMPTZ', 'boost_expires_at TIMESTAMPTZ']) {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${c}`).catch((e: any) => console.error('[migrate] user col lỗi:', e?.message || e));
  }
  // ── Cho thuê: cột giao dịch (sale/rent) + nới ràng buộc loại BĐS (thêm phòng trọ/văn phòng/kho xưởng) ──
  await pool.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal TEXT NOT NULL DEFAULT 'sale'`).catch((e: any) => console.error('[migrate] deal lỗi:', e?.message || e));
  await pool.query(`ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_property_type_check`).catch((e: any) => console.error('[migrate] drop property_type check lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS listings_deal_idx ON listings (deal)`).catch((e: any) => console.error('[migrate] deal index lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS chat_messages_room_user_idx ON chat_messages (room, user_id, id)`).catch((e: any) => console.error('[migrate] index lỗi:', e?.message || e));
  // Index không gian (GiST) cho bản đồ — tăng tốc lọc theo khung nhìn (bbox &&) rất nhiều.
  await pool.query(`CREATE INDEX IF NOT EXISTS gis_features_geom_gix ON gis_features USING GIST (geom)`).catch((e: any) => console.error('[migrate] gis geom index lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS gis_features_layer_idx ON gis_features (layer_id)`).catch((e: any) => console.error('[migrate] gis layer index lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id)`).catch((e: any) => console.error('[migrate] payments index lỗi:', e?.message || e));
  // Đếm lượt OCR theo nguồn/ngày (cho báo cáo admin).
  await pool.query(`CREATE TABLE IF NOT EXISTS ocr_usage (engine TEXT NOT NULL, ymd TEXT NOT NULL, count INT NOT NULL DEFAULT 0, PRIMARY KEY (engine, ymd))`).catch((e: any) => console.error('[migrate] ocr_usage lỗi:', e?.message || e));
  // Doanh nghiệp tiêu biểu (trang chủ) — admin quản lý.
  await pool.query(`CREATE TABLE IF NOT EXISTS featured_partners (id SERIAL PRIMARY KEY, name TEXT NOT NULL, logo_url TEXT, sort INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`).catch((e: any) => console.error('[migrate] featured_partners lỗi:', e?.message || e));
  await pool.query(`INSERT INTO featured_partners (name, sort) SELECT v.name, v.sort FROM (VALUES ('Vingroup', 1), ('Cam Lâm Land', 2)) AS v(name, sort) WHERE NOT EXISTS (SELECT 1 FROM featured_partners)`).catch((e: any) => console.error('[migrate] seed partners lỗi:', e?.message || e));
  // Dự án bất động sản nổi bật (trang chủ) — admin quản lý.
  await pool.query(`CREATE TABLE IF NOT EXISTS featured_projects (id SERIAL PRIMARY KEY, name TEXT NOT NULL, status TEXT, scale TEXT, location TEXT, image_url TEXT, sort INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`).catch((e: any) => console.error('[migrate] featured_projects lỗi:', e?.message || e));
  await pool.query(`INSERT INTO featured_projects (name, status, scale, location, image_url, sort)
    SELECT v.name, v.status, v.scale, v.location, v.image_url, v.sort FROM (VALUES
      ('Đô thị mới sân bay Cam Lâm', 'Đang thu hồi bồi thường', 'Đô thị sân bay', 'Cam Lâm, Khánh Hòa', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=60', 1),
      ('Khu đô thị trung tâm Cam Đức', 'Đang cập nhật', 'Trung tâm huyện', 'Cam Đức, Cam Lâm', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=60', 3)
    ) AS v(name, status, scale, location, image_url, sort)
    WHERE NOT EXISTS (SELECT 1 FROM featured_projects)`).catch((e: any) => console.error('[migrate] seed projects lỗi:', e?.message || e));
  // Bổ sung dự án resort mở bán (idempotent theo tên) — thêm dù bảng đã có dữ liệu.
  await pool.query(`INSERT INTO featured_projects (name, status, scale, location, image_url, sort)
    SELECT v.name, v.status, v.scale, v.location, v.image_url, v.sort FROM (VALUES
      ('Golden Bay 1', 'Đang mở bán', 'Đất nền ven biển', 'Bãi Dài, Cam Lâm', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=60', 5),
      ('Golden Bay 2', 'Đang mở bán', 'Đất nền nghỉ dưỡng', 'Bãi Dài, Cam Lâm', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=60', 6),
      ('Khu nghỉ dưỡng Bãi Dài Resort', 'Đang mở bán', 'Resort ven biển', 'Cam Hải Đông, Cam Lâm', 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=800&q=60', 7)
    ) AS v(name, status, scale, location, image_url, sort)
    WHERE NOT EXISTS (SELECT 1 FROM featured_projects fp WHERE fp.name = v.name)`).catch((e: any) => console.error('[migrate] thêm dự án resort lỗi:', e?.message || e));
  await pool.query(`UPDATE featured_projects SET status = 'Đang thu hồi bồi thường' WHERE name = 'Đô thị mới sân bay Cam Lâm' AND status = 'Đang quy hoạch'`).catch((e: any) => console.error('[migrate] cập nhật trạng thái sân bay lỗi:', e?.message || e));
  await pool.query(`DELETE FROM featured_projects WHERE name = 'Khu du lịch Bãi Dài'`).catch((e: any) => console.error('[migrate] xoá Khu du lịch Bãi Dài lỗi:', e?.message || e));
  console.log('[migrate] schema up to date');
}
