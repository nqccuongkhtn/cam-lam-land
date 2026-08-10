# ============================================================
#  Cam Lam Land - Bang dieu khien Server (GUI + khay he thong)
#  Chay bang: QUAN-LY-SERVER.vbs (nhay doi de mo)
#  Tham so -Tray: mo san o che do thu nho xuong khay (dung khi tu chay)
# ============================================================
param([switch]$Tray)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$ErrorActionPreference = 'SilentlyContinue'

$root = $PSScriptRoot
Set-Location $root
$script:startTray = $Tray.IsPresent

# --- Cac file compose (them tunnel neu .env co TUNNEL_TOKEN) ---
function Get-ComposeArgs {
  $f = @('-f','docker-compose.yml','-f','docker-compose.prod.yml')
  $envp = Join-Path $root '.env'
  if (Test-Path $envp) {
    $m = Select-String -Path $envp -Pattern '^\s*TUNNEL_TOKEN\s*=\s*(\S.+)$'
    if ($m) { $f += @('-f','docker-compose.tunnel.yml') }
  }
  return $f
}
function ComposeStr { return ((Get-ComposeArgs) -join ' ') }

function Test-DockerRunning {
  try { docker info *> $null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}
function Test-WebUp {
  try { $r = Invoke-WebRequest -UseBasicParsing 'http://localhost/api/health' -TimeoutSec 2; return ($r.StatusCode -eq 200) } catch { return $false }
}
function Test-FrontendRunning {
  try { $o = & docker ps --filter 'name=camlam_frontend' --filter 'status=running' --format '{{.Names}}' 2>$null; return ([string]$o -match 'camlam_frontend') } catch { return $false }
}

# --- Tu chay khi mo may (thu muc Startup cua Windows) ---
$autoVbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'CamLamLand-AutoStart.vbs'
function Test-AutoStart { return (Test-Path $autoVbs) }
function Set-AutoStart([bool]$on) {
  if ($on) {
    $ps1 = Join-Path $root 'KHOI-DONG-CUNG-MAY.ps1'
    $vbs = @"
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$ps1""", 0, False
"@
    Set-Content -Path $autoVbs -Value $vbs -Encoding ASCII
  } else {
    Remove-Item $autoVbs -Force -ErrorAction SilentlyContinue
  }
}

# --- Mau ---
$cNavy   = [System.Drawing.Color]::FromArgb(10,37,64)
$cGreen  = [System.Drawing.Color]::FromArgb(22,163,74)
$cRed    = [System.Drawing.Color]::FromArgb(220,38,38)
$cGold   = [System.Drawing.Color]::FromArgb(202,161,75)
$cSlate  = [System.Drawing.Color]::FromArgb(71,85,105)
$cAmber  = [System.Drawing.Color]::FromArgb(217,119,6)
$cBg     = [System.Drawing.Color]::FromArgb(244,247,250)
$white   = [System.Drawing.Color]::White
# Mau TUOI (de noi bat tren nen navy cua thanh noi)
$cbGreen = [System.Drawing.Color]::FromArgb(34,197,94)
$cbRed   = [System.Drawing.Color]::FromArgb(248,113,113)
$cbAmber = [System.Drawing.Color]::FromArgb(251,191,36)

# --- Tao icon cham tron mau (cho khay he thong) ---
function New-DotIcon([System.Drawing.Color]$col) {
  $bmp = New-Object System.Drawing.Bitmap 16, 16
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $br = New-Object System.Drawing.SolidBrush $col
  $g.FillEllipse($br, 1, 1, 14, 14)
  $br.Dispose(); $g.Dispose()
  $ico = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
  $bmp.Dispose()
  return $ico
}
$icoGray  = New-DotIcon ([System.Drawing.Color]::Gray)
$icoGreen = New-DotIcon $cGreen
$icoRed   = New-DotIcon $cRed
$icoAmber = New-DotIcon $cAmber

# --- Form ---
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Cam Lam Land - Quan ly Server'
$form.ClientSize = New-Object System.Drawing.Size(452, 606)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false
$form.BackColor = $cBg
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$appIcoPath = Join-Path $root 'camlam-server.ico'
$form.Icon = if (Test-Path $appIcoPath) { New-Object System.Drawing.Icon $appIcoPath } else { $icoGreen }

$title = New-Object System.Windows.Forms.Label
$title.Text = 'CAM LAM LAND'
$title.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $cNavy
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(20, 14)
$form.Controls.Add($title)

$sub = New-Object System.Windows.Forms.Label
$sub.Text = 'Bang dieu khien may chu'
$sub.ForeColor = [System.Drawing.Color]::Gray
$sub.AutoSize = $true
$sub.Location = New-Object System.Drawing.Point(22, 48)
$form.Controls.Add($sub)

# --- O trang thai ---
$panel = New-Object System.Windows.Forms.Panel
$panel.Size = New-Object System.Drawing.Size(412, 58)
$panel.Location = New-Object System.Drawing.Point(20, 76)
$panel.BackColor = $white
$form.Controls.Add($panel)

$dot = New-Object System.Windows.Forms.Label
$dot.Text = [char]0x25CF
$dot.Font = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold)
$dot.ForeColor = [System.Drawing.Color]::Gray
$dot.AutoSize = $true
$dot.Location = New-Object System.Drawing.Point(12, 10)
$panel.Controls.Add($dot)

$statusText = New-Object System.Windows.Forms.Label
$statusText.Text = 'Dang kiem tra...'
$statusText.Font = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
$statusText.ForeColor = $cNavy
$statusText.AutoSize = $true
$statusText.Location = New-Object System.Drawing.Point(48, 8)
$panel.Controls.Add($statusText)

$trafficLabel = New-Object System.Windows.Forms.Label
$trafficLabel.Text = 'Luot xem: dang tai...'
$trafficLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$trafficLabel.ForeColor = [System.Drawing.Color]::Gray
$trafficLabel.AutoSize = $true
$trafficLabel.Location = New-Object System.Drawing.Point(48, 34)
$panel.Controls.Add($trafficLabel)

# --- Nut ---
function New-Btn($text, $x, $y, $w, $bg) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text
  $b.Size = New-Object System.Drawing.Size($w, 50)
  $b.Location = New-Object System.Drawing.Point($x, $y)
  $b.FlatStyle = 'Flat'
  $b.FlatAppearance.BorderSize = 0
  $b.BackColor = $bg
  $b.ForeColor = [System.Drawing.Color]::White
  $b.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
  $b.Cursor = 'Hand'
  $b.TextAlign = 'MiddleCenter'
  $form.Controls.Add($b)
  return $b
}

$btnStart   = New-Btn ("$([char]0x25B6)  Bat server")        20 148 198 $cGreen
$btnStop    = New-Btn ("$([char]0x25FC)  Tat server")        234 148 198 $cRed
$btnWeb     = New-Btn 'Mo trang web'                          20 206 198 $cNavy
$btnRestart = New-Btn ("$([char]0x27F3)  Khoi dong lai")     234 206 198 $cSlate
$btnBackup  = New-Btn 'Sao luu du lieu'                       20 264 198 $cGold
$btnLog     = New-Btn 'Xem log'                               234 264 198 $cSlate
$btnAuto    = New-Btn 'Tu chay khi mo may'                    20 322 412 $cSlate
$btnMaint   = New-Btn 'Bao tri ten mien'                      20 380 198 $cSlate
$btnClean   = New-Btn 'Don o dia'                            234 380 198 $cGold
$btnFront   = New-Btn ("$([char]0x27F3)  Cap nhat GIAO DIEN (frontend - build nhanh)") 20 438 412 $cNavy

# --- Nhat ky ---
$log = New-Object System.Windows.Forms.TextBox
$log.Multiline = $true
$log.ReadOnly = $true
$log.ScrollBars = 'Vertical'
$log.Size = New-Object System.Drawing.Size(412, 78)
$log.Location = New-Object System.Drawing.Point(20, 496)
$log.BackColor = [System.Drawing.Color]::FromArgb(248,250,252)
$log.ForeColor = $cNavy
$log.BorderStyle = 'FixedSingle'
$log.Font = New-Object System.Drawing.Font('Consolas', 9)
$form.Controls.Add($log)

function Write-Log($msg) {
  $log.AppendText(('[{0}] {1}{2}' -f (Get-Date -Format 'HH:mm:ss'), $msg, "`r`n"))
}

# --- Chay lenh trong cua so cmd rieng (khong lam treo GUI) ---
function Run-Console([string]$titleTxt, [string]$cmd, [string]$flag) {
  if (-not $flag) { $flag = '/c' }
  $inner = "title $titleTxt & $cmd"
  # Chay xong tu dong dong cua so; chi giu lai (pause) neu CO LOI de con doc.
  if ($flag -eq '/c') { $inner = "$inner & if errorlevel 1 pause" }
  Start-Process -FilePath 'cmd.exe' -ArgumentList $flag, $inner -WorkingDirectory $root
}

# --- Su kien nut ---
$btnStart.Add_Click({
  if (-not (Test-DockerRunning)) {
    Write-Log 'Docker chua chay - dang mo Docker Desktop...'
    $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path $dd) { Start-Process $dd }
    [System.Windows.Forms.MessageBox]::Show("Docker Desktop dang khoi dong.`nDoi toi khi thay 'Engine running' (~30-60 giay) roi bam 'Bat server' lai.", 'Cho Docker', 'OK', 'Information') | Out-Null
    return
  }
  Write-Log 'Dang bat server (xem cua so build)...'
  Run-Console 'Bat server Cam Lam Land' ('docker compose ' + (ComposeStr) + ' up -d --build & docker image prune -f')
  $script:domMaint = $false; Update-MaintBtn
})

$btnStop.Add_Click({
  if ([System.Windows.Forms.MessageBox]::Show('Tat server? Khach se khong vao web duoc nua (du lieu van con).', 'Xac nhan', 'YesNo', 'Question') -ne 'Yes') { return }
  Write-Log 'Dang tat server...'
  Run-Console 'Tat server Cam Lam Land' ('docker compose ' + (ComposeStr) + ' down')
})

$btnRestart.Add_Click({
  Write-Log 'Dang khoi dong lai...'
  $cf = ComposeStr
  Run-Console 'Khoi dong lai Cam Lam Land' ('docker compose ' + $cf + ' down & docker compose ' + $cf + ' up -d --build & docker image prune -f')
  $script:domMaint = $false; Update-MaintBtn
})

$btnFront.Add_Click({
  if (-not (Test-DockerRunning)) { Write-Log 'Docker chua chay - hay bat server truoc.'; return }
  Write-Log 'Dang build lai GIAO DIEN (chi frontend, giu cache -> nhanh)...'
  Run-Console 'Cap nhat giao dien (frontend)' ('docker compose ' + (ComposeStr) + ' up -d --build --no-deps frontend & docker image prune -f')
})

$btnWeb.Add_Click({ Start-Process 'http://localhost' })

$btnBackup.Add_Click({
  $p = Join-Path $root 'SAO-LUU.bat'
  if (Test-Path $p) { Write-Log 'Dang sao luu du lieu...'; Start-Process -FilePath $p -WorkingDirectory $root }
  else { Write-Log 'Khong thay SAO-LUU.bat' }
})

$btnLog.Add_Click({
  Write-Log 'Mo cua so log (Ctrl+C de dong theo doi)...'
  Run-Console 'Log server' ('docker compose ' + (ComposeStr) + ' logs -f --tail 200') '/k'
})

# --- Nut Tu chay khi mo may ---
function Update-AutoBtn {
  if (Test-AutoStart) {
    $btnAuto.Text = "$([char]0x2713) Tu chay khi mo may: DANG BAT (bam de tat)"
    $btnAuto.BackColor = $cGreen
  } else {
    $btnAuto.Text = 'Tu chay khi mo may: DANG TAT (bam de bat)'
    $btnAuto.BackColor = $cSlate
  }
}
$btnAuto.Add_Click({
  if (Test-AutoStart) {
    Set-AutoStart($false)
    Write-Log 'Da TAT tu chay khi mo may.'
  } else {
    Set-AutoStart($true)
    Write-Log 'Da BAT. Lan sau mo may: Docker + server + web tu dong len.'
  }
  Update-AutoBtn
})
Update-AutoBtn

# --- Nut Bao tri TEN MIEN: ten mien hien trang game, con localhost VAN chay de test ---
#     Bat/tat bang cach tao/xoa file co /etc/nginx/maintenance.on trong container nginx.
$script:domMaint = $false
function Update-MaintBtn {
  if ($script:domMaint) {
    $btnMaint.Text = "$([char]0x2713) Dang bao tri (tat)"
    $btnMaint.BackColor = $cAmber
  } else {
    $btnMaint.Text = 'Bao tri ten mien'
    $btnMaint.BackColor = $cSlate
  }
}
$btnMaint.Add_Click({
  if (-not (Test-DockerRunning)) { Write-Log 'Docker chua chay - hay bat server truoc.'; return }
  if (-not $script:domMaint) {
    if ([System.Windows.Forms.MessageBox]::Show("Bat BAO TRI cho TEN MIEN?`n`n- Khach vao batdongsancamlam.dpdns.org se thay trang bao tri + game.`n- Ban vao http://localhost VAN thay web that de sua/test.`nDu lieu van con nguyen.", 'Bao tri ten mien', 'YesNo', 'Question') -ne 'Yes') { return }
    Write-Log 'BAT bao tri cho TEN MIEN (localhost van vao binh thuong)...'
    Run-Console 'Bao tri ten mien: BAT' 'docker exec camlam_nginx touch /etc/nginx/maintenance.on'
    $script:domMaint = $true
  } else {
    Write-Log 'TAT bao tri -> dua web that len ten mien...'
    Run-Console 'Bao tri ten mien: TAT' 'docker exec camlam_nginx rm -f /etc/nginx/maintenance.on'
    $script:domMaint = $false
  }
  Update-MaintBtn
})
Update-MaintBtn

# --- Nut Don o dia: don triet de o C (Docker + ngu dong + temp + Windows Update + WinSxS). GIU database ---
$btnClean.Add_Click({
  if ([System.Windows.Forms.MessageBox]::Show("Don o dia C?`n`nSe don: build cache + anh Docker thua, file tam Windows, cache Windows Update, thung rac, kho WinSxS cu, va tat file ngu dong.`n=> Giai phong NHIEU GB. Database va du lieu GIU NGUYEN.`n`n(Se hien cua so xin quyen Administrator - bam Yes/Co)", 'Don o dia', 'YesNo', 'Question') -ne 'Yes') { return }
  $sc = Join-Path $root 'DON-O-DIA.ps1'
  if (-not (Test-Path $sc)) { Write-Log 'Khong thay DON-O-DIA.ps1'; return }
  Write-Log 'Dang don o dia (cua so Administrator)...'
  try { Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$sc`"" }
  catch { Write-Log 'Da huy quyen Administrator - chua don.' }
})

# --- Khay he thong (system tray) ---
function Restore-Win {
  $form.Show(); $form.WindowState = 'Normal'; $form.Activate(); $form.BringToFront()
}
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $icoGray
$tray.Text = 'Cam Lam Land'
$tray.Visible = $true

$tray.Add_MouseClick({ param($s, $e) if ($e.Button -eq 'Left') { Restore-Win } })
$tray.Add_MouseDoubleClick({ Restore-Win })

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$miOpen = $menu.Items.Add('Mo bang dieu khien'); $miOpen.add_Click({ Restore-Win })
$miWeb  = $menu.Items.Add('Mo trang web');        $miWeb.add_Click({ Start-Process 'http://localhost' })
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$miExit = $menu.Items.Add('Thoat han (dong app)'); $miExit.add_Click({ $tray.Visible = $false; $form.Close() })
$tray.ContextMenuStrip = $menu

# Thu nho: dua ve thanh taskbar (KHONG an di) de app khong bao gio bi "mat".
# Cham mau trang thai van luon nam o khay canh dong ho.
$form.Add_Shown({ if ($script:startTray) { $form.WindowState = 'Minimized' } })
$form.Add_FormClosing({ $tray.Visible = $false; $tray.Dispose() })

# --- THANH TRANG THAI NOI tren desktop (keo tha tu do, luon noi tren cung) ---
$badge = New-Object System.Windows.Forms.Form
$badge.FormBorderStyle = 'None'
$badge.ShowInTaskbar = $false
$badge.TopMost = $true
$badge.BackColor = $cNavy
$badge.Size = New-Object System.Drawing.Size(270, 46)
$badge.StartPosition = 'Manual'
$bp = New-Object System.Drawing.Drawing2D.GraphicsPath
$bp.AddArc(0, 0, 22, 22, 180, 90); $bp.AddArc(248, 0, 22, 22, 270, 90); $bp.AddArc(248, 24, 22, 22, 0, 90); $bp.AddArc(0, 24, 22, 22, 90, 90); $bp.CloseAllFigures()
$badge.Region = New-Object System.Drawing.Region $bp

$bDot = New-Object System.Windows.Forms.Label
$bDot.Text = [char]0x25CF
$bDot.Font = New-Object System.Drawing.Font('Segoe UI', 19, [System.Drawing.FontStyle]::Bold)
$bDot.ForeColor = [System.Drawing.Color]::Gray
$bDot.AutoSize = $true; $bDot.BackColor = [System.Drawing.Color]::Transparent
$bDot.Location = New-Object System.Drawing.Point(13, 11)
$badge.Controls.Add($bDot)

$bTxt = New-Object System.Windows.Forms.Label
$bTxt.Text = 'Cam Lam Land'
$bTxt.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$bTxt.ForeColor = $white; $bTxt.AutoSize = $true; $bTxt.BackColor = [System.Drawing.Color]::Transparent
$bTxt.Location = New-Object System.Drawing.Point(38, 6)
$badge.Controls.Add($bTxt)

$bSub = New-Object System.Windows.Forms.Label
$bSub.Text = 'dang tai...'
$bSub.Font = New-Object System.Drawing.Font('Segoe UI', 8)
$bSub.ForeColor = [System.Drawing.Color]::FromArgb(170, 185, 205); $bSub.AutoSize = $true; $bSub.BackColor = [System.Drawing.Color]::Transparent
$bSub.Location = New-Object System.Drawing.Point(38, 25)
$badge.Controls.Add($bSub)

# Keo tha bang delta con tro man hinh (dung du bam vao chu hay nen)
$script:bDrag = $false; $script:bCur = $null; $script:bLoc = $null
$badgePosFile = Join-Path $root 'thanh-noi-vitri.txt'
$onDown = { param($s, $e) if ($e.Button -eq 'Left') { $script:bDrag = $true; $script:bCur = [System.Windows.Forms.Cursor]::Position; $script:bLoc = $badge.Location } }
$onMove = { param($s, $e) if ($script:bDrag) { $p = [System.Windows.Forms.Cursor]::Position; $badge.Location = New-Object System.Drawing.Point (($script:bLoc.X + $p.X - $script:bCur.X), ($script:bLoc.Y + $p.Y - $script:bCur.Y)) } }
$onUp = { param($s, $e) $script:bDrag = $false; try { "$($badge.Location.X),$($badge.Location.Y)" | Set-Content $badgePosFile } catch { } }
$onDbl = { Restore-Win }
foreach ($c in @($badge, $bDot, $bTxt, $bSub)) {
  $c.Add_MouseDown($onDown); $c.Add_MouseMove($onMove); $c.Add_MouseUp($onUp); $c.Add_MouseDoubleClick($onDbl)
  $c.ContextMenuStrip = $menu; $c.Cursor = 'SizeAll'
}

# Vi tri: mac dinh goc duoi phai, hoac doc lai vi tri da luu
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$badge.Location = New-Object System.Drawing.Point (($wa.Right - $badge.Width - 16), ($wa.Bottom - $badge.Height - 16))
try { if (Test-Path $badgePosFile) { $xy = ((Get-Content $badgePosFile -Raw).Trim() -split ','); if ($xy.Count -eq 2) { $badge.Location = New-Object System.Drawing.Point ([int]$xy[0], [int]$xy[1]) } } } catch { }
$badge.Show()
$form.Add_FormClosing({ try { $badge.Close() } catch { } })

# --- Tooltip khay = trang thai + traffic ---
$script:statusWord = 'Dang kiem tra'
$script:tStr = ''
$script:badgeColor = [System.Drawing.Color]::Gray
function Update-Badge {
  $bDot.ForeColor = $script:badgeColor
  $bSub.ForeColor = $script:badgeColor
  $s = $script:statusWord
  if ($script:tStr) { $s = $s + ' - ' + $script:tStr }
  $bSub.Text = $s
}
function Set-Tray {
  $t = 'Cam Lam Land - ' + $script:statusWord
  if ($script:tStr) { $t = $t + ' | ' + $script:tStr }
  if ($t.Length -gt 62) { $t = $t.Substring(0, 62) }
  $tray.Text = $t
}
function Poll-Traffic {
  try {
    $r = Invoke-RestMethod -UseBasicParsing 'http://localhost/api/traffic/live' -TimeoutSec 3
    $script:tStr = "Xem $($r.online) - HN $($r.today)"
    $trafficLabel.Text = "Dang xem: $($r.online)   Hom nay: $($r.today)   7 ngay: $($r.week)"
    $trafficLabel.ForeColor = [System.Drawing.Color]::FromArgb(22,101,52)
  } catch {
    $script:tStr = ''
    $trafficLabel.Text = 'Luot xem: (web chua chay)'
    $trafficLabel.ForeColor = [System.Drawing.Color]::Gray
  }
  Set-Tray; Update-Badge
}

# --- Cap nhat trang thai dinh ky (form + khay) ---
$script:checking = $false
$refresh = {
  if ($script:checking) { return }
  $script:checking = $true
  try {
    $up = Test-WebUp
    $dok = $up -or (Test-DockerRunning)
    if ($up) { $word = 'Dang chay'; $bc = $cbGreen; $wc = $cGreen; $ic = $icoGreen }
    elseif (-not $dok) { $word = 'Docker chua chay'; $bc = $cbAmber; $wc = $cAmber; $ic = $icoAmber }
    else { $word = 'Da tat'; $bc = $cbRed; $wc = $cRed; $ic = $icoRed }
    # Uu tien cap nhat thanh noi TRUOC (khong de loi giao dien khac chan lai)
    $script:statusWord = $word; $script:badgeColor = $bc
    Update-Badge
    try {
      $dot.ForeColor = $wc
      $statusText.Text = $word; $statusText.ForeColor = $wc
      $btnStart.Enabled = ($word -ne 'Dang chay'); $btnStop.Enabled = ($word -eq 'Dang chay')
      $tray.Icon = $ic; Set-Tray
    } catch { }
  } catch { } finally { $script:checking = $false }
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick($refresh)
$timer.Start()

# Traffic: cap nhat moi 20 giay
$tTimer = New-Object System.Windows.Forms.Timer
$tTimer.Interval = 20000
$tTimer.Add_Tick({ Poll-Traffic })
$tTimer.Start()

Write-Log 'San sang. Thu nho (nut _) de app nam canh dong ho. Bam vao cham mau de mo lai.'
& $refresh
Poll-Traffic

[System.Windows.Forms.Application]::Run($form)
$timer.Stop()
$tTimer.Stop()
$tray.Visible = $false
$tray.Dispose()
try { $badge.Dispose() } catch { }
