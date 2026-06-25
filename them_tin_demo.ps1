# Them 20 tin dang demo vao he thong Cam Lam Land (qua API, khong reset du lieu)
$ErrorActionPreference = 'Stop'
$base = 'http://localhost/api'
Write-Host 'Dang dang nhap quan tri...'
$t = (Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"admin@camlam.local","password":"admin12345"}').token
$h = @{ Authorization = "Bearer $t" }

$imgs = @(
 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1605276374104-dee2a0ed9b6c?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=60',
 'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=800&q=60'
)
$wards  = @('Cam Đức','Cam Hải Đông','Cam Hải Tây','Cam Thành Bắc','Cam Hòa','Suối Tân','Suối Cát','Cam Hiệp Nam','Cam Hiệp Bắc','Cam An Nam')
$types  = @('land','house','apartment','villa','commercial','farm')
$lbl    = @{ land='Đất nền'; house='Nhà phố'; apartment='Căn hộ'; villa='Biệt thự'; commercial='Mặt bằng kinh doanh'; farm='Đất vườn' }
$adj    = @('ven biển Bãi Dài','trung tâm','mặt tiền QL1A','gần sân bay Cam Ranh','view đầm Thủy Triều','khu dân cư mới','giá đầu tư','sổ đỏ thổ cư')
$descs  = @(
 'Pháp lý sổ đỏ rõ ràng, vị trí đẹp, tiện kinh doanh và an cư.',
 'Gần biển Bãi Dài, phù hợp xây homestay/nghỉ dưỡng hoặc đầu tư.',
 'Khu dân cư hiện hữu, đường bê tông rộng, gần trường học chợ.',
 'Mặt tiền đường lớn, thuận tiện buôn bán, tiềm năng tăng giá.',
 'Không khí trong lành, thích hợp làm farmstay/nhà vườn nghỉ dưỡng.'
)

for ($i = 0; $i -lt 20; $i++) {
  $type  = $types[$i % $types.Count]
  $ward  = $wards[(Get-Random -Maximum $wards.Count)]
  $price = [int64]((Get-Random -Minimum 8 -Maximum 99) * 100000000)
  $area  = Get-Random -Minimum 80 -Maximum 2000
  $lng   = [math]::Round(109.05 + (Get-Random -Minimum 0 -Maximum 1500)/10000.0, 6)
  $lat   = [math]::Round(12.00  + (Get-Random -Minimum 0 -Maximum 1300)/10000.0, 6)
  $bed   = if ($type -in @('house','apartment','villa')) { Get-Random -Minimum 2 -Maximum 5 } else { $null }
  $title = "$($lbl[$type]) $($adj[(Get-Random -Maximum $adj.Count)]) - $ward"
  $obj = @{
    title = $title; description = $descs[(Get-Random -Maximum $descs.Count)];
    price = $price; area = $area; propertyType = $type; ward = $ward;
    bedrooms = $bed; lng = $lng; lat = $lat; images = @($imgs[$i % $imgs.Count])
  }
  $json  = $obj | ConvertTo-Json -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  Invoke-RestMethod "$base/listings" -Method Post -Headers $h -ContentType 'application/json; charset=utf-8' -Body $bytes | Out-Null
  Write-Host ("[{0,2}/20] {1}  -  {2:N0} d" -f ($i+1), $title, $price)
}
Write-Host ''
Write-Host 'XONG. Da them 20 tin demo. Mo http://localhost/listings de xem.'
