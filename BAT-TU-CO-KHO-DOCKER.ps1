# ============================================================================
#  Cam Lam Land - BAT CHE DO TU CO CHO KHO DOCKER  (chay quyen Administrator)
#  Chay MOT LAN duy nhat. Sau do o C khong con bi day dan nua.
# ----------------------------------------------------------------------------
#  VAN DE: docker_data.vhdx chi phinh ra, khong bao gio tu co lai. Xoa bot ben
#  trong cung khong an thua - phai nen tay moi tra cho lai cho o C. Da hai lan
#  lam o C can kiet khien Docker sap va CA WEB CHET.
#
#  CACH DUT DIEM: bat co "sparse" cho file kho. Tu do moi lan tat WSL la file tu
#  co lai dung bang phan dang dung that. Khong phai canh, khong phai nen tay.
#
#  Da xet va LOAI hai cach khac:
#   - Doi kho sang o F (3.6 TB trong): F la o cung roi cam USB, dinh dang exFAT.
#     Rut nham day la hong database. Khong lam.
#   - Doi sang o D: D chi con 15 GB, lai nam chung mot SSD 238 GB voi o C nen
#     khong giai quyet duoc gi.
# ============================================================================
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Bat che do tu co cho kho Docker'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host '==================================================' -ForegroundColor Cyan
Write-Host '   BAT CHE DO TU CO CHO KHO DOCKER (chay 1 lan)' -ForegroundColor Cyan
Write-Host '==================================================' -ForegroundColor Cyan

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Can quyen quan tri.' -ForegroundColor Red; Read-Host 'Enter de dong'; exit 1
}

$vhd = Join-Path $env:LOCALAPPDATA 'Docker\wsl\disk\docker_data.vhdx'
$truoc = if (Test-Path $vhd) { (Get-Item $vhd -Force).Length / 1GB } else { 0 }
$oCtruoc = (Get-PSDrive C).Free / 1GB
Write-Host ("`n  Kho Docker : {0:N2} GB" -f $truoc)
Write-Host ("  O C trong  : {0:N2} GB" -f $oCtruoc)

# --- Chon dung bo file compose ---
$cf = @('-f', 'docker-compose.yml', '-f', 'docker-compose.prod.yml')
$envp = Join-Path $root '.env'
if ((Test-Path $envp) -and (Select-String -Path $envp -Pattern '^\s*TUNNEL_TOKEN\s*=\s*(\S.+)$' -Quiet)) {
  $cf += @('-f', 'docker-compose.tunnel.yml')
}

Write-Host "`n[1/5] Dung web cho database dong sach se..." -ForegroundColor Yellow
Push-Location $root
try { & docker compose @cf stop 2>&1 | Out-Null } catch {}
Pop-Location

Write-Host '[2/5] Tat Docker Desktop...' -ForegroundColor Yellow
Get-Process 'Docker Desktop', 'com.docker.backend', 'com.docker.build' -ErrorAction SilentlyContinue |
  ForEach-Object { try { $_.CloseMainWindow() | Out-Null } catch {} }
Start-Sleep -Seconds 8
Get-Process 'Docker Desktop', 'com.docker.backend', 'com.docker.build' -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

Write-Host '[3/5] Tat WSL...' -ForegroundColor Yellow
wsl --shutdown 2>&1 | Out-Null
Start-Sleep -Seconds 10

Write-Host '[4/5] Bat co TU CO cho kho Docker...' -ForegroundColor Yellow
$env:WSL_UTF8 = 1
$kq = & wsl --manage docker-desktop --set-sparse true 2>&1
$kq | ForEach-Object { Write-Host "    $_" }
if ($LASTEXITCODE -ne 0) {
  # Ban WSL cu doi them co nay vi file kho khong do chinh WSL tao ra.
  Write-Host '  Thu lai kem --allow-unsafe...' -ForegroundColor DarkYellow
  $kq = & wsl --manage docker-desktop --set-sparse true --allow-unsafe 2>&1
  $kq | ForEach-Object { Write-Host "    $_" }
}
if ($LASTEXITCODE -eq 0) { Write-Host '  Da bat che do tu co.' -ForegroundColor Green }
else { Write-Host '  CHUA bat duoc - xem dong bao loi ben tren.' -ForegroundColor Red }

Write-Host '[5/5] Bat lai Docker va web...' -ForegroundColor Yellow
$dd = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
if (Test-Path $dd) { Start-Process $dd } else { Write-Host '  Khong thay Docker Desktop.' -ForegroundColor Red }
$ok = $false
for ($i = 1; $i -le 20; $i++) {
  Start-Sleep -Seconds 15
  & docker info *> $null
  if ($LASTEXITCODE -eq 0) { $ok = $true; Write-Host "  Docker da len (sau $($i*15) giay)." -ForegroundColor Green; break }
  Write-Host "  ...cho tiep ($i/20)"
}
if ($ok) {
  Push-Location $root
  & docker compose @cf up -d 2>&1 | Out-Host
  Start-Sleep -Seconds 20
  & docker compose @cf restart nginx 2>&1 | Out-Null
  Start-Sleep -Seconds 5
  & docker compose @cf ps 2>&1 | Out-Host
  Pop-Location
}

$sau = if (Test-Path $vhd) { (Get-Item $vhd -Force).Length / 1GB } else { 0 }
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host ("  Kho Docker : {0:N2} GB  (truoc {1:N2} GB)" -f $sau, $truoc)
Write-Host ("  O C trong  : {0:N2} GB  (truoc {1:N2} GB)" -f ((Get-PSDrive C).Free / 1GB), $oCtruoc)
Write-Host '  Tu nay moi lan tat WSL la file kho tu co lai.' -ForegroundColor Green
Write-Host '==================================================' -ForegroundColor Cyan
Read-Host 'Bam Enter de dong cua so'
