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
UPDATE users SET boost_expires_at = pkg_expires_at WHERE boost_expires_at IS NULL AND pkg_expires_at IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pkg_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pkg_tier TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pkg_expires_at TIMESTAMPTZ;
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
CREATE TABLE IF NOT EXISTS news (id SERIAL PRIMARY KEY, title TEXT NOT NULL, url TEXT UNIQUE NOT NULL, source TEXT, image TEXT, summary TEXT, published_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS chat_reads (room TEXT NOT NULL, user_id INT NOT NULL, received_id INT NOT NULL DEFAULT 0, read_id INT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (room, user_id));

-- ── Dọn dữ liệu: không cho giá âm (đưa về dương) ──
UPDATE listings SET price = ABS(price) WHERE price < 0;
`;

/** Idempotent schema upgrade — runs every boot (roles, verification, listing fields, images). */
export async function migrate(): Promise<void> {
  await pool.query(SQL);
  console.log('[migrate] schema up to date (roles + verification + listing fields + images + leads)');
}
