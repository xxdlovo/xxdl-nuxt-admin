import { useLogger } from 'evlog'
import { sysOssRepo } from './SysOssRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysOssAddDTO, SysOssDto, SysOssPageQueryDTO, SysOssQueryDTO, SysOssUpdateDTO } from "#shared/system/oss";
import { randomUuid } from "#shared/utils/uuid";
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
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/oss')
    const configRepo = sysOssConfigRepo(ctx)

    const service = {
        async create(data: SysOssAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('oss created', { oss: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('oss removed', { oss: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('oss batch removed', { oss: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysOssUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            log.info('oss updated', { oss: { action: 'update', id } })
            return true
        },
        async getOne(req: SysOssQueryDTO): Promise<SysOssDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('oss fetched', { oss: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysOssDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('oss fetched', { oss: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysOssPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.pageRecent(page, pageSize, dto)
            log.info('oss page queried', { oss: { action: 'page', page, pageSize, total: result.total } })
            return result
        },
        async list(dto: any): Promise<SysOssDto[]> {
            const list = await repo.listRecent(dto)
            log.info('oss listed', { oss: { action: 'list', count: list.length } })
            return list
        },
        async listUploadConfigs() {
            const list = await configRepo.listUploadable()
            log.info('oss upload configs listed', { oss: { action: 'listUploadConfigs', count: list.length } })
            return list
        },
        async getDefaultUploadConfig() {
            const config = await configRepo.getDefaultUploadable()
            log.info('oss default upload config fetched', { oss: { action: 'getDefaultUploadConfig' } })
            return config
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
            log.info('oss uploaded', { oss: { action: 'uploadFile', id } })
            return record
        },

        /**
         * 头像上传：图片类型校验 + 默认存储配置解析都收在 Service，
         * 路由只负责鉴权与 multipart 解析。
         */
        async uploadAvatar(input: Omit<SysOssUploadFileInput, 'configId'>): Promise<SysOssDto> {
            const contentType = input.contentType || 'application/octet-stream'

            if (!contentType.startsWith('image/')) {
                throw new AppError('module.system.oss.uploadFileRequired')
            }

            const config = await service.getDefaultUploadConfig()

            if (!config?.id) {
                throw new AppError('module.system.oss.uploadConfigUnavailable')
            }

            const record = await service.uploadFile({
                configId: config.id,
                fileName: input.fileName,
                contentType,
                body: input.body
            })
            // uploadFile 内部已经记了 'oss uploaded'，这里不重复记日志
            return record
        }
    }

    return service
}
