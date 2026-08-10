# Xoa cac lop GIS cu trong he thong Cam Lam Land (giu lai lop co ten chua tu khoa $KEEP)
$ErrorActionPreference = 'Stop'
$base = 'http://localhost/api'
$KEEP = 'full'   # <-- GIU lai lop co ten chua tu nay (sua neu can). De trong '' de xoa TAT CA.

Write-Host 'Dang dang nhap quan tri...'
$login  = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"admin@camlam.local","password":"admin12345"}'
$h = @{ Authorization = "Bearer $($login.token)" }

$layers = (Invoke-RestMethod "$base/layers").layers
Write-Host ("Tim thay {0} lop:" -f $layers.Count)
$layers | ForEach-Object { Write-Host ("   - {0}  ({1} doi tuong)" -f $_.name, $_.featureCount) }
Write-Host ''

$del = 0
foreach ($l in $layers) {
  if ($KEEP -ne '' -and $l.name -match $KEEP) { Write-Host ("GIU LAI : {0}" -f $l.name); continue }
  Write-Host ("XOA     : {0}" -f $l.name)
  Invoke-RestMethod "$base/layers/$($l.slug)" -Method Delete -Headers $h | Out-Null
  $del++
}
Write-Host ''
Write-Host ("XONG. Da xoa {0} lop. Tai lai localhost/map de kiem tra." -f $del)
