<template>
  <UCard>
    <template #header>
      <div class="flex justify-between items-center">
        <span>{{ $t('page.home.creativity') }}</span>
      </div>
    </template>
    <div class="pl-30 flex justify-between">
      <UIcon name="tabler:layout-dashboard" class=" flex justify-between size-80 text-primary" />
    </div>
  </UCard>
</template>

<script lang="ts" setup>
const { $t } = useI18n()
</script>

<style></style>