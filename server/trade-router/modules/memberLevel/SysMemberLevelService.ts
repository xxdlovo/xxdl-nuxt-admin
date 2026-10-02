import { sysMemberLevelRepo } from './SysMemberLevelRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysMemberLevelAddDTO,
    SysMemberLevelDto,
    SysMemberLevelPageQueryDTO,
    SysMemberLevelQueryDTO,
    SysMemberLevelUpdateDTO
} from '#shared/system/memberLevel'
import { randomUuid } from '#shared/utils/uuid'

export function sysMemberLevelService(ctx: Context) {
    const repo = sysMemberLevelRepo(ctx)

    return {
        /** 新增：code 全局唯一，先判重再落库，避免把唯一索引冲突抛成数据库错误 */
        async create(data: SysMemberLevelAddDTO): Promise<boolean> {
            if (await repo.findByCode(data.code)) {
                throw new AppError('module.system.memberLevel.codeExists')
            }

            await repo.create({
                ...data,
                id: randomUuid(),
                // 缺省启用：契约 Schema 已声明 default，这里兜底直接调用 Service 的情况
                status: data.status ?? 1
            })

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

        /** 修改：换码时同样要判重（排除自身），保证 code 始终唯一 */
        async updateById(id: string, data: SysMemberLevelUpdateDTO): Promise<boolean> {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            const existing = await repo.findByCode(data.code)

            if (existing && existing.id !== id) {
                throw new AppError('module.system.memberLevel.codeExists')
            }

            await repo.updateById(id, data)

            return true
        },

        async getOne(req: SysMemberLevelQueryDTO): Promise<SysMemberLevelDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysMemberLevelDto
        },

        async getById(id: string): Promise<SysMemberLevelDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysMemberLevelDto
        },

        async page(req: SysMemberLevelPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req

            return await repo.page(page, pageSize, dto, repo.levelListOrder())
        },

        /**
         * 等级下拉：只返回启用中的等级。
         * 等级是全局字典数据，配套的路由用 proc({ dataScope: false }) 跳过数据范围过滤。
         */
        async list(dto: SysMemberLevelQueryDTO): Promise<SysMemberLevelDto[]> {
            const rows = await repo.list({ ...dto, status: 1 }, repo.levelListOrder())

            return rows as SysMemberLevelDto[]
        }
    }
}
