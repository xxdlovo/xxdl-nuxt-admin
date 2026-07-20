<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { userGenderRecord } from '#shared/constants/business'
import {
  SysUserChangePasswordSchema,
  SysUserProfileUpdateSchema,
  type SysUserChangePasswordDTO,
  type SysUserDto,
  type SysUserProfileUpdateDTO
} from '#shared/system/user'
import { useToastSuccess } from '~/utils/toast'

definePageMeta({
  layout: 'system',
  title: '个人中心',
  icon: 'i-lucide-id-card'
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const { user, fetch } = useUserSession()
const { profile, loadProfile } = useRbacProfile()

const loading = ref(false)
const isEditing = ref(false)
const savingProfile = ref(false)
const savingPassword = ref(false)
const lastProfileData = ref<SysUserDto | null>(null)

const profileState = reactive<Partial<SysUserProfileUpdateDTO>>({
  nickname: '',
  email: '',
  phone: '',
  avatar: '',
  gender: undefined,
  remark: ''
})

const passwordState = reactive<Partial<SysUserChangePasswordDTO>>({
  oldPassword: '',
  password: '',
  confirmPassword: ''
})

const tabs = computed(() => [{
  label: $ts('module.system.profile.tabs.profile'),
  icon: 'i-lucide-user-round',
  slot: 'profile' as const
}, {
  label: $ts('module.system.profile.tabs.password'),
  icon: 'i-lucide-key-round',
  slot: 'password' as const
}])

const genderItems = useTransformRecordToOption(userGenderRecord)
const roleNames = computed(() => profile.value?.roles.map(role => role.name || role.code).filter(Boolean) ?? [])
const displayName = computed(() => user.value?.nickname || user.value?.username || $ts('module.system.profile.userFallback'))
const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase())
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

const permissionsCountText = computed(() => $ts('module.system.profile.permissionCount').replace('{count}', String(profile.value?.permissions.length || 0)))

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
}

function cancelEdit() {
  fillProfileState(lastProfileData.value)
  isEditing.value = false
}

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

async function handlePasswordSubmit(event: FormSubmitEvent<SysUserChangePasswordDTO>) {
  savingPassword.value = true
  try {
    await $trpc.auth.changePassword.mutate(event.data)
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
  <div class="h-full overflow-auto bg-muted/30 p-3">
    <div class="mx-auto flex max-w-6xl flex-col gap-3">
      <div class="flex flex-col gap-3 rounded-lg border border-default bg-default p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 items-center gap-3">
          <UAvatar :src="user?.avatar || undefined" :alt="displayName" size="xl">
            {{ avatarText }}
          </UAvatar>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="truncate text-xl font-semibold text-default">{{ displayName }}</h1>
              <UBadge :label="isAdminText" color="primary" variant="soft" />
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
                  <UInput v-model="profileState.avatar" type="url" :placeholder="$ts('module.system.profile.form.avatar')" class="w-full" />
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
                :schema="SysUserChangePasswordSchema"
                :state="passwordState"
                class="max-w-xl space-y-5"
                @submit="handlePasswordSubmit"
            >
              <UFormField name="oldPassword" :label="$ts('module.system.profile.oldPassword')" required>
                <UInput v-model="passwordState.oldPassword" type="password" autocomplete="current-password" :placeholder="$ts('module.system.profile.form.oldPassword')" class="w-full" />
              </UFormField>

              <UFormField name="password" :label="$ts('module.system.user.newPassword')" required>
                <UInput v-model="passwordState.password" type="password" autocomplete="new-password" :placeholder="$ts('module.system.user.form.newPassword')" class="w-full" />
              </UFormField>

              <UFormField name="confirmPassword" :label="$ts('module.system.user.confirmPassword')" required>
                <UInput v-model="passwordState.confirmPassword" type="password" autocomplete="new-password" :placeholder="$ts('module.system.user.form.confirmPassword')" class="w-full" />
              </UFormField>

              <div class="flex justify-end">
                <UButton type="submit" icon="i-lucide-key-round" :label="$ts('module.system.profile.changePassword')" :loading="savingPassword" />
              </div>
            </UForm>
          </UCard>
        </template>
      </UTabs>
    </div>
  </div>
</template>
