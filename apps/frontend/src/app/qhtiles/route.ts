// Proxy CÙNG TÊN MIỀN cho file qd205.pmtiles (đang host trên GitHub Releases).
// Mục đích: né CORS (GitHub không cho trình duyệt tải trực tiếp) và hỗ trợ HTTP range
// để MapLibre + pmtiles chỉ tải đúng phần tile đang xem.
// Cơ chế: lần đầu tải nguyên file 148MB về /tmp (đệm), các lần sau phục vụ range từ đĩa (nhanh).
import { createReadStream, createWriteStream, existsSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SRC = 'https://github.com/nqccuongkhtn/cam-lam-land/releases/download/tiles/qd205.pmtiles';
const FILE = join(tmpdir(), 'qd205.pmtiles');
let ready: Promise<void> | null = null;

// Tải file về đĩa 1 lần (dedupe: mọi request đầu tiên cùng chờ 1 promise).
function ensureFile(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    if (existsSync(FILE) && statSync(FILE).size > 1_000_000) return;
    const res = await fetch(SRC);
    if (!res.ok || !res.body) throw new Error('tải pmtiles lỗi: ' + res.status);
    await pipeline(Readable.fromWeb(res.body as any), createWriteStream(FILE));
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'range, if-match, if-none-match',
  'access-control-expose-headers': 'content-length, content-range, etag, accept-ranges',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  try {
    await ensureFile();
  } catch (e: any) {
    return new Response('upstream error: ' + (e?.message || e), { status: 502, headers: CORS });
  }
  const size = statSync(FILE).size;
  const base: Record<string, string> = {
    ...CORS,
    'accept-ranges': 'bytes',
    'content-type': 'application/octet-stream',
    'cache-control': 'public, max-age=604800',
    etag: '"qd205-' + size + '"',
  };
  const range = req.headers.get('range');
  const m = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
  if (m) {
    const start = parseInt(m[1], 10);
    const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
    if (Number.isNaN(start) || start >= size || start > end) {
      return new Response(null, { status: 416, headers: { ...base, 'content-range': `bytes */${size}` } });
    }
    const stream = createReadStream(FILE, { start, end });
    return new Response(Readable.toWeb(stream) as any, {
      status: 206,
      headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) },
    });
  }
  const stream = createReadStream(FILE);
  return new Response(Readable.toWeb(stream) as any, { status: 200, headers: { ...base, 'content-length': String(size) } });
}
