// Phục vụ file qd205.pmtiles CÙNG TÊN MIỀN (né CORS của GitHub) + hỗ trợ HTTP range.
// Ưu tiên file đã NẠP SẴN vào image lúc build (Dockerfile.render tải về /app/qd205.pmtiles).
// Nếu vì lý do nào đó không có, mới tải runtime về /tmp — tải ra file .part rồi đổi tên,
// và BẮT BUỘC đủ ~148MB mới dùng (tránh phục vụ file tải dở gây "mất ảnh").
import { createReadStream, createWriteStream, existsSync, statSync, renameSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SRC = 'https://github.com/nqccuongkhtn/cam-lam-land/releases/download/tiles/qd205.pmtiles';
const BAKED = join(process.cwd(), 'qd205.pmtiles'); // nạp sẵn lúc build
const CACHE = join(tmpdir(), 'qd205.pmtiles');       // dự phòng: tải runtime
const MIN_OK = 140_000_000;                          // file thật ~147.6MB

let resolving: Promise<string> | null = null;

function resolveFile(): Promise<string> {
  if (resolving) return resolving;
  resolving = (async () => {
    if (existsSync(BAKED) && statSync(BAKED).size >= MIN_OK) return BAKED;
    if (existsSync(CACHE) && statSync(CACHE).size >= MIN_OK) return CACHE;
    const part = CACHE + '.part';
    const res = await fetch(SRC);
    if (!res.ok || !res.body) throw new Error('tải pmtiles lỗi: ' + res.status);
    await pipeline(Readable.fromWeb(res.body as any), createWriteStream(part));
    if (statSync(part).size < MIN_OK) throw new Error('file tải chưa đủ');
    renameSync(part, CACHE);
    return CACHE;
  })().catch((e) => { resolving = null; throw e; });
  return resolving;
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
  let file: string;
  try {
    file = await resolveFile();
  } catch (e: any) {
    return new Response('upstream error: ' + (e?.message || e), { status: 502, headers: CORS });
  }
  const size = statSync(file).size;
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
    const stream = createReadStream(file, { start, end });
    return new Response(Readable.toWeb(stream) as any, {
      status: 206,
      headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) },
    });
  }
  const stream = createReadStream(file);
  return new Response(Readable.toWeb(stream) as any, { status: 200, headers: { ...base, 'content-length': String(size) } });
}
