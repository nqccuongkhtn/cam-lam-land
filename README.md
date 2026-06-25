# Cam Lâm Land — Real Estate + GIS Planning Platform

A production-oriented, full-stack platform combining a **real-estate marketplace**
(à la batdongsan.com) with an **interactive GIS planning map** (à la remaps.vn),
built entirely around **Cam Lâm district, Khánh Hòa, Vietnam**.

> **Default region (hard-coded everywhere):** Cam Lâm, Khánh Hòa
> **CRS:** WGS84 / **EPSG:4326** · **Map center:** `109.0917, 12.0771` · **Zoom:** 12 (district view)

Everything — map center, demo datasets, search results, planning layers — is anchored to Cam Lâm. No global/foreign default data is used.

---

## ✨ Features

**Real estate**
- Listings with price (VND), area, type, ward, images, and a GIS point location
- Search & filter by price range, property type, ward and free-text keyword
- Map of all listings + property detail page with an embedded location map

**GIS planning map**
- Interactive map centered on Cam Lâm with an OpenStreetMap basemap
- Layers: cadastral **land parcels**, **zoning/planning**, **administrative boundaries**, **road network**
- Layer toggle panel + click-to-inspect: click anywhere to see the **parcel**, its **zoning classification**, and **listings linked to that area** (spatial query)

**GIS upload pipeline (fully automated)**
- Admin uploads `.dgn`, `.shp` (zipped) or `.geojson`
- A background **gis-worker** converts the file to GeoJSON with **GDAL/ogr2ogr**, normalizes CRS to **EPSG:4326**, imports geometries into **PostGIS**, records layer metadata, and the layer becomes instantly available on the map — **no manual steps**

**Admin dashboard**
- Upload GIS layers · manage listings · view import logs & processing status

---

## 🏗️ Architecture

```
                          ┌─────────────────────┐
        Browser  ───────▶ │   Nginx (port 80)   │  reverse proxy
                          └─────────┬───────────┘
                          /            \ /api
              ┌───────────▼──┐     ┌────▼─────────────┐
              │  Frontend    │     │   Backend API     │
              │  Next.js +   │     │  Express + JWT    │
              │  MapLibre GL │     │  (REST + WS)      │
              └──────────────┘     └────┬─────────────┘
                                        │ SQL
                       ┌────────────────▼───────────────┐
                       │     PostgreSQL + PostGIS         │
                       │  users · listings · gis_layers   │
                       │  gis_features · import_jobs      │
                       └────────────────▲───────────────┘
                                        │ poll queue + write features
                              ┌─────────┴──────────┐
                              │     GIS worker     │
                              │  Node + GDAL       │
                              │  ogr2ogr → 4326    │
                              └────────────────────┘
```

**Monorepo (pnpm workspaces)**

```
cam-lam-gis/
├── docker-compose.yml          # one-command stack
├── nginx/nginx.conf            # / → frontend, /api → backend, /ws → websocket
├── .env.example                # copy to .env
├── db/init/                    # PostGIS schema + demo listings (auto-run on first boot)
├── data/cam-lam/               # demo GeoJSON datasets + seed manifest
├── packages/shared/            # shared TS types + Cam Lâm geo constants
└── apps/
    ├── backend/                # Express REST API + JWT auth + spatial queries
    ├── gis-worker/             # GDAL ogr2ogr conversion + PostGIS import (polling)
    └── frontend/               # Next.js App Router + MapLibre GL UI
```

---

## 🚀 Quick start (one command)

**Prerequisite:** Docker + Docker Compose.

### ✅ Cách dễ nhất — chạy 1-click (tự động hoàn toàn)
- **Windows:** bấm đúp **`start.bat`**
- **macOS / Linux:** chạy **`./start.sh`**

Script sẽ tự: kiểm tra Docker → tạo `.env` → build → khởi động → chờ sẵn sàng → mở trình duyệt.
Tắt hệ thống: **`stop.bat`** (Windows) hoặc **`./stop.sh`**. *(Cần cài & mở Docker Desktop trước.)*

### Hoặc chạy thủ công bằng 1 lệnh

```bash
cp .env.example .env
docker compose up --build
```

Then open **http://localhost** — the map loads immediately on Cam Lâm, Khánh Hòa.

On first boot the stack will automatically:
1. create the PostGIS schema and seed 8 demo listings,
2. create the admin account from `.env`,
3. import the 4 bundled Cam Lâm GIS layers (89 features) via the worker.

| What | URL / value |
|------|-------------|
| App (frontend) | http://localhost |
| GIS map | http://localhost/map |
| Admin dashboard | http://localhost/admin |
| API health | http://localhost/api/health |
| Default admin | `admin@camlam.local` / `admin12345` |
| PostGIS | `localhost:5433` (user/db from `.env`) |

> **Map tiles** are fetched from OpenStreetMap at runtime (no API token needed).
> MapLibre GL is a drop-in, token-free replacement for Mapbox GL — see *Using Mapbox* below to switch.

### Local dev without Docker
```bash
pnpm install
# start Postgres/PostGIS yourself, apply db/init/*.sql, then:
pnpm dev:backend   # tsx watch (needs ogr2ogr on PATH for uploads)
pnpm dev:worker
pnpm dev:frontend
```

---

## 🌍 GIS processing pipeline

```
upload (.dgn/.shp/.zip/.geojson)
   └─ backend stores file + inserts import_jobs row (status=pending)
        └─ gis-worker polls the queue
             ├─ ogr2ogr -t_srs EPSG:4326 -f GeoJSON  (fallback: import as-is if no source CRS)
             ├─ parse FeatureCollection, detect geometry type
             ├─ upsert gis_layers row (metadata: type, format, source, feature_count)
             ├─ insert each feature → gis_features (ST_GeomFromGeoJSON, SRID 4326)
             └─ mark job done  → layer instantly queryable at /api/layers/:slug/features
```

Supported inputs: **`.dgn`** (MicroStation), **`.shp`** (zip the `.shp/.shx/.dbf/.prj` together), **`.geojson`**. All output is normalized to **EPSG:4326**.

---

## 📡 API reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/api/health` | — | service + region check |
| POST | `/api/auth/register` | — | create a user, returns JWT |
| POST | `/api/auth/login` | — | login, returns JWT |
| GET  | `/api/auth/me` | user | current user |
| GET  | `/api/listings` | — | filters: `minPrice,maxPrice,propertyType,ward,q,bbox,limit,offset` |
| GET  | `/api/listings/geojson` | — | all listings as a GeoJSON FeatureCollection |
| GET  | `/api/listings/:id` | — | listing detail |
| POST | `/api/listings` | user | create listing (`title,price,lng,lat,…`) |
| PUT/DELETE | `/api/listings/:id` | user | update / delete |
| GET  | `/api/layers` | — | list GIS layers + metadata |
| GET  | `/api/layers/:slug/features` | — | layer features as GeoJSON (optional `bbox`) |
| GET  | `/api/parcels/at?lng=&lat=` | — | parcel + zoning + linked listings at a point |
| POST | `/api/imports/upload` | **admin** | upload `.dgn/.shp/.zip/.geojson` → queued |
| GET  | `/api/imports` | **admin** | import jobs + processing logs |

---

## 🗺️ Demo dataset (Cam Lâm, Khánh Hòa)

Synthetic but geographically faithful to a Vietnamese coastal district (`data/cam-lam/`):

| Layer | Type | Features | Notes |
|-------|------|---------:|-------|
| `admin-boundaries` | admin (Polygon) | 5 | district + 4 representative wards |
| `zoning` | zoning (Polygon) | 4 | residential / agricultural / tourism-coastal / forest zones |
| `land-parcels` | parcel (Polygon) | 75 | cadastral parcels with land-use, owner status, area |
| `roads` | road (LineString) | 5 | incl. National Highway 1A + Bãi Dài coastal road |

Plus **8 demo listings** spanning Cam Đức center, Bãi Dài coast, and inland wards.
All coordinates validated to fall inside the Cam Lâm bounding box `[108.95, 11.95, 109.27, 12.25]`.

To regenerate: `python3 data/cam-lam/_generate.py`.

---

## 🔧 Using Mapbox instead of MapLibre
The UI uses **MapLibre GL** (open-source, token-free, API-compatible with Mapbox GL JS).
To use Mapbox: `npm i mapbox-gl`, swap the import in `apps/frontend/src/components/MapView.tsx`,
set `maplibregl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN`, and point the style at a Mapbox style URL.

## 🩺 Troubleshooting
- **Map empty / listings "đang tải"** → backend still starting; `docker compose logs backend`.
- **No GIS layers** → check the worker: `docker compose logs gis-worker` (look for "imported … features").
- **Upload rejected** → only `.dgn/.shp/.zip/.geojson`; zip shapefile sidecar files together.
- **Reset everything** → `docker compose down -v` (drops the database volume) then `up` again.

## ⚠️ Notes & limitations
This is a complete, runnable foundation (MVP) — not a 1:1 clone of the reference sites.
The demo GIS data is synthetic; replace it with official cadastral/planning files via the upload pipeline.
Frontend runs in dev mode for zero-config startup; see `DEPLOYMENT.md` for the production build.

See **DEPLOYMENT.md** for production hardening and cloud deployment.
