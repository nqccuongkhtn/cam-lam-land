# GIS worker = Node + GDAL (ogr2ogr). Build context = repo root.
FROM node:20-bookworm-slim
# GDAL provides ogr2ogr for .dgn/.shp/.geojson conversion
RUN apt-get update && apt-get install -y --no-install-recommends gdal-bin \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY packages/shared ./packages/shared
COPY apps/gis-worker/package.json ./apps/gis-worker/package.json
WORKDIR /app/apps/gis-worker
RUN npm install
COPY apps/gis-worker ./
CMD ["npm", "run", "start"]
