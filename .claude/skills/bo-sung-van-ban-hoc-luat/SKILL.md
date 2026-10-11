---
name: bo-sung-van-ban-hoc-luat
description: Dùng khi chủ dự án gửi một tệp văn bản (PDF, ảnh chụp, tệp Word) và nói "bổ sung văn bản này vào học luật", "lưu trữ file này để học", "lưu trữ để học", "thêm văn bản vào tra cứu luật", "cho vào học luật", "nạp vào kho luật", "đưa công văn này vào học", hoặc gửi luật / nghị quyết / nghị định / thông tư / quyết định / công văn về đất đai để đưa vào công cụ "Học và tra cứu Luật Đất đai" (trang /tra-cuu-luat). Quy trình bắt buộc: CẤT BẢN NÉN TRƯỚC (chủ dự án sẽ xoá bản gốc) → đọc → xếp đúng chỗ (kho văn bản có Điều, hay văn bản tham khảo) → nối với điều luật → dựng lại bộ tổng hợp → kiểm → commit → báo lại bằng tiếng Việt đời thường.
---

# Bổ sung văn bản vào "Học và tra cứu Luật Đất đai"

Chủ dự án chỉ đọc tiếng Việt, không quen thuật ngữ lập trình → mọi câu trả lời, ghi chú, chữ trên web: **tiếng Việt đời thường**.

## 0. Năm nguyên tắc — không được bỏ

1. **CẤT TRƯỚC, LÀM SAU.** Chủ dự án gửi xong là xoá bản gốc. Việc ĐẦU TIÊN luôn là bước 1 (lưu trữ). Chưa cất xong thì chưa làm gì khác.
2. **NGUYÊN VĂN LÀ NGUYÊN VĂN.** Chữ của văn bản lấy từ bản gốc, không viết lại, không "sửa cho gọn" (giữ cả lỗi đánh máy của bản gốc, vd "khi có có văn bản"). Lời giải thích, tóm tắt để ở trường riêng (`giaiThich`, `luuY`), trên web hiện ở khung riêng ghi "KHÔNG PHẢI VĂN BẢN LUẬT".
3. **DỮ LIỆU CÁ NHÂN KHÔNG LÊN GIT, KHÔNG LÊN WEB.** Đọc chữ trước khi commit. Có họ tên kèm số CMND/CCCD, ngày sinh, địa chỉ của người dân, hay tiền bồi thường của người có tên → cất bằng `--rieng` (vào `scripts/luat/van-ban-goc/_rieng/`, đã chặn trong `.gitignore`), không chép ra web, báo chủ dự án.
4. **NGHI THÌ GHI, KHÔNG TỰ SỬA.** Số hiệu, ngày, tên cơ quan lệch nhau (tên tệp ≠ chữ trong văn bản, chữ ≠ nguồn nhà nước) → giữ đúng chữ trong văn bản, ghi chỗ lệch vào báo cáo / trường `canKiemTra`. Được dùng WebSearch/WebFetch để ĐỌC nguồn chính thống (vbpl.vn, congbao.chinhphu.vn, vanban.chinhphu.vn, thuvienphapluat.vn) đối chiếu số/ngày — không tự tải văn bản khác về nạp.
5. **CÔNG VĂN TỈNH KHÁC CHỈ LÀ THAM KHẢO.** Phải ghi rõ trên web: tỉnh nào, không phải văn bản quy phạm pháp luật, không bắt buộc ở Khánh Hòa. Công văn báo một điều luật đã đổi hiệu lực mà văn bản làm thay đổi chưa có trong kho → chỉ gắn cờ "cần kiểm" (`canh: true`), KHÔNG tự đánh dấu điều đó hết hiệu lực.

## 1. Lưu trữ (nén + kiểm) — làm NGAY

Tệp gốc thường nằm ở `scripts/luat/van-ban-goc/_moi-nhan/` (thư mục thả tệp, không lên git) hoặc chủ dự án đưa đường dẫn.

Đặt **mã** (chữ thường không dấu, gạch ngang) — mã dùng làm tên tệp và làm khoá trên web:

| Loại | Mẫu mã | Ví dụ |
|---|---|---|
| Luật | `l<số>-<năm>` (Luật Đất đai: `ldd<năm>`) | `l43-2024` |
| Nghị quyết của Quốc hội | `nq<số>-<năm>` (**bắt buộc đầu `nq`** — trang dựa vào đó để không lẫn với luật, vì cùng đuôi /QH) | `nq254-2025` |
| Nghị định | `nd<số>-<năm>` | `nd49-2026` |
| Thông tư | `tt<số>-<năm>` | `tt84-2025` |
| Văn bản của Khánh Hòa | `kh-<loại>-<số>-<năm>` | `kh-qd-30-2025` |
| Công văn, văn bản tham khảo | `cv-<số>-<ký hiệu>-<năm>-<tỉnh>` | `cv-1857-snnmt-qldd-2026-quang-ngai` |

Chạy (máy chủ Docker phải đang chạy — các công cụ PDF nằm trong container `camlam_backend`):

```bash
python scripts/luat/them-van-ban.py luu-tru "<đường dẫn tệp>" --ma <mã> --cong-khai
#   --cong-khai : chép thêm bản ra apps/frontend/public/luat/tham-khao/ để web mở xem (dùng cho văn bản tham khảo)
#   --rieng     : tệp có dữ liệu cá nhân (xem nguyên tắc 3)
```

Script tự làm, tự in kết quả, tự ghi vào `scripts/luat/van-ban-goc/chi-muc.json`:
- **PDF có lớp chữ thật** (bản điện tử, bản Word, bản ký số): thử nén kiểu `nenPdf()` của `apps/backend/src/routes/vanBan.ts` (Ghostscript: phông cắt gọn, ảnh màu/xám 100 dpi, ảnh đen trắng 200 dpi; rồi `qpdf --object-streams=generate --recompress-flate --compression-level=9`), và thử riêng `qpdf`. **Chỉ nhận bản nén khi chữ bóc ra Y HỆT bản gốc và đủ số trang.**
- **Bản quét** (chỉ là ảnh, lớp chữ rỗng hoặc rác): đọc lại chữ tiếng Việt bằng `ocrmypdf --redo-ocr -l vie` trên bản gốc nét nhất, rồi thử nén kiểu `nenPdf()` và kiểu `scripts/pdf/nen-pdf-tai-lieu.py` (ảnh xám 150 dpi, trang có màu thật như dấu đỏ giữ màu). Nhận bản nào máy đọc lại vẫn ra ≥ 92% số chữ. Chữ máy đọc từ bản gốc 300 dpi được cất kèm: `<mã>.ocr.txt`.
- Chọn bản **nhỏ nhất** trong các bản đạt, phải bớt được **từ 10% trở lên**; không thì **giữ nguyên bản gốc**.
- Tệp đã cất rồi (trùng mã băm sha256) thì script báo và dừng.

⚠️ Bẫy đã gặp (11/10/2026):
- **Ghostscript làm HỎNG lớp chữ của PDF xuất từ Word** (phông TrueType không nhúng): nhìn thì đúng mà chữ bóc ra sai dấu ("TỈNH" thành "TàNH"). Vì vậy bước kiểm "chữ y hệt" là bắt buộc — CV 1857/SNNMT-QLĐĐ phải giữ nguyên bản gốc vì lý do này.
- **Nén là mất chữ ký số.** Script ghi lại ai ký, lúc nào (giờ Việt Nam) vào `chuKySoBanGoc` trong chỉ mục.
- Máy quét Canon tự gắn lớp chữ "đọc" kiểu rác (`Hat Ki6m 16m`) — script nhận ra (gần như không có chữ mang dấu) và coi là bản quét.
- Ảnh chụp (jpg/png) và tệp Word được đổi sang PDF trước (img2pdf / LibreOffice trong container).

Sau khi cất: kiểm bản lưu mở được, đủ trang, bóc được chữ (script đã tự kiểm; xem dòng "ĐÃ THỬ" / "CHỌN"). Báo chủ dự án là bản gốc trong `_moi-nhan` **có thể xoá**.

## 2. Đọc và phân loại

```bash
python scripts/luat/them-van-ban.py boc-chu --ma <mã>      # in chữ của bản đã cất
```

Đọc toàn bộ. Quyết định văn bản thuộc loại nào:
- **Văn bản có ĐIỀU** (luật, nghị quyết của Quốc hội, nghị định, thông tư, quyết định ban hành quy định của UBND tỉnh…) → vào **KHO** (bước 3B). Đây là văn bản để học từng điều, có liên kết, thẻ học, lộ trình.
- **Văn bản hành chính không chia điều** (công văn hướng dẫn, trả lời, giải đáp vướng mắc, thông báo…) → **VĂN BẢN THAM KHẢO** (bước 3A).

Kiểm dữ liệu cá nhân (nguyên tắc 3) ngay lúc đọc.

## 3A. Văn bản tham khảo (công văn…)

1. Soạn nháp: `python scripts/luat/them-van-ban.py nhap-cong-van --ma <mã> --tinh "<tỉnh>"`
   → `apps/frontend/public/luat/tham-khao/<mã>.json` (có trường `"nhap": true`).
2. **Soát tay từng đoạn với bản gốc** (bản quét thì xem ẢNH: cắt ảnh trang ra xem bằng mắt). Sửa:
   - `doan`: mỗi đoạn một chuỗi, nguyên văn. Số chú thích cuối trang viết bằng số mũ `¹ ²` ngay chỗ đánh dấu; chữ chú thích để ở `chuThich: [{so, chu}]` (máy hay bóc chú thích lẫn vào giữa đoạn — phải tách ra).
   - `ten` = trích yếu đúng như in (kể cả chữ "V/v" hay "Về việc" đứng đầu). `kinhGui`, `noiNhan`, `chucVuKy`, `nguoiKy`.
   - `coQuanNgan` (vd "Sở Nông nghiệp và Môi trường tỉnh Quảng Ngãi"), `tinh`, `phamVi` (`tinh-khac` / `khanh-hoa` / `trung-uong`), `nhom`: `huong-dan` (mặc định) hoặc `dia-phuong`.
   - `canhBao`: một câu nói rõ văn bản của ai, gửi ai, chỉ để tham khảo, không bắt buộc ở Khánh Hòa.
   - Bản quét: `nguonChu: "may-doc-anh-quet"`, `ghiChuChu` (chỗ in nghiêng, chữ viết tay…), và `suaMayDoc: [{may, dung, ghi}]` = MỌI chỗ đã sửa chữ máy đọc theo ảnh.
   - `danChieu`: mỗi điều được trích, `chu` = đúng cụm chữ trong văn bản (web biến đúng cụm này thành nút bấm). Có trong kho → `ma`, `so` (số điều), `khoan`. Chưa có trong kho → `soHieu`, `ngoaiKho: true`. Văn bản báo điều đó đã đổi hiệu lực → `canh: true` + `luuY` (lời người làm web, nói rõ "theo công văn này…", "văn bản … chưa có trong kho nên chưa kiểm được").
   - `vanBanNhacToi`: mọi số hiệu được nhắc (kèm `ten` nếu biết; tên tra trên mạng thì thêm `canKiemTra`).
   - `lienQuan`: điều trong kho NÊN ĐỌC KÈM dù văn bản không trích (ghi `lyDo`) — chỉ 1–3 điều thật sát.
   - `chuDe`: tên chủ đề ĐÚNG như mảng `CHU_DE` trong `apps/frontend/src/app/tra-cuu-luat/page.tsx`. Cần chủ đề mới thì thêm một dòng vào `CHU_DE` (`tim` = cụm chữ đúng như luật viết).
   - `chang`: số chặng lộ trình (đếm từ 0): 0 Nền · 1 Cấp Giấy chứng nhận · 2 Đăng ký biến động · 3 Thu hồi · 4 Bồi thường · 5 Chuyển mục đích, tách hợp thửa · 6 Giao dịch · 7 Tài chính, giá đất · 8 Tranh chấp, xử phạt · 9 Quy hoạch, kỹ thuật, thẩm quyền · 10 Hiệu lực, chuyển tiếp.
   - `giaiThich: {tom, y[], luuY}`: tóm tắt dễ hiểu — lời của người làm web.
   - Xong thì **xoá `nhap` và `ghiChuNhap`**.
3. Kiểm: `python scripts/luat/them-van-ban.py kiem --ma <mã>`
   - Bản có lớp chữ: MỌI đoạn phải có trong chữ bóc từ bản gốc (báo "KHÔNG KHỚP NGUYÊN VĂN" là phải sửa).
   - Bản quét: liệt kê chỗ khác chữ máy đọc; chỗ nào có dấu `?` là chưa ghi lý do → xem lại ảnh, rồi thêm vào `suaMayDoc` hoặc sửa đoạn chữ.
   - Phải ra `OK`.
4. Mẫu đã làm: `tham-khao/cv-1857-snnmt-qldd-2026-quang-ngai.json` (bản điện tử, có chú thích) và `tham-khao/cv-82-hkl-qlbvr-2026-lao-cai.json` (bản quét).

## 3B. Văn bản có Điều → vào kho

1. Lấy chữ: bản có lớp chữ thì `pdftotext` trong container ra tệp `<mã>_p1.txt` (văn bản dài Công báo cắt nhiều số → `_p1`, `_p2`… — xem đầu `scripts/luat/dung-kho-luat.py`). Bản quét → không đưa vào kho được bằng máy (OCR luật dễ sai chữ) → cất + báo chủ dự án, hoặc tìm bản PDF ký số trên Công báo.
2. Chạy thử trên BẢN SAO kho trước:
   ```bash
   cp -r apps/frontend/public/luat <thư mục tạm>/kho
   python scripts/luat/them-van-ban.py vao-kho <tệp_p1.txt> [tệp_p2.txt…] --ma <mã> --so-hieu "<số hiệu>" --thu-muc <thư mục tạm>/kho
   ```
   Dòng `OK …` = tách đủ điều, có ngày, điều cuối là điều thi hành. Dòng `[!]` = bộ tách báo lỗi → không làm tiếp. Tên luật in toàn chữ hoa thì thêm `--ten "…"`; văn bản đã hết hiệu lực thì `--het-hieu-luc "…"`.
3. Làm thật (bỏ `--thu-muc`), rồi chạy **đúng thứ tự** (thư mục `apps/frontend/public/luat`; `<thư mục chữ>` chứa `<mã>_p1.txt` để đọc phần "Căn cứ"):
   ```bash
   python scripts/luat/dung-luoc-do.py apps/frontend/public/luat <thư mục chữ>
   python scripts/luat/dung-lien-ket.py apps/frontend/public/luat
   python scripts/luat/dung-tinh-trang-dieu.py apps/frontend/public/luat
   python scripts/luat/dung-sua-doi-dieu.py apps/frontend/public/luat
   python scripts/luat/va-luoc-do-doi-cu.py apps/frontend/public/luat
   python scripts/luat/dung-tu-dien.py apps/frontend/public/luat
   python scripts/luat/dung-chuoi-doc.py apps/frontend/public/luat
   python scripts/luat/dung-lo-trinh.py apps/frontend/public/luat
   python scripts/luat/dung-the-tu-dong.py apps/frontend/public/luat
   python scripts/luat/soat-lien-ket.py apps/frontend/public/luat
   ```
   Trước khi chạy `dung-lo-trinh.py`: thêm mã mới vào bảng `VAN_BAN` (chặng lõi) trong script đó.
4. `git diff --stat apps/frontend/public/luat` — văn bản mới làm đổi tình trạng điều nào của văn bản cũ thì đó là điều mong đợi (vd nạp Nghị định 49/2026 thì khoản 3 Điều 8 Nghị định 151/2025 tự hiện "hết hiệu lực"); thay đổi lạ → dừng, xem lại.
5. Văn bản tham khảo nào đang ghi văn bản này là `ngoaiKho` → đổi sang `ma`/`so`; cờ `canh` nào nay kho đã tự đánh dấu được → bỏ cờ và sửa `luuY`.

⚠️ **TUYỆT ĐỐI KHÔNG chạy `dung-kho-luat.py` cho cả kho**: nó dựng `_kho.json` từ thư mục tệp chữ, mà tệp chữ của 22 văn bản cũ không còn trên máy. (Đã gắn khoá: thiếu văn bản là nó dừng, trừ khi gõ `--cho-bot`.)
Đã chạy thử trọn chuỗi 11/10/2026 (bỏ Nghị định 104/2024 khỏi bản sao rồi nạp lại): mọi văn bản khác giống hệt, 986 thẻ học giống hệt.

## 4. Dựng lại bộ tổng hợp

```bash
python scripts/luat/dung-bo-tong-hop.py
```
Ghi `apps/frontend/public/luat/bo-tong-hop.json` (trang web đọc: thẻ 📚 Danh mục → "Bộ để học") và `docs/HOC-LUAT-BO-TONG-HOP.md` (tài liệu, **sinh tự động — không sửa tay**). Văn bản tham khảo còn `"nhap": true` sẽ bị bỏ qua (script báo).

## 5. Kiểm tra cuối

- Mọi JSON đã viết đọc được: `python -m json.tool <tệp> > /dev/null`.
- `python scripts/luat/them-van-ban.py kiem` ra `OK` hết.
- Có sửa `page.tsx` thì `pnpm --filter @camlam/frontend typecheck` không thêm lỗi (rồi `git checkout -- apps/frontend/tsconfig.tsbuildinfo`). Giao diện phải xem ở khổ điện thoại (~375px).
- Web chỉ thấy văn bản mới sau khi **dựng lại frontend**: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --build frontend` rồi `restart nginx` (kèm `-f docker-compose.tunnel.yml` nếu chạy thật qua tunnel). Ổ C hay đầy — báo chủ dự án / phiên chính làm, đừng tự dựng liên tục.

## 6. Commit và báo lại

- Commit tiếng Việt không dấu, nói rõ đã làm gì, vì sao (xem lịch sử git). Không push.
- KHÔNG commit `_moi-nhan/`, `_rieng/`.
- Báo chủ dự án (tiếng Việt đời thường): văn bản đã xếp vào đâu, vì sao; bản lưu nặng bao nhiêu trước/sau, nén cách nào (hay giữ nguyên vì sao); nó nối với điều luật nào; điều nào "cần kiểm"; văn bản được nhắc tới mà kho chưa có (nên bổ sung); chỗ nào nghi ngờ; bản gốc trong `_moi-nhan` đã có thể xoá.

## Chỗ để của mọi thứ

| Cái gì | Ở đâu |
|---|---|
| Bản lưu trữ + chỉ mục | `scripts/luat/van-ban-goc/<mã>.pdf`, `chi-muc.json` (`_rieng/` cho tệp có dữ liệu cá nhân) |
| Công cụ làm hộ phần máy móc | `scripts/luat/them-van-ban.py` (`luu-tru`, `boc-chu`, `nhap-cong-van`, `kiem`, `vao-kho`) |
| Văn bản tham khảo | `apps/frontend/public/luat/tham-khao/<mã>.json` (+ `<mã>.pdf` để web mở xem) |
| Kho văn bản có Điều | `apps/frontend/public/luat/_kho.json` + `<mã>.json` |
| Bộ tổng hợp | `scripts/luat/dung-bo-tong-hop.py` → `public/luat/bo-tong-hop.json` + `docs/HOC-LUAT-BO-TONG-HOP.md` |
| Chủ đề nhanh (một nơi khai) | mảng `CHU_DE` trong `apps/frontend/src/app/tra-cuu-luat/page.tsx` |
| Chặng lộ trình | `scripts/luat/dung-lo-trinh.py` (`CHANG`, `VAN_BAN`, `NGOAI_LE`) |
| Nén PDF gốc của web (tham chiếu) | `nenPdf()` trong `apps/backend/src/routes/vanBan.ts`; `scripts/pdf/nen-pdf-tai-lieu.py` |
