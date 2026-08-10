@echo off
cd /d "%~dp0"
echo ================================================================
echo   KIEM TRA IP - de vao web bang IP public (port forwarding)
echo ================================================================
echo.
echo [ 1 ] IP PUBLIC (Internet nhin thay may ban):
powershell -NoProfile -Command "try{ $ip=(Invoke-RestMethod -Uri 'https://api.ipify.org?format=text' -TimeoutSec 8); Write-Host ('        ' + $ip) }catch{ Write-Host '        Khong lay duoc - kiem tra ket noi mang' }"
echo.
echo [ 2 ] IP NOI BO cua may (LAN) va Gateway:
powershell -NoProfile -Command "$c=Get-NetIPConfiguration | Where-Object {$_.IPv4Address -and $_.IPv4DefaultGateway}; foreach($x in $c){ Write-Host ('        LAN IP : ' + (($x.IPv4Address.IPAddress) -join ', ')); Write-Host ('        Gateway: ' + ($x.IPv4DefaultGateway.NextHop -join ', ')) }"
echo.
echo ================================================================
echo   CACH DOC KET QUA
echo ----------------------------------------------------------------
echo   - Dang nhap router (mo trinh duyet vao dia chi Gateway o tren,
echo     thuong la 192.168.1.1), tim muc WAN / Internet, xem "WAN IP".
echo.
echo   - Neu WAN IP GIONG IP PUBLIC [1]  -^>  co IP that, PORT FORWARD DUOC.
echo   - Neu WAN IP la 100.64.x.x / 10.x.x.x / 192.168.x.x
echo         -^>  dang bi CGNAT, KHONG port forward duoc.
echo             Phai dung Cloudflare Tunnel + domain (nhu dang lam).
echo ================================================================
echo.
pause
