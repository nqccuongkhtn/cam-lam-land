# -*- coding: utf-8 -*-
# KIỂM DỮ LIỆU QUY HOẠCH THEO THỬA TỪ PDF SAU MỖI LẦN NẠP (15/10/2026) — chỉ ĐỌC cơ sở dữ liệu, không sửa gì.
# Gom các phép kiểm đêm 14→15/10 (từng bắt được dải viền hồng ranh huyện, nét chữ xanh / tím khoét lỗ, chọn nhầm bản huyện bên):
#   1) PHỦ THEO THỬA: lấy mẫu thửa của CHÍNH từng huyện (mã xã → huyện cũ theo apps/backend/data/huyen-cu.json, đúng như máy chủ),
#      đo phần diện tích thửa có loại đất + số thửa không có gì + số thửa có phần "chưa xác định" ≥ 0,5 m².
#      Đêm 15/10 sau khi sửa: 99,56–100 % diện tích thửa có loại đất, 0 thửa trắng trơn.
#   2) VÙNG ĐẤT Ở NẰM TRÊN ĐẤT HUYỆN KHÁC: vùng ODT / ONT > 50 ha mà thửa của chính huyện chiếm < 1/4 số thửa trong nó = dấu hiệu DẢI VIỀN /
#      NỀN HỒNG lọt lại (trước sửa: Diên Khánh 1.637 ha, Vạn Ninh 1.008 ha, Khánh Sơn 516 ha…). Đúng thì ra 0 vùng.
#   3) TÊN CÒN DẠNG MÃ THÔ (vd "MVB" — chú giải không ghi tên, giữ nguyên mã theo luật) để soi.
# Dùng (trong thư mục gốc dự án, web đang chạy):  python -X utf8 scripts/qh-tinh/kiem_qh_pdf.py [chia_mau=151]
import sys, os, json, subprocess
sys.stdout.reconfigure(encoding='utf-8')
GOC = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
CHIA = int(sys.argv[1]) if len(sys.argv) > 1 else 151
BAN_THEO_HUYEN = {'TP. Nha Trang': 'nhatrang2030', 'Thị xã Ninh Hòa': 'ninhhoa2030', 'Huyện Vạn Ninh': 'vanninh2030', 'TP. Cam Ranh': 'camranh2030',
                  'Huyện Khánh Sơn': 'khanhson2030', 'Huyện Diên Khánh': 'dienkhanh2030', 'Huyện Khánh Vĩnh': 'khanhvinh2030'}   # như lib/qhPdf.ts


def psql(sql):
    kq = subprocess.run(['docker', 'compose', 'exec', '-T', 'postgis', 'psql', '-U', 'camlam', '-d', 'camlam_gis', '-tA', '-F', '|', '-c', sql],
                        capture_output=True, text=True, cwd=GOC, encoding='utf-8', stdin=subprocess.DEVNULL,
                        env={**os.environ, 'MSYS_NO_PATHCONV': '1'})
    if kq.returncode: print('LỖI psql:', kq.stderr[:500])
    return [l.split('|') for l in kq.stdout.strip().splitlines() if l.strip()]


hc = json.load(open(os.path.join(GOC, 'apps', 'backend', 'data', 'huyen-cu.json'), encoding='utf-8'))
H = "WITH h(xa_id, huyen) AS (VALUES " + ','.join(f"('{k}','{v}')" for k, v in hc.items() if k != '_doc') + "), " \
    "b(huyen, ban) AS (VALUES " + ','.join(f"('{k}','{v}')" for k, v in BAN_THEO_HUYEN.items()) + ") "
# độ trượt lớp địa chính (qhCompute.ts LECH_DC_X/Y) — máy chủ dịch thửa y như vậy trước khi chồng lên quy hoạch
DICH = "ST_Translate(ST_MakeValid(d.geom), -0.533/111320.0/cos(radians(12.2)), -0.141/110574.0)"

print(f'1) PHỦ THEO THỬA (mẫu 1/{CHIA} số thửa của chính từng huyện, bỏ thửa đường / sông / thuỷ lợi)')
for ban, n, trang, co_cxd, pt in psql(H + f"""
    , s AS (SELECT b.ban, d.id, {DICH} g FROM dia_chinh d JOIN h ON h.xa_id = d.xa_id JOIN b ON b.huyen = h.huyen
            WHERE d.id % {CHIA} = 17 AND upper(coalesce(d.mdsd,'')) NOT IN ('DGT','SON','DTL'))
    , t AS (SELECT s.ban, ST_Area(s.g::geography) tong,
                   (SELECT coalesce(sum(ST_Area(ST_Intersection(z.geom, s.g)::geography)), 0) FROM qh_pdf z
                    WHERE z.ban = s.ban AND z.geom && s.g AND ST_Intersects(z.geom, s.g)) phu FROM s)
    SELECT ban, count(*), count(*) FILTER (WHERE phu < 0.005 * tong), count(*) FILTER (WHERE tong - phu >= 0.5 AND phu >= 0.005 * tong),
           round((100 * sum(phu) / nullif(sum(tong), 0))::numeric, 2) FROM t GROUP BY ban ORDER BY ban"""):
    print(f'   {ban:15s} {n:>5s} thửa · {pt:>6s} % diện tích có loại đất · {trang} thửa không có gì · {co_cxd} thửa có phần "chưa xác định"')

print('2) VÙNG ĐẤT Ở > 50 ha NẰM CHỦ YẾU TRÊN ĐẤT HUYỆN KHÁC (nghi dải viền / nền hồng lọt lại) — đúng thì không in dòng nào')
dong = psql(H + """
    , big AS (SELECT z.id, z.ban, z.ma, z.geom, ST_Area(z.geom::geography) / 1e4 ha FROM qh_pdf z
              WHERE z.ma IN ('ODT', 'ONT') AND ST_Area(z.geom::geography) > 50e4)
    , dem AS (SELECT big.id, count(*) FILTER (WHERE b.ban = big.ban) minh, count(*) FILTER (WHERE b.ban IS DISTINCT FROM big.ban) khac
              FROM big JOIN dia_chinh d ON d.id % 7 = 3 AND d.geom && big.geom AND ST_Intersects(big.geom, ST_PointOnSurface(d.geom))
              JOIN h ON h.xa_id = d.xa_id LEFT JOIN b ON b.huyen = h.huyen GROUP BY big.id)
    SELECT big.ban, big.id, big.ma, round(big.ha::numeric, 1), dem.minh, dem.khac FROM big JOIN dem ON dem.id = big.id
    WHERE dem.khac > 3 * dem.minh ORDER BY big.ha DESC""")
for ban, i, ma, ha, minh, khac in dong:
    print(f'   ⚠️ {ban} vùng {i} {ma} {ha} ha: {minh} thửa của huyện / {khac} thửa huyện khác (mẫu 1/7)')
print(f'   → {len(dong)} vùng')

print('3) TÊN CÒN DẠNG MÃ THÔ (chú giải không ghi tên — giữ mã theo luật, chỉ để soi)')
for ban, ten, n, ha in psql("SELECT ban, ten, count(*), round((sum(ST_Area(geom::geography))/1e4)::numeric, 1) FROM qh_pdf "
                            "WHERE ten ~ '^[A-Z]{3}$' OR ten LIKE 'NHOM:%' GROUP BY ban, ten ORDER BY 4 DESC"):
    print(f'   {ban} "{ten}": {n} vùng, {ha} ha')
