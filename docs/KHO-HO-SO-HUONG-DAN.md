# Kho danh mục hồ sơ — hướng dẫn dùng & cách để máy tự đẩy file lên

Kho lưu trữ file danh mục đã lập. Nằm **trong trang Lập danh mục hồ sơ**, ở **tab thứ hai**:
`https://batdongsancamlam.dpdns.org/lap-danh-muc?tab=kho`
(đường cũ `/kho-ho-so` vẫn vào được — nó tự nhảy sang chỗ mới).

---

## 1. Trên web có gì

Màn hình chia hai phần:

- **Cột trái — thư mục.** Có sẵn **🏛️ Phòng Kinh tế**. Bấm dấu **＋** để tạo thư mục khác
  (Phòng Tài nguyên, Hồ sơ năm 2026…). Bên cạnh mỗi thư mục là số file đang có trong đó.
- **Cột phải — danh sách file.** Mỗi dòng: ô tích chọn · **STT** · tên file · cỡ file · ngày tải lên · **nút ⬇**.

Những việc làm được:

| Muốn làm | Bấm vào đâu |
|---|---|
| Tải **một** file về | Nút **⬇** ở cuối dòng đó (hoặc bấm thẳng vào tên file) |
| Tải **nhiều** file về | Tích chọn các dòng → bấm **⬇ Tải N file về (1 file nén)** |
| Chọn hết cả trang | Ô tích ở **đầu bảng** |
| Tải file lên | Nút **⬆ Tải file lên**, hoặc **kéo file từ máy thả thẳng vào bảng** |
| Tìm file | Ô tìm kiếm — gõ tên (**không dấu cũng ra**) hoặc gõ số thứ tự, ví dụ `490` |
| Xoá | Tích chọn → nút **🗑 Xoá** |

**Thứ tự sắp xếp:** mặc định theo **số bạn đánh ở đầu tên file**. File tên
`0490 nguyễn thị thanh vân thửa 263.xlsx` được hiểu là số **490**. File nào chưa đánh số
thì dồn xuống cuối, hiện dấu `—`. Đổi cách sắp xếp ở ô bên cạnh ô tìm kiếm.

**Tải lại file trùng tên = cập nhật, không nhân đôi.** Đẩy lại `0490 ....xlsx` lần nữa thì nó
đè lên bản cũ. Nhờ vậy chạy lại script bao nhiêu lần cũng không sinh ra file rác.

**Ai vào được:** tài khoản **quản trị (admin)**, **văn bản (vanban)**, hoặc vai trò **Kho danh mục hồ sơ
(danhmuc)** — cấp trong trang quản trị, ô "Vai trò" của từng tài khoản. Trong kho là hồ sơ có tên tuổi
người dân nên cố ý không mở cho mọi tài khoản. Ai không được cấp thì **không thấy tab này**.

**Ai chưa được cấp quyền:** vẫn vào lướt được cho biết kho có những file nào, nhưng:
tên file **chỉ còn số thứ tự**, phần tên người bị che hết bằng chấm; **không mở xem, không tải
về, không xoá, không tải lên** được; ô tìm kiếm chỉ tìm theo **số thứ tự** (cho tìm theo tên thì
họ gõ thử tên người là dò ra ai có hồ sơ, che tên thành vô nghĩa).
Việc che làm **ở máy chủ** — mở phần xem dữ liệu của trình duyệt cũng không đọc được gì thêm.

**Bấm vào tên file = mở xem ngay trên web** (chỉ tài khoản được cấp quyền):
Excel dựng thành bảng (nhiều trang tính thì có nút chọn), PDF xem thẳng trong khung, ảnh hiện ra luôn.
Word/ZIP thì không xem trực tiếp được, phải tải về. Bấm phím **Esc** để đóng.

**Tự xem file mới:** trong giờ làm việc **8h–17h**, danh sách tự tải lại **30 giây một lần** — máy đẩy file
lên là thấy ngay, khỏi bấm F5. Có ô tích ở cuối bảng để tắt nếu thấy phiền.

---

## 2. Cách 1 — để máy tự canh thư mục và đẩy lên (không cần đụng tay)

Dành cho trường hợp: Claude xuất file Excel ra, bạn bấm tải về máy, và muốn nó **tự lên web**.

1. Mở file **`TAI-LEN-KHO.ps1`** ở thư mục gốc dự án bằng Notepad.
2. Sửa đúng **một dòng**: dán chuỗi `KHO_TOKEN` (lấy trong file `.env`) vào chỗ
   `$ChiaKhoa = "DAN_CHUOI_KHO_TOKEN_VAO_DAY"`.
3. Muốn canh thư mục khác thư mục Downloads thì sửa thêm dòng `$ThuMucCanh`.
4. Lưu lại → **nháy phải file → Run with PowerShell**. Cứ để cửa sổ đó chạy.

Từ đó, hễ có file `.xlsx/.pdf/.docx/.zip` rơi vào thư mục đó là nó tự đẩy lên,
đẩy xong **dời file sang thư mục con `Da-tai-len`** để lần sau khỏi đẩy lại.
File đang tải về dở dang thì nó chờ vòng sau mới đẩy, không đẩy file thiếu một nửa.

Muốn nó tự chạy mỗi lần bật máy: làm giống `KHOI-DONG-CUNG-MAY.ps1` đã có sẵn trong dự án.

---

## 3. Cách 2 — Claude (hoặc phần mềm khác) gửi thẳng file lên

Đây là phần **đưa cho bên Claude** để họ ghép nối. Chép nguyên khối dưới đây.

### Thông số API

```
URL      : https://batdongsancamlam.dpdns.org/api/danh-muc/upload
Phương thức: POST
Kiểu gửi : multipart/form-data
Xác thực : header   X-Kho-Token: <CHÌA KHOÁ>
```

| Trường gửi lên | Bắt buộc | Ý nghĩa |
|---|---|---|
| `files` | ✅ | File cần tải lên. **Gửi nhiều file cùng lúc được** (lặp lại trường `files`, tối đa 60 file/lượt). Tên trường khác (`file`, `upload`…) cũng nhận. |
| `thu_muc` | ❌ | Thư mục nhận file. Không gửi thì vào `phong-kinh-te`. Thư mục chưa có sẽ tự được tạo. |

**Loại file nhận:** `.xlsx .xls .csv .pdf .docx .doc .jpg .jpeg .png .webp .zip` — tối đa **30MB/file**.

**Đặt tên file:** nên bắt đầu bằng **số thứ tự**, ví dụ
`0490 nguyễn thị thanh vân thửa 263 tờ 28.xlsx`. Máy chủ đọc số ở đầu tên để sắp xếp.
Tên có dấu tiếng Việt vẫn đúng.

### Trả về khi thành công (HTTP 201)

```json
{
  "ok": true,
  "daTai": 1,
  "files": [{ "id": 12, "ten": "0490 nguyễn thị thanh vân thửa 263.xlsx", "so_tt": 490, "co_bytes": 18324 }],
  "boQua": []
}
```

`boQua` liệt kê file bị từ chối kèm lý do (thường là sai loại file).

### Khi lỗi

| Mã | Nghĩa | Cách xử lý |
|---|---|---|
| `400` | Không có file nào trong yêu cầu | Kiểm tra lại tên trường và kiểu `multipart/form-data` |
| `401` / `403` | Sai hoặc thiếu chìa khoá | Kiểm tra header `X-Kho-Token` |
| `413` | File quá lớn | Nén lại hoặc chia nhỏ |
| `429` | Gửi quá dày | Chờ ít phút (giới hạn 300 lượt / 10 phút) |

### Thử bằng dòng lệnh

```bash
curl -X POST "https://batdongsancamlam.dpdns.org/api/danh-muc/upload" \
  -H "X-Kho-Token: CHIA_KHOA_CUA_BAN" \
  -F "thu_muc=phong-kinh-te" \
  -F "files=@0490 nguyen thi thanh van thua 263.xlsx"
```

Kiểm tra đường truyền đã thông chưa mà không cần gửi file:

```bash
curl "https://batdongsancamlam.dpdns.org/api/danh-muc/upload" -H "X-Kho-Token: CHIA_KHOA_CUA_BAN"
```

Trả về `{"ok":true,"san_sang":true,...}` là thông.

### Ví dụ bằng Python

```python
import requests

URL   = "https://batdongsancamlam.dpdns.org/api/danh-muc/upload"
TOKEN = "CHIA_KHOA_CUA_BAN"

def day_len(duong_dan_file, thu_muc="phong-kinh-te"):
    with open(duong_dan_file, "rb") as f:
        r = requests.post(
            URL,
            headers={"X-Kho-Token": TOKEN},
            data={"thu_muc": thu_muc},
            files={"files": (duong_dan_file.split("\\")[-1], f,
                   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=180)
    r.raise_for_status()
    return r.json()
```

### Nếu công cụ gửi không đặt được header

Cho phép gửi chìa khoá trên URL thay thế:
`.../api/danh-muc/upload?token=CHIA_KHOA_CUA_BAN`.
**Chỉ dùng khi bí** — chìa khoá đặt trên URL sẽ lọt vào nhật ký máy chủ và nhật ký Cloudflare.

---

## 4. Chìa khoá lấy ở đâu, đổi thế nào

Chìa khoá nằm ở dòng `KHO_TOKEN=` trong file **`.env`** ở thư mục gốc dự án.
File `.env` **không lên git** nên chìa khoá không bị lộ qua mã nguồn.

Muốn đổi chìa khoá (khi nghi bị lộ):

1. Sinh chuỗi mới: mở PowerShell gõ
   `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
2. Dán vào `KHO_TOKEN=` trong `.env`.
3. Khởi động lại máy chủ (nút **Bật/Tắt** trên bảng điều khiển, hoặc
   `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend`
   rồi **nhớ `restart nginx`**).
4. Sửa lại chìa khoá ở `TAI-LEN-KHO.ps1` và ở bên Claude.

**Để trống `KHO_TOKEN=` là tắt hẳn đường tự tải lên** — lúc đó chỉ còn tải bằng tay trên web.

---

## 5. Cấu tạo bên trong (cho lần sau sửa)

| Việc | Nằm ở đâu |
|---|---|
| Máy chủ xử lý kho | `apps/backend/src/routes/khoHoSo.ts` |
| Gắn vào máy chủ | `apps/backend/src/index.ts` (2 dòng `app.use`, đặt **trước** router `danh-muc`) |
| Bảng dữ liệu | `apps/backend/src/lib/migrate.ts` — bảng `kho_files` + `kho_thu_muc` |
| Giao diện | `apps/frontend/src/components/KhoDanhMuc.tsx` (tab trong `app/lap-danh-muc/page.tsx`) |
| Đường cũ tự nhảy sang chỗ mới | `apps/frontend/src/app/kho-ho-so/page.tsx` |
| Vai trò `danhmuc` | `migrate.ts` (ràng buộc `users_role_check`) · `routes/khoHoSo.ts` (`VAI_TRO_VAO_KHO`) · `app/admin/page.tsx` (ô chọn vai trò) |
| Ô trong trang Tiện ích | `apps/frontend/src/lib/tienIchTools.ts` |
| Script tự đẩy | `TAI-LEN-KHO.ps1` |

File cất **thẳng trong database** (cột `BYTEA`) đúng như cách web đang làm với ảnh tin đăng —
**sao lưu database là sao lưu luôn cả kho**, không phải nhớ thêm thư mục nào trên ổ đĩa.

Gỡ bỏ tính năng: xoá 2 dòng `app.use` trong `index.ts` + xoá 2 file trên. Bảng dữ liệu để lại
cũng không sao, không ảnh hưởng gì.

**Lưu ý về giới hạn số lần gọi:** đường `/api/danh-muc/upload` được gắn **trước** bộ hạn chế
của `/api/danh-muc` (vốn chỉ cho 20 lần/10 phút cho việc chạy AI). Riêng đường tải file
được nới lên **300 lượt/10 phút** vì đẩy vài chục file một lượt là chuyện bình thường.
