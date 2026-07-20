declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    email?: string | null
    nickname?: string | null
    avatar?: string | null
    phone?: string | null
    gender?: number | null
    isAdmin?: number | null
  }

  interface UserSession {
    loggedInAt?: string
  }
}

export {}
