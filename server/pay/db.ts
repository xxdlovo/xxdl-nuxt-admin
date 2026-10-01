/**
 * 支付领域层的数据库类型。
 * 单独抽一个文件，避免 adapter / service / dispatcher 之间互相 import 造成循环依赖。
 */
import type { MySql2Database } from 'drizzle-orm/mysql2'
import type * as schema from '#server/drizzle/schema'

export type PayDb = MySql2Database<typeof schema>
