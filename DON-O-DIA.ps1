# ============================================================
#  Cam Lam Land - Don o dia C (chay quyen Administrator)
#  Duoc goi tu nut "Don o dia" trong QUAN-LY-SERVER.ps1
#  GIU NGUYEN database & du lieu. Chi xoa rac + cache.
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = 'Don o dia - Cam Lam Land'

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        DON O DIA C - CAM LAM LAND" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

try { $before = (Get-PSDrive C).Free / 1GB } catch { $before = 0 }
Write-Host ("`nTrong truoc khi don: {0:N2} GB" -f $before) -ForegroundColor Yellow

Write-Host "`n[1/6] Xoa Docker build cache + anh/container thua (GIU database)..." -ForegroundColor Green
docker builder prune -a -f 2>$null
docker image prune -a -f 2>$null
docker container prune -f 2>$null

Write-Host "`n[2/6] Tat file ngu dong (giai phong hiberfil.sys - thuong nhieu GB)..." -ForegroundColor Green
powercfg /h off 2>$null

Write-Host "`n[3/6] Xoa file tam cua Windows va nguoi dung..." -ForegroundColor Green
Remove-Item "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\*"       -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n[4/6] Xoa cache Windows Update da tai (SoftwareDistribution)..." -ForegroundColor Green
Remove-Item "C:\Windows\SoftwareDistribution\Download\*" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n[5/6] Don thung rac (Recycle Bin)..." -ForegroundColor Green
Clear-RecycleBin -Force -ErrorAction SilentlyContinue

Write-Host "`n[6/6] Don kho WinSxS - Windows Update cu (chay vai phut, dung sot ruot)..." -ForegroundColor Green
Dism /Online /Cleanup-Image /StartComponentCleanup

try { $after = (Get-PSDrive C).Free / 1GB } catch { $after = $before }
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "                     XONG !" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ("Trong SAU khi don : {0:N2} GB" -f $after) -ForegroundColor Yellow
Write-Host ("Da giai phong     : {0:N2} GB" -f ($after - $before)) -ForegroundColor Yellow
Write-Host "`n--- Dung luong Docker con lai ---" -ForegroundColor Gray
docker system df 2>$null

Write-Host "`nNhan Enter de dong cua so..." -ForegroundColor Gray
Read-Host | Out-Null
