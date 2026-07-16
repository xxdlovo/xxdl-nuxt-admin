// 系统用户完整 CRUD 测试
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { randomUuid } from '../shared/utils/uuid'
import { appRouter, type AppRouter } from '../server/trpc/routers'
import { createCallerFactory } from '../server/trpc/init'
import { createTestDb } from '../server/drizzle/db'
import type { Context } from '../server/trpc/context'
import type { SysUserAddDTO } from '../shared/system/user'
import type { inferProcedureOutput } from '@trpc/server'

// 创建测试上下文（不依赖 Nuxt 运行时）
const createTestContext = async (): Promise<Context> => {
    return {
        db: createTestDb(),
        event: {} as any,
        session: {
            user: {
                id: 'test-auth-user',
                username: 'test-admin',
                isAdmin: 1
            }
        },
        user: {
            id: 'test-auth-user',
            username: 'test-admin',
            isAdmin: 1
        }
    }
}

// 创建测试用的 caller
const createCaller = (ctx: Context) => createCallerFactory<AppRouter>(appRouter)(ctx)

// 定义 caller 类型，用于享受类型提示
type Caller = ReturnType<typeof createCaller>

describe('系统用户 CRUD 完整测试', async () => {
    // 绑定已启动的 Nuxt 服务器
    await setup({
        host: 'http://localhost:3000'
    })

    // 生成测试用户 ID
    const testUserId = randomUuid()
    const testUsername = `testuser_${testUserId.slice(0, 8)}`
    const testEmail = `${testUsername}@test.com`

    // 测试用户数据
    const createUserData: SysUserAddDTO = {
        id: testUserId,
        username: testUsername,
        password: 'password123',
        email: testEmail,
        nickname: 'Test User',
        avatar: '',
        phone: '13800138000',
        gender: 1,
        deptId: null,
        status: 1,
        remark: '测试用户备注'
    }

    // 测试用的 caller
    let caller: Caller

    // 每个测试前创建新的 context 和 caller
    beforeEach(async () => {
        const ctx = await createTestContext()
        caller = createCaller(ctx)
    })

    it('1. 创建用户', async () => {
        const result = await caller.sysUser.create(createUserData)

        expect(result).toBeTruthy()
        console.log('✅ 用户创建成功:', result)
    })

    it('2. 根据 ID 查询用户', async () => {
        const result = await caller.sysUser.getById(testUserId)

        expect(result).toBeTruthy()
        expect(result?.id).toBe(testUserId)
        expect(result?.username).toBe(testUsername)
        expect(result?.email).toBe(testEmail)
        console.log('✅ 根据 ID 查询用户成功:', result)
    })

    it('3. 根据用户名查询用户', async () => {
        const result = await caller.sysUser.getOne({ username: testUsername })

        expect(result).toBeTruthy()
        expect(result?.id).toBe(testUserId)
        expect(result?.username).toBe(testUsername)
        console.log('✅ 根据用户名查询用户成功:', result)
    })

    it('4. 根据邮箱查询用户', async () => {
        const result = await caller.sysUser.getOne({ email: testEmail })

        expect(result).toBeTruthy()
        expect(result?.id).toBe(testUserId)
        expect(result?.email).toBe(testEmail)
        console.log('✅ 根据邮箱查询用户成功:', result)
    })

    it('5. 分页查询用户', async () => {
        const result = await caller.sysUser.page({
            page: 1,
            pageSize: 10,
            username: testUsername
        })

        expect(result).toBeTruthy()
        expect(result?.list).toBeInstanceOf(Array)
        expect(result.list.length).toBeGreaterThan(0)
        expect(result.list[0]?.username).toBe(testUsername)
        console.log('✅ 分页查询用户成功:', result)
    })

    it('6. 更新用户', async () => {
        const updateData = {
            ...createUserData,
            nickname: 'Updated Test User',
            phone: '13900139000',
            status: 0,
            remark: '更新后的备注'
        }

        const result = await caller.sysUser.update(updateData)

        expect(result).toBeTruthy()
        console.log('✅ 更新用户成功:', result)

        // 验证更新后的数据
        const updatedUser = await caller.sysUser.getById(testUserId)
        expect(updatedUser?.nickname).toBe('Updated Test User')
        expect(updatedUser?.phone).toBe('13900139000')
        expect(updatedUser?.status).toBe(0)
        expect(updatedUser?.remark).toBe('更新后的备注')
    })

    it('7. 删除用户', async () => {
      const result = await caller.sysUser.remove(testUserId)

      expect(result).toBeTruthy()
      console.log('✅ 删除用户成功:', result)

      // 验证用户已被删除（查询应该返回 null）
      const deletedUser = await caller.sysUser.getById(testUserId)
      expect(deletedUser).toBeNull()
    })
})
