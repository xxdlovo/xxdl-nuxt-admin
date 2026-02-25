import {buildWhereBySchema} from "#server/drizzle/queries/buildWhereBySchema";
import  {sysUserRepo} from './SysUserRepo'
import {SysUserBaseSchema, type SysUserDto} from "#shared/system/user/common";
import { sysUser } from "~~/server/drizzle/schema";
import {and} from "drizzle-orm";
import type { Context } from '#server/trpc/context';
import type {OrmPageResp} from '#server/utils/ApiResp'
import {useDb} from '#server/drizzle/db'
import type {SysUserAddDTO, SysUserPageQueryDTO, SysUserQueryDTO, SysUserUpdateDTO} from "#shared/system/user";
import {randomUuid} from "#shared/utils/uuid";
// export const getById = async () =>{
//     const db = useDb()
//     console.log('getById调用了')
//     const pojo = {
//         username :'abc'
//     }
//     const where = buildWhereBySchema(SysUserBaseSchema, sysUser, pojo)
//     const resp = await db.select().from(sysUser).where((and(...where)))
//     console.log(resp)
// }

export function sysUserService(ctx: Context) {
    const repo = sysUserRepo(ctx)

    return {
        async create(data: SysUserAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = {...data, id: uuid}
            await repo.create(pojo)
            return true
        },
        async remove(id:string): Promise<boolean>{
            await repo.remove(id)
            return true
        },
        async updateById(id: string, data: SysUserUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req:SysUserQueryDTO):Promise<SysUserDto>{
            const pojo = await repo.getOne(req)
            if(!pojo){
                throw new Error('用户不存在')
            }
            return pojo
        },
        async getById(id: string):Promise<SysUserDto>{
            const pojo = await repo.getById(id)
            if(!pojo){
                throw new Error('用户不存在')
            }
            return pojo
        },
        async page(req: SysUserPageQueryDTO): Promise<OrmPageResp> {
            const {page, pageSize, ...dto} = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any):Promise<SysUserDto[]> {
            return await repo.list(dto)
        },
    }
}
