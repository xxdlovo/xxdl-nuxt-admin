# 服务端 Memory 缓存使用说明

本目录的缓存统一使用 Nitro 的命名存储 `memory`：

```ts
useStorage('memory')
```

`memory` 是当前 Node.js 进程内的临时缓存。服务重启、进程退出或部署到多个实例时，缓存都会清空或互不共享。缓存只用于提升读取性能，不能作为数据库、登录会话、密码或其他必须持久化数据的唯一来源。

## 推荐调用方式

业务代码应优先使用专用缓存门面 `DictCacheService` 或 `RbacCacheService`。通用业务缓存才直接使用 `SysStorageService`。缓存 key、TTL 和前缀应集中放在 `StorageCacheKeys.ts`，不要在业务文件中散落字符串常量。

## 通用缓存

```ts
import { SysStorageService } from '#server/sys-router/storage/SysStorageService'

const storage = new SysStorageService()

// 写入缓存。ttlSeconds 为有效期，单位是秒。
await storage.setCache('example:config', { enabled: true }, 60)

// 读取缓存。不存在、已过期或缓存异常时返回 null。
const value = await storage.getCache<{ enabled: boolean }>('example:config')

// 删除单个缓存。
await storage.removeCache('example:config')

// 删除某个逻辑前缀下的全部缓存，例如 example:config、example:user:1 等。
await storage.clearCache('example:')
```

### 使用 `rememberCache` 自动回源

`rememberCache` 适合“缓存没有命中时查询数据库或调用外部服务”的场景。它会先读取缓存，miss 时执行 loader 并回填缓存；同一进程内相同 key 的并发请求会合并为一次 loader 调用。

```ts
import { SysStorageService } from '#server/sys-router/storage/SysStorageService'

const storage = new SysStorageService()

const config = await storage.rememberCache(
  'example:config',
  async () => {
    // 缓存 miss 时才执行数据库查询。
    return await loadConfigFromDatabase()
  },
  { ttlSeconds: 5 * 60 }
)
```

缓存值会被包装为如下 envelope，并由服务自行判断过期时间，不依赖具体 storage driver 的 TTL 实现：

```ts
{
  value: /* JSON 可序列化的业务值 */,
  expiresAt: 1730000000000
}
```

因此缓存值应当是 JSON 可序列化数据，不要直接放入数据库连接、请求对象、文件句柄、类实例或包含循环引用的对象。缓存读写异常会按 miss 处理，业务会自动回源，不会因为 memory 缓存故障而阻断主流程。

## 字典缓存

字典缓存只缓存 `sysDictData.listByTypeCode` 的结果，默认 TTL 为 30 分钟。业务服务不需要自行拼 key 或设置 TTL：

```ts
import { dictCacheService } from '#server/sys-router/storage/cache/DictCacheService'

const cache = dictCacheService()

const items = await cache.getByTypeCode(
  'user_status',
  () => sysDictDataRepo(ctx).listByTypeCode('user_status')
)
```

字典数据发生新增、修改、删除后，应清理受影响的编码：

```ts
await cache.invalidate('user_status')
```

无法确定受影响的编码，或者字典类型发生修改、删除时，清理整个字典缓存前缀：

```ts
await cache.invalidateAll()
```

当前项目的 `SysDictDataService` 和 `SysDictTypeService` 已集中处理上述失效逻辑。前端 Pinia 只保存当前页面会话数据，不再从浏览器 `localStorage` 恢复字典缓存。

## RBAC 缓存

RBAC 缓存拆分为三层，默认 TTL 为 15 分钟：

- `userId -> roles`：用户当前启用角色摘要。
- `roleCode -> menu-list`：角色关联的启用菜单、目录和按钮权限。
- `admin -> menu-list`：管理员可见的全部启用菜单和按钮权限。

```ts
import { rbacCacheService } from '#server/sys-router/storage/cache/RbacCacheService'

const cache = rbacCacheService()

const roles = await cache.getUserRoles(
  user.id,
  () => sysRoleService(ctx).listEnabledByUserId(user.id)
)

const menus = await cache.getRoleMenus(
  roles[0].code,
  () => sysMenuService(ctx).listEnabledByRoleIds([roles[0].id])
)

const adminMenus = await cache.getAdminMenus(
  () => sysMenuService(ctx).listEnabledForAdmin()
)
```

发生权限关系变化后，应主动失效对应缓存：

```ts
// 用户角色发生变化。
await cache.invalidateUser(userId)

// 角色菜单、按钮权限发生变化；角色编码修改时旧、新编码都要清理。
await cache.invalidateRole(roleCode)
await cache.invalidateRole(oldRoleCode)
await cache.invalidateRole(newRoleCode)

// 无法确定受影响的角色或用户时使用安全兜底。
await cache.invalidateAllRoles()
await cache.invalidateAllUsers()

// 管理员菜单发生变化。
await cache.invalidateAdmin()
```

`AuthService` 已使用这三层缓存组装 profile 和 permission codes。缓存中不保存密码、session 或完整用户 profile；权限中间件仍然负责服务端鉴权，缓存只优化数据库读取。角色、菜单、用户角色等写服务成功后会自动执行相应失效，调用方通常不需要重复清理。

## Key 约定

缓存 key 由 `StorageCacheKeys.ts` 统一生成：

```text
cache:dict:{encodedCode}
cache:rbac:user:{encodedUserId}:roles
cache:rbac:role:{encodedRoleCode}:menu-list
cache:rbac:admin:menu-list
```

`SysStorageService` 会自动补充 `cache:` 命名空间，并对 key 做路径安全校验。业务侧传入逻辑 key 即可，例如 `dict:user_status`；不要传入 `../`、绝对路径或依赖 Nitro 默认 `useStorage()` 的内部 key。

## 注意事项

1. 缓存只接受 JSON 可序列化值，不能替代持久化存储。
2. memory 只在当前 Node.js 进程有效，多实例之间不会同步。
3. 写操作成功后必须失效相关缓存，TTL 只是最终兜底。
4. 权限缓存只保存已过滤的启用角色、菜单和按钮权限，不能绕过服务端权限中间件。
5. 需要新增缓存类型时，先在 `StorageCacheKeys.ts` 增加 key builder、前缀和 TTL，再新增对应的业务缓存门面。

