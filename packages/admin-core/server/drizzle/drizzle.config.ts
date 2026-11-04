import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './server/drizzle/schema/*',
  out: './server/drizzle/out',
  dialect: 'mysql',
    dbCredentials: {
        host: process.env.DB_HOST!,
        // 端口与运行时（server/drizzle/db.ts）保持一致，未配置时用 MySQL 默认值
        port: Number(process.env.DB_PORT ?? 3306),
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_DATABASE!,
    },
});
