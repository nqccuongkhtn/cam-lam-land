-- ============================================================================
--  Cam Lâm GIS + Real Estate — schema (all geometry in WGS84 / EPSG:4326)
-- ============================================================================

-- ─── Users & auth ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Real-estate listings (a point linked to GIS coordinates) ────────────────
CREATE TABLE IF NOT EXISTS listings (
    id            SERIAL PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT,
    price         NUMERIC(16,2) NOT NULL,          -- VND
    area          NUMERIC(12,2),                   -- m²
    property_type TEXT NOT NULL DEFAULT 'land'
                  CHECK (property_type IN ('land','house','apartment','villa','commercial','farm')),
    address       TEXT,
    ward          TEXT,                            -- xã/phường within Cam Lâm
    bedrooms      INT,
    status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','pending','sold','hidden')),
    images        TEXT[] NOT NULL DEFAULT '{}',
    geom          geometry(Point,4326) NOT NULL,
    created_by    INT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listings_geom_gix ON listings USING GIST (geom);
CREATE INDEX IF NOT EXISTS listings_type_idx ON listings (property_type);
CREATE INDEX IF NOT EXISTS listings_price_idx ON listings (price);

-- ─── GIS layers (one row per imported / seeded dataset) ──────────────────────
CREATE TABLE IF NOT EXISTS gis_layers (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    slug          TEXT UNIQUE NOT NULL,
    layer_type    TEXT NOT NULL DEFAULT 'custom'
                  CHECK (layer_type IN ('parcel','zoning','admin','road','custom')),
    geometry_type TEXT,                            -- Polygon | LineString | Point | Mixed
    source_format TEXT,                            -- dgn | shp | geojson
    source_file   TEXT,
    srid          INT NOT NULL DEFAULT 4326,
    style         JSONB NOT NULL DEFAULT '{}'::jsonb,
    feature_count INT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'ready'
                  CHECK (status IN ('ready','processing','error')),
    visible       BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── GIS features (generic feature store keyed to a layer) ───────────────────
CREATE TABLE IF NOT EXISTS gis_features (
    id          SERIAL PRIMARY KEY,
    layer_id    INT NOT NULL REFERENCES gis_layers(id) ON DELETE CASCADE,
    properties  JSONB NOT NULL DEFAULT '{}'::jsonb,
    geom        geometry(Geometry,4326) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gis_features_geom_gix ON gis_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS gis_features_layer_idx ON gis_features (layer_id);

-- ─── Import jobs (audit trail + worker queue) ────────────────────────────────
CREATE TABLE IF NOT EXISTS import_jobs (
    id                SERIAL PRIMARY KEY,
    layer_id          INT REFERENCES gis_layers(id) ON DELETE SET NULL,
    original_filename TEXT,
    file_path         TEXT NOT NULL,
    source_format     TEXT,
    layer_name        TEXT,
    layer_type        TEXT NOT NULL DEFAULT 'custom',
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','done','error')),
    log               TEXT DEFAULT '',
    feature_count     INT,
    created_by        INT REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS import_jobs_status_idx ON import_jobs (status);
