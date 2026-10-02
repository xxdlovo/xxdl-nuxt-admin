import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysOssConfigBaseSchema } from "#shared/system/ossConfig/common";
import { sysOssConfig } from "~~/server/drizzle/schema";
import type { Context } from "#server/trpc/context";
import { and, desc, eq } from "drizzle-orm";

const baseRepo = CommonRepo(sysOssConfig, SysOssConfigBaseSchema)

export const sysOssConfigRepo = (ctx: Context) => {
    const base = baseRepo(ctx)

    return {
        ...base,
        async listUploadable() {
            return ctx.db
                .select({
                    id: sysOssConfig.id,
                    configName: sysOssConfig.configName,
                    service: sysOssConfig.service,
                    bucketName: sysOssConfig.bucketName,
                    domain: sysOssConfig.domain,
                    isDefault: sysOssConfig.isDefault
                })
                .from(sysOssConfig)
                .where(and(
                    eq(sysOssConfig.status, 1),
                    eq(sysOssConfig.verifyStatus, 1),
                    eq(sysOssConfig.isDeleted, 0)
                ))
                .orderBy(desc(sysOssConfig.isDefault), desc(sysOssConfig.createdAt))
        },
        async getDefaultUploadable() {
            const rows = await ctx.db
                .select()
                .from(sysOssConfig)
                .where(and(
                    eq(sysOssConfig.isDefault, 1),
                    eq(sysOssConfig.status, 1),
                    eq(sysOssConfig.verifyStatus, 1),
                    eq(sysOssConfig.isDeleted, 0)
                ))
                .limit(1)

            return rows[0] ?? null
        },
        async getUploadableById(id: string) {
            const rows = await ctx.db
                .select()
                .from(sysOssConfig)
                .where(and(
                    eq(sysOssConfig.id, id),
                    eq(sysOssConfig.status, 1),
                    eq(sysOssConfig.verifyStatus, 1),
                    eq(sysOssConfig.isDeleted, 0)
                ))
                .limit(1)

            return rows[0] ?? null
        },

        /** 写回「测试配置」的探测结论 */
        async updateVerifyResult(id: string, data: {
            verifyStatus: number
            verifyTime: string
            verifyMessage: string
            operatorId: string | null
        }) {
            await ctx.db
                .update(sysOssConfig)
                .set({
                    verifyStatus: data.verifyStatus,
                    verifyTime: data.verifyTime,
                    verifyMessage: data.verifyMessage,
                    updatedBy: data.operatorId
                })
                .where(eq(sysOssConfig.id, id))
        },

        /** 分页查询（创建时间倒序）：排序语义集中在 mapper */
        async pageRecent(page: number, pageSize: number, dto: Record<string, unknown>) {
            return await base.page(page, pageSize, dto, [desc(sysOssConfig.createdAt)])
        },

        /** 列表查询（创建时间倒序） */
        async listRecent(dto: Record<string, unknown>) {
            return await base.list(dto, [desc(sysOssConfig.createdAt)])
        }
    }
}
