/**
 * 余额领域 mapper 的公共 SQL 工具。
 *
 * 唯一键冲突判定属于驱动层知识，已统一到 `#server/utils/dbError` 的
 * `isDuplicateKeyError`，本文件不再保留副本（避免以后再分叉）。
 */

/** mysql2 的写结果 → 受影响行数（条件更新靠它做幂等/并发判定） */
export function affectedRows(result: unknown): number {
  const first = Array.isArray(result) ? result[0] : result

  return Number((first as { affectedRows?: number } | undefined)?.affectedRows ?? 0)
}
