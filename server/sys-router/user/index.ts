import { publicProcedure, router } from '~~/server/trpc/init'
import { createContext } from '~~/server/trpc/context'
import type { Context} from '~~/server/trpc/context'


export const sysUserRouter = router({
    test: publicProcedure.mutation(async ({ctx}:{ctx: Context})=>{
        return 'hello word'
    }),


})