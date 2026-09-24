# Học từ các phần mềm làm video bản đồ chuyên nghiệp

*Ngoài mapeffect.app (xem `HOC-TU-MAPEFFECT.md`), đây là những công cụ mà dân làm phim và làm bản đồ
trên thế giới đang dùng. Ghi lại cái nào đáng bê về cho trang “Tạo video bản đồ”.*

---

## 1. Google Earth Studio (Google, miễn phí) — chuẩn mực của nghề

Đây là công cụ mạnh nhất trong nghề này. Google nói thẳng: *“Chúng tôi dựng Earth Studio theo đúng
các công cụ dựng phim chuyên nghiệp, để dân motion graphic cầm vào là làm được ngay.”*

| Họ có | Mình |
|---|---|
| **Camera Target** — camera bay đi đâu cũng khoá mắt vào một điểm, có thanh “Influence” pha trộn 0→100% | ✅ **Vừa làm** (nút *🎯 Luôn ngoái nhìn về lô đất*) |
| **Quick Starts** — 5 mẫu chuyển động dựng sẵn: Zoom-To, Orbit, Point-to-Point… | ✅ Mình có **17 kiểu**, còn nhiều hơn |
| **Keyframe + Easing từng mốc** | ✅ Vừa làm (5 kiểu: mượt/đều/tăng tốc/giảm tốc/đứng yên) |
| **“Keyframe all”** — chốt mọi thuộc tính tại một khung | ✅ Nút *＋ Chốt* |
| **Curve Editor** — mỗi thuộc tính (vị trí, zoom, nghiêng, xoay) có **đường cong riêng** | ❌ Chưa. Mình mới chỉnh chung cả mốc |
| **Multi-View** — xem nhiều góc máy cùng lúc | ❌ Chưa |
| **Xuất chuyển động camera 3D** sang After Effects | ❌ Không cần (khách mình không dùng AE) |
| **Overlay & KML** | ✅ Đã có (nhập KML/KMZ/GeoJSON) |

**Đáng làm tiếp:** đường cong riêng cho từng thuộc tính (vd: zoom vào nhanh nhưng xoay thì chậm đều).

---

## 2. GEOlayers 3 (plugin After Effects, ~$130) — dân dựng phim hay dùng

| Họ có | Mình |
|---|---|
| **Animate Route** — chỉnh được **tốc độ · chiều chạy · độ mượt** của tuyến | ⚠️ Mình có tuyến chạy dần nhưng **chưa chỉnh được tốc độ/chiều** |
| **Marker style editor** — sửa kiểu ghim | ✅ Vừa làm (8 kiểu × 12 biểu tượng × 6 màu) |
| **Label template editor** — mẫu nhãn | ✅ Thẻ chú thích 8 kiểu |
| **Style bản đồ** — đổi màu, độ dày nét, phông chữ, **đổ bóng đồi núi (hillshading)** | ⚠️ Vừa làm phần **màu**; chưa có bóng đồi núi |
| **Nhập GPS / CSV / GPX** rồi tự sinh ghim + đường + hoạt ảnh | ⚠️ Mình nhập được KML/GeoJSON, **chưa nhận GPX/CSV** |
| Tìm quốc gia/thành phố/toà nhà rồi vẽ ranh giới | ✅ Vừa làm (*🗺 Khoanh vùng*) |

**Đáng làm tiếp:** chỉnh tốc độ + chiều chạy của tuyến; nhận file CSV danh sách tiện ích (tên, toạ độ)
→ tự cắm hàng loạt ghim.

---

## 3. Kepler.gl (Uber) & ArcGIS Pro — bên dữ liệu

- **Kepler.gl:** thanh thời gian lọc dữ liệu — chỉ hiện những điểm trong khoảng thời gian đang chạy.
  Áp dụng được: *“các lô đã bán theo từng tháng”* hiện dần trên bản đồ.
- **ArcGIS Pro Animation:** bay dọc tuyến (flythrough) + xuất video. Mình đã có (kịch bản Dẫn đường).

---

## 4. Việc vừa làm sau nghiên cứu

### 🎨 Màu bản đồ (đúng thứ bạn nhận ra: MapEffect nhìn tươi hơn)

Ảnh vệ tinh tải về vốn hơi nhạt và xám. Các app đều **chỉnh màu đè lên ảnh** chứ không dùng ảnh thô.
Giờ mình có 7 tông, bấm ngay trên thanh phía trên bản đồ:

**🌿 Tươi** (mặc định — cây xanh mướt, biển trong) · **Ảnh gốc** · **🔥 Rực rỡ** (nổi trên điện thoại) ·
**🎬 Điện ảnh** (tương phản cao, sang) · **☀️ Nắng ấm** · **🌊 Biển xanh** · **💡 Sáng nhẹ**

Muốn tự chỉnh: ô công cụ **🎨 Màu bản đồ** có 4 thanh trượt — *Độ rực · Tương phản · Nâng vùng tối · Ngả màu*.
Mỗi kịch bản nhớ tông riêng.

### 🎯 Camera luôn ngoái nhìn về lô đất

Học thẳng từ Camera Target của Google Earth Studio. Bật trong bảng **✏️ Chữ & lời**.
Camera bay đi đâu cũng tự xoay mặt về lô — cảnh lướt qua khu vực mà vẫn khoe được lô đất.

---

## 5. Danh sách nên làm tiếp (xếp theo đáng làm)

1. **Chỉnh tốc độ & chiều chạy của tuyến đường** (GEOlayers có, mình chưa) — dễ làm, thấy ngay.
2. **Nhập CSV danh sách tiện ích** → tự cắm hàng loạt ghim. Môi giới có sẵn file Excel là dùng được ngay.
3. **Đường cong riêng cho từng thuộc tính camera** (Earth Studio) — cho người làm kỹ.
4. **Đổ bóng đồi núi** — Cam Lâm nhiều đồi, bật lên nhìn có chiều sâu hẳn.
5. **Hiện dần theo thời gian** (Kepler.gl) — “các lô đã bán tháng 1, 2, 3…”.
6. **Đối tượng chuyển động chạy theo tuyến** (xe/máy bay) — MapEffect có.
