<template>
  <!-- 移动端遮罩 -->
  <div
    v-if="isMobile && mobileOpen"
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
    @click="closeSheet"
  />

  <!-- 移动端悬浮按钮 -->
  <button
    v-if="showFab && isMobile && !mobileOpen"
    type="button"
    class="filter-fab text-inverted"
    :class="{ 'is-dragging': dragging }"
    :style="fabStyle"
    :aria-label="fabLabelText"
    v-on="fabHandlers"
    @keydown.enter.prevent="openSheet"
    @keydown.space.prevent="openSheet"
  >
    <UIcon :name="icon" class="size-5 pointer-events-none" />
  </button>

  <!-- 同一份内容：桌面为折叠面板，移动端为底部浮层 -->
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    :style="isMobile ? sheetStyle : undefined"
    :class="isMobile ? '' : 'w-full'"
  >
    <!-- 标题行 -->
    <div class="flex items-center gap-2 px-4 py-3">
      <UIcon
        v-if="!isMobile"
        :name="desktopOpen ? 'lucide:chevron-down' : 'lucide:chevron-right'"
        class="cursor-pointer text-muted"
        @click="desktopOpen = !desktopOpen"
      />
      <UIcon v-else :name="sheetIcon" class="size-4 text-primary" />
      <span
        class="text-sm font-medium"
        :class="!isMobile ? 'cursor-pointer' : ''"
        @click="!isMobile && (desktopOpen = !desktopOpen)"
      >
        {{ titleText }}
      </span>
      <UButton
        v-if="isMobile"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        square
        class="ml-auto"
        :aria-label="$ts('common.cancel')"
        @click="closeSheet"
      />
    </div>

    <div v-show="isMobile || desktopOpen">
      <slot />

      <div class="flex justify-end gap-2 px-4 pb-4 pt-2">
        <UButton icon="tabler:reload" variant="outline" color="neutral" :disabled="submitting" @click="handleReset">
          {{ resetText }}
        </UButton>
        <UButton icon="tabler:search" variant="outline" :loading="submitting" @click="handleSubmit">
          {{ submitText }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
defineOptions({
  name: 'FilterPanel'
})

const props = withDefaults(defineProps<{
  /** 面板标题 */
  title?: string
  /** 抽屉标题行的图标 */
  sheetIcon?: string
  /** 悬浮按钮图标 */
  icon?: string
  /** 悬浮按钮 aria-label */
  fabLabel?: string
  /** 提交按钮文案 */
  submitLabel?: string
  /** 重置按钮文案 */
  resetLabel?: string
  /** 是否渲染移动端悬浮按钮 */
  showFab?: boolean
  /** 桌面端默认是否展开 */
  defaultOpen?: boolean
  /** 悬浮按钮位置记忆的 localStorage key */
  storageKey?: string
  /** 提交前校验；返回 false 时不提交也不关闭 */
  beforeSubmit?: () => boolean | Promise<boolean>
}>(), {
  title: '',
  sheetIcon: 'i-lucide-sliders-horizontal',
  icon: 'i-lucide-search',
  fabLabel: '',
  submitLabel: '',
  resetLabel: '',
  showFab: true,
  defaultOpen: false,
  storageKey: 'filter-fab-pos'
})

const emit = defineEmits<{
  search: []
  reset: []
}>()

const { $ts } = useI18n()
const isMobile = useIsMobile()

const titleText = computed(() => props.title || $ts('common.search'))
const submitText = computed(() => props.submitLabel || $ts('common.search'))
const resetText = computed(() => props.resetLabel || $ts('common.reset'))
const fabLabelText = computed(() => props.fabLabel || $ts('common.search'))

/* ---------------- 桌面折叠 ---------------- */

const desktopOpen = ref(props.defaultOpen)

/* ---------------- 移动端浮层 ---------------- */

const mobileOpen = ref(false)
const submitting = ref(false)

const openSheet = () => {
  mobileOpen.value = true
}

const closeSheet = () => {
  mobileOpen.value = false
}

const sheetStyle = computed(() => ({
  position: 'fixed' as const,
  left: '0',
  right: '0',
  bottom: '0',
  zIndex: 50,
  maxHeight: '85vh',
  overflowY: 'auto' as const,
  borderRadius: '1rem 1rem 0 0',
  transform: mobileOpen.value ? 'translateY(0)' : 'translateY(100%)',
  transition: 'transform 0.28s ease',
  pointerEvents: mobileOpen.value ? 'auto' as const : 'none' as const
}))

watch(isMobile, (value) => {
  if (!value) {
    mobileOpen.value = false
  }
})

/* ---------------- 悬浮按钮 ---------------- */

const { style: fabStyle, dragging, handlers: fabHandlers } = useDraggableFab({
  storageKey: props.storageKey,
  onClick: () => openSheet()
})

/* ---------------- 提交 / 重置 ---------------- */

const handleSubmit = async () => {
  if (submitting.value) {
    return
  }

  submitting.value = true
  try {
    const passed = props.beforeSubmit ? await props.beforeSubmit() : true
    if (!passed) {
      return
    }

    emit('search')

    if (isMobile.value) {
      closeSheet()
    }
  } finally {
    submitting.value = false
  }
}

const handleReset = () => {
  emit('reset')
}

defineExpose({
  open: openSheet,
  close: closeSheet
})
</script>

<style scoped>
.filter-fab {
  --fab-shadow: 0 10px 25px -5px color-mix(in oklab, var(--ui-primary) 55%, transparent);

  position: fixed;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  background-color: var(--ui-primary);
  box-shadow: var(--fab-shadow), 0 0 0 0 color-mix(in oklab, var(--ui-primary) 45%, transparent);
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition: transform 0.2s ease;
  animation: fab-pop 0.35s ease-out both, fab-halo 2.6s ease-out 0.6s infinite;
}

.filter-fab:hover {
  transform: translateY(-2px);
}

.filter-fab:active,
.filter-fab.is-dragging {
  cursor: grabbing;
  transform: scale(1.06);
  animation: none;
  box-shadow: var(--fab-shadow), 0 0 0 12px color-mix(in oklab, var(--ui-primary) 18%, transparent);
}

@keyframes fab-pop {
  from {
    opacity: 0;
    transform: scale(0.6) translateY(16px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes fab-halo {
  0% {
    box-shadow: var(--fab-shadow), 0 0 0 0 color-mix(in oklab, var(--ui-primary) 45%, transparent);
  }

  70% {
    box-shadow: var(--fab-shadow), 0 0 0 18px color-mix(in oklab, var(--ui-primary) 0%, transparent);
  }

  100% {
    box-shadow: var(--fab-shadow), 0 0 0 0 color-mix(in oklab, var(--ui-primary) 0%, transparent);
  }
}
</style>
