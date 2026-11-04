<script setup lang="ts">
defineProps<{
  showTitle?: boolean
  collapsed?: boolean
}>()
const { $ts } = useI18n()
</script>

<template>
  <div
      class="flex min-w-0 items-center gap-2"
      :class="collapsed ? 'justify-center px-0' : 'px-3'"
  >
    <img
        src="/favicon.ico"
        alt=""
        class="block shrink-0 object-contain"
        :class="collapsed ? 'h-9 w-9' : 'h-7 w-7'"
        aria-hidden="true"
    >
<!--    <UIcon-->
<!--        name="i-tabler:brand-nuxt"-->
<!--        size="2em"-->
<!--        class="shrink-0 text-primary"-->
<!--    />-->
    <span
        v-if="showTitle !== false"
        class="truncate font-semibold text-primary"
    >
      {{ $ts('system.title') }}
    </span>
  </div>
</template>
