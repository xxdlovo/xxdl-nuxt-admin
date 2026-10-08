import { useLogger } from 'evlog'
import { sysOauthAccountRepo } from './SysOauthAccountRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysOauthAccountAddDTO,
    SysOauthAccountDto,
    SysOauthAccountPageQueryDTO,
    SysOauthAccountQueryDTO,
    SysOauthAccountUpdateDTO
} from '#shared/system/oauthAccount'
import { randomUuid } from '#shared/utils/uuid'
import { sysConfigService } from '#server/sys-router/config/SysConfigService'
import { systemRegisterEnum, OAUTH_PLACEHOLDER_PASSWORD } from '#shared/constants/business'
import { sysUserRepo } from '#server/sys-router/user/SysUserRepo'
import { sysRoleRepo } from '#server/sys-router/role/SysRoleRepo'
import { sysUserRoleRepo } from '#server/sys-router/userRole/SysUserRoleRepo'
import { memberService } from '#server/trade-router/domain/member/MemberService'

/** 第三方登录回调传入的、已归一化的用户资料 */
export type OAuthLoginProfile = {
    provider: string
    providerUserId: string
    login?: string | null
    email?: string | null
    nickname?: string | null
    avatar?: string | null
    /** 原始资料（各平台结构不同），会 JSON 化后存入 raw_profile */
    raw?: unknown
    /** 首次建号时分配的默认角色，来自 sys_oauth_config.default_role_id */
    defaultRoleId?: string | null
}

/** 与 auth.login 返回的 sessionUser 保持完全一致的字段集合 */
export type OAuthSessionUser = {
    id: string
    username: string
    email: string | null
    nickname: string | null
    avatar: string | null
    phone: string | null
    gender: number | null
    deptId: string | null
    isAdmin: number | null
}

function toSessionUser(user: {
    id: string
    username: string
    email: string | null
    nickname: string | null
    avatar: string | null
    phone: string | null
    gender: number | null
    deptId: string | null
    isAdmin: number | null
}): OAuthSessionUser {
    return {
        id: user.id,
        username: user.username,
        email: user.email ?? null,
        nickname: user.nickname ?? null,
        avatar: user.avatar ?? null,
        phone: user.phone ?? null,
        gender: user.gender ?? null,
        deptId: user.deptId ?? null,
        isAdmin: user.isAdmin ?? null
    }
}

/** 当前用户自己的第三方绑定（个人中心展示用） */
export type MyOauthBinding = {
    id: string
    provider: string
    providerLogin: string | null
    avatar: string | null
    createdAt: string | null
}

export function sysOauthAccountService(ctx: Context) {
    const repo = sysOauthAccountRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/oauthAccount')
    const userRepo = sysUserRepo(ctx)
    const roleRepo = sysRoleRepo(ctx)
    const userRoleRepo = sysUserRoleRepo(ctx)

    /** 按 id 取未软删的系统用户 */
    async function findUserById(id: string) {
        return await userRepo.getActiveById(id)
    }

    /** 按邮箱取未软删的系统用户（邮箱在库中唯一） */
    async function findUserByEmail(email: string) {
        return await userRepo.getActiveByEmail(email)
    }

    /** 生成不冲突的 username：与已有用户冲突时追加 _gh_{providerUserId} */
    async function resolveUsername(login: string, providerUserId: string) {
        const base = (login || `oauth_${providerUserId}`).trim().slice(0, 50)

        if (!(await userRepo.existsUsername(base))) {
            return base
        }

        const suffix = `_gh_${providerUserId}`.slice(0, 20)
        return `${base.slice(0, Math.max(1, 50 - suffix.length))}${suffix}`
    }

    /** 首次建号时按配置分配默认角色；角色不存在或已禁用时跳过，不阻断登录 */
    async function assignDefaultRole(userId: string, roleId?: string | null) {
        if (!roleId) return

        if (!(await roleRepo.findEnabledById(roleId))) {
            console.warn(`[oauth] 默认角色不存在或已禁用，跳过分配: ${roleId}`)
            return
        }

        if (await userRoleRepo.existsLink(userId, roleId)) return

        await userRoleRepo.createLink(userId, roleId, userId)
    }

    /**
     * 建立绑定，但若唯一键上已有残留行（手动删库留下的软删记录、
     * 或过去软删除的绑定）则复用该行而不是插入，避免
     * uk_oauth_provider_user 冲突导致登录失败。
     */
    async function bindOrRevive(params: {
        userId: string
        provider: string
        providerUserId: string
        providerLogin?: string | null
        avatar?: string | null
        rawProfile?: string | null
        operatorId: string
    }) {
        const existing = await repo.getByProviderUserIdIncludingDeleted(
            params.provider,
            params.providerUserId
        )

        if (existing) {
            await repo.reviveBinding(existing.id, {
                userId: params.userId,
                providerLogin: params.providerLogin,
                avatar: params.avatar,
                rawProfile: params.rawProfile,
                updatedBy: params.operatorId
            })
            return existing.id
        }

        const bindingId = randomUuid()
        await repo.createBinding({
            id: bindingId,
            userId: params.userId,
            provider: params.provider,
            providerUserId: params.providerUserId,
            providerLogin: params.providerLogin,
            avatar: params.avatar,
            rawProfile: params.rawProfile,
            createdBy: params.operatorId,
            updatedBy: params.operatorId
        })
        return bindingId
    }

    return {
        async create(data: SysOauthAccountAddDTO): Promise<boolean> {
            const uuid = randomUuid()         // 自动生成主键
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('oauthAccount created', { oauthAccount: { action: 'create', id: uuid } })
            return true
        },
        /**
         * 解绑：硬删除绑定行。
         *
         * 不能用 CommonRepo.remove 的软删除 —— 唯一索引 (provider, provider_user_id)
         * 不含 is_deleted，软删后该行仍占用唯一键，用户再次用同一第三方账号登录时
         * 插入会失败。解绑的目的正是释放这个占位，因此直接物理删除。
         */
        async remove(id: string): Promise<boolean> {
            await repo.hardDeleteById(id)
            log.info('oauthAccount removed', { oauthAccount: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            const count = await repo.hardDeleteByIds(ids)
            log.info('oauthAccount batch removed', { oauthAccount: { action: 'batchRemove', count } })
            return count
        },
        async updateById(id: string, data: SysOauthAccountUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            log.info('oauthAccount updated', { oauthAccount: { action: 'update', id } })
            return true
        },
        async getOne(req: SysOauthAccountQueryDTO): Promise<SysOauthAccountDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('oauthAccount fetched', { oauthAccount: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysOauthAccountDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('oauthAccount fetched', { oauthAccount: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysOauthAccountPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto)
            log.info('oauthAccount page queried', {
                oauthAccount: { action: 'page', page, pageSize, total: result.total }
            })
            return result
        },
        async list(dto: any): Promise<SysOauthAccountDto[]> {
            const list = await repo.list(dto)
            log.info('oauthAccount listed', { oauthAccount: { action: 'list', count: list.length } })
            return list
        },

        /**
         * 当前登录用户自己的第三方绑定列表。
         *
         * 只按 ctx.user.id 过滤，且不依赖 CommonRepo 的默认过滤/数据权限，
         * 保证任何登录用户（含无 system:oauthAccount:list 权限的普通用户）
         * 都能看到并管理自己的绑定。
         */
        async listMyBindings(): Promise<MyOauthBinding[]> {
            const userId = ctx.user?.id
            if (!userId) {
                throw new AppError('auth.unauthorized')
            }

            const rows = await repo.listByUserId(userId)

            const list = rows.map(row => ({
                id: row.id,
                provider: String(row.provider ?? '').trim().toLowerCase(),
                providerLogin: row.providerLogin ?? null,
                avatar: row.avatar ?? null,
                createdAt: row.createdAt ?? null
            }))

            log.info('oauthAccount my bindings listed', {
                oauthAccount: { action: 'listMyBindings', count: list.length }
            })

            return list
        },

        /**
         * 解绑当前用户自己的第三方账号。
         *
         * 先校验该绑定确实归属当前用户；随后硬删除以释放唯一键
         * （uk_oauth_provider_user 不含 is_deleted，软删会导致再次登录插不进去）。
         */
        async removeMyBinding(bindingId: string, operatorUserId: string): Promise<boolean> {
            if (!operatorUserId) {
                throw new AppError('auth.unauthorized')
            }

            const owned = await repo.findOwnedById(bindingId, operatorUserId)

            if (!owned) {
                throw new AppError('auth.oauthBindingNotFound')
            }

            await repo.hardDeleteById(bindingId)
            log.info('oauthAccount binding removed', {
                oauthAccount: { action: 'removeMyBinding', id: bindingId }
            })
            return true
        },

        /**
         * 第三方登录主流程：绑定查询 → 邮箱关联 → 首次建号 → 建/读绑定 → 返回 session 用户。
         *
         * 由 server/routes/auth/[platform].get.ts 的回调调用；这里不碰 session，
         * 只负责账号侧的业务规则，便于脱离 OAuth 网络调用做单测。
         */
        async loginByOAuth(profile: OAuthLoginProfile): Promise<OAuthSessionUser> {
            const { provider, providerUserId, defaultRoleId } = profile
            const email = profile.email?.trim() || null
            const login = profile.login?.trim() || null

            // ① 已绑定且未软删：直接取回系统用户。
            // 注意这里要查「含软删」的记录：若命中一条软删残留行，说明该第三方账号
            // 之前被解绑过，直接 insert 会撞 uk_oauth_provider_user，必须走下方复用逻辑。
            const binding = await repo.getByProviderUserIdIncludingDeleted(provider, providerUserId)

            if (binding && binding.isDeleted === 0) {
                if (!binding.userId) {
                    throw new AppError('common.notExist')
                }

                const boundUser = await findUserById(binding.userId)
                if (!boundUser) {
                    throw new AppError('common.notExist')
                }
                if (boundUser.status !== 1) {
                    throw new AppError('auth.userIsBlock')
                }

                log.info('oauthAccount login bound', {
                    oauthAccount: { action: 'loginByOAuth', id: boundUser.id, provider }
                })

                return toSessionUser(boundUser)
            }

            // ② 未绑定：邮箱命中已有账号 → 视为同一用户，补一条绑定
            if (email) {
                const emailUser = await findUserByEmail(email)

                if (emailUser) {
                    if (emailUser.status !== 1) {
                        throw new AppError('auth.userIsBlock')
                    }

                    await bindOrRevive({
                        userId: emailUser.id,
                        provider,
                        providerUserId,
                        providerLogin: login,
                        avatar: profile.avatar ?? null,
                        rawProfile: JSON.stringify(profile.raw ?? null).slice(0, 5000),
                        operatorId: emailUser.id
                    })

                    log.info('oauthAccount login bound', {
                        oauthAccount: { action: 'loginByOAuth', id: emailUser.id, provider }
                    })

                    return toSessionUser(emailUser)
                }
            }

            // ③ 首次注册：受 system_register_enable 开关约束，与密码注册口径一致
            const registerFlag = await sysConfigService(ctx)
                .getValueByKey(systemRegisterEnum.key)

            if (registerFlag !== systemRegisterEnum.yes) {
                throw new AppError('auth.registerDisabled')
            }

            if (!email) {
                throw new AppError('auth.oauthEmailRequired')
            }

            const newUserId = randomUuid()
            const username = await resolveUsername(login ?? '', providerUserId)

            await userRepo.createUser({
                id: newUserId,
                username,
                // 不写随机哈希，而是写固定占位标记：这样能区分「从未设置过密码」与
                // 「已设置真实密码」，前端据此决定是否要求输入原密码。
                password: OAUTH_PLACEHOLDER_PASSWORD,
                email,
                nickname: profile.nickname?.trim() || login || username,
                avatar: profile.avatar?.slice(0, 255) ?? null,
                phone: null,
                gender: 0,
                deptId: null,
                isAdmin: 0,
                status: 1,
                isDeleted: 0,
                createdBy: newUserId,
                updatedBy: newUserId
            })

            await assignDefaultRole(newUserId, defaultRoleId)

            await bindOrRevive({
                userId: newUserId,
                provider,
                providerUserId,
                providerLogin: login,
                avatar: profile.avatar ?? null,
                rawProfile: JSON.stringify(profile.raw ?? null).slice(0, 5000),
                operatorId: newUserId
            })

            /**
             * 第三方首登即开会员档案（含注册赠金）。
             * 失败不影响登录：档案可由 `member:backfill-profile` 任务补齐，
             * 这里只记录一次错误，避免挡在登录主链路上。
             */
            try {
                await memberService(ctx.db).onboard({
                    userId: newUserId,
                    inviteCode: null,
                    source: 'oauth',
                    operatorId: newUserId
                })
            } catch (error) {
                console.error(`[member] 第三方首登开通会员档案失败 userId=${newUserId}`, error)
            }

            const created = await findUserById(newUserId)
            if (!created) {
                throw new AppError('common.notExist')
            }

            log.info('oauthAccount login created', {
                oauthAccount: { action: 'loginByOAuth', id: newUserId, provider }
            })

            return toSessionUser(created)
        },
    }
}
