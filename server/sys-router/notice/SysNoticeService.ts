import { sysNoticeRepo } from './SysNoticeRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysNoticeAddDTO, SysNoticeDto, SysNoticePageQueryDTO, SysNoticePublishStatusDTO, SysNoticeQueryDTO, SysNoticeUpdateDTO } from '#shared/system/notice'
import { randomUuid } from '#shared/utils/uuid'

function withPublishDefaults<T extends SysNoticeAddDTO | SysNoticeUpdateDTO>(data: T) {
    const publishTime = typeof data.publishTime === 'string' && data.publishTime.trim()
        ? data.publishTime.trim()
        : undefined

    return {
        ...data,
        publishTime: data.publishStatus === 1
            ? publishTime ?? new Date().toISOString().slice(0, 19).replace('T', ' ')
            : publishTime ?? null
    }
}

export function sysNoticeService(ctx: Context) {
    const repo = sysNoticeRepo(ctx)

    return {
        async create(data: SysNoticeAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...withPublishDefaults(data), id: uuid }
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
        async updateById(id: string, data: SysNoticeUpdateDTO): Promise<boolean> {
            await repo.updateById(id, withPublishDefaults(data))
            return true
        },
        async updatePublishStatus(data: SysNoticePublishStatusDTO): Promise<boolean> {
            await repo.updateById(data.id, {
                publishStatus: data.publishStatus
            })
            return true
        },
        async getOne(req: SysNoticeQueryDTO): Promise<SysNoticeDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysNoticeDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysNoticePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: SysNoticeQueryDTO): Promise<SysNoticeDto[]> {
            return await repo.list(dto)
        },
        async latest(limit = 10): Promise<SysNoticeDto[]> {
            return await repo.listPublished(Math.min(Math.max(limit, 1), 20))
        },
    }
}
