export const env = {
  pg: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'camlam',
    password: process.env.POSTGRES_PASSWORD ?? 'camlam_secret_change_me',
    database: process.env.POSTGRES_DB ?? 'camlam_gis',
  },
  port: Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@camlam.local',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin12345',
  uploadDir: process.env.UPLOAD_DIR ?? '/data/uploads',
};
