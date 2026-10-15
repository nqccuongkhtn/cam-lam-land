# Tạo MẪU VĂN BẢN đề nghị cung cấp BẢN ĐỒ QUY HOẠCH SỬ DỤNG ĐẤT 2030 dạng số (file Word) + trang hướng dẫn — 15/10/2026 tối.
# Dùng khi Sở NN&MT tỉnh lân cận KHÔNG đăng bản đồ công khai (Lâm Đồng: chỉ Đà Lạt, Đức Trọng có bản đồ; Đắk Lắk, Phú Yên cũ, Bình Thuận cũ,
# Ninh Thuận cũ: chỉ có quyết định).
import os, sys
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
sys.stdout.reconfigure(encoding='utf-8')
RA = r'D:\KhoQH\xin-du-lieu\Mau-van-ban-xin-ban-do-quy-hoach-su-dung-dat.docx'

d = Document()
for s in d.sections:
    s.top_margin, s.bottom_margin, s.left_margin, s.right_margin = Cm(2), Cm(2), Cm(3), Cm(2)
st = d.styles['Normal']; st.font.name = 'Times New Roman'; st.font.size = Pt(13)
st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')

def doan(chu='', dam=False, nghieng=False, giua=False, co=None, truoc=0, sau=4, thut=None):
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if giua else WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_before = Pt(truoc); p.paragraph_format.space_after = Pt(sau)
    if thut is not None: p.paragraph_format.first_line_indent = Cm(thut)
    if chu:
        r = p.add_run(chu); r.bold = dam; r.italic = nghieng
        if co: r.font.size = Pt(co)
    return p

# ── TRANG 1: VĂN BẢN ĐỀ NGHỊ ──
doan('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', dam=True, giua=True, sau=0)
doan('Độc lập - Tự do - Hạnh phúc', dam=True, giua=True, sau=0)
doan('───────────', giua=True, sau=6)
doan('……………, ngày …… tháng …… năm 2026', nghieng=True, sau=10).alignment = WD_ALIGN_PARAGRAPH.RIGHT
doan('VĂN BẢN ĐỀ NGHỊ', dam=True, giua=True, co=14, sau=0)
doan('Cung cấp thông tin, dữ liệu quy hoạch sử dụng đất đến năm 2030 (bản đồ dạng số)', dam=True, giua=True, sau=10)
doan('Kính gửi: Sở Nông nghiệp và Môi trường tỉnh ……………………………… (hoặc Văn phòng Đăng ký đất đai tỉnh ………………………).', sau=8, thut=1.0)
doan('Căn cứ Luật Đất đai số 31/2024/QH15 (các quy định về công bố công khai quy hoạch, kế hoạch sử dụng đất và về cung cấp thông tin, '
     'dữ liệu đất đai);', thut=1.0, sau=2)
doan('Căn cứ Nghị định số 101/2024/NĐ-CP ngày 29/7/2024 của Chính phủ quy định về điều tra cơ bản đất đai; đăng ký, cấp Giấy chứng nhận '
     'quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất và Hệ thống thông tin đất đai;', thut=1.0, sau=8)
doan('1. Thông tin người đề nghị', dam=True, sau=2)
for dong in ('Tên tổ chức / cá nhân: …………………………………………………………………………',
             'Địa chỉ: ……………………………………………………………………………………………',
             'Mã số thuế / Số định danh cá nhân: ………………………………………………………',
             'Người đại diện: ……………………………………… Chức vụ: ……………………………',
             'Điện thoại: …………………………… Thư điện tử: ……………………………………'):
    doan(dong, thut=1.0, sau=2).alignment = WD_ALIGN_PARAGRAPH.LEFT
doan('2. Nội dung đề nghị cung cấp', dam=True, truoc=6, sau=2)
doan('a) Bản đồ quy hoạch sử dụng đất đến năm 2030 (và bản đồ điều chỉnh, nếu có) dạng số — tệp gốc *.dgn hoặc *.shp / *.gdb, hoặc tối '
     'thiểu tệp *.pdf in từ bản số (giữ nguyên nét vector, có lưới tọa độ) — hệ tọa độ VN-2000 của tỉnh, của các đơn vị hành chính sau:', thut=1.0, sau=4)
bang = d.add_table(rows=5, cols=4); bang.style = 'Table Grid'; bang.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, t in enumerate(('STT', 'Huyện / thị xã / thành phố (trước 01/7/2025)', 'Quyết định phê duyệt (số, ngày)', 'Ghi chú')):
    c = bang.rows[0].cells[i]; c.text = ''; r = c.paragraphs[0].add_run(t); r.bold = True; c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
for k in range(1, 5): bang.rows[k].cells[0].text = str(k)
doan('', sau=2)
doan('b) Quyết định phê duyệt quy hoạch sử dụng đất và các quyết định điều chỉnh (bản chụp có chữ ký số).', thut=1.0, sau=2)
doan('c) Bảng chú dẫn / danh mục ký hiệu loại đất dùng trên bản đồ (nếu có tệp riêng).', thut=1.0, sau=6)
doan('3. Mục đích sử dụng', dam=True, sau=2)
doan('Hiển thị và tra cứu thông tin quy hoạch sử dụng đất mang tính tham khảo trên nền tảng bản đồ của đơn vị, ghi rõ nguồn và quyết định '
     'phê duyệt; không sử dụng vào mục đích khác; không cung cấp lại dữ liệu gốc cho tổ chức, cá nhân khác.', thut=1.0, sau=6)
doan('4. Hình thức nhận kết quả', dam=True, sau=2)
doan('Tệp dữ liệu qua thư điện tử / đường dẫn tải / thiết bị lưu trữ (USB, đĩa) — nhận trực tiếp tại cơ quan hoặc qua đường bưu chính.', thut=1.0, sau=6)
doan('5. Cam kết', dam=True, sau=2)
doan('Sử dụng thông tin, dữ liệu đúng mục đích đã nêu; nộp phí, chi phí theo quy định (nếu có); ghi rõ nguồn khi hiển thị; chịu trách nhiệm '
     'trước pháp luật về việc sử dụng thông tin, dữ liệu được cung cấp.', thut=1.0, sau=6)
doan('Hồ sơ kèm theo: Phiếu yêu cầu cung cấp thông tin, dữ liệu đất đai (Mẫu số 13/ĐK ban hành kèm theo Nghị định số 101/2024/NĐ-CP).',
     nghieng=True, thut=1.0, sau=14)
ky = d.add_table(rows=1, cols=2); ky.alignment = WD_TABLE_ALIGNMENT.CENTER
o = ky.rows[0].cells[1]; o.text = ''
for chu, dam, ngh in (('NGƯỜI ĐỀ NGHỊ', True, False), ('(Ký, ghi rõ họ tên; đóng dấu nếu là tổ chức)', False, True)):
    p = o.add_paragraph() if o.paragraphs[0].text else o.paragraphs[0]
    r = p.add_run(chu); r.bold = dam; r.italic = ngh; p.alignment = WD_ALIGN_PARAGRAPH.CENTER

# ── TRANG 2: HƯỚNG DẪN (không gửi kèm) ──
d.add_page_break()
doan('HƯỚNG DẪN SỬ DỤNG MẪU (không gửi kèm văn bản)', dam=True, giua=True, co=14, sau=10)
for chu in (
    '1. Mỗi tỉnh gửi một văn bản tới Sở Nông nghiệp và Môi trường (cơ quan tổ chức lập, công bố quy hoạch sử dụng đất cấp huyện) — điền bảng '
    'ở mục 2 các huyện cần xin. Số, ngày quyết định đã biết (ghi rõ cái nào đã đọc trên bản quét, cái nào chưa):',
    '   • Lâm Đồng — đã có bản đồ công khai: TP Đà Lạt (QĐ 2199/QĐ-UBND ngày 09/11/2023), huyện Đức Trọng (QĐ 1868/QĐ-UBND ngày 29/9/2023) — '
    'hai số này ĐÃ đọc trên bản quét có chữ ký số. '
    'Chỉ có quyết định, CHƯA có bản đồ: Lạc Dương (QĐ 1869/QĐ-UBND ngày 29/9/2023), Đơn Dương (QĐ 1375/QĐ-UBND ngày 17/7/2023) — hai huyện '
    'giáp Khánh Hòa, nên xin trước (số / ngày lấy từ tên tệp quyết định trên cổng Sở, cần đối chiếu bản quét).',
    '   • Đắk Lắk (gồm Phú Yên cũ): cổng Sở có thư mục quyết định QHSDĐ 2030 các huyện nhưng không có trang liệt kê bản đồ; các huyện giáp '
    'Khánh Hòa: M\'Đrắk, Krông Bông (Đắk Lắk cũ), Sông Hinh, Đông Hòa, Sơn Hòa (Phú Yên cũ).',
    '   • Phần Ninh Thuận cũ nay thuộc Khánh Hòa: gửi Sở Nông nghiệp và Môi trường tỉnh Khánh Hòa (cổng Ninh Thuận cũ đã ngừng). Quyết định '
    'đã biết (chưa đối chiếu bản quét): TP Phan Rang – Tháp Chàm 369, Ninh Phước 350, Thuận Bắc 370, Ninh Hải 371 (28/6/2022), Bác Ái 462 '
    '(15/8/2022)/QĐ-UBND.',
    '2. Kèm Phiếu yêu cầu Mẫu số 13/ĐK (Phụ lục Nghị định số 101/2024/NĐ-CP) — tải bản chính thức, đối chiếu bản mới nhất trước khi nộp.',
    '3. Nộp trực tiếp tại bộ phận một cửa, qua bưu chính, hoặc trên Cổng dịch vụ công (thủ tục "Cung cấp thông tin, dữ liệu đất đai").',
    '4. Có tệp về thì chép vào D:\\KhoQH\\ (mỗi tỉnh một thư mục) và báo trợ lý: tệp PDF nét vector nắn + cắt ảnh như 7 huyện Khánh Hòa '
    '(scripts/qh-tinh/); tệp *.dgn / *.shp còn chính xác hơn (dùng được để tính quy hoạch theo từng thửa).'):
    doan(chu, sau=5)
os.makedirs(os.path.dirname(RA), exist_ok=True)
d.save(RA + '.tmp.docx'); os.replace(RA + '.tmp.docx', RA); print('ghi', RA, os.path.getsize(RA), 'byte')
