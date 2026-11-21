/**
 * 「能力与配额」演示页的配额计量器。
 *
 * 为什么必须在这里注册：守卫 `assertEntitlement` 的配额分支只有在「不限」时才跳过
 * 计量器；否则它按 `meta.resolverKey ?? 功能键` 找计量器取真实已用量，找不到就
 * fail-closed 拒绝（不能把未知用量当 0 放行）。本文件把演示存储里的计数接到那两张表上。
 *
 * 注册键必须与能力目录（`sys_member_feature.resolver_key`）**逐字一致**：
 *   demoClassCount  ← demo.class.max
 *   demoHiddenCount ← demo.hidden.max
 * 目录由演示 SQL 维护（不属于本仓库的代码改动）。
 *
 * 显式相对导入而不是依赖 Nitro 自动导入：`server/utils/**` 确实会被自动扫描，
 * 但插件是启动期执行的一次性代码，显式写清依赖更便于阅读与排查。
 */
import { defineUsageResolvers } from '#admin/server/exports/entitlement'
import { countShowcaseHidden, showcaseClassStore } from '../utils/showcaseEntitlementStore'

export default defineNitroPlugin(() => {
  defineUsageResolvers({
    // 班级配额：已用 = 内存里该用户的班级数
    demoClassCount: (_ctx, userId) => showcaseClassStore.count(userId),
    // 隐藏配额：与班级共用同一份内存存储，但独立计数
    demoHiddenCount: (_ctx, userId) => countShowcaseHidden(userId)
  })
})
