import { useLogger } from 'evlog'
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

export function sysOauthConfigService(ctx: Context) {
    const repo = sysOauthConfigRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/oauthConfig')

    /**
     * 取全部「已启用且未删除」的平台配置，按 sortOrder 升序。
     * 查询细节在 SysOauthConfigRepo.listEnabled（不走 CommonRepo 的通用过滤，
     * 避免数据权限/默认过滤干扰登录流程）。
     */
    async function listEnabledRows(): Promise<SysOauthConfigDto[]> {
        return await repo.listEnabled() as SysOauthConfigDto[]
    }

    return {
        async create(data: SysOauthConfigAddDTO): Promise<boolean> {
            const uuid = randomUuid()         // 自动生成主键
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('oauthConfig created', { oauthConfig: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('oauthConfig removed', { oauthConfig: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('oauthConfig batch removed', { oauthConfig: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysOauthConfigUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            log.info('oauthConfig updated', { oauthConfig: { action: 'update', id } })
            return true
        },
        async getOne(req: SysOauthConfigQueryDTO): Promise<SysOauthConfigDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('oauthConfig fetched', { oauthConfig: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysOauthConfigDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('oauthConfig fetched', { oauthConfig: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysOauthConfigPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto)
            log.info('oauthConfig page queried', {
                oauthConfig: { action: 'page', page, pageSize, total: result.total }
            })
            return result
        },
        async list(dto: any): Promise<SysOauthConfigDto[]> {
            const list = await repo.list(dto)
            log.info('oauthConfig listed', { oauthConfig: { action: 'list', count: list.length } })
            return list
        },

        /**
         * 按 platform 取启用中的配置（含 clientSecret，仅服务端 OAuth 回调使用）。
         * 平台列大小写不敏感（GITHUB / GitHub 都能命中）。
         */
        async getEnabledByPlatform(platform: string): Promise<SysOauthConfigDto | null> {
            const row = await repo.findEnabledByPlatform(platform)
            log.info('oauthConfig enabled platform fetched', {
                oauthConfig: { action: 'getEnabledByPlatform', platform }
            })

            return (row as SysOauthConfigDto | undefined) ?? null
        },

        /**
         * 登录页展示用的已启用平台列表。
         * 只返回可公开字段，不泄露 clientId / clientSecret。
         * platform 统一转小写：库里可能被填成 GITHUB / GitHub，而回调路由
         * /auth/{platform} 只按小写匹配，这里从源头归一化避免前端再兜底。
         */
        async listEnabledPlatforms(): Promise<SysOauthEnabledPlatformDTO[]> {
            const rows = await listEnabledRows()

            const list = rows
                .filter(row => !!row.platform && !!row.platformName)
                .map(row => ({
                    platform: String(row.platform).trim().toLowerCase(),
                    platformName: row.platformName as string,
                    icon: row.icon ?? null
                }))

            log.info('oauthConfig enabled platforms listed', {
                oauthConfig: { action: 'listEnabledPlatforms', count: list.length }
            })

            return list
        },
    }
}
