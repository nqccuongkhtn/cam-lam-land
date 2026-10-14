# -*- coding: utf-8 -*-
# ĐỔI DGN V8 → DXF BẰNG CHÍNH MICROSTATION (File ▸ Save As ▸ DXF, chạy tự động qua COM) — 14/10/2026.
# Dùng khi chủ dự án chưa xuất DXF (vd bản 1/500 Cam Hiệp Bắc). Làm trên BẢN SAO trong thư mục tạm rồi mới chép DXF ra cạnh file gốc,
# KHÔNG mở / ghi đè file DGN gốc. Cùng cách xuất với các file chủ dự án tự xuất (AutoCAD 2010 · AC1024, đơn vị mét).
# Dùng: python -P dgn_sang_dxf.py <file.dgn> <thu_muc_tam> [<file_dxf_ra>]   (mặc định: cạnh file DGN, cùng tên, đuôi .dxf)
import sys, os, time, shutil
import win32com.client, win32com.client.dynamic
sys.stdout.reconfigure(encoding='utf-8')
dgn, tam = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
ra = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else os.path.splitext(dgn)[0] + '.dxf'
if os.path.exists(ra): sys.exit(f'DA CO {ra} — khong ghi de (xoa tay neu muon xuat lai)')
os.makedirs(tam, exist_ok=True)
goc = os.path.splitext(os.path.basename(dgn))[0].replace(' ', '_')
ban = os.path.join(tam, f'{goc}-{time.strftime("%H%M%S")}.dgn'); shutil.copyfile(dgn, ban)
dxf_tam = os.path.splitext(ban)[0] + '.dxf'
# MicroStation vừa bật chưa sẵn sàng thì báo "File not found" / "RPC server is unavailable"… → gọi lại, chờ tối đa 2 phút
loi = None
for i in range(60):
    try:
        ms = win32com.client.dynamic.Dispatch('MicroStationDGN.Application'); ms.OpenDesignFile(ban, False); break
    except Exception as ex:
        loi = ex; time.sleep(2)
else: sys.exit(f'LOI: MicroStation khong mo duoc {ban}: {loi}')
# File có thêm model TRANG IN (sheet, vd "QH03", "fit_A0") thì SaveAs DXF qua COM báo lỗi -2147219504 và không ra file (giao diện
# thì hỏi bằng hộp thoại) → bỏ các model trang in TRÊN BẢN SAO; phần bản vẽ chính (model "Model") giữ nguyên đủ.
df = ms.ActiveDesignFile
for md in list(df.Models):
    if md.Type != 0:
        ten_md = md.Name; df.Models.Delete(md); print('bo model trang in (chi o ban sao):', ten_md)
ms.ActiveDesignFile.SaveAs(dxf_tam, True, 4)               # 4 = msdDesignFileFormatDXF
for i in range(200):
    if os.path.exists(dxf_tam) and os.path.getsize(dxf_tam) > 0:
        s0 = os.path.getsize(dxf_tam); time.sleep(3)
        if os.path.getsize(dxf_tam) == s0: break
    time.sleep(2)
else: sys.exit('LOI: khong thay file DXF')
try: ms.ActiveDesignFile.Close()
except Exception: pass
shutil.copyfile(dxf_tam, ra)
print(f'xong: {ra} ({os.path.getsize(ra):,} byte)')
