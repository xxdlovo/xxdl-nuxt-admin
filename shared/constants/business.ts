import { transformRecordToOption } from '#shared/utils/common';
import type { BadgeConfig } from '#shared/types/nuxtui'
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
