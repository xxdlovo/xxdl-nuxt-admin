import { describe, it, expect,beforeAll  } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

describe('tRPC 接口集成测试', async () => {
    // 1. 启动 Nuxt 服务器
    // await setup()
    // beforeAll(async () => {
    // 指定host可以复用已有的环境
        await setup({
            host: 'http://localhost:3000'
        })
    // })
    it('查询id为1的数据', async () =>{
        const input = JSON.stringify({ 0: '1' })
        const response = await $fetch(`/api/trpc/sysUser.getById?batch=1&input=${encodeURIComponent(input)}`)
        expect(response[0].result.data.id).toBe('1')
    })

})