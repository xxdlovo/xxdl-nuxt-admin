import { z } from 'zod'

/**
 * sys_oauth_config.extra 的结构。
 *
 * 只有少数平台需要覆盖默认端点或附加授权参数（如 GitHub 的 allow_signup、
 * 自建 Gitea 的 authorizationURL/apiURL），因此这类差异统一放 JSON 列，
 * 避免为个别平台在表上增加专用字段。
 */
export const OauthExtraSchema = z.object({
    /** 覆盖授权端点，自建服务或私有部署时使用 */
    authorizationURL: z.string().nullish(),
    /** 覆盖 token 端点 */
    tokenURL: z.string().nullish(),
    /** 覆盖用户信息接口地址 */
    apiURL: z.string().nullish(),
    /** 附加到授权 URL 的查询参数，例如 { allow_signup: 'true' } */
    authorizationParams: z.record(z.string(), z.string()).nullish(),
    /** 用户信息中邮箱字段名，平台字段不统一时用（默认 email） */
    emailField: z.string().nullish(),
    /** 用户信息中头像字段名（默认 avatar_url） */
    avatarField: z.string().nullish(),
    /** 用户信息中昵称/登录名字段名（默认 login） */
    loginField: z.string().nullish(),
})
export type OauthExtra = z.infer<typeof OauthExtraSchema>
