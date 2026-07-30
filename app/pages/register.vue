<script setup lang="ts">
import { systemRegisterEnum } from '#shared/constants/business'

const toast = useToast()
const { $ts } = useI18n()
const { $trpc } = useNuxtApp()
const { getConfigValue } = useConfig()
const colorMode = useColorMode()

const localeCookie = useCookie<string>('i18n_locale', {
  sameSite: 'lax',
  path: '/'
})
const enableReg = ref(false)
const enableRegLoading = ref(true)
const loading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const form = reactive({
  phone: '',
  username: '',
  password: '',
  confirmPassword: ''
})

const isDarkMode = computed(() => colorMode.value === 'dark')
const themeToggleIcon = computed(() => isDarkMode.value ? 'i-lucide-sun' : 'i-lucide-moon')
const topShapeStyle = computed(() => ({ opacity: isDarkMode.value ? 0.44 : 0.94 }))
const bottomShapeStyle = computed(() => ({ opacity: isDarkMode.value ? 0.38 : 0.94 }))
const text = computed(() => {
  const isZh = localeCookie.value === 'zh'

  return {
    aria: $ts('page.login.register.title'),
    title: $ts('page.login.register.title'),
    phone: $ts('form.phone.required'),
    username: $ts('form.userName.required'),
    password: $ts('page.login.common.passwordPlaceholder'),
    confirmPassword: $ts('page.login.common.confirmPasswordPlaceholder'),
    submit: $ts('page.login.register.title'),
    back: $ts('page.login.common.back'),
    success: isZh ? '注册成功，请登录' : 'Registration successful. Please log in.',
    disabled: $ts('page.login.register.disabled'),
    passwordMismatch: $ts('form.confirmPwd.invalid'),
    showPassword: isZh ? '显示密码' : 'Show password',
    hidePassword: isZh ? '隐藏密码' : 'Hide password',
    switchToLight: `${$ts('common.switch')} ${$ts('theme.themeSchema.light')}`,
    switchToDark: `${$ts('common.switch')} ${$ts('theme.themeSchema.dark')}`
  }
})
const themeToggleLabel = computed(() => isDarkMode.value ? text.value.switchToLight : text.value.switchToDark)

function toggleColorMode() {
  const nextMode = isDarkMode.value ? 'light' : 'dark'

  colorMode.preference = nextMode
  window.localStorage.setItem('nuxt-ui-color-mode', nextMode)
}

async function handleRegister() {
  if (!enableReg.value) {
    toast.add({
      title: text.value.disabled,
      color: 'warning'
    })
    return
  }

  if (form.password !== form.confirmPassword) {
    toast.add({
      title: text.value.passwordMismatch,
      color: 'warning'
    })
    return
  }

  loading.value = true
  try {
    await $trpc.auth.register.mutate({
      phone: form.phone,
      username: form.username,
      password: form.password,
      confirmPassword: form.confirmPassword
    })
    toast.add({
      title: text.value.success,
      color: 'success'
    })
    await navigateTo('/login')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const value = await getConfigValue(systemRegisterEnum.key, systemRegisterEnum.no)
    enableReg.value = value === systemRegisterEnum.yes
  } finally {
    enableRegLoading.value = false
  }
})
</script>

<template>
  <main class="auth-page relative min-h-screen overflow-hidden text-default">
    <div class="auth-shape auth-shape-top pointer-events-none absolute transition-opacity duration-200" :style="topShapeStyle" />
    <div class="auth-shape auth-shape-bottom pointer-events-none absolute transition-opacity duration-200" :style="bottomShapeStyle" />

    <section class="relative z-[1] flex min-h-screen items-center justify-center p-8 max-sm:items-start max-sm:px-4 max-sm:pt-20 max-sm:pb-10" :aria-label="text.aria">
      <div class="auth-card relative w-[min(100%,360px)] rounded-lg px-5 pt-4 pb-5 backdrop-blur-[14px]">
        <div class="absolute top-3 right-3 flex items-center gap-0.5">
          <UButton
            type="button"
            :icon="themeToggleIcon"
            color="neutral"
            variant="ghost"
            :aria-label="themeToggleLabel"
            @click="toggleColorMode"
          />
          <BaseSwitchLocal />
        </div>

        <div class="flex min-h-[4.75rem] items-center justify-center gap-3.5 pr-8">
          <div class="auth-logo flex size-12 items-center justify-center overflow-hidden rounded-xl">
            <img src="/favicon.ico" alt="" class="block size-[2.35rem] object-contain">
          </div>
          <h1 class="text-[1.45rem] leading-tight font-semibold text-primary">{{ $ts('system.title') }}</h1>
        </div>

        <div class="mb-[1.1rem] text-[0.95rem] font-medium text-primary">
          <p>{{ text.title }}</p>
        </div>

        <div v-if="enableRegLoading" class="flex min-h-[18rem] items-center justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-primary" />
        </div>

        <div v-else-if="!enableReg" class="grid gap-4 text-center">
          <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning">
            <UIcon name="i-lucide-circle-alert" class="size-6" />
          </div>
          <p class="text-sm text-muted">{{ text.disabled }}</p>
          <UButton to="/login" color="neutral" variant="outline" block>
            {{ text.back }}
          </UButton>
        </div>

        <form v-else class="grid gap-4" @submit.prevent="handleRegister">
          <UInput
            v-model="form.phone"
            icon="i-lucide-phone"
            autocomplete="tel"
            type="tel"
            :placeholder="text.phone"
            size="lg"
            variant="outline"
            class="w-full"
          />

          <UInput
            v-model="form.username"
            icon="i-lucide-user"
            autocomplete="username"
            :placeholder="text.username"
            size="lg"
            variant="outline"
            class="w-full"
          />

          <UInput
            v-model="form.password"
            icon="i-lucide-lock"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :placeholder="text.password"
            size="lg"
            variant="outline"
            class="w-full"
          >
            <template #trailing>
              <UButton
                type="button"
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="ghost"
                size="xs"
                square
                :aria-label="showPassword ? text.hidePassword : text.showPassword"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>

          <UInput
            v-model="form.confirmPassword"
            icon="i-lucide-shield-check"
            :type="showConfirmPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :placeholder="text.confirmPassword"
            size="lg"
            variant="outline"
            class="w-full"
          >
            <template #trailing>
              <UButton
                type="button"
                :icon="showConfirmPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="ghost"
                size="xs"
                square
                :aria-label="showConfirmPassword ? text.hidePassword : text.showPassword"
                @click="showConfirmPassword = !showConfirmPassword"
              />
            </template>
          </UInput>

          <UButton type="submit" block :loading="loading" size="lg" class="min-h-[2.55rem] rounded-full font-semibold">
            {{ text.submit }}
          </UButton>

          <UButton to="/login" color="neutral" variant="outline" block>
            {{ text.back }}
          </UButton>
        </form>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  background:
    radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--ui-primary) 10%, transparent) 0 10rem, transparent 22rem),
    color-mix(in srgb, var(--ui-primary) 14%, var(--ui-bg));
}

.auth-card {
  border: 1px solid color-mix(in srgb, var(--ui-primary) 12%, var(--ui-border));
  background: color-mix(in srgb, var(--ui-bg) 94%, white);
  box-shadow: 0 24px 70px color-mix(in srgb, var(--ui-primary) 18%, transparent);
}

.auth-logo {
  background: color-mix(in srgb, var(--ui-primary) 10%, var(--ui-bg));
  box-shadow: 0 12px 28px color-mix(in srgb, var(--ui-primary) 24%, transparent);
}

.auth-shape {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-primary) 92%, black),
    color-mix(in srgb, var(--ui-primary) 66%, white)
  );
}

.auth-shape-top {
  top: -14rem;
  right: -12rem;
  width: min(52vw, 42rem);
  height: min(36vw, 26rem);
  border-bottom-left-radius: 62% 78%;
  border-bottom-right-radius: 42% 34%;
  transform: rotate(-6deg);
}

.auth-shape-bottom {
  bottom: -11rem;
  left: -10rem;
  width: min(42vw, 34rem);
  height: min(42vw, 34rem);
  border-top-left-radius: 38% 36%;
  border-top-right-radius: 58% 66%;
  border-bottom-right-radius: 34% 42%;
  transform: rotate(-12deg);
}

@media (max-width: 640px) {
  .auth-shape-top {
    top: -8rem;
    right: -8rem;
    width: 20rem;
    height: 15rem;
  }

  .auth-shape-bottom {
    bottom: -8rem;
    left: -8rem;
    width: 18rem;
    height: 18rem;
  }
}
</style>
