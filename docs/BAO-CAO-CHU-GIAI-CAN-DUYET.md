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
| QĐ893 | 17 vùng tô **TÍM #a552a5 không ghi mã** (82,5 ha; Level 30) — lớn nhất 15,1 ha tại 12.150501, 109.142579 · 14,7 ha tại 11.986574, 109.080692 · 14,4 ha tại 11.975401, 109.141079 · 13,7 ha tại 12.143836, 109.121173 | **Loại đất khác** (nghe như không biết gì) | **Đất sử dụng cho hoạt động khoáng sản** (SKS) — hoặc nếu anh muốn thận trọng: "Đất khoáng sản hoặc bãi thải, xử lý chất thải (SKS / DRA)" | Khung chú dẫn QĐ893 dùng màu tím này cho đúng 2 mã: SKS (khoáng sản) và DRA (bãi thải, xử lý chất thải). Địa chính bên dưới: chủ yếu DCS (đồi núi chưa sử dụng) + SKC (cơ sở sản xuất) + BHK/RSX, **không thửa nào là DRA** → nghiêng về mỏ (đá, đất) trên đồi | Vừa |

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

## G. DẢI TRẮNG HẸP TRONG 7 BẢN PHÂN KHU (cùng kiểu mảnh 2) — web đang tính là đất giao thông

Bản phân khu 1/2000 để trắng lòng đường, nên web tính "trong ranh mà không tô = đường". Nhưng đường 1/2000 rộng ≥ 4 m; dải trắng
hẹp hơn 2,5 m gần như chắc là **hai vùng tô vẽ không khít** (cùng loại lỗi với mảnh 2 của thửa 95). Quét toàn bộ (phần hẹp < 2,5 m
của khoảng trắng trong ranh; con số hơi cao vì gồm cả mũi nhọn ở góc giao lộ):

| Bản | Khoảng trắng trong ranh | Dải hẹp < 2,5 m | Số mảnh ≥ 20 m² | Mảnh lớn nhất — toạ độ để soi (vĩ độ, kinh độ) |
|---|---|---|---|---|
| QĐ2076 | 838,9 ha | 3.791 m² | 22 | 568 m², rộng ~0,9 m — 12.155237, 109.100729 · 385 m² — 12.150566, 109.102352 · 385 m² — 12.148619, 109.104280 |
| Cù Hin | 137,0 ha | 1.504 m² | 16 | 508 m², rộng ~0,6 m — 12.173542, 109.075795 · 109 m² — 12.186131, 109.095632 |
| Tây Nam | 162,4 ha | 1.569 m² | 17 | 99 m², rộng ~0,5 m — 12.093137, 109.027811 · 89 m² — 12.100996, 109.034282 |
| QĐ918 | 760,4 ha | 1.331 m² | 8 | 201 m², rộng ~1,2 m — 12.037892, 109.125576 · 115 m² — 12.058666, 109.063815 |
| QĐ2101 | 892,9 ha | 608 m² | 8 | 66 m² |
| QĐ2222 | 410,0 ha | 549 m² | 6 | 119 m², rộng ~0,2 m — 12.041171, 109.199349 |
| Tây Bắc | 202,8 ha | 71 m² | 0 | 7 m² |
| **Cộng** | ~3.400 ha | **~9.420 m² (0,94 ha)** | | |

Đề xuất (chờ anh duyệt, CHƯA đổi): dải trắng **rộng dưới 2,5 m kẹp giữa các vùng tô** thì chia cho vùng tô hai bên (mỗi điểm về vùng
tô gần nhất) thay vì tính đường — áp cho cả 7 bản phân khu và QĐ205. Ảnh hưởng: ~0,94 ha toàn bộ, nhưng thửa nằm đè lên dải thì có
thể đổi vài chục tới vài trăm m² "đất giao thông". Trước khi đưa lên phải chạy lại bộ kiểm 79 phiếu + 2.000 thửa.

## H. ĐÃ KIỂM: KHOẢNG TRẮNG RỘNG CỦA QĐ205 ĐÚNG LÀ ĐƯỜNG (không cần sửa)

Mặt ngược lại của mục G: luật "trong ranh mà không tô = đường" có làm sai ở những khoảng trắng **rộng** không? (rộng trên 60 m thì
khó là một lòng đường). Đo trên bản vẽ gốc `QD205.gpkg` (11/10/2026): trong ranh QĐ205 có 2.279 ha khoảng trắng, phần rộng trên 60 m
là 903 ha; ngoài khu lõi Cam Đức (nơi web áp luật này) còn 325,5 ha chia 135 khối. Soi **25 khối lớn nhất (238 ha)**: cả 25 khối đều
được QĐ893 ghi **đất giao thông** (95–100 % diện tích), và phần lớn có nét mép đường `-1-TRAFFIC-PAVEMENT` chạy dọc:

| Khối | Diện tích | Toạ độ (vĩ độ, kinh độ) | QĐ893 ghi | Là gì |
|---|---|---|---|---|
| 1 | 120,0 ha | 12.075227, 109.191913 | giao thông 117,6 ha | dải đại lộ ven biển dài 10,6 km (nét mép đường 12,4 km) |
| 2 | 57,5 ha | 11.998264, 109.119042 | giao thông 57,3 ha | hành lang đường lớn dài 6 km (thửa 312 tờ 6 Cam An Nam: cả QĐ893 lẫn QĐ918 đều ghi đường) |
| 3 | 10,4 ha | 12.166468, 109.057854 | giao thông 10,5 ha | đoạn đường dài 1,7 km, rộng ~120 m |
| 4–25 | 1,5–5,2 ha mỗi khối | (xem file soi) | giao thông | nút giao, quảng trường giao thông |

⇒ Khoảng trắng rộng của QĐ205 là **đường lớn thật** (đại lộ, hành lang cao tốc, nút giao) — luật hiện tại đúng, **không đổi gì**.

**Cũng đã kiểm (nghi vấn "thuật toán đổi toạ độ sai"):** công thức đổi VN-2000 → WGS84 của xưởng dữ liệu (Python, dùng dựng ô
đất từ bản vẽ) và của máy chủ (dùng đổi toạ độ phiếu / toạ độ anh nhập) — cùng bộ 7 tham số Khánh Hòa; so trên 3 điểm thật trải khắp
huyện: lệch nhau **dưới 0,5 mm**. Không phải nguồn sai số.
Bước **cắt vùng có lỗ thành mảnh** (máy chủ chỉ nhận ô không lỗ) cũng đã kiểm: ghép lại các mảnh ô đất web của 7 bản phân khu so với
vùng tô gốc (đã cắt theo ranh) — lệch 0–75 m² trên MỖI BẢN hàng nghìn ha, toàn là vụn dưới 0,6 m² dọc mép do làm tròn toạ độ ~1 mm;
một thửa chịu ảnh hưởng không tới 0,1 m². Không phải nguồn sai số.
**Nghi vấn "gán nhầm tên loại đất" — soát toàn bộ 7 bản phân khu** (mỗi cặp lớp + màu của vùng tô, ~51.300 ha): **99,3–100 % diện tích
lấy đúng chữ trong khung chú giải của chính bản vẽ** (QĐ2076, QĐ2101, QĐ2222, Cù Hin, Tây Bắc: 100 %). Chỉ còn 4 lớp không có dòng chú
giải: 2 lớp đã SUY LUẬN có căn cứ và áp dụng (QĐ918 `L-QH-langxomdothihoa` 35,7 ha → "Đất làng xóm đô thị hóa"; Tây Nam
`HT_DAT_O_Langxom` 183,9 ha → "Đất làng xóm, dân cư nông thôn" — mục A) và 2 lớp còn CHỜ ANH (QĐ918 `DAT_KXD_DulichRung_qh` 32 ha,
Tây Nam `QHDD_DAT_Cayxanhhanche` 26,8 ha — mục B).
**QĐ205 — lớp vùng tô nào bị bỏ qua?** Bản vẽ có 8 lớp vùng tô không nằm trong bảng tên `lop-205.json` (nên không thành ô đất): toàn là
KÝ HIỆU và KHUNG — ký hiệu tôn giáo (56 hình), ký hiệu cấp 3, ký hiệu bến du lịch (6 vòng tròn đường kính 79 m trên mặt nước + 1 hình
mẫu nằm tít ngoài bản đồ), khung A0, khung tỷ lệ 1/10.000, 1 ô bến xe buýt 0,19 ha (web vẫn tính là đất giao thông), và 112 ha hình
"NET-RANH PHAN KHU" ở mũi nam (~11,935°, 109,115°) — chỗ đó không có thửa địa chính nào. ⇒ Không sót loại đất thật nào.

## I. ĐÃ SỬA: VÙNG "TRẮNG TRƠN" TRONG 7 BẢN PHÂN KHU KHÔNG CÒN BỊ GHI LÀ ĐƯỜNG (anh xem ảnh, sai thì báo — gỡ được ngay)

Bản phân khu để trắng lòng đường nên web tính "trong ranh mà không tô = đường". Soi kỹ (11/10/2026 tối) thấy có chỗ bản vẽ để trắng mà
**không phải đường**: không ô đất, **không một nét vẽ nào** (đã gộp cả file nét gốc lẫn file DXF), rộng hơn 60 m. Đường thật thì luôn có
nét mép / tim / chỉ giới chạy trong lòng — đã soi các hành lang QL1A, đường sắt rộng ~100 m của QĐ918 và Tây Bắc: vẫn có nét, nên không bị
đụng tới. Cả 7 bản chỉ có **10 vùng (~20 ha)** như vậy; nay web ghi "Nằm ngoài phạm vi bản quy hoạch này" (giống cách đã làm với vùng
Na Tia ~1.020 ha mà anh đã xác nhận trống trên DGN). **79 phiếu: kết quả giữ nguyên từng con số; thửa 70 tờ 25: giữ nguyên.**

| Bản | Vùng | Toạ độ (vĩ độ, kinh độ) | Bản vẽ ở đó | QĐ893 ghi | Ảnh (`bao-cao-qh/`) |
|---|---|---|---|---|---|
| Tây Nam | 3,34 ha | 12.068994, 109.008319 | dải hở giữa vùng tô rừng và ranh | rừng đặc dụng | `trang-tron-taynam-1.png` |
| Tây Nam | 3,18 ha | 12.056975, 109.062932 | dải hở giữa vùng tô rừng và ranh | rừng sản xuất | `trang-tron-taynam-2.png` |
| Tây Nam | 2,21 ha | 12.054828, 109.070102 | dải hở sát ranh | rừng sản xuất | `trang-tron-taynam-3.png` |
| Tây Nam | 1,37 ha | 11.990363, 109.067142 | khe hình chữ V giữa hai vùng tô rừng | rừng sản xuất | `trang-tron-taynam-4.png` |
| Tây Bắc | 2,98 ha | 12.151849, 109.062596 | dải hở giữa hành lang QL1A và ranh | cây lâu năm, KCN | `trang-tron-taybac-2.png` |
| Tây Bắc | 2,51 ha | 12.147631, 109.064681 | như trên | khu công nghiệp | `trang-tron-taybac-3.png` |
| QĐ2222 | 1,32 ha | 12.084782, 109.190564 | ô chữ nhật trắng giữa 3 vùng tô | văn hoá + đường | `trang-tron-2222-1.png` |
| QĐ2222 | 0,81 ha | 12.120180, 109.207271 | trắng trơn | công cộng | `trang-tron-2222-2.png` |
| QĐ2222 | 0,46 ha | 12.084536, 109.189476 | trắng trơn | văn hoá + đường | `trang-tron-2222-3.png` |
| QĐ2076 | 0,62 ha | 12.141588, 109.092235 | trắng trơn (có thể là đảo giữa nút giao) | đường | `trang-tron-2076-1.png` |

Ví dụ thửa đổi: **thửa 14 tờ 5 Suối Tân** (rừng đặc dụng 22,75 ha) — trước Tây Nam ghi 22.088 m² "đất giao thông", nay không còn dòng
Tây Nam (cả thửa ngoài phạm vi thật sự của bản vẽ). Thửa 339 tờ 18 Sơn Tân: đường 31.692 → 5.282 m² (phần còn lại là khe hẹp < 60 m —
xem mục G). **Hai vùng anh nên xem kỹ:** QĐ2222 1,32 ha (ô chữ nhật trắng — nếu trên bản vẽ đó là quảng trường thuộc đường thì báo tôi
trả lại) và QĐ2076 0,62 ha (QĐ893 ghi đường — có thể là đảo giữa nút giao). Gỡ: xoá vùng đó trong khoá `_lo` của
`apps/backend/data/ranh_qh.json`, hoặc chạy lại `scripts/qh-pipeline/7-lo-trong-ranh.py` sau khi sửa luật.

## J. ẢNH THỬ CẮT LẠI ẢNH BẢN ĐỒ (TILE) 7 BẢN PHÂN KHU — CHỜ ANH DUYỆT (chưa cắt gì)

Phần TÍNH diện tích đã dựng lại từ bản vẽ hôm 11/10 (5g), nhưng ẢNH bản đồ phân khu trên web vẫn cắt từ dữ liệu cũ → có chỗ ảnh
hiện SAI so với bản vẽ (và so với con số web tính). Máy đã so toàn bộ 7 bộ ảnh với "ảnh sẽ cắt lại" (rải điểm 40 m khắp các bản):
**97–99 % trùng nhau**; chỗ sai thật (cụm ≥ 1 ha) chỉ có mấy chỗ dưới đây. Ảnh thử để ở `bao-cao-qh/anh-thu-tile/`
(TRÁI = ảnh đang hiện, PHẢI = ảnh sẽ cắt lại; giữ NGUYÊN bảng màu + hoa văn dấu "+" đã duyệt 14/9 — đã thử: tô lại ra trùng
1.637/1.637 ô cả màu lẫn hoa văn).

**Ảnh đang SAI loại đất (bị vùng khác che):**
| Bản | Chỗ | Toạ độ | Ảnh đang hiện | Đúng theo bản vẽ | Ảnh thử |
|---|---|---|---|---|---|
| QĐ2222 | hồ nước 7,0 ha | 12.046426, 109.198787 | đất du lịch (hồng) | hồ, ao, đầm (xanh) | `thu-2222-ho-nuoc.png` |
| QĐ2101 | nghĩa trang 4,5 ha | 12.054047, 109.145918 | cây xanh chuyên dụng | nghĩa trang (xám) | `thu-2101-nghia-trang.png` |
| Tây Bắc | rừng sản xuất 22,4 ha | 12.146971, 109.037519 | nông nghiệp (xanh lá tươi) | rừng sản xuất (xanh đậm) | `thu-taybac-rung-san-xuat.png` |
| QĐ2076 | di tích 1,3 ha | 12.132337, 109.091957 | cây xanh cách ly | di tích, tôn giáo | `thu-2076-di-tich.png` |

(Lỗi chung: dữ liệu cũ LẤP LỖ của vùng tô — vùng hồ / nghĩa trang / rừng nằm trong "lỗ" của vùng lớn bị vùng lớn tô đè.)

**Ảnh đang VẼ CẢ PHẦN NGOÀI RANH lập quy hoạch** (web tính chỗ này là "nằm ngoài phạm vi", ảnh lại tô màu → người xem dễ tưởng bản đó
quy hoạch cả chỗ này): QĐ2222 ~1.670 ha mặt nước đầm Thủy Triều / biển (`thu-2222-dam-ngoai-ranh.png`), Tây Nam ~310 ha rừng
(`thu-taynam-rung-ngoai-ranh.png`), QĐ2076 ~15 ha mặt nước. Cắt lại sẽ cắt đúng theo ranh như phần tính.

**QĐ893 (quy hoạch sử dụng đất):** ảnh đang THIẾU hẳn khu điện mặt trời ~66 ha ở Cam An (12.007524, 109.090549 — ảnh để trắng, dữ
liệu tính có "Đất công trình năng lượng"; đây là vùng tô hỏng viền đã bổ sung bằng `5f` hôm 11/10) — `thu-893-dien-mat-troi.png`.
Còn lại ~2.250 ha máy báo "lệch tên" ở Suối Tân / Cam Hải Tây là do bảng màu (cùng màu xanh #7fff7f dùng cho nhiều mã): ảnh vẫn đúng
màu bản vẽ. Soi kỹ vùng 1.130 ha: bên trong có mã QUY HOẠCH "NKH" (Level 34) → web ghi "Đất nông nghiệp khác" là đúng bản vẽ; chữ
"RSX" trong vùng là mã HIỆN TRẠNG (Level 33). QĐ205: ảnh bản đồ vẽ trong suốt nên cách so này không dùng được — chưa kiểm.

**Chỗ máy báo lệch nhưng ảnh ĐÚNG (để anh yên tâm):** khối "nhóm nhà ở" màu ô liu ở QĐ2101 là đất ở HIỆN TRẠNG — bản vẽ tô màu khác
đất ở quy hoạch; ảnh cắt lại GIỮ màu này (`thu-2101-giu-mau-hien-trang.png`). Vùng cây xanh cách ly có hoa văn dấu "+" cũng giữ
nguyên (`thu-2076-cay-xanh-cach-ly.png`).

**Nếu anh duyệt:** cắt lại 7 bộ ảnh bằng chuỗi mới (`5i-xuat-vung-to-co-mau.py` → `9-doi-bang-mau.py … autocad-tuoi` →
`3-cat-tile.py` kèm lớp nét), ra THƯ MỤC MỚI (bản cũ giữ nguyên để lùi lại), rồi mới đổi số bản trên web. Ảnh thử bên phải chưa có
lớp nét đường (lúc cắt thật vẫn vẽ nét như cũ).

## K. ĐỀ XUẤT: GHI RÕ "HIỆN TRẠNG" HAY "QUY HOẠCH" (chờ anh quyết — đổi chữ trên bảng thông tin thửa và phiếu)

Khung chú giải các bản phân khu chia 2–3 cột: **Hiện trạng** (đất giữ nguyên) · **Quy hoạch đợt đầu** · **Quy hoạch dài hạn**, mỗi cột
một màu riêng. Web đã tô đúng màu từng cột nhưng TÊN thì gộp: ô hiện trạng và ô quy hoạch mới cùng ghi một tên — vd QĐ2101 có 288 ha
"Đất nhóm nhà ở (mật độ trung bình)" là nhà ở HIỆN TRẠNG (màu ô liu), cùng tên với nhà ở quy hoạch mới (màu vàng). Với người mua bán,
"đất ở có sẵn, giữ lại" khác hẳn "đất quy hoạch thành đất ở". Phần hiện trạng trong từng bản (đo trên dữ liệu web):

| Bản | Hiện trạng | Nhiều nhất |
|---|---|---|
| QĐ2076 | 986 ha (16 %) | khu dân cư hiện hữu 417 ha · nhà ở hiện trạng 184 ha · công nghiệp 152 ha |
| QĐ2101 | 1.208 ha (25 %) | hồ 560 ha · quốc phòng 318 ha · **nhóm nhà ở 288 ha (trùng tên nhà ở quy hoạch)** |
| QĐ2222 | 2.080 ha (66 %) | rừng sản xuất 1.397 ha · dịch vụ du lịch 471 ha · nhóm nhà ở 122 ha |
| QĐ918 | 6.342 ha (69 %) | rừng sản xuất 2.530 ha · rừng phòng hộ 1.891 ha · nông nghiệp 628 ha |
| Cù Hin | 4.477 ha (85 %) | rừng sản xuất 2.563 ha · nông nghiệp 1.452 ha · làng xóm 226 ha |
| Tây Nam | 10.387 ha (97 %) | rừng phòng hộ 7.189 ha · rừng sản xuất 1.451 ha · nông nghiệp 1.084 ha |
| Tây Bắc | 12.190 ha (98 %) | rừng đặc dụng 9.357 ha · rừng sản xuất 1.488 ha · nông nghiệp 863 ha |

Đề xuất: ô thuộc cột Hiện trạng mà tên chưa có chữ "hiện trạng / hiện hữu" thì ghi thêm **"(hiện trạng)"** — vd "Đất nhóm nhà ở (mật độ
trung bình) (hiện trạng)". Dữ liệu đã sẵn (bậc 1 = cột hiện trạng), chỉ đổi chữ hiển thị; diện tích không đổi. QĐ205 cũng có 3 giai
đoạn (HT / 2030 / 2045) mà web đang ghi chung "2045" — làm cùng lúc được. Anh đồng ý thì tôi làm và chạy lại bộ kiểm 79 phiếu
(phiếu chính thức ghi tên thế nào thì giữ đúng như vậy khi so).

## D. CẦN ANH XÁC NHẬN TRÊN MICROSTATION

- **Thửa 95 tờ 15 Xã Cam Lâm, QĐ205 — mảnh giao thông số 2** (104,57 m², dải rộng ~1,4 m giữa vùng hồ và vùng cây xanh, ảnh
  `bao-cao-qh/thua-95-to-15-xa-cam-lam-giao-thong-qd205.png`): bản vẽ để hở dải này, web tính là đường theo luật "trong ranh mà
  không tô màu = lòng đường". Nếu trên bản vẽ đây KHÔNG phải đường (chỉ là hai vùng tô không khít nhau) thì cần thêm luật cho các khe
  hẹp như vậy.
