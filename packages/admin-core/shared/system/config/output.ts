import { z } from 'zod'
import { SysConfigBaseSchema } from './common'

export const SysConfigRespSchema = z.object({
  id: SysConfigBaseSchema.shape.id,
  configName: SysConfigBaseSchema.shape.configName,
  configKey: SysConfigBaseSchema.shape.configKey,
  configValue: SysConfigBaseSchema.shape.configValue,
  configType: SysConfigBaseSchema.shape.configType,
  status: SysConfigBaseSchema.shape.status,
  remark: SysConfigBaseSchema.shape.remark,
  createdAt: SysConfigBaseSchema.shape.createdAt
})

export type SysConfigRespDTO = z.infer<typeof SysConfigRespSchema>
