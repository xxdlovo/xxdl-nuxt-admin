import { requireCodegenAiAccess } from '#admin/server/utils/codegenAiAccess'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { createServerT } from '#admin/server/utils/serverI18n'
import { CODEGEN_AI_GUIDE } from '#admin/server/gen/ai/guide'

export default defineEventHandler(async (event) => {
    const t = createServerT(event)

    try {
        await requireCodegenAiAccess(event, 'system:gen:list')

        setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
        setHeader(event, 'Cache-Control', 'no-store')

        return CODEGEN_AI_GUIDE
    }
    catch (error) {
        throw createApiRouteError(error, t, 'module.system.gen.ai.guideFailed')
    }
})
