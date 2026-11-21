/**
 * 演示页初始状态：当前用户的班级列表、已用量、以及**用户可见**的能力项。
 *
 * 原生 Nitro 接口（不走 tRPC），因此进入业务前先 `ensureEntitlements(ctx)`
 * —— 没有 authMiddleware 就没有 `ctx.entitlements`，守卫会按 fail-closed 全部拒绝。
 */
import { createContext } from '#admin/server/trpc/context'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { requireLogin } from '#admin/server/utils/routeGuard'
import { createServerT } from '#admin/server/utils/serverI18n'
import { UNLIMITED } from '#admin/shared/entitlement/types'
import { ensureEntitlements } from '#trade/server/exports'
import { countShowcaseHidden, showcaseClassStore } from '../../../utils/showcaseEntitlementStore'

/** 能力面板的一项；隐藏能力不会出现在这个结构里 */
type VisibleEntitlement = {
  key: string
  name: string
  kind: 'switch' | 'quota'
  value: number
  unlimited: boolean
}

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  const t = createServerT(event)

  try {
    const user = requireLogin(ctx)
    const profile = await ensureEntitlements(ctx)

    // 过滤口径与服务端守卫一致：hiddenFeatures（user_show = 0）与 meta.userShow === false
    // 的键都不给前端看，避免「接口把隐藏能力名字透出去」，也让页面与 useEntitlement 口径一致。
    const hiddenKeys = new Set(profile.hiddenFeatures ?? [])
    const visible: VisibleEntitlement[] = []

    for (const key of Object.keys(profile.features ?? {}).sort()) {
      const meta = profile.meta?.[key]

      if (!meta || hiddenKeys.has(key) || meta.userShow === false) {
        continue
      }

      const value = profile.features[key] ?? 0

      visible.push({
        key,
        name: meta.name,
        kind: meta.kind,
        value,
        unlimited: meta.kind === 'quota' && value === UNLIMITED
      })
    }

    return {
      classes: showcaseClassStore.list(user.id),
      used: {
        classCount: showcaseClassStore.count(user.id),
        hiddenCount: countShowcaseHidden(user.id)
      },
      visible,
      levelName: profile.levelName
    }
  }
  catch (error) {
    throw createApiRouteError(error, t, 'common.error')
  }
})
