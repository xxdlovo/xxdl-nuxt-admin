import { createTRPCNuxtHandler } from 'trpc-nuxt/server'
import { createContext } from '#admin/server/trpc/context'
import { appRouter } from '#admin/server/trpc/routers'

export default  createTRPCNuxtHandler({
  endpoint: '/api/trpc',
  router: appRouter,
  createContext: createContext,
})