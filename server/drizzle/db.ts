// drizzle orm db 
import 'dotenv/config';
import mysql from "mysql2/promise";
import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './schema'

// 1. 在模块作用域内定义私有缓存变量
let _db: MySql2Database<typeof schema> | null = null;

export const useDb = () => {
    // 2. 如果已经存在实例，直接返回（命中缓存）
    if (_db) return _db;

    // 3. 只有第一次执行时才会运行以下逻辑
    const config = useRuntimeConfig();

    // 校验关键配置是否存在，防止静默失败
    if (!config.db?.host) {
        throw createError({message: '数据库配置缺失，请检查 RuntimeConfig'});
    }

    // 4. 创建物理连接池
    const poolConnection = mysql.createPool({
        host: config.db.host,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
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

    return _db;
};
