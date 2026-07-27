<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const { $trpc } = useNuxtApp()
const { fetch: fetchUserSession } = useUserSession()

const loading = ref(false)
const form = reactive({
  username: 'admin',
  password: 'adminadmin'
})

async function handleLogin() {
  if (!form.username || !form.password) {
    toast.add({
      title: '请输入用户名和密码',
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
    toast.add({
      title: '登录成功',
      color: 'success'
    })
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/system/home')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-(--ui-bg) flex">
    <section class="hidden lg:flex flex-1 items-center justify-center bg-primary/10 px-12">
      <div class="max-w-lg space-y-6">
        <div class="flex items-center gap-3">
          <UIcon name="i-tabler-brand-nuxt" class="size-12 text-primary" />
          <h1 class="text-4xl font-semibold text-(--ui-text-highlighted)">Nuxt Admin</h1>
        </div>
        <p class="text-lg text-(--ui-text-muted)">使用账号密码登录后台管理系统。</p>
      </div>
    </section>

    <section class="flex-1 flex items-center justify-center px-6 py-10">
      <div class="w-full max-w-sm space-y-8">
        <div class="space-y-2">
          <div class="flex items-center gap-2 lg:hidden">
            <UIcon name="i-tabler-brand-nuxt" class="size-8 text-primary" />
            <span class="text-xl font-semibold text-primary">Nuxt Admin</span>
          </div>
          <h2 class="text-2xl font-semibold text-(--ui-text-highlighted)">登录</h2>
          <p class="text-sm text-(--ui-text-muted)">请输入管理员账号继续。</p>
        </div>

        <form class="space-y-5" @submit.prevent="handleLogin">
          <UFormField label="用户名" required>
            <UInput
              v-model="form.username"
              icon="i-lucide-user"
              autocomplete="username"
              placeholder="admin"
              class="w-full"
            />
          </UFormField>

          <UFormField label="密码" required>
            <UInput
              v-model="form.password"
              icon="i-lucide-lock"
              type="password"
              autocomplete="current-password"
              placeholder="请输入密码"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            icon="i-lucide-log-in"
            :loading="loading"
            size="lg"
          >
            登录
          </UButton>
        </form>
      </div>
    </section>
  </main>
</template>
