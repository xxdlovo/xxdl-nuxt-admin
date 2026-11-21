/**
 * 删除演示班级（释放配额）。
 *
 * 删除本身不受配额约束，所以不调用 assertEntitlement；但**只能删自己的**：
 * `showcaseClassStore.remove` 以 `ctx.user.id` 为作用域，别人的 id 一律返回 false。
 * 返回最新 used，页面据此演示「删一个就能再建一个」。
 */
import { createContext } from '#admin/server/trpc/context'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { requireLogin } from '#admin/server/utils/routeGuard'
import { createServerT } from '#admin/server/utils/serverI18n'
import { countShowcaseHidden, showcaseClassStore } from '../../../utils/showcaseEntitlementStore'

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  const t = createServerT(event)

  try {
    const user = requireLogin(ctx)

    const body = await readBody<{ id?: unknown }>(event)
    const id = typeof body?.id === 'string' ? body.id : ''

    // 删不到（id 不存在 / 不是自己的）不算错误，用 removed 标记区分，避免泄漏别人数据的存否
    const removed = id ? showcaseClassStore.remove(user.id, id) : false

    return {
      data: { id, removed },
      used: {
        classCount: showcaseClassStore.count(user.id),
        hiddenCount: countShowcaseHidden(user.id)
      }
    }
  }
  catch (error) {
    throw createApiRouteError(error, t, 'common.error')
  }
})
