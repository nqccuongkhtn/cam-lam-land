import './globals.css';
import type { Metadata } from 'next';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Cam Lâm Land — Bất động sản & Bản đồ quy hoạch',
  description: 'Sàn bất động sản và hệ thống bản đồ GIS quy hoạch cho huyện Cam Lâm, Khánh Hòa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* Tailwind Play CDN — zero-config styling for the demo */}
        <script src="https://cdn.tailwindcss.com" />
        {/* MapLibre GL stylesheet */}
        <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
      </head>
      <body>
        <Nav />
        <main className="min-h-[calc(100vh-56px)]">{children}</main>
      </body>
    </html>
  );
}
