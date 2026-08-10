# ============================================================
#  Cam Lam Land - Tu dong khoi dong khi mo may (chay AN)
#  Duoc goi tu thu muc Startup qua CamLamLand-AutoStart.vbs
#  (Bat/tat bang nut trong app QUAN-LY-SERVER)
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'
$root = $PSScriptRoot
Set-Location $root

function DockerReady { try { docker info *> $null; return ($LASTEXITCODE -eq 0) } catch { return $false } }

# 1) Bat Docker Desktop neu chua chay
if (-not (DockerReady)) {
  $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (-not (Test-Path $dd)) { $dd = Join-Path ${env:ProgramFiles(x86)} 'Docker\Docker\Docker Desktop.exe' }
  if (Test-Path $dd) { Start-Process $dd }
  # Doi engine san sang (toi da ~5 phut vi luc moi mo may Docker khoi dong cham)
  for ($i = 0; $i -lt 100; $i++) {
    Start-Sleep -Seconds 3
    if (DockerReady) { break }
  }
}

# 2) Xac dinh file compose (them tunnel neu .env co TUNNEL_TOKEN)
$f = @('-f', 'docker-compose.yml', '-f', 'docker-compose.prod.yml')
$envp = Join-Path $root '.env'
if ((Test-Path $envp) -and (Select-String -Path $envp -Pattern '^\s*TUNNEL_TOKEN\s*=\s*(\S.+)$' -Quiet)) {
  $f += @('-f', 'docker-compose.tunnel.yml')
}

# 3) Bat cac container (web + api + database + tunnel)
if (DockerReady) {
  & docker compose @f up -d 2>&1 | Out-Null
}

# 4) Mo bang dieu khien - da thu nho san xuong khay (canh dong ho)
$gui = Join-Path $root 'QUAN-LY-SERVER.ps1'
if (Test-Path $gui) {
  Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $gui, '-Tray'
}
