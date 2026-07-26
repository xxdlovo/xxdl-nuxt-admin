<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { useLandingLocale } from '../useLandingLocale'
import LandingLogo from './LandingLogo.vue'
import LandingThemePicker from './LandingThemePicker.vue'

const { content: page, locale, locales, switchLocale } = useLandingLocale()
const { loggedIn } = useUserSession()
const activeSection = ref<string>()
const sectionIds = ['showcase', 'features', 'stack', 'faq', 'contact'] as const
let scrollFrame: number | undefined

const items = computed<NavigationMenuItem[]>(() => [
  {
    label: page.value.navigation.showcase,
    to: '#showcase',
    exactHash: true,
    active: activeSection.value === 'showcase'
  },
  {
    label: page.value.navigation.features,
    to: '#features',
    exactHash: true,
    active: activeSection.value === 'features'
  },
  {
    label: page.value.navigation.stack,
    to: '#stack',
    exactHash: true,
    active: activeSection.value === 'stack'
  },
  {
    label: page.value.navigation.faq,
    to: '#faq',
    exactHash: true,
    active: activeSection.value === 'faq'
  },
  {
    label: page.value.navigation.contact,
    to: '#contact',
    exactHash: true,
    active: activeSection.value === 'contact'
  }
])

const localeItems = computed<DropdownMenuItem[]>(() =>
  locales.value.map(item => ({
    label: item.label,
    icon: item.code === locale.value ? 'i-lucide-check' : undefined,
    color: item.code === locale.value ? 'primary' : 'neutral',
    onSelect: () => switchLocale(item.code)
  }))
)

const systemAction = computed(() => ({
  label: loggedIn.value ? page.value.actions.enterSystem : page.value.actions.signIn,
  to: loggedIn.value ? '/system/home' : '/login'
}))

function updateActiveSection() {
  scrollFrame = undefined
  const activationLine = Math.min(window.innerHeight * 0.32, 260)
  let current: string | undefined

  for (const id of sectionIds) {
    const section = document.getElementById(id)
    if (section && section.getBoundingClientRect().top <= activationLine) {
      current = id
    }
  }

  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
    current = sectionIds.at(-1)
  }

  activeSection.value = current
}

function handleScroll() {
  if (scrollFrame === undefined) {
    scrollFrame = window.requestAnimationFrame(updateActiveSection)
  }
}

onMounted(() => {
  updateActiveSection()
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)
  if (scrollFrame !== undefined) {
    window.cancelAnimationFrame(scrollFrame)
  }
})
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink to="/" :aria-label="`${page.brand.name} home`">
        <LandingLogo :name="page.brand.name" />
      </NuxtLink>
      <UBadge :label="page.brand.badge" variant="subtle" class="rounded-full font-semibold" />
    </template>

    <UNavigationMenu :items="items" variant="link" />

    <template #right>
      <UDropdownMenu :items="localeItems">
        <UTooltip :text="page.actions.language" :delay-duration="0">
          <UButton
            icon="i-lucide-languages"
            color="neutral"
            variant="ghost"
            :aria-label="page.actions.language"
          />
        </UTooltip>
      </UDropdownMenu>
      <LandingThemePicker
        :label="page.actions.appearance"
        :primary-label="page.actions.primaryColor"
        :neutral-label="page.actions.neutralColor"
        :default-label="page.actions.defaultColor"
      />
      <UColorModeButton />
      <UButton
        :label="page.actions.source"
        icon="i-simple-icons-github"
        color="neutral"
        variant="ghost"
        class="hidden xl:flex"
        to="#"
      />
      <UButton
        :label="systemAction.label"
        icon="i-lucide-log-in"
        color="neutral"
        class="hidden lg:flex"
        :to="systemAction.to"
      />
    </template>

    <template #body>
      <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      <div class="mt-4 grid grid-cols-2 gap-2">
        <UButton
          :label="page.actions.source"
          icon="i-simple-icons-github"
          color="neutral"
          variant="soft"
          block
          to="#"
        />
        <UButton
          :label="systemAction.label"
          icon="i-lucide-log-in"
          block
          :to="systemAction.to"
        />
      </div>
    </template>
  </UHeader>
</template>
