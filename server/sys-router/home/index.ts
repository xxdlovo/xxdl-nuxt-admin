//#server/sys-router/home
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysHomeService } from './SysHomeService'

/**
 * 首页看板：登录即可（与 `sysNotice.latest` 一致，不挂权限码）。
 * 数据范围由服务端按登录者 `is_admin` 判定，前端不能指定 scope。
 */
export const sysHomeRouter = router({
    overview: protectedProcedure
        .query(async ({ ctx }) => {
            return sysHomeService(ctx).overview()
        })
})
