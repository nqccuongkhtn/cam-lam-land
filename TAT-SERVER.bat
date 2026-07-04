@echo off
cd /d "%~dp0"
echo [i] Dang tat server (production + tunnel neu co)...
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.tunnel.yml down
echo [OK] Da tat. Du lieu (DB, anh) VAN CON - chay CHAY-SERVER.bat de bat lai.
pause
