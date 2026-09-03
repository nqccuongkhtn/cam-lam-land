// Đọc MỘT file geojson địa chính rồi in ra dạng bảng CSV để psql hút thẳng vào
// database (lệnh \copy ... WITH (FORMAT csv)). Chỉ ĐỌC, không ghi/sửa gì trong thư mục gốc.
//
// Cách dùng:  node doc-1-file.mjs "D:/.../xa_Abc_12345.geojson"
//
// Cột in ra, đúng thứ tự:  ma_xa | cap | so_to | so_thua | dien_tich | muc_dich | hinh_dang
//
// "cap" suy từ chữ HOA/thường trong tên xã của chính file gốc:
//   "Xã Cam Lâm"  (chữ hoa)    -> 2  = đơn vị hành chính MỚI sau sáp nhập 2025
//   "xã Cam Hoà"  (chữ thường) -> 3  = đơn vị CŨ trước sáp nhập
// Quy ước này do bên lập dữ liệu đặt, không chuẩn 100% -> sau khi nạp vẫn sửa lại được
// trong bảng danh mục dia_chinh_xa mà không phải nạp lại từ đầu.
import fs from 'node:fs';

const duongDan = process.argv[2];
if (!duongDan) { console.error('Thiếu đường dẫn file'); process.exit(1); }

// Bọc một ô dữ liệu theo đúng luật CSV: có dấu phẩy / nháy kép / xuống dòng thì bọc nháy kép,
// nháy kép bên trong thì gõ đôi lên. Ô trống = ô rỗng (database hiểu là "không có").
const o = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? '"' + s.split('"').join('""') + '"' : s;
};

const goc = JSON.parse(fs.readFileSync(duongDan, 'utf8'));
const dsThua = goc.features || [];
const dong = [];

for (const t of dsThua) {
  if (!t || !t.geometry) continue;                     // thửa không có hình thì bỏ qua
  const p = t.properties || {};
  const tenXa = String(p.xa || '');
  const cap = /^[XP]/.test(tenXa) ? 2 : 3;             // X hoa / P hoa = đơn vị mới
  const dt = p.dienTich_m2;
  dong.push([
    o(p.xaId),
    cap,
    o(p.to),
    o(p.thua),
    dt === null || dt === undefined || dt === '' ? '' : Number(dt),
    o(p.mucDichSuDung),
    o(JSON.stringify(t.geometry)),                     // hình dạng giữ nguyên dạng GeoJSON
  ].join(','));
}

process.stdout.write(dong.length ? dong.join('\n') + '\n' : '');
process.stderr.write(`${dsThua.length} thửa\n`);
