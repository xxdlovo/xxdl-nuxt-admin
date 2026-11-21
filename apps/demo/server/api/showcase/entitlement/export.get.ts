/**
 * 开关型能力演示（`demo.report.export`）：通过则返回假报表，不通过由守卫抛错。
 *
 * 开关关闭时前端 `v-feature` 会直接把「导出报表」按钮移除；这里的断言证明
 * 绕过前端（直接调接口）同样会被拦住。
 */
import { createContext } from '#admin/server/trpc/context'
import { assertEntitlement } from '#admin/server/exports/entitlement'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { requireLogin } from '#admin/server/utils/routeGuard'
import { createServerT } from '#admin/server/utils/serverI18n'
import { ensureEntitlements } from '#trade/server/exports'

/** 演示用假数据，不读库 */
const DEMO_ROWS = [
  { id: 1, name: '演示班级 A', students: 12, createdAt: '2026-01-05' },
  { id: 2, name: '演示班级 B', students: 8, createdAt: '2026-02-11' },
  { id: 3, name: '演示班级 C', students: 21, createdAt: '2026-03-02' }
]

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  const t = createServerT(event)

  try {
    requireLogin(ctx)
    await ensureEntitlements(ctx)

    await assertEntitlement(ctx, 'demo.report.export')

    return {
      ok: true,
      rows: DEMO_ROWS
    }
  }
  catch (error) {
    throw createApiRouteError(error, t, 'module.system.entitlement.denied')
  }
})
