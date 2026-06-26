import './globals.css';
import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Cam Lâm Land — Bất động sản & Bản đồ quy hoạch',
  description: 'Sàn bất động sản và hệ thống bản đồ GIS quy hoạch cho huyện Cam Lâm, Khánh Hòa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
      </head>
      <body>
        <Providers>
          <Nav />
          <main className="min-h-[calc(100vh-56px)]">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
