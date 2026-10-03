<script setup lang="ts">
/**
 * 会员用户下拉（远程搜索）。
 *
 * 为什么不用 `USelect` + 全量 options：用户表可能很大，全量下发既慢又浪费带宽；
 * 这里走各模块自己的 `userOptions` 接口按关键字分页搜索（默认 20 条，防抖 300ms）。
 *
 * `source` 决定调用哪个模块的接口：接口权限码跟随模块，
 * 例如只有流水权限的角色也能在流水页筛会员，而不需要额外授予会员查询权限。
 */
type MemberUserOption = {
  value: string
  label: string
  phone?: string | null
}

const props = withDefaults(defineProps<{
  /** 调用哪个模块的 userOptions 接口：sysMember / sysMemberRecharge / sysMemberBalanceLog */
  source?: 'sysMember' | 'sysMemberRecharge' | 'sysMemberBalanceLog'
  /** member 只列已有档案的会员；unprofiled 只列待建档用户 */
  scope?: 'member' | 'unprofiled'
  placeholder?: string
  disabled?: boolean
}>(), {
  source: 'sysMember',
  scope: 'member',
  placeholder: '',
  disabled: false
})

const model = defineModel<string | null | undefined>({ default: undefined })

/**
 * USelectMenu 的 model 类型是 `string | undefined`（不支持 null），
 * 这里做一层收敛：对外仍允许 null（表单里「未选择」更常用 null）。
 */
const selectedValue = computed(() => model.value ?? undefined)

const handleSelect = (value: string | undefined) => {
  model.value = value ?? null
}

const handleSearchTerm = (value: string) => {
  searchTerm.value = value ?? ''
}

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const options = ref<MemberUserOption[]>([])
const loading = ref(false)
const searchTerm = ref('')

let debounceTimer: ReturnType<typeof setTimeout> | null = null

/** 后端返回的字段与下拉需要的字段一致，这里只做类型收敛 */
type UserOptionsClient = {
  userOptions: {
    query: (input: { keyword: string | null, limit: number, scope: 'member' | 'unprofiled' }) => Promise<MemberUserOption[]>
  }
}

/**
 * 已选值不在当前搜索结果里时补一个占位项。
 * 场景：编辑回填、或从会员详情带 `?userId=` 跳转过来时，值本身不在前 20 条结果里，
 * 不补的话下拉会显示空白，用户会以为没选中。
 */
const ensureSelectedVisible = () => {
  const value = model.value

  if (!value || options.value.some(item => item.value === value)) {
    return
  }

  options.value = [{ value, label: value }, ...options.value]
}

const load = async (keywordOverride?: string) => {
  loading.value = true

  try {
    const client = $trpc[props.source] as unknown as UserOptionsClient
    const keyword = (keywordOverride ?? searchTerm.value).trim() || null
    const result = await client.userOptions.query({
      keyword,
      limit: 20,
      scope: props.scope
    })

    options.value = Array.isArray(result) ? result : []
    ensureSelectedVisible()
  } finally {
    loading.value = false
  }
}

// 输入防抖，避免每敲一个字符就打一次接口
watch(searchTerm, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    void load()
  }, 300)
})

watch(() => props.scope, () => {
  void load()
})

watch(model, ensureSelectedVisible)

onMounted(() => {
  // 已选值（编辑回填、或从详情页带 ?userId= 跳转）先用它精确查一次：
  // 后端支持按完整用户ID精确命中，这样能显示「昵称 · 手机号」而不是一串 ID。
  void load(model.value ? String(model.value) : undefined)
})

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<template>
  <USelectMenu
    :model-value="selectedValue"
    :search-term="searchTerm"
    :items="options"
    :loading="loading"
    :disabled="disabled"
    :placeholder="placeholder || $ts('module.system.member.userSelectPlaceholder')"
    :search-input="{ placeholder: $ts('module.system.member.userSelectSearch') }"
    ignore-filter
    label-key="label"
    value-key="value"
    class="w-full"
    @update:model-value="handleSelect"
    @update:search-term="handleSearchTerm"
  >
    <template #item="{ item }">
      <span class="truncate">{{ item.label }}</span>
    </template>

    <template #empty>
      <div class="py-2 text-center text-sm text-muted">
        {{ searchTerm ? $ts('module.system.member.userSelectEmpty') : $ts('module.system.member.userSelectEmptyDefault') }}
      </div>
    </template>
  </USelectMenu>
</template>
