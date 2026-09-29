import { sysOauthConfigRepo } from './SysOauthConfigRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysOauthConfigAddDTO,
    SysOauthConfigDto,
    SysOauthConfigPageQueryDTO,
    SysOauthConfigQueryDTO,
    SysOauthConfigUpdateDTO,
    SysOauthEnabledPlatformDTO
} from '#shared/system/oauthConfig'
import { randomUuid } from '#shared/utils/uuid'
import { and, asc, eq, sql } from 'drizzle-orm'
import { sysOauthConfig } from '#server/drizzle/schema'

export function sysOauthConfigService(ctx: Context) {
    const repo = sysOauthConfigRepo(ctx)

    /**
     * 取全部「已启用且未删除」的平台配置，按 sortOrder 升序。
     * 走 ctx.db 直查而不用 CommonRepo，避免数据权限/默认过滤干扰登录流程。
     */
    async function listEnabledRows(): Promise<SysOauthConfigDto[]> {
        const rows = await ctx.db
            .select()
            .from(sysOauthConfig)
            .where(and(
                eq(sysOauthConfig.status, 1),
                eq(sysOauthConfig.isDeleted, 0)
            ))
            .orderBy(asc(sysOauthConfig.sortOrder))

        return rows as SysOauthConfigDto[]
    }

    return {
        async create(data: SysOauthConfigAddDTO): Promise<boolean> {
            const uuid = randomUuid()         // 自动生成主键
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            return ids.length
        },
        async updateById(id: string, data: SysOauthConfigUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysOauthConfigQueryDTO): Promise<SysOauthConfigDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysOauthConfigDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysOauthConfigPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<SysOauthConfigDto[]> {
            return await repo.list(dto)
        },

        /**
         * 按 platform 取启用中的配置（含 clientSecret，仅服务端 OAuth 回调使用）。
         * 用 LOWER() 比对，平台列被填成 GITHUB / GitHub 时同样能命中。
         */
        async getEnabledByPlatform(platform: string): Promise<SysOauthConfigDto | null> {
            const normalized = platform.trim().toLowerCase()
            if (!normalized) return null

            const rows = await ctx.db
                .select()
                .from(sysOauthConfig)
                .where(and(
                    sql`LOWER(${sysOauthConfig.platform}) = ${normalized}`,
                    eq(sysOauthConfig.status, 1),
                    eq(sysOauthConfig.isDeleted, 0)
                ))
                .limit(1)

            return (rows[0] as SysOauthConfigDto | undefined) ?? null
        },

        /**
         * 登录页展示用的已启用平台列表。
         * 只返回可公开字段，不泄露 clientId / clientSecret。
         * platform 统一转小写：库里可能被填成 GITHUB / GitHub，而回调路由
         * /auth/{platform} 只按小写匹配，这里从源头归一化避免前端再兜底。
         */
        async listEnabledPlatforms(): Promise<SysOauthEnabledPlatformDTO[]> {
            const rows = await listEnabledRows()

            return rows
                .filter(row => !!row.platform && !!row.platformName)
                .map(row => ({
                    platform: String(row.platform).trim().toLowerCase(),
                    platformName: row.platformName as string,
                    icon: row.icon ?? null
                }))
        },
    }
}
