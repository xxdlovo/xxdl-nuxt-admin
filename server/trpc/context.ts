import type { H3Event } from 'h3';
import {useDb} from '#server/drizzle/db'
// 上下文
export async function createContext(event: H3Event) {
  return {
      db: useDb(),
      event
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;