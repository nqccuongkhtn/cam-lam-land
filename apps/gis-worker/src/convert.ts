import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const exec = promisify(execFile);

export interface ConvertResult { geojsonPath: string; log: string; }

/**
 * Convert any supported GIS file to EPSG:4326 GeoJSON using GDAL/ogr2ogr.
 *  - .dgn        → MicroStation design file
 *  - .shp / .zip → ESRI shapefile (zip read via GDAL /vsizip/)
 *  - .geojson    → normalised / reprojected
 */
export async function convertToGeoJSON(filePath: string, format: string): Promise<ConvertResult> {
  const out = filePath.replace(/\.[^.]+$/, '') + `.__4326.geojson`;
  if (fs.existsSync(out)) fs.unlinkSync(out);

  let source = filePath;
  if (format === 'shp' && path.extname(filePath).toLowerCase() === '.zip') {
    source = `/vsizip/${filePath}`;          // let GDAL read the shapefile inside the zip
  }

  const baseArgs = ['-f', 'GeoJSON', out, source, '-skipfailures'];
  let log = '';

  // First attempt: reproject to WGS84. Works when the source declares a CRS.
  try {
    const { stderr } = await exec('ogr2ogr', ['-t_srs', 'EPSG:4326', ...baseArgs]);
    log += `ogr2ogr -t_srs EPSG:4326 ok\n${stderr ?? ''}`;
  } catch (e1: any) {
    log += `reproject attempt failed: ${e1.stderr || e1.message}\n`;
    // Fallback: source has no CRS (common for raw DGN) — import coordinates as-is.
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
