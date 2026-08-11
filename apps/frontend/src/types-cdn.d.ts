// Các thư viện được tải THẲNG TỪ MẠNG lúc chạy (esm.sh) để không phải cài vào dự án
// → TypeScript không biết chúng là gì. Khai báo ở đây cho phần soát kiểu chạy sạch.
// (Chỉ ảnh hưởng việc soát kiểu, không ảnh hưởng lúc chạy thật.)
declare module 'https://esm.sh/*';
