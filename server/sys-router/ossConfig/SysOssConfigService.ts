import { useLogger } from 'evlog'
import { sysOssConfigRepo } from './SysOssConfigRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysOssConfigAddDTO, SysOssConfigDto, SysOssConfigPageQueryDTO, SysOssConfigQueryDTO, SysOssConfigUpdateDTO } from "#shared/system/ossConfig";
import { randomUuid } from "#shared/utils/uuid";
import { verifyOssConfig } from './OssConfigVerifier'

function nowForMysql() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export function sysOssConfigService(ctx: Context) {
    const repo = sysOssConfigRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/ossConfig')

    return {
        async create(data: SysOssConfigAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('ossConfig created', { ossConfig: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('ossConfig removed', { ossConfig: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('ossConfig batch removed', { ossConfig: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysOssConfigUpdateDTO): Promise<boolean> {
            await repo.updateById(id, {
                ...data,
                verifyStatus: 0,
                verifyTime: null,
                verifyMessage: null
            })
            log.info('ossConfig updated', { ossConfig: { action: 'update', id } })
            return true
        },
        async verify(id: string): Promise<{ success: boolean, message: string }> {
            const config = await repo.getById(id)
            if (!config) throw new AppError('common.notExist')

            const result = await verifyOssConfig(config)
            await repo.updateVerifyResult(id, {
                verifyStatus: result.success ? 1 : 2,
                verifyTime: nowForMysql(),
                verifyMessage: result.message,
                operatorId: ctx.user?.id ?? null
            })

            log.info('ossConfig verified', { ossConfig: { action: 'verify', id } })
            return result
        },
        async getOne(req: SysOssConfigQueryDTO): Promise<SysOssConfigDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('ossConfig fetched', { ossConfig: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysOssConfigDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('ossConfig fetched', { ossConfig: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysOssConfigPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.pageRecent(page, pageSize, dto)
            log.info('ossConfig page queried', { ossConfig: { action: 'page', page, pageSize, total: result.total } })
            return result
        },
        async list(dto: any): Promise<SysOssConfigDto[]> {
            const list = await repo.listRecent(dto)
            log.info('ossConfig listed', { ossConfig: { action: 'list', count: list.length } })
            return list
        },
    }
}
