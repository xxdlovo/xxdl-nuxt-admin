import { transformRecordToOption } from '#shared/utils/common';
import type { BadgeConfig } from '#shared/types/nuxtui'

export const ossServiceRecord = {
    aliyun: 'module.system.ossConfig.serviceAliyun',
    tencent: 'module.system.ossConfig.serviceTencent',
    aws: 'module.system.ossConfig.serviceAws'
} as const satisfies Record<string, string>

export const ossServiceOptions = transformRecordToOption(ossServiceRecord)

export const ossAccessPolicyRecord = {
    '0': 'module.system.ossConfig.accessPolicyPrivate',
    '1': 'module.system.ossConfig.accessPolicyPublic'
} as const satisfies Record<string, string>

export const ossAccessPolicyOptions = transformRecordToOption(ossAccessPolicyRecord)

export const ossAccessPolicyConfig = {
    '0': { i18nKey: ossAccessPolicyRecord['0'], color: 'warning' },
    '1': { i18nKey: ossAccessPolicyRecord['1'], color: 'primary' }
} as const satisfies Record<string, BadgeConfig>

export const ossBooleanRecord = {
    '0': 'common.yesOrNo.no',
    '1': 'common.yesOrNo.yes'
} as const satisfies Record<string, string>

export const ossBooleanOptions = transformRecordToOption(ossBooleanRecord)

export const ossBooleanConfig = {
    '0': { i18nKey: ossBooleanRecord['0'], color: 'neutral' },
    '1': { i18nKey: ossBooleanRecord['1'], color: 'primary' }
} as const satisfies Record<string, BadgeConfig>

export const ossVerifyStatusRecord = {
    '0': 'module.system.ossConfig.verifyPending',
    '1': 'module.system.ossConfig.verifyPassed',
    '2': 'module.system.ossConfig.verifyFailed'
} as const satisfies Record<string, string>

export const ossVerifyStatusConfig = {
    '0': { i18nKey: ossVerifyStatusRecord['0'], color: 'neutral' },
    '1': { i18nKey: ossVerifyStatusRecord['1'], color: 'success' },
    '2': { i18nKey: ossVerifyStatusRecord['2'], color: 'error' }
} as const satisfies Record<string, BadgeConfig>

// import {useTransformRecordToOption} from "~/composables/useTransformRecordToOption";
//**********************字符串转标记
export const USER_GENDER_CONFIG = {
    '0': { i18nKey: 'module.system.user.gender.unknow', color: 'neutral' },
    '1': { i18nKey: 'module.system.user.gender.male', color: 'primary' },
    '2': { i18nKey: 'module.system.user.gender.female', color: 'error' }
} as const satisfies Record<string, BadgeConfig>

//*************结束

export const badgeColorRecord: Record<string, string> = {
    '0': 'neutral',
    '1': 'primary',
    '2': 'warning',
    '3': 'error',
    '4': 'info'
};

export const enableStatusRecord = {
    '1': 'page.manage.common.status.enable',
    '2': 'page.manage.common.status.disable'
} as const satisfies Record<string, string>;

export const enableStatusOptions = transformRecordToOption(enableStatusRecord);

export const ENABLE_STATUS_CONFIG = {
    '1': { i18nKey: enableStatusRecord['1'], color: 'primary' },
    '2': { i18nKey: enableStatusRecord['2'], color: 'warning' }
} as const satisfies Record<string, BadgeConfig>

export const noticeTypeRecord = {
    '1': 'module.system.notice.type.notice',
    '2': 'module.system.notice.type.announcement'
} as const satisfies Record<string, string>

export const noticeTypeOptions = transformRecordToOption(noticeTypeRecord)

export const NOTICE_TYPE_CONFIG = {
    '1': { i18nKey: noticeTypeRecord['1'], color: 'primary' },
    '2': { i18nKey: noticeTypeRecord['2'], color: 'info' }
} as const satisfies Record<string, BadgeConfig>

export const noticePublishStatusRecord = {
    '1': 'module.system.notice.publishStatus.published',
    '2': 'module.system.notice.publishStatus.draft'
} as const satisfies Record<string, string>

export const noticePublishStatusOptions = transformRecordToOption(noticePublishStatusRecord)

export const NOTICE_PUBLISH_STATUS_CONFIG = {
    '1': { i18nKey: noticePublishStatusRecord['1'], color: 'primary' },
    '2': { i18nKey: noticePublishStatusRecord['2'], color: 'neutral' }
} as const satisfies Record<string, BadgeConfig>

export const topFlagRecord = {
    '0': 'common.yesOrNo.no',
    '1': 'common.yesOrNo.yes'
} as const satisfies Record<string, string>

export const topFlagOptions = transformRecordToOption(topFlagRecord)

export const TOP_FLAG_CONFIG = {
    '0': { i18nKey: topFlagRecord['0'], color: 'neutral' },
    '1': { i18nKey: topFlagRecord['1'], color: 'warning' }
} as const satisfies Record<string, BadgeConfig>

export const dataScopeRecord = {
    '1': 'module.system.role.dataScopeOptions.all',
    '2': 'module.system.role.dataScopeOptions.custom',
    '3': 'module.system.role.dataScopeOptions.dept',
    '4': 'module.system.role.dataScopeOptions.deptAndChild',
    '5': 'module.system.role.dataScopeOptions.self',
    '6': 'module.system.role.dataScopeOptions.deptAndChildOrSelf'
} as const satisfies Record<string, string>

export const dataScopeOptions = transformRecordToOption(dataScopeRecord)

export const DATA_SCOPE_CONFIG = {
    '1': { i18nKey: dataScopeRecord['1'], color: 'error' },
    '2': { i18nKey: dataScopeRecord['2'], color: 'warning' },
    '3': { i18nKey: dataScopeRecord['3'], color: 'info' },
    '4': { i18nKey: dataScopeRecord['4'], color: 'info' },
    '5': { i18nKey: dataScopeRecord['5'], color: 'success' },
    '6': { i18nKey: dataScopeRecord['6'], color: 'neutral' }
} as const satisfies Record<string, BadgeConfig>

export const successFailureRecord = {
    '1': 'page.manage.common.sysLogin.level.success',
    '2': 'page.manage.common.sysLogin.level.failure'
} as const satisfies Record<string, string>;

export const successFailureOptions = transformRecordToOption(successFailureRecord);

export const SUCCESS_FAILURE_CONFIG = {
    '1': { i18nKey: successFailureRecord['1'], color: 'primary' },
    '2': { i18nKey: successFailureRecord['2'], color: 'warning' }
} as const satisfies Record<string, BadgeConfig>

export const yesNoRecord = {
    '0': 'common.yesOrNo.yes',
    '1': 'common.yesOrNo.no'
} as const satisfies Record<string, string>;

export const yesNoOptions = transformRecordToOption(yesNoRecord);

export const YES_NO_CONFIG = {
    '0': { i18nKey: yesNoRecord['0'], color: 'error' },
    '1': { i18nKey: yesNoRecord['1'], color: 'neutral' }
} as const satisfies Record<string, BadgeConfig>

export const userGenderRecord: Record<string, string> = {
    '1': 'module.system.user.gender.male',
    '2': 'module.system.user.gender.female',
    '0': 'module.system.user.gender.unknow',
};

export const userGenderOptions = transformRecordToOption(userGenderRecord);

export const menuTypeRecord: Record<string, string> = {
    '0': 'module.system.menu.type.directory',
    '1': 'module.system.menu.type.menu',
    '2': 'module.system.menu.type.button'
};

export const menuTypeOptions = transformRecordToOption(menuTypeRecord);

export const menuTypeConfig = {
    '0': { i18nKey: 'module.system.menu.type.directory', color: 'neutral' },
    '1': { i18nKey: 'module.system.menu.type.menu', color: 'primary' },
    '2': { i18nKey: 'module.system.menu.type.button', color: 'warning' }
} as const satisfies Record<string, BadgeConfig>

export const menuIconTypeRecord: Record<string, string> = {
    '1': 'page.manage.menu.iconType.iconify',
    '2': 'page.manage.menu.iconType.local'
};

export const menuIconTypeOptions = transformRecordToOption(menuIconTypeRecord);

export const SYS_LOG_LEVEL_CONFIG = {
    '0': { i18nKey: 'module.system.sysLog.level.0', color: 'info' },
    '1': { i18nKey: 'module.system.sysLog.level.1', color: 'warning' },
    '2': { i18nKey: 'module.system.sysLog.level.2', color: 'error' },
    '3': { i18nKey: 'module.system.sysLog.level.3', color: 'neutral' }
} as const satisfies Record<string, BadgeConfig>
export const sysLogLevelRecord = {
    '0': 'module.system.sysLog.level.0',
    '1': 'module.system.sysLog.level.1',
    '2': 'module.system.sysLog.level.2',
    '3': 'module.system.sysLog.level.3'
}
export const sysLogLevelOptions = transformRecordToOption(sysLogLevelRecord);
