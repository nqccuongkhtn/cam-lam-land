# ============================================================================
#  Cam Lam Land - NEN KHO DOCKER (chay quyen Administrator)
#  Duoc goi tu nut "Nen kho Docker" trong QUAN-LY-SERVER.ps1
#  hoac nhay dup file NEN-KHO-DOCKER.bat
# ----------------------------------------------------------------------------
#  Kho Docker (docker_data.vhdx) CHI PHINH RA, khong bao gio tu co lai.
#  Moi lan build lai web la no no them vai GB du ben trong da xoa bot.
#  Da tung phinh toi 38 GB trong khi ben trong chi dung ~6 GB, lam o C con
#  0,47 GB -> Docker Desktop khong khoi dong noi -> CA WEB SAP.
#
#  Cong cu nay CAT BO PHAN TRONG THUA cua file, KHONG xoa gi ben trong:
#  database, anh may, du lieu dia chinh deu nguyen ven.
#  Web ngung khoang 5-10 phut roi TU CHAY LAI.
# ============================================================================
param(
  # -TuDong : chay theo lich luc 2h sang, khong hien cua so hoi han, ghi nhat ky ra tep.
  [switch]$TuDong
)
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Nen kho Docker - Cam Lam Land'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Tieu-De($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Buoc($t)    { Write-Host "`n$t" -ForegroundColor Yellow }
function Xong($t)    { Write-Host "  $t" -ForegroundColor Green }

$nhatKy = Join-Path $root 'logs\nen-kho-docker.log'
if ($TuDong) {
  New-Item -ItemType Directory -Force -Path (Split-Path $nhatKy) -ErrorAction SilentlyContinue | Out-Null
  Start-Transcript -Path $nhatKy -Append -ErrorAction SilentlyContinue | Out-Null
  Write-Host "`n===== CHAY TU DONG $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss') ====="
}

$vhd = Join-Path $env:LOCALAPPDATA 'Docker\wsl\disk\docker_data.vhdx'
if (-not (Test-Path $vhd)) {
  Write-Host "Khong thay kho Docker o: $vhd" -ForegroundColor Red
  Write-Host 'Co the may dang dung Hyper-V thay vi WSL. Dung cong cu nay khong duoc.' -ForegroundColor Red
  Read-Host 'Bam Enter de dong'; exit 1
}

Write-Host '==============================================' -ForegroundColor Cyan
Write-Host '     NEN KHO DOCKER - CAM LAM LAND' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
Tieu-De 'TRUOC KHI NEN'
$truoc = (Get-Item $vhd -Force).Length / 1GB
$oCtruoc = (Get-PSDrive C).Free / 1GB
Write-Host ("  Kho Docker chiem : {0:N2} GB" -f $truoc)
Write-Host ("  O C con trong    : {0:N2} GB" -f $oCtruoc)

# --- Chon dung bo file compose (them tunnel neu .env co TUNNEL_TOKEN) ---
$cf = @('-f','docker-compose.yml','-f','docker-compose.prod.yml')
$envp = Join-Path $root '.env'
if (Test-Path $envp) {
  if (Select-String -Path $envp -Pattern '^\s*TUNNEL_TOKEN\s*=\s*(\S.+)$' -Quiet) {
    $cf += @('-f','docker-compose.tunnel.yml')
  }
}

# --- [0/6] Xoa dem build TRUOC khi dung Docker ---
# Day moi la thu lam file kho phinh ra: moi lan build lai web la them vai GB dem.
# Xoa o buoc nay thi buoc nen phia sau moi cat duoc nhieu.
Buoc '[0/6] Xoa dem build Docker (khong anh huong database)...'
Push-Location $root
try { & docker builder prune -af 2>&1 | Out-Null; & docker image prune -f 2>&1 | Out-Null; Xong 'Da xoa dem build.' }
catch { Write-Host '  (bo qua - Docker chua san sang)' }
Pop-Location

# --- [1/6] Dung container CHO SACH SE (quan trong: de PostgreSQL dong dung cach) ---
Buoc '[1/6] Dung web (de database dong sach se)...'
Push-Location $root
try { & docker compose @cf stop 2>&1 | Out-Null; Xong 'Da dung web.' } catch { Write-Host '  (bo qua)' }
Pop-Location

# --- [2/6] Tat Docker Desktop ---
Buoc '[2/6] Tat Docker Desktop...'
Get-Process 'Docker Desktop','com.docker.backend','com.docker.build','com.docker.dev-envs' -ErrorAction SilentlyContinue |
  ForEach-Object { try { $_.CloseMainWindow() | Out-Null } catch {} }
Start-Sleep -Seconds 8
Get-Process 'Docker Desktop','com.docker.backend','com.docker.build' -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5
Xong 'Da tat.'

# --- [3/6] Tat WSL (bat buoc, khong thi file dang bi khoa) ---
Buoc '[3/6] Tat WSL...'
wsl --shutdown 2>&1 | Out-Null
Start-Sleep -Seconds 10
Xong 'Da tat.'

# --- [4/6] Nen file kho ---
Buoc '[4/6] Dang nen file kho - lau vai phut, DUNG TAT CUA SO NAY...'
$daNen = $false
if (Get-Command Optimize-VHD -ErrorAction SilentlyContinue) {
  try { Optimize-VHD -Path $vhd -Mode Full -ErrorAction Stop; $daNen = $true; Xong 'Nen xong (Optimize-VHD).' }
  catch { Write-Host "  Optimize-VHD khong chay duoc: $($_.Exception.Message)" -ForegroundColor DarkYellow }
}
if (-not $daNen) {
  Write-Host '  Chuyen sang diskpart...' -ForegroundColor DarkYellow
  $tmp = Join-Path $env:TEMP 'nen-kho-docker.txt'
  @("select vdisk file=`"$vhd`"", 'attach vdisk readonly', 'compact vdisk', 'detach vdisk', 'exit') |
    Set-Content -Path $tmp -Encoding ascii
  diskpart /s $tmp | Out-Host
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  Xong 'Nen xong (diskpart).'
}

Tieu-De 'SAU KHI NEN'
$sau = (Get-Item $vhd -Force).Length / 1GB
$oCsau = (Get-PSDrive C).Free / 1GB
Write-Host ("  Kho Docker chiem : {0:N2} GB   (truoc {1:N2} GB)" -f $sau, $truoc)
Write-Host ("  O C con trong    : {0:N2} GB   (truoc {1:N2} GB)" -f $oCsau, $oCtruoc)
Write-Host ("  => LAY LAI DUOC  : {0:N2} GB" -f ($oCsau - $oCtruoc)) -ForegroundColor Green

# --- [5/6] Bat lai Docker Desktop ---
Buoc '[5/6] Bat lai Docker Desktop...'
$dd = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
if (Test-Path $dd) { Start-Process $dd } else { Write-Host '  Khong thay Docker Desktop, anh bat tay giup.' -ForegroundColor Red }
Write-Host '  Dang cho Docker san sang...'
$ok = $false
for ($i = 1; $i -le 20; $i++) {
  Start-Sleep -Seconds 15
  & docker info *> $null
  if ($LASTEXITCODE -eq 0) { $ok = $true; Xong "Docker da len (sau $($i*15) giay)."; break }
  Write-Host "  ...cho tiep ($i/20)"
}

# --- [6/6] Bat lai web ---
if ($ok) {
  Buoc '[6/6] Bat lai web...'
  Push-Location $root
  & docker compose @cf up -d 2>&1 | Out-Host
  Start-Sleep -Seconds 20
  # nginx nho dia chi mang cu cua backend -> tao container moi la phai khoi dong lai nginx
  & docker compose @cf restart nginx 2>&1 | Out-Null
  Start-Sleep -Seconds 5
  & docker compose @cf ps 2>&1 | Out-Host
  Pop-Location
  Xong 'Web da chay lai.'
} else {
  Write-Host "`nDocker chua len sau 5 phut. Anh mo Docker Desktop roi bam 'Bat server' o bang dieu khien." -ForegroundColor Red
}

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host '                   XONG !' -ForegroundColor Green
Write-Host '==============================================' -ForegroundColor Cyan
if ($TuDong) {
  Write-Host "Ket thuc luc $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
  try { Stop-Transcript | Out-Null } catch {}
} else {
  Read-Host 'Bam Enter de dong cua so'
}
