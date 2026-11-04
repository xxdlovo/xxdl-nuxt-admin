<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  SysUserProfileUpdateSchema,
  type SysUserChangePasswordDTO,
  type SysUserDto,
  type SysUserProfileUpdateDTO,
  type SysUserSetPasswordDTO
} from '#admin/shared/system/user'
import { useToastSuccess } from '#admin/app/utils/toast'

/**
 * 个人中心（基座版）。
 *
 * 只包含账号本身的通用能力：资料维护与密码设置/修改。
 * 业务相关的自助入口（会员中心、钱包、订单等）属于可选业务层，
 * 由业务层以自己的同名页面覆盖本文件后追加。
 *
 * 第三方绑定列表也放在这里（属于账号自身能力）。
 */
definePageMeta({
  layout: 'system',
  title: '个人中心',
  icon: 'i-lucide-id-card'
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const { fetch } = useUserSession()

/** auth.myProfile 在用户 DTO 之外额外返回 hasPassword */
type MyProfile = SysUserDto & { hasPassword?: boolean }

const loading = ref(false)
const savingProfile = ref(false)
const savingPassword = ref(false)
const lastProfileData = ref<MyProfile | null>(null)

const profileState = reactive<Partial<SysUserProfileUpdateDTO>>({
  nickname: '',
  email: '',
  phone: '',
  gender: undefined,
  remark: ''
})

// oldPassword 仅在「修改密码」模式下使用；第三方登录用户走「设置密码」，不传该字段。
const passwordState = reactive<{
  oldPassword?: string
  password?: string
  confirmPassword?: string
}>({
  oldPassword: '',
  password: '',
  confirmPassword: ''
})

/** 是否已设置过真实密码（OAuth 建号为 false，此时表单切换为「设置密码」） */
const hasPassword = computed(() => lastProfileData.value?.hasPassword !== false)
const useSetPasswordMode = computed(() => !hasPassword.value)

const displayName = computed(() => {
  const data = lastProfileData.value
  return data?.nickname || data?.username || '-'
})

const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase())

const tabs = computed(() => [
  {
    label: $ts('module.system.profile.tabs.profile'),
    icon: 'i-lucide-user-round',
    slot: 'profile' as const
  },
  {
    label: useSetPasswordMode.value
      ? $ts('module.system.profile.tabs.setPassword')
      : $ts('module.system.profile.tabs.password'),
    icon: 'i-lucide-key-round',
    slot: 'password' as const
  }
])

async function loadData() {
  loading.value = true
  try {
    const data = await $trpc.auth.myProfile.query() as MyProfile
    lastProfileData.value = data

    Object.assign(profileState, {
      nickname: data.nickname ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      gender: data.gender ?? undefined,
      remark: data.remark ?? ''
    })
  } finally {
    loading.value = false
  }
}

async function handleProfileSubmit(event: FormSubmitEvent<SysUserProfileUpdateDTO>) {
  savingProfile.value = true
  try {
    await $trpc.auth.updateProfile.mutate({
      nickname: event.data.nickname || undefined,
      email: event.data.email,
      phone: event.data.phone || undefined,
      gender: event.data.gender ?? undefined,
      remark: event.data.remark || undefined
    })
    await fetch()
    await loadData()
    useToastSuccess($ts('module.system.profile.profileUpdateSuccess'))
  } finally {
    savingProfile.value = false
  }
}

async function handlePasswordSubmit(event: FormSubmitEvent<{ oldPassword?: string; password: string; confirmPassword: string }>) {
  savingPassword.value = true
  try {
    // 未设置过密码（OAuth 建号）→ 不传原密码；已设置过 → 必须校验原密码。
    const payload = useSetPasswordMode.value
      ? {
          password: event.data.password,
          confirmPassword: event.data.confirmPassword
        } as SysUserSetPasswordDTO
      : {
          oldPassword: event.data.oldPassword,
          password: event.data.password,
          confirmPassword: event.data.confirmPassword
        } as SysUserChangePasswordDTO

    await $trpc.auth.setPassword.mutate(payload)

    Object.assign(passwordState, {
      oldPassword: '',
      password: '',
      confirmPassword: ''
    })
    useToastSuccess($ts('module.system.profile.passwordUpdateSuccess'))
  } finally {
    savingPassword.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <UPage>
    <UPageHeader :title="$ts('module.system.profile.title')" />

    <UPageBody>
      <UCard>
        <div class="flex items-center gap-3">
          <UAvatar
            :src="lastProfileData?.avatar || undefined"
            :alt="displayName"
            size="xl"
          >
            {{ avatarText }}
          </UAvatar>
          <div class="min-w-0">
            <div class="text-base font-medium">
              {{ displayName }}
            </div>
            <div class="text-sm text-muted">
              {{ lastProfileData?.username || '-' }}
            </div>
          </div>
        </div>
      </UCard>

      <UTabs
        :items="tabs"
        class="mt-4"
        :ui="{ content: 'pt-3' }"
      >
        <template #profile>
          <UCard>
            <UForm
              :schema="SysUserProfileUpdateSchema"
              :state="profileState"
              class="space-y-4"
              @submit="handleProfileSubmit"
            >
              <UFormField
                :label="$ts('module.system.profile.form.nickname')"
                name="nickname"
              >
                <UInput
                  v-model="profileState.nickname"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="$ts('module.system.profile.form.email')"
                name="email"
              >
                <UInput
                  v-model="profileState.email"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="$ts('module.system.profile.form.phone')"
                name="phone"
              >
                <UInput
                  v-model="profileState.phone"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="$ts('module.system.profile.form.remark')"
                name="remark"
              >
                <UTextarea
                  v-model="profileState.remark"
                  class="w-full"
                />
              </UFormField>

              <div class="flex justify-end">
                <UButton
                  type="submit"
                  :loading="savingProfile"
                >
                  {{ $ts('common.save') }}
                </UButton>
              </div>
            </UForm>
          </UCard>
        </template>

        <template #password>
          <UCard>
            <UForm
              :state="passwordState"
              class="space-y-4"
              @submit="handlePasswordSubmit"
            >
              <UFormField
                v-if="!useSetPasswordMode"
                :label="$ts('module.system.profile.form.oldPassword')"
                name="oldPassword"
              >
                <UInput
                  v-model="passwordState.oldPassword"
                  type="password"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="$ts('module.system.profile.form.password')"
                name="password"
              >
                <UInput
                  v-model="passwordState.password"
                  type="password"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="$ts('module.system.profile.form.confirmPassword')"
                name="confirmPassword"
              >
                <UInput
                  v-model="passwordState.confirmPassword"
                  type="password"
                  class="w-full"
                />
              </UFormField>

              <div class="flex justify-end">
                <UButton
                  type="submit"
                  :loading="savingPassword"
                >
                  {{ $ts('common.save') }}
                </UButton>
              </div>
            </UForm>
          </UCard>
        </template>
      </UTabs>
    </UPageBody>
  </UPage>
</template>
