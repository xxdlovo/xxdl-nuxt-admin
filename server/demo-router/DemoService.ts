import { useLogger } from 'evlog'
import  {demoRepo} from './DemoRepo'
import type { Context } from '#server/trpc/context';
import {AppError} from '#server/utils/appError'
import type {OrmPageResp} from '#server/utils/ApiResp'
import type {DemoAddDTO, DemoDto, DemoPageQueryDTO, DemoQueryDTO, DemoUpdateDTO} from "#shared/demo";
import {randomUuid} from "#shared/utils/uuid";



export function demoService(ctx: Context) {
    const repo = demoRepo(ctx)
    // evlog 宽事件：同一请求内累积上下文，响应结束时由插件自动输出。
    // 第二个参数覆盖事件里的 service，日志中显示具体模块而不是全局应用名。
    // 约定：只记录动作与标识（id / 条数 / 分页），不打印完整入参出参。
    const log = useLogger(ctx.event, 'server/demo-router')

    return {
        async create(data: DemoAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = {...data, id: uuid}
            await repo.create(pojo)
            log.info('demo created', { demo: { action: 'create', id: uuid } })
            return true
        },
        async remove(id:string): Promise<boolean>{
            await repo.remove(id)
            log.info('demo removed', { demo: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number>{
            await repo.batchRemove(ids)
            log.info('demo batch removed', { demo: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: DemoUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            log.info('demo updated', { demo: { action: 'update', id } })
            return true
        },
        async getOne(req:DemoQueryDTO):Promise<DemoDto>{
            const pojo = await repo.getOne(req)
            if(!pojo){
                const error = new AppError('common.notExist')
                log.error(error, { demo: { action: 'getOne' } })
                throw error
            }
            log.info('demo fetched', { demo: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string):Promise<DemoDto>{
            const pojo = await repo.getById(id)
            if(!pojo){
                // AppError 构造时已把自己的堆栈还原为源码位置，并提供 location 字段
                const error = new AppError('common.notExist')
                log.error(error, { demo: { action: 'getById', id } })
                throw error
            }
            log.info('demo fetched', { demo: { action: 'getById', id } })
            return pojo
        },
        async page(req: DemoPageQueryDTO): Promise<OrmPageResp> {
            const {page, pageSize, ...dto} = req
            const result = await repo.page(page, pageSize, dto)
            log.info('demo page queried', { demo: { action: 'page', page, pageSize, total: result.total } })
            return result
        },
        async list(dto: any):Promise<DemoDto[]> {
            const list = await repo.list(dto)
            log.info('demo listed', { demo: { action: 'list', count: list.length } })
            return list
        },
    }
}
