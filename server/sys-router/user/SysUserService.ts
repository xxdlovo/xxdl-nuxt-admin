import {buildWhereBySchema} from "#server/drizzle/queries/buildWhereBySchema";
import  {sysUserRepo} from './SysUserRepo'
import {SysUserBaseSchema, type SysUserDto} from "#shared/system/user/common";
import { sysUser } from "~~/server/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { Context } from '#server/trpc/context';
import type {OrmPageResp} from '#server/utils/ApiResp'
import {useDb} from '#server/drizzle/db'
import type {SysUserAddDTO, SysUserPageQueryDTO, SysUserQueryDTO, SysUserUpdateDTO} from "#shared/system/user";
import {randomUuid} from "#shared/utils/uuid";
import { hashUserPassword } from "#server/utils/password";
import { AppError } from "#server/utils/appError";
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
// 定义一个工具类型，去除 null
type NonNull<T> = {
    [K in keyof T]: Exclude<T[K], null>
}

function omitPassword<T extends { password?: unknown } | null>(user: T) {
    if (!user) {
        return user
    }
    const { password, ...safeUser } = user
    return safeUser
}

export function sysUserService(ctx: Context) {
    const repo = sysUserRepo(ctx)

    return {
        async create(data: SysUserAddDTO): Promise<boolean> {
            const pojo = {
                ...data,
                id: data.id ?? randomUuid(),
                password: await hashUserPassword(data.password)
            }
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
        async updateById(id: string, data: SysUserUpdateDTO): Promise<boolean> {
            const pojo = {
                ...data,
                password: await hashUserPassword(data.password)
            }
            await repo.updateById(id, pojo)
            return true
        },
        async getOne(req:SysUserQueryDTO):Promise<SysUserDto>{
            const pojo = await repo.getOne(req)
            if(!pojo){
                throw new AppError('common.notExist')
            }
            return omitPassword(pojo) as SysUserDto
        },
        async getById(id: string):Promise<SysUserDto | null>{
            const pojo = await repo.getById(id)
            return omitPassword(pojo) as SysUserDto | null
        },
        async getLoginUserByUsername(username: string) {
            const users = await ctx.db
                .select()
                .from(sysUser)
                .where(and(eq(sysUser.username, username), eq(sysUser.isDeleted, 0)))
                .limit(1)

            return users[0] ?? null
        },
        async page(req: SysUserPageQueryDTO): Promise<OrmPageResp> {
            const {page, pageSize, ...dto} = req
            const result = await repo.page(page, pageSize, dto)
            return {
                ...result,
                list: result.list.map(omitPassword)
            }
        },
        async list(dto: any):Promise<SysUserDto[]> {
            const result = await repo.list(dto)
            return result.map(omitPassword) as SysUserDto[]
        },
    }
}
