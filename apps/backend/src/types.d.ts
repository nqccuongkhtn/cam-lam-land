// Khai báo kiểu cho thư viện KHÔNG kèm sẵn mô tả kiểu.
// shpjs (đọc file shapefile .zip) chỉ có JavaScript thuần → TypeScript không biết nó trả về gì.
// Khai báo tối thiểu ở đây để dự án soát kiểu được sạch mà không phải cài thêm gói.
declare module 'shpjs' {
  /** Đọc 1 file .zip shapefile → GeoJSON (1 lớp hoặc mảng nhiều lớp). */
  const shp: (data: ArrayBuffer | Buffer | string) => Promise<any>;
  export default shp;
}
