<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <SysDictDataPanel />
  </div>
</template>

<script setup lang="ts">
import SysDictDataPanel from './components/sys-dict-data-panel.vue'

definePageMeta({
  layout: 'system'
})
</script>

<style scoped>
:deep(.overflow-auto) {
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  :deep(table) {
    display: table;
    width: 100%;
    min-width: 600px;
  }
}
</style>
