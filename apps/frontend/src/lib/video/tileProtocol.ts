'use client';
import maplibregl from 'maplibre-gl';

/**
 * ══ TẢI ẢNH BẢN ĐỒ CÓ THỬ LẠI VÀ CÓ KHO RIÊNG ══
 *
 * Vấn đề thật đã gặp: máy chủ ảnh công cộng thỉnh thoảng trả lỗi giữa chừng (503 — quá tải).
 * Bình thường bản đồ gặp lỗi là đánh dấu tấm ảnh đó "hỏng" rồi bỏ luôn, để lại một ô trống
 * giữa khung hình. Đang dựng video thì ô trống đó nằm vĩnh viễn trong file xuất ra.
 *
 * Ở đây bọc lại việc tải ảnh: lỗi thì THỬ LẠI 4 lần, mỗi lần chờ lâu hơn (0,25s → 0,5s → 1s → 2s),
 * gần như không bao giờ để thủng một ô. Tải được rồi thì cất vào kho riêng của trình duyệt,
 * nên **dựng lại lần hai gần như không phải tải gì nữa** — đây là lý do render lần sau nhanh hẳn.
 *
 * Cách dùng: viết địa chỉ ảnh thành `cached://https://…/{z}/{x}/{y}.png`.
 * Điều kiện: máy chủ ảnh phải cho phép tải chéo miền (đã kiểm: Esri, EOX và máy chủ nhà đều cho).
 */

const TEN_KHO = 'camlam-video-tiles-v1';
let daDangKy = false;

export function dangKyTaiAnhCoThuLai(tenKho = TEN_KHO): void {
  if (daDangKy || typeof window === 'undefined') return;
  daDangKy = true;
  try {
    (maplibregl as any).addProtocol('cached', async (thamSo: any, huy: any) => {
      const url = String(thamSo.url).replace(/^cached:\/\//, '');
      const kho = typeof caches !== 'undefined' ? await caches.open(tenKho).catch(() => null) : null;
      const coSan = kho ? await kho.match(url).catch(() => null) : null;
      if (coSan) return { data: await coSan.arrayBuffer() };

      let loiCuoi: unknown = null;
      for (let lan = 0; lan < 4; lan++) {
        try {
          const res = await fetch(url, { signal: huy?.signal });
          // 204/404 nghĩa là "vùng này vốn không có ảnh" — trả rỗng, đừng thử lại cho phí công.
          if (res.status === 204 || res.status === 404) return { data: new ArrayBuffer(0) };
          if (!res.ok) throw new Error('HTTP ' + res.status);
          if (kho) kho.put(url, res.clone()).catch(() => { /* kho đầy thì thôi, không sao */ });
          return { data: await res.arrayBuffer() };
        } catch (e) {
          loiCuoi = e;
          if (huy?.signal?.aborted) throw e;               // bản đồ đã bỏ tấm này (bay đi chỗ khác)
          await new Promise((r) => setTimeout(r, 250 * Math.pow(2, lan)));
        }
      }
      throw loiCuoi;
    });
  } catch { daDangKy = false; }
}

/** Bọc một danh sách địa chỉ ảnh để chúng đi qua đường tải có thử lại ở trên. */
export function boc(dsUrl: string[]): string[] {
  return dsUrl.map((u) => (u.startsWith('cached://') || !/^https?:\/\//i.test(u) ? u : 'cached://' + u));
}

/**
 * Tải một tấm ảnh rồi CẤT VÀO ĐÚNG KHO mà đường tải `cached://` sẽ đọc.
 * Bộ "nạp ảnh trước" (tilePrefetch) gọi hàm này, nhờ vậy ảnh nó lấy về nằm đúng chỗ bản đồ tìm —
 * nếu vẫn tải bằng thẻ ảnh như cũ thì hai bên dùng hai kho khác nhau, nạp trước thành công cốc.
 */
export async function taiVaoKho(url: string, tenKho = TEN_KHO): Promise<void> {
  try {
    const kho = typeof caches !== 'undefined' ? await caches.open(tenKho).catch(() => null) : null;
    if (kho && await kho.match(url).catch(() => null)) return;      // đã có rồi thì thôi
    const res = await fetch(url);
    if (res.ok && kho) await kho.put(url, res.clone()).catch(() => { /* kho đầy thì bỏ qua */ });
  } catch { /* mạng lỗi thì thôi — lúc quay đường tải chính sẽ tự thử lại */ }
}

/** Xoá kho ảnh (dùng khi cần lấy lại ảnh mới, hoặc khi máy báo hết chỗ). */
export async function xoaKhoAnh(tenKho = TEN_KHO): Promise<void> {
  try { if (typeof caches !== 'undefined') await caches.delete(tenKho); } catch { /* ignore */ }
}
