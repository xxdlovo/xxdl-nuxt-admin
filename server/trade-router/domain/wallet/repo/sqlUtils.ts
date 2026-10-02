/**
 * 余额领域 mapper 的公共 SQL 工具。
 */

/** mysql2 的写结果 → 受影响行数（条件更新靠它做幂等/并发判定） */
export function affectedRows(result: unknown): number {
  const first = Array.isArray(result) ? result[0] : result

  return Number((first as { affectedRows?: number } | undefined)?.affectedRows ?? 0)
}

/**
 * 唯一键冲突判定。
 *
 * 资金链路依赖唯一索引做幂等（流水 dedup_key、冻结单 biz_no、充值单 out_trade_no），
 * 因此把冲突识别为「该业务事件已经被处理过」，而不是异常。
 */
export function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && ((error as { code?: string }).code === 'ER_DUP_ENTRY'
      || (error as { errno?: number }).errno === 1062)
  )
}
