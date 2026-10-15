# -*- coding: utf-8 -*-
# KHAI 2 LỚP QHSDĐ 2030 TỈNH LÂM ĐỒNG (TP Đà Lạt, huyện Đức Trọng) VÀO TRANG BẢN ĐỒ — app/map/page.tsx (15/10/2026 tối, chuẩn bị sẵn).
# Gọi từ dua-len-web-lam-dong.sh SAU KHI đã chép ô ảnh vào kho ô ảnh của web (khai trước khi có ô là lớp hiện ra mà ảnh trống).
# Chạy lại nhiều lần vẫn an toàn: chỗ nào đã có thì bỏ qua. Ghi tệp tạm rồi đổi tên (không ghi đè dở dang).
# Nguồn + cách nắn: D:\KhoQH\qhsdd-2030-lam-dong\NGUON.txt · scripts/qh-tinh/README.md mục "TỈNH KHÁC — Lâm Đồng".
# Số, ngày, trích yếu quyết định đọc trên bản quét có chữ ký số (trang 1): QĐ 2199/QĐ-UBND 09/11/2023 · QĐ 1868/QĐ-UBND 29/9/2023.
# Lớp chỉ có ẢNH (chưa bóc loại đất theo thửa — web chưa có thửa địa chính Lâm Đồng) nên MUC_QH không có trường `pdf`.
import os, sys

TRANG = (sys.argv[1] if len(sys.argv) > 1 else   # đối số = chạy thử trên BẢN SAO của trang
         os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'apps', 'frontend', 'src', 'app', 'map', 'page.tsx'))
LD = ('https://lamdong.gov.vn/sites/stnmt/quy-hoach-su-dung-dat-den-nam-2030/Shared%20Documents/'
      'Quy%20ho%E1%BA%A1ch%20s%E1%BB%AD%20d%E1%BB%A5ng%20%C4%91%E1%BA%A5t%20%C4%91%E1%BA%BFn%20n%C4%83m%202030/')
DL = '12.%20%C4%90%C3%A0%20L%E1%BA%A1t/'
DT = '9.%20%C4%90%E1%BB%A9c%20Tr%E1%BB%8Dng/'

CHEN = [
    # (mốc có sẵn trong trang — chèn NGAY SAU dòng chứa mốc, dấu hiệu đã chèn, đoạn chèn)
    ("    coordinates: [[108.668, 12.515], [109.069, 12.515], [109.069, 12.086], [108.668, 12.086]] as [[number, number], [number, number], [number, number], [number, number]] },",
     "'qh-dalat2030'",
     "  // ── TỈNH LÂM ĐỒNG (15/10/2026): QHSDĐ 2030 do Sở NN&MT Lâm Đồng công bố. PDF không có lớp chữ → đọc tay nhãn lưới + dò vạch lưới\n"
     "  //    vector; KINH TUYẾN TRỤC 107°45' (mục \"ktt\" trong <pdf>.nan.json). Kiểm: hồ Xuân Hương, sân bay Liên Khương trùng ảnh vệ tinh.\n"
     "  { id: 'qh-dalat2030', name: 'QHSDĐ 2030 TP Đà Lạt (Lâm Đồng)', url: '',\n"
     "    tiles: ['/tiles/dalat2030v1/{z}/{x}/{y}.webp'], minzoom: 9, maxzoom: 17,\n"
     "    coordinates: [[108.3135, 12.0103], [108.5961, 12.0103], [108.5961, 11.8063], [108.3135, 11.8063]] as [[number, number], [number, number], [number, number], [number, number]] },\n"
     "  { id: 'qh-ductrong2030', name: 'QHSDĐ 2030 huyện Đức Trọng (Lâm Đồng)', url: '',\n"
     "    tiles: ['/tiles/ductrong2030v1/{z}/{x}/{y}.webp'], minzoom: 9, maxzoom: 17,\n"
     "    coordinates: [[108.2094, 11.8867], [108.5846, 11.8867], [108.5846, 11.503], [108.2094, 11.503]] as [[number, number], [number, number], [number, number], [number, number]] },"),
    ("  { id: 'khanh-vinh', ten: 'Huyện Khánh Vĩnh',    tenNgan: 'Khánh Vĩnh', tamXem: [108.8414, 12.3126, 10] },",
     "id: 'da-lat'",
     "  { id: 'da-lat',    ten: 'TP. Đà Lạt (Lâm Đồng)',      tenNgan: 'Đà Lạt',    tamXem: [108.4641, 11.9201, 12] },\n"
     "  { id: 'duc-trong', ten: 'Huyện Đức Trọng (Lâm Đồng)', tenNgan: 'Đức Trọng', tamXem: [108.3865, 11.6524, 11] },"),
    ("  { id: 'qh-khanhvinh2030', ten: 'QHSDĐ 2030 · Huyện Khánh Vĩnh', tenNgan: 'Khánh Vĩnh 2030', tenApp: 'QH Sử dụng đất 2030', pdf: 'khanhvinh2030', gom: ['qh-khanhvinh2030'], zBay: 10, vung: 'khanh-vinh' },",
     "id: 'qh-dalat2030', ten:",
     "  { id: 'qh-dalat2030', ten: 'QHSDĐ 2030 · TP Đà Lạt (Lâm Đồng)', tenNgan: 'Đà Lạt 2030', tenApp: 'QH Sử dụng đất 2030', gom: ['qh-dalat2030'], zBay: 12, vung: 'da-lat' },\n"
     "  { id: 'qh-ductrong2030', ten: 'QHSDĐ 2030 · Huyện Đức Trọng (Lâm Đồng)', tenNgan: 'Đức Trọng 2030', tenApp: 'QH Sử dụng đất 2030', gom: ['qh-ductrong2030'], zBay: 11, vung: 'duc-trong' },"),
    ("const CAN_CU_QH: Record<string, CanCu> = {",
     "'qh-dalat2030': {",
     "  // Lâm Đồng (15/10/2026): số / ngày / trích yếu đọc trên bản quét có chữ ký số; bản đồ Đà Lạt Sở đăng là bản \"TrinhPheDuyet\" (trình phê duyệt).\n"
     "  'qh-dalat2030': { so: '2199/QĐ-UBND', ngay: '09/11/2023', coQuan: 'UBND tỉnh Lâm Đồng',\n"
     "    ten: 'Phê duyệt quy hoạch sử dụng đất đến năm 2030 thành phố Đà Lạt, tỉnh Lâm Đồng',\n"
     f"    tep: '{LD}{DL}2199Q%C4%90(09.11.2023_10h46p53)_signed.pdf',\n"
     f"    cac: [{{ so: 'Quyết định', ngay: '09/11/2023', ten: '2199/QĐ-UBND (bản quét có chữ ký)', tep: '{LD}{DL}2199Q%C4%90(09.11.2023_10h46p53)_signed.pdf' }},\n"
     f"      {{ so: 'Bản đồ', ngay: '09/11/2023', ten: 'Bản đồ QHSDĐ đến năm 2030 TP Đà Lạt — bản trình phê duyệt (Sở NN&MT Lâm Đồng công bố)', tep: '{LD}{DL}BanDo_QH2030_DALAT_25k_183_TrinhPheDuyet.dgn.pdf' }}] }},\n"
     "  'qh-ductrong2030': { so: '1868/QĐ-UBND', ngay: '29/9/2023', coQuan: 'UBND tỉnh Lâm Đồng',\n"
     "    ten: 'Phê duyệt quy hoạch sử dụng đất đến năm 2030 huyện Đức Trọng, tỉnh Lâm Đồng',\n"
     f"    tep: '{LD}{DT}1868Q%C4%90(29.09.2023_15h19p26)_signed.pdf',\n"
     f"    cac: [{{ so: 'Quyết định', ngay: '29/9/2023', ten: '1868/QĐ-UBND (bản quét có chữ ký)', tep: '{LD}{DT}1868Q%C4%90(29.09.2023_15h19p26)_signed.pdf' }},\n"
     f"      {{ so: 'Bản đồ', ngay: '29/9/2023', ten: 'Bản đồ QHSDĐ đến năm 2030 huyện Đức Trọng (Sở NN&MT Lâm Đồng công bố)', tep: '{LD}{DT}QH2030_DUCTRONG_137_T9_2023.pdf' }}] }},"),
]
# trạng thái bật / tắt ban đầu của lớp (useState ovOn): thêm hai lớp, mặc định TẮT
OV_CU = "'qh-dienkhanh2030': false, 'qh-khanhvinh2030': false });"
OV_MOI = "'qh-dienkhanh2030': false, 'qh-khanhvinh2030': false, 'qh-dalat2030': false, 'qh-ductrong2030': false });"

def main():
    raw = open(TRANG, 'rb').read(); nl = '\r\n' if b'\r\n' in raw else '\n'
    s = raw.decode('utf-8').replace('\r\n', '\n')
    doi = 0
    for moc, dau, doan in CHEN:
        if dau in s: print('  da co, bo qua:', dau); continue
        if s.count(moc) != 1: sys.exit(f'LOI: khong thay dung 1 cho moc: {moc[:70]}… (trang da doi? sua tay theo mau trong kich ban nay)')
        s = s.replace(moc, moc + '\n' + doan); doi += 1
    if "'qh-dalat2030': false" not in s:
        if s.count(OV_CU) != 1: sys.exit('LOI: khong thay dong khoi tao ovOn')
        s = s.replace(OV_CU, OV_MOI); doi += 1
    if not doi: print('Trang ban do da co du 2 lop Lam Dong — khong doi gi.'); return
    open(TRANG + '.tmp', 'wb').write(s.replace('\n', nl).encode('utf-8')); os.replace(TRANG + '.tmp', TRANG)
    print(f'Da khai 2 lop Lam Dong vao trang ban do ({doi} cho).')

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
