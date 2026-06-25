#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "================================================"
echo "  Cam Lam Land — GIS + Real Estate (auto)"
echo "================================================"

if ! command -v docker >/dev/null 2>&1; then
  echo "[X] Docker chưa được cài. Tải: https://www.docker.com/products/docker-desktop/"; exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "[X] Docker chưa chạy. Hãy mở Docker Desktop rồi chạy lại."; exit 1
fi
[ -f .env ] || { cp .env.example .env; echo "[i] Đã tạo .env"; }

echo "[i] Build & khởi động (lần đầu sẽ tải image)..."
docker compose up --build -d

echo "[i] Chờ dịch vụ sẵn sàng..."
for i in $(seq 1 90); do
  if curl -fsS http://localhost/api/health >/dev/null 2>&1; then echo "[OK] Sẵn sàng!"; break; fi
  sleep 3
done

( command -v open >/dev/null && open http://localhost ) || ( command -v xdg-open >/dev/null && xdg-open http://localhost ) || true
echo "Web: http://localhost  |  /map  |  /admin (admin@camlam.local / admin12345)"
echo "Ctrl+C để thoát log (hệ thống vẫn chạy). Tắt hẳn: ./stop.sh"
docker compose logs -f
