// 系统用户相关 API 测试
import { describe, it, expect, beforeAll } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import {randomUuid} from "../shared/utils/uuid";

describe('系统用户 API 测试', async () => {
  // 启动 Nuxt 服务器
  await setup({
    host: 'http://localhost:3000'
  })

  // 定义测试用例
  it('测试创建用户接口', async () => {
      const uuid = randomUuid();
      console.log(uuid)
      const body = {
          "id": uuid,
          "username": "testuser001",
          "password": "password123",
          "email": "test@example.com",
          "nickname": "TestUser",
          "phone": "13800138000",
          "status": 1
      }
    const userData = [{0:body}]
    try {
        const response = await $fetch('/api/trpc/sysUser.create', {
            method: 'POST',
            body: JSON.stringify(userData),
        })

        expect(response).toBe(true)
    }catch (e) {
        console.log(e)
    }

  })


  it('测试查询单个用户接口', async () => {
    const queryData = {
      username: 'testuser001'
    }
    const input = JSON.stringify({ 0: queryData })
    const response = await $fetch(`/api/trpc/sysUser.getOne?batch=1&input=${encodeURIComponent(input)}`)
    expect(response[0].result.data.username).toBe('testuser001')
  })

  it('测试分页查询用户接口', async () => {
    const pageQuery = {
      page: 1,
      pageSize: 10,
      username: 'testuser001'
    }
    const input = JSON.stringify({ 0: pageQuery })
    const response = await $fetch(`/api/trpc/sysUser.page?batch=1&input=${encodeURIComponent(input)}`)
    expect(Array.isArray(response[0].result.data.list)).toBe(true)
  })

  // it('测试更新用户接口', async () => {
  //   const updateData = {
  //     id: 'test_user_001',
  //     nickname: 'Updated Test User',
  //     email: 'updated@example.com',
  //     phone: '13800138001',
  //     status: 1
  //   }
  //
  //   const response = await $fetch('/api/trpc/sysUser.update', {
  //     method: 'POST',
  //     body: updateData
  //   })
  //
  //   expect(response).toBe(true)
  // })

  // it('测试删除用户接口', async () => {
  //   const input = JSON.stringify({ 0: 'test_user_001' })
  //   const response = await $fetch(`/api/trpc/sysUser.remove?batch=1&input=${encodeURIComponent(input)}`)
  //   expect(response[0].result.data).toBe(true)
  // })
})