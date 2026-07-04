import crypto from 'node:crypto';

// KHOÁ JWT: KHÔNG dùng giá trị mặc định cố định (repo công khai → giả mạo được token admin).
// Nếu chưa đặt JWT_SECRET → sinh khoá ngẫu nhiên mỗi lần khởi động (an toàn; phiên đăng nhập sẽ reset khi deploy lại).
const jwtSecret = process.env.JWT_SECRET
  || (() => { console.warn('[BẢO MẬT] Chưa đặt JWT_SECRET — đang dùng khoá NGẪU NHIÊN tạm thời. Mọi phiên đăng nhập sẽ mất khi khởi động lại. Hãy đặt JWT_SECRET (chuỗi ngẫu nhiên dài) trên Render để cố định!'); return crypto.randomBytes(48).toString('hex'); })();

export const env = {
  pg: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'camlam',
    password: process.env.POSTGRES_PASSWORD ?? 'camlam_secret_change_me',
    database: process.env.POSTGRES_DB ?? 'camlam_gis',
  },
  port: Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 4000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@camlam.local',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin12345',
  uploadDir: process.env.UPLOAD_DIR ?? '/data/uploads',
};
