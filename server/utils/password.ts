import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const hash = new Hash(new Scrypt({}))

export async function hashUserPassword(password: string) {
  return hash.make(password)
}

export async function verifyUserPassword(hashedPassword: string, plainPassword: string) {
  return hash.verify(hashedPassword, plainPassword)
}
