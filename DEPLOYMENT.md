# Deployment Guide — Cam Lâm Land

## 1. Prerequisites
- Docker Engine 24+ and Docker Compose v2
- (Cloud) a VM with ≥ 2 GB RAM and a domain name pointing at it

## 2. Local / single-VM deployment
```bash
git clone <your-repo> cam-lam-gis && cd cam-lam-gis
cp .env.example .env
#   >>> edit .env: set strong POSTGRES_PASSWORD, JWT_SECRET, ADMIN_PASSWORD <<<
docker compose up --build -d
docker compose logs -f          # watch boot; wait for backend + gis-worker "ready"
```
App: `http://<host>/` · API: `http://<host>/api/health`.

Containers:
| Service | Image / build | Port | Role |
|---------|---------------|------|------|
| `postgis` | postgis/postgis:16-3.4 | 5432 | spatial database (named volume `pgdata`) |
| `backend` | apps/backend/Dockerfile | 4000 (internal) | REST API + JWT + WebSocket |
| `gis-worker` | apps/gis-worker/Dockerfile (+GDAL) | — | ogr2ogr conversion + PostGIS import |
| `frontend` | apps/frontend/Dockerfile | 3000 (internal) | Next.js UI |
| `nginx` | nginx:1.27-alpine | 80 | reverse proxy (`/`→frontend, `/api`→backend) |

## 3. Environment variables (`.env`)
| Var | Purpose |
|-----|---------|
| `POSTGRES_USER/PASSWORD/DB` | database credentials |
| `JWT_SECRET` | **change in production** — token signing key |
| `ADMIN_EMAIL/PASSWORD` | seed admin account (created on first boot) |
| `SEED_DEMO_DATA` | `true` to auto-import the bundled Cam Lâm layers |
| `WORKER_POLL_MS` | import-queue poll interval |
| `NEXT_PUBLIC_MAP_CENTER_LNG/LAT/ZOOM` | default map view (Cam Lâm) |
| `NGINX_PORT` | host port for the reverse proxy |

## 4. Production hardening
**Frontend production build.** For an optimized build, edit `apps/frontend/Dockerfile`:
```dockerfile
RUN npm run build
CMD ["npm", "run", "start"]
```
Pass the `NEXT_PUBLIC_*` vars at **build time** (Next inlines them) via compose `build.args`.

**HTTPS / TLS.** Terminate TLS at Nginx. Add a `443` server block with your certs, or front
the stack with Caddy / Traefik / a cloud load balancer for automatic Let's Encrypt.

**Secrets.** Never commit `.env`. Use your platform's secret store. Rotate `JWT_SECRET`
(invalidates existing tokens). Restrict `5432` exposure — remove the postgis `ports:` mapping
so the DB is only reachable inside the compose network.

**Backups.**
```bash
docker compose exec postgis pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup.sql.gz
```
The `pgdata` and `uploads` named volumes hold all persistent state.

## 5. Cloud options
**DigitalOcean / any VM:** install Docker, clone repo, `docker compose up -d`, point DNS, add TLS.
The whole stack runs from the single `docker-compose.yml`.

**Fly.io / Render / Railway:** deploy `backend`, `gis-worker`, and `frontend` as separate
services and attach a managed **PostgreSQL with the PostGIS extension** (e.g. Fly Postgres,
Neon, Supabase, RDS). Set the `POSTGRES_*` env vars to the managed instance; drop the
`postgis` service from compose. Ensure the worker image keeps `gdal-bin` installed.

**AWS:** ECS/Fargate for the three app services + **RDS for PostgreSQL (enable PostGIS)** +
an ALB routing `/` and `/api`. Store uploads on EFS (shared between backend & worker) or
adapt the worker to read/write S3.

## 6. Scaling notes
- `backend` and `frontend` are stateless → scale horizontally behind Nginx/ALB.
- `gis-worker` uses a DB-backed queue (`import_jobs`); run multiple workers safely by adding
  `FOR UPDATE SKIP LOCKED` to the job-claim query in `apps/gis-worker/src/index.ts`.
- Add spatial indexes (already created on `geom` via GiST) and tune Postgres `shared_buffers`.
