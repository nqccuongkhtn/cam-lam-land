import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { ldJson } from '@/lib/jsonld';
import { SITE } from '@/lib/tenMien';
import { DD, tenMoi, tenCu, tenHuyen, hoaDau, huyenGocCua, xaCuCuaHuyen, type XaMoi } from '@/lib/diaDanh';

// TRANG TỔNG ĐỊA DANH (13/10/2026): 65 xã/phường mới xếp theo khu vực huyện cũ + toàn bộ tên cũ để tra — xem lib/diaDanh.ts.
const TITLE = 'Bản đồ 65 xã, phường tỉnh Khánh Hòa sau sáp nhập';
const DESC = 'Danh sách 65 xã, phường, đặc khu tỉnh Khánh Hòa từ 1/7/2025 (Nghị quyết 1667/NQ-UBTVQH15): xã mới gồm những xã cũ nào, huyện cũ nay thuộc đâu, số tờ bản đồ mới ↔ cũ. Tra bản đồ địa chính từng xã.';
export const metadata: Metadata = {
  title: TITLE, description: DESC,
  alternates: { canonical: '/ban-do' },
  openGraph: { type: 'website', title: TITLE, description: DESC, url: `${SITE}/ban-do`, images: [{ url: '/icons/icon-512.png' }] },
};

export default function Page() {
  const dem = (l: string) => DD.xaMoi.filter((x) => x.loai === l).length;
  // Nhóm xã mới theo huyện cũ của ĐƠN VỊ GỐC (xã mới kế thừa mã của đơn vị đó)
  const nhom = new Map<number, XaMoi[]>();
  for (const m of DD.xaMoi) {
    const h = huyenGocCua(m);
    const k = h ? h.id : 0;
    if (!nhom.has(k)) nhom.set(k, []);
    nhom.get(k)!.push(m);
  }
  const huyenCoXa = DD.huyenCu.filter((h) => nhom.has(h.id));
  const soXaCu = DD.xaCu.length;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Bản đồ Khánh Hòa', item: `${SITE}/ban-do` },
      ] },
      { '@type': 'ItemList', name: 'Xã, phường, đặc khu tỉnh Khánh Hòa từ 1/7/2025', numberOfItems: DD.xaMoi.length,
        itemListElement: DD.xaMoi.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: tenMoi(m), url: `${SITE}/ban-do/${m.slug}` })) },
    ],
  };
  const chip = 'rounded-full bg-slate-100 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-[#C8A14B]/20';

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <div className="mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-7">
        <nav aria-label="Đường dẫn" className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
          <Link href="/" className="hover:text-[#C8A14B]">Trang chủ</Link><span>›</span><span className="font-medium text-slate-700">Bản đồ Khánh Hòa</span>
        </nav>
        <h1 className="text-2xl font-extrabold leading-tight text-[#0A2540] sm:text-3xl">Bản đồ 65 xã, phường tỉnh Khánh Hòa</h1>
        <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-slate-600">
          Từ 1/7/2025, theo Nghị quyết 1667/NQ-UBTVQH15, tỉnh Khánh Hòa (gồm Khánh Hòa cũ và Ninh Thuận cũ) có {DD.xaMoi.length} đơn vị
          hành chính cấp xã: {dem('xã')} xã, {dem('phường')} phường và {dem('đặc khu')} đặc khu; không còn cấp huyện. Mỗi trang dưới đây cho biết
          xã mới gồm những xã cũ nào, tờ bản đồ địa chính được đánh số lại ra sao, và mở thẳng bản đồ thửa đất của xã đó.
          Tìm theo tên cũ thì xem mục <a href="#ten-cu" className="font-semibold text-[#0A2540] underline decoration-slate-300 underline-offset-2">tra theo tên trước sáp nhập</a>.
        </p>

        <section className="mt-6">
          <h2 className="text-lg font-bold text-[#0A2540] sm:text-xl">Xã, phường mới theo khu vực</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[...huyenCoXa, ...(nhom.has(0) ? [null] : [])].map((h) => {
              const ds = (nhom.get(h ? h.id : 0) || []).slice().sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
              return (
                <div key={h ? h.slug : 'khac'} className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-[14.5px] font-bold text-[#0A2540]">
                    {h ? <>Khu vực <Link href={`/ban-do/${h.slug}`} className="underline decoration-slate-300 underline-offset-2 hover:decoration-[#C8A14B]">{tenHuyen(h)}</Link> <span className="font-normal text-slate-500">({h.tinhCu} cũ)</span></> : 'Khu vực khác'}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ds.map((m) => <Link key={m.slug} href={`/ban-do/${m.slug}`} className={chip}>{tenMoi(m)}</Link>)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="ten-cu" className="mt-8 scroll-mt-20">
          <h2 className="text-lg font-bold text-[#0A2540] sm:text-xl">Tra theo tên trước sáp nhập</h2>
          <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-slate-600">
            {DD.huyenCu.length} huyện, thị xã, thành phố và {soXaCu} xã, phường, thị trấn cũ. Bấm vào tên cũ để biết nay thuộc xã, phường nào
            và số tờ bản đồ mới.
          </p>
          <div className="mt-3 space-y-3">
            {DD.huyenCu.map((h) => {
              const cu = xaCuCuaHuyen(h).slice().sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
              return (
                <div key={h.slug} className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-[14.5px] font-bold text-[#0A2540]"><Link href={`/ban-do/${h.slug}`} className="underline decoration-slate-300 underline-offset-2 hover:decoration-[#C8A14B]">{hoaDau(tenHuyen(h))}</Link> <span className="font-normal text-slate-500">({h.tinhCu} cũ)</span></h3>
                  {cu.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[13.5px]">
                      {cu.map((c) => <Link key={c.slug} href={`/ban-do/${c.slug}`} className="text-slate-600 hover:text-[#0A2540] hover:underline">{tenCu(c)}</Link>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <p className="mt-6 text-[12.5px] leading-relaxed text-slate-500">
          Căn cứ: {'Nghị quyết 1667/NQ-UBTVQH15 (Công báo số 803+804 ngày 24/6/2025); Nghị quyết 1196/NQ-UBTVQH15 và 1198/NQ-UBTVQH15 (sắp xếp năm 2024); danh mục đơn vị hành chính của tỉnh Khánh Hòa.'}
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
