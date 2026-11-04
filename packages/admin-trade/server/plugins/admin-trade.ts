import { registerUserOnboardHook } from '#admin/server/hooks/userOnboard'
import { registerSysJobHandlers } from '#admin/server/sys-router/job/handlers'
import { memberService } from '#trade/server/trade-router/domain/member/MemberService'
import { tradeJobHandlers } from '#trade/server/jobs/handlers'

/**
 * 电商层启动钩子。
 *
 * 基座提供两个扩展点，电商层在这里一次性接上：
 * 1. 定时任务：会员冻结/赠金/等级过期、订单超时关单、钱包对账；
 * 2. 用户建档：注册或第三方首登后开通会员档案与钱包。
 *
 * 未安装本层时这两个注册表为空，基座照常工作（只是没有对应的业务任务与档案）。
 */
export default defineNitroPlugin(() => {
    registerSysJobHandlers(tradeJobHandlers)

    registerUserOnboardHook(async (ctx, payload) => {
        // 基座的来源枚举比会员域更宽（含后台手工建档），这里做一次收窄映射：
        // `admin` 表示后台代建，对会员域而言等同于补建档案。
        const source = payload.source === 'admin' ? 'backfill' : payload.source

        await memberService(ctx.db).onboard({
            userId: payload.userId,
            inviteCode: payload.inviteCode ?? null,
            source,
            operatorId: payload.operatorId ?? null
        })
    })
})
