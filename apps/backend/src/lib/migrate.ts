import { createHash } from 'node:crypto';
import { pool } from './db.ts';
import { vnNoAccent, vnTranslateTable } from './vn.ts';

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
ALTER TABLE users ADD  CONSTRAINT users_role_check CHECK (role IN ('user','admin','gis','vanban','hotlist','danhmuc','xacthuc'));
-- MỘT NGƯỜI CÓ THỂ GIỮ NHIỀU VAI TRÒ: cột roles là DANH SÁCH vai trò của tài khoản đó.
-- Cột role cũ vẫn giữ, coi như "vai trò chính" (để chỗ nào chưa kịp đổi vẫn chạy bình thường).
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{}';
UPDATE users SET roles = ARRAY[role] WHERE roles IS NULL OR cardinality(roles) = 0;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_roles_check;
ALTER TABLE users ADD  CONSTRAINT users_roles_check CHECK (roles <@ ARRAY['user','admin','gis','vanban','hotlist','danhmuc','xacthuc']::text[]);
CREATE INDEX IF NOT EXISTS users_roles_idx ON users USING GIN (roles);
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

-- ── Xác thực tin & đánh giá môi giới (admin quản lý) ──
ALTER TABLE listings ADD COLUMN IF NOT EXISTS verified     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS verified_at  TIMESTAMPTZ;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS rating       NUMERIC(2,1) NOT NULL DEFAULT 0;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0;

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
-- Ví trả phí công cụ Lập danh mục hồ sơ: số dư (đồng) + nhật ký lượt chạy đã trừ tiền.
CREATE TABLE IF NOT EXISTS danhmuc_credits (user_id INT PRIMARY KEY, balance BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS danhmuc_jobs (id SERIAL PRIMARY KEY, user_id INT, pages INT NOT NULL DEFAULT 0, cost BIGINT NOT NULL DEFAULT 0, doc_count INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS user_ai_keys (user_id INT PRIMARY KEY, enc TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS news (id SERIAL PRIMARY KEY, title TEXT NOT NULL, url TEXT UNIQUE NOT NULL, source TEXT, image TEXT, summary TEXT, published_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS chat_reads (room TEXT NOT NULL, user_id INT NOT NULL, received_id INT NOT NULL DEFAULT 0, read_id INT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (room, user_id));

-- ── Dọn dữ liệu: không cho giá âm (đưa về dương) ──
UPDATE listings SET price = ABS(price) WHERE price < 0;
`;

/** Idempotent schema upgrade — runs every boot (roles, verification, listing fields, images). */
export async function migrate(): Promise<void> {
  await pool.query(SQL).catch((e: any) => console.error('[migrate] SQL chính lỗi (bỏ qua, chạy tiếp):', e?.message || e));
  // ── Bỏ dấu tiếng Việt cho tìm kiếm KHÔNG DẤU ──────────────────────────────
  // Bảng đổi chữ được SINH TỰ ĐỘNG từ vnNoAccent() (lib/vn.ts) — nơi DUY NHẤT định nghĩa quy tắc
  // — nên hàm SQL và hàm JS KHÔNG THỂ lệch nhau (trước đây chép tay 2 nơi, lệch là tìm kiếm sai
  // âm thầm). Gồm cả chữ HOA có dấu và chữ gõ kiểu TÁCH DẤU. IMMUTABLE để dùng được cho index hàm.
  const { from: vnFrom, to: vnTo } = vnTranslateTable();
  const vnFp = createHash('sha1').update(vnFrom + '|' + vnTo).digest('hex').slice(0, 12);
  const sq = (x: string) => x.replace(/'/g, "''");
  await pool.query(`CREATE OR REPLACE FUNCTION vn_unaccent(t text) RETURNS text AS $$
    SELECT translate(lower($1), '${sq(vnFrom)}', '${sq(vnTo)}')
  $$ LANGUAGE sql IMMUTABLE`).catch((e: any) => console.error('[migrate] vn_unaccent lỗi:', e?.message || e));

  // ══════════════════════════════════════════════════════════════════════════
  // INDEX TĂNG TỐC & CHỊU TẢI cho các truy vấn NÓNG của tin đăng (lọc/tìm/bản đồ).
  // Idempotent (IF NOT EXISTS), KHÔNG đụng dữ liệu. Đặt sau vn_unaccent vì có index hàm.
  // ══════════════════════════════════════════════════════════════════════════
  // Lọc theo loại BĐS (property_type = $) — trước đây quét toàn bảng.
  await pool.query(`CREATE INDEX IF NOT EXISTS listings_property_type_idx ON listings (property_type)`).catch((e: any) => console.error('[migrate] idx property_type lỗi:', e?.message || e));
  // Lọc theo XÃ KHÔNG DẤU (vn_unaccent(ward) = $) — dùng nhiều ở trang đích SEO & tìm kiếm. Index HÀM khớp đúng biểu thức truy vấn.
  await pool.query(`CREATE INDEX IF NOT EXISTS listings_ward_noaccent_idx ON listings (vn_unaccent(COALESCE(ward,'')))`).catch((e: any) => console.error('[migrate] idx ward_noaccent lỗi:', e?.message || e));
  // Bản đồ: lọc theo khung nhìn (geom && bbox) — index KHÔNG GIAN GiST, tăng tốc rất nhiều khi tin nhiều.
  await pool.query(`CREATE INDEX IF NOT EXISTS listings_geom_gix ON listings USING GIST (geom)`).catch((e: any) => console.error('[migrate] idx listings geom lỗi:', e?.message || e));
  // Duyệt mặc định: lọc trạng thái hiển thị + theo giao dịch, sắp theo lần đẩy mới nhất. Partial index cho gọn & nhanh.
  await pool.query(`CREATE INDEX IF NOT EXISTS listings_browse_idx ON listings (deal, (COALESCE(bumped_at, created_at)) DESC) WHERE status NOT IN ('hidden','pending')`).catch((e: any) => console.error('[migrate] idx browse lỗi:', e?.message || e));
  // Tìm kiếm chữ KHÔNG DẤU dạng LIKE '%...%' — cần GIN trigram (pg_trgm) mới nhanh (btree bó tay với %đầu%).
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`).catch((e: any) => console.error('[migrate] pg_trgm lỗi (bỏ qua, LIKE vẫn chạy):', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS listings_search_trgm_idx ON listings USING gin (vn_unaccent(COALESCE(title,'')||' '||COALESCE(description,'')||' '||COALESCE(address,'')||' '||COALESCE(ward,'')) gin_trgm_ops)`).catch((e: any) => console.error('[migrate] idx search trgm lỗi:', e?.message || e));
  // Cập nhật thống kê để planner chọn đúng index.
  await pool.query(`ANALYZE listings`).catch(() => {});

  // ── AN TOÀN KHI ĐỔI QUY TẮC BỎ DẤU ────────────────────────────────────────
  // 2 index ở trên dựng THEO hàm vn_unaccent(). Postgres KHÔNG tự dựng lại khi hàm đổi định nghĩa
  // → index cũ sẽ trả kết quả SAI mà không báo gì. Nên lưu "vân tay" của bảng đổi chữ: khác lần
  // trước thì dựng lại 2 index đó. Bình thường vân tay trùng → bỏ qua, không tốn gì.
  const fpCu = await pool.query(`SELECT value->>'fp' AS fp FROM app_config WHERE key='vn_unaccent_fp'`)
    .then((r: any) => r.rows[0]?.fp as string | undefined).catch(() => undefined);
  if (fpCu !== vnFp) {
    console.log(`[migrate] quy tắc bỏ dấu đã đổi (${fpCu ?? 'chưa lưu'} → ${vnFp}) — dựng lại index liên quan…`);
    for (const idx of ['listings_ward_noaccent_idx', 'listings_search_trgm_idx']) {
      await pool.query(`REINDEX INDEX ${idx}`).catch((e: any) => console.error(`[migrate] REINDEX ${idx} lỗi:`, e?.message || e));
    }
    await pool.query(`INSERT INTO app_config (key, value) VALUES ('vn_unaccent_fp', jsonb_build_object('fp', $1::text))
                      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [vnFp])
      .catch((e: any) => console.error('[migrate] lưu vân tay bỏ dấu lỗi:', e?.message || e));
  }
  // TỰ KIỂM: hàm SQL và hàm JS phải cho ra kết quả Y HỆT trên tên thật (kể cả chữ gõ TÁCH DẤU).
  // Lệch nhau = lọc theo xã trả rỗng mà không có lỗi nào → phải GÀO LÊN trong log.
  const mauTest = ['Cam Đức', 'CAM HẢI ĐÔNG', 'Suối Dầu', 'Xã Cam Phước Tây', 'Đất ở đô thị', 'Cam Đức'.normalize('NFD')];
  await pool.query(`SELECT vn_unaccent(x) AS v FROM unnest($1::text[]) WITH ORDINALITY AS t(x, i) ORDER BY i`, [mauTest])
    .then((r: any) => {
      const lech = mauTest.map((s, i) => ({ chuoi: s, sql: r.rows[i]?.v, js: vnNoAccent(s) })).filter((x) => x.sql !== x.js);
      if (lech.length) console.error('[migrate] *** CẢNH BÁO: hàm bỏ dấu SQL và JS KHÔNG khớp — tìm kiếm & lọc theo xã sẽ SAI:', JSON.stringify(lech));
      else console.log('[migrate] bỏ dấu tiếng Việt: SQL khớp JS (' + vnFp + ')');
    })
    .catch((e: any) => console.error('[migrate] tự kiểm bỏ dấu lỗi:', e?.message || e));

  // Hạn dùng gói TẠO VIDEO BẢN ĐỒ (gói bán riêng). NULL = chưa mua/đã hết hạn.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS video_expires_at TIMESTAMPTZ`).catch((e: any) => console.error('[migrate] video_expires_at lỗi:', e?.message || e));

  // Tư vấn đầu tư — chạy RIÊNG từng câu (idempotent) để KHÔNG bị cuốn theo lỗi/rollback của khối SQL lớn.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_advisor BOOLEAN NOT NULL DEFAULT false`).catch((e: any) => console.error('[migrate] is_advisor lỗi:', e?.message || e));
  // Cột gói dịch vụ — tạo RIÊNG từng cột để CHẮC CHẮN có (không bị rollback theo khối SQL lớn).
  for (const c of ['pkg_id TEXT', 'pkg_tier TEXT', 'pkg_expires_at TIMESTAMPTZ', 'boost_quota INT NOT NULL DEFAULT 0', 'boost_used INT NOT NULL DEFAULT 0', 'post_quota INT NOT NULL DEFAULT 0', 'post_used INT NOT NULL DEFAULT 0', 'post_expires_at TIMESTAMPTZ', 'boost_expires_at TIMESTAMPTZ']) {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${c}`).catch((e: any) => console.error('[migrate] user col lỗi:', e?.message || e));
  }
  // ── Cho thuê: cột giao dịch (sale/rent) + nới ràng buộc loại BĐS (thêm phòng trọ/văn phòng/kho xưởng) ──
  await pool.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal TEXT NOT NULL DEFAULT 'sale'`).catch((e: any) => console.error('[migrate] deal lỗi:', e?.message || e));
  await pool.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS views INT NOT NULL DEFAULT 0`).catch((e: any) => console.error('[migrate] views lỗi:', e?.message || e));
  await pool.query(`ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS thumb BYTEA`).catch((e: any) => console.error('[migrate] thumb lỗi:', e?.message || e));
  // Kho "điểm/sản phẩm đã lưu" trên bản đồ theo tài khoản (sales lưu sản phẩm; khách lưu thửa quan tâm; admin xem tất cả).
  await pool.query(`CREATE TABLE IF NOT EXISTS saved_places (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lng DOUBLE PRECISION NOT NULL, lat DOUBLE PRECISION NOT NULL,
    x_vn DOUBLE PRECISION, y_vn DOUBLE PRECISION,
    note TEXT, price TEXT, area TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] saved_places lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS saved_places_user_idx ON saved_places (user_id)`).catch((e: any) => console.error('[migrate] saved_places index lỗi:', e?.message || e));
  await pool.query(`ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}'`).catch((e: any) => console.error('[migrate] saved_places images lỗi:', e?.message || e));
  // Tin DEMO cũ lỡ dùng ảnh picsum ngẫu nhiên (rau củ, tượng...) → thay bằng ảnh nhà đất unsplash theo loại.
  // Idempotent: chỉ đụng tin CÒN ảnh picsum; chạy xong không khớp nữa nên lần deploy sau bỏ qua.
  await pool.query(`
    UPDATE listings SET images = CASE WHEN property_type IN ('land','farm')
      THEN ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=60','https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=60']
      ELSE ARRAY['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=60','https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=60','https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=800&q=60'] END
    WHERE array_to_string(images, ',') LIKE '%picsum%'
  `).catch((e: any) => console.error('[migrate] thay ảnh demo lỗi:', e?.message || e));
  // Đăng ký nhận tin qua email (form ở chân trang) — lưu lead thật thay vì chỉ hiện alert.
  await pool.query(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] newsletter_subscribers lỗi:', e?.message || e));
  // SĐT chủ đất + hoa hồng — để sales ghi chú tư vấn khách (chủ điểm & admin xem được).
  await pool.query(`ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS owner_phone TEXT`).catch((e: any) => console.error('[migrate] saved_places owner_phone lỗi:', e?.message || e));
  await pool.query(`ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS commission TEXT`).catch((e: any) => console.error('[migrate] saved_places commission lỗi:', e?.message || e));
  // Tên chủ đất + ghi chú của khách (sales ghi lại khách nhận xét BĐS thế nào).
  await pool.query(`ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS owner_name TEXT`).catch((e: any) => console.error('[migrate] saved_places owner_name lỗi:', e?.message || e));
  await pool.query(`ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS cust_note TEXT`).catch((e: any) => console.error('[migrate] saved_places cust_note lỗi:', e?.message || e));
  // Mini-CRM tin lưu: địa chính (thửa/tờ/xã) + đặc điểm + khách quan tâm + trạng thái chốt deal.
  for (const c of ['parcel_no', 'sheet_no', 'ward', 'features', 'cust_name', 'cust_phone', 'interest', 'deal_status']) {
    await pool.query(`ALTER TABLE saved_places ADD COLUMN IF NOT EXISTS ${c} TEXT`).catch((e: any) => console.error('[migrate] saved_places ' + c + ' lỗi:', e?.message || e));
  }
  // ===== CRM: khách hàng (1 sales → nhiều khách), nhu cầu (1 khách → nhiều nhu cầu), quan tâm (1 tin ↔ nhiều khách) =====
  await pool.query(`CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT, phone TEXT, source TEXT, note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] customers lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS customers_user_idx ON customers (user_id)`).catch(() => {});
  await pool.query(`CREATE TABLE IF NOT EXISTS customer_needs (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deal_type TEXT, prop_type TEXT, budget TEXT, area_need TEXT, location TEXT, status TEXT, note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] customer_needs lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS customer_needs_cust_idx ON customer_needs (customer_id)`).catch(() => {});
  await pool.query(`CREATE TABLE IF NOT EXISTS property_interests (
    id SERIAL PRIMARY KEY,
    place_id INT NOT NULL REFERENCES saved_places(id) ON DELETE CASCADE,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest TEXT, deal_status TEXT, note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] property_interests lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS property_interests_place_idx ON property_interests (place_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS property_interests_cust_idx ON property_interests (customer_id)`).catch(() => {});
  await pool.query(`ALTER TABLE property_interests ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ`).catch(() => {}); // nhắc theo dõi
  // Lịch sử chăm sóc khách (gọi/nhắn/gặp/ghi chú) — dòng thời gian.
  await pool.query(`CREATE TABLE IF NOT EXISTS crm_activities (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT, note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] crm_activities lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS crm_activities_cust_idx ON crm_activities (customer_id)`).catch(() => {});
  // Lịch hẹn CÔNG CHỨNG (khách + thửa đất) + nhắc tự động (in-app + SMS).
  await pool.query(`CREATE TABLE IF NOT EXISTS notary_appointments (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    place_id INT REFERENCES saved_places(id) ON DELETE SET NULL,
    appoint_at TIMESTAMPTZ NOT NULL,
    location TEXT, note TEXT, status TEXT NOT NULL DEFAULT 'Chờ',
    sms_reminder BOOLEAN NOT NULL DEFAULT false,
    sms_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] notary_appointments lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS notary_appt_user_idx ON notary_appointments (user_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS notary_appt_cust_idx ON notary_appointments (customer_id)`).catch(() => {});
  // Theo dõi traffic — đếm theo PHIÊN (sess): 1 thiết bị = 1 lượt, đóng hẳn web mở lại mới +1.
  await pool.query(`CREATE TABLE IF NOT EXISTS site_visits (
    id BIGSERIAL PRIMARY KEY,
    path TEXT, vid TEXT, sess TEXT, ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] site_visits lỗi:', e?.message || e));
  await pool.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS sess TEXT`).catch((e: any) => console.error('[migrate] site_visits sess lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS site_visits_created_idx ON site_visits (created_at)`).catch((e: any) => console.error('[migrate] site_visits created index lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS site_visits_vid_idx ON site_visits (vid, created_at)`).catch((e: any) => console.error('[migrate] site_visits vid index lỗi:', e?.message || e));
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
  // ── Mini-game "Bay cùng Cam Lâm Land": điểm số + lead (tên/SĐT) cho cuộc thi tuần ──
  await pool.query(`CREATE TABLE IF NOT EXISTS game_scores (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL, phone TEXT NOT NULL, score INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] game_scores lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS game_scores_week_idx ON game_scores (created_at DESC, score DESC)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS game_scores_phone_idx ON game_scores (phone)`).catch(() => {});
  // ── Văn bản pháp luật (theo chủ đề BĐS) — chỉ người ĐĂNG NHẬP mới xem/tải; proxy PDF qua server ──
  await pool.query(`CREATE TABLE IF NOT EXISTS van_ban (
    id SERIAL PRIMARY KEY,
    so_hieu TEXT,
    trich_yeu TEXT NOT NULL,
    ngay_ban_hanh DATE,
    co_quan TEXT,
    chu_de TEXT NOT NULL DEFAULT 'Khác',
    linh_vuc TEXT,
    nguon TEXT,
    link_goc TEXT,
    luot_tai INT NOT NULL DEFAULT 0,
    noi_bat BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] van_ban lỗi:', e?.message || e));
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS van_ban_key_idx ON van_ban (so_hieu, ngay_ban_hanh)`).catch((e: any) => console.error('[migrate] van_ban key lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS van_ban_chude_idx ON van_ban (chu_de, ngay_ban_hanh DESC)`).catch(() => {});
  // ── Index BỔ SUNG (tối ưu tốc độ + chống chậm): các cột hay LỌC/SẮP XẾP nhưng còn thiếu index ──
  await pool.query(`CREATE INDEX IF NOT EXISTS property_interests_user_idx ON property_interests (user_id)`).catch(() => {}); // CRM: bảng/nhu cầu/quan tâm lọc theo user_id
  await pool.query(`CREATE INDEX IF NOT EXISTS customer_needs_user_idx ON customer_needs (user_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS notary_appt_appoint_idx ON notary_appointments (appoint_at)`).catch(() => {}); // lịch hẹn sắp xếp theo giờ hẹn
  await pool.query(`CREATE INDEX IF NOT EXISTS listing_leads_user_idx ON listing_leads (user_id)`).catch(() => {}); // upsert ON CONFLICT (listing_id,user_id)
  await pool.query(`CREATE INDEX IF NOT EXISTS site_visits_ref_idx ON site_visits (ref) WHERE ref IS NOT NULL AND ref <> ''`).catch(() => {}); // báo cáo nguồn truy cập
  await pool.query(`CREATE INDEX IF NOT EXISTS site_visits_path_idx ON site_visits (path) WHERE path IS NOT NULL`).catch(() => {}); // báo cáo top trang
  // ── KHO HỒ SƠ (dùng tạm — dễ gỡ): nơi cất file Excel/PDF danh mục đã lập, chia theo thư mục ──
  // File cất THẲNG trong database (cột BYTEA) y như cách làm với ảnh tin đăng — khỏi lo ổ đĩa,
  // sao lưu database là sao lưu luôn cả kho. File danh mục chỉ vài chục KB nên rất nhẹ.
  await pool.query(`CREATE TABLE IF NOT EXISTS kho_files (
    id BIGSERIAL PRIMARY KEY,
    thu_muc TEXT NOT NULL DEFAULT 'phong-kinh-te',
    so_tt INT,
    ten TEXT NOT NULL,
    ten_khong_dau TEXT,
    mime TEXT NOT NULL DEFAULT 'application/octet-stream',
    co_bytes INT NOT NULL DEFAULT 0,
    du_lieu BYTEA NOT NULL,
    ghi_chu TEXT,
    nguoi_tai INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] kho_files lỗi:', e?.message || e));
  // Tải LẠI đúng tên file cũ thì ĐÈ LÊN bản cũ chứ không đẻ ra bản thứ hai (nhờ khoá duy nhất này).
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS kho_files_ten_idx ON kho_files (thu_muc, ten)`).catch(() => {});
  // Sắp xếp mặc định là theo SỐ THỨ TỰ ở đầu tên file → index đúng theo thứ tự đó cho nhanh.
  await pool.query(`CREATE INDEX IF NOT EXISTS kho_files_stt_idx ON kho_files (thu_muc, so_tt)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS kho_files_tim_idx ON kho_files (thu_muc, ten_khong_dau)`).catch(() => {});
  // Thư mục rỗng (chưa có file nào) vẫn phải hiện ra, nên phải có bảng riêng cho nó.
  await pool.query(`CREATE TABLE IF NOT EXISTS kho_thu_muc (
    slug TEXT PRIMARY KEY,
    ten TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📁',
    thu_tu INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] kho_thu_muc lỗi:', e?.message || e));
  await pool.query(`INSERT INTO kho_thu_muc (slug, ten, icon, thu_tu) VALUES ('phong-kinh-te', 'Phòng Kinh tế', '🏛️', 1) ON CONFLICT (slug) DO NOTHING`).catch(() => {});

  // ══════════════════════════════════════════════════════════════════════════════
  // BẢN ĐỒ ĐỊA CHÍNH TOÀN TỈNH (733k thửa) — bảng RIÊNG, không dùng chung gis_features
  // ══════════════════════════════════════════════════════════════════════════════
  // Vì sao tách riêng: gis_features cất mọi thứ vào cột JSONB nên không đánh chỉ mục
  // theo số tờ/số thửa được → với hơn 700 nghìn thửa thì tra cứu phải quét cả bảng, rất chậm.
  // Bảng này có cột riêng cho từng thông tin nên tra cứu gần như tức thì.
  await pool.query(`CREATE TABLE IF NOT EXISTS dia_chinh (
    id       BIGSERIAL PRIMARY KEY,
    xa_id    TEXT NOT NULL,              -- mã xã (khoá thật, KHÔNG dùng tên vì có 10 cặp xã trùng tên)
    cap      SMALLINT NOT NULL DEFAULT 3, -- 2 = đơn vị mới sau sáp nhập 2025 · 3 = đơn vị cũ
    so_to    TEXT,                        -- số tờ bản đồ, giữ nguyên chữ gốc
    so_thua  TEXT,                        -- số thửa, giữ nguyên chữ gốc
    to_num   INT,                         -- số tờ đã đổi ra SỐ (để tra cứu nhanh, "05" = 5)
    thua_num INT,                         -- số thửa đã đổi ra số
    dien_tich REAL,                       -- diện tích m2 lấy sẵn trong file gốc
    mdsd     TEXT,                        -- mục đích sử dụng (ODT, CLN, BHK...)
    xa_moi_id TEXT,                     -- mã xã/phường HIỆN HÀNH (2 cấp) chứa thửa này
    geom     geometry(MultiPolygon,4326) NOT NULL
  )`).catch((e: any) => console.error('[migrate] dia_chinh lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS dia_chinh_geom_gix ON dia_chinh USING GIST (geom)`).catch(() => {});
  // Tra "tờ mấy thửa mấy ở xã nào" — chỉ mục này lo trọn.
  await pool.query(`CREATE INDEX IF NOT EXISTS dia_chinh_tim_idx ON dia_chinh (xa_id, to_num, thua_num)`).catch(() => {});
  // Tra "tờ mấy thửa mấy" mà KHÔNG chọn xã (tìm khắp tỉnh).
  await pool.query(`CREATE INDEX IF NOT EXISTS dia_chinh_to_thua_idx ON dia_chinh (to_num, thua_num)`).catch(() => {});

  // Danh mục xã/phường — sinh tự động sau khi nạp, dùng cho ô "Chọn xã" và nút bay tới.
  // Cột cap ở đây SỬA TAY ĐƯỢC: quy ước viết hoa/thường trong file gốc không chuẩn 100%
  // (vd xã Vạn Ninh, Tu Bông, Đại Lãnh viết thường nhưng thực chất là xã MỚI 2025).
  await pool.query(`CREATE TABLE IF NOT EXISTS dia_chinh_xa (
    xa_id    TEXT PRIMARY KEY,
    ten      TEXT NOT NULL,               -- tên có dấu, đúng như file gốc
    ten_kd   TEXT,                        -- tên không dấu, để gõ tìm không cần bỏ dấu
    cap      SMALLINT NOT NULL DEFAULT 3,
    huyen    TEXT,                        -- huyện/thị xã/thành phố CŨ (trước sáp nhập 2025)
    xa_moi_id TEXT,                     -- xã/phường HIỆN HÀNH tiếp nhận xã này (2 cấp trỏ về chính nó)
    so_thua  INT NOT NULL DEFAULT 0,
    minx DOUBLE PRECISION, miny DOUBLE PRECISION,
    maxx DOUBLE PRECISION, maxy DOUBLE PRECISION,
    cx   DOUBLE PRECISION, cy   DOUBLE PRECISION,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: any) => console.error('[migrate] dia_chinh_xa lỗi:', e?.message || e));
  await pool.query(`ALTER TABLE dia_chinh_xa ADD COLUMN IF NOT EXISTS huyen TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE dia_chinh_xa ADD COLUMN IF NOT EXISTS xa_moi_id TEXT`).catch(() => {});
  // ten_goc: tên đơn vị CŨ đã mang đúng mã đó (trường donViGoc/tenCu của danh mục Sở).
  // Xã mới kế thừa mã của một xã cũ, nên thửa trong file mang tên xã MỚI thật ra vẫn là đất
  // của xã cũ đó (vd file "Xã Cam Hiệp" chứa đất xã Cam Tân cũ). Rỗng = xã mới giữ nguyên tên.
  await pool.query(`ALTER TABLE dia_chinh_xa ADD COLUMN IF NOT EXISTS ten_goc TEXT`).catch(() => {});
  // so_xa_gop: xã mới này gộp từ mấy xã cũ. >1 mới có nguy cơ trùng số tờ nên mới cần bảng tra.
  await pool.query(`ALTER TABLE dia_chinh_xa ADD COLUMN IF NOT EXISTS so_xa_gop INT NOT NULL DEFAULT 1`).catch(() => {});
  await pool.query(`CREATE TABLE IF NOT EXISTS dia_chinh_to (
    xa_moi_id TEXT NOT NULL, to_moi INT NOT NULL,
    xa_cu_id TEXT NOT NULL,  to_cu  INT NOT NULL,
    PRIMARY KEY (xa_moi_id, to_moi))`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS dia_chinh_to_nguoc_idx ON dia_chinh_to (xa_cu_id, to_cu)`).catch(() => {});
  // ── HAI CỘT "SỰ THẬT THEO GIẤY TỜ" ──────────────────────────────────────────
  // Phải tách bạch HAI thứ khác nhau:
  //   · (xa_cu_id, to_cu)      = CHỖ ĐI TÌM dữ liệu — nơi thửa thật sự đang nằm trong kho.
  //   · (ten_xa_cu, to_cu_that)= ĐIỀU BẢNG GIẤY GHI  — xã cũ nào, tờ cũ mấy.
  // Hai cái này KHÁC nhau ở Ninh Hoà và Vạn Ninh: các xã cũ không có file riêng, dữ liệu nằm
  // chung trong file của xã gốc và đã mang sẵn số tờ mới. Nếu chỉ có cặp đầu thì web ghi
  // "Trước sáp nhập: xã Vạn Thọ" cho cả thửa vốn là đất Đại Lãnh cũ — sai tên xã.
  // Để rỗng = hai cái trùng nhau (trường hợp Nha Trang, Cam Lâm).
  // ── KHO MÃ XÁC THỰC (Google Authenticator) DÙNG CHUNG TRONG CƠ QUAN ─────────
  // Mỗi dòng là một tài khoản trên hệ thống ngoài (vd VBDLIS). Cột `bi_mat` lưu chuỗi bí mật
  // ĐÃ MÃ HOÁ (AES-256-GCM, xem lib/matMa.ts) — mở database ra xem cũng chỉ thấy chuỗi vô nghĩa.
  // Chuỗi bí mật KHÔNG BAO GIỜ được gửi ra trình duyệt; máy chủ tự sinh mã 6 số rồi mới gửi.
  await pool.query(`CREATE TABLE IF NOT EXISTS totp_tai_khoan (
    id SERIAL PRIMARY KEY,
    ten TEXT NOT NULL,
    he_thong TEXT NOT NULL DEFAULT '',
    bi_mat TEXT NOT NULL,
    ghi_chu TEXT NOT NULL DEFAULT '',
    thu_tu INT NOT NULL DEFAULT 0,
    tao_luc TIMESTAMPTZ NOT NULL DEFAULT now())`).catch(() => {});
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS totp_tai_khoan_ten_idx ON totp_tai_khoan (he_thong, ten)`).catch(() => {});
  await pool.query(`ALTER TABLE dia_chinh_to ADD COLUMN IF NOT EXISTS ten_xa_cu TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE dia_chinh_to ADD COLUMN IF NOT EXISTS to_cu_that INT`).catch(() => {});
  await pool.query(`ALTER TABLE dia_chinh ADD COLUMN IF NOT EXISTS xa_moi_id TEXT`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS dia_chinh_xa_moi_idx ON dia_chinh (xa_moi_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS dia_chinh_xa_cap_idx ON dia_chinh_xa (cap, ten)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS dia_chinh_xa_huyen_idx ON dia_chinh_xa (cap, huyen, ten)`).catch(() => {});


  // ── CHAT: gửi ẢNH + PDF, và THU HỒI tin nhắn ────────────────────────────────
  // Tệp chat để BẢNG RIÊNG, KHÔNG dùng chung `listing_images`: đường /api/images/:id
  // không kiểm tra quyền gì cả (ảnh tin rao vốn công khai nên không sao), trong khi
  // ảnh sổ đỏ / hợp đồng khách gửi trong chat thì tuyệt đối không được lộ.
  await pool.query(`CREATE TABLE IF NOT EXISTS chat_files (
    id BIGSERIAL PRIMARY KEY,
    room TEXT NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    ten TEXT NOT NULL,
    mime TEXT NOT NULL,
    co_bytes INT NOT NULL DEFAULT 0,
    du_lieu BYTEA NOT NULL,
    thumb BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`).catch((e: any) => console.error('[migrate] chat_files lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS chat_files_room_idx ON chat_files (room, id)`).catch(() => {});
  // kind: 'text' | 'image' | 'file'. Tin có tệp thì body rỗng.
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text'`).catch((e: any) => console.error('[migrate] chat kind lỗi:', e?.message || e));
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_id BIGINT`).catch(() => {});
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_name TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_mime TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_size INT`).catch(() => {});
  // deleted_at = mốc THU HỒI. Xoá mềm: giữ dòng tin để còn hiện chữ mờ "đã thu hồi",
  // nhưng body bị xoá trắng và dòng trong chat_files bị XOÁ HẲN (tệp mất thật khỏi máy chủ).
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`).catch((e: any) => console.error('[migrate] chat deleted_at lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS chat_thu_hoi_idx ON chat_messages (room, deleted_at) WHERE deleted_at IS NOT NULL`).catch(() => {});
  // Quyền gửi ảnh/PDF của KHÁCH: mặc định TẮT, admin tự mở cho từng người trong khung chat.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_upload BOOLEAN NOT NULL DEFAULT false`).catch((e: any) => console.error('[migrate] users chat_upload lỗi:', e?.message || e));
  // ── ĐĂNG NHẬP BẰNG VÂN TAY / KHUÔN MẶT (passkey — chuẩn WebAuthn) ──
  // Máy chủ CHỈ giữ KHOÁ CÔNG KHAI. Vân tay và khuôn mặt không bao giờ rời khỏi máy
  // của người dùng, cũng không gửi lên đây — điện thoại chỉ dùng chúng để mở khoá
  // khoá riêng nằm trong chip bảo mật của máy, rồi ký một thử thách ngẫu nhiên.
  // Nghĩa là dù máy chủ có bị lấy sạch database cũng không ai đăng nhập thay được.
  await pool.query(`CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cred_id TEXT NOT NULL UNIQUE,          -- mã khoá, dạng base64url
    public_key BYTEA NOT NULL,             -- khoá công khai
    counter BIGINT NOT NULL DEFAULT 0,     -- bộ đếm chống dùng lại chữ ký cũ
    transports TEXT,                       -- 'internal', 'usb', 'nfc'…
    ten_may TEXT,                          -- tên do người dùng đặt: "iPhone của tôi"
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used TIMESTAMPTZ)`)
    .catch((e: any) => console.error('[migrate] webauthn_credentials lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS webauthn_user_idx ON webauthn_credentials (user_id)`).catch(() => {});
  // Thử thách ngẫu nhiên của mỗi lần đăng ký / đăng nhập. Sống rất ngắn (5 phút) và
  // DÙNG MỘT LẦN — đây là thứ chặn kẻ khác phát lại chữ ký cũ.
  await pool.query(`CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id BIGSERIAL PRIMARY KEY,
    khoa TEXT NOT NULL UNIQUE,             -- khoá phiên, gửi kèm cho trình duyệt
    challenge TEXT NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL)`)
    .catch((e: any) => console.error('[migrate] webauthn_challenges lỗi:', e?.message || e));
  await pool.query(`CREATE INDEX IF NOT EXISTS webauthn_challenge_het_idx ON webauthn_challenges (expires_at)`).catch(() => {});

  // ── LỊCH ĐỔI LOGO THEO NGÀY LỄ (dùng tạm — dễ gỡ) ────────────────────────
  // Ngày thường dùng logo gốc; tới dịp lễ thì thanh menu đổi sang bản logo có
  // trang trí. Bảng này chỉ giữ LỊCH, còn tệp ảnh nằm ở public/logo-le/.
  await pool.query(`CREATE TABLE IF NOT EXISTS logo_le (
    id BIGSERIAL PRIMARY KEY,
    ma TEXT NOT NULL,                      -- mã bản logo: /logo-le/<ma>.webp
    ten TEXT NOT NULL,                     -- tên dịp, hiện trong trang quản lý
    kieu TEXT NOT NULL DEFAULT 'duong',    -- 'duong' | 'am' | 'ngay'
    thang INT, ngay INT,                   -- ngày chính (kiểu 'duong' và 'am')
    tu DATE, den DATE,                     -- khoảng ngày cụ thể (kiểu 'ngay')
    truoc INT NOT NULL DEFAULT 0,          -- hiện sớm trước ngày chính mấy ngày
    sau INT NOT NULL DEFAULT 0,            -- còn hiện sau ngày chính mấy ngày
    uu_tien INT NOT NULL DEFAULT 0,        -- trùng ngày thì số lớn hơn thắng
    bat BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
    .catch((e: any) => console.error('[migrate] logo_le lỗi:', e?.message || e));
  // ── NẠP SẴN LỊCH NGÀY LỄ ─────────────────────────────────────────────────
  // ⚠️ NẠP THEO ĐỢT, KHÔNG NẠP LẠI CÁI ĐÃ CÓ. Nếu cứ "bảng rỗng thì nạp" thì
  //    sau này bổ sung thêm dịp mới sẽ KHÔNG BAO GIỜ vào được (bảng đâu còn
  //    rỗng). Nên ghi số đợt vào app_config: đợt nào chưa chạy thì chạy, chạy
  //    rồi thì thôi. Quản trị viên xoá dịp nào thì nó không bị nạp lại, vì
  //    đợt đó đã đánh dấu xong.
  const DOT_LICH_LE = 2;
  const dotCu = await pool.query(`SELECT (value->>'dot')::int AS dot FROM app_config WHERE key='logo_le_seed'`)
    .then((r: any) => Number(r.rows?.[0]?.dot || 0)).catch(() => 0);
  if (dotCu < DOT_LICH_LE) {
    // (mã logo, tên dịp, kiểu, tháng, ngày, hiện sớm, còn hiện, ưu tiên, đợt)
    const LICH: [string, string, string, number, number, number, number, number, number][] = [
      // ── đợt 1: các dịp lớn ──
      ['tet', 'Tết Nguyên đán', 'am', 1, 1, 7, 7, 90, 1],
      ['ong-tao', 'Ông Công ông Táo (23 tháng Chạp)', 'am', 12, 23, 1, 1, 85, 2],
      ['quoc-khanh', 'Quốc khánh 2/9', 'duong', 9, 2, 2, 2, 80, 1],
      ['30-4', 'Giải phóng miền Nam 30/4 · Quốc tế Lao động 1/5', 'duong', 4, 30, 1, 2, 70, 1],
      ['gio-to', 'Giỗ Tổ Hùng Vương', 'am', 3, 10, 1, 1, 60, 1],
      ['trung-thu', 'Tết Trung thu', 'am', 8, 15, 3, 1, 50, 1],
      ['tri-an', 'Lễ Vu Lan (rằm tháng Bảy)', 'am', 7, 15, 1, 1, 46, 2],
      ['tri-an', 'Thương binh Liệt sĩ 27/7', 'duong', 7, 27, 1, 1, 45, 2],
      ['tet-duong', 'Tết Dương lịch', 'duong', 1, 1, 1, 1, 40, 1],
      ['tri-an', 'Rằm tháng Giêng', 'am', 1, 15, 0, 0, 38, 2],
      ['quoc-khanh', 'Giải phóng Khánh Hoà 2/4', 'duong', 4, 2, 0, 1, 36, 2],
      ['noel', 'Giáng sinh', 'duong', 12, 25, 2, 1, 30, 1],
      ['quoc-khanh', 'Sinh nhật Bác 19/5', 'duong', 5, 19, 0, 0, 30, 2],
      ['quan-doi', 'Quân đội nhân dân 22/12', 'duong', 12, 22, 1, 1, 26, 2],
      ['quoc-khanh', 'Thành lập Đảng 3/2', 'duong', 2, 3, 0, 0, 25, 2],
      ['quoc-khanh', 'Chiến thắng Điện Biên Phủ 7/5', 'duong', 5, 7, 0, 0, 25, 2],
      ['phu-nu', 'Phụ nữ Việt Nam 20/10', 'duong', 10, 20, 0, 0, 20, 1],
      ['phu-nu', 'Quốc tế Phụ nữ 8/3', 'duong', 3, 8, 0, 0, 20, 2],
      ['nha-giao', 'Nhà giáo Việt Nam 20/11', 'duong', 11, 20, 0, 0, 18, 2],
      ['doanh-nhan', 'Doanh nhân Việt Nam 13/10', 'duong', 10, 13, 0, 0, 16, 2],
      ['gia-dinh', 'Ngày Gia đình Việt Nam 28/6', 'duong', 6, 28, 0, 0, 15, 2],
      ['thieu-nhi', 'Quốc tế Thiếu nhi 1/6', 'duong', 6, 1, 0, 0, 15, 2],
    ];
    for (const [ma, ten, kieu, thang, ngay, truoc, sau, uu, dot] of LICH) {
      if (dot <= dotCu) continue;
      await pool.query(
        `INSERT INTO logo_le (ma, ten, kieu, thang, ngay, truoc, sau, uu_tien)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8
          WHERE NOT EXISTS (SELECT 1 FROM logo_le WHERE ma=$1 AND kieu=$3 AND thang=$4 AND ngay=$5)`,
        [ma, ten, kieu, thang, ngay, truoc, sau, uu])
        .catch((e: any) => console.error('[migrate] nạp dịp lễ', ten, 'lỗi:', e?.message || e));
    }
    await pool.query(`INSERT INTO app_config (key, value) VALUES ('logo_le_seed', jsonb_build_object('dot', $1::int))
                      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [DOT_LICH_LE]).catch(() => {});
    console.log('[migrate] lịch logo ngày lễ: đã nạp tới đợt', DOT_LICH_LE);
  }

  console.log('[migrate] schema up to date');
}
