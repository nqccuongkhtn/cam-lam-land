'use client';
/**
 * ══ CHỜ BẢN ĐỒ VẼ XONG MỘT KHUNG — BẰNG CÁCH HỎI, KHÔNG PHẢI BẰNG CÁCH NHÌN ══
 *
 * Cách CŨ (vẫn giữ trong page.tsx, nay chỉ dùng khi cần soi lỗi): chụp thu nhỏ khung hình rồi
 * SO TỪNG ĐIỂM ẢNH giữa hai lượt, giống nhau thì coi là vẽ xong. Cách đó đúng nhưng rất đắt:
 * mỗi lần so là một lần kéo ảnh từ card đồ hoạ ngược về máy, ép card dừng lại chờ — mà một khung
 * phải so tới hàng chục lần. Thành ra dựng một video ngắn cũng mất hàng phút.
 *
 * Cách MỚI ở đây: hỏi thẳng bản đồ hai câu — "ảnh tải đủ chưa" và "kiểu vẽ dựng xong chưa".
 * Bản đồ tự biết rõ hơn ai hết. Hỏi thì gần như không tốn gì, nên trần chờ hạ được từ 3 giây
 * xuống 0,9 giây mà vẫn chắc ăn. Đây đúng cách các phần mềm dựng phim bản đồ làm.
 *
 * Điều kiện để tin được câu trả lời (dự án đã đặt sẵn từ trước):
 *   · `fadeDuration: 0` và `raster-fade-duration: 0` — ảnh hiện NGAY khi tải xong, không mờ dần,
 *     nên "tải xong" cũng là "vẽ xong", không có giai đoạn nhập nhoà ở giữa.
 */

/** Một lượt chờ: trả về true nếu bản đồ báo đã vẽ xong trong thời gian cho phép. */
export function choBanDoYen(map: any, toiDaMs = 900): Promise<boolean> {
  return new Promise((xong) => {
    let daTraLoi = false;
    const ketThuc = (ok: boolean) => {
      if (daTraLoi) return;
      daTraLoi = true;
      clearTimeout(dongHo);
      try { map.off('render', khiVe); map.off('idle', khiRanh); } catch { /* ignore */ }
      xong(ok);
    };
    // Mỗi lần bản đồ vẽ một lượt thì hỏi lại: ảnh đủ chưa, kiểu vẽ xong chưa.
    const khiVe = () => {
      try { if (map.areTilesLoaded() && map.isStyleLoaded()) ketThuc(true); } catch { ketThuc(true); }
    };
    // Bản đồ báo "rảnh rồi" — không còn việc gì để làm nữa.
    const khiRanh = () => { try { ketThuc(map.areTilesLoaded()); } catch { ketThuc(true); } };
    const dongHo = setTimeout(() => ketThuc(false), toiDaMs);
    try {
      map.on('render', khiVe);
      map.once('idle', khiRanh);
      map.triggerRepaint();
    } catch { ketThuc(true); }
  });
}

/** Sổ ghi chất lượng của cả phiên dựng: bao nhiêu khung phải chờ lâu, bao nhiêu khung không kịp. */
export type SoKhung = { choLau: number; thieuAnh: number };

/**
 * Chờ cho MỘT khung hình của video.
 * Lượt đầu chờ ngắn (0,9 giây — đủ cho hầu hết khung vì ảnh đã nạp sẵn từ trước).
 * Chưa xong thì cho thêm một lượt dài hơn. Vẫn chưa xong mới ghi sổ "khung thiếu ảnh" —
 * không im lặng cho qua, cuối phiên còn báo lại cho người dùng biết.
 */
export async function choMotKhung(map: any, so: SoKhung, choDau = 900, choThem = 2500): Promise<boolean> {
  let ok = await choBanDoYen(map, choDau);
  if (!ok) { so.choLau++; ok = await choBanDoYen(map, choThem); }
  if (!ok) so.thieuAnh++;
  return ok;
}
