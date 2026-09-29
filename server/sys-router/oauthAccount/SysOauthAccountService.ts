import { sysOauthAccountRepo } from './SysOauthAccountRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysOauthAccountAddDTO,
    SysOauthAccountDto,
    SysOauthAccountPageQueryDTO,
    SysOauthAccountQueryDTO,
    SysOauthAccountUpdateDTO
} from '#shared/system/oauthAccount'
import { randomUuid } from '#shared/utils/uuid'

export function sysOauthAccountService(ctx: Context) {
    const repo = sysOauthAccountRepo(ctx)

    return {
        async create(data: SysOauthAccountAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysOauthAccountUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysOauthAccountQueryDTO): Promise<SysOauthAccountDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysOauthAccountDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysOauthAccountPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<SysOauthAccountDto[]> {
            return await repo.list(dto)
        },
    }
}
