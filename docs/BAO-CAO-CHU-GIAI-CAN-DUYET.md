# Báo cáo: tên loại đất CHƯA CHẮC — đề xuất để chủ dự án duyệt

Soạn đêm 11/10/2026. Đây là các vùng tô trong bản vẽ quy hoạch mà **tên loại đất không khớp chắc chắn một dòng trong khung chú
giải của chính bản vẽ đó**. Với từng vùng, máy đã dò ba nguồn căn cứ ở **đúng chỗ đó**:

1. **Bản đồ địa chính** đang ghi mục đích sử dụng gì (mã ONT, SON, RSX… — theo diện tích phần giao).
2. **QĐ893** (quy hoạch sử dụng đất 2030) ghi loại gì.
3. **Các bản quy hoạch khác** chồng lên đó ghi gì.

Sửa tên: bảng `scripts/qh-pipeline/ten-suy-luan.json` (bản phân khu), `scripts/qh-pipeline/lop-205.json` (QĐ205), bảng TEN đầu
`scripts/qh-pipeline/5b-tao-qh-zones-893.py` (QĐ893) — rồi chạy lại 5g / 5h / 5b và `8-tao-chu-giai.py`.

---

## A. ĐÃ ÁP DỤNG (căn cứ chắc chắn — anh xem lại, sai thì báo)

| Bản | Lớp trong bản vẽ | Tên cũ trên web | Tên mới | Căn cứ |
|---|---|---|---|---|
| QĐ205 | `@ nuoc` (35 ha, xanh #0066cc) | Mặt nước | **Đất sông, suối, kênh rạch** | Địa chính cùng chỗ **99 % là SON** (sông suối); QĐ893 77 % "sông, ngòi, kênh, rạch"; QĐ918 92 % "sông, suối, kênh, rạch" |
| QĐ918 | `L-QH-langxomdothihoa` (36 ha) | Làng xóm đô thị hoá | **Đất làng xóm đô thị hóa** | Khung chú giải QĐ205 có dòng "LÀNG XÓM ĐÔ THỊ HÓA" dùng **đúng lớp này, đúng màu #a9b34b**; QĐ205 cùng chỗ 100 % "Đất làng xóm đô thị hóa"; QĐ893 100 % "Đất ở tại nông thôn" |
| Tây Nam | `HT_DAT_O_Langxom` (185 ha) | Làng xóm | **Đất làng xóm, dân cư nông thôn** | Khung chú giải **QĐ918** (cùng bộ tên lớp) có dòng "Đất làng xóm, dân cư nông thôn" cho **chính lớp HT_DAT_O_Langxom**; địa chính: ONT+CLN 33 %, ONT 15 %; QĐ205 95 % "điểm dân cư nông thôn hiện hữu"; QĐ893 62 % "Đất ở" |
| QĐ205 | `_X_ĐVO mớiTB_2030` (857 ha) | Đất đơn vị ở | **Đất đơn vị ở mới (mật độ trung bình)** | Khung chú giải có ô mẫu đúng lớp + đúng màu; web từng không khớp vì tên lớp trong file gpkg bị sai bảng mã ở chữ "Đ" |
| QĐ205 | `0` (2 ô, 2,9 ha, màu #7f7f3f) | Rừng phòng hộ | **Đất điểm dân cư nông thôn hiện hữu (có nông nghiệp xen kẹp ~75%)** | Màu **và** mẫu tô (BRASS) y hệt ô mẫu "Điểm dân cư nông thôn hiện hữu" trong khung chú giải; lớp "0" không mang nghĩa gì |
| QĐ205 | `DatQuandoi` (6 ha) | Quốc phòng | **Đất quốc phòng** | Lớp tên "đất quân đội"; khung chú giải chỉ có dòng "Đất quốc phòng" (ô mẫu #394c26, vùng tô #424c26 — gần như trùng) |
| QĐ893 | mã **NTD** (61 ô) | Đất nghĩa trang, nhà tang lễ, cơ sở hỏa táng | **…, đất cơ sở lưu giữ tro cốt** | Chữ đầy đủ trong khung chú dẫn bản vẽ |
| QĐ893 | mã **DDD** (9 ô) | Đất có di tích lịch sử - văn hóa, danh lam thắng cảnh | **…, di sản thiên nhiên** | Chữ đầy đủ trong khung chú dẫn bản vẽ |
| QĐ893 | mã **DBV** | Đất công trình hạ tầng bưu chính, viễn thông | **…, công nghệ thông tin** | Chữ đầy đủ trong khung chú dẫn (mã này hiện chưa có ô nào trên bản đồ) |

Giữ nguyên có lý do: QĐ893 mã **SKC** — khung chú dẫn bản vẽ in nhầm chữ "Đất **sản cơ sở xuất** phi nông nghiệp"; web giữ chữ
đúng "Đất cơ sở sản xuất phi nông nghiệp".

## B. ĐỀ XUẤT — CHỜ ANH DUYỆT (chưa đổi trên web)

| Bản | Lớp | Đang ghi | Đề xuất | Căn cứ | Mức chắc |
|---|---|---|---|---|---|
| QĐ205 | `L- bo dat` (26,2 ha, màu XÁM #848484, một dải dài — dài gấp ~7,5 lần rộng) | Cây xanh | **Đất cây xanh chuyên dụng** | QĐ2076 (phân khu, chi tiết hơn) cùng chỗ **100 % "Đất cây xanh chuyên dụng (cây xanh cách ly)"**; QĐ893 100 % "Đất công cộng, dịch vụ, sản xuất"; địa chính: CLN 38 %, ONT+CLN 20 %, BHK 13 %, NTS 11 %. Khung chú giải QĐ205 không có ô màu xám này | Vừa |
| QĐ205 | `l-Datdoinui` (16,7 ha, 5 mảnh) | Đất đồi núi | **Giữ "Đất đồi núi"** (hoặc "Đất lâm nghiệp (rừng sản xuất)") | Bản Tây Nam có dòng chú giải "Đất đồi núi"; địa chính cùng chỗ 72 % RSX (rừng sản xuất); QĐ Tây Bắc 58 % rừng sản xuất + 42 % rừng đặc dụng | Vừa |
| QĐ918 | `DAT_KXD_DulichRung_qh` (32,1 ha, một lô, nhãn lô DLST-01) | KXD_DulichRung_qh (tên lớp thô) | **Đất khu dịch vụ du lịch** (dòng chú giải QĐ918 gần nhất) — hoặc anh đặt tên đúng theo thuyết minh quyết định 918 | Tên lớp "Du lịch rừng", nhãn lô "DLST" (du lịch sinh thái); QĐ893 cùng chỗ "Đất thương mại, dịch vụ"; QĐ205 cùng chỗ 56 % cây xanh chuyên dụng + 44 % rừng sản xuất; địa chính 62 % RSX. Khung chú giải QĐ918 KHÔNG có dòng cho lớp này | Thấp |
| Tây Nam | `QHDD_DAT_Cayxanhhanche` (27 ha, 2 mảnh) | Cây xanh sử dụng hạn chế | **Đất cây xanh sử dụng hạn chế** (thêm chữ "Đất" cho đồng bộ) | Không có dòng trong chú giải Tây Nam; QĐ205 cùng chỗ 100 % "Đất sản xuất nông nghiệp"; địa chính 54 % BHK, 23 % đất lúa (hiện là ruộng) | Vừa |
| QĐ893 | 714 vùng tô **xanh nước #7fffff không ghi mã** (~4.585 ha) | Đất sông, ngòi, kênh, rạch | Tách theo bản đồ địa chính cùng chỗ (xem mục C) | Khung chú dẫn dùng CÙNG MÀU này cho cả SON (sông), MNC (mặt nước chuyên dùng — hồ chứa), NTS (nuôi trồng thuỷ sản), DTL (thuỷ lợi), DCT | Chờ số liệu |

## C. QĐ893 — VÙNG XANH NƯỚC KHÔNG MÃ

Bản đồ QĐ893 **không ghi chữ "SON" ở vùng nào**. Cả 801 ô web đang gọi "Đất sông, ngòi, kênh, rạch" (~4.588 ha) đều được gán
**theo màu xanh nước**, mà khung chú dẫn dùng chung màu này cho 5 loại (SON sông · MNC mặt nước chuyên dùng/hồ chứa · NTS nuôi
trồng thuỷ sản · DTL thuỷ lợi · DCT). Đối chiếu từng ô với **bản đồ địa chính cùng chỗ** (mã chiếm nhiều diện tích nhất trong ô):

| Địa chính cùng chỗ đang ghi | Số ô | Diện tích | Gợi ý loại quy hoạch | Mức chắc |
|---|---|---|---|---|
| (không có thửa địa chính — mặt đầm, sông lớn chưa chia thửa) | ~400 | ~2.745 ha | Đầm Thuỷ Triều / mặt nước lớn → **"Đất có mặt nước chuyên dùng dạng ao, hồ, đầm, phá" (MNC)** nếu là đầm; sông lớn giữ SON | Vừa |
| DCS — đất đồi núi chưa sử dụng | 44 | 492 ha | Hồ chứa quy hoạch mới → **MNC** | Vừa |
| NTS — nuôi trồng thuỷ sản | 45 | 274 ha | **"Đất nuôi trồng thủy sản" (NTS)** | Vừa – cao |
| BHK / CLN / LUC / RSX — đất trồng trọt, rừng | ~140 | ~600 ha | Hồ, kênh quy hoạch mới → **MNC** hoặc SON tuỳ hình (dải dài = kênh/sông, khối = hồ) | Thấp |
| SON — sông suối | 149 | 225 ha | Giữ **"Đất sông, ngòi, kênh, rạch"** | Cao |
| DTL — thuỷ lợi | 270 | 34 ha | **"Đất công trình thủy lợi" (DTL)** — các kênh mương nhỏ | Vừa – cao |

Chưa đổi gì trên web. Anh chọn cách: (a) để nguyên "sông, ngòi" như hiện nay; (b) đổi theo bảng trên; (c) chỉ đổi 2 dòng chắc nhất
(NTS → nuôi trồng thuỷ sản, DTL → thuỷ lợi).

## E. THỬA 95 TỜ 15 XÃ CAM LÂM — ĐỐI CHIẾU CHI TIẾT TỪNG PHẦN QUY HOẠCH

Hình thửa trên web (đo phẳng VN-2000 như MicroStation): **16.704,4884 m²** — đúng số sổ 16.704,5. Thửa có một lỗ thủng nhỏ (~11,6 m²,
đất thửa khác) nằm trọn trong phần cây xanh của QĐ205 — đã trừ đúng chỗ. Mỗi bản một ảnh, số trên ảnh = số mảnh trong bảng
(thư mục `bao-cao-qh/`): `thua-95-to-15-xa-cam-lam-qd205.png`, `…-qd893.png`, `…-qd2101.png`, và riêng phần đường QĐ205:
`thua-95-to-15-xa-cam-lam-giao-thong-qd205.png`.

**QĐ205** (vùng tô đọc thẳng QD205.gpkg, cung tròn chính xác)

| Mảnh | Loại đất | Diện tích (m²) |
|---|---|---|
| 1 | Đất giao thông (khe không tô — trong hành lang đường lớn chạy chéo góc tây nam) | 514,6909 |
| 2 | Đất giao thông (khe không tô — **dải 1,4 m giữa hồ và cây xanh**, xem mục F) | 104,5747 |
| 3 | Đất cây xanh sử dụng công cộng | 4.759,2935 |
| 4 | Đất hồ, ao, đầm | 1.302,7238 |
| 5 | Đất đơn vị ở mới (mật độ trung bình) | 10.023,2057 |
| | **Cộng** | **16.704,4884** |

**QĐ893**

| Mảnh | Loại đất | Diện tích (m²) |
|---|---|---|
| 1 | Đất công cộng, dịch vụ, sản xuất | 4.270,5811 |
| 2 | Đất giao thông (dải cong giữa thửa) | 2.894,9299 |
| 3 | Đất giao thông (góc tây nam) | 514,6950 |
| 4 | Đất khu vui chơi, giải trí công cộng, sinh hoạt cộng đồng | 2.174,3890 |
| 5 | Đất sông, ngòi, kênh, rạch | 1.302,7238 |
| 6 | Đất ở tại đô thị | 5.547,1142 |
| | (mẩu vụn < 0,05 m² do hai ô kề nhau lệch ~1 mm khi làm tròn toạ độ) | 0,0548 |
| | **Cộng** | **16.704,4877** |

**QĐ2101** (phân khu trung tâm 1/2000)

| Mảnh | Loại đất | Diện tích (m²) |
|---|---|---|
| 1 | Đất giao thông (khe không tô trong ranh — dải cong giữa thửa) | 2.894,9570 |
| 2 | Đất giao thông (khe không tô — góc tây nam) | 514,6950 |
| 3 | Đất cây xanh sử dụng công cộng | 4.270,5811 |
| 4 | Đất cây xanh sử dụng công cộng | 2.174,3890 |
| 5 | Đất hồ, ao, đầm | 1.302,7238 |
| 6 | Đất nhóm nhà ở (mật độ trung bình) | 5.547,1425 |
| | **Cộng** | **16.704,4884** |

Nhận xét: QĐ893 và QĐ2101 **trùng ranh với nhau gần như tuyệt đối** (đất ở 5.547,1 · đường 2.894,9 + 514,7 · nước 1.302,7 ·
cây xanh / công cộng 4.270,6 + 2.174,4) — QĐ893 vẽ theo nền phân khu. QĐ205 là bản 1/10.000 nên KHÔNG có con đường 2.894,9 m² chạy
giữa thửa (phần đó QĐ205 ghi cây xanh + đơn vị ở), còn mặt nước 1.302,7 m² thì cả ba bản trùng nhau.

## F. VÌ SAO MẢNH 2 (104,57 m²) BỊ TÍNH LÀ ĐẤT GIAO THÔNG — SUY LUẬN CHI TIẾT

**Mảnh 2 là gì:** dải KHÔNG có vùng tô nào, dài ~75,5 m, rộng trung bình **1,39 m**, chạy theo đường cong giữa vùng tô **hồ**
(lớp `Matnuoc_hoaodam`) và vùng tô **cây xanh** (lớp `QH2030_DAT_DD_CayxanhCCdothi`); cả hai vùng tô chạm sát mép dải (khoảng
cách 0,000 m). Điểm giữa: X = 1.334.829,34 · Y = 599.631,76 (VN-2000), tức 12,068679 / 109,166942.

**Web suy ra "đường" theo chuỗi luật sau (luật áp cho QĐ205):**
1. QĐ205 **không có loại vùng tô "đất giao thông"** — mạng đường thể hiện bằng phần để trắng giữa các vùng tô. Nên phần trong ranh lập
   quy hoạch mà không tô màu được coi là lòng đường.
2. Khu lõi Cam Đức (khung 109,1216–109,1853 Đ, 12,0267–12,0806 B) có thêm **mặt nạ đường** (ảnh điểm 1,8 m dựng từ nét mép đường
   của bản vẽ) để phân biệt khoảng trắng nào là đường; và luật **khoảng trắng sát vùng tô < 2 m = đường** (`SAT_MEP_205`).
3. Mảnh 2: không tô (luật 1) + mặt nạ ghi "đường" ở **400/400 điểm** + sát vùng tô < 2 m (luật 2) ⇒ "Đất giao thông".

**Nhưng soi kỹ thì căn cứ "là đường" rất yếu:**
- **Mặt nạ đường ở chỗ này vô nghĩa:** cắt ngang dải 40 m (bước 0,5 m) thấy mặt nạ ghi "đường" **suốt cả 40 m** — kể cả lòng hồ và
  vùng cây xanh hai bên. Nghĩa là khi dựng mặt nạ, vùng quanh hồ / vòng xoay bị lấp kín (nét bờ hồ bị hiểu như mép đường). Mặt nạ
  "đồng ý" chỉ vì nó đồng ý với mọi điểm ở đây, không phải vì có con đường hình dải.
- **QĐ893 và QĐ2101 cùng chỗ đều KHÔNG có đường:** QĐ893 ghi trọn 104,6 m² là "Đất công cộng, dịch vụ, sản xuất"; QĐ2101 ghi trọn là
  "Đất cây xanh sử dụng công cộng". Hai bản chi tiết hơn (vẽ trên nền địa chính 1/2000) không hề có đường ven hồ ở đây.
- **1,39 m không phải bề rộng một con đường**: làn xe tối thiểu ~3,5 m; trên bản vẽ tỉ lệ 1/10.000, 1,4 m chỉ là **0,14 mm** — mảnh
  hơn cả nét bút vẽ (0,18–0,35 mm). Một con đường ven hồ thật trong quy hoạch chung phải rộng cỡ 13–20 m.
- **Không có nét vẽ nào chạy trong dải** (đã quét 34.070 nét `lines` + 6.696 nét `polylines` của QD205.gpkg: trong vòng 3 m quanh
  giữa dải không có nét nào). Nét gần nhất là một nét **"L-duong dao" (đường dạo)** cách giữa dải **30,7 m** — nét này chạy giữa khu
  cây xanh và khu đơn vị ở, **đúng chỗ QĐ2101 / QĐ893 có con đường 2.894,9 m²** trong thửa. Tức là QĐ205 CÓ thể hiện tuyến đó, nhưng
  chỉ bằng một nét kẻ (vùng tô hai bên vẫn khít nhau), nên web không tính ra đường ở đó cho QĐ205.

- **Dải này là một "đuôi hẹp" của khoảng trắng**: nó nối vào mạng khoảng trắng của đường phố, nhưng suốt chiều dài chỉ rộng ~1,4 m;
  phần lòng đường RỘNG thật (≥ 2,5 m) gần nhất cách giữa dải **60,5 m**. Không có đoạn nào của dải đủ rộng để là một con đường.
  (Trong khung 800 m quanh đó, các "đuôi hẹp" < 2,5 m kiểu này cộng lại ~719 m², so với ~11,9 ha lòng đường thật. Riêng các khe
  hẹp ĐỨNG RIÊNG — không nối mạng đường — trên toàn QĐ205: ~161 chỗ, tổng ~0,87 ha.)

**Kết luận của tôi:** nhiều khả năng mảnh 2 **KHÔNG phải đường quy hoạch** mà là **khe hở do hai vùng tô vẽ không khít nhau** (đường
bao hồ và đường bao khu cây xanh là hai nét cong vẽ riêng, cách nhau ~1,4 m). Mức chắc: cao.

**Nếu anh xác nhận trên MicroStation** (không có nét đường chạy trong dải), đề xuất luật mới cho QĐ205: khe trắng **hẹp dưới ~2,5 m
nằm kẹp giữa hai vùng tô** (không nối vào mạng đường) thì **chia đôi cho hai vùng tô hai bên** thay vì tính là đường. Với thửa 95:
đường 619,24 → 514,68 m²; hồ +~52 m²; cây xanh +~52 m². Phải chạy lại bộ kiểm 79 phiếu + 2.000 thửa trước khi đưa lên (trước đây
từng bỏ một luật na ná vì làm dư 1,3 m² ở mép cong — lần này chỉ áp cho khe kẹp giữa hai vùng tô khác loại).

## D. CẦN ANH XÁC NHẬN TRÊN MICROSTATION

- **Thửa 95 tờ 15 Xã Cam Lâm, QĐ205 — mảnh giao thông số 2** (104,57 m², dải rộng ~1,4 m giữa vùng hồ và vùng cây xanh, ảnh
  `bao-cao-qh/thua-95-to-15-xa-cam-lam-giao-thong-qd205.png`): bản vẽ để hở dải này, web tính là đường theo luật "trong ranh mà
  không tô màu = lòng đường". Nếu trên bản vẽ đây KHÔNG phải đường (chỉ là hai vùng tô không khít nhau) thì cần thêm luật cho các khe
  hẹp như vậy.
