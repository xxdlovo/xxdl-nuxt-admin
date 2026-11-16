// drizzle orm db 
import 'dotenv/config';
import mysql from "mysql2/promise";
import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './schema'

// 1. 在模块作用域内定义私有缓存变量
let _db: MySql2Database<typeof schema> | null = null;
let _pool: ReturnType<typeof mysql.createPool> | null = null;

/** 连接池上限；与 mysql.createPool 的配置保持一致。 */
const DB_CONNECTION_LIMIT = 10;

/** mysql2 pool 事件计数，用于连接池监控。 */
const poolMetrics = {
    created: 0,
    acquired: 0,
    released: 0,
    enqueued: 0,
};

/** 解析后的数据库连接参数 */
type DbConnectionConfig = {
    host: string
    port: number
    user: string
    password: string
    database: string
}

/**
 * 从连接串解析连接参数，例如：
 * `mysql://root:pass@127.0.0.1:3306/nuxt_admin`
 *
 * 也接受不带协议前缀的形式（`root:pass@127.0.0.1:3306/nuxt_admin`）。
 */
function parseDatabaseUrl(raw: string): DbConnectionConfig {
    const normalized = raw.includes('://') ? raw : `mysql://${raw}`
    const url = new URL(normalized)

    return {
        host: url.hostname,
        port: Number(url.port || 3306),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        // pathname 形如 `/nuxt_admin`
        database: decodeURIComponent(url.pathname.replace(/^\//, ''))
    }
}

/**
 * 计算最终的连接参数。
 *
 * 优先级：`DATABASE_URL`（单串）> 分字段环境变量 > runtimeConfig。
 *
 * `DATABASE_URL` 是业务项目最省事的接入方式：一行连接串即可，
 * 不需要分别设置 host/user/password/database。
 */
function resolveDbConfig(config: ReturnType<typeof useRuntimeConfig>): DbConnectionConfig {
    const directUrl = process.env.DATABASE_URL || (config.databaseUrl as string | undefined)

    if (directUrl) {
        return parseDatabaseUrl(directUrl)
    }

    return {
        host: process.env.DB_HOST || config.db.host,
        // 端口：DB_PORT 优先，其次 NUXT_DB_PORT（写入 runtimeConfig.db.port），最后回落 MySQL 默认 3306
        port: Number(process.env.DB_PORT || config.db.port || 3306),
        user: process.env.DB_USER || config.db.user,
        password: process.env.DB_PASSWORD || config.db.password,
        database: process.env.DB_DATABASE || config.db.database,
    }
}

export const useDb = () => {
    // 2. 如果已经存在实例，直接返回（命中缓存）
    if (_db){
        console.log('useDb 命中缓存')
        return _db;
    }
    // 3. 只有第一次执行时才会运行以下逻辑
    const config = useRuntimeConfig();

    // 4. 创建物理连接池
    const dbConfig = resolveDbConfig(config)

    if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
        throw new Error(
            'Database config is missing. Set DATABASE_URL, or DB_HOST/DB_USER/DB_DATABASE ' +
            '(also readable from NUXT_DATABASE_URL / NUXT_DB_HOST / NUXT_DB_USER / NUXT_DB_DATABASE).'
        )
    }

    const poolConnection = mysql.createPool({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        waitForConnections: true,
        connectionLimit: DB_CONNECTION_LIMIT, // 根据你的并发需求调整
        queueLimit: 0,
    });

    _pool = poolConnection;
    poolConnection.on('connection', () => {
        poolMetrics.created += 1;
    });
    poolConnection.on('acquire', () => {
        poolMetrics.acquired += 1;
    });
    poolConnection.on('release', () => {
        poolMetrics.released += 1;
    });
    poolConnection.on('enqueue', () => {
        poolMetrics.enqueued += 1;
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
 * 连接池监控数据。
 *
 * 优先读 mysql2 内部连接列表；不同版本字段可能不存在，此时用事件计数回退。
 * 不修改连接池行为，只做观测。
 */
export function getDbPoolStats() {
    const internal = (_pool as any)?.pool;
    const active = Math.max(0, poolMetrics.acquired - poolMetrics.released);
    const total = Array.isArray(internal?._allConnections)
        ? internal._allConnections.length
        : poolMetrics.created;
    const idle = Array.isArray(internal?._freeConnections)
        ? internal._freeConnections.length
        : Math.max(0, total - active);
    const waiting = Array.isArray(internal?._connectionQueue)
        ? internal._connectionQueue.length
        : Math.max(0, poolMetrics.enqueued - poolMetrics.acquired);

    return {
        initialized: Boolean(_pool),
        connectionLimit: DB_CONNECTION_LIMIT,
        total,
        active,
        idle,
        waiting,
        created: poolMetrics.created,
        acquired: poolMetrics.acquired,
        released: poolMetrics.released,
        enqueued: poolMetrics.enqueued,
    };
}

/**
 * 测试专用数据库初始化函数
 * 直接使用环境变量，不依赖 Nuxt 运行时
 */
export const createTestDb = () => {
    const poolConnection = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT ?? 3306),
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
