<template>
  <UInput
    v-model.nullable="modelValue"
    v-bind="$attrs"
    :type="inputType"
    :ui="{ trailing: 'pr-0' }"
  >
    <template #trailing>
      <div class="flex items-center gap-1">
        <!-- 清空按钮 -->
        <UButton
          v-if="showClear && hasValue"
          color="neutral"
          variant="link"
          size="xs"
          icon="i-lucide-x"
          @click="handleClear"
        />
        <!-- 密码切换按钮 -->
        <UButton
          v-if="trailing === 'password'"
          color="neutral"
          variant="link"
          size="xs"
          :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          @click="togglePassword"
        />
        <!-- 复制按钮 -->
        <UButton
          v-if="trailing === 'copy' && hasValue"
          color="neutral"
          variant="link"
          size="xs"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          @click="handleCopy"
        />
      </div>
    </template>
  </UInput>
</template>

<script setup lang="ts">
/**
 * BaseInput 基础输入框组件
 * 支持清空、密码显示切换、复制等功能
 */

import { ref, computed } from 'vue'

type TrailingType = 'clear' | 'password' | 'copy' | null

interface Props {
  /** 输入框类型 */
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url'
  /** 尾部按钮类型: clear-清空, password-密码切换, copy-复制 */
  trailing?: TrailingType
  /** 是否显示清空按钮（当 trailing 为 null 时生效） */
  clearable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  trailing: null,
  clearable: true
})

const modelValue = defineModel<string | number | null | undefined>({
  set(val) {
    if (props.type === 'number' && typeof val === 'string' && val !== '') {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? null : parsed
    }
    return val
  }
})

// 密码显示状态
const showPassword = ref(false)

// 复制成功状态
const copied = ref(false)

// 计算实际的输入框类型
const inputType = computed(() => {
  if (props.trailing === 'password') {
    return showPassword.value ? 'text' : 'password'
  }
  return props.type
})

// 是否有值（正确处理 number 0 的场景）
const hasValue = computed(() => {
  return modelValue.value !== null && modelValue.value !== undefined && modelValue.value !== ''
})

// 是否显示清空按钮
const showClear = computed(() => {
  return props.trailing === 'clear' || (props.clearable && !props.trailing)
})

// 清空输入
const handleClear = () => {
  modelValue.value = props.type === 'number' ? null : ''
}

// 切换密码显示
const togglePassword = () => {
  showPassword.value = !showPassword.value
}

// 复制内容
const handleCopy = async () => {
  if (!hasValue.value) return
  
  try {
    await navigator.clipboard.writeText(String(modelValue.value))
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}
</script>
