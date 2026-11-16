declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    email?: string | null
    nickname?: string | null
    avatar?: string | null
    phone?: string | null
    gender?: number | null
    deptId?: string | null
    isAdmin?: number | null
  }

  interface UserSession {
    loggedInAt?: string
    /** 在线会话 id；旧会话可能没有，鉴权时按“无 id 视为有效”兼容。 */
    sessionId?: string
  }
}

export {}
