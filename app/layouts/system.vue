<script setup lang="ts">
const { $t } = useI18n()
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const toast = useToast()

const open = ref(false)

const links = [[{
  label: 'Home',
  icon: 'i-lucide-house',
  to: '/system/home',
  onSelect: () => {
    open.value = false
  }
},
{
  label: 'Demo',
  icon: 'i-lucide-house',
  to: '/demo',
  onSelect: () => {
    open.value = false
  }
},
{
  label: '系统管理',
  icon: 'i-lucide-house',
  children: [{
    label: '用户管理',
    to: '/system/user',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }
    , {
    label: '部门管理',
    to: '/system/dept',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }    , {
      label: '字典数据管理',
      to: '/system/dict-data',
      exact: true,
      onSelect: () => {
        open.value = false
      }
    }
    , {
      label: '字典管理',
      to: '/system/dict-type',
      exact: true,
      onSelect: () => {
        open.value = false
      }
    }
    , {
    label: '菜单管理',
    to: '/system/menu',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }
  ]
},
], []] satisfies NavigationMenuItem[][]

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.flat()
}, {
  id: 'code',
  label: 'Code',
  items: [{
    id: 'source',
    label: 'View page source',
    icon: 'i-simple-icons-github',
    to: `https://github.com/nuxt-ui-pro/dashboard/blob/main/app/pages${route.path === '/' ? '/index' : route.path}.vue`,
    target: '_blank'
  }]
}])

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our website.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Accept',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Opt out',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar id="default" v-model:open="open" collapsible resizable
      :ui="{ footer: 'lg:border-t lg:border-default' }">
      <template #header="{ collapsed }">
        <UIcon name="i-tabler:brand-nuxt" size="2em" class="text-primary" />


        <span v-if="!collapsed" class="text-primary">Nuxt Admin</span>

        <!-- <div class="i-lucide-settings">1</div> -->

        <!-- <TeamsMenu :collapsed="collapsed" /> -->
      </template>

      <template #default="{ collapsed }">
        <!-- <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" /> -->

        <UNavigationMenu :collapsed="collapsed" :items="links[0]" orientation="vertical" tooltip popover />
      </template>


    </UDashboardSidebar>

    <!-- <UDashboardSearch :groups="groups" /> -->
    <UDashboardPanel id="home" :ui="{body:'p-0 sm:p-0 gap-0 sm:gap-0'}">
      <template #header> 
        <UDashboardNavbar :ui="{ right: 'gap-3' }">

          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #title>
            <!-- todo 后面做导航 -->
            首页
          </template>
          <template #right>
            <BaseSearch />
            <BaseSwitchLocal />
            <BaseThemePick />
            <UserProfile />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body >
        <div class="h-[40px] flex-shrink-0">
          标题栏
        </div>
        <div class="flex-1 min-h-0">
          <slot />
        </div>
      </template>
      <template #footer>
        <div class="text-center ">
          PowerBy nuxt
        </div>
      </template>

    </UDashboardPanel>


    <!-- <NotificationsSlideover /> -->
  </UDashboardGroup>
</template>