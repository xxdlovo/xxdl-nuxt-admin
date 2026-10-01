
import type { BadgeConfig } from '#shared/types/nuxtui'

// 系统字典
export const businessDictCode = {
    ossService: 'oss_service',
    ossAccessPolicy: 'oss_access_policy',
    noYes: 'no_yes',
    ossVerifyStatus: 'oss_verify_status',
    userGender: 'user_gender',
    enableStatus: 'enable_status',
    jobRunningStatus: 'job_running_status',
    jobLogStatus: 'job_log_status',
    jobTriggerType: 'job_trigger_type',
    noticeType: 'notice_type',
    noticePublishStatus: 'notice_publish_status',
    dataScope: 'data_scope',
    menuType: 'menu_type',
    menuIconType: 'menu_icon_type',
    sysLogLevel: 'sys_log_level'
} as const
// 系统配置
export const systemRegisterEnum = {
    key:'system_register_enable',
    yes: 'yes',
    no: 'no',
}

// 其他登录入口开关。配置中心返回的是字符串；缺少该配置时，登录页使用 true 作为默认值。
export const systemOtherLoginEnum = {
    key: 'system_otherlogin_enable',
    enabled: 'true',
    disabled: 'false',
}

/**
 * 第三方登录建号时写入的密码占位符。
 *
 * 背景：sys_user.password 是 NOT NULL，OAuth 建号必须写一个值；但用户并不知道这个值。
 * 这里不写随机哈希，而是写一个固定的非哈希标记，从而可以明确区分两种状态：
 * - 等于该标记  → 从未设置过密码（OAuth 用户），允许直接设置新密码，无需原密码
 * - 其它值      → 真实密码（$scrypt$... 哈希），修改时必须校验原密码
 *
 * 以 "!" 开头是为了与 @adonisjs/hash 生成的 "$scrypt$..." 哈希在形态上无法混淆；
 * 且 hash.verify() 对非法哈希返回 false（已实测），因此该标记永远无法通过密码校验。
 */
export const OAUTH_PLACEHOLDER_PASSWORD = '!oauth-no-password!'

// ---------------------------------------------------------------------------
// 支付模块常量
// ---------------------------------------------------------------------------

/**
 * 统一支付订单状态徽标。
 * 支付状态是「资金结论」，不放进字典表：字典可被后台改坏，支付状态不允许被随意改名。
 */
export const payOrderStatusConfig: Readonly<Record<string, BadgeConfig>> = {
    WP: { i18nKey: 'module.system.payOrder.status.pending', color: 'warning' },
    OD: { i18nKey: 'module.system.payOrder.status.paid', color: 'success' },
    CD: { i18nKey: 'module.system.payOrder.status.cancelled', color: 'neutral' },
    CL: { i18nKey: 'module.system.payOrder.status.closed', color: 'neutral' },
    FL: { i18nKey: 'module.system.payOrder.status.failed', color: 'error' },
    RF: { i18nKey: 'module.system.payOrder.status.refunded', color: 'info' }
}

/** 渠道验证状态（与 sys_oss_config.verify_status 语义一致） */
export const payChannelVerifyConfig: Readonly<Record<string, BadgeConfig>> = {
    '0': { i18nKey: 'module.system.payChannel.verify.pending', color: 'neutral' },
    '1': { i18nKey: 'module.system.payChannel.verify.passed', color: 'success' },
    '2': { i18nKey: 'module.system.payChannel.verify.failed', color: 'error' }
}

/** 渠道平台标识 → 展示文案 */
export const payChannelCodeRecord: Record<string, string> = {
    xunhupay: 'module.system.payChannel.codeXunhupay',
    mock: 'module.system.payChannel.codeMock',
    codepay: 'module.system.payChannel.codeCodepay',
    stripe: 'module.system.payChannel.codeStripe',
    alipay_f2f: 'module.system.payChannel.codeAlipayF2f'
}

/** 渠道运行模式 */
export const payChannelModeRecord: Record<string, string> = {
    live: 'module.system.payChannel.mode.live',
    test: 'module.system.payChannel.mode.test'
}

/** 支付发起方式 */
export const payModeRecord: Record<string, string> = {
    qrcode: 'module.system.payOrder.payModeName.qrcode',
    redirect: 'module.system.payOrder.payModeName.redirect',
    jsapi: 'module.system.payOrder.payModeName.jsapi',
    web: 'module.system.payOrder.payModeName.web'
}

/** 回调日志来源 */
export const payNotifySourceRecord: Record<string, string> = {
    notify: 'module.system.payNotifyLog.source.notify',
    query: 'module.system.payNotifyLog.source.query',
    simulate: 'module.system.payNotifyLog.source.simulate',
    reconcile: 'module.system.payNotifyLog.source.reconcile'
}

/** 回调日志处理结论徽标 */
export const payNotifyResultConfig: Readonly<Record<string, BadgeConfig>> = {
    success: { i18nKey: 'module.system.payNotifyLog.result.success', color: 'success' },
    duplicate: { i18nKey: 'module.system.payNotifyLog.result.duplicate', color: 'info' },
    invalid_sign: { i18nKey: 'module.system.payNotifyLog.result.invalidSign', color: 'error' },
    order_not_found: { i18nKey: 'module.system.payNotifyLog.result.orderNotFound', color: 'error' },
    amount_mismatch: { i18nKey: 'module.system.payNotifyLog.result.amountMismatch', color: 'error' },
    status_mismatch: { i18nKey: 'module.system.payNotifyLog.result.statusMismatch', color: 'warning' },
    ip_blocked: { i18nKey: 'module.system.payNotifyLog.result.ipBlocked', color: 'error' },
    error: { i18nKey: 'module.system.payNotifyLog.result.error', color: 'error' }
}
