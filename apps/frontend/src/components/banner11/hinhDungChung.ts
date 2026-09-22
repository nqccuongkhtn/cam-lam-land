/* ============================================================================
 *  HÌNH DÙNG CHUNG CHO MỌI MẪU BANNER  (sinh tự động — đừng sửa tay)
 * ----------------------------------------------------------------------------
 *  Mấy mẫu banner gọi tới hình dùng chung bằng `<use href="#star">`. Thiếu khối
 *  này thì đốm sáng, ngôi sao… mất sạch mà KHÔNG báo lỗi gì.
 *  Khối svg này rộng 0 cao 0, không hiện gì, chỉ để chứa hình dùng chung.
 * ========================================================================== */

export const HINH_DUNG_CHUNG = "<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\" focusable=\"false\">\n  <defs>\n    <radialGradient id=\"sg\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0\" stop-color=\"#fff\"/><stop offset=\".22\" stop-color=\"#fff\" stop-opacity=\".9\"/><stop offset=\".6\" stop-color=\"#ffe7ad\" stop-opacity=\".22\"/><stop offset=\"1\" stop-color=\"#ffe7ad\" stop-opacity=\"0\"/></radialGradient>\n    <symbol id=\"star\" viewBox=\"-50 -50 100 100\"><circle r=\"24\" fill=\"url(#sg)\"/><path d=\"M0-50C3-8 8-3 50 0C8 3 3 8 0 50C-3 8-8 3-50 0C-8-3-3-8 0-50Z\" fill=\"#fff\"/></symbol>\n    <filter id=\"duoNA\" color-interpolation-filters=\"sRGB\">\n      <feColorMatrix type=\"matrix\" values=\".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0\"/>\n      <feComponentTransfer><feFuncR type=\"table\" tableValues=\".043 .984\"/><feFuncG type=\"table\" tableValues=\".114 .749\"/><feFuncB type=\"table\" tableValues=\".212 .141\"/></feComponentTransfer>\n    </filter>\n  </defs>\n</svg>";
