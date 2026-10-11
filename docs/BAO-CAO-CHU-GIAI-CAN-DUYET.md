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

(đang đo, xem bổ sung bên dưới)

## D. CẦN ANH XÁC NHẬN TRÊN MICROSTATION

- **Thửa 95 tờ 15 Xã Cam Lâm, QĐ205 — mảnh giao thông số 2** (104,57 m², dải rộng ~1,4 m giữa vùng hồ và vùng cây xanh, ảnh
  `bao-cao-qh/thua-95-to-15-xa-cam-lam-giao-thong-qd205.png`): bản vẽ để hở dải này, web tính là đường theo luật "trong ranh mà
  không tô màu = lòng đường". Nếu trên bản vẽ đây KHÔNG phải đường (chỉ là hai vùng tô không khít nhau) thì cần thêm luật cho các khe
  hẹp như vậy.
