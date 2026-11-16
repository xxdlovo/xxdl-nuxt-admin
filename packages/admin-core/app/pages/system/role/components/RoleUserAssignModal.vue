<script setup lang="ts">
import type { SysRoleDto } from '#admin/shared/system/role'
import { useToastSuccess } from '#admin/app/utils/toast'

type UserOption = {
  id: string
  username?: string | null
  nickname?: string | null
}

const props = defineProps<{
  open: boolean
  role?: SysRoleDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const visible = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
})

const saving = ref(false)
const loading = ref(false)
const keyword = ref('')
const selectedUserIds = ref<string[]>([])
const userOptions = ref<UserOption[]>([])

function toOption(user: UserOption) {
  return {
    label: user.nickname ? `${user.nickname} (${user.username})` : (user.username || user.id),
    value: user.id,
  }
}

const items = computed(() => userOptions.value.map(toOption))

function mergeUsers(users: UserOption[]) {
  const map = new Map(userOptions.value.map(user => [user.id, user]))
  users.forEach(user => map.set(user.id, user))
  userOptions.value = Array.from(map.values())
}

async function loadAssigned() {
  if (!props.role?.id) {
    selectedUserIds.value = []
    return
  }

  const users = await $trpc.sysRole.assignedUsers.query({ roleId: props.role.id }) as UserOption[]
  mergeUsers(users)
  selectedUserIds.value = users.map(user => user.id)
}

async function searchUsers() {
  loading.value = true
  try {
    const users = await $trpc.sysRole.assignableUsers.query({
      keyword: keyword.value.trim() || undefined,
      limit: 200,
    }) as UserOption[]
    mergeUsers(users)
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.role?.id] as const,
  async ([open]) => {
    if (!open) {
      return
    }

    keyword.value = ''
    userOptions.value = []
    await Promise.all([loadAssigned(), searchUsers()])
  },
  { immediate: true }
)

async function save() {
  if (!props.role?.id) {
    return
  }

  saving.value = true
  try {
    await $trpc.sysRole.assignUsers.mutate({
      roleId: props.role.id,
      userIds: selectedUserIds.value,
    })
    useToastSuccess($ts('common.modifySuccess'))
    emit('saved')
    visible.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
      v-model:open="visible"
      :title="`${$ts('module.system.role.assignUsers')} - ${role?.name || ''}`"
      :dismissible="!saving"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[640px] overflow-hidden', body: 'p-4 sm:p-6', footer: 'justify-end gap-2 p-4 sm:px-6' }"
  >
    <template #body>
      <div class="mb-3 flex items-center gap-2">
        <UInput
            v-model="keyword"
            icon="i-lucide-search"
            :placeholder="$ts('module.system.role.form.userSearch')"
            class="flex-1"
            @keyup.enter="searchUsers"
        />
        <UButton color="neutral" variant="outline" :loading="loading" @click="searchUsers">
          {{ $ts('common.search') }}
        </UButton>
      </div>

      <USelectMenu
          v-model="selectedUserIds"
          multiple
          value-key="value"
          :items="items"
          :loading="loading"
          :placeholder="$ts('module.system.role.form.assignUsers')"
          class="w-full"
      />

      <p class="mt-2 text-xs text-muted">
        {{ $ts('module.system.role.assignUsersTip') }}
      </p>
    </template>

    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" :disabled="saving" @click="visible = false" />
      <UButton :label="$ts('common.confirm')" color="primary" :loading="saving" @click="save" />
    </template>
  </UModal>
</template>
