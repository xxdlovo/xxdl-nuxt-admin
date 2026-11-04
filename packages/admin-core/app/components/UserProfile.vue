<script setup lang="ts">
const { user, clear } = useUserSession()
const { clearProfile } = useRbacProfile()
const dictStore = useDictStore()
const { $ts } = useI18n()
// 业务层追加的菜单项（如钱包/商城/我的订单），未安装业务层时为空数组
const extraItems = useUserMenuExtraItems()

const displayName = computed(() => user.value?.nickname || user.value?.username || $ts('module.system.profile.userFallback'))
const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase())

async function handleLogout() {
  clearProfile()
  dictStore.clearDict()
  await clear()
  await navigateTo('/login')
}

/**
 * 顶栏用户下拉菜单。
 *
 * 基座只提供账号自身能力；业务自助入口由业务层通过
 * `registerUserMenuItems()` 注册后出现在这里。
 */
const items = computed(() => {
  const business = extraItems.value.map(item => ({
    label: $ts(item.labelKey),
    icon: item.icon,
    to: item.to
  }))

  const account = [{
    label: $ts('common.userCenter'),
    icon: 'i-lucide-id-card',
    to: '/system/user/profile'
  }]

  const groups = [account]

  if (business.length > 0) {
    groups.push(business)
  }

  groups.push([{
    label: $ts('common.logout'),
    icon: 'i-lucide-log-out',
    onSelect: handleLogout
  }] as never)

  return groups
})
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
