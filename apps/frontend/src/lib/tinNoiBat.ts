// Chọn "TIN NỔI BẬT" — dùng CHUNG cho trang chủ (tab "Tin nổi bật") và trang /tin-tuc (tin chính + khung "🔥 Nổi bật"),
// để hai nơi luôn hiện cùng một bộ tin (chủ dự án 10/10/2026: "tin nổi bật bên tin tức chưa cập nhật phù hợp với trang chủ").
// Quy tắc (chủ dự án chốt 7/10/2026: "tin nổi bật chỉ nói về Cam Lâm thôi"):
//   1) tin nhắc thẳng Cam Lâm / Bãi Dài / các xã Cam Lâm (gồm bài Cam Lâm Land biên tập) — mới nhất lên đầu;
//   2) các bài ghim về Đô thị mới Cam Lâm (QĐ 205…);
//   3) CHỈ KHI còn thiếu (< 6 bài) mới chèn tin VỊNH CAM RANH / sân bay Cam Ranh (sát dự án Cam Lâm — chủ dự án
//      "du di" được). Tin BĐS chung chung (vd "TP.HCM đề nghị công ty địa ốc khai báo…") TUYỆT ĐỐI không lấy.
const chu = (n: any) => (n.title || '') + ' ' + (n.summary || '');
const CAM_LAM = /cam lâm|bãi dài|cam đức|cam hải|suối dầu|suối tân|suối cát|cam hiệp|cam an |cam thành bắc|cam hòa|cam tân|đô thị sân bay/i;
const SAT_CAM_LAM = /vịnh cam ranh|sân bay (quốc tế )?cam ranh|bán đảo cam ranh/i;
const theoNgay = (a: any, b: any) => +new Date(b.publishedAt || 0) - +new Date(a.publishedAt || 0);

export function chonTinNoiBat<T extends { slug: string; pin?: boolean; order?: number; publishedAt?: string }>(raw: T[], toiDa = 8): T[] {
  const t1 = raw.filter((n) => !n.pin && CAM_LAM.test(chu(n))).sort(theoNgay);
  const t2 = raw.filter((n) => n.pin).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || theoNgay(a, b));
  const t3 = raw.filter((n) => !n.pin && !CAM_LAM.test(chu(n)) && SAT_CAM_LAM.test(chu(n))).sort(theoNgay);
  const daCo = new Set<string>(); const out: T[] = [];
  const them = (ds: T[], tran: number) => { for (const n of ds) { if (out.length >= tran || daCo.has(n.slug)) continue; daCo.add(n.slug); out.push(n); } };
  them(t1, toiDa); them(t2, toiDa); them(t3, Math.min(6, toiDa));
  return out;
}
