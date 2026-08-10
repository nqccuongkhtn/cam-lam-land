# Docker Review — Cam Lâm GIS + Real Estate Platform

*Senior DevOps review of the container build & deployment configuration. Scope: Docker only — no application logic or functionality is changed by any recommendation here.*

Reviewed against the **actual** repository (not assumptions):

| Service | Stack (actual) | Current image | Base | Build step? |
|---|---|---|---|---|
| frontend | Next.js 14 App Router (SSR, `next start`) | **3.00 GB** | `node:20-bookworm-slim` | `next build` (prod file only) |
| backend | Express + TypeScript run via **`tsx`** (no compile) + LibreOffice/Tesseract/ocrmypdf/qpdf/poppler | **1.44 GB** | `node:20-bookworm-slim` | none (runs `.ts` directly) |
| gis-worker | Node run via **`tsx`** + **GDAL `ogr2ogr`** (`gdal-bin`) | **783 MB** | `node:20-bookworm-slim` | none |
| postgis | `postgis/postgis:16-3.4` (tuned) | 852 MB (upstream) | — | — |

> ⚠️ The GIS worker in **this** repo is **Node + GDAL CLI (`ogr2ogr`)**, invoked via `child_process.execFile` (`apps/gis-worker/src/convert.ts`). It does **not** use Python/Rasterio/Fiona/Shapely/GeoPandas. The Python-GIS section of the brief does not apply; the review below reflects your real stack.

---

## 1. Executive Summary

Your runtime works and is thoughtfully tuned in places (Postgres memory settings, backend healthcheck, BuildKit cache mounts in `Dockerfile.prod`, a well-written root `.dockerignore`). The problems are almost entirely in **image packaging** and **build reproducibility**, not correctness.

Three findings dominate everything else:

1. **The default `docker-compose.yml` builds the frontend from `apps/frontend/Dockerfile`, which runs `next dev`.** That is a development server shipped as a "production" image: it carries the full dependency tree, source, and a dev `.next` cache, and it recompiles on the fly at runtime. This is the direct cause of the **3 GB** frontend image. A production Next.js image for this app should be **~180–230 MB**.

2. **No lockfile exists anywhere** (`package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` are all absent). Every `npm install` re-resolves "latest matching" versions, so **builds are not reproducible**, layer caching is weak, and `npm ci` (faster, deterministic) cannot be used at all.

3. **`next build` never emits a standalone server** because `output: 'standalone'` is missing from `next.config.js`. Even the `Dockerfile.prod` therefore ships the entire `node_modules` (dev + prod) and full source instead of the ~30–50 MB traced server bundle.

Everything else — running as root, `npm install` vs `npm ci`, weak default secrets in compose, `tsx` as the runtime entrypoint, four near-duplicate frontend Dockerfiles — is real and worth fixing, but secondary to the three above.

**Headline impact of the optimizations in this document:**

| | Current | Optimized | Reduction |
|---|---:|---:|---:|
| frontend | 3.00 GB | ~0.20 GB | **~93%** |
| backend | 1.44 GB | ~1.25 GB* | ~13% (feature-bound) |
| gis-worker | 0.78 GB | ~0.70 GB | ~10% (GDAL-bound) |
| **app images total** | **~5.2 GB** | **~2.15 GB** | **~58%** |

\* Backend is dominated by LibreOffice + the OCR/PDF toolchain, which are **runtime features you deliberately included**. It cannot shrink dramatically without dropping features. The realistic win there is build speed, caching, reproducibility, and security — plus an *optional* ~150–250 MB cut if some LibreOffice components are unused (see §6).

---

## 2. Top 10 Highest-Priority Issues

| # | Issue | Severity | Fix (summary) |
|---|---|---|---|
| 1 | Default compose ships the **`next dev`** frontend → 3 GB | **Critical** | Multi-stage + `output: 'standalone'`; make prod the default build |
| 2 | **No lockfiles** → non-reproducible builds, `npm ci` impossible | **Critical** | Generate & commit `package-lock.json` per app |
| 3 | **No `output: 'standalone'`** → full `node_modules` + source shipped | **High** | Add one line to `next.config.js`, copy `.next/standalone` |
| 4 | **`npm install`** everywhere instead of `npm ci` | **High** | `npm ci` (needs lockfiles from #2) |
| 5 | **All containers run as root** | **High** | Non-root `USER` for frontend now; backend/worker with volume-perm care |
| 6 | **Weak default secrets baked into compose** (`admin12345`, `..._change_me`) | **High** | Require vars in prod (`${VAR:?}`); keep defaults only for local dev |
| 7 | **`tsx` (a devDependency) is the runtime entrypoint** for backend & worker | **Medium** | Move `tsx` → `dependencies` (safe) or compile to JS (best) |
| 8 | Backend `latest`/unpinned pieces; no `HEALTHCHECK` in Dockerfile; LibreOffice may include unused components | **Medium** | Pin, add HEALTHCHECK, optionally trim LO components |
| 9 | No **resource limits / log rotation** in compose; `cloudflared:latest` unpinned | **Medium** | Add `logging` caps, `mem_limit`/`cpus`, pin image |
| 10 | **Four near-duplicate frontend Dockerfiles**; per-app `.dockerignore` files are dead (context = repo root) | **Low–Med** | Consolidate to one multi-stage Dockerfile with `--target`s |

---

## 3. Per-File Analysis

### 3.1 `apps/frontend/Dockerfile` (the one compose uses by default)

```dockerfile
FROM node:20-bookworm-slim
WORKDIR /app
COPY apps/frontend/package.json ./package.json
RUN npm install
COPY apps/frontend ./
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

**What it does.** Installs *all* dependencies (prod + dev), copies the entire frontend source, and starts the Next.js **development server**.

**Problems & why they matter.**
- **`next dev` in a shipped image (Critical).** The dev server keeps the full toolchain resident, watches files, and compiles routes on demand — slow cold start, high memory, and it drags in everything. This is the 3 GB.
- **`npm install`, no lockfile (High).** Non-deterministic; the image you build today ≠ the one you build next month.
- **Single stage (High).** Build-time tooling (typescript, tailwind, postcss, autoprefixer) and dev caches remain in the final image.
- **Runs as root (High).** No `USER`.
- **No `.next`/telemetry hygiene (Low).**

**Severity: Critical** (this is the headline image).

**Recommendation.** Replace with the multi-stage standalone Dockerfile in §5.1 and make it the default in compose. Keep a *separate* dev experience via the override file (which already bind-mounts source for hot reload — that's the correct place for `next dev`).

**Expected impact.** 3.00 GB → **~180–230 MB** (~93%). Faster pull/deploy, faster container start (no on-the-fly compilation), lower RAM.

---

### 3.2 `apps/frontend/Dockerfile.prod`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim
WORKDIR /app
COPY apps/frontend/package.json ./package.json
RUN --mount=type=cache,target=/root/.npm npm install
COPY apps/frontend ./
ARG NEXT_PUBLIC_API_BASE=/api
...
RUN --mount=type=cache,target=/app/.next/cache npm run build
CMD ["npm", "run", "start"]
```

**What it does.** Proper production build (`next build` → `next start`) with two good touches: a BuildKit npm cache mount and a `.next/cache` mount for incremental compiles.

**Problems.**
- **Still single-stage (High).** Final image = base + **all** `node_modules` (dev+prod) + full source + full `.next`. Without `output: 'standalone'`, `next start` needs the whole `node_modules`. Estimated ~0.9–1.3 GB.
- **`npm install` + no lockfile (High).** Same reproducibility gap; the npm cache mount helps *download* time but not determinism.
- **Root user, no HEALTHCHECK, telemetry on (Med/Low).**

**Severity: High.** It's the right idea executed at ~5× the necessary size.

**Recommendation.** Adopt `output: 'standalone'` (§5.0) and the 3-stage build (§5.1). Keep both cache mounts — they carry over.

**Expected impact.** ~1.0 GB → **~0.2 GB**; incremental rebuilds stay fast thanks to the retained `.next/cache` mount.

---

### 3.3 `apps/frontend/Dockerfile.render`

**What it does.** Render variant: `next build`, binds `$PORT`, and **bakes a ≥140 MB `qd205.pmtiles` file into the image** at build time (fails the build if the download is incomplete — a nice integrity guard).

**Problems.**
- **Duplication (Low–Med).** Third copy of the same build logic → drift risk (this one lacks the `NEXT_PUBLIC_*` build args, so client env embedding differs from `Dockerfile.prod`).
- **140 MB tile inside the image (Med).** Every deploy pushes/pulls the tile again; it invalidates cache on any change; it couples data to the app image. The stability rationale ("don't fetch at runtime") is valid, but object storage / a CDN / a mounted volume achieves the same stability without inflating the image and slowing every deploy.

**Severity: Medium.**

**Recommendation.** Collapse into the single multi-stage Dockerfile using a `runner` target; add a separate `runner-render` target (or a build-arg `BAKE_TILES=1`) that performs the tile download only for Render. Long-term, serve the PMTiles from R2/S3/a CDN and drop it from the image.

**Expected impact.** With standalone: Render frontend image from whatever-it-is now to **~0.2 GB + 0.14 GB tile = ~0.34 GB**, or **~0.2 GB** if the tile moves to object storage.

---

### 3.4 `apps/backend/Dockerfile`

```dockerfile
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-vie \
      libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-draw \
      ocrmypdf ghostscript qpdf poppler-utils fonts-liberation fonts-dejavu \
 && rm -rf /var/lib/apt/lists/*
COPY packages/shared ./packages/shared
COPY apps/backend/package.json ./apps/backend/package.json
WORKDIR /app/apps/backend
RUN npm install
COPY apps/backend ./
COPY db/init ./db-init
COPY data/cam-lam ./seed-data
CMD ["npm", "run", "start"]
```

**What it does.** Installs a heavy but **intentional** server-side toolchain (OCR + LibreOffice Office↔PDF + PDF utilities), installs Node deps, copies source + DB init + seed data, and runs `tsx src/index.ts`.

**Problems.**
- **`tsx` is a devDependency but is the runtime command (Medium).** `npm run start` = `tsx src/index.ts`. This means you *cannot* run `npm ci --omit=dev` (it would delete `tsx`), so the image must keep the entire dev tree, and every boot transpiles TypeScript in-process. Two clean fixes: move `tsx` to `dependencies` (smallest change), or compile once to JS in a build stage and run `node dist/index.js` (fastest boot, smallest runtime).
- **`npm install`, no lockfile (High).** Reproducibility again.
- **Layer ordering is *mostly* good** (apt first, then deps, then source) — keep that. But `COPY packages/shared` sits above the deps install, so editing shared code busts the npm layer unnecessarily. Minor.
- **Root user (High)** — though see the caveat: LibreOffice/ocrmypdf spawn subprocesses and write to `$HOME` and temp; running non-root needs a writable `HOME` and correct volume ownership. Do this carefully.
- **No `HEALTHCHECK` in the Dockerfile (Low).** (compose has one — good — but baking it in helps non-compose runs like Render.)
- **LibreOffice component scope (Medium, optional).** `-impress` and `-draw` pull large dependency chains. If you never convert `.ppt/.pptx/.odp` or vector drawings, dropping them saves ~150–250 MB. **Only** drop after confirming which formats you actually convert.

**Severity: Medium** overall (size is feature-bound; the real wins are reproducibility, caching, security, boot time).

**Recommendation.** See §5.2 — multi-stage with `npm ci --omit=dev` (after moving `tsx`), single apt layer preserved, baked-in HEALTHCHECK, optional non-root, optional LO trim.

**Expected impact.** ~1.44 GB → **~1.25 GB** keeping all features (mostly from dropping the dev dependency tree + tighter layering), or **~1.05–1.15 GB** if `-impress`/`-draw` are confirmed unused. Faster, deterministic rebuilds; faster boot if you compile to JS.

---

### 3.5 `apps/gis-worker/Dockerfile`

```dockerfile
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gdal-bin \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY packages/shared ./packages/shared
COPY apps/gis-worker/package.json ./apps/gis-worker/package.json
WORKDIR /app/apps/gis-worker
RUN npm install
COPY apps/gis-worker ./
CMD ["npm", "run", "start"]
```

**What it does.** Installs GDAL CLI (`ogr2ogr`) — a genuine **runtime** dependency — plus Node deps (only `pg`), then runs `tsx src/index.ts`.

**Problems.**
- **`gdal-bin` is the size (≈350–450 MB) and it's runtime (Info).** It stays. Multi-stage can't remove it because the worker shells out to `ogr2ogr` at runtime.
- **Same `tsx`-as-runtime + no-lockfile + `npm install` issues (Medium/High).**
- **Root user (High)** — but the worker **writes** converted GeoJSON into the shared `uploads` volume, so a non-root switch requires the volume to be writable by that UID (see §7 caveat).
- **Runtime deps are tiny** (`pg` only), so the only Node-side win is `--omit=dev` (drops `tsx`+`typescript`+`@types`, once `tsx` is in `dependencies`, keeping it).

**Severity: Medium** (mostly reproducibility + security; size is GDAL-bound).

**Recommendation.** See §5.3. Optionally evaluate the `ghcr.io/osgeo/gdal:ubuntu-small-*` base + Node install as a long-term size play (adds complexity — treat as experimental).

**Expected impact.** ~783 MB → **~700 MB** with the safe changes; potentially ~550–650 MB with a slim-GDAL base (needs testing).

---

### 3.6 `docker-compose.yml` (+ `.prod`, `.override`, `.tunnel`)

**What it does.** One-command local stack: tuned PostGIS, backend (with healthcheck + many env vars), worker, frontend, nginx reverse proxy; prod override swaps in `Dockerfile.prod`; dev override bind-mounts the frontend for hot reload; tunnel override adds Cloudflare. This layered-compose design is good.

**Problems.**
- **Insecure default secrets (High).** `POSTGRES_PASSWORD: ...change_me`, `JWT_SECRET: please_change_...`, `ADMIN_PASSWORD: admin12345` are convenient for local dev but dangerous if the same file is used in production. If `.env` is ever missing a var, the container silently boots with a known-weak credential.
- **`depends_on` without `condition` for frontend→backend and nginx→(frontend,backend) (Medium).** Startup ordering only; nginx may accept traffic before upstreams are ready. backend→postgis already uses `condition: service_healthy` (good).
- **No log rotation (Medium).** Default `json-file` driver grows unbounded → can fill disk on a long-running host.
- **No resource limits (Medium).** LibreOffice/ghostscript/ogr2ogr can spike RAM/CPU; nothing caps them.
- **No zombie reaping (`init: true`) (Low–Med).** backend & worker spawn external processes; PID 1 should reap.
- **`cloudflared:latest` (Medium).** Unpinned → surprise upgrades.
- **No `HEALTHCHECK` for frontend/worker (Low).**

**Severity: High** (driven by the secrets default).

**Recommendation.** See §5.4/§5.5: keep dev-friendly defaults in the base file, but in the **prod** compose require the sensitive vars (`${JWT_SECRET:?...}`), add `logging` caps + `mem_limit`/`cpus` + `init: true`, pin `cloudflared`, and upgrade `depends_on` to `service_healthy` where a healthcheck exists.

---

### 3.7 `.dockerignore` files

**Root `.dockerignore` — good.** Excludes `**/node_modules`, `**/.next`, `.git`, docs (`*.md`), scripts (`*.bat/*.ps1/*.vbs`), heavy map data (`*.dgn/*.gtp/*.npy`), logs, and `.env*` (keeping `.env.example`). This is why your build context is already reasonable.

**Problem — per-app `.dockerignore` files are dead (Medium, subtle).** All three services build with **`context: .`** (repo root), and Docker only reads the `.dockerignore` **at the context root**. So `apps/frontend/.dockerignore`, `apps/backend/.dockerignore`, and `apps/gis-worker/.dockerignore` are **never applied** by your compose builds. They're harmless but misleading. (They'd only take effect if you built with `context: apps/frontend`, or if you adopt the newer per-Dockerfile `Dockerfile.dockerignore` convention.)

**Missing entries (Low).** `**/dist`, `**/.turbo`, `**/coverage`, `**/*.tsbuildinfo`, `.vscode`, `.idea`, `**/.DS_Store`, `Thumbs.db`, `**/npm-debug.log*`, `**/.cache`.

**Recommendation.** Extend the root file (§5.6); delete or clearly deprecate the three per-app files to avoid confusion.

---

## 4. Best-Practices Scorecard (1–10)

| Category | Score | Notes |
|---|:--:|---|
| Docker layer caching | 5 | Good copy-order; killed by no-lockfile + `npm install` |
| Image size optimization | 2 | 3 GB frontend, 1.44 GB backend |
| Build speed | 4 | Cache mounts in `.prod` are great; dev rebuilds heavy; no `ci` |
| Runtime performance | 6 | PostGIS tuned; `tsx` transpiles at boot; `next dev` slow |
| Security | 3 | Root everywhere; weak default secrets |
| Least privilege | 2 | No non-root, no cap drops, no read-only FS |
| OCI best practices | 4 | No `LABEL`s, HEALTHCHECK only in compose, some `latest` |
| Maintainability | 6 | Well-commented; but 3–4 duplicate frontend Dockerfiles |
| Reproducibility | 2 | **No lockfiles** — the single biggest gap |
| CI/CD friendliness | 4 | Huge images + non-determinism slow pipelines |
| **Average** | **3.8** | Solid runtime, weak packaging/supply-chain |

Target after adopting this document: **~7.5–8/10** across the board.

---

## 5. Optimized Files

> All optimized files are **drop-in and non-breaking** provided you (a) generate lockfiles and (b) add the one-line `standalone` config. Where a change carries any risk (non-root with volumes, LibreOffice trim, compile-to-JS), it is called out explicitly and left **optional**.

### 5.0 Required one-liner: `apps/frontend/next.config.js`

Add `output: 'standalone'`. This makes `next build` emit `.next/standalone` (a minimal Node server + only the traced production `node_modules`). It does **not** change any runtime behavior or routes.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',      // ← add this line
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/webp'],
    minimumCacheTTL: 2678400,
  },
  compiler: { removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
```

*(You do **not** need `sharp`: the app uses plain `<img>` tags, not `next/image`, so the image optimizer never runs.)*

### 5.1 Optimized `apps/frontend/Dockerfile` (multi-stage, standalone)

```dockerfile
# syntax=docker/dockerfile:1
# Next.js 14 (App Router) — 3-stage build, output:standalone.
# Requires: next.config.js has `output: 'standalone'` and a committed package-lock.json.
# Build context = repo root (as compose already does).

########## 1) deps — install prod+dev deps, cached by lockfile ##########
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

########## 2) builder — next build ##########
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY apps/frontend ./
# NEXT_PUBLIC_* must exist at build time (Next inlines them into the client bundle).
ARG NEXT_PUBLIC_API_BASE=/api
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_MAP_CENTER_LNG=109.0917
ARG NEXT_PUBLIC_MAP_CENTER_LAT=12.0771
ARG NEXT_PUBLIC_MAP_ZOOM=12
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MAP_CENTER_LNG=$NEXT_PUBLIC_MAP_CENTER_LNG \
    NEXT_PUBLIC_MAP_CENTER_LAT=$NEXT_PUBLIC_MAP_CENTER_LAT \
    NEXT_PUBLIC_MAP_ZOOM=$NEXT_PUBLIC_MAP_ZOOM
RUN --mount=type=cache,target=/app/.next/cache npm run build

########## 3) runner — minimal runtime (standalone) ##########
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
# Alpine runtime is fine here: the standalone server is pure JS (no native modules).
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER node
EXPOSE 3000
# server.js honors $PORT → works locally AND on Render (which sets PORT).
CMD ["node", "server.js"]
```

**Notes.**
- `USER node` is safe here — the frontend writes nothing to disk at runtime and mounts no volumes.
- `server.js` reads `$PORT`, so this **one image replaces both `Dockerfile.prod` and `Dockerfile.render`** (see §5.1a for the Render tile).
- If you prefer to avoid Alpine/musl entirely, swap the runner base to `node:20-bookworm-slim` (+~60 MB, still ~260 MB).

### 5.1a Render tile (optional extra stage)

If you keep baking the PMTiles for Render, add a target instead of a whole separate file:

```dockerfile
########## 3b) runner-render — standalone + baked PMTiles ##########
FROM runner AS runner-render
USER root
RUN apk add --no-cache curl \
 && curl -fSL "https://github.com/nqccuongkhtn/cam-lam-land/releases/download/tiles/qd205.pmtiles" -o ./public/qd205.pmtiles \
 && [ "$(stat -c%s ./public/qd205.pmtiles)" -gt 140000000 ] \
 && apk del curl
USER node
```

Build it with `--target runner-render`. **Long-term:** serve the tile from R2/S3/CDN and drop this entirely.

### 5.2 Optimized `apps/backend/Dockerfile`

**Prerequisite:** move `tsx` from `devDependencies` → `dependencies` in `apps/backend/package.json` (so `npm ci --omit=dev` keeps it). This does not change behavior.

```dockerfile
# syntax=docker/dockerfile:1
# Backend API (Express + tsx) + server-side PDF/OCR/Office toolchain.
# Build context = repo root. Requires apps/backend/package-lock.json and tsx in dependencies.

########## 1) deps — production node_modules only ##########
FROM node:20-bookworm-slim AS deps
WORKDIR /app/apps/backend
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

########## 2) runtime ##########
FROM node:20-bookworm-slim AS runtime
WORKDIR /app/apps/backend
ENV NODE_ENV=production
LABEL org.opencontainers.image.title="camlam-backend"

# Server tools (RUNTIME features): Tesseract OCR (+vie), LibreOffice (Office↔PDF),
# ocrmypdf/ghostscript/qpdf/poppler (PDF), fonts. Single cached layer, apt lists removed.
# NOTE: to save ~150–250 MB, drop libreoffice-impress/libreoffice-draw IF you never
#       convert .ppt/.pptx/.odp or vector drawings. Verify before removing.
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-vie \
      libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-draw \
      ocrmypdf ghostscript qpdf poppler-utils \
      fonts-liberation fonts-dejavu \
 && rm -rf /var/lib/apt/lists/*

# node_modules first (rarely changes) → best cache reuse.
COPY --from=deps /app/apps/backend/node_modules ./node_modules
# Shared package (relative import ../../packages/shared).
COPY packages/shared /app/packages/shared
# App source + DB init + seed data (change most often → last).
COPY apps/backend ./
COPY db/init ./db-init
COPY data/cam-lam ./seed-data

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
```

**Optional — non-root** (test OCR/LibreOffice afterward; they need a writable `HOME` and the `uploads` volume must be owned by this UID):

```dockerfile
# ... after the COPYs, before HEALTHCHECK:
ENV HOME=/tmp
RUN useradd -u 1001 -m -s /usr/sbin/nologin appuser \
 && mkdir -p /data/uploads && chown -R appuser:appuser /data/uploads /app
USER appuser
```
and in compose add for the backend service: `user: "1001"` is *not* needed (image sets it), but ensure the named `uploads` volume is writable — the simplest reliable path is to keep backend root **or** initialize volume ownership once. If OCR/Office conversion breaks, revert to root; this is the one place where "least privilege" trades against your heavy external tools.

**Optional — compile to JS (fastest boot, drops `tsx` at runtime):** add a build stage running `npx esbuild src/index.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/index.js`, copy `dist/`, and change `start` to `node dist/index.js`. Higher reward, higher test burden — treat as a follow-up.

### 5.3 Optimized `apps/gis-worker/Dockerfile`

**Prerequisite:** move `tsx` → `dependencies` in `apps/gis-worker/package.json`.

```dockerfile
# syntax=docker/dockerfile:1
# GIS worker — Node + GDAL CLI (ogr2ogr, runtime). Build context = repo root.
# Requires apps/gis-worker/package-lock.json and tsx in dependencies.

########## 1) deps — production node_modules only ##########
FROM node:20-bookworm-slim AS deps
WORKDIR /app/apps/gis-worker
COPY apps/gis-worker/package.json apps/gis-worker/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

########## 2) runtime ##########
FROM node:20-bookworm-slim AS runtime
WORKDIR /app/apps/gis-worker
ENV NODE_ENV=production
LABEL org.opencontainers.image.title="camlam-gis-worker"
# GDAL provides ogr2ogr for .dgn/.shp/.geojson conversion (runtime dependency).
RUN apt-get update && apt-get install -y --no-install-recommends gdal-bin \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/apps/gis-worker/node_modules ./node_modules
COPY packages/shared /app/packages/shared
COPY apps/gis-worker ./
CMD ["npm", "run", "start"]
```

*Non-root caveat:* the worker writes GeoJSON into the shared `uploads` volume, so a `USER` switch needs that volume writable by the chosen UID. Keep root unless you initialize volume ownership. Size is GDAL-bound; the safe win here is reproducibility + dropping the dev tree.

### 5.4 Optimized `docker-compose.yml` (base — local dev friendly)

Keep your defaults for one-command local runs, but add hygiene (log rotation, `init`, healthchecks, tighter `depends_on`). Diff-style — apply these additions to your existing services:

```yaml
services:
  postgis:
    # ...unchanged tuning...
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }

  backend:
    # ...unchanged env...
    init: true                       # reap ghostscript/soffice subprocesses (PID 1)
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }
    # healthcheck already present — good

  gis-worker:
    init: true
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }

  frontend:
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    depends_on:
      backend:
        condition: service_healthy   # was: bare depends_on

  nginx:
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }
    depends_on:
      frontend:
        condition: service_healthy
      backend:
        condition: service_healthy
```

### 5.5 Optimized `docker-compose.prod.yml` (production hardening)

```yaml
# docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
services:
  postgis:
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?set in .env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set a strong password in .env}
      POSTGRES_DB: ${POSTGRES_DB:?set in .env}
    deploy:
      resources:
        limits: { memory: 1500m }

  backend:
    environment:
      JWT_SECRET: ${JWT_SECRET:?set a long random secret in .env}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?set a strong admin password in .env}
    deploy:
      resources:
        limits: { cpus: "2.0", memory: 2g }   # LibreOffice/ghostscript can spike

  gis-worker:
    deploy:
      resources:
        limits: { cpus: "1.5", memory: 1500m }

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile     # now the multi-stage standalone one
      args:
        NEXT_PUBLIC_API_BASE: ${NEXT_PUBLIC_API_BASE:-/api}
        NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL:-}
        NEXT_PUBLIC_MAP_CENTER_LNG: ${NEXT_PUBLIC_MAP_CENTER_LNG:-109.0917}
        NEXT_PUBLIC_MAP_CENTER_LAT: ${NEXT_PUBLIC_MAP_CENTER_LAT:-12.0771}
        NEXT_PUBLIC_MAP_ZOOM: ${NEXT_PUBLIC_MAP_ZOOM:-12}
    deploy:
      resources:
        limits: { memory: 512m }
```

> `${VAR:?message}` makes the stack **refuse to start** in prod if a secret is unset — no more silent fallback to `admin12345`. The `:?` form is the single highest-value security change here. (`deploy.resources.limits` is honored by `docker compose` v2; on older engines use top-level `mem_limit:`/`cpus:`.)

And pin the tunnel image in `docker-compose.tunnel.yml`:

```yaml
    image: cloudflare/cloudflared:2024.8.3   # pin instead of :latest (use a current tag)
```

### 5.6 Optimized root `.dockerignore`

```gitignore
# ── Heaviest & always safe ──
**/node_modules
**/.next
**/dist
**/.turbo
**/coverage
**/*.tsbuildinfo
.git
.gitignore
.gitattributes

# ── Editors / OS junk ──
.vscode
.idea
**/.DS_Store
Thumbs.db
**/npm-debug.log*
**/.cache

# ── Not used at build ──
backup
_scripts-cu
_qh_tile_cu_qd205v4
HD-lam-tile-quyhoach
__pycache__
scripts/qh-pipeline

# ── Heavy source map data (not COPYed) ──
*.dgn
*.gtp
*.npy
*.log
*.tmp

# ── Docs & server-management scripts ──
*.md
*.bat
*.ps1
*.vbs

# ── Secrets (never in image) ──
.env
.env.*
!.env.example
```

Then **delete** `apps/frontend/.dockerignore`, `apps/backend/.dockerignore`, `apps/gis-worker/.dockerignore` (they are not applied with `context: .` and only cause confusion).

---

## 6. Recommended Project / Build Structure

You already use a clean monorepo (`apps/*`, `packages/shared`, `db/`, `data/`, `nginx/`) with layered compose. Recommended adjustments (no restructuring needed):

- **One Dockerfile per service** with named `--target` stages (`deps` / `builder` / `runner`), replacing the 3 frontend variants.
- **Commit lockfiles** (`apps/*/package-lock.json`) — this is the keystone change that unlocks `npm ci`, deterministic caching, and CI speed.
- **Move `tsx` to `dependencies`** for backend + worker (or compile to JS).
- **Keep `next dev` only in the dev override** (bind-mounted), never in a built image.
- **Add a `.env.example`** documenting every secret (many are referenced in compose); ensure prod uses `${VAR:?}`.

---

## 7. Size / Build-Time / Deployment Estimates

### Image size (before → after)

| Service | Before | After (safe) | After (aggressive) | Driver of remaining size |
|---|---:|---:|---:|---|
| frontend | 3.00 GB | **~0.20 GB** | ~0.15 GB (alpine) | Node runtime + Next standalone server |
| backend | 1.44 GB | **~1.25 GB** | ~1.05–1.15 GB (drop LO impress/draw) | LibreOffice + OCR toolchain (features) |
| gis-worker | 0.78 GB | **~0.70 GB** | ~0.55–0.65 GB (slim-GDAL base) | `gdal-bin` (runtime) |
| **Total (app)** | **~5.2 GB** | **~2.15 GB** | **~1.8 GB** | — |

### Build time

- **First build:** similar or slightly longer (multi-stage adds a copy), but you gain a tiny final image.
- **Incremental rebuild after a code change:** frontend drops from *rebuild-everything* to **`next build` with warm `.next/cache`** (deps + apt layers cached) — typically **2–4× faster**.
- **Dependency change:** with a lockfile + `npm ci`, the install layer is deterministic and cached until the lockfile changes.

### Push / pull / deploy

- Frontend push/pull shrinks ~15× (3 GB → 0.2 GB). On Render or any registry-based deploy this is the difference between multi-minute and sub-minute image transfer, and it slashes cold-start/rollback time.
- Backend/worker transfers improve modestly (feature/GDAL-bound), but deterministic layers mean unchanged layers are skipped on every push.

### Container startup

- Frontend: `next dev` (compile-on-boot) → `node server.js` (precompiled) = **much faster, lower RAM**.
- Backend/worker: `tsx` transpiles on boot; compiling to JS removes that startup cost (optional).

### Storage

- Local Docker disk usage for app images falls from ~5.2 GB to ~2.15 GB (~58%), plus dangling `next dev` layers stop accumulating.

**Biggest bottlenecks, ranked:** (1) `next dev` image, (2) missing lockfiles, (3) missing `standalone`, (4) LibreOffice weight (accepted), (5) root + weak secrets (risk, not size).

---

## 8. Prioritized Action Plan

### Quick wins (≤ 30 min, high impact, low risk)
1. **Generate & commit lockfiles**: in each of `apps/frontend`, `apps/backend`, `apps/gis-worker` run `npm install --package-lock-only` → commit `package-lock.json`. *(Unlocks #2, #4.)*
2. **Add `output: 'standalone'`** to `next.config.js` (§5.0).
3. **Extend root `.dockerignore`** and delete the 3 dead per-app ones (§5.6).
4. **Pin `cloudflared`** to a real tag (§5.5).

### Medium effort (1–3 h, high impact)
5. **Adopt the multi-stage frontend Dockerfile** (§5.1); point compose (base + prod) at it; retire `Dockerfile.prod`/`Dockerfile.render` (fold Render into `--target runner-render`). Rebuild and smoke-test the site + map.
6. **Move `tsx` → `dependencies`** (backend + worker), adopt the multi-stage backend/worker Dockerfiles with `npm ci --omit=dev` (§5.2/§5.3). Test OCR, Office↔PDF, and a `.dgn/.shp` conversion.
7. **Harden prod compose**: `${VAR:?}` for secrets, `logging` caps, `init: true`, resource limits, `depends_on: service_healthy` (§5.4/§5.5).

### Long-term (higher reward, more testing)
8. **Non-root backend/worker** with correct `HOME` + volume ownership (§5.2 caveat).
9. **Compile backend/worker to JS** (esbuild/tsc) to drop `tsx` at runtime and speed boot.
10. **Move the 140 MB PMTiles out of the image** to R2/S3/CDN; consider a **slim-GDAL base** for the worker; add a CI job that builds, scans (Trivy), and pushes the pinned images.

---

### Verification checklist after applying
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml build` succeeds with lockfiles present.
- `docker images` shows frontend ≈ 0.2 GB.
- Site renders, map tiles load, login works, OCR/Office↔PDF works, a GIS file converts.
- `docker compose ... up -d` → all services `healthy`; prod compose **fails fast** if a required secret is unset.
