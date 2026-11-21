/**
 * 隐藏配额的创建入口（`demo.hidden.max`，目录里 `user_show = 0`）。
 *
 * 这是**唯一**暴露隐藏能力的地方，但注意它暴露的只是「有这个操作」，不是额度：
 * - 通过时只返回新 id 与已用量，不返回功能名 / 上限 / 名称；
 * - 被拒时由守卫决定文案：隐藏项走通用 `denied`（「当前操作不可用」），
 *   不会出现「该功能上限 N」这种暴露上限的提示。
 *
 * 顺序同班级创建：登录 → 解析能力档案 → 断言 → 才写入。
 */
import { createContext } from '#admin/server/trpc/context'
import { assertEntitlement } from '#admin/server/exports/entitlement'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { requireLogin } from '#admin/server/utils/routeGuard'
import { createServerT } from '#admin/server/utils/serverI18n'
import { ensureEntitlements } from '#trade/server/exports'
import { countShowcaseHidden, createShowcaseHidden, showcaseClassStore } from '../../../utils/showcaseEntitlementStore'

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  const t = createServerT(event)

  try {
    const user = requireLogin(ctx)
    await ensureEntitlements(ctx)

    await assertEntitlement(ctx, 'demo.hidden.max', { used: countShowcaseHidden(user.id) })

    const created = createShowcaseHidden(user.id)

    // 刻意只回 id 与计数：响应体里不出现功能名与上限
    return {
      data: { id: created.id },
      used: {
        classCount: showcaseClassStore.count(user.id),
        hiddenCount: countShowcaseHidden(user.id)
      }
    }
  }
  catch (error) {
    throw createApiRouteError(error, t, 'module.system.entitlement.denied')
  }
})
