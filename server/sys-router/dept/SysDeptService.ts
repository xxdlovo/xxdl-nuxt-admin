import { sysDeptRepo } from './SysDeptRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysDeptAddDTO, SysDeptDto, SysDeptPageQueryDTO, SysDeptQueryDTO, SysDeptUpdateDTO } from "#shared/system/department";
import { randomUuid } from "#shared/utils/uuid";
import { asc, eq, isNull, or, type SQL } from 'drizzle-orm'
import { sysDepartment } from '#server/drizzle/schema'

export function sysDeptService(ctx: Context) {
    const repo = sysDeptRepo(ctx)

    return {
        async create(data: SysDeptAddDTO): Promise<boolean> {
            const uuid = randomUuid()
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
        async updateById(id: string, data: SysDeptUpdateDTO): Promise<boolean> {
            if (data.parentId && data.parentId === id) {
                throw new AppError('module.system.department.parentCannotSelf')
            }

            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysDeptQueryDTO): Promise<SysDeptDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysDeptDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysDeptPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, parentId, ...dto } = req
            const isRootQuery = parentId === '0'
            const extraWhere: SQL[] = []

            if (isRootQuery) {
                const rootParentWhere = or(eq(sysDepartment.parentId, '0'), eq(sysDepartment.parentId, ''), isNull(sysDepartment.parentId))
                if (rootParentWhere) {
                    extraWhere.push(rootParentWhere)
                }
            } else if (parentId) {
                extraWhere.push(eq(sysDepartment.parentId, parentId))
            }

            return await repo.page(page, pageSize, dto, [asc(sysDepartment.sortOrder)], extraWhere)
        },
        async list(dto: any): Promise<SysDeptDto[]> {
            return await repo.list(dto)
        },
    }
}
