import 'dotenv/config'
import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import { eq } from 'drizzle-orm'
import * as schema from '../server/drizzle/schema'
import { sysUser } from '../server/drizzle/schema'
import { randomUuid } from '../shared/utils/uuid'
import { hashUserPassword } from '../server/utils/password'

const username = process.env.ADMIN_USERNAME || 'admin'
const password = process.env.ADMIN_PASSWORD
const email = process.env.ADMIN_EMAIL || `${username}@example.com`

if (!password || password.length < 6) {
  throw new Error('ADMIN_PASSWORD is required and must be at least 6 characters.')
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'nuxt_admin',
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0
})

try {
  const db = drizzle(pool, {
    schema,
    mode: 'default'
  })
  const hashedPassword = await hashUserPassword(password)
  const existing = await db
    .select({ id: sysUser.id })
    .from(sysUser)
    .where(eq(sysUser.username, username))
    .limit(1)

  if (existing[0]) {
    await db
      .update(sysUser)
      .set({
        password: hashedPassword,
        email,
        isAdmin: 1,
        status: 1,
        isDeleted: 0
      })
      .where(eq(sysUser.id, existing[0].id))

    console.log(`Admin user "${username}" has been reset.`)
  } else {
    await db.insert(sysUser).values({
      id: randomUuid(),
      username,
      password: hashedPassword,
      email,
      nickname: 'Administrator',
      avatar: '',
      isAdmin: 1,
      status: 1,
      isDeleted: 0
    })

    console.log(`Admin user "${username}" has been created.`)
  }
} finally {
  await pool.end()
}
