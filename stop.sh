#!/usr/bin/env bash
cd "$(dirname "$0")"
docker compose down
echo "Đã dừng. Xoá sạch dữ liệu: docker compose down -v"
