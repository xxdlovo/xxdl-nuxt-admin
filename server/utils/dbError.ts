/**
 * 数据库驱动错误的判定工具。
 *
 * 这里放的是**驱动层**知识（mysql2 的错误码形状、drizzle 的错误包装方式），
 * 不属于任何业务域，因此放在 `server/utils/` 供各域共用，
 * 避免每个域各写一份判定后逐渐分叉。
 */

/**
 * 沿 `cause` 链向下查找的最大层数。
 *
 * drizzle 只包一层，这里留出余量以兼容上层再包装（h3 / tRPC / 自定义 Error），
 * 同时与下面的 `Set` 一起去重构成「防环形引用」的双保险。
 */
const MAX_CAUSE_DEPTH = 5

/** mysql2 唯一键冲突的错误码与错误号 */
const DUPLICATE_KEY_CODE = 'ER_DUP_ENTRY'
const DUPLICATE_KEY_ERRNO = 1062

/**
 * 唯一键冲突判定（mysql2 `ER_DUP_ENTRY` / `errno = 1062`）。
 *
 * **为什么不能只看最外层 error**：drizzle 把驱动错误包装成 `DrizzleQueryError`，
 * 构造时执行 `this.cause = cause`（见 `node_modules/drizzle-orm/errors.js`），
 * 真正的 `code = 'ER_DUP_ENTRY'` / `errno = 1062` 挂在 `cause` 上；
 * 若再被业务层包装（如 `AppError` 的 `cause`），还会多一层。
 * 只看最外层对象的话判定**恒为 `false`**，所有依赖它的幂等回落
 * （重复请求返回已有单据、重复回调判重、并发建档兜底）都会退化成「数据库错误」。
 *
 * 判定为非冲突错误时返回 `false`，对调用方零行为变化、不引入假阳性。
 */
export function isDuplicateKeyError(error: unknown): boolean {
  const visited = new Set<unknown>()
  let cursor: unknown = error

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    // 非对象、已访问过（环形引用）、或已到链尾：都不可能是驱动错误
    if (!cursor || typeof cursor !== 'object' || visited.has(cursor)) {
      return false
    }

    visited.add(cursor)

    const candidate = cursor as { code?: unknown, errno?: unknown, cause?: unknown }

    if (candidate.code === DUPLICATE_KEY_CODE || candidate.errno === DUPLICATE_KEY_ERRNO) {
      return true
    }

    cursor = candidate.cause
  }

  return false
}
