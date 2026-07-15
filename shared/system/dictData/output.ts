import { SysDictDataBaseSchema } from './common'
import { z } from 'zod'

export const SysDictDataRespSchema = z.object({
    id: SysDictDataBaseSchema.shape.id,
    typeId: SysDictDataBaseSchema.shape.typeId,
    label: SysDictDataBaseSchema.shape.label,
    value: SysDictDataBaseSchema.shape.value,
    sortOrder: SysDictDataBaseSchema.shape.sortOrder,
    status: SysDictDataBaseSchema.shape.status,
    remark: SysDictDataBaseSchema.shape.remark,
});
export type SysDictDataRespDTO = z.infer<typeof SysDictDataRespSchema>;
