<script setup lang="ts">
const { user, clear } = useUserSession()
const { clearProfile } = useRbacProfile()
const dictStore = useDictStore()
const { $ts } = useI18n()

const displayName = computed(() => user.value?.nickname || user.value?.username || $ts('module.system.profile.userFallback'))
const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase())

async function handleLogout() {
  clearProfile()
  dictStore.clearDict()
  await clear()
  await navigateTo('/login')
}

const items = computed(() => [[
  {
    label: $ts('common.userCenter'),
    icon: 'i-lucide-id-card',
    to: '/system/user/profile'
  },
  {
    // 会员自助：余额、充值、流水与邀请码
    label: $ts('module.system.wallet.title'),
    icon: 'i-lucide-wallet',
    to: '/system/wallet'
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
