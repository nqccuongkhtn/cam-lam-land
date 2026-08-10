@echo off
cd /d "%~dp0"
echo ================================================================
echo   Tao loi tat "Quan Ly Server Cam Lam" ngoai Desktop (co icon)
echo ================================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Location).Path; $ws=New-Object -ComObject WScript.Shell; $lnk=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Quan Ly Server Cam Lam.lnk'); $lnk.TargetPath=(Join-Path $d 'QUAN-LY-SERVER.vbs'); $lnk.WorkingDirectory=$d; $lnk.IconLocation=((Join-Path $d 'camlam-server.ico')+',0'); $lnk.Description='Quan ly may chu Cam Lam Land'; $lnk.Save()"
if errorlevel 1 goto :err
echo.
echo [OK] Xong! Ra man hinh Desktop tim bieu tuong "Quan Ly Server Cam Lam".
echo      Nhay doi vao do de mo app (co the ghim vao Taskbar cho tien).
echo.
pause
exit /b 0
:err
echo [X] Khong tao duoc loi tat. Thu chay lai.
pause
exit /b 1
