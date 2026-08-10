@echo off
cd /d "%~dp0"
echo ================================================================
echo   CAI LICH tu dong sao luu database hang ngay (2h sang)
echo   (chay 1 lan; sau do may tu sao luu + copy ra cloud moi ngay)
echo ================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $a=New-ScheduledTaskAction -Execute '%~dp0SAO-LUU.bat' -Argument '/auto' -WorkingDirectory '%~dp0'; $t=New-ScheduledTaskTrigger -Daily -At 2am; $s=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; Register-ScheduledTask -TaskName 'CamLamLand-Backup' -Action $a -Trigger $t -Settings $s -Description 'Sao luu database Cam Lam Land hang ngay' -Force | Out-Null; Write-Host '[OK] Da cai lich: 2h sang moi ngay tu dong sao luu + copy ra cloud.' } catch { Write-Host ('[X] Loi: ' + $_.Exception.Message); Write-Host '    -> Chuot phai file nay chon Run as administrator roi chay lai.' }"
echo.
echo Muon go lich sau nay: chay lenh  schtasks /Delete /TN CamLamLand-Backup /F
echo.
pause
