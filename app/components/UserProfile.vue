<script setup lang="ts">
const { user, clear } = useUserSession()

const displayName = computed(() => user.value?.nickname || user.value?.username || '用户')
const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase())

async function handleLogout() {
  await clear()
  await navigateTo('/login')
}

const items = computed(() => [[
  {
    label: displayName.value,
    icon: 'i-lucide-user'
  },
  {
    label: '退出登录',
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
