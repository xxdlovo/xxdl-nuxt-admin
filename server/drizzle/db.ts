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

/**
 * 统一的数据访问类型（供领域层与 mapper 使用）。
 *
 * - `AppDb`：连接池实例，等价于 `useDb()` 的返回值；
 * - `AppTx`：`db.transaction()` 回调里的执行器，资金等需要原子性的写操作必须用它；
 * - `AppExecutor`：两者联合，mapper 统一接收该类型，使同一份 SQL 在事务内外都能复用。
 */
export type AppDb = MySql2Database<typeof schema>
export type AppTx = Parameters<Parameters<AppDb['transaction']>[0]>[0]
export type AppExecutor = AppDb | AppTx

/**
 * 把事务执行器收窄为连接实例。
 *
 * drizzle 的 `MySql2Transaction` 与 `MySql2Database` 查询构建器签名不一致，联合类型
 * 直接调用会报「无兼容签名」；两者实际可用的构建方法完全一致，因此这里做一次性收窄，
 * mapper 内部始终按 `AppDb` 书写，调用方传连接或事务都可以。
 */
export function asDb(executor: AppExecutor): AppDb {
    return executor as AppDb
}
