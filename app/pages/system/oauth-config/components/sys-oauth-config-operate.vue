<script setup lang="ts">
import {
  type SysOauthConfigAddDTO,
  SysOauthConfigAddSchema,
  type SysOauthConfigUpdateDTO,
  SysOauthConfigUpdateSchema,
  type SysOauthConfigDto
} from '#shared/system/oauthConfig'

import type { FormSubmitEvent } from '@nuxt/ui'
import { businessDictCode } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: SysOauthConfigDto;
  close?: () => void;
  refresh?: () => void;
}>();

const formItemUi = {
  root: 'flex items-center',
  label: 'w-28 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>();

const visible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const statusValue = computed({
  get: () => String(state.value.status ?? 1),
  set: (val) => state.value.status = Number(val)
});

const state = ref<SysOauthConfigAddDTO | SysOauthConfigUpdateDTO>({
  id: '',
  platform: '',
  platformName: '',
  icon: '',
  clientId: '',
  clientSecret: '',
  redirectUrl: '',
  scope: '',
  defaultRoleId: null,
  status: 1,
  sortOrder: 0,
  extra: null,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysOauthConfigAddSchema : SysOauthConfigUpdateSchema
})

const statusItems = useDictOptions(businessDictCode.enableStatus)

/**
 * 平台快捷选项。第三方登录目前支持 github/gitee/google，
 * 这里只作为「可搜索的候选项」提供，不限制输入 —— 后端后续扩展平台时
 * 仍可直接填入新的 platform 值。
 */
const platformItems = [
  { label: 'GitHub', value: 'github' },
  { label: 'Gitee', value: 'gitee' },
  { label: 'Google', value: 'google' }
]

/**
 * 选定平台后自动回填「平台名称」，避免只填了标识却漏填展示名。
 * 编辑模式下不覆盖用户既有内容，且仅在新增模式生效。
 */
watch(() => state.value.platform, (platform) => {
  if (props.operateType !== 'add') return

  const matched = platformItems.find(item => item.value === platform)
  if (matched) {
    state.value.platformName = matched.label
  }
})

/** 默认角色：远端查询 sys_role，用法与系统用户弹窗的角色选择保持一致 */
const roleItems = ref<{ label: string; value: string }[]>([])
const loadingRoles = ref(false)

async function loadRoleItems() {
  loadingRoles.value = true
  try {
    const roles = await $trpc.sysRole.list.query({})
    roleItems.value = (roles ?? [])
      .filter(role => Boolean(role.id))
      .map(role => ({
        label: role.name || role.code || (role.id as string),
        value: role.id as string
      }))
  } catch (error) {
    // 当前账号无 system:role:list 权限时会 403。此时保留空候选，
    // 让用户仍可在不设置默认角色的情况下保存配置，不阻断整个弹窗。
    roleItems.value = []
    console.warn('[oauth-config] 默认角色候选加载失败', error)
  } finally {
    loadingRoles.value = false
  }
}

const closeDrawer = () => {
  props.close?.()
}

// 初始化表单数据
const initFormData = () => {
  if (props.operateType === 'edit' && props.data) {
    // 编辑模式：填充表单数据
    Object.assign(state.value, {
      id: props.data.id,
      platform: props.data.platform || '',
      platformName: props.data.platformName || '',
      icon: props.data.icon || '',
      clientId: props.data.clientId || '',
      clientSecret: props.data.clientSecret || '',
      redirectUrl: props.data.redirectUrl || '',
      scope: props.data.scope || '',
      defaultRoleId: props.data.defaultRoleId ?? null,
      status: props.data.status ?? 1,
      sortOrder: props.data.sortOrder ?? 0,
      extra: props.data.extra ?? null,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      platform: '',
      platformName: '',
      icon: '',
      clientId: '',
      clientSecret: '',
      redirectUrl: '',
      scope: '',
      defaultRoleId: null,
      status: 1,
      sortOrder: 0,
      extra: null,
      remark: ''
    })
  }
}

// 每次打开时重新初始化，并刷新默认角色候选（角色可能在别处新增/停用）
watch(visible, (newVal) => {
  if (newVal) {
    initFormData()
    void loadRoleItems()
  }
})

const handleSubmit = async (_event: FormSubmitEvent<SysOauthConfigAddDTO>) => {
  if (props.operateType === 'add') {
    await handleSave()
  } else if (props.operateType === 'edit') {
    await handleEdit()
  }
  closeDrawer()
  props.refresh?.()
}

// 编辑数据
const handleEdit = async () => {
  await $trpc.sysOauthConfig.update.mutate(state.value as SysOauthConfigUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}

// 保存数据
const handleSave = async () => {
  await $trpc.sysOauthConfig.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.oauthConfig.addSysOauthConfig'),
    edit: $ts('module.system.oauthConfig.editSysOauthConfig')
  }
  return titles[props.operateType]
})
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'max-w-[40%]',
    footer: 'justify-end'
  }">
    <template #body class="w-[60%]">
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class=" grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2   gap-x-6 gap-y-6">
          <UFormField name="platform" required :label="$ts('module.system.oauthConfig.platform')" orientation="horizontal"
            :ui="formItemUi">
            <!-- 快捷候选：github / gitee / google。
                 后端后续支持新平台时，这里补一个候选项即可 -->
            <USelect
              v-model="state.platform"
              :items="platformItems"
              value-key="value"
              label-key="label"
              :placeholder="$ts('module.system.oauthConfig.form.platform')"
              class="w-full"
            />
          </UFormField>
          <UFormField name="platformName" required :label="$ts('module.system.oauthConfig.platformName')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.platformName" :placeholder="$ts('module.system.oauthConfig.form.platformName')" trailing="clear" />
          </UFormField>
          <UFormField name="clientId" :label="$ts('module.system.oauthConfig.clientId')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.clientId" :placeholder="$ts('module.system.oauthConfig.form.clientId')" trailing="clear" />
          </UFormField>
          <UFormField name="clientSecret" :label="$ts('module.system.oauthConfig.clientSecret')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.clientSecret" type="password" trailing="password" :placeholder="$ts('module.system.oauthConfig.form.clientSecret')" />
          </UFormField>
          <UFormField name="redirectUrl" :label="$ts('module.system.oauthConfig.redirectUrl')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.redirectUrl" :placeholder="$ts('module.system.oauthConfig.form.redirectUrl')" trailing="clear" />
          </UFormField>
          <UFormField name="scope" :label="$ts('module.system.oauthConfig.scope')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.scope" :placeholder="$ts('module.system.oauthConfig.form.scope')" trailing="clear" />
          </UFormField>
          <UFormField name="icon" :label="$ts('module.system.oauthConfig.icon')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.icon" :placeholder="$ts('module.system.oauthConfig.form.icon')" trailing="clear" />
          </UFormField>
          <UFormField name="defaultRoleId" :label="$ts('module.system.oauthConfig.defaultRoleId')" orientation="horizontal"
            :ui="formItemUi">
            <!-- 默认角色改为远端查询 sys_role，避免手填 ID -->
            <USelectMenu
              v-model="state.defaultRoleId"
              :items="roleItems"
              value-key="value"
              label-key="label"
              :filter-fields="['label']"
              :search-input="{ placeholder: $ts('module.system.oauthConfig.form.defaultRoleId') }"
              :loading="loadingRoles"
              :placeholder="$ts('module.system.oauthConfig.form.defaultRoleId')"
              clear
              class="w-full"
            />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.oauthConfig.sortOrder')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.sortOrder" type="number" trailing="clear" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.oauthConfig.status')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.system.oauthConfig.form.status')" :items="statusItems"></URadioGroup>
          </UFormField>
        </div>
        <USeparator class="p-4" />
        <div class="flex justify-end gap-2">
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer" />
          <UButton :label="$ts('common.confirm')" color="primary" type="submit" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
