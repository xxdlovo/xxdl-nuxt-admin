<script setup lang="ts">
import MemberUserSelect from '~/components/MemberUserSelect.vue'
import { payOrderStatusConfig } from '#shared/constants/business'
import { memberLevelOrderPayModeRecord, memberLevelOrderQuerySchema, type MemberLevelOrderQuery } from './types'

/**
 * 会员开通单搜索条件。
 *
 * 会员筛选说明：`sysMemberLevelOrder.userOptions` **后端还没有**（与充值单/流水各自持有的
 * userOptions 不同），因此这里不硬接不存在的接口，改用 `MemberUserSelect` 指向已有的
 * `sysMember.userOptions`（scope = member）拿到 userId 过滤，与订单页的会员搜索方案一致。
 * 后端补上本模块的 userOptions 后，把 `source` 换掉即可（记得同步 MemberUserSelect 的
 * source 联合类型）。
 */
const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: MemberLevelOrderQuery]
}>()

const { $trpc } = useNuxtApp()

const schema = memberLevelOrderQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<MemberLevelOrderQuery>('model', { required: true })

/** 状态 / 支付方式下拉：取值来自共享契约的枚举，文案复用支付状态常量 */
const statusItems = useTransformRecordToOption(
  Object.fromEntries(
    Object.entries(payOrderStatusConfig)
      // 开通单只有 WP / OD / CL / FL 四种状态
      .filter(([value]) => ['WP', 'OD', 'CL', 'FL'].includes(value))
      .map(([value, config]) => [value, config.i18nKey])
  )
)

const payModeItems = useTransformRecordToOption(memberLevelOrderPayModeRecord)

/** 等级下拉：复用会员模块已有的等级选项接口（不在本模块新开接口） */
const levelItems = ref<Array<{ label: string, value: string }>>([])

const loadLevels = async () => {
  if (levelItems.value.length > 0) return

  try {
    const levels = await $trpc.sysMember.levelOptions.query()

    levelItems.value = levels
      .filter(level => Boolean(level.id))
      .map(level => ({ label: level.name || String(level.id), value: String(level.id) }))
  } catch {
    // 等级下拉属于附加筛选条件：没有 system:member:list 权限时接口会拒绝，
    // 这里静默降级成「不按等级筛选」，不影响本页其它筛选与列表
    levelItems.value = []
  }
}

/** 日期区间在提交时补全为 datetime，后端按字符串比较 */
const createdFrom = ref<string>('')
const createdTo = ref<string>('')

const items = computed(() => [
  {
    label: $ts('common.search'),
    icon: ''
  }
])

const submit = async () => {
  const isValid = await form.value?.validate({})

  if (!isValid) {
    return
  }

  state.value.createdFrom = createdFrom.value ? `${createdFrom.value} 00:00:00` : undefined
  state.value.createdTo = createdTo.value ? `${createdTo.value} 23:59:59` : undefined
  emit('search', state.value)
}

const reset = () => {
  form.value?.clear()
  createdFrom.value = ''
  createdTo.value = ''
  state.value = {}
}

onMounted(() => {
  void loadLevels()
})
</script>

<template>
  <UCard :ui="{ body: ' p-0 sm:p-0 pl-2  sm:pl-2' }" class="w-full cursor-pointer">
    <UAccordion v-model="active" :items="items">
      <template #leading="{ open }">
        <UIcon :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cursor-pointer" />
      </template>
      <template #trailing>
        &nbsp;
      </template>
      <template #content>
        <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="p-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
            <UFormField name="outTradeNo" :label="$ts('module.system.memberLevelOrder.outTradeNo')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.outTradeNo" :placeholder="$ts('module.system.memberLevelOrder.form.outTradeNo')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="userId" :label="$ts('module.system.memberLevelOrder.member')" orientation="horizontal" :ui="formItemUi">
              <MemberUserSelect v-model="state.userId" source="sysMember" scope="member" :placeholder="$ts('module.system.memberLevelOrder.form.member')" />
            </UFormField>
            <UFormField name="levelId" :label="$ts('module.system.memberLevelOrder.levelName')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.levelId" :placeholder="$ts('module.system.memberLevelOrder.form.levelName')" class="w-full" :items="levelItems" clearable />
            </UFormField>
            <UFormField name="status" :label="$ts('module.system.memberLevelOrder.statusLabel')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.memberLevelOrder.form.status')" class="w-full" :items="statusItems" clearable />
            </UFormField>
            <UFormField name="payMode" :label="$ts('module.system.memberLevelOrder.payModeLabel')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.payMode" :placeholder="$ts('module.system.memberLevelOrder.form.payMode')" class="w-full" :items="payModeItems" clearable />
            </UFormField>
            <UFormField name="createdFrom" :label="$ts('module.system.memberLevelOrder.createdFrom')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="createdFrom" type="date" class="w-full" />
            </UFormField>
            <UFormField name="createdTo" :label="$ts('module.system.memberLevelOrder.createdTo')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="createdTo" type="date" class="w-full" />
            </UFormField>
            <div class="lg:col-start-4 flex flex-col pr-8">
              <div class="gap-2 flex justify-end">
                <UButton icon="tabler:reload" @click="reset" variant="outline" color="neutral">{{ $ts('common.reset') }}
                </UButton>
                <UButton icon="tabler:search" @click="submit" variant="outline">{{ $ts('common.search') }}</UButton>
              </div>
              <div class="min-h-[20px]"></div>
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>
