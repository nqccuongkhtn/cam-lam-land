# -*- coding: utf-8 -*-
# XUẤT HÀNG LOẠT tờ bản đồ địa chính DGN V8 → DXF bằng CHÍNH MICROSTATION (chạy tự động qua COM) — 15/10/2026.
# Chủ dự án đưa bộ 387 tờ xã Cam Lâm (D:\BandoCamLam\Ban do chep xa Cam Lam\bddc, đánh số tờ MỚI 1–399) để đổi sang GeoJSON
# đúng khuôn file thửa của hệ thống (doc_thua_v8.py). GDAL không đọc được DGN V8 nên phải qua MicroStation như dgn_sang_dxf.py:
# chép BẢN SAO vào thư mục tạm → mở bản sao → bỏ model trang in (nếu có) → Save As DXF → đóng → xoá bản sao. File gốc không bị mở.
# Tờ nào đã có DXF thì bỏ qua (chạy lại nhiều lần vẫn an toàn — tờ hỏng giữa chừng chỉ cần chạy lại). Mỗi tờ ghi một dòng nhật ký.
# ⚠️ Đừng mở MicroStation làm việc khác cùng lúc (COM bám vào chính cửa sổ MicroStation đang mở).
# Dùng: python -P xuat_dxf_hang_loat.py <thu_muc_dgn> <thu_muc_dxf_ra> <thu_muc_tam>
import sys, os, re, time, shutil
import win32com.client, win32com.client.dynamic
sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
vao, ra, tam = (os.path.abspath(a) for a in sys.argv[1:4])
os.makedirs(ra, exist_ok=True); os.makedirs(tam, exist_ok=True)
ds = sorted((f for f in os.listdir(vao) if f.lower().endswith('.dgn')), key=lambda f: int(re.sub(r'\D', '', f) or 0))
print(f'{len(ds)} to DGN trong {vao}')

def mo_ms():
    loi = None
    for _ in range(60):   # MicroStation vừa bật chưa sẵn sàng → gọi lại, chờ tối đa 2 phút
        try: return win32com.client.dynamic.Dispatch('MicroStationDGN.Application')
        except Exception as ex: loi = ex; time.sleep(2)
    sys.exit(f'LOI: khong goi duoc MicroStation: {loi}')

ms = mo_ms(); xong = bo = hong = 0
for f in ds:
    dich = os.path.join(ra, os.path.splitext(f)[0].lower() + '.dxf')
    if os.path.exists(dich) and os.path.getsize(dich) > 0: bo += 1; continue
    ban = os.path.join(tam, 'ban-sao-' + f.lower())
    dxf_tam = os.path.splitext(ban)[0] + '.dxf'
    try:
        shutil.copyfile(os.path.join(vao, f), ban)
        if os.path.exists(dxf_tam): os.remove(dxf_tam)
        try: ms.OpenDesignFile(ban, False)
        except Exception: ms = mo_ms(); ms.OpenDesignFile(ban, False)
        df = ms.ActiveDesignFile
        for md in list(df.Models):                                # model trang in làm SaveAs DXF báo lỗi → bỏ (chỉ trên bản sao)
            if md.Type != 0: df.Models.Delete(md)
        df.SaveAs(dxf_tam, True, 4)                               # 4 = DXF
        for _ in range(150):                                      # chờ file ghi xong (kích thước đứng yên)
            if os.path.exists(dxf_tam) and os.path.getsize(dxf_tam) > 0:
                s0 = os.path.getsize(dxf_tam); time.sleep(1.5)
                if os.path.getsize(dxf_tam) == s0: break
            time.sleep(1)
        else: raise RuntimeError('khong thay file DXF')
        try: ms.ActiveDesignFile.Close()
        except Exception: pass
        shutil.copyfile(dxf_tam, dich + '.tmp'); os.replace(dich + '.tmp', dich)
        xong += 1; print(f'xong {f} -> {os.path.basename(dich)} ({os.path.getsize(dich):,} byte)')
    except Exception as ex:
        hong += 1; print(f'HONG {f}: {ex}')
        try: ms.ActiveDesignFile.Close()
        except Exception: pass
    finally:
        for x in (ban, dxf_tam):
            try: os.remove(x)
            except OSError: pass
print(f'KET THUC: xuat moi {xong}, da co tu truoc {bo}, hong {hong}')
