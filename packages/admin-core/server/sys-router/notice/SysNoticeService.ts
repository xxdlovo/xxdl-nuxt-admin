import { useLogger } from 'evlog'
import { sysNoticeRepo } from './SysNoticeRepo'
import type { Context } from '#admin/server/trpc/context'
import { AppError } from '#admin/server/utils/appError'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import type { SysNoticeAddDTO, SysNoticeDto, SysNoticePageQueryDTO, SysNoticePublicPageQueryDTO, SysNoticePublishStatusDTO, SysNoticeQueryDTO, SysNoticeUpdateDTO } from '#admin/shared/system/notice'
import { randomUuid } from '#admin/shared/utils/uuid'
import { sanitizeRichText } from '#admin/server/utils/sanitizeHtml'

function sanitizeNotice<T extends { content?: string | null, contentFormat?: string | null }>(data: T): T {
    if (data.contentFormat !== 'html') {
        return data
    }

    return {
        ...data,
        content: sanitizeRichText(data.content),
    }
}

function sanitizeNoticeDto<T extends { content?: string | null, contentFormat?: string | null }>(data: T): T {
    return sanitizeNotice(data)
}

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
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/notice')

    return {
        async create(data: SysNoticeAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...withPublishDefaults(sanitizeNotice(data)), id: uuid }
            await repo.create(pojo)
            log.info('notice created', { notice: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('notice removed', { notice: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('notice batch removed', { notice: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysNoticeUpdateDTO): Promise<boolean> {
            await repo.updateById(id, withPublishDefaults(sanitizeNotice(data)))
            log.info('notice updated', { notice: { action: 'update', id } })
            return true
        },
        async updatePublishStatus(data: SysNoticePublishStatusDTO): Promise<boolean> {
            await repo.updateById(data.id, {
                publishStatus: data.publishStatus
            })
            log.info('notice publish status updated', {
                notice: { action: 'updatePublishStatus', id: data.id, publishStatus: data.publishStatus }
            })
            return true
        },
        async getOne(req: SysNoticeQueryDTO): Promise<SysNoticeDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('notice fetched', { notice: { action: 'getOne' } })
            return sanitizeNoticeDto(pojo)
        },
        async getById(id: string): Promise<SysNoticeDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('notice fetched', { notice: { action: 'getById', id } })
            return sanitizeNoticeDto(pojo)
        },
        async page(req: SysNoticePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto)
            log.info('notice page queried', {
                notice: { action: 'page', page, pageSize, total: result.total }
            })
            return {
                ...result,
                list: result.list.map(item => sanitizeNoticeDto(item)),
            }
        },
        /**
         * 公开公告分页：无需登录，只含已发布公告，按 publishTime 倒序。
         * 公开接口不写 evlog 宽事件，避免匿名请求把日志打满。
         */
        async publicPage(req: SysNoticePublicPageQueryDTO): Promise<OrmPageResp> {
            const result = await repo.publicPage(req.page, req.pageSize)
            return {
                ...result,
                list: result.list.map(item => sanitizeNoticeDto(item)),
            }
        },
        /** 管理端按 publishTime 倒序分页（含未发布），权限由 router 的 listProc 控制。 */
        async pageByPublishTime(req: SysNoticePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.pageByPublishTime(page, pageSize, dto)
            log.info('notice page by publish time queried', {
                notice: { action: 'pageByPublishTime', page, pageSize, total: result.total }
            })
            return {
                ...result,
                list: result.list.map(item => sanitizeNoticeDto(item)),
            }
        },
        async list(dto: SysNoticeQueryDTO): Promise<SysNoticeDto[]> {
            const list = await repo.list(dto)
            log.info('notice listed', { notice: { action: 'list', count: list.length } })
            return list.map(item => sanitizeNoticeDto(item))
        },
        async latest(limit = 10): Promise<SysNoticeDto[]> {
            const list = await repo.listPublished(Math.min(Math.max(limit, 1), 20))
            log.info('notice latest queried', { notice: { action: 'latest', count: list.length } })
            return list.map(item => sanitizeNoticeDto(item))
        },
    }
}
