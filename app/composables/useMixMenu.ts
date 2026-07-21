import type { RbacMenu } from '#shared/auth'
import type { MaybeRefOrGetter } from 'vue'

export function useMixMenu(menus: MaybeRefOrGetter<RbacMenu[]>) {
  const route = useRoute()
  const router = useRouter()
  const themeStore = useThemeStore()
  const selectedRootId = ref<string | null>(null)
  const selectedSecondId = ref<string | null>(null)

  const allMenus = computed(() => getRenderableMenus(toValue(menus)))
  const activeTrail = computed(() => resolveActiveTrail(allMenus.value, route.path))

  const firstLevelMenus = computed(() => allMenus.value)
  const activeFirstLevelMenu = computed(() => {
    return allMenus.value.find(menu => menu.id === selectedRootId.value)
      || activeTrail.value[0]
      || allMenus.value[0]
      || null
  })
  const activeFirstLevelMenuKey = computed(() => activeFirstLevelMenu.value?.path || activeFirstLevelMenu.value?.id || '')
  const isActiveFirstLevelMenuHasChildren = computed(() => {
    return Boolean(activeFirstLevelMenu.value && getRenderableMenus(activeFirstLevelMenu.value.children).length > 0)
  })

  const secondLevelMenus = computed(() => {
    return activeFirstLevelMenu.value ? getRenderableMenus(activeFirstLevelMenu.value.children) : []
  })
  const activeSecondLevelMenu = computed(() => {
    return secondLevelMenus.value.find(menu => menu.id === selectedSecondId.value)
      || activeTrail.value[1]
      || secondLevelMenus.value[0]
      || null
  })
  const activeSecondLevelMenuKey = computed(() => activeSecondLevelMenu.value?.path || activeSecondLevelMenu.value?.id || '')
  const isActiveSecondLevelMenuHasChildren = computed(() => {
    return Boolean(activeSecondLevelMenu.value && getRenderableMenus(activeSecondLevelMenu.value.children).length > 0)
  })

  const childLevelMenus = computed(() => {
    return activeSecondLevelMenu.value ? getRenderableMenus(activeSecondLevelMenu.value.children) : []
  })
  const hasChildLevelMenus = computed(() => childLevelMenus.value.length > 0)

  function syncActiveMenus() {
    selectedRootId.value = activeTrail.value[0]?.id || allMenus.value[0]?.id || null
    selectedSecondId.value = activeTrail.value[1]?.id || secondLevelMenus.value[0]?.id || null
  }

  async function navigatePath(path?: string | null) {
    if (path && path !== route.path) {
      await router.push(path)
    }
  }

  async function navigateMenu(menu?: RbacMenu | null) {
    await navigatePath(findFirstPath(menu))
  }

  async function selectFirstLevelMenu(menu: RbacMenu) {
    selectedRootId.value = menu.id
    selectedSecondId.value = getRenderableMenus(menu.children)[0]?.id || null

    if (!getRenderableMenus(menu.children).length || themeStore.sider.autoSelectFirstMenu) {
      await navigateMenu(menu)
    }
  }

  function activateFirstLevelMenu(menu: RbacMenu) {
    const secondMenus = getRenderableMenus(menu.children)
    const activeSecond = activeTrail.value[0]?.id === menu.id ? activeTrail.value[1] : null
    const selectedSecond = secondMenus.find(item => item.id === selectedSecondId.value)

    selectedRootId.value = menu.id
    selectedSecondId.value = activeSecond?.id || selectedSecond?.id || secondMenus[0]?.id || null
  }

  async function selectFirstLevelMenuAndGoDeepest(menu: RbacMenu) {
    selectedRootId.value = menu.id
    selectedSecondId.value = getRenderableMenus(menu.children)[0]?.id || null
    await navigateMenu(menu)
  }

  async function selectSecondLevelMenu(menu: RbacMenu) {
    selectedSecondId.value = menu.id
    await navigateMenu(menu)
  }

  function activateSecondLevelMenu(menu: RbacMenu) {
    selectedSecondId.value = menu.id
  }

  function isFirstLevelActive(menu: RbacMenu) {
    return activeFirstLevelMenu.value?.id === menu.id
  }

  function isSecondLevelActive(menu: RbacMenu) {
    return activeSecondLevelMenu.value?.id === menu.id
  }

  watch(
    () => [route.path, allMenus.value] as const,
    syncActiveMenus,
    { immediate: true }
  )

  return {
    firstLevelMenus,
    activeFirstLevelMenuKey,
    activeFirstLevelMenu,
    isActiveFirstLevelMenuHasChildren,
    secondLevelMenus,
    activeSecondLevelMenuKey,
    activeSecondLevelMenu,
    isActiveSecondLevelMenuHasChildren,
    childLevelMenus,
    hasChildLevelMenus,
    selectFirstLevelMenu,
    activateFirstLevelMenu,
    selectFirstLevelMenuAndGoDeepest,
    selectSecondLevelMenu,
    activateSecondLevelMenu,
    isFirstLevelActive,
    isSecondLevelActive,
    navigateMenu
  }
}
