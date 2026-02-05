import type { SysUserDto } from '#shared/system/user/common'

/**
 * 随机整数（min ~ max）
 */
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 随机字符串
 */
function randomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length })
        .map(() => chars[randomInt(0, chars.length - 1)])
        .join('')
}

/**
 * 随机邮箱
 */
function randomEmail(username: string): string {
    const domains = ['gmail.com', 'qq.com', 'outlook.com', 'company.com']
    return `${username}@${domains[randomInt(0, domains.length - 1)]}`
}

/**
 * 随机头像 URL
 */
function randomAvatar(): string {
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${randomString(8)}`
}

/**
 * 生成单个 SysUserDto
 */
export function generateMockUser(index: number): SysUserDto {
    const username = `user_${randomString(5)}`
    const now = new Date().toISOString()

    return {
        id: String(index + 1),

        username,
        email: randomEmail(username),

        nickname: Math.random() > 0.5 ? `昵称${index + 1}` : null,

        password: randomString(10),

        avatar: Math.random() > 0.3 ? randomAvatar() : '',

        phone: Math.random() > 0.5 ? `138${randomInt(10000000, 99999999)}` : null,

        gender: Math.random() > 0.5 ? randomInt(0, 2) : null,

        deptId: Math.random() > 0.5 ? String(randomInt(1, 10)) : null,

        isAdmin: Math.random() > 0.8 ? 1 : 0,

        status: Math.random() > 0.2 ? 1 : 2,

        remark: Math.random() > 0.5 ? `备注信息-${randomString(6)}` : null,

        createdAt: now,
        updatedAt: now,
    }
}

/**
 * ✅ 随机生成 min ~ max 条 SysUserDto 数组
 */
export function generateMockUsers(min: number, max: number): SysUserDto[] {
    const count = randomInt(min, max)

    return Array.from({ length: count }).map((_, i) =>
        generateMockUser(i),
    )
}
