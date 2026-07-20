import { sysOssRepo } from './SysOssRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysOssAddDTO, SysOssDto, SysOssPageQueryDTO, SysOssQueryDTO, SysOssUpdateDTO } from "#shared/system/oss";
import { randomUuid } from "#shared/utils/uuid";
import { desc } from 'drizzle-orm'
import { sysOss } from '#server/drizzle/schema'
import { createHash } from 'node:crypto'
import { sysOssConfigRepo } from '#server/sys-router/ossConfig/SysOssConfigRepo'
import { getOssProvider } from '#server/sys-router/ossConfig/providers'
import { createObjectKey, getFileExtension } from '#server/sys-router/ossConfig/providers/utils'

export type SysOssUploadFileInput = {
    configId: string
    fileName: string
    contentType?: string | null
    body: Uint8Array<ArrayBufferLike>
}

export function sysOssService(ctx: Context) {
    const repo = sysOssRepo(ctx)
    const configRepo = sysOssConfigRepo(ctx)

    return {
        async create(data: SysOssAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            return ids.length
        },
        async updateById(id: string, data: SysOssUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysOssQueryDTO): Promise<SysOssDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysOssDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysOssPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto, [desc(sysOss.createdAt)])
        },
        async list(dto: any): Promise<SysOssDto[]> {
            return await repo.list(dto, [desc(sysOss.createdAt)])
        },
        async listUploadConfigs() {
            return await configRepo.listUploadable()
        },
        async uploadFile(input: SysOssUploadFileInput): Promise<SysOssDto> {
            if (!input.fileName) {
                throw new AppError('module.system.oss.uploadFileRequired')
            }
            if (!input.configId) {
                throw new AppError('module.system.oss.uploadConfigRequired')
            }

            const config = await configRepo.getUploadableById(input.configId)
            if (!config) {
                throw new AppError('module.system.oss.uploadConfigUnavailable')
            }

            const provider = getOssProvider(config.service)
            if (!provider) {
                throw new AppError('module.system.oss.uploadProviderUnsupported')
            }

            const id = randomUuid()
            const objectName = createObjectKey(config.prefix, input.fileName, id)
            const contentType = input.contentType || 'application/octet-stream'
            const uploadResult = await provider.upload(config, {
                objectKey: objectName,
                body: input.body,
                contentType
            })
            const md5 = createHash('md5').update(input.body).digest('hex')
            const record = {
                id,
                configId: config.id!,
                fileName: objectName.split('/').pop() || input.fileName,
                originalName: input.fileName,
                fileSuffix: getFileExtension(input.fileName),
                fileSize: input.body.byteLength,
                contentType,
                bucketName: config.bucketName ?? null,
                objectName,
                url: uploadResult.url,
                md5,
                etag: uploadResult.etag ?? null,
                service: config.service!,
                uploadUserId: ctx.user?.id ?? null,
                status: 1,
                remark: null
            }

            await repo.createUploadRecord(record)
            return record
        },
    }
}
