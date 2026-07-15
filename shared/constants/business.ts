import { transformRecordToOption } from '#shared/utils/common';
// import {useTransformRecordToOption} from "~/composables/useTransformRecordToOption";
//**********************字符串转标记
export const USER_GENDER_CONFIG = {
    '0': { i18nKey: 'module.system.user.gender.unknow', color: 'neutral' },
    '1': { i18nKey: 'module.system.user.gender.male', color: 'success' },
    '2': { i18nKey: 'module.system.user.gender.female', color: 'error' }
} as const

export const USER_STATUS_CONFIG = {
    '1': { i18nKey: 'page.manage.common.status.enable', color: 'success' },
    '2': { i18nKey: 'page.manage.common.status.disable', color: 'warning' }
} as const

//*************结束

export const badgeColorRecord: Record<string, string> = {
    '0': 'neutral',
    '1': 'primary',
    '2': 'warning',
    '3': 'error',
    '4': 'info'
};

export const enableStatusRecord: Record<string, string> = {
    '1': 'page.manage.common.status.enable',
    '2': 'page.manage.common.status.disable'
};

export const enableStatusOptions = transformRecordToOption(enableStatusRecord);

export const userGenderRecord: Record<string, string> = {
    '1': 'module.system.user.gender.male',
    '2': 'module.system.user.gender.female',
    '0': 'module.system.user.gender.unknow',
};

export const userGenderOptions = transformRecordToOption(userGenderRecord);

export const menuTypeRecord: Record<string, string> = {
    '1': 'page.manage.menu.type.directory',
    '2': 'page.manage.menu.type.menu'
};

export const menuTypeOptions = transformRecordToOption(menuTypeRecord);

export const menuIconTypeRecord: Record<string, string> = {
    '1': 'page.manage.menu.iconType.iconify',
    '2': 'page.manage.menu.iconType.local'
};

export const menuIconTypeOptions = transformRecordToOption(menuIconTypeRecord);

export const DICT_DATA_STATUS_CONFIG = {
    '1': { i18nKey: 'page.manage.common.status.enable', color: 'success' },
    '2': { i18nKey: 'page.manage.common.status.disable', color: 'warning' }
} as const

export const dictDataStatusRecord: Record<string, string> = {
    '1': 'page.manage.common.status.enable',
    '2': 'page.manage.common.status.disable'
};

export const dictDataStatusOptions = transformRecordToOption(dictDataStatusRecord);

export const DICT_TYPE_STATUS_CONFIG = {
    '1': { i18nKey: 'page.manage.common.status.enable', color: 'success' },
    '2': { i18nKey: 'page.manage.common.status.disable', color: 'warning' }
} as const

export const dictTypeStatusRecord: Record<string, string> = {
    '1': 'page.manage.common.status.enable',
    '2': 'page.manage.common.status.disable'
};

export const dictTypeStatusOptions = transformRecordToOption(dictTypeStatusRecord);