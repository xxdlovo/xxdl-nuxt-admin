import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createEvent } from 'h3'
import { and, eq, like } from 'drizzle-orm'
import type { Context } from '../server/trpc/context'
import { createTestDb } from '../server/drizzle/db'
import { sysUser, sysUserRole, sysOauthAccount, sysRole, sysConfig } from '../server/drizzle/schema'
import { sysOauthAccountService } from '../server/sys-router/oauthAccount/SysOauthAccountService'
import { sysUserService } from '../server/sys-router/user/SysUserService'
import { randomUuid } from '../shared/utils/uuid'
import { hashUserPassword, verifyUserPassword } from '../server/utils/password'
import { createCallerFactory } from '../server/trpc/init'
import { appRouter, type AppRouter } from '../server/trpc/routers'
import { systemRegisterEnum, OAUTH_PLACEHOLDER_PASSWORD } from '../shared/constants/business'

/**
 * loginByOAuth 的业务规则测试。
 * OAuth 网络调用无法单测，这里直接调 service，覆盖建号/绑定/角色分配全部分支。
 */
const db = createTestDb()

const PREFIX = 'oauth_t_'

/** 服务端读取的真实注册开关键（systemRegisterEnum.key） */
const REGISTER_KEY = systemRegisterEnum.key

/** 备份原配置值，测试结束后恢复，避免污染业务配置 */
let originalRegisterValue: string | null = null
let insertedRegisterConfig = false

/**
 * 构造对 h3 有效的请求事件。
 *
 * tRPC 的 loggerMiddleware 会通过 getRequestInfo 读取请求头/方法/IP，
 * 因此不能给空对象，否则 h3 会抛 "Cannot read properties of undefined (reading 'req')"。
 * 直接调 service 的用例不经过中间件，但走 createCaller 的用例必须有合法 event。
 */
function createTestEvent() {
    const req: any = {
        method: 'POST',
        url: '/api/trpc',
        headers: { host: '127.0.0.1', 'user-agent': 'vitest' },
        socket: { remoteAddress: '127.0.0.1' },
        connection: { remoteAddress: '127.0.0.1' }
    }
    const res: any = { setHeader: () => res, getHeader: () => undefined, end: () => res }

    return createEvent(req, res) as Context['event']
}

const createTestContext = (): Context => ({
    db,
    event: createTestEvent(),
    session: {},
    user: null,
    currentPermissionCode: null,
    permissionCodes: null,
    dataPermission: null,
    skipDataScope: false
})

const ctx = createTestContext()
const service = () => sysOauthAccountService(ctx)

const mark = (label: string) => `${PREFIX}${label}_${randomUuid().slice(0, 8)}`

/** 把 system_register_enable 设为 yes/no，控制首次建号分支 */
async function setRegisterEnabled(enabled: boolean) {
    const existing = await db.select({ id: sysConfig.id }).from(sysConfig)
        .where(eq(sysConfig.configKey, REGISTER_KEY)).limit(1)

    if (existing[0]) {
        await db.update(sysConfig)
            .set({ configValue: enabled ? 'yes' : 'no' })
            .where(eq(sysConfig.id, existing[0].id))
        return
    }

    insertedRegisterConfig = true
    await db.insert(sysConfig).values({
        id: randomUuid(),
        configName: 'oauth test register switch',
        configKey: REGISTER_KEY,
        configValue: enabled ? 'yes' : 'no',
        configType: 0,
        status: 1,
        isDeleted: 0
    })
}

/** 直接建一个系统用户，用于「已存在账号」的各种分支 */
async function createSysUser(options: {
    username?: string
    email: string
    status?: number
}) {
    const id = randomUuid()
    await db.insert(sysUser).values({
        id,
        username: options.username ?? mark('user'),
        password: await hashUserPassword('placeholder-password'),
        email: options.email,
        nickname: 'oauth test user',
        gender: 0,
        isAdmin: 0,
        status: options.status ?? 1,
        isDeleted: 0
    })
    return id
}

async function findUser(id: string) {
    const rows = await db.select().from(sysUser).where(eq(sysUser.id, id)).limit(1)
    return rows[0] ?? null
}

async function findBinding(provider: string, providerUserId: string) {
    const rows = await db.select().from(sysOauthAccount)
        .where(and(
            eq(sysOauthAccount.provider, provider),
            eq(sysOauthAccount.providerUserId, providerUserId)
        ))
        .limit(1)
    return rows[0] ?? null
}

beforeAll(async () => {
    // 备份注册开关原值，测试期间自行控制，结束后恢复
    const rows = await db.select({ configValue: sysConfig.configValue }).from(sysConfig)
        .where(eq(sysConfig.configKey, REGISTER_KEY)).limit(1)
    originalRegisterValue = rows[0]?.configValue ?? null

    await setRegisterEnabled(true)
})

afterAll(async () => {
    // 恢复注册开关：无论之前是更新既有行还是新建行，都要把值还原。
    // （原实现把 beforeAll 里设置的 yes 误当成原值，导致业务配置停留在 yes）
    if (originalRegisterValue !== null) {
        await db.update(sysConfig)
            .set({ configValue: originalRegisterValue })
            .where(eq(sysConfig.configKey, REGISTER_KEY))
    }
    else if (insertedRegisterConfig) {
        await db.delete(sysConfig).where(eq(sysConfig.configKey, REGISTER_KEY))
    }

    // 先删角色关联，再删绑定与用户，避免悬挂引用
    const users = await db.select({ id: sysUser.id, username: sysUser.username })
        .from(sysUser)
        .where(like(sysUser.username, `${PREFIX}%`))

    const emails = await db.select({ id: sysUser.id, email: sysUser.email })
        .from(sysUser)
        .where(like(sysUser.email, `${PREFIX}%`))

    const ids = [...new Set([...users, ...emails].map(u => u.id))]

    for (const id of ids) {
        await db.delete(sysUserRole).where(eq(sysUserRole.userId, id))
        await db.delete(sysOauthAccount).where(eq(sysOauthAccount.userId, id))
        await db.delete(sysUser).where(eq(sysUser.id, id))
    }

    await db.delete(sysOauthAccount).where(like(sysOauthAccount.providerLogin, `${PREFIX}%`))
    // 用例 10/11 使用带前缀的 provider，且可能没有可清理的 providerLogin
    await db.delete(sysOauthAccount).where(like(sysOauthAccount.provider, `${PREFIX}%`))

    // 角色清理放在 afterAll，确保用例中途失败也不会残留
    // （sys_user_role 没有可标识的 remark 字段，先查出测试角色再按 roleId 清理）
    const testRoles = await db.select({ id: sysRole.id }).from(sysRole)
        .where(like(sysRole.name, `${PREFIX}%`))

    for (const role of testRoles) {
        await db.delete(sysUserRole).where(eq(sysUserRole.roleId, role.id))
    }
    await db.delete(sysRole).where(like(sysRole.name, `${PREFIX}%`))

    const client = (db as any)?.$client
    await client?.end?.()
})

describe('loginByOAuth 业务规则', () => {
    it('1. 已绑定用户登录成功，session 字段与密码登录一致', async () => {
        const email = `${PREFIX}bound@test.local`
        const userId = await createSysUser({ email })
        const providerUserId = mark('pid')

        await db.insert(sysOauthAccount).values({
            id: randomUuid(),
            userId,
            provider: 'github',
            providerUserId,
            providerLogin: mark('login'),
            isDeleted: 0
        })

        const sessionUser = await service().loginByOAuth({
            provider: 'github',
            providerUserId,
            login: 'someone',
            email
        })

        expect(sessionUser.id).toBe(userId)
        // 与 auth/index.ts 的 sessionUser 字段集合完全一致
        expect(Object.keys(sessionUser).sort()).toEqual([
            'avatar', 'deptId', 'email', 'gender', 'id', 'isAdmin', 'nickname', 'phone', 'username'
        ].sort())
        expect(sessionUser.isAdmin).toBe(0)
    })

    it('2. 未绑定但邮箱命中已有用户 → 自动建绑定，不新建用户', async () => {
        const email = `${PREFIX}emailhit@test.local`
        const userId = await createSysUser({ email })
        const providerUserId = mark('pid')

        const before = await db.select({ id: sysUser.id }).from(sysUser)
            .where(like(sysUser.username, `${PREFIX}%`))

        const sessionUser = await service().loginByOAuth({
            provider: 'github',
            providerUserId,
            login: mark('gh'),
            email
        })

        expect(sessionUser.id).toBe(userId)

        const binding = await findBinding('github', providerUserId)
        expect(binding).toBeTruthy()
        expect(binding!.userId).toBe(userId)

        const after = await db.select({ id: sysUser.id }).from(sysUser)
            .where(like(sysUser.username, `${PREFIX}%`))
        expect(after.length).toBe(before.length)
    })

    it('3. 首次登录 + 注册开关开启 → 建号成功', async () => {
        await setRegisterEnabled(true)
        const email = `${PREFIX}first@test.local`
        const providerUserId = mark('pid')
        const login = mark('ghlogin')

        const sessionUser = await service().loginByOAuth({
            provider: 'github',
            providerUserId,
            login,
            email,
            nickname: 'First Login',
            avatar: 'https://example.com/a.png'
        })

        const created = await findUser(sessionUser.id)
        expect(created).toBeTruthy()
        expect(created!.status).toBe(1)
        expect(created!.isAdmin).toBe(0)
        // 占位密码必须非空（库中 NOT NULL），且不可用于登录
        expect(created!.password).toBeTruthy()
        expect(created!.password).not.toBe('placeholder-password')
        expect(created!.email).toBe(email)

        const binding = await findBinding('github', providerUserId)
        expect(binding?.userId).toBe(created!.id)
    })

    it('4. 首次登录 + 注册开关关闭 → auth.registerDisabled', async () => {
        await setRegisterEnabled(false)

        await expect(service().loginByOAuth({
            provider: 'github',
            providerUserId: mark('pid'),
            login: mark('gh'),
            email: `${PREFIX}disabled@test.local`
        })).rejects.toThrow(/registerDisabled/)

        await setRegisterEnabled(true)
    })

    it('5. status = 0 的已绑定用户被拒 → auth.userIsBlock', async () => {
        const email = `${PREFIX}blocked@test.local`
        const userId = await createSysUser({ email, status: 0 })
        const providerUserId = mark('pid')

        await db.insert(sysOauthAccount).values({
            id: randomUuid(),
            userId,
            provider: 'github',
            providerUserId,
            isDeleted: 0
        })

        await expect(service().loginByOAuth({
            provider: 'github',
            providerUserId,
            login: 'blocked',
            email
        })).rejects.toThrow(/userIsBlock/)
    })

    it('6. 邮箱为空且无绑定 → auth.oauthEmailRequired', async () => {
        await setRegisterEnabled(true)

        await expect(service().loginByOAuth({
            provider: 'github',
            providerUserId: mark('pid'),
            login: mark('gh'),
            email: null
        })).rejects.toThrow(/oauthEmailRequired/)
    })

    it('7. username 冲突时生成带后缀的唯一用户名', async () => {
        await setRegisterEnabled(true)
        const conflictName = mark('dup')
        await createSysUser({ username: conflictName, email: `${PREFIX}orig@test.local` })

        const sessionUser = await service().loginByOAuth({
            provider: 'github',
            providerUserId: '4711',
            login: conflictName,
            email: `${PREFIX}conflict@test.local`
        })

        const created = await findUser(sessionUser.id)
        expect(created!.username).not.toBe(conflictName)
        expect(created!.username.startsWith(conflictName)).toBe(true)
        expect(created!.username.length).toBeLessThanOrEqual(50)
    })

    it('8. 同一第三方账号重复登录幂等，不重复建号/绑定', async () => {
        await setRegisterEnabled(true)
        const email = `${PREFIX}idem@test.local`
        const providerUserId = mark('pid')

        const first = await service().loginByOAuth({
            provider: 'github',
            providerUserId,
            login: mark('gh'),
            email
        })

        const bindingsAfterFirst = await db.select({ id: sysOauthAccount.id })
            .from(sysOauthAccount)
            .where(eq(sysOauthAccount.providerUserId, providerUserId))

        const second = await service().loginByOAuth({
            provider: 'github',
            providerUserId,
            login: mark('gh'),
            email
        })

        const bindingsAfterSecond = await db.select({ id: sysOauthAccount.id })
            .from(sysOauthAccount)
            .where(eq(sysOauthAccount.providerUserId, providerUserId))

        expect(second.id).toBe(first.id)
        expect(bindingsAfterFirst.length).toBe(1)
        expect(bindingsAfterSecond.length).toBe(1)
    })

    it('9. 配置了 defaultRoleId → 写入 sys_user_role；角色无效则跳过不报错', async () => {
        await setRegisterEnabled(true)

        const roleId = randomUuid()
        await db.insert(sysRole).values({
            id: roleId,
            name: mark('role'),
            code: mark('rolecode'),
            dataScope: '1',
            status: 1,
            isDeleted: 0
        })

        // 有效角色
        const withRole = await service().loginByOAuth({
            provider: 'github',
            providerUserId: mark('pid'),
            login: mark('gh'),
            email: `${PREFIX}role@test.local`,
            defaultRoleId: roleId
        })

        const links = await db.select({ id: sysUserRole.id })
            .from(sysUserRole)
            .where(and(eq(sysUserRole.userId, withRole.id), eq(sysUserRole.roleId, roleId)))
        expect(links.length).toBe(1)

        // 无效角色：应跳过且不影响登录
        const noRole = await service().loginByOAuth({
            provider: 'github',
            providerUserId: mark('pid'),
            login: mark('gh'),
            email: `${PREFIX}norole@test.local`,
            defaultRoleId: randomUuid()
        })
        expect(noRole.id).toBeTruthy()

        await db.delete(sysUserRole).where(eq(sysUserRole.roleId, roleId))
        await db.delete(sysRole).where(eq(sysRole.id, roleId))
    })

    // 以下两个用例覆盖「解绑/删库后同一第三方账号再次登录」的回归场景。
    // provider 用 oauth_t_ 前缀，便于 afterAll 精确清理。
    it('10. 绑定被软删后再次登录 → 复用残留行，不撞唯一键', async () => {
        await setRegisterEnabled(true)
        const provider = mark('p1')
        const email = `${PREFIX}revive@test.local`
        const providerUserId = mark('pid')

        const first = await service().loginByOAuth({
            provider,
            providerUserId,
            login: mark('gh'),
            email
        })

        const before = await findBinding(provider, providerUserId)
        expect(before).toBeTruthy()
        expect(before!.isDeleted).toBe(0)

        // 模拟前端解绑/手动删库留下的软删残留行
        await db.update(sysOauthAccount)
            .set({ isDeleted: 1 })
            .where(eq(sysOauthAccount.id, before!.id))

        // 再次登录：不得抛唯一键错误，且应复用同一行
        const second = await service().loginByOAuth({
            provider,
            providerUserId,
            login: mark('gh'),
            email
        })

        expect(second.id).toBe(first.id)

        const rows = await db.select().from(sysOauthAccount)
            .where(and(
                eq(sysOauthAccount.provider, provider),
                eq(sysOauthAccount.providerUserId, providerUserId)
            ))

        expect(rows.length).toBe(1)
        expect(rows[0]!.isDeleted).toBe(0)
        expect(rows[0]!.id).toBe(before!.id)
    })

    it('11. 残留软删行且原用户已不存在 → 重新建号并复用该行', async () => {
        await setRegisterEnabled(true)
        const provider = mark('p2')
        const providerUserId = mark('pid')

        // 手动构造一条「孤儿」软删绑定：没有对应的 sys_user
        await db.insert(sysOauthAccount).values({
            id: randomUuid(),
            userId: randomUuid(),
            provider,
            providerUserId,
            providerLogin: mark('gh'),
            isDeleted: 1
        })

        const sessionUser = await service().loginByOAuth({
            provider,
            providerUserId,
            login: mark('gh'),
            email: `${PREFIX}orphan@test.local`
        })

        expect(sessionUser.id).toBeTruthy()

        const rows = await db.select().from(sysOauthAccount)
            .where(and(
                eq(sysOauthAccount.provider, provider),
                eq(sysOauthAccount.providerUserId, providerUserId)
            ))

        expect(rows.length).toBe(1)
        expect(rows[0]!.isDeleted).toBe(0)
        expect(rows[0]!.userId).toBe(sessionUser.id)
    })

    it('12. 前端解绑（硬删除）后同一账号再次登录 → 能重新绑定', async () => {
        await setRegisterEnabled(true)
        const provider = mark('p3')
        const email = `${PREFIX}rebind@test.local`
        const providerUserId = mark('pid')
        const login = mark('gh')
        const svc = service()

        const first = await svc.loginByOAuth({ provider, providerUserId, login, email })
        const bound = await findBinding(provider, providerUserId)
        expect(bound).toBeTruthy()

        // 走控制器调用的同一个 remove 实现（硬删除）
        await svc.remove(bound!.id)

        const gone = await findBinding(provider, providerUserId)
        expect(gone).toBeNull()

        // 同一第三方账号再次登录：必须能重新写入绑定，而不是撞唯一键
        const second = await svc.loginByOAuth({ provider, providerUserId, login, email })
        expect(second.id).toBe(first.id)

        const rebound = await findBinding(provider, providerUserId)
        expect(rebound).toBeTruthy()
        expect(rebound!.isDeleted).toBe(0)
    })

    it('13. 个人中心：listMyBindings 只返回自己的绑定，removeMyBinding 拒绝跨用户解绑', async () => {
        const provider = mark('p4')
        const ownerId = mark('owner')
        const otherId = mark('other')
        const bindingId = randomUuid()
        const providerUserId = mark('pid')
        const rebindUserId = mark('rebind')

        await db.insert(sysOauthAccount).values({
            id: bindingId,
            userId: ownerId,
            provider,
            providerUserId,
            providerLogin: mark('gh'),
            isDeleted: 0
        })

        const ownerCtx: Context = { ...createTestContext(), user: { id: ownerId, username: 'owner' } as any }
        const otherCtx: Context = { ...createTestContext(), user: { id: otherId, username: 'other' } as any }

        // 只应看到自己的那一条
        const mine = await sysOauthAccountService(ownerCtx).listMyBindings()
        expect(mine.length).toBe(1)
        expect(mine[0]!.id).toBe(bindingId)
        expect(mine[0]!.provider).toBe(provider)

        // 别人的视图里不应出现这条
        const othersView = await sysOauthAccountService(otherCtx).listMyBindings()
        expect(othersView.find(b => b.id === bindingId)).toBeUndefined()

        // 跨用户解绑必须被拒
        await expect(
            sysOauthAccountService(otherCtx).removeMyBinding(bindingId, otherId)
        ).rejects.toThrow(/oauthBindingNotFound/)

        // 本人解绑：物理删除
        await sysOauthAccountService(ownerCtx).removeMyBinding(bindingId, ownerId)

        const freed = await db.select({ id: sysOauthAccount.id }).from(sysOauthAccount)
            .where(eq(sysOauthAccount.id, bindingId))
        expect(freed.length).toBe(0)

        // 关键：同一 (provider, providerUserId) 能再次插入 —— 证明唯一键已释放
        await db.insert(sysOauthAccount).values({
            id: randomUuid(),
            userId: rebindUserId,
            provider,
            providerUserId,
            isDeleted: 0
        })

        const rebound = await findBinding(provider, providerUserId)
        expect(rebound).toBeTruthy()
        expect(rebound!.userId).toBe(rebindUserId)
    })

    // 密码状态逻辑：OAuth 建号用固定占位标记 → 未设置过密码可免原密码；
    // 一旦设成真实哈希，再改就必须校验原密码（防止绕过保护）。
    it('14. 未设置过密码可免原密码；已设置过后必须校验原密码', async () => {
        await setRegisterEnabled(true)

        // ① OAuth 建号：password 应为占位标记，而非随机哈希
        const provider = mark('p5')
        const sessionUser = await service().loginByOAuth({
            provider,
            providerUserId: mark('pid'),
            login: mark('gh'),
            email: `${PREFIX}pwd@test.local`
        })

        const rows = await db.select({ password: sysUser.password }).from(sysUser)
            .where(eq(sysUser.id, sessionUser.id)).limit(1)
        expect(rows[0]!.password).toBe(OAUTH_PLACEHOLDER_PASSWORD)

        const userSvc = sysUserService(ctx)
        expect((await userSvc.getPasswordStatus(sessionUser.id))?.hasPassword).toBe(false)
        // 占位标记不可用于登录
        expect(await verifyUserPassword(rows[0]!.password, OAUTH_PLACEHOLDER_PASSWORD)).toBe(false)

        // ② 首次设置密码：无需原密码
        const userCtx: Context = {
            ...createTestContext(),
            user: { id: sessionUser.id, username: sessionUser.username } as any
        }
        const caller = createCallerFactory<AppRouter>(appRouter)(userCtx)

        await caller.auth.setPassword({ password: 'pw123456', confirmPassword: 'pw123456' })
        expect((await userSvc.getPasswordStatus(sessionUser.id))?.hasPassword).toBe(true)

        // ③ 已设置过：不带原密码必须被拒
        await expect(
            caller.auth.setPassword({ password: 'pw654321', confirmPassword: 'pw654321' })
        ).rejects.toMatchObject({ cause: { i18nKey: 'auth.oldPasswordRequired' } })

        // ④ 原密码错误必须被拒
        await expect(
            caller.auth.setPassword({ oldPassword: 'wrong', password: 'pw654321', confirmPassword: 'pw654321' })
        ).rejects.toMatchObject({ cause: { i18nKey: 'auth.invalidCredentials' } })

        // ⑤ 原密码正确才放行
        await caller.auth.setPassword({ oldPassword: 'pw123456', password: 'pw654321', confirmPassword: 'pw654321' })
        expect(await verifyUserPassword(
            (await db.select({ password: sysUser.password }).from(sysUser)
                .where(eq(sysUser.id, sessionUser.id)).limit(1))[0]!.password,
            'pw654321'
        )).toBe(true)
    })
})
