import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Proxy mọi request /api/* sang backend (đọc env lúc chạy, không phụ thuộc lúc build).
export const config = { matcher: '/api/:path*' };

export function middleware(req: NextRequest) {
  const host = process.env.BACKEND_HOST;
  if (!host) return NextResponse.next();
  const base = host.startsWith('http') ? host : `https://${host}`;
  const target = new URL(req.nextUrl.pathname + req.nextUrl.search, base);
  return NextResponse.rewrite(target);
}
