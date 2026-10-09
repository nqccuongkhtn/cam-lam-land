import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import NewsReaderClient from './NewsReaderClient';

import { ldJson } from '@/lib/jsonld';
import { SITE } from '@/lib/tenMien';


// Lấy ĐÚNG MỘT BÀI qua đường NỘI BỘ (9/10/2026). Trước đây mỗi lượt đọc, máy chủ tải lại cả kho ~600 bài
// qua Internet (vòng ra Cloudflare rồi quay về) → chậm 3–4 giây. Giờ hỏi thẳng tiến trình Next.js đang chạy.
// Kết quả 3 trạng thái: có bài / 'khong-co' (hết hạn lưu → trang trả 404) / null (lỗi tạm thời → KHÔNG báo 404).
const NOI_BO = `http://127.0.0.1:${process.env.PORT || 3000}`;
type KetQua = { bai: any; lienQuan: any[] } | 'khong-co' | null;
async function getArticle(slug: string): Promise<KetQua> {
  try {
    const r = await fetch(`${NOI_BO}/feed/news?slug=${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (r.status === 404) return 'khong-co';
    if (!r.ok) return null;
    const d = await r.json();
    return d.bai ? { bai: d.bai, lienQuan: d.lienQuan || [] } : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const slug = decodeURIComponent(params.id);
  const kq = await getArticle(slug);
  if (kq === 'khong-co') notFound();
  const a = kq?.bai;
  if (!a) return { title: 'Tin tức bất động sản Cam Lâm', description: 'Tin thị trường bất động sản Cam Lâm, Khánh Hòa.' };
  const title = String(a.title || 'Tin tức').replace(/\s+/g, ' ').trim();
  const desc = String(a.summary || a.body || title).replace(/\s+/g, ' ').trim().slice(0, 280);
  const img = (Array.isArray(a.images) && a.images[0]) || a.image || `${SITE}/icons/icon-512.png`;
  const url = `${SITE}/tin-tuc/${slug}`;
  return {
    title,
    description: desc,
    alternates: { canonical: `/tin-tuc/${slug}` },
    openGraph: { type: 'article', title, description: desc, url, siteName: 'Cam Lâm Land', images: [{ url: img }], ...(a.publishedAt ? { publishedTime: a.publishedAt } : {}) },
    twitter: { card: 'summary_large_image', title, description: desc, images: [img] },
  };
}

export default async function Page({ params }: { params: { id: string } }) {
  const slug = decodeURIComponent(params.id);
  const kq = await getArticle(slug);
  // Bài quá hạn lưu (30 ngày) / không có thật → mã 404 "không tồn tại" để Google gỡ khỏi kết quả tìm kiếm
  if (kq === 'khong-co') notFound();
  const a = kq?.bai || null;
  const imgs = a ? ((Array.isArray(a.images) && a.images.length) ? a.images : (a.image ? [a.image] : undefined)) : undefined;
  const ld = a ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: String(a.title || '').slice(0, 110),
    image: imgs,
    datePublished: a.publishedAt,
    dateModified: a.publishedAt,
    author: { '@type': 'Organization', name: 'Cam Lâm Land' },
    publisher: { '@type': 'Organization', name: 'Cam Lâm Land', logo: { '@type': 'ImageObject', url: `${SITE}/icons/icon-512.png` } },
    mainEntityOfPage: `${SITE}/tin-tuc/${slug}`,
  } : null;
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />}
      <NewsReaderClient bai={a} lienQuan={kq ? kq.lienQuan : undefined} />
    </>
  );
}
