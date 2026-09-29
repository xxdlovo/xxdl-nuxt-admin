import { sysOauthConfigRepo } from './SysOauthConfigRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysOauthConfigAddDTO,
    SysOauthConfigDto,
    SysOauthConfigPageQueryDTO,
    SysOauthConfigQueryDTO,
    SysOauthConfigUpdateDTO
} from '#shared/system/oauthConfig'
import { randomUuid } from '#shared/utils/uuid'

export function sysOauthConfigService(ctx: Context) {
    const repo = sysOauthConfigRepo(ctx)

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
    }
}
