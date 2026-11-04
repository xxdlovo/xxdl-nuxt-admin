import { SysJobBaseSchema, SysJobHandlerSchema } from './common'
import { z } from 'zod'

export const SysJobRespSchema = SysJobBaseSchema
export type SysJobRespDTO = z.infer<typeof SysJobRespSchema>

export const SysJobHandlerRespSchema = SysJobHandlerSchema
export type SysJobHandlerRespDTO = z.infer<typeof SysJobHandlerRespSchema>
