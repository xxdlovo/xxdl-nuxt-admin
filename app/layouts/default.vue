<template>
  <div class="h-screen flex flex-col">
    <!-- 顶部导航栏 -->
    <header class="flex-shrink-0 h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 flex items-center">
      <h1 class="text-xl font-semibold">XXDL Admin</h1>
    </header>

    <!-- 主要内容区域 -->
    <main class="flex-1 min-h-0 overflow-hidden">
      <slot />
    </main>

    <!-- 底部版权信息 -->
    <footer class="flex-shrink-0 h-10 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      Copyright MIT © 2026
    </footer>
  </div>
</template>