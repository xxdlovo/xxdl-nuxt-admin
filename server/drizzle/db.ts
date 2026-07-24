// drizzle orm db 
import 'dotenv/config';
import mysql from "mysql2/promise";
import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './schema'

// 1. 在模块作用域内定义私有缓存变量
let _db: MySql2Database<typeof schema> | null = null;

export const useDb = () => {
    // 2. 如果已经存在实例，直接返回（命中缓存）
    if (_db){
        console.log('useDb 命中缓存')
        return _db;
    }
    // 3. 只有第一次执行时才会运行以下逻辑
    const config = useRuntimeConfig();

    // 4. 创建物理连接池
    const dbConfig = {
        host: process.env.DB_HOST || config.db.host,
        user: process.env.DB_USER || config.db.user,
        password: process.env.DB_PASSWORD || config.db.password,
        database: process.env.DB_DATABASE || config.db.database,
    }

    if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
        throw new Error('Database config is missing. Set DB_HOST/DB_USER/DB_DATABASE or NUXT_DB_HOST/NUXT_DB_USER/NUXT_DB_DATABASE.')
    }

    const poolConnection = mysql.createPool({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        waitForConnections: true,
        connectionLimit: 10, // 根据你的并发需求调整
        queueLimit: 0,
    });

    // 5. 初始化 Drizzle 并存入变量
    _db = drizzle(poolConnection, {
        schema,
        mode: "default",
        logger: false
    });
    console.log('useDb 初始化数据库连接')
    return _db;
};

/**
 * 测试专用数据库初始化函数
 * 直接使用环境变量，不依赖 Nuxt 运行时
 */
export const createTestDb = () => {
    const poolConnection = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'nuxt_admin',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    });

    return drizzle(poolConnection, {
        schema,
        mode: "default",
        logger: false
    });
};
