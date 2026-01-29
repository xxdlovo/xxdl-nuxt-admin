import type { H3Event } from 'h3';
// 上下文
export async function createContext(event: H3Event) {
  return {
    event
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;