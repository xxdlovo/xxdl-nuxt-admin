
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
