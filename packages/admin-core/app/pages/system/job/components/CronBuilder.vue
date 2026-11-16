<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-1">
      <UButton
          v-for="preset in presets"
          :key="preset"
          size="xs"
          color="neutral"
          variant="outline"
          class="font-mono"
          @click="applyPreset(preset)"
      >
        {{ preset }}
      </UButton>
    </div>

    <div class="grid grid-cols-5 gap-2">
      <UFormField :label="$ts('module.system.job.cronBuilder.minute')" :ui="{ root: 'space-y-1' }">
        <UInput v-model="parts[0]" size="sm" class="w-full font-mono" />
      </UFormField>
      <UFormField :label="$ts('module.system.job.cronBuilder.hour')" :ui="{ root: 'space-y-1' }">
        <UInput v-model="parts[1]" size="sm" class="w-full font-mono" />
      </UFormField>
      <UFormField :label="$ts('module.system.job.cronBuilder.day')" :ui="{ root: 'space-y-1' }">
        <UInput v-model="parts[2]" size="sm" class="w-full font-mono" />
      </UFormField>
      <UFormField :label="$ts('module.system.job.cronBuilder.month')" :ui="{ root: 'space-y-1' }">
        <UInput v-model="parts[3]" size="sm" class="w-full font-mono" />
      </UFormField>
      <UFormField :label="$ts('module.system.job.cronBuilder.week')" :ui="{ root: 'space-y-1' }">
        <UInput v-model="parts[4]" size="sm" class="w-full font-mono" />
      </UFormField>
    </div>

    <div class="flex items-center justify-between gap-2">
      <span class="text-xs text-muted">{{ parts.join(' ') }}</span>
      <UButton size="xs" icon="i-lucide-check" @click="apply">
        {{ $ts('module.system.job.cronBuilder.apply') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const presets = [
  '* * * * *',
  '*/5 * * * *',
  '0 * * * *',
  '0 0 * * *',
  '0 0 * * 1',
]

const parts = ref(['0', '2', '*', '*', '*'])

function sync(value?: string) {
  const fields = (value || '').trim().split(/\s+/)
  if (fields.length === 5) {
    parts.value = fields
  }
}

watch(() => props.modelValue, sync, { immediate: true })

function applyPreset(value: string) {
  sync(value)
  apply()
}

function apply() {
  emit('update:modelValue', parts.value.join(' '))
}
</script>
