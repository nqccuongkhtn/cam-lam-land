@echo off
:: ===========================================================================
::  NÉN KHO DOCKER — lấy lại chỗ trống cho ổ C
::  Nháy đúp file này, bấm "Yes" khi Windows hỏi quyền quản trị.
::  Toàn bộ việc thật nằm trong NEN-KHO-DOCKER.ps1 (dùng chung với nút
::  "Nen kho Docker" trên bảng điều khiển QUAN-LY-SERVER).
:: ===========================================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%~dp0NEN-KHO-DOCKER.ps1\"'"
