import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const exec = promisify(execFile);

export interface ConvertResult { geojsonPath: string; log: string; }

// VN-2000 (Khánh Hòa · kinh tuyến trục 108.25° · k=0.9999) — dùng cho DGN/DXF không nhúng CRS.
const VN2000 =
  '+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 ' +
  '+towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 ' +
  '+units=m +no_defs';

/** DGN V8 là file dạng OLE2 (magic D0CF11E0). GDAL chỉ đọc DGN V7. */
function isDgnV8(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    return buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  } catch { return false; }
}

/**
 * Đổi DGN V8 → DXF qua GroupDocs.Conversion Cloud (gói miễn phí).
 * Cần biến môi trường GROUPDOCS_CLIENT_ID và GROUPDOCS_CLIENT_SECRET.
 */
async function dgnV8ToDxfOnline(filePath: string): Promise<{ dxfPath: string; log: string }> {
  const id = process.env.GROUPDOCS_CLIENT_ID;
  const secret = process.env.GROUPDOCS_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      'File là DGN V8 nhưng máy chủ chưa cấu hình GROUPDOCS_CLIENT_ID/SECRET để đổi V8 qua mạng. ' +
      'Đặt 2 biến này (miễn phí tại dashboard.groupdocs.cloud) hoặc xuất DXF/DGN V7 trước khi tải lên.');
  }
  const base = 'https://api.groupdocs.cloud';
  let log = 'DGN V8 phát hiện → đổi qua mạng (GroupDocs)\n';

  const tk = await fetch(base + '/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!tk.ok) throw new Error(`GroupDocs auth lỗi (HTTP ${tk.status}) — kiểm tra Client ID/Secret.`);
  const token = (await tk.json() as any).access_token as string;
  const H: Record<string, string> = { Authorization: 'Bearer ' + token };

  const name = path.basename(filePath);
  const stem = name.replace(/\.[^.]+$/, '');
  const remoteIn = 'input/' + name;

  const fileBuf = fs.readFileSync(filePath);
  const up = await fetch(base + '/v2.0/conversion/storage/file/' + encodeURI(remoteIn), {
    method: 'PUT', headers: H, body: fileBuf,
  });
  if (!up.ok) throw new Error(`GroupDocs tải lên lỗi (HTTP ${up.status}).`);
  log += `tải lên ${name} ok\n`;

  const cv = await fetch(base + '/v2.0/conversion', {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ FilePath: remoteIn, Format: 'dxf', OutputPath: 'output' }),
  });
  if (!cv.ok) throw new Error(`GroupDocs chuyển đổi lỗi (HTTP ${cv.status}): ${(await cv.text()).slice(0, 160)}`);
  const res = await cv.json() as any[];
  const rpath = (Array.isArray(res) && res[0]?.path) ? res[0].path : ('output/' + stem + '.dxf');

  const dl = await fetch(base + '/v2.0/conversion/storage/file/' + encodeURI(rpath), { headers: H });
  if (!dl.ok) throw new Error(`GroupDocs tải DXF về lỗi (HTTP ${dl.status}).`);
  const ab = await dl.arrayBuffer();
  const dxfPath = filePath.replace(/\.[^.]+$/, '') + '.__v8.dxf';
  fs.writeFileSync(dxfPath, Buffer.from(ab));
  log += `đổi V8 → DXF ok (${Math.round(Buffer.from(ab).length / 1024)} KB)\n`;
  return { dxfPath, log };
}

/**
 * Convert any supported GIS file to EPSG:4326 GeoJSON using GDAL/ogr2ogr.
 *  - .dgn        → MicroStation design file (V7 trực tiếp; V8 tự đổi qua mạng)
 *  - .shp / .zip → ESRI shapefile (zip read via GDAL /vsizip/)
 *  - .geojson    → normalised / reprojected
 */
export async function convertToGeoJSON(filePath: string, format: string): Promise<ConvertResult> {
  const out = filePath.replace(/\.[^.]+$/, '') + `.__4326.geojson`;
  if (fs.existsSync(out)) fs.unlinkSync(out);

  let source = filePath;
  let srcSrs: string | null = null;
  let log = '';

  if (format === 'shp' && path.extname(filePath).toLowerCase() === '.zip') {
    source = `/vsizip/${filePath}`;               // let GDAL read the shapefile inside the zip
  } else if (format === 'dgn') {
    if (isDgnV8(filePath)) {
      const r = await dgnV8ToDxfOnline(filePath);  // V8 → DXF cục bộ
      source = r.dxfPath; log += r.log;
    }
    srcSrs = VN2000;                               // DGN/DXF thường không nhúng CRS → giả định VN-2000
  }

  const baseArgs = ['-f', 'GeoJSON', out, source, '-skipfailures', '-nlt', 'CONVERT_TO_LINEAR'];

  // Ưu tiên: chỉ định hệ nguồn (DGN=VN-2000) rồi chiếu về WGS84; nếu nguồn đã có CRS thì dùng -t_srs.
  try {
    const args = srcSrs
      ? ['-s_srs', srcSrs, '-t_srs', 'EPSG:4326', ...baseArgs]
      : ['-t_srs', 'EPSG:4326', ...baseArgs];
    const { stderr } = await exec('ogr2ogr', args);
    log += `ogr2ogr → EPSG:4326 ok\n${stderr ?? ''}`;
  } catch (e1: any) {
    log += `reproject attempt failed: ${e1.stderr || e1.message}\n`;
    // Fallback: nguồn không có CRS — nạp toạ độ như hiện trạng.
    try {
      const { stderr } = await exec('ogr2ogr', baseArgs);
      log += `ogr2ogr (no reproject, assumed EPSG:4326) ok\n${stderr ?? ''}`;
    } catch (e2: any) {
      throw new Error(`ogr2ogr failed: ${e2.stderr || e2.message}`);
    }
  }

  if (!fs.existsSync(out)) throw new Error('ogr2ogr produced no output file');
  return { geojsonPath: out, log };
}

/** Probe whether GDAL is available (the worker image installs gdal-bin). */
export async function gdalVersion(): Promise<string> {
  try { const { stdout } = await exec('ogr2ogr', ['--version']); return stdout.trim(); }
  catch { return 'ogr2ogr NOT FOUND'; }
}
