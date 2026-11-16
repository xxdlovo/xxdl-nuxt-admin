import { useLogger } from 'evlog'
import { asc } from 'drizzle-orm'
import { randomUuid } from '#admin/shared/utils/uuid'
import type { Context } from '#admin/server/trpc/context'
import { sysPost } from '#admin/server/drizzle/schema'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import type {
    SysPostAddDTO,
    SysPostDto,
    SysPostPageQueryDTO,
    SysPostQueryDTO,
    SysPostUpdateDTO,
} from '#admin/shared/system/post'
import { AppError } from '#admin/server/utils/appError'
import { sysPostRepo } from './SysPostRepo'
import { sysUserPostRepo } from '#admin/server/sys-router/userPost/SysUserPostRepo'

const sysPostSort = asc(sysPost.sortOrder)

export function sysPostService(ctx: Context) {
    const repo = sysPostRepo(ctx)
    const userPostRepo = sysUserPostRepo(ctx)
    const log = useLogger(ctx.event, 'server/sys-router/post')

    async function assertCodeAvailable(code: string, excludeId?: string | null) {
        if (await repo.existsCode(code, excludeId)) {
            throw new AppError('module.system.post.codeExists')
        }
    }

    return {
        async create(data: SysPostAddDTO): Promise<boolean> {
            await assertCodeAvailable(data.code)
            const id = randomUuid()
            await repo.create({ ...data, id })
            log.info('post created', { post: { action: 'create', id } })
            return true
        },

        async updateById(id: string, data: SysPostUpdateDTO): Promise<boolean> {
            const current = await repo.getById(id)
            if (!current) {
                throw new AppError('common.notExist')
            }

            await assertCodeAvailable(data.code, id)
            await repo.updateById(id, data)
            log.info('post updated', { post: { action: 'update', id } })
            return true
        },

        async remove(id: string): Promise<boolean> {
            if (await userPostRepo.existsByPostId(id)) {
                throw new AppError('module.system.post.inUse')
            }

            await repo.remove(id)
            log.info('post removed', { post: { action: 'remove', id } })
            return true
        },

        async batchRemove(ids: string[]): Promise<number> {
            for (const id of ids) {
                if (await userPostRepo.existsByPostId(id)) {
                    throw new AppError('module.system.post.inUse')
                }
            }

            await repo.batchRemove(ids)
            log.info('post batch removed', { post: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },

        async getOne(req: SysPostQueryDTO): Promise<SysPostDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) {
                throw new AppError('common.notExist')
            }
            log.info('post fetched', { post: { action: 'getOne' } })
            return pojo
        },

        async getById(id: string): Promise<SysPostDto> {
            const pojo = await repo.getById(id)
            if (!pojo) {
                throw new AppError('common.notExist')
            }
            log.info('post fetched', { post: { action: 'getById', id } })
            return pojo
        },

        async page(req: SysPostPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto, [sysPostSort])
            log.info('post page queried', { post: { action: 'page', page, pageSize, total: result.total } })
            return result
        },

        async list(dto: any = {}): Promise<SysPostDto[]> {
            const list = await repo.list(dto, [sysPostSort])
            log.info('post listed', { post: { action: 'list', count: list.length } })
            return list
        },

        async listEnabled(): Promise<SysPostDto[]> {
            const list = await repo.listEnabled()
            log.info('post enabled listed', { post: { action: 'listEnabled', count: list.length } })
            return list
        },
    }
}
