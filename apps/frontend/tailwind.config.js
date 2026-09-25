/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Brand tokens: use bg-navy / text-gold / border-navy / bg-navy/5 ...
      // Additive: existing arbitrary values (bg-[#0A2540]) still work; migrate gradually.
      colors: {
        // (25/9/2026 đã thử đổi sang xanh cổ vịt rồi trả lại navy — scripts/doi-mau-chu-dao.py, chạy --nguoc)
        navy: '#0A2540', // màu chủ đạo (nền chính, tiêu đề)
        gold: '#C8A14B', // brand gold accent
      },
    },

    /* ══ ĐỘ BO TRÒN GÓC — GOM VỀ MỘT THANG DUY NHẤT ═══════════════════════════
     * VẤN ĐỀ: giao diện đang dùng 13 mức bo góc khác nhau trên 2065 chỗ
     * (4px, 6px, 8px, 12px, 16px, 24px, 2px, 3px, 10px, 11px, 14px…), nên khối
     * nào cũng bo một kiểu, nhìn lộn xộn.
     *
     * ĐO THẬT trên batdongsan.com.vn ngày 22/9/2026 — họ chỉ dùng 4 mức:
     *     0px   (1007 chỗ)  nền, khối, khung trang
     *     4px   (85 chỗ)    thẻ tin, ẢNH trong thẻ, nút chính  ← mức chủ đạo
     *     8px   (20 chỗ)    vài nút phụ
     *     tròn hẳn (35 chỗ) ảnh đại diện, chip/tag
     *
     * CÁCH SỬA: thay vì đi sửa tay 2065 chỗ (rất dễ sót và dễ làm hỏng), chỉ
     * ĐỔI Ý NGHĨA CỦA CÁC MỨC ngay tại đây. Mọi class `rounded-*` đang có giữ
     * nguyên tên, nhưng giá trị gom lại còn 0 / 4 / 8 / tròn — giống batdongsan.
     * Muốn quay lại như cũ thì xoá nguyên khối này, không phải sửa gì thêm.
     *
     * ⚠️ Lưu ý cho người sửa sau: ở dự án này `rounded-xl` và `rounded-2xl`
     * KHÔNG còn là 12px và 16px như mặc định của Tailwind nữa. Đừng ngạc nhiên.
     */
    borderRadius: {
      none: '0px',
      sm: '2px',
      DEFAULT: '4px', // rounded      — thẻ tin, ảnh, nút, ô nhập (mức chủ đạo)
      md: '4px',      // rounded-md   — gom về 4px
      lg: '8px',      // rounded-lg   — khối lớn, hộp thoại
      xl: '8px',      // rounded-xl   — gom về 8px
      '2xl': '8px',   // rounded-2xl  — gom về 8px
      '3xl': '12px',  // rounded-3xl  — chỉ còn vài chỗ, để 12px cho khối thật lớn
      full: '9999px', // rounded-full — chip, ảnh đại diện, nút tròn
    },
  },
  plugins: [],
};
