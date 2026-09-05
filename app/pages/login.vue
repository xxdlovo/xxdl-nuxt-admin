<script setup lang="ts">
import {afterUserLogin} from "~/utils/common";
import { systemOtherLoginEnum } from '#shared/constants/business'
definePageMeta({
  layout: false
})
const route = useRoute()
const toast = useToast()
const { $ts } = useI18n()
const { $trpc } = useNuxtApp()
const { fetch: fetchUserSession, loggedIn } = useUserSession()
const { getConfigValue } = useConfig()
const colorMode = useColorMode()
type LoginForm = {
  username: string
  password: string
}

const loginRememberStorageKey = 'xxdl-login-remembered-account'
const defaultLoginForm: LoginForm = {
  username: 'admin',
  password: 'adminadmin'
}

const localeCookie = useCookie<string>('i18n_locale', {
  sameSite: 'lax',
  path: '/',
  // 登录页与全局语言切换器共用同一个长期 Cookie，刷新或重启开发服务后仍保留语言。
  maxAge: 60 * 60 * 24 * 365
})
const loading = ref(false)
const showPassword = ref(false)
const rememberMe = ref(false)
// 其他登录配置缺失时默认展示，确保历史部署尚未新增配置项时登录页功能不受影响。
const otherLoginEnabled = ref(true)
const form = reactive<LoginForm>({
  ...defaultLoginForm
})

const currentLocale = computed(() => localeCookie.value === 'zh' ? 'zh' : 'en')
const loginText = computed(() => {
  // Touch the cookie so this local view refreshes immediately after BaseSwitchLocal updates it.
  const locale = currentLocale.value
  const isZh = locale === 'zh'

  return {
    title:$ts('system.title'),
    aria: $ts('page.login.pwdLogin.title'),
    passwordLogin: $ts('page.login.pwdLogin.title'),
    username: $ts('page.login.common.userNamePlaceholder'),
    password: $ts('page.login.common.passwordPlaceholder'),
    rememberMe: $ts('page.login.pwdLogin.rememberMe'),
    forgetPassword: $ts('page.login.pwdLogin.forgetPassword'),
    confirm: $ts('page.login.common.confirm'),
    verificationLogin: $ts('page.login.codeLogin.title'),
    register: $ts('page.login.pwdLogin.register'),
    otherAccount: $ts('page.login.pwdLogin.otherAccountLogin'),
    loginSuccess: $ts('page.login.common.loginSuccess'),
    superAdmin: $ts('page.login.pwdLogin.superAdmin'),
    admin: $ts('page.login.pwdLogin.admin'),
    user: $ts('page.login.pwdLogin.user'),
    missingCredentials: isZh ? '请输入用户名和密码' : 'Please enter username and password',
    sessionNotReady: isZh
      ? '登录成功，但登录会话未生效，请检查 Cookie 或 HTTPS 配置'
      : 'Login succeeded, but the session was not established. Check the Cookie or HTTPS configuration.',
    showPassword: isZh ? '显示密码' : 'Show password',
    hidePassword: isZh ? '隐藏密码' : 'Hide password',
    switchToLight: `${$ts('common.switch')} ${$ts('theme.themeSchema.light')}`,
    switchToDark: `${$ts('common.switch')} ${$ts('theme.themeSchema.dark')}`
  }
})
const demoAccounts = computed(() => [
  { label: loginText.value.superAdmin, username: 'admin', password: 'adminadmin' },
  { label: loginText.value.admin, username: 'admin', password: 'adminadmin' },
  { label: loginText.value.user, username: 'admin', password: 'adminadmin' }
])
const isDarkMode = computed(() => colorMode.value === 'dark')
const themeToggleIcon = computed(() => isDarkMode.value ? 'i-lucide-sun' : 'i-lucide-moon')
const themeToggleLabel = computed(() => isDarkMode.value ? loginText.value.switchToLight : loginText.value.switchToDark)
const topShapeStyle = computed(() => ({ opacity: isDarkMode.value ? 0.44 : 0.94 }))
const bottomShapeStyle = computed(() => ({ opacity: isDarkMode.value ? 0.38 : 0.94 }))

function readRememberedLogin(): LoginForm | null {
  if (!import.meta.client) {
    return null
  }

  const rawValue = window.localStorage.getItem(loginRememberStorageKey)
  if (!rawValue) {
    return null
  }

  try {
    const value = JSON.parse(rawValue) as Partial<LoginForm>

    if (
        typeof value.username === 'string' &&
        value.username.trim() &&
        typeof value.password === 'string' &&
        value.password
    ) {
      return {
        username: value.username,
        password: value.password
      }
    }
  } catch {
    // Ignore malformed persisted state and fall back to the demo account.
  }

  return null
}

function persistRememberedLogin() {
  if (!import.meta.client) {
    return
  }

  if (rememberMe.value) {
    window.localStorage.setItem(loginRememberStorageKey, JSON.stringify({
      username: form.username,
      password: form.password
    }))
    return
  }

  window.localStorage.removeItem(loginRememberStorageKey)
}

function toggleColorMode() {
  const nextMode = isDarkMode.value ? 'light' : 'dark'

  colorMode.preference = nextMode
  window.localStorage.setItem('nuxt-ui-color-mode', nextMode)
}

function fillDemoAccount(account: { username: string, password: string }) {
  form.username = account.username
  form.password = account.password
}

onMounted(async () => {
  const rememberedLogin = readRememberedLogin()

  if (rememberedLogin) {
    Object.assign(form, rememberedLogin)
    rememberMe.value = true
  }

  // 验证码登录和演示账号属于同一组“其他登录”入口，统一由系统配置控制。
  // 配置服务返回字符串；未创建该配置项时 getConfigValue 会返回传入的布尔默认值 true。
  try {
    const value = await getConfigValue(systemOtherLoginEnum.key, true)
    otherLoginEnabled.value = value === true || value === systemOtherLoginEnum.enabled
  } catch {
    // 配置接口暂时不可用时保留 true，避免网络波动把验证码和其他账号入口错误隐藏。
    otherLoginEnabled.value = true
  }
})

watch(rememberMe, (checked) => {
  if (checked || !import.meta.client) {
    return
  }

  window.localStorage.removeItem(loginRememberStorageKey)
})

async function handleLogin() {
  if (!form.username || !form.password) {
    toast.add({
      title: loginText.value.missingCredentials,
      color: 'warning'
    })
    return
  }

  loading.value = true
  try {
    await $trpc.auth.login.mutate({
      username: form.username,
      password: form.password
    })
    await fetchUserSession()

    // 登录接口返回成功只代表账号密码校验通过；真正决定能否访问受保护页面的是 session Cookie。
    // 如果浏览器因 Secure Cookie、反向代理或域名配置问题没有保存该 Cookie，
    // 此时继续跳转只会被全局鉴权中间件重新带回 /login?redirect=...，形成“登录成功但不跳转”。
    // 先校验 loggedIn，给出明确提示并停止跳转，避免向用户展示误导性的登录成功流程。
    if (!loggedIn.value) {
      toast.add({
        title: loginText.value.sessionNotReady,
        color: 'warning'
      })
      return
    }

    persistRememberedLogin()
    toast.add({
      title: loginText.value.loginSuccess,
      color: 'success'
    })
    await afterUserLogin(form.username)
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/system/home')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page relative min-h-screen overflow-hidden text-default">
    <div class="login-shape login-shape-top pointer-events-none absolute transition-opacity duration-200" :style="topShapeStyle" />
    <div class="login-shape login-shape-bottom pointer-events-none absolute transition-opacity duration-200" :style="bottomShapeStyle" />

    <section
        class="relative z-[1] flex min-h-screen items-center justify-center p-8 max-sm:items-start max-sm:px-4 max-sm:pt-20 max-sm:pb-10"
        :aria-label="loginText.aria"
    >
      <div class="login-card relative w-[min(100%,360px)] rounded-lg px-5 pt-4 pb-[1.15rem] backdrop-blur-[14px] max-sm:w-[min(100%,22rem)]">
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
          <div class="login-logo flex size-12 items-center justify-center overflow-hidden rounded-xl">
            <img src="/favicon.ico" alt="" class="block size-[2.35rem] object-contain">
          </div>
          <h1 class="text-[1.45rem] leading-tight font-semibold text-primary">{{ loginText.title }}</h1>
        </div>

        <div class="mb-[1.1rem] text-[0.95rem] font-medium text-primary">
          <p>{{ loginText.passwordLogin }}</p>
        </div>

        <form class="grid gap-4" @submit.prevent="handleLogin">
          <UInput
              v-model="form.username"
              icon="i-lucide-user"
              autocomplete="username"
              :placeholder="loginText.username"
              size="lg"
              variant="outline"
              class="w-full"
          />

          <UInput
              v-model="form.password"
              icon="i-lucide-lock"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              :placeholder="loginText.password"
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
                  :aria-label="showPassword ? loginText.hidePassword : loginText.showPassword"
                  @click="showPassword = !showPassword"
              />
            </template>
          </UInput>

          <div class="flex min-h-8 items-center justify-between gap-4 text-[0.8rem]">
            <UCheckbox v-model="rememberMe" :label="loginText.rememberMe" />
            <UButton type="button" variant="link" color="neutral" size="sm" class="px-0">
              {{ loginText.forgetPassword }}
            </UButton>
          </div>

          <UButton
              type="submit"
              block
              :loading="loading"
              size="lg"
              class="min-h-[2.55rem] rounded-full font-semibold"
          >
            {{ loginText.confirm }}
          </UButton>

          <div
              class="grid gap-2.5 max-sm:grid-cols-1"
              :class="otherLoginEnabled ? 'grid-cols-2' : 'grid-cols-1'"
          >
            <!-- 与其他账号入口共用开关，关闭后不渲染尚未启用的验证码登录入口。 -->
            <UButton v-if="otherLoginEnabled" type="button" color="neutral" variant="outline" block disabled>
              {{ loginText.verificationLogin }}
            </UButton>
            <UButton to="/register" color="neutral" variant="outline" block>
              {{ loginText.register }}
            </UButton>
          </div>
        </form>

        <!-- 配置关闭时，分隔线和演示账号必须一并隐藏，避免留下无意义的登录区域。 -->
        <template v-if="otherLoginEnabled">
          <div class="login-divider my-[1.05rem] mb-3 flex items-center gap-3 text-[0.78rem] whitespace-nowrap text-muted">
            <span>{{ loginText.otherAccount }}</span>
          </div>

          <div class="flex flex-wrap justify-center gap-2.5">
            <UButton
                v-for="account in demoAccounts"
                :key="account.label"
                type="button"
                size="sm"
                disabled
                class="min-w-[4.25rem] rounded-none font-semibold"
                @click="fillDemoAccount(account)"
            >
              {{ account.label }}
            </UButton>
          </div>
        </template>
      </div>
    </section>

    <div class="absolute bottom-3 left-1/2 z-[1] h-[0.28rem] w-8 -translate-x-1/2 rounded-full bg-[rgb(20_26_24_/_72%)]" />
  </main>
</template>

<style scoped>
.login-page {
  background:
      radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--ui-primary) 10%, transparent) 0 10rem, transparent 22rem),
      color-mix(in srgb, var(--ui-primary) 14%, var(--ui-bg));
}

.login-card {
  border: 1px solid color-mix(in srgb, var(--ui-primary) 12%, var(--ui-border));
  background: color-mix(in srgb, var(--ui-bg) 94%, white);
  box-shadow: 0 24px 70px color-mix(in srgb, var(--ui-primary) 18%, transparent);
}

.login-logo {
  background: color-mix(in srgb, var(--ui-primary) 10%, var(--ui-bg));
  box-shadow: 0 12px 28px color-mix(in srgb, var(--ui-primary) 24%, transparent);
}

.login-divider::before,
.login-divider::after {
  content: '';
  height: 1px;
  flex: 1;
  background: var(--ui-border);
}

.login-shape {
  background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--ui-primary) 92%, black),
      color-mix(in srgb, var(--ui-primary) 66%, white)
  );
}

.login-shape-top {
  top: -14rem;
  right: -12rem;
  width: min(52vw, 42rem);
  height: min(36vw, 26rem);
  border-bottom-left-radius: 62% 78%;
  border-bottom-right-radius: 42% 34%;
  transform: rotate(-6deg);
}

.login-shape-bottom {
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
  .login-shape-top {
    top: -8rem;
    right: -8rem;
    width: 20rem;
    height: 15rem;
  }

  .login-shape-bottom {
    bottom: -8rem;
    left: -8rem;
    width: 18rem;
    height: 18rem;
  }
}
</style>
