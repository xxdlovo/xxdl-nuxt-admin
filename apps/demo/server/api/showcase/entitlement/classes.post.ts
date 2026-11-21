/**
 * 新建演示班级（配额型能力 `demo.class.max`）。
 *
 * 顺序：登录 → 解析能力档案 → 入参校验 → **断言配额** → 才写入内存。
 * 断言失败时不会产生任何数据（先校验后写入），这正是配额演示要证明的点：
 * 前端把按钮置灰只是体验，真正的拦截在服务端。
 */
import { createContext } from '#admin/server/trpc/context'
import { assertEntitlement } from '#admin/server/exports/entitlement'
import { AppError } from '#admin/server/utils/appError'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { requireLogin } from '#admin/server/utils/routeGuard'
import { createServerT } from '#admin/server/utils/serverI18n'
import { ensureEntitlements } from '#trade/server/exports'
import { countShowcaseHidden, showcaseClassStore } from '../../../utils/showcaseEntitlementStore'

/** 与前端输入框 maxlength 保持一致 */
const NAME_MAX_LENGTH = 40

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  const t = createServerT(event)

  try {
    const user = requireLogin(ctx)
    // 原生路由必须自己补齐能力档案，否则断言会把「未登记」当成拒绝
    await ensureEntitlements(ctx)

    const body = await readBody<{ name?: unknown }>(event)
    const rawName = typeof body?.name === 'string' ? body.name.trim() : ''

    if (!rawName) {
      throw new AppError('form.required')
    }

    const name = rawName.slice(0, NAME_MAX_LENGTH)

    // 已用量从同一份内存存储里取，接口与计量器口径一致（守卫不再自己查一遍）
    await assertEntitlement(ctx, 'demo.class.max', { used: showcaseClassStore.count(user.id) })

    const created = showcaseClassStore.create(user.id, name)

    return {
      data: created,
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
