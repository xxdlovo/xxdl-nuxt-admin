<script setup lang="ts">
const props = defineProps<{
  modelValue?: string | null
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRef = ref<HTMLElement | null>(null)
const isFocused = ref(false)

const commands = [
  { command: 'bold', icon: 'i-lucide-bold', label: 'Bold' },
  { command: 'italic', icon: 'i-lucide-italic', label: 'Italic' },
  { command: 'underline', icon: 'i-lucide-underline', label: 'Underline' },
  { command: 'insertUnorderedList', icon: 'i-lucide-list', label: 'Bullet list' },
  { command: 'insertOrderedList', icon: 'i-lucide-list-ordered', label: 'Numbered list' }
] as const

const setEditorHtml = async (value?: string | null) => {
  await nextTick()
  if (!editorRef.value || isFocused.value || editorRef.value.innerHTML === (value || '')) {
    return
  }
  editorRef.value.innerHTML = value || ''
}

watch(
  () => props.modelValue,
  (value) => {
    setEditorHtml(value)
  },
  { immediate: true, flush: 'post' }
)

onMounted(() => {
  setEditorHtml(props.modelValue)
})

const syncValue = () => {
  emit('update:modelValue', editorRef.value?.innerHTML || '')
}

const runCommand = (command: string, value?: string) => {
  editorRef.value?.focus()
  document.execCommand(command, false, value)
  syncValue()
}

const createLink = () => {
  const url = window.prompt('URL')
  if (!url) {
    return
  }
  runCommand('createLink', url)
}
</script>

<template>
  <div class="overflow-hidden rounded-md border border-default bg-default">
    <div class="flex flex-wrap items-center gap-1 border-b border-default bg-elevated px-2 py-1">
      <UTooltip v-for="item in commands" :key="item.command" :text="item.label">
        <UButton
          :icon="item.icon"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          @click="runCommand(item.command)"
        />
      </UTooltip>
      <UTooltip text="Link">
        <UButton icon="i-lucide-link" color="neutral" variant="ghost" size="xs" square @click="createLink" />
      </UTooltip>
    </div>
    <div class="relative">
      <div
        ref="editorRef"
        contenteditable="true"
        class="rich-editor min-h-56 w-full overflow-y-auto px-3 py-2 text-sm leading-7 outline-none"
        @focus="isFocused = true"
        @blur="isFocused = false; syncValue()"
        @input="syncValue"
      />
      <div
        v-if="!modelValue"
        class="pointer-events-none absolute left-3 top-2 text-sm text-muted"
      >
        {{ placeholder }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.rich-editor :deep(p) {
  margin-bottom: 0.5rem;
}

.rich-editor :deep(ul),
.rich-editor :deep(ol) {
  margin-left: 1.25rem;
}

.rich-editor :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
}
</style>
