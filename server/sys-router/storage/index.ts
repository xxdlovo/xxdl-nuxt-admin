import { router, permissionProcedure } from '~~/server/trpc/init'
import { SysStorageGetSchema, SysStorageListSchema, SysStorageRemoveSchema } from '#shared/system/storage'
import { sysStorageService } from './SysStorageService'

const listPermission = permissionProcedure('system:storage:list')
// 删除是敏感操作，单独使用 system:storage:del，资源桶不会进入该接口。
const deletePermission = permissionProcedure('system:storage:del')

/** 路由仅负责权限、输入校验和服务类调用，具体存储逻辑集中在 SysStorageService。 */
export const sysStorageRouter = router({
  list: listPermission.input(SysStorageListSchema).query(({ input }) => sysStorageService().list(input)),
  get: listPermission.input(SysStorageGetSchema).query(({ input }) => sysStorageService().get(input)),
  remove: deletePermission.input(SysStorageRemoveSchema).mutation(({ input }) => sysStorageService().removeMemory(input.key))
})
