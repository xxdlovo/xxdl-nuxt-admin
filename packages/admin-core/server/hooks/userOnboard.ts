import type { Context } from '#admin/server/trpc/context'

/**
 * 用户建档扩展点。
 *
 * 基座只负责账号本身（`sys_user`）。业务域常常需要在「用户创建成功后」做额外动作，
 * 例如电商层要为用户开通会员档案（`sys_member`）与钱包。
 *
 * 为了让基座完全不依赖业务域，这里采用运行时注册表：
 * 业务层在自己的 Nitro 插件里调用 {@link registerUserOnboardHook} 挂上钩子，
 * 基座创建用户时按顺序执行，且**任一钩子失败都不影响账号创建**。
 */

export type UserOnboardSource = 'register' | 'oauth' | 'admin' | 'backfill'

export type UserOnboardPayload = {
  /** 新建用户的 id */
  userId: string
  /** 触发来源 */
  source: UserOnboardSource
  /** 邀请码（注册场景可能带） */
  inviteCode?: string | null
  /** 操作者 id（自助注册时与 userId 相同） */
  operatorId?: string | null
}

export type UserOnboardHook = (ctx: Context, payload: UserOnboardPayload) => Promise<unknown>

const hooks: UserOnboardHook[] = []

/** 注册用户建档钩子（业务层在 Nitro 插件启动时调用） */
export function registerUserOnboardHook(hook: UserOnboardHook) {
    hooks.push(hook)
}

/**
 * 依次执行用户建档钩子。
 *
 * 单个钩子抛错只记录日志，不向上抛：账号已创建成功，
 * 业务档案可以通过对应的补偿任务（如 `member:backfill-profile`）补齐。
 */
export async function runUserOnboardHooks(ctx: Context, payload: UserOnboardPayload) {
    for (const hook of hooks) {
        try {
            await hook(ctx, payload)
        } catch (error) {
            console.error(`[admin] user onboard hook failed userId=${payload.userId} source=${payload.source}`, error)
        }
    }
}
