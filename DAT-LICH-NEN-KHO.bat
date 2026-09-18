@echo off
:: ===========================================================================
::  ĐẶT LỊCH TỰ ĐỘNG NÉN KHO DOCKER LÚC 2H SÁNG MỖI NGÀY
::  Nháy đúp file này, bấm "Yes" khi Windows hỏi quyền quản trị.
::  Chỉ cần làm MỘT LẦN — sau đó máy tự chạy mỗi đêm.
:: ===========================================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%~dp0DAT-LICH-NEN-KHO.ps1\"'"
