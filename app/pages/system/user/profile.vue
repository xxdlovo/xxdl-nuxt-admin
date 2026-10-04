<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { businessDictCode } from '#shared/constants/business'
import {
  SysUserChangePasswordSchema,
  SysUserProfileUpdateSchema,
  SysUserSetPasswordSchema,
  type SysUserChangePasswordDTO,
  type SysUserDto,
  type SysUserProfileUpdateDTO,
  type SysUserSetPasswordDTO
} from '#shared/system/user'
import { useToastError, useToastSuccess, useToastWarning } from '~/utils/toast'
import MemberCenter from './components/member-center.vue'

definePageMeta({
  layout: 'system',
  title: '个人中心',
  icon: 'i-lucide-id-card'
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const { user, fetch } = useUserSession()
const { profile, loadProfile } = useRbacProfile()

/** auth.myProfile 在用户 DTO 之外额外返回 hasPassword */
type MyProfile = SysUserDto & { hasPassword?: boolean }

const loading = ref(false)
const isEditing = ref(false)
const savingProfile = ref(false)
const savingPassword = ref(false)
const lastProfileData = ref<MyProfile | null>(null)
const avatarFile = ref<File | null>(null)
const uploadingAvatar = ref(false)
const avatarProgress = ref(0)
const avatarUploadXhr = shallowRef<XMLHttpRequest | null>(null)

/** 我的会员档案（等级 / 邀请码 / 下级数量）：走会话级 store，未登录会员体系或查询失败时为 null */
const memberProfileStore = useMemberProfileStore()

/** 会员等级名称：没有等级（或查不到档案）时不展示徽标 */
const memberLevelName = computed(() => memberProfileStore.profile?.levelName ?? null)

const profileState = reactive<Partial<SysUserProfileUpdateDTO>>({
  nickname: '',
  email: '',
  phone: '',
  avatar: '',
  gender: undefined,
  remark: ''
})

// oldPassword 仅在「修改密码」模式下使用；第三方登录用户走「设置密码」，不传该字段。
// 这里用显式对象类型，避免 DTO 交叉类型让各字段变成必填。
const passwordState = reactive<{
  oldPassword?: string
  password?: string
  confirmPassword?: string
}>({
  oldPassword: '',
  password: '',
  confirmPassword: ''
})

/** 当前用户自己的第三方账号绑定 */
type MyBinding = {
  id: string
  provider: string
  providerLogin: string | null
  avatar: string | null
  createdAt: string | null
}

const myBindings = ref<MyBinding[]>([])
const loadingBindings = ref(false)
const unbindingId = ref('')

/**
 * 是否「已设置过真实密码」。
 *
 * 由服务端根据 sys_user.password 是否为 OAuth 占位标记判定：
 * - false（OAuth 建号、从未设过密码）→ 表单为「设置新密码」，不需要原密码
 * - true → 恢复为「修改密码」，必须输入原密码
 * 默认 true 是保守取值：拿不到状态时按「需要原密码」处理。
 */
const hasPassword = computed(() => lastProfileData.value?.hasPassword !== false)

/** 仅未设置过密码时才免去原密码 */
const useSetPasswordMode = computed(() => !hasPassword.value)

const passwordFormSchema = computed(() =>
  useSetPasswordMode.value ? SysUserSetPasswordSchema : SysUserChangePasswordSchema
)

const tabs = computed(() => {
  const bindingCount = myBindings.value.length
  // 仅在有绑定时展示数量后缀
  const thirdPartyLabel = bindingCount > 0
    ? `${$ts('module.system.profile.tabs.thirdParty')} (${bindingCount})`
    : $ts('module.system.profile.tabs.thirdParty')

  return [{
    label: $ts('module.system.profile.tabs.profile'),
    icon: 'i-lucide-user-round',
    slot: 'profile' as const
  }, {
    label: useSetPasswordMode.value
      ? $ts('module.system.profile.tabs.setPassword')
      : $ts('module.system.profile.tabs.password'),
    icon: 'i-lucide-key-round',
    slot: 'password' as const
  }, {
    label: thirdPartyLabel,
    icon: 'i-lucide-link',
    slot: 'thirdParty' as const
  }, {
    // 会员中心：自助开通 / 续费会员等级（走 sysMember 的自助接口，无后台权限码）
    label: $ts('module.system.profile.tabs.member'),
    icon: 'i-lucide-crown',
    slot: 'member' as const
  }]
})

const platformNameMap: Record<string, string> = {
  github: 'GitHub',
  gitee: 'Gitee',
  google: 'Google',
  gitlab: 'GitLab',
  microsoft: 'Microsoft'
}

function platformLabel(provider: string) {
  const key = String(provider || '').trim().toLowerCase()
  return platformNameMap[key] || provider || '-'
}

/** myBindings 的声明式表格列 */
const bindingColumns = computed(() => [
  {
    accessorKey: 'provider',
    header: $ts('module.system.oauthAccount.provider'),
    cell: ({ row }: { row: { original: MyBinding } }) => platformLabel(row.original.provider)
  },
  {
    accessorKey: 'providerLogin',
    header: $ts('module.system.oauthAccount.providerLogin'),
    cell: ({ row }: { row: { original: MyBinding } }) => row.original.providerLogin || '-'
  },
  {
    accessorKey: 'createdAt',
    header: $ts('module.system.oauthAccount.createdAt'),
    cell: ({ row }: { row: { original: MyBinding } }) => row.original.createdAt || '-'
  }
])

async function loadThirdPartyBindings() {
  loadingBindings.value = true
  try {
    myBindings.value = await $trpc.sysOauthAccount.myBindings.query()
  } catch (error) {
    // 拉取失败不应影响个人中心其它功能
    myBindings.value = []
    console.warn('[profile] 第三方绑定加载失败', error)
  } finally {
    loadingBindings.value = false
  }
}

async function handleUnbind(binding: MyBinding) {
  unbindingId.value = binding.id
  try {
    await $trpc.sysOauthAccount.removeMyBinding.mutate(binding.id)
    useToastSuccess($ts('module.system.profile.unbindSuccess'))
    await loadThirdPartyBindings()
  } finally {
    unbindingId.value = ''
  }
}

const genderItems = useDictOptions(businessDictCode.userGender)
const roleNames = computed(() => profile.value?.roles.map(role => role.name || role.code).filter(Boolean) ?? [])
const displayName = computed(() => user.value?.nickname || user.value?.username || $ts('module.system.profile.userFallback'))
const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase())
const avatarPreview = computed(() => profileState.avatar || user.value?.avatar || undefined)
const isAdminText = computed(() => user.value?.isAdmin === 1 ? $ts('module.system.profile.superAdmin') : $ts('module.system.profile.normalUser'))
const genderText = computed(() => {
  const current = genderItems.value.find(item => String(item.value) === String(profileState.gender ?? user.value?.gender ?? 0))
  return current?.label || $ts('module.system.user.gender.unknow')
})

const genderValue = computed({
  get: () => String(profileState.gender ?? 0),
  set: value => {
    profileState.gender = Number(value)
  }
})

const permissionsCountText = computed(() => $ts('module.system.profile.permissionCount',{count:String(profile.value?.permissions.length || 0)}))

const formatFileSize = (size?: number | null) => {
  const value = Number(size || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

function fillProfileState(data?: SysUserDto | null) {
  const source = data || (user.value as SysUserDto | null)

  Object.assign(profileState, {
    nickname: source?.nickname || '',
    email: source?.email || '',
    phone: source?.phone || '',
    avatar: source?.avatar || '',
    gender: source?.gender ?? 0,
    remark: source?.remark || ''
  })
}

async function loadData() {
  loading.value = true
  try {
    const data = await $trpc.auth.myProfile.query()
    lastProfileData.value = data
    fillProfileState(data)
    await loadProfile()
  } finally {
    loading.value = false
  }

  // 会员档案（等级 / 邀请码 / 下级数量）：独立查询且失败不阻断个人中心，
  // 没有会员档案时只是不展示等级，而不是整页报错。
  // 强制 refresh：等级可能已被后台改过，不能用会话开始时那份缓存。
  await memberProfileStore.refresh()
}

function cancelEdit() {
  fillProfileState(lastProfileData.value)
  resetAvatarUpload()
  isEditing.value = false
}

function resetAvatarUpload() {
  avatarUploadXhr.value?.abort()
  avatarFile.value = null
  avatarProgress.value = 0
  uploadingAvatar.value = false
  avatarUploadXhr.value = null
}

function parseUploadError(xhr: XMLHttpRequest) {
  try {
    const body = JSON.parse(xhr.responseText)
    return body.message || body.statusMessage || xhr.statusText
  } catch {
    return xhr.statusText || $ts('module.system.oss.uploadFailed')
  }
}

async function uploadAvatar() {
  if (!avatarFile.value) {
    useToastWarning($ts('module.system.oss.uploadFileRequired'))
    return
  }

  if (!avatarFile.value.type.startsWith('image/')) {
    useToastWarning($ts('module.system.oss.uploadFileRequired'))
    return
  }

  const formData = new FormData()
  formData.append('file', avatarFile.value)

  uploadingAvatar.value = true
  avatarProgress.value = 0

  await new Promise<void>((resolve) => {
    const xhr = new XMLHttpRequest()
    avatarUploadXhr.value = xhr
    xhr.open('POST', '/api/system/user/avatar')
    xhr.withCredentials = true

    const locale = useCookie<string>('i18n_locale').value || 'en'
    xhr.setRequestHeader('x-locale', locale)
    xhr.setRequestHeader('accept-language', locale)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      avatarProgress.value = Math.min(95, Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      uploadingAvatar.value = false
      avatarUploadXhr.value = null

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText)
          const url = body?.data?.url
          if (url) {
            profileState.avatar = url
            avatarProgress.value = 100
            avatarFile.value = null
            useToastSuccess($ts('module.system.oss.uploadSuccess'))
          } else {
            useToastError($ts('module.system.oss.uploadFailed'))
          }
        } catch {
          useToastError($ts('module.system.oss.uploadFailed'))
        }
      } else {
        useToastError($ts('module.system.oss.uploadFailed'), 5000, parseUploadError(xhr))
      }
      resolve()
    }

    xhr.onerror = () => {
      uploadingAvatar.value = false
      avatarUploadXhr.value = null
      useToastError($ts('module.system.oss.uploadFailed'))
      resolve()
    }

    xhr.onabort = () => {
      uploadingAvatar.value = false
      avatarUploadXhr.value = null
      avatarProgress.value = 0
      useToastWarning($ts('module.system.oss.uploadCanceled'))
      resolve()
    }

    xhr.send(formData)
  })
}

function cancelAvatarUpload() {
  avatarUploadXhr.value?.abort()
}

watch(avatarFile, async (file) => {
  avatarProgress.value = 0
  if (!file) return
  if (uploadingAvatar.value) {
    avatarUploadXhr.value?.abort()
  }
  await uploadAvatar()
})

async function handleProfileSubmit(event: FormSubmitEvent<SysUserProfileUpdateDTO>) {
  savingProfile.value = true
  try {
    await $trpc.auth.updateProfile.mutate({
      nickname: event.data.nickname || undefined,
      email: event.data.email,
      phone: event.data.phone || undefined,
      avatar: event.data.avatar || undefined,
      gender: event.data.gender ?? undefined,
      remark: event.data.remark || undefined
    })
    await fetch()
    await loadProfile(true)
    await loadData()
    isEditing.value = false
    useToastSuccess($ts('module.system.profile.profileUpdateSuccess'))
  } finally {
    savingProfile.value = false
  }
}

async function handlePasswordSubmit(event: FormSubmitEvent<{ oldPassword?: string; password: string; confirmPassword: string }>) {
  savingPassword.value = true
  try {
    // 未设置过密码（OAuth 建号）→ setPassword，无需原密码；
    // 已设置过真实密码 → changePassword，必须校验原密码。
    if (useSetPasswordMode.value) {
      await $trpc.auth.setPassword.mutate({
        password: event.data.password,
        confirmPassword: event.data.confirmPassword
      })
    } else {
      await $trpc.auth.setPassword.mutate({
        oldPassword: event.data.oldPassword as string,
        password: event.data.password,
        confirmPassword: event.data.confirmPassword
      })
    }

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

onMounted(async () => {
  await loadData()
  await loadThirdPartyBindings()
})
onBeforeUnmount(() => {
  avatarUploadXhr.value?.abort()
})
</script>

<template>
  <div class="h-full overflow-auto bg-muted/30 p-3">
    <div class="mx-auto flex max-w-6xl flex-col gap-3">
      <div class="flex flex-col gap-3 rounded-lg border border-default bg-default p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 items-center gap-3">
          <UAvatar :src="avatarPreview" :alt="displayName" size="xl">
            {{ avatarText }}
          </UAvatar>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="truncate text-xl font-semibold text-default">{{ displayName }}</h1>
              <UBadge :label="isAdminText" color="primary" variant="soft" />
              <!-- 会员等级：挂在昵称旁，一眼可见 -->
              <UBadge
                v-if="memberLevelName"
                :label="memberLevelName"
                :title="$ts('module.system.profile.memberLevel')"
                color="warning"
                variant="soft"
                icon="i-lucide-crown"
              />
            </div>
            <p class="truncate text-sm text-muted">
              {{ user?.username }} · {{ profileState.email || $ts('module.system.profile.unsetEmail') }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UBadge
              v-for="role in roleNames"
              :key="role"
              :label="role"
              color="neutral"
              variant="subtle"
          />
          <UBadge v-if="roleNames.length === 0" :label="$ts('module.system.profile.noRole')" color="warning" variant="soft" />
        </div>
      </div>

      <UTabs :items="tabs" :ui="{ content: 'pt-3' }">
        <template #profile>
          <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <UCard :ui="{ body: 'p-0 sm:p-0' }">
              <template #header>
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 class="text-base font-semibold text-default">{{ $ts('module.system.profile.profileInfo') }}</h2>
                    <p class="mt-1 text-sm text-muted">{{ $ts('module.system.profile.profileInfoDesc') }}</p>
                  </div>
                  <div class="flex gap-2">
                    <UButton
                        v-if="!isEditing"
                        icon="i-lucide-square-pen"
                        :label="$ts('common.edit')"
                        :loading="loading"
                        @click="isEditing = true"
                    />
                    <UButton
                        v-else
                        icon="i-lucide-x"
                        color="neutral"
                        variant="subtle"
                        :label="$ts('common.cancel')"
                        @click="cancelEdit"
                    />
                  </div>
                </div>
              </template>

              <div v-if="!isEditing" class="divide-y divide-default">
                <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <span class="text-sm text-muted">{{ $ts('module.system.user.userName') }}</span>
                  <span class="min-w-0 truncate text-sm font-medium text-default">{{ user?.username || '-' }}</span>
                </div>
                <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <span class="text-sm text-muted">{{ $ts('module.system.user.nickName') }}</span>
                  <span class="min-w-0 truncate text-sm font-medium text-default">{{ profileState.nickname || '-' }}</span>
                </div>
                <!-- 会员等级：来自会员档案（sysMember.myProfile 的 levelName），只读展示 -->
                <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <span class="text-sm text-muted">{{ $ts('module.system.profile.memberLevel') }}</span>
                  <span class="min-w-0 text-sm font-medium text-default">
                    <UBadge
                      v-if="memberLevelName"
                      :label="memberLevelName"
                      color="warning"
                      variant="soft"
                      icon="i-lucide-crown"
                    />
                    <template v-else>-</template>
                  </span>
                </div>
                <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <span class="text-sm text-muted">{{ $ts('module.system.user.userEmail') }}</span>
                  <span class="min-w-0 truncate text-sm font-medium text-default">{{ profileState.email || '-' }}</span>
                </div>
                <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <span class="text-sm text-muted">{{ $ts('module.system.user.userPhone') }}</span>
                  <span class="min-w-0 truncate text-sm font-medium text-default">{{ profileState.phone || '-' }}</span>
                </div>
                <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <span class="text-sm text-muted">{{ $ts('module.system.user.userGender') }}</span>
                  <span class="min-w-0 truncate text-sm font-medium text-default">{{ genderText }}</span>
                </div>
                <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <span class="text-sm text-muted">{{ $ts('module.system.user.remark') }}</span>
                  <span class="min-w-0 text-sm font-medium text-default">{{ profileState.remark || '-' }}</span>
                </div>
              </div>

              <UForm
                  v-else
                  :schema="SysUserProfileUpdateSchema"
                  :state="profileState"
                  class="grid grid-cols-1 gap-x-6 gap-y-5 p-4 md:grid-cols-2"
                  @submit="handleProfileSubmit"
              >
                <UFormField name="nickname" :label="$ts('module.system.user.nickName')">
                  <UInput v-model="profileState.nickname" :placeholder="$ts('module.system.user.form.nickName')" class="w-full" />
                </UFormField>

                <UFormField name="email" :label="$ts('module.system.user.userEmail')" required>
                  <UInput v-model="profileState.email" type="email" :placeholder="$ts('module.system.user.form.userEmail')" class="w-full" />
                </UFormField>

                <UFormField name="phone" :label="$ts('module.system.user.userPhone')">
                  <UInput v-model="profileState.phone" type="tel" :placeholder="$ts('module.system.user.form.userPhone')" class="w-full" />
                </UFormField>

                <UFormField name="gender" :label="$ts('module.system.user.userGender')">
                  <URadioGroup v-model="genderValue" :items="genderItems" orientation="horizontal" />
                </UFormField>

                <UFormField name="avatar" :label="$ts('module.system.profile.avatar')" class="md:col-span-2">
                  <div class="space-y-3">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <UAvatar :src="avatarPreview" :alt="displayName" size="3xl">
                        {{ avatarText }}
                      </UAvatar>
                      <div class="min-w-0 flex-1 space-y-2">
                        <UFileUpload
                          v-model="avatarFile"
                          accept="image/*"
                          variant="area"
                          layout="list"
                          :disabled="uploadingAvatar"
                          :multiple="false"
                          :label="$ts('module.system.oss.form.uploadFile')"
                          :description="$ts('module.system.oss.uploadSingleOnly')"
                          class="w-full"
                        />
                        <div v-if="avatarFile" class="text-sm text-muted">
                          {{ avatarFile.name }} / {{ formatFileSize(avatarFile.size) }}
                        </div>
                      </div>
                    </div>

                    <div v-if="uploadingAvatar || avatarProgress > 0" class="space-y-2">
                      <div class="flex items-center justify-between text-sm text-muted">
                        <span>{{ uploadingAvatar ? $ts('module.system.oss.uploading') : $ts('module.system.oss.uploadProgress') }}</span>
                        <span>{{ avatarProgress }}%</span>
                      </div>
                      <UProgress :model-value="avatarProgress" color="primary" />
                    </div>

                    <UButton
                      v-if="uploadingAvatar"
                      type="button"
                      color="warning"
                      variant="outline"
                      icon="i-lucide-ban"
                      :label="$ts('module.system.oss.cancelUpload')"
                      @click="cancelAvatarUpload"
                    />

                    <UInput v-model="profileState.avatar" type="url" :placeholder="$ts('module.system.profile.form.avatar')" class="w-full" />
                  </div>
                </UFormField>

                <UFormField name="remark" :label="$ts('module.system.user.remark')" class="md:col-span-2">
                  <UTextarea v-model="profileState.remark" :placeholder="$ts('module.system.user.form.remark')" :rows="4" class="w-full" />
                </UFormField>

                <div class="flex justify-end gap-2 md:col-span-2">
                  <UButton color="neutral" variant="subtle" :label="$ts('common.cancel')" @click="cancelEdit" />
                  <UButton type="submit" icon="i-lucide-save" :label="$ts('module.system.profile.saveProfile')" :loading="savingProfile || loading" />
                </div>
              </UForm>
            </UCard>

            <UCard>
              <div class="space-y-4">
                <div>
                  <h2 class="text-base font-semibold text-default">{{ $ts('module.system.profile.rolePermission') }}</h2>
                  <p class="mt-1 text-sm text-muted">{{ permissionsCountText }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UBadge
                      v-for="role in roleNames"
                      :key="role"
                      :label="role"
                      color="primary"
                      variant="soft"
                  />
                  <UBadge v-if="roleNames.length === 0" :label="$ts('module.system.profile.noRole')" color="warning" variant="soft" />
                </div>
              </div>
            </UCard>
          </div>
        </template>

        <template #password>
          <UCard>
            <UForm
                :schema="passwordFormSchema"
                :state="passwordState"
                class="max-w-xl space-y-5"
                @submit="handlePasswordSubmit"
            >
              <!-- 仅当账号已设置过真实密码时才要求输入原密码 -->
              <UFormField
                  v-if="hasPassword"
                  name="oldPassword"
                  :label="$ts('module.system.profile.oldPassword')"
                  required
              >
                <UInput v-model="passwordState.oldPassword" type="password" autocomplete="current-password" :placeholder="$ts('module.system.profile.form.oldPassword')" class="w-full" />
              </UFormField>

              <UAlert
                  v-else
                  color="info"
                  variant="soft"
                  icon="i-lucide-info"
                  :description="$ts('module.system.profile.thirdPartyPasswordTip')"
              />

              <UFormField name="password" :label="$ts('module.system.user.newPassword')" required>
                <UInput v-model="passwordState.password" type="password" autocomplete="new-password" :placeholder="$ts('module.system.user.form.newPassword')" class="w-full" />
              </UFormField>

              <UFormField name="confirmPassword" :label="$ts('module.system.user.confirmPassword')" required>
                <UInput v-model="passwordState.confirmPassword" type="password" autocomplete="new-password" :placeholder="$ts('module.system.user.form.confirmPassword')" class="w-full" />
              </UFormField>

              <div class="flex justify-end">
                <UButton
                    type="submit"
                    icon="i-lucide-key-round"
                    :label="useSetPasswordMode ? $ts('module.system.profile.setPassword') : $ts('module.system.profile.changePassword')"
                    :loading="savingPassword"
                />
              </div>
            </UForm>
          </UCard>
        </template>

        <!-- 第三方账号：列出当前用户自己的绑定，任何登录用户都可查看与解绑 -->
        <template #thirdParty>
          <UCard>
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-sm font-medium text-default">{{ $ts('module.system.profile.thirdPartyTitle') }}</p>
                <p class="text-xs text-muted">{{ $ts('module.system.profile.thirdPartyDesc') }}</p>
              </div>
              <UButton
                  icon="i-lucide-refresh-cw"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :loading="loadingBindings"
                  :label="$ts('common.refresh')"
                  @click="loadThirdPartyBindings"
              />
            </div>

            <div v-if="loadingBindings" class="py-8 text-center text-sm text-muted">
              {{ $ts('common.loading') }}
            </div>

            <UEmpty
                v-else-if="myBindings.length === 0"
                icon="i-lucide-link-off"
                :title="$ts('module.system.profile.noThirdParty')"
                :description="$ts('module.system.profile.noThirdPartyDesc')"
                variant="soft"
            />

            <div v-else class="flex flex-col divide-y divide-default">
              <div
                  v-for="binding in myBindings"
                  :key="binding.id"
                  class="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <UIcon name="i-lucide-link" class="size-5 shrink-0 text-muted" />
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-default">{{ platformLabel(binding.provider) }}</span>
                      <UBadge :label="binding.provider" color="neutral" variant="soft" size="sm" />
                    </div>
                    <p class="truncate text-xs text-muted">
                      {{ binding.providerLogin || '-' }}
                      <span v-if="binding.createdAt"> · {{ binding.createdAt }}</span>
                    </p>
                  </div>
                </div>

                <Popconfirm
                    :content="$ts('module.system.oauthAccount.unbindConfirm')"
                    :positive-text="$ts('module.system.oauthAccount.unbind')"
                    :loading="unbindingId === binding.id"
                    @confirm="handleUnbind(binding)"
                >
                  <template #trigger>
                    <UButton
                        icon="i-lucide-unlink"
                        color="error"
                        variant="outline"
                        size="xs"
                        :label="$ts('module.system.oauthAccount.unbind')"
                    />
                  </template>
                </Popconfirm>
              </div>
            </div>
          </UCard>
        </template>

        <!-- 会员中心：当前等级 / 到期时间 + 可购买等级 + 开通记录（数据走 sysMember 自助接口） -->
        <template #member>
          <MemberCenter />
        </template>
      </UTabs>
    </div>
  </div>
</template>
