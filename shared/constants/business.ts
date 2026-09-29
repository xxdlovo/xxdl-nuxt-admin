
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
