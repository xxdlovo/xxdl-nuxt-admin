import { DemoBaseSchema } from './common'
import { z } from 'zod'


export const DemoRespSchema = z.object({
    id: DemoBaseSchema.shape.id,
    field1: DemoBaseSchema.shape.field1,
    field2: DemoBaseSchema.shape.field2,
    status: DemoBaseSchema.shape.status,
    remark: DemoBaseSchema.shape.remark,
});
export type DemoRespDTO = z.infer<typeof DemoRespSchema>;
