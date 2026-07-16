declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    nickname?: string | null
    avatar?: string | null
    isAdmin?: number | null
  }

  interface UserSession {
    loggedInAt?: string
  }
}

export {}
