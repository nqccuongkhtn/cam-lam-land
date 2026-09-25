// ══ CHỦ QUYỀN BIỂN ĐẢO VIỆT NAM — HOÀNG SA & TRƯỜNG SA ══
//
// VÌ SAO PHẢI CÓ FILE NÀY:
// Ảnh nền bản đồ của web (Esri, Google) là của nhà cung cấp nước ngoài. Ở mức phóng xa,
// họ thường BỎ TRỐNG hai quần đảo, hoặc ghi tên tiếng Anh/tên nước khác. Video và ảnh chụp
// màn hình xuất ra từ web mà thiếu Hoàng Sa · Trường Sa thì rất dễ bị bắt bẻ.
// → Lớp này TỰ CHỒNG LÊN TRÊN CÙNG, luôn bật, không có nút tắt: chấm đảo + tên hai quần đảo
//   ghi rõ thuộc Việt Nam. Vẽ đè lên ảnh nền nên nhà cung cấp ghi gì cũng không quan trọng.
//
// TOẠ ĐỘ: lấy theo vị trí các đảo/đá/bãi chính (kinh độ, vĩ độ - hệ WGS84), làm tròn tới
// khoảng vài trăm mét. Đủ chính xác để chấm đúng chỗ ở mức phóng toàn cảnh Việt Nam —
// đây là lớp KHẲNG ĐỊNH CHỦ QUYỀN để nhìn, không phải bản đồ đo đạc.

export type DaoVN = { ten: string; lng: number; lat: number };

// Quần đảo HOÀNG SA — thuộc thành phố Đà Nẵng.
export const HOANG_SA: DaoVN[] = [
  { ten: 'Phú Lâm', lng: 112.335, lat: 16.833 },
  { ten: 'Hoàng Sa', lng: 111.601, lat: 16.840 },
  { ten: 'Tri Tôn', lng: 111.201, lat: 15.783 },
  { ten: 'Linh Côn', lng: 112.732, lat: 16.667 },
  { ten: 'Quang Hoà', lng: 111.702, lat: 16.450 },
  { ten: 'Duy Mộng', lng: 111.755, lat: 16.470 },
  { ten: 'Quang Ảnh', lng: 111.508, lat: 16.450 },
  { ten: 'Hữu Nhật', lng: 111.586, lat: 16.503 },
  { ten: 'Đảo Cây', lng: 112.269, lat: 16.966 },
  { ten: 'Đảo Bắc', lng: 112.318, lat: 16.949 },
  { ten: 'Đảo Trung', lng: 112.301, lat: 16.940 },
  { ten: 'Đảo Nam', lng: 112.334, lat: 16.923 },
  { ten: 'Đá Bắc', lng: 111.502, lat: 17.083 },
  { ten: 'Bạch Quy', lng: 111.756, lat: 16.055 },
  { ten: 'Bông Bay', lng: 112.548, lat: 16.033 },
];

// Quần đảo TRƯỜNG SA — thuộc tỉnh Khánh Hoà (cùng tỉnh với Cam Lâm).
export const TRUONG_SA: DaoVN[] = [
  { ten: 'Trường Sa Lớn', lng: 111.921, lat: 8.644 },
  { ten: 'Song Tử Tây', lng: 114.328, lat: 11.427 },
  { ten: 'Nam Yết', lng: 114.367, lat: 10.183 },
  { ten: 'Sinh Tồn', lng: 114.333, lat: 9.883 },
  { ten: 'Sơn Ca', lng: 114.483, lat: 10.383 },
  { ten: 'An Bang', lng: 112.917, lat: 7.883 },
  { ten: 'Phan Vinh', lng: 113.700, lat: 8.967 },
  { ten: 'Trường Sa Đông', lng: 112.353, lat: 8.900 },
  { ten: 'Sinh Tồn Đông', lng: 114.553, lat: 9.900 },
  { ten: 'Đá Tây', lng: 112.200, lat: 8.850 },
  { ten: 'Đá Lát', lng: 111.667, lat: 8.667 },
  { ten: 'Đá Lớn', lng: 113.850, lat: 10.050 },
  { ten: 'Đá Nam', lng: 114.350, lat: 11.400 },
  { ten: 'Cô Lin', lng: 114.242, lat: 9.733 },
  { ten: 'Len Đao', lng: 114.363, lat: 9.783 },
  { ten: 'Tốc Tan', lng: 113.983, lat: 8.833 },
  { ten: 'Núi Le', lng: 114.183, lat: 8.750 },
  { ten: 'Tiên Nữ', lng: 114.650, lat: 8.850 },
  { ten: 'Thuyền Chài', lng: 113.300, lat: 8.183 },
  { ten: 'Đá Thị', lng: 114.600, lat: 10.400 },
  { ten: 'Đá Đông', lng: 112.583, lat: 8.833 },
];

// Chữ to đặt giữa mỗi quần đảo — đây mới là phần "không bị bắt bẻ".
const NHOM: { ten: string; lng: number; lat: number }[] = [
  { ten: 'QUẦN ĐẢO HOÀNG SA\n(TP ĐÀ NẴNG · VIỆT NAM)', lng: 112.05, lat: 16.42 },
  { ten: 'QUẦN ĐẢO TRƯỜNG SA\n(TỈNH KHÁNH HOÀ · VIỆT NAM)', lng: 113.55, lat: 9.55 },
];

export function geojsonBienDao(): any {
  const feats: any[] = [];
  for (const d of [...HOANG_SA, ...TRUONG_SA]) {
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lng, d.lat] }, properties: { loai: 'dao', ten: d.ten } });
  }
  for (const n of NHOM) {
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [n.lng, n.lat] }, properties: { loai: 'nhom', ten: n.ten } });
  }
  return { type: 'FeatureCollection', features: feats };
}

// Thêm lớp biển đảo vào một bản đồ MapLibre.
// Gọi lại nhiều lần vẫn an toàn (đã có thì thôi). Lỗi thì chỉ ghi log, KHÔNG để sập bản đồ.
// Đặt ở trên cùng nên không bị lớp nào che.
const LOP_BD = ['bd-cham', 'bd-ten-dao', 'bd-ten-nhom'];

export function themLopBienDao(map: any): void {
  if (!map) return;
  try {
    // Đã có rồi thì chỉ ĐẨY LÊN TRÊN CÙNG. Cần thế vì các lớp thêm sau (ảnh quy hoạch, lớp GIS…)
    // luôn nằm đè lên lớp cũ — không đẩy lên thì tên hai quần đảo bị che mất.
    if (map.getSource && map.getSource('bien-dao-vn')) {
      for (const id of LOP_BD) { try { if (map.getLayer(id)) map.moveLayer(id); } catch { /* bỏ qua */ } }
      return;
    }
    map.addSource('bien-dao-vn', { type: 'geojson', data: geojsonBienDao() });
    // Chấm trắng đánh dấu từng đảo — phóng càng gần chấm càng to.
    map.addLayer({
      id: 'bd-cham', type: 'circle', source: 'bien-dao-vn',
      filter: ['==', ['get', 'loai'], 'dao'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.8, 6, 3.4, 9, 5.5],
        'circle-color': '#ffffff',
        'circle-stroke-color': '#0B4045',
        'circle-stroke-width': 1.2,
      },
    });
    // Tên từng đảo — chỉ hiện khi phóng đủ gần, không thì rối mắt.
    map.addLayer({
      id: 'bd-ten-dao', type: 'symbol', source: 'bien-dao-vn',
      filter: ['==', ['get', 'loai'], 'dao'], minzoom: 6.5,
      layout: {
        'text-field': ['get', 'ten'], 'text-font': ['Noto Sans Regular'], 'text-size': 12,
        'text-offset': [0, 0.9], 'text-anchor': 'top',
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': '#0B4045', 'text-halo-width': 2.2 },
    });
    // TÊN HAI QUẦN ĐẢO — luôn hiện ở mọi mức phóng, cho chèn đè lên nhau cũng phải hiện.
    map.addLayer({
      id: 'bd-ten-nhom', type: 'symbol', source: 'bien-dao-vn',
      filter: ['==', ['get', 'loai'], 'nhom'],
      layout: {
        'text-field': ['get', 'ten'], 'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 11, 4, 14, 6, 19, 9, 26],
        'text-line-height': 1.25, 'text-allow-overlap': true, 'text-ignore-placement': true,
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': '#0B4045', 'text-halo-width': 3 },
    });
  } catch (e) {
    console.warn('[bien dao]', e);
  }
}
