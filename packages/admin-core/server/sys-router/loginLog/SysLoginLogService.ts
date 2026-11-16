import { useLogger } from 'evlog'
import { sysLoginLogRepo } from './SysLoginLogRepo'
import type { Context } from '#admin/server/trpc/context';
import { AppError } from '#admin/server/utils/appError'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import type { SysLoginLogAddDTO, SysLoginLogDto, SysLoginLogPageQueryDTO, SysLoginLogQueryDTO, SysLoginLogUnlockDTO, SysLoginLogUpdateDTO } from "#admin/shared/system/loginLog";
import { sysUserService } from '#admin/server/sys-router/user/SysUserService'
import { randomUuid } from "#admin/shared/utils/uuid";

export function sysLoginLogService(ctx: Context) {
    const repo = sysLoginLogRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/loginLog')

    return {
        async create(data: SysLoginLogAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('loginLog created', { loginLog: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('loginLog removed', { loginLog: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('loginLog batch removed', { loginLog: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysLoginLogUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            log.info('loginLog updated', { loginLog: { action: 'update', id } })
            return true
        },
        async getOne(req: SysLoginLogQueryDTO): Promise<SysLoginLogDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('loginLog fetched', { loginLog: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysLoginLogDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('loginLog fetched', { loginLog: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysLoginLogPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.pageRecent(page, pageSize, dto)
            log.info('loginLog page queried', { loginLog: { action: 'page', page, pageSize, total: result.total } })
            return result
        },
        async list(dto: any): Promise<SysLoginLogDto[]> {
            const list = await repo.listRecent(dto)
            log.info('loginLog listed', { loginLog: { action: 'list', count: list.length } })
            return list
        },
        async clearAll(): Promise<boolean> {
            await repo.clearAll()
            log.warn('loginLog cleared', { loginLog: { action: 'clearAll' } })
            return true
        },
        /** 按 userId 或 username 解锁账号（登录日志的“解锁”按钮） */
        async unlock(data: SysLoginLogUnlockDTO): Promise<boolean> {
            let userId = data.userId

            if (!userId && data.username) {
                const user = await sysUserService(ctx).getLoginUserByUsername(data.username)
                userId = user?.id
            }

            if (!userId) {
                throw new AppError('common.notExist')
            }

            await sysUserService(ctx).unlock(userId)
            log.info('loginLog account unlocked', { loginLog: { action: 'unlock', userId } })
            return true
        },
    }
}
