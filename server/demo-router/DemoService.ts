import  {demoRepo} from './DemoRepo'
import type { Context } from '#server/trpc/context';
import {AppError} from '#server/utils/appError'
import type {OrmPageResp} from '#server/utils/ApiResp'
import type {DemoAddDTO, DemoDto, DemoPageQueryDTO, DemoQueryDTO, DemoUpdateDTO} from "#shared/demo";
import {randomUuid} from "#shared/utils/uuid";



export function demoService(ctx: Context) {
    const repo = demoRepo(ctx)

    return {
        async create(data: DemoAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = {...data, id: uuid}
            await repo.create(pojo)
            return true
        },
        async remove(id:string): Promise<boolean>{
            await repo.remove(id)
            return true
        },
        async batchRemove(ids: string[]): Promise<number>{
            const result = await repo.batchRemove(ids)
            return ids.length
        },
        async updateById(id: string, data: DemoUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req:DemoQueryDTO):Promise<DemoDto>{
            const pojo = await repo.getOne(req)
            if(!pojo){
                throw new AppError('common.notExist')
            }
            return pojo
        },
        async getById(id: string):Promise<DemoDto>{
            const pojo = await repo.getById(id)
            if(!pojo){
                throw new AppError('common.notExist')
            }
            return pojo
        },
        async page(req: DemoPageQueryDTO): Promise<OrmPageResp> {
            const {page, pageSize, ...dto} = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any):Promise<DemoDto[]> {
            return await repo.list(dto)
        },
    }
}
