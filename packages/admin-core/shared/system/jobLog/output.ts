import { SysJobLogBaseSchema } from './common'
import { z } from 'zod'

export const SysJobLogRespSchema = SysJobLogBaseSchema
export type SysJobLogRespDTO = z.infer<typeof SysJobLogRespSchema>
