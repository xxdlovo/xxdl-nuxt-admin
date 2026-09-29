import { router, proc } from '~~/server/trpc/init'
import { SysStorageGetSchema, SysStorageListSchema, SysStorageRemoveSchema } from '#shared/system/storage'
import { sysStorageService } from './SysStorageService'

const listProc = proc({ permission: 'system:storage:list' })
// 删除是敏感操作，单独使用 system:storage:del，资源桶不会进入该接口。
const deleteProc = proc({ permission: 'system:storage:del' })

/** 路由仅负责权限、输入校验和服务类调用，具体存储逻辑集中在 SysStorageService。 */
export const sysStorageRouter = router({
    list: listProc.input(SysStorageListSchema)
        .query(({ input }) => sysStorageService().list(input)),
    get: listProc.input(SysStorageGetSchema)
        .query(({ input }) => sysStorageService().get(input)),
    remove: deleteProc.input(SysStorageRemoveSchema)
        .mutation(({ input }) => sysStorageService().removeMemory(input.key))
})
