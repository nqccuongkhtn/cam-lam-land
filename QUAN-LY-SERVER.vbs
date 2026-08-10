' Mo bang dieu khien Cam Lam Land (an cua so PowerShell cho gon)
' Nhay doi vao file nay de mo app.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\QUAN-LY-SERVER.ps1""", 0, False
