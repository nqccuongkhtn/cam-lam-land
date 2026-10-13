import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import AreaMap from '@/components/AreaMap';
import { ldJson } from '@/lib/jsonld';
import { SITE } from '@/lib/tenMien';
import { AREAS } from '@/lib/seoLanding';
import {
  timTrang, TAT_CA_SLUG, tenMoi, tenCu, tenHuyen, hoaDau, noiDs, khoangTo, urlBanDo, xaCuCua, huyenCuaXaCu, xaMoiCuaHuyen,
  xaCuCuaHuyen, xaMoiCungKhuVuc, XA_MOI_THEO_ID, HUYEN_THEO_ID, QH_CAN_CU, type XaMoi, type XaCu, type HuyenCu,
} from '@/lib/diaDanh';

// TRANG ĐỊA DANH (13/10/2026) — mỗi xã/phường mới, xã cũ, huyện cũ một trang; xem lib/diaDanh.ts. Dữ liệu tĩnh (sinh từ danh mục
// Sở + Nghị quyết 1667 + bảng đổi số tờ) nên dựng sẵn hết lúc đóng gói, không gọi máy chủ dữ liệu.
export const dynamicParams = false;
export function generateStaticParams() { return TAT_CA_SLUG.map((slug) => ({ slug })); }

const NQ = 'Nghị quyết 1667/NQ-UBTVQH15';
const camLamNhaDat = (ten: string) => AREAS.find((a) => a.name.normalize('NFC').toLowerCase() === ten.normalize('NFC').toLowerCase()) || null;

/** Mức phóng vừa khung xã cho ô bản đồ ~360–1100px × 300px. */
function zoomTheoKhung(b: number[] | null): number {
  if (!b) return 12;
  const s = Math.max(b[2] - b[0], (b[3] - b[1]) * 1.15, 0.01);
  return Math.max(9.5, Math.min(14, Math.log2(420 / s)));
}

// ── tiêu đề + mô tả theo đúng cách người ta gõ tìm ───────────────────────────
function meta(slug: string): { title: string; description: string; h1: string } | null {
  const t = timTrang(slug);
  if (!t) return null;
  if (t.kieu === 'moi') {
    const m = t.x, ten = tenMoi(m);
    const cu = xaCuCua(m).map((g) => tenCu(g.x));
    const gom = cu.length ? `sáp nhập từ ${noiDs(cu.slice(0, 3))}${cu.length > 3 ? '…' : ''}` : 'đơn vị hành chính mới';
    return {
      h1: `${ten}, tỉnh Khánh Hòa`,
      title: `${ten}, Khánh Hòa: bản đồ địa chính${m.coQh ? ', quy hoạch' : ''}, xã cũ sáp nhập`,
      description: `${ten} (Khánh Hòa) ${gom} theo ${NQ}, từ 1/7/2025. Xem bản đồ địa chính từng thửa${m.coQh ? ', quy hoạch sử dụng đất' : ''}${m.soTo.length ? ', bảng số tờ bản đồ mới ↔ cũ' : ''}.`,
    };
  }
  if (t.kieu === 'cu') {
    const c = t.x, h = huyenCuaXaCu(c);
    const vao = c.vao.map((v) => XA_MOI_THEO_ID.get(v.id)).filter(Boolean) as XaMoi[];
    const noi = vao.length ? noiDs(vao.map(tenMoi)) : 'xã mới';
    const st = c.soTo[0];
    return {
      h1: `${hoaDau(tenCu(c))}${h ? `, ${tenHuyen(h)}` : ''} (cũ)`,
      title: `${hoaDau(tenCu(c))}${h ? `, ${tenHuyen(h)}` : ''} (cũ) nay thuộc ${noi}`,
      description: `${hoaDau(tenCu(c))}${h ? ` (${tenHuyen(h)} cũ, ${h.tinhCu})` : ''} ${c.vao[0]?.qua ? `nhập vào ${c.vao[0].qua}, từ 1/7/2025 thuộc` : `từ 1/7/2025 ${c.vao.some((v) => v.phan === 'mot-phan') ? 'được chia cho' : 'nhập vào'}`} ${noi}${c.vao[0]?.qua ? '' : ` theo ${NQ}`}.${st && !(st.toCuTu === st.toMoiTu && st.toCuDen === st.toMoiDen) ? ` Tờ bản đồ ${st.toCuTu}–${st.toCuDen} cũ nay là ${khoangTo(st.toMoiTu, st.toMoiDen)}.` : ''} Xem bản đồ địa chính, tra thửa đất.`,
    };
  }
  const h = t.x;
  const moi = xaMoiCuaHuyen(h).map(tenMoi);
  return {
    h1: `${hoaDau(tenHuyen(h))} (cũ), tỉnh ${h.tinhCu}`,
    title: `${hoaDau(tenHuyen(h))} (cũ), ${h.tinhCu}: các xã cũ nay thuộc xã mới nào`,
    description: `${hoaDau(tenHuyen(h))} (${h.tinhCu} cũ) không còn từ 1/7/2025. ${xaCuCuaHuyen(h).length} xã, phường, thị trấn cũ nay thuộc ${noiDs(moi.slice(0, 4))}${moi.length > 4 ? '…' : ''}. Tra bản đồ địa chính từng xã.`,
  };
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const m = meta(params.slug);
  if (!m) return { title: 'Bản đồ xã, phường Khánh Hòa' };
  const url = `/ban-do/${params.slug}`;
  return {
    title: m.title, description: m.description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: m.title, description: m.description, url: `${SITE}${url}`, images: [{ url: '/icons/icon-512.png' }] },
    twitter: { card: 'summary', title: m.title, description: m.description },
  };
}

// ── mảnh giao diện dùng chung ───────────────────────────────────────────────
const the = 'rounded-xl border border-slate-200 bg-white p-4 sm:p-5';
const h2 = 'text-[17px] sm:text-lg font-bold text-[#0A2540]';
const nutChinh = 'inline-flex items-center gap-1.5 rounded-xl bg-[#0A2540] px-4 py-2 text-[13.5px] font-bold text-white hover:bg-[#0d2f54]';
const nutPhu = 'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13.5px] font-bold text-[#0A2540] hover:border-[#C8A14B]';
const chip = 'rounded-full bg-slate-100 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-[#C8A14B]/20';
const LkCu = ({ c }: { c: XaCu }) => <Link href={`/ban-do/${c.slug}`} className="font-semibold text-[#0A2540] underline decoration-slate-300 underline-offset-2 hover:decoration-[#C8A14B]">{tenCu(c)}</Link>;
const LkMoi = ({ m }: { m: XaMoi }) => <Link href={`/ban-do/${m.slug}`} className="font-semibold text-[#0A2540] underline decoration-slate-300 underline-offset-2 hover:decoration-[#C8A14B]">{tenMoi(m)}</Link>;
const LkHuyen = ({ h }: { h: HuyenCu }) => <Link href={`/ban-do/${h.slug}`} className="text-slate-600 underline decoration-slate-300 underline-offset-2 hover:decoration-[#C8A14B]">{tenHuyen(h)}</Link>;

function DuongDan({ ds }: { ds: { ten: string; href?: string }[] }) {
  return (
    <nav aria-label="Đường dẫn" className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
      {ds.map((d, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span>›</span>}
          {d.href ? <Link href={d.href} className="hover:text-[#C8A14B]">{d.ten}</Link> : <span className="font-medium text-slate-700">{d.ten}</span>}
        </span>
      ))}
    </nav>
  );
}

function HoiDap({ ds }: { ds: { q: string; a: string }[] }) {
  return (
    <section className="mt-6">
      <h2 className={h2}>Câu hỏi thường gặp</h2>
      <div className="mt-3 space-y-2.5">
        {ds.map((f, i) => (
          <details key={i} className="group rounded-xl border border-slate-200 bg-white p-4" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-[#0A2540]">{f.q}<span className="text-[#C8A14B] transition group-open:rotate-45">＋</span></summary>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ldTrang(duong: { ten: string; href?: string }[], noiChon: Record<string, unknown> | null, hoi: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: duong.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.ten, ...(d.href ? { item: `${SITE}${d.href}` } : {}) })) },
      ...(noiChon ? [noiChon] : []),
      { '@type': 'FAQPage', mainEntity: hoi.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };
}

// ══ TRANG XÃ / PHƯỜNG MỚI ══════════════════════════════════════════════════
function TrangXaMoi({ m }: { m: XaMoi }) {
  const ten = tenMoi(m);
  const cu = xaCuCua(m);
  const toanBo = cu.filter((g) => g.phan === 'toan-bo').map((g) => tenCu(g.x));
  const motPhan = cu.filter((g) => g.phan === 'mot-phan').map((g) => tenCu(g.x));
  const huyen = m.huyenCu.map((id) => HUYEN_THEO_ID.get(id)).filter(Boolean) as HuyenCu[];
  const lanCan = xaMoiCungKhuVuc(m);
  const nhaDat = camLamNhaDat(`xã ${m.ten}`);
  const goc = m.donViGoc ? cu.find((g) => g.x.laGoc)?.x || null : null;
  const tongTo = m.soTo.length ? Math.max(...m.soTo.map((r) => r.toMoiDen)) : 0;
  const mo = `${ten} được thành lập từ ngày 1/7/2025 theo ${NQ}`;
  const cauGom = [
    toanBo.length ? `toàn bộ ${noiDs(toanBo)}` : '',
    motPhan.length ? `một phần ${noiDs(motPhan)}` : '',
  ].filter(Boolean).join(' và ');

  const hoi = [
    { q: `${ten} gồm những xã, phường cũ nào?`,
      a: cauGom ? `Theo ${NQ}, ${ten} được sắp xếp từ ${cauGom}.${m.gomCungTen ? ` ${hoaDau(m.gomCungTen.ten)} giữ nguyên tên gọi.` : ''}`
        : `${ten} giữ tên của đơn vị cũ cùng tên${m.gomCungTen ? ` (${m.gomCungTen.ten})` : ''}; xem nguyên văn ${NQ} để biết phần nhập thêm.` },
    { q: `${ten} trước đây thuộc huyện nào?`,
      a: `Trước 1/7/2025, các đơn vị cũ hợp thành ${ten} thuộc ${noiDs(huyen.map((h) => `${tenHuyen(h)} (tỉnh ${h.tinhCu} cũ)`))}. Từ 1/7/2025 không còn cấp huyện; ${ten} trực thuộc tỉnh Khánh Hòa.` },
    ...(m.soTo.length ? [{ q: `Số tờ bản đồ địa chính của ${ten} thay đổi thế nào sau sáp nhập?`,
      a: `${ten} đánh lại số tờ liên tục từ 1 đến ${tongTo}. ${m.soTo.slice(0, 4).map((r) => r.giuSo ? `${hoaDau(r.tenXaCu)} giữ nguyên ${khoangTo(r.toCuTu, r.toCuDen)}` : `${hoaDau(r.tenXaCu)} ${khoangTo(r.toCuTu, r.toCuDen)} thành ${khoangTo(r.toMoiTu, r.toMoiDen)}`).join('; ')}${m.soTo.length > 4 ? '; …' : ''}. Tra từng tờ, từng thửa trên bản đồ của Cam Lâm Land.` }] : []),
    { q: `Tra cứu bản đồ địa chính${m.coQh ? ', quy hoạch' : ''} ${ten} ở đâu?`,
      a: `Mở Bản đồ trên Cam Lâm Land, chọn ${ten} (hoặc tên xã cũ) rồi nhập số tờ, số thửa — hoặc bấm thẳng vào thửa trên bản đồ để xem ranh thửa, diện tích${m.coQh ? ', loại đất quy hoạch và xuất phiếu thông tin quy hoạch' : ''}.${m.coQh ? '' : ' Khu vực này hiện chưa có dữ liệu quy hoạch trên Cam Lâm Land.'}` },
  ];
  const duong = [{ ten: 'Trang chủ', href: '/' }, { ten: 'Bản đồ Khánh Hòa', href: '/ban-do' }, { ten }];
  const noiChon = {
    '@type': 'AdministrativeArea', name: `${ten}, tỉnh Khánh Hòa`, url: `${SITE}/ban-do/${m.slug}`,
    containedInPlace: { '@type': 'AdministrativeArea', name: 'Tỉnh Khánh Hòa' },
    ...(m.tam ? { geo: { '@type': 'GeoCoordinates', longitude: m.tam[0], latitude: m.tam[1] } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ldTrang(duong, noiChon, hoi)) }} />
      <DuongDan ds={duong} />
      <h1 className="text-2xl font-extrabold leading-tight text-[#0A2540] sm:text-3xl">{ten}, tỉnh Khánh Hòa</h1>
      <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-slate-600">
        {mo}{cauGom ? <>, sắp xếp từ {cauGom}</> : ''}.{goc ? <> {ten} kế thừa mã đơn vị hành chính của {tenCu(goc)} (đơn vị gốc).</> : ''}
        {' '}Trang này giúp tra {ten} theo cả <b>tên mới</b> lẫn <b>tên cũ</b> trước sáp nhập: mở bản đồ địa chính từng thửa
        {m.coQh ? ', xem quy hoạch' : ''}{m.soTo.length ? ', đối chiếu số tờ bản đồ mới ↔ cũ' : ''}.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {m.coBanDo && <Link href={urlBanDo(m.id)} className={nutChinh}>🗺️ Mở bản đồ thửa đất {ten}</Link>}
        {m.soTo.length > 0 && <Link href="/tra-so-ban-do" className={nutPhu}>🔢 Tra số tờ mới ↔ cũ</Link>}
        {nhaDat && <Link href={`/nha-dat/${nhaDat.slug}`} className={nutPhu}>🏠 Nhà đất {ten}</Link>}
      </div>

      {m.tam && (
        <div className="mt-5">
          <AreaMap center={[m.tam[0], m.tam[1]]} zoom={zoomTheoKhung(m.bbox)} moreHref={m.coBanDo ? urlBanDo(m.id) : '/map'} title={`Bản đồ ${ten}`} />
        </div>
      )}

      <section className={`mt-6 ${the}`}>
        <h2 className={h2}>{ten} gồm những xã, phường cũ nào?</h2>
        {cu.length ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {cu.map(({ x, phan }) => {
              const h = huyenCuaXaCu(x);
              return (
                <li key={x.slug} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-[14px]">
                  <span><LkCu c={x} />{h && <span className="text-slate-500"> · <LkHuyen h={h} /></span>}{x.laGoc && <span className="ml-1.5 rounded-full bg-[#C8A14B]/15 px-2 py-0.5 text-[11.5px] font-semibold text-[#8a6d2a]">đơn vị gốc, giữ mã</span>}</span>
                  <span className={`text-[12.5px] font-semibold ${phan === 'toan-bo' ? 'text-emerald-700' : 'text-amber-700'}`}>{phan === 'toan-bo' ? 'toàn bộ' : 'một phần'}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-slate-600">{ten} giữ nguyên tên đơn vị cũ{m.gomCungTen ? ` (${m.gomCungTen.ten})` : ''}.</p>
        )}
        {m.gomCungTen && cu.length > 0 && <p className="mt-2 text-[13.5px] text-slate-600">Cùng với {m.gomCungTen.ten} ({m.gomCungTen.phan === 'toan-bo' ? 'toàn bộ' : 'một phần'}) — đơn vị cũ cùng tên, nay giữ nguyên tên gọi.</p>}
        {m.nguyenVan && <blockquote className="mt-3 border-l-[3px] border-[#C8A14B] bg-amber-50/50 px-3 py-2 text-[13px] italic leading-relaxed text-slate-600">“{m.nguyenVan}” — {NQ}</blockquote>}
      </section>

      {m.soTo.length > 0 && (
        <section className={`mt-5 ${the}`}>
          <h2 className={h2}>Đánh số lại tờ bản đồ địa chính sau sáp nhập</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
            {ten} đánh số tờ liên tục từ 1 đến {tongTo}: đơn vị gốc giữ nguyên số tờ, các xã cũ còn lại nối tiếp theo từng khối.
            Sổ đỏ cấp trước sáp nhập vẫn ghi <b>số tờ cũ</b> — đối chiếu bảng dưới để biết số tờ mới.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[13.5px] [font-variant-numeric:tabular-nums]">
              <thead><tr className="border-b border-slate-200 text-[12px] uppercase tracking-wide text-slate-500"><th className="py-2 pr-3 font-semibold">Xã, phường cũ</th><th className="py-2 pr-3 font-semibold">Số tờ cũ</th><th className="py-2 pr-3 font-semibold">Số tờ mới</th><th className="py-2 font-semibold">Số tờ</th></tr></thead>
              <tbody>
                {m.soTo.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{r.xaCu ? <Link href={`/ban-do/${r.xaCu}`} className="font-semibold text-[#0A2540] hover:underline">{r.tenXaCu}</Link> : <span className="font-semibold text-[#0A2540]">{r.tenXaCu}</span>}</td>
                    <td className="py-2 pr-3">{r.toCuTu === r.toCuDen ? r.toCuTu : `${r.toCuTu}–${r.toCuDen}`}</td>
                    <td className="py-2 pr-3 font-semibold text-[#0A2540]">{r.giuSo ? 'giữ nguyên' : (r.toMoiTu === r.toMoiDen ? r.toMoiTu : `${r.toMoiTu}–${r.toMoiDen}`)}</td>
                    <td className="py-2 text-slate-500">{r.soTo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-slate-500">Theo bảng đối chiếu số tờ bản đồ của Văn phòng Đăng ký đất đai. Xã cũ bị chia có thể đứt quãng số tờ (chỉ mang sang những tờ thuộc phần đất của mình).</p>
        </section>
      )}

      <section className={`mt-5 ${the}`}>
        <h2 className={h2}>{m.coQh ? `Quy hoạch ${ten}` : `Bản đồ địa chính ${ten}`}</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">
          {m.coQh
            ? <>Khu vực thuộc huyện Cam Lâm cũ có dữ liệu quy hoạch trên Cam Lâm Land: {QH_CAN_CU}. Bấm vào từng thửa trên bản đồ để xem loại đất, diện tích từng phần quy hoạch và xuất phiếu thông tin quy hoạch.</>
            : <>Bản đồ địa chính toàn bộ {ten} đã có trên Cam Lâm Land: bấm vào thửa để xem ranh thửa, số tờ, số thửa, diện tích; hoặc nhập số tờ, số thửa để tìm. Khu vực này <b>chưa có dữ liệu quy hoạch</b> trên Cam Lâm Land.</>}
        </p>
        {m.coBanDo && <div className="mt-3"><Link href={urlBanDo(m.id)} className={nutPhu}>Mở bản đồ {ten} →</Link></div>}
      </section>

      <HoiDap ds={hoi} />

      <section className="mt-6 border-t border-slate-200 pt-5">
        {huyen.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-[15px] font-bold text-[#0A2540]">Trước sáp nhập thuộc</h3>
            <div className="flex flex-wrap gap-2">{huyen.map((h) => <Link key={h.slug} href={`/ban-do/${h.slug}`} className={chip}>{hoaDau(tenHuyen(h))} (cũ)</Link>)}</div>
          </div>
        )}
        {lanCan.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-[15px] font-bold text-[#0A2540]">Xã, phường cùng khu vực</h3>
            <div className="flex flex-wrap gap-2">{lanCan.map((x) => <Link key={x.slug} href={`/ban-do/${x.slug}`} className={chip}>{tenMoi(x)}</Link>)}</div>
          </div>
        )}
        <Link href="/ban-do" className="text-[14px] font-semibold text-[#C8A14B] hover:underline">Xem đủ 65 xã, phường tỉnh Khánh Hòa →</Link>
      </section>
    </>
  );
}

// ══ TRANG XÃ CŨ ════════════════════════════════════════════════════════════
function TrangXaCu({ c }: { c: XaCu }) {
  const ten = hoaDau(tenCu(c));
  const h = huyenCuaXaCu(c);
  const vao = c.vao.map((v) => ({ m: XA_MOI_THEO_ID.get(v.id)!, phan: v.phan, qua: v.qua })).filter((v) => v.m);
  const chia = vao.length > 1 || vao.some((v) => v.phan === 'mot-phan');
  const anhEm = h ? xaCuCuaHuyen(h).filter((x) => x.slug !== c.slug) : [];
  const nhaDat = c.coQh ? camLamNhaDat(c.ten) : null;
  const maBanDo = c.maBanDo || (vao[0]?.m.coBanDo ? vao[0].m.id : '');
  const tenNoi = noiDs(vao.map((v) => tenMoi(v.m)));
  const caiDau = c.soTo.find((r) => !(r.toCuTu === r.toMoiTu && r.toCuDen === r.toMoiDen));

  const hoi = [
    { q: `${ten} nay là xã, phường nào?`,
      a: vao[0]?.qua ? `${hoaDau(tenCu(c))} đã nhập vào ${vao[0].qua}. Từ 1/7/2025, theo ${NQ}, đơn vị đó thuộc ${tenMoi(vao[0].m)}, tỉnh Khánh Hòa.`
        : vao.length ? (chia ? `Từ 1/7/2025, theo ${NQ}, ${tenCu(c)} được chia: ${vao.map((v) => `${v.phan === 'mot-phan' ? 'một phần' : 'toàn bộ'} vào ${tenMoi(v.m)}`).join('; ')}.`
        : `Từ 1/7/2025, theo ${NQ}, toàn bộ ${tenCu(c)} nhập vào ${tenMoi(vao[0].m)}, tỉnh Khánh Hòa.${c.laGoc ? ` ${tenMoi(vao[0].m)} kế thừa mã đơn vị hành chính của ${tenCu(c)}.` : ''}`)
        : `Xem ${NQ} để biết ${tenCu(c)} nay thuộc đơn vị nào.` },
    ...(h ? [{ q: `${ten} trước đây thuộc huyện nào?`, a: `${ten} thuộc ${tenHuyen(h)}, tỉnh ${h.tinhCu} (cũ). Từ 1/7/2025 không còn cấp huyện.` }] : []),
    ...(c.soTo.length ? [{ q: `Số tờ bản đồ ${tenCu(c)} sau sáp nhập là bao nhiêu?`,
      a: c.soTo.map((r) => { const m = XA_MOI_THEO_ID.get(r.xaMoi); const giu = r.toCuTu === r.toMoiTu && r.toCuDen === r.toMoiDen;
        return giu ? `Giữ nguyên số tờ ${r.toCuTu}–${r.toCuDen}${m ? ` trong ${tenMoi(m)}` : ''}` : `${hoaDau(khoangTo(r.toCuTu, r.toCuDen))} cũ nay là ${khoangTo(r.toMoiTu, r.toMoiDen)}${m ? ` của ${tenMoi(m)}` : ''}`; }).join('; ') + '. Sổ đỏ cấp trước sáp nhập vẫn ghi số tờ cũ.' }] : []),
    { q: `Xem bản đồ địa chính ${tenCu(c)} ở đâu?`,
      a: `Mở Bản đồ trên Cam Lâm Land, chọn "3 cấp" rồi chọn ${tenCu(c)}${vao.length ? ` (hoặc chọn ${tenMoi(vao[0].m)} ở "2 cấp")` : ''}, nhập số tờ, số thửa — hoặc bấm thẳng vào thửa trên bản đồ.${c.coQh ? ' Khu vực có dữ liệu quy hoạch, bấm vào thửa để xem loại đất quy hoạch.' : ''}` },
  ];
  const duong = [{ ten: 'Trang chủ', href: '/' }, { ten: 'Bản đồ Khánh Hòa', href: '/ban-do' },
    ...(h ? [{ ten: `${hoaDau(tenHuyen(h))} (cũ)`, href: `/ban-do/${h.slug}` }] : []), { ten }];
  const noiChon = {
    '@type': 'AdministrativeArea', name: `${ten}${h ? `, ${tenHuyen(h)}` : ''} (cũ)`, url: `${SITE}/ban-do/${c.slug}`,
    ...(h ? { containedInPlace: { '@type': 'AdministrativeArea', name: `${hoaDau(tenHuyen(h))}, tỉnh ${h.tinhCu}` } } : {}),
    ...(c.tam ? { geo: { '@type': 'GeoCoordinates', longitude: c.tam[0], latitude: c.tam[1] } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ldTrang(duong, noiChon, hoi)) }} />
      <DuongDan ds={duong} />
      <h1 className="text-2xl font-extrabold leading-tight text-[#0A2540] sm:text-3xl">{ten}{h ? `, ${tenHuyen(h)}` : ''} <span className="text-slate-400">(cũ)</span></h1>
      {vao.length > 0 && (
        <div className="mt-3 rounded-xl border-l-4 border-[#C8A14B] bg-amber-50/60 p-4 text-[14.5px] leading-relaxed text-slate-700">
          {vao[0].qua
            ? <>{hoaDau(tenCu(c))} đã nhập vào <b>{vao[0].qua}</b>. Từ <b>1/7/2025</b>, đơn vị đó thuộc <LkMoi m={vao[0].m} />, tỉnh Khánh Hòa — theo {NQ}.</>
            : chia
            ? <>Từ <b>1/7/2025</b>, {tenCu(c)} được <b>chia</b> cho {vao.map((v, i) => <span key={v.m.id}>{i > 0 && (i === vao.length - 1 ? ' và ' : ', ')}<LkMoi m={v.m} /> ({v.phan === 'mot-phan' ? 'một phần' : 'toàn bộ'})</span>)}, tỉnh Khánh Hòa — theo {NQ}.</>
            : <>Từ <b>1/7/2025</b>, toàn bộ {tenCu(c)} nhập vào <LkMoi m={vao[0].m} />, tỉnh Khánh Hòa — theo {NQ}.{c.laGoc ? <> {tenMoi(vao[0].m)} kế thừa mã đơn vị hành chính của {tenCu(c)}.</> : null}</>}
        </div>
      )}
      <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-slate-600">
        Người dân vẫn quen gọi theo tên cũ, sổ đỏ cấp trước sáp nhập vẫn ghi {tenCu(c)}{h ? `, ${tenHuyen(h)}` : ''}. Trang này nối tên cũ với
        đơn vị mới để tra đúng chỗ: mở bản đồ địa chính{c.soTo.length ? ', đổi số tờ cũ sang số tờ mới' : ''}{c.coQh ? ', xem quy hoạch' : ''}.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {maBanDo && <Link href={urlBanDo(maBanDo)} className={nutChinh}>🗺️ Mở bản đồ {tenCu(c)}</Link>}
        {vao.map((v) => <Link key={v.m.id} href={`/ban-do/${v.m.slug}`} className={nutPhu}>📍 {tenMoi(v.m)} (mới)</Link>)}
        {nhaDat && <Link href={`/nha-dat/${nhaDat.slug}`} className={nutPhu}>🏠 Nhà đất {c.ten}</Link>}
      </div>

      {c.tam && (
        <div className="mt-5">
          <AreaMap center={[c.tam[0], c.tam[1]]} zoom={13} moreHref={maBanDo ? urlBanDo(maBanDo) : '/map'} title={`Bản đồ ${tenCu(c)}`} />
        </div>
      )}

      {c.soTo.length > 0 && (
        <section className={`mt-5 ${the}`}>
          <h2 className={h2}>Số tờ bản đồ {tenCu(c)} sau sáp nhập</h2>
          <ul className="mt-2 space-y-1.5 text-[14px] text-slate-700">
            {c.soTo.map((r, i) => {
              const m = XA_MOI_THEO_ID.get(r.xaMoi);
              const giu = r.toCuTu === r.toMoiTu && r.toCuDen === r.toMoiDen;
              return (
                <li key={i} className="[font-variant-numeric:tabular-nums]">
                  {giu ? <>Giữ nguyên <b>{khoangTo(r.toCuTu, r.toCuDen)}</b></> : <><b>{hoaDau(khoangTo(r.toCuTu, r.toCuDen))}</b> cũ → <b className="text-[#0A2540]">{khoangTo(r.toMoiTu, r.toMoiDen)}</b></>}
                  {m && <> của <LkMoi m={m} /></>} <span className="text-slate-500">({r.soTo} tờ)</span>
                </li>
              );
            })}
          </ul>
          {caiDau && <p className="mt-2 text-[12.5px] text-slate-500">Ví dụ: thửa ghi “tờ {caiDau.toCuTu}” trên sổ cũ, nay tra theo tờ {caiDau.toMoiTu} của đơn vị mới. Tờ bị ranh xã mới cắt qua có thể mang hai số mới khác nhau.</p>}
        </section>
      )}

      <HoiDap ds={hoi} />

      <section className="mt-6 border-t border-slate-200 pt-5">
        {h && anhEm.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-[15px] font-bold text-[#0A2540]">Xã, phường, thị trấn cũ khác của {tenHuyen(h)}</h3>
            <div className="flex flex-wrap gap-2">{anhEm.map((x) => <Link key={x.slug} href={`/ban-do/${x.slug}`} className={chip}>{hoaDau(tenCu(x))}</Link>)}</div>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[14px] font-semibold">
          {h && <Link href={`/ban-do/${h.slug}`} className="text-[#C8A14B] hover:underline">{hoaDau(tenHuyen(h))} cũ nay gồm những xã nào →</Link>}
          <Link href="/ban-do" className="text-[#C8A14B] hover:underline">65 xã, phường tỉnh Khánh Hòa →</Link>
        </div>
      </section>
    </>
  );
}

// ══ TRANG HUYỆN CŨ ═════════════════════════════════════════════════════════
function TrangHuyen({ h }: { h: HuyenCu }) {
  const ten = hoaDau(tenHuyen(h));
  const cu = xaCuCuaHuyen(h);
  const moi = xaMoiCuaHuyen(h);
  const huyenKhac = [...HUYEN_THEO_ID.values()].filter((x) => x.slug !== h.slug && x.tinhCu === h.tinhCu);
  const hoi = [
    { q: `${ten} còn không?`, a: `Từ 1/7/2025, cả nước bỏ cấp huyện. ${ten} (tỉnh ${h.tinhCu} cũ) không còn; các xã, phường, thị trấn của huyện được sắp xếp thành ${noiDs(moi.map(tenMoi))} trực thuộc tỉnh Khánh Hòa, theo ${NQ}.` },
    { q: `${ten} cũ nay gồm những xã, phường nào?`, a: moi.length ? `Đất của ${tenHuyen(h)} cũ nay thuộc: ${noiDs(moi.map(tenMoi))}.` : `Xem ${NQ}.` },
    { q: `Tra bản đồ địa chính các xã thuộc ${tenHuyen(h)} cũ thế nào?`, a: `Mở Bản đồ trên Cam Lâm Land, chọn "3 cấp" để tra theo xã cũ của ${tenHuyen(h)}, hoặc "2 cấp" để tra theo xã mới; nhập số tờ, số thửa hoặc bấm thẳng vào thửa.` },
  ];
  const duong = [{ ten: 'Trang chủ', href: '/' }, { ten: 'Bản đồ Khánh Hòa', href: '/ban-do' }, { ten: `${ten} (cũ)` }];
  const noiChon = { '@type': 'AdministrativeArea', name: `${ten}, tỉnh ${h.tinhCu} (cũ)`, url: `${SITE}/ban-do/${h.slug}` };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ldTrang(duong, noiChon, hoi)) }} />
      <DuongDan ds={duong} />
      <h1 className="text-2xl font-extrabold leading-tight text-[#0A2540] sm:text-3xl">{ten} <span className="text-slate-400">(cũ)</span>, tỉnh {h.tinhCu}</h1>
      <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-slate-600">
        Từ 1/7/2025 không còn cấp huyện. {cu.length} xã, phường, thị trấn của {tenHuyen(h)} cũ được sắp xếp vào {noiDs(moi.map(tenMoi))}, tỉnh Khánh Hòa
        (theo {NQ}). Bảng dưới cho biết từng xã cũ nay thuộc đơn vị nào.
      </p>
      <section className={`mt-5 ${the}`}>
        <h2 className={h2}>Xã cũ nay thuộc xã, phường mới nào</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[14px]">
            <thead><tr className="border-b border-slate-200 text-[12px] uppercase tracking-wide text-slate-500"><th className="py-2 pr-3 font-semibold">Trước 1/7/2025</th><th className="py-2 font-semibold">Nay thuộc</th></tr></thead>
            <tbody>
              {cu.map((x) => (
                <tr key={x.slug} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3"><LkCu c={x} /></td>
                  <td className="py-2">{x.vao.length ? x.vao.map((v, i) => { const m = XA_MOI_THEO_ID.get(v.id); return m ? <span key={v.id}>{i > 0 && ', '}<LkMoi m={m} />{v.phan === 'mot-phan' && <span className="text-[12px] text-amber-700"> (một phần)</span>}</span> : null; }) : <span className="text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <HoiDap ds={hoi} />
      <section className="mt-6 border-t border-slate-200 pt-5">
        <div className="mb-4">
          <h3 className="mb-2 text-[15px] font-bold text-[#0A2540]">Xã, phường mới trên đất {tenHuyen(h)} cũ</h3>
          <div className="flex flex-wrap gap-2">{moi.map((m) => <Link key={m.slug} href={`/ban-do/${m.slug}`} className={chip}>{tenMoi(m)}</Link>)}</div>
        </div>
        {huyenKhac.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-[15px] font-bold text-[#0A2540]">Huyện, thị xã, thành phố khác của tỉnh {h.tinhCu} cũ</h3>
            <div className="flex flex-wrap gap-2">{huyenKhac.map((x) => <Link key={x.slug} href={`/ban-do/${x.slug}`} className={chip}>{hoaDau(tenHuyen(x))}</Link>)}</div>
          </div>
        )}
        <Link href="/ban-do" className="text-[14px] font-semibold text-[#C8A14B] hover:underline">65 xã, phường tỉnh Khánh Hòa →</Link>
      </section>
    </>
  );
}

export default function Page({ params }: { params: { slug: string } }) {
  const t = timTrang(params.slug);
  if (!t) notFound();
  return (
    <>
      <div className="mx-auto max-w-4xl px-3 py-5 sm:px-4 sm:py-7">
        {t.kieu === 'moi' ? <TrangXaMoi m={t.x} /> : t.kieu === 'cu' ? <TrangXaCu c={t.x} /> : <TrangHuyen h={t.x} />}
      </div>
      <SiteFooter />
    </>
  );
}
