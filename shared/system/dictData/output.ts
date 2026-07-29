import { SysDictDataBaseSchema } from './common'
import { z } from 'zod'

export const SysDictDataRespSchema = z.object({
    id: SysDictDataBaseSchema.shape.id,
    typeId: SysDictDataBaseSchema.shape.typeId,
    label: SysDictDataBaseSchema.shape.label,
    i18nKey: SysDictDataBaseSchema.shape.i18nKey,
    listClass: SysDictDataBaseSchema.shape.listClass,
    value: SysDictDataBaseSchema.shape.value,
    sortOrder: SysDictDataBaseSchema.shape.sortOrder,
    status: SysDictDataBaseSchema.shape.status,
    remark: SysDictDataBaseSchema.shape.remark,
});
export type SysDictDataRespDTO = z.infer<typeof SysDictDataRespSchema>;
