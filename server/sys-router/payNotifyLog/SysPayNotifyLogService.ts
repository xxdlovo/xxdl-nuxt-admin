import { desc } from 'drizzle-orm'
import { sysPayNotifyLog } from '~~/server/drizzle/schema'
import { sysPayNotifyLogRepo } from './SysPayNotifyLogRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysPayNotifyLogAddDTO,
    SysPayNotifyLogDto,
    SysPayNotifyLogPageQueryDTO,
    SysPayNotifyLogQueryDTO,
    SysPayNotifyLogUpdateDTO
} from '#shared/system/payNotifyLog'
import { randomUuid } from '#shared/utils/uuid'

export function sysPayNotifyLogService(ctx: Context) {
    const repo = sysPayNotifyLogRepo(ctx)

    return {
        /** 正常链路里日志由 PayNotifyDispatcher 写入，这里供人工补录 */
        async create(data: SysPayNotifyLogAddDTO): Promise<boolean> {
            await repo.create({ ...data, id: randomUuid() })
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
        async updateById(id: string, data: SysPayNotifyLogUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysPayNotifyLogQueryDTO): Promise<SysPayNotifyLogDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysPayNotifyLogDto
        },
        async getById(id: string): Promise<SysPayNotifyLogDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysPayNotifyLogDto
        },
        async page(req: SysPayNotifyLogPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, createdFrom, createdTo, ...dto } = req

            return await repo.pageWithRange(page, pageSize, dto, { createdFrom, createdTo })
        },
        async list(dto: SysPayNotifyLogQueryDTO): Promise<SysPayNotifyLogDto[]> {
            const rows = await repo.list(dto, [desc(sysPayNotifyLog.createdAt)])
            return rows as SysPayNotifyLogDto[]
        }
    }
}
