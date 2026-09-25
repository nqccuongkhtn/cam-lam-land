'use client';
/* ============================================================================
 *  HỎI MÁY CHỦ HÔM NAY CÓ LOGO NGÀY LỄ KHÔNG
 * ----------------------------------------------------------------------------
 *  Tách riêng ra đây vì có HAI chỗ cần dùng và phải giống hệt nhau:
 *    · components/Nav.tsx          — thanh menu chính;
 *    · app/listings/page.tsx       — logo nhỏ ở thanh tìm kiếm dính, hiện ra
 *                                    khi cuộn xuống trên điện thoại.
 *  Trước đây chỉ Nav.tsx có, nên cuộn xuống là MẤT trang trí ngày lễ — chủ dự
 *  án chụp ảnh báo đúng chỗ này.
 *
 *  ⚠️ Hỏng thì im lặng trả về null, tức dùng logo thường. Logo là thứ không
 *     được phép làm vỡ thanh menu.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { API_BASE } from './config';

/** Mã bản logo lễ của hôm nay, vd 'tet'. Không có dịp nào thì trả về null. */
export function useLogoLe(): string | null {
  const [ma, setMa] = useState<string | null>(null);
  useEffect(() => {
    let huy = false;
    fetch(`${API_BASE}/logo-le/hom-nay`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!huy && j?.ma) setMa(String(j.ma)); })
      .catch(() => {});
    return () => { huy = true; };
  }, []);
  return ma;
}
