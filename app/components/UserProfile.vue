<script setup lang="ts">
const { user, clear } = useUserSession()
const { clearProfile } = useRbacProfile()
const { $ts } = useI18n()

const displayName = computed(() => user.value?.nickname || user.value?.username || $ts('module.system.profile.userFallback'))
const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase())

async function handleLogout() {
  clearProfile()
  await clear()
  await navigateTo('/login')
}

const items = computed(() => [[
  {
    label: $ts('common.userCenter'),
    icon: 'i-lucide-id-card',
    to: '/system/user/profile'
  }
], [
  {
    label: $ts('common.logout'),
    icon: 'i-lucide-log-out',
    onSelect: handleLogout
  }
]])
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton color="neutral" variant="ghost" class="px-2">
      <UAvatar :src="user?.avatar || undefined" :alt="displayName" size="sm">
        {{ avatarText }}
      </UAvatar>
      <span class="hidden sm:inline max-w-32 truncate">{{ displayName }}</span>
    </UButton>
  </UDropdownMenu>
</template>
