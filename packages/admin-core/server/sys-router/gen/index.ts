import { router, proc } from '#admin/server/trpc/init'
import z from 'zod'
import {
    GenImportSchema,
    GenPageQuerySchema,
    GenPreviewSchema,
    GenSaveColumnsSchema,
    GenUpdateTableSchema,
} from '#admin/shared/system/gen'
import { sysGenService } from './SysGenService'

const listProc = proc({ permission: 'system:gen:list', dataScope: false })
const importProc = proc({ permission: 'system:gen:import', dataScope: false, repeatSubmit: true })
const editProc = proc({ permission: 'system:gen:edit', dataScope: false })
const previewProc = proc({ permission: 'system:gen:preview', dataScope: false })
const delProc = proc({ permission: 'system:gen:del', dataScope: false })

export const sysGenRouter = router({
    page: listProc.input(GenPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysGenService(ctx).page(input)
        }),
    dbTables: listProc
        .query(async ({ ctx }) => {
            return sysGenService(ctx).dbTables()
        }),
    importTables: importProc.input(GenImportSchema)
        .mutation(async ({ ctx, input }) => {
            return sysGenService(ctx).importTables(input.tableNames)
        }),
    getConfig: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysGenService(ctx).getConfig(input)
        }),
    updateTable: editProc.input(GenUpdateTableSchema)
        .mutation(async ({ ctx, input }) => {
            return sysGenService(ctx).updateTable(input)
        }),
    saveColumns: editProc.input(GenSaveColumnsSchema)
        .mutation(async ({ ctx, input }) => {
            return sysGenService(ctx).saveColumns(input)
        }),
    preview: previewProc.input(GenPreviewSchema)
        .query(async ({ ctx, input }) => {
            return sysGenService(ctx).preview(input.id)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysGenService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysGenService(ctx).batchRemove(input)
        }),
})
