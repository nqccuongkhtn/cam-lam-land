# Backend API (Express + TypeScript via tsx). Build context = repo root.
FROM node:20-bookworm-slim
WORKDIR /app
# Tesseract OCR (đọc bảng toạ độ từ ảnh, chạy server cho ổn định)
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr && rm -rf /var/lib/apt/lists/*
# shared package is imported via relative path, so copy it alongside the app
COPY packages/shared ./packages/shared
COPY apps/backend/package.json ./apps/backend/package.json
WORKDIR /app/apps/backend
RUN npm install
COPY apps/backend ./
# DB init scripts + demo GeoJSON for the cloud self-bootstrap (BOOTSTRAP_DB=true)
COPY db/init ./db-init
COPY data/cam-lam ./seed-data
EXPOSE 4000
CMD ["npm", "run", "start"]
