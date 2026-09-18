# ============================================================================
#  Cam Lam Land - DAT LICH TU DONG NEN KHO DOCKER LUC 2H SANG MOI NGAY
#  Chay quyen Administrator (nhay dup DAT-LICH-NEN-KHO.bat)
# ----------------------------------------------------------------------------
#  VI SAO CAN:
#  Kho Docker (docker_data.vhdx) CHI PHINH RA, khong bao gio tu co lai. Moi lan
#  build lai web la no them vai GB du ben trong da xoa bot. Da hai lan lam o C
#  can kiet trong MOT NGAY: xuong 0,47 GB roi 0,02 GB -> Docker sap -> CA WEB CHET.
#
#  Lich nay chay luc 2h sang - gio it nguoi truy cap nhat - lam 3 viec:
#    1. Xoa dem build (khong dung toi database)
#    2. Nen file kho, tra cho trong lai cho o C
#    3. Bat lai web va khoi dong lai nginx
#  Web ngung khoang 5-10 phut roi tu chay lai. KHONG xoa gi ben trong.
# ============================================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ps1  = Join-Path $root 'NEN-KHO-DOCKER.ps1'
$ten  = 'CamLamLand - Nen kho Docker 2h sang'

Write-Host '==============================================' -ForegroundColor Cyan
Write-Host '   DAT LICH NEN KHO DOCKER - 2H SANG MOI NGAY' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan

if (-not (Test-Path $ps1)) { Write-Host "Khong thay $ps1" -ForegroundColor Red; Read-Host 'Enter de dong'; exit 1 }

# Phai la quyen quan tri thi moi nen duoc file kho
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Can quyen quan tri. Hay nhay dup DAT-LICH-NEN-KHO.bat de tu xin quyen.' -ForegroundColor Red
  Read-Host 'Enter de dong'; exit 1
}

$act = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -TuDong' -f $ps1) `
  -WorkingDirectory $root

$trg = New-ScheduledTaskTrigger -Daily -At '02:00'

# S4U: chay duoc ca khi chua dang nhap, khong can luu mat khau.
# RunLevel Highest: bat buoc, vi nen file kho doi quyen quan tri.
$pri = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest

$set = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -MultipleInstances IgnoreNew `
  -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10) `
  -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$set.WakeToRun = $true   # may ngu thi tu danh thuc de chay

Register-ScheduledTask -TaskName $ten -Action $act -Trigger $trg -Principal $pri -Settings $set -Force | Out-Null

Write-Host "`nDa dat lich:" -ForegroundColor Green
$t = Get-ScheduledTask -TaskName $ten
$i = $t | Get-ScheduledTaskInfo
Write-Host ("  Ten cong viec : {0}" -f $ten)
Write-Host ("  Chay luc      : 02:00 moi ngay")
Write-Host ("  Lan chay toi  : {0}" -f $i.NextRunTime)
Write-Host ("  Trang thai    : {0}" -f $t.State)
Write-Host ("  Nhat ky       : {0}" -f (Join-Path $root 'logs\nen-kho-docker.log'))
Write-Host "`nMuon chay thu ngay bay gio:  Start-ScheduledTask -TaskName '$ten'" -ForegroundColor DarkGray
Write-Host "Muon bo lich:                Unregister-ScheduledTask -TaskName '$ten' -Confirm:`$false" -ForegroundColor DarkGray
Write-Host "`nXONG !" -ForegroundColor Green
Read-Host 'Bam Enter de dong cua so'
