import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { OAUTH_PLACEHOLDER_PASSWORD } from '#shared/constants/business'

const hash = new Hash(new Scrypt({}))

export async function hashUserPassword(password: string) {
  return hash.make(password)
}

export async function verifyUserPassword(hashedPassword: string, plainPassword: string) {
  return hash.verify(hashedPassword, plainPassword)
}

/**
 * 该用户是否「从未设置过密码」。
 *
 * OAuth 首次建号时，sys_user.password 被写成固定占位标记（非哈希）；
 * 用户一旦设置/修改过密码，该列就会变成 $scrypt$... 哈希。
 * 因此只需比对标记即可区分两种状态，不需要额外数据库字段。
 */
export function isPlaceholderPassword(hashedPassword?: string | null) {
  return hashedPassword === OAUTH_PLACEHOLDER_PASSWORD
}
