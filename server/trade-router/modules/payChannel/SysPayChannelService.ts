import { sysPayChannelRepo } from './SysPayChannelRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { toChannelRuntime } from '#server/trade-router/domain/pay/PayChannelResolver'
import {
    describePayConfigKey,
    encryptConfigSecrets,
    isSecretEnvelope,
    isUnchangedSecretInput,
    maskConfigSecrets
} from '#server/trade-router/domain/pay/crypto'
import { getPayProvider, listPayProviderMetas } from '#server/trade-router/domain/pay/providers'
import type { PayChannelRow } from '#server/trade-router/domain/pay/repo/payChannelRepo'
import { nowForMysql, truncateText } from '#server/trade-router/domain/pay/utils'
import type { PayProvider } from '#server/trade-router/domain/pay/types'
import type {
    SysPayChannelAddDTO,
    SysPayChannelDto,
    SysPayChannelPageQueryDTO,
    SysPayChannelQueryDTO,
    SysPayChannelUpdateDTO,
    SysPayVerifyResultDTO
} from '#shared/system/payChannel'
import { randomUuid } from '#shared/utils/uuid'

/** 渠道行类型直接取自 mapper，避免 Service 再依赖 drizzle schema */
type ChannelRow = PayChannelRow

function asConfigRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>
    }

    return {}
}

function providerOf(channelCode?: string | null): PayProvider {
    const provider = getPayProvider(channelCode)

    if (!provider) {
        throw new AppError('module.system.payChannel.providerUnsupported', {
            message: String(channelCode ?? '')
        })
    }

    return provider
}

/** 出入接口的渠道配置：密钥字段一律掩码 */
function maskRow(row: ChannelRow): SysPayChannelDto {
    const provider = getPayProvider(row.channelCode)

    return {
        ...row,
        config: provider
            ? maskConfigSecrets(provider.fields, asConfigRecord(row.config))
            : asConfigRecord(row.config)
    } as SysPayChannelDto
}

export function sysPayChannelService(ctx: Context) {
    const repo = sysPayChannelRepo(ctx)

    /**
     * 组装要落库的 config：
     * - 新增：必填字段必须提供，并校验类型；
     * - 修改：密钥留空/掩码、可选字段留空都表示「不修改」（保留原值），其余字段以新值覆盖。
     *
     * 注意：只有「本次真正提交的新值」才参与 configSchema 校验，
     * 拿整个 inputConfig 去校验会把「留空表示不修改」误判成校验失败。
     */
    function buildConfigForWrite(
        provider: PayProvider,
        incoming: unknown,
        existing: Record<string, unknown> | null
    ): Record<string, unknown> {
        const inputConfig = asConfigRecord(incoming)
        const next: Record<string, unknown> = { ...(existing ?? {}) }
        /**
         * 本次真正要写入的新值（留空/掩码的密钥已被剔除）。
         * 校验必须用它而不是 inputConfig：密钥留空表示「不修改」，
         * 而 configSchema 里的 min(1) 会把空字符串判成校验失败。
         */
        const validationInput: Record<string, unknown> = {}

        for (const [key, value] of Object.entries(inputConfig)) {
            const field = provider.fields.find(item => item.key === key)

            // 1) 密钥留空/掩码 → 保留原密文，不参与校验也不覆盖
            if (field?.secret && isUnchangedSecretInput(value)) {
                continue
            }
            // 2) 可选字段留空 → 视为不修改（保留原值；新增时由 configSchema 的默认值兜底），
            //    否则 min(1) 这类规则会把「清空 gateway」判成校验失败
            if (field && !field.required && (value === undefined || value === null || value === '')) {
                continue
            }
            if (value === undefined) {
                continue
            }

            validationInput[key] = value
            next[key] = value
        }

        // 类型校验只针对本次提交的新值；留空的密钥与保留的密文都不参与校验
        const parseResult = provider.configSchema.partial().safeParse(validationInput)

        if (!parseResult.success) {
            throw new AppError('module.system.payChannel.configInvalid', {
                message: parseResult.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
            })
        }

        const missing = provider.fields
            .filter(field => field.required)
            .filter(field => next[field.key] === undefined || next[field.key] === null || next[field.key] === '')
            .map(field => field.key)

        if (missing.length > 0) {
            throw new AppError('module.system.payChannel.configFieldRequired', {
                message: missing.join(', ')
            })
        }

        // 本次提交包含新的密钥值时必须先确认服务端已配置可用的加密密钥，避免落库后无法解密
        const hasNewSecret = Object.keys(validationInput).some((key) => {
            const field = provider.fields.find(item => item.key === key)
            return Boolean(field?.secret)
        })

        if (hasNewSecret) {
            const keyState = describePayConfigKey()

            if (!keyState.ready) {
                throw new AppError(
                    keyState.reason === 'invalid'
                        ? 'module.system.payChannel.configKeyInvalid'
                        : 'module.system.payChannel.configKeyMissing'
                )
            }
        }

        return encryptConfigSecrets(provider.fields, next)
    }

    return {
        async create(data: SysPayChannelAddDTO): Promise<boolean> {
            const provider = providerOf(data.channelCode)
            const config = buildConfigForWrite(provider, data.config, null)

            await repo.create({
                ...data,
                id: randomUuid(),
                config,
                verifyStatus: 0,
                verifyTime: null,
                verifyMessage: null
            })

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

        async updateById(id: string, data: SysPayChannelUpdateDTO): Promise<boolean> {
            const row = await repo.getById(id) as ChannelRow | null

            if (!row) {
                throw new AppError('common.notExist')
            }

            const channelCode = data.channelCode ?? row.channelCode
            const configChanged = data.config !== undefined

            if (channelCode !== row.channelCode && !configChanged) {
                throw new AppError('module.system.payChannel.configRequiredOnTypeChange')
            }

            const provider = providerOf(channelCode)
            const config = configChanged
                ? buildConfigForWrite(provider, data.config, asConfigRecord(row.config))
                : asConfigRecord(row.config)

            const values: Record<string, unknown> = { ...data, config }

            if (configChanged || channelCode !== row.channelCode) {
                // 凭据变化后旧的验证结论失效
                values.verifyStatus = 0
                values.verifyTime = null
                values.verifyMessage = null
            }

            await repo.updateById(id, values as SysPayChannelUpdateDTO)

            return true
        },

        async getOne(req: SysPayChannelQueryDTO): Promise<SysPayChannelDto> {
            const row = await repo.getOne(req) as ChannelRow | null

            if (!row) {
                throw new AppError('common.notExist')
            }

            return maskRow(row)
        },

        async getById(id: string): Promise<SysPayChannelDto> {
            const row = await repo.getById(id) as ChannelRow | null

            if (!row) {
                throw new AppError('common.notExist')
            }

            return maskRow(row)
        },

        async page(req: SysPayChannelPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto, repo.channelListOrder())

            return {
                ...result,
                list: (result.list as ChannelRow[]).map(maskRow)
            }
        },

        async list(dto: SysPayChannelQueryDTO): Promise<SysPayChannelDto[]> {
            const rows = await repo.list(dto, repo.channelListOrder()) as ChannelRow[]

            return rows.map(maskRow)
        },

        /** 「测试配置」：调用适配器探测网关与签名，并把结论写回渠道配置 */
        async verify(id: string): Promise<SysPayVerifyResultDTO> {
            const row = await repo.getById(id) as ChannelRow | null

            if (!row) {
                // 查不到渠道行会返回 404 NOT_FOUND，排查时注意与「tRPC 路由 404」区分
                throw new AppError('common.notExist')
            }

            const provider = providerOf(row.channelCode)
            const runtime = toChannelRuntime(row)
            const result = await provider.verifyChannel(runtime)

            await repo.updateById(id, {
                verifyStatus: result.success ? 1 : 2,
                verifyTime: nowForMysql(),
                verifyMessage: truncateText(result.message, 500)
            })

            return result
        },

        /** 设为默认渠道（全局唯一） */
        async setDefault(id: string): Promise<boolean> {
            const row = await repo.getById(id) as ChannelRow | null

            if (!row) {
                throw new AppError('common.notExist')
            }

            await repo.clearOtherDefaults(id)
            await repo.updateById(id, { isDefault: 1 })

            return true
        },

        /** 渠道类型元数据：前端据此渲染「渠道类型」下拉与动态表单 */
        providerMetas() {
            const keyState = describePayConfigKey()

            return {
                providers: listPayProviderMetas(),
                encryptionReady: keyState.ready,
                encryptionReason: keyState.reason
            }
        },

        /** 测试页渠道下拉：只返回可公开字段 */
        async listSelectable() {
            const rows = await repo.listEnabledByCode() as ChannelRow[]

            return rows.map(row => ({
                id: row.id,
                configName: row.configName,
                channelCode: row.channelCode,
                currency: row.currency,
                isDefault: row.isDefault,
                notifyUrl: row.notifyUrl ?? null
            }))
        },

        /** 供其他模块读取明文密钥（仅服务端使用，绝不返回给前端） */
        async getRuntimeById(id: string) {
            const row = await repo.getById(id) as ChannelRow | null

            if (!row) {
                throw new AppError('common.notExist')
            }

            return toChannelRuntime(row)
        },

        /** 判断某个字段当前是否已存在密文（供「密钥已配置」提示用） */
        isSecretConfigured(id: string, fieldKey: string): Promise<boolean> {
            return repo.getById(id).then((row) => {
                const config = asConfigRecord((row as ChannelRow | null)?.config)

                return isSecretEnvelope(config[fieldKey])
            })
        },
    }
}
