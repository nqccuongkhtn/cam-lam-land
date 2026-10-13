# Bóc bảng đơn giá bồi thường từ Công báo Khánh Hòa

Dữ liệu tiện ích **Giá đền bù** (`/den-bu`) lấy nguyên từ bản Word đăng trên Công báo tỉnh, đối chiếu từng con số với bản PDF
có chữ ký số. Làm lại 13/10/2026 vì bản cũ (`boc-don-gia.py`, đọc theo mẫu "tên – đơn vị – giá" ba dòng liền nhau) **sót 126 dòng**
và gắn nhầm tên nhóm cho gần 160 dòng.

| File web (`apps/frontend/public/`) | Văn bản | Số dòng |
|---|---|---|
| `den-bu-nha-qd08.json` | QĐ 08/2026/QĐ-UBND ngày 22/01/2026 — nhà, công trình, vật kiến trúc | 180 |
| `den-bu-chi-phi-qd12.json` | QĐ 12/2026/QĐ-UBND ngày 24/02/2026 — tự xây dựng, mồ mả, tháo dỡ / di chuyển / lắp đặt, chi phí đầu tư vào đất còn lại | 315 (gồm 5 khoản "Lưu ý" Phụ lục II; bỏ dòng 39.13 cửa nhôm kính vì văn bản ghi sai "899.00") |
| `den-bu-cay-trong-qd35.json` + `den-bu-mat-do-cay-qd35.json` | QĐ 35/2026/QĐ-UBND ngày 04/5/2026 (hiệu lực 14/5/2026) — cây trồng, vật nuôi | 559 + 29 mật độ |

Bản PDF ký số tương ứng nằm ở `apps/frontend/public/tai-lieu/` (QĐ 08, 12, 32, 35/2026).

## Làm lại khi tỉnh ra quyết định mới

1. Tải bản Word: `https://congbao.khanhhoa.gov.vn/Portals/0/FileVanBans/<số>_2026_Q%C4%90_UBND.doc`
   (bản PDF ký số: `https://congbaokhanhhoa.gov.vn/Portals/0/FileVanBans/<số>_2026_Q%C4%90_UBND.signed.pdf`).
2. Đổi `.doc` → `.docx` bằng LibreOffice (chạy trong một container tạm, không mạng).
3. `python -I docx_dump.py <file.docx> <out.txt> <dump.json>` — đọc đúng từng ô của bảng (ô gộp ngang/dọc).
4. QĐ 08 / 12: `python -I doi_chieu.py <dump.json> <file JSON web> <tên QĐ> <ra-chinh-thuc.json> <bao-cao.txt>` rồi
   `python -I de_xuat_json.py <qd12-chinh-thuc.json> <qd08-chinh-thuc.json> <thư mục ra>` → file cùng khuôn với file web.
5. Cây trồng: `python -I boc_cay_trong.py <35_dump.json> <cay-trong.json> <cay-trong-mat-do.json>`.
6. Soát báo cáo đối chiếu (dòng thiếu, nhãn sai, số lạ) **trước** khi chép đè file web. Số nào văn bản ghi lạ thì KHÔNG tự sửa —
   bỏ dòng đó và ghi lại để hỏi Sở Xây dựng (vd mục 39.13 "899.00", mục 79 giá cao ≤ 28 m thấp hơn ≤ 6 m).
