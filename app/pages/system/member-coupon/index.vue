<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysMemberCouponSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
    </div>

    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
      <TableWithPagination
        ref="table"
        :data="data"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        :page-size-options="pageSizeOptions"
      >
        <template #header>
          <TableHeaderOperation
            v-if="tableRef?.tableRef"
            :table-ref="tableRef.tableRef"
            :loading="loading"
            :disabled-delete="checkedRowKeys.length === 0 || loading"
            :selected-count="checkedRowKeys.length"
            :add-permission="couponPermissions.codes.add"
            :delete-permission="couponPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.memberCoupon.title') }}</span>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <!-- 弹窗放在 TableHeaderOperation 之外：填了默认插槽会顶掉组件内置的新增/批量删除按钮 -->
    <SysMemberCouponOperate
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :data="editingData ?? undefined"
      :close="closeVisible"
      :refresh="refresh"
    />

    <!-- 使用记录反查：这张券被谁用了，接口权限沿用 system:memberCoupon:list -->
    <SysMemberCouponUses
      v-model:visible="usesVisible"
      :coupon-id="usesTarget?.id"
      :coupon-code="usesTarget?.code"
    />

    <!-- 作废不可逆：独立二次确认弹窗，可填写作废原因（写入 remark） -->
    <UModal
      v-model:open="voidVisible"
      :title="$ts('module.system.memberCoupon.voidTitle')"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[520px]', footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6' }"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="$ts('module.system.memberCoupon.voidWarning')"
          />
          <div class="text-sm text-muted">
            {{ $ts('module.system.memberCoupon.code') }}：{{ voidTarget?.code || '-' }}
          </div>
          <UFormField name="voidRemark" :label="$ts('module.system.memberCoupon.voidRemark')">
            <UTextarea v-model="voidRemark" :rows="3" :placeholder="$ts('module.system.memberCoupon.form.voidRemark')" class="w-full" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="voidVisible = false" />
        <UButton
          :label="$ts('module.system.memberCoupon.void')"
          color="error"
          :loading="voidSaving"
          @click="handleVoidConfirm"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '优惠码管理',
  icon: 'i-lucide-ticket-percent'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysMemberCouponQueryDTO, SysMemberCouponRespDTO } from '#shared/system/memberCoupon'
import { memberCouponSceneRecord, memberCouponTypeRecord } from '#shared/constants/business'
import type { BadgeConfig } from '#shared/types/nuxtui'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import CopyValueBadge from '~/components/base/CopyValueBadge.vue'
import SysMemberCouponSearch from './components/sys-member-coupon-search.vue'
import SysMemberCouponOperate from './components/sys-member-coupon-operate.vue'
import SysMemberCouponUses from './components/sys-member-coupon-uses.vue'
import { useToastError, useToastSuccess } from '~/utils/toast'

/**
 * 优惠码状态徽标：与 sys_member_coupon.status 一致
 * （1 启用 / 0 停用 / 2 已作废，见 couponRepo.markVoid）。
 * 状态是业务结论，用本文常量映射而不依赖可被后台改坏的字典。
 */
const memberCouponStatusConfig: Readonly<Record<string, BadgeConfig>> = {
  '1': { i18nKey: 'module.system.memberCoupon.status.enabled', color: 'success' },
  '0': { i18nKey: 'module.system.memberCoupon.status.disabled', color: 'neutral' },
  '2': { i18nKey: 'module.system.memberCoupon.status.void', color: 'error' }
}

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const { isAdmin, hasPermission } = useRbacProfile()
const tableRef = useTemplateRef('table')
const couponPermissions = useCrudPermissions('system:memberCoupon')
const searchParams = ref<SysMemberCouponQueryDTO>({})

// 作废是独立于 CRUD 的高敏感权限码，useCrudPermissions 不覆盖，这里单独判断
const canVoid = computed(() => isAdmin.value || hasPermission('system:memberCoupon:void'))

// 使用记录反查沿用列表权限（system:memberCoupon:list），不再做二次授权判断
const usesVisible = ref(false)
const usesTarget = ref<SysMemberCouponRespDTO | null>(null)

const handleUses = (coupon: SysMemberCouponRespDTO) => {
  usesTarget.value = coupon
  usesVisible.value = true
}

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysMemberCouponRespDTO>({
  query: params => $trpc.sysMemberCoupon.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysMemberCouponRespDTO>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysMemberCouponRespDTO>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

/** 类型 / 场景 → 文案映射，避免拼不出动态 key */
const typeLabel = (type?: string | null) => {
  if (!type) return '-'
  const key = memberCouponTypeRecord[type]
  return key ? $ts(key) : type
}

const sceneLabel = (scene?: string | null) => {
  if (!scene) return '-'
  const key = memberCouponSceneRecord[scene]
  return key ? $ts(key) : scene
}

/** 金额展示：decimal 在 drizzle 读出是字符串，直接拼货币符号 */
const amountText = (value?: string | number | null) => {
  const text = value == null || value === '' ? '0.00' : String(value)
  return $ts('module.system.memberCoupon.valueAmount', { value: text })
}

/** 面值展示：rate 折算成折扣（0.90 → 9 折），amount 显示固定金额 */
const valueText = (coupon: SysMemberCouponRespDTO) => {
  const raw = coupon.value

  if (raw == null || raw === '') {
    return '-'
  }

  if (coupon.type === 'rate') {
    const discount = Number(raw) * 10

    if (!Number.isFinite(discount)) {
      return String(raw)
    }

    // 去掉浮点尾数：0.85 → 8.5 折，0.90 → 9 折
    return $ts('module.system.memberCoupon.valueRate', { value: String(Number(discount.toFixed(2))) })
  }

  return amountText(raw)
}

/** 有效期：两端都可空，缺一端用 '-' 占位 */
const validityText = (coupon: SysMemberCouponRespDTO) => `${coupon.validFrom || '-'} ~ ${coupon.validTo || '-'}`

/** 已用 / 上限：maxUse 为 0 表示不限次 */
const usageText = (coupon: SysMemberCouponRespDTO) => {
  const used = Number(coupon.usedCount ?? 0)
  const maxUse = Number(coupon.maxUse ?? 0)
  const limit = maxUse > 0 ? String(maxUse) : $ts('module.system.memberCoupon.unlimited')

  return `${used} / ${limit}`
}

const voidVisible = ref(false)
const voidTarget = ref<SysMemberCouponRespDTO | null>(null)
const voidRemark = ref('')
const voidSaving = ref(false)

const handleVoidOpen = (coupon: SysMemberCouponRespDTO) => {
  voidTarget.value = coupon
  voidRemark.value = ''
  voidVisible.value = true
}

const handleVoidConfirm = async () => {
  const target = voidTarget.value

  if (!target?.id || voidSaving.value) {
    return
  }

  voidSaving.value = true

  try {
    await $trpc.sysMemberCoupon.void.mutate({
      id: target.id,
      remark: voidRemark.value.trim() || null
    })
    useToastSuccess($ts('module.system.memberCoupon.voidSuccess'))
    voidVisible.value = false
    voidTarget.value = null
    await refresh()
  } catch (error) {
    // 服务端 message 已按请求语言翻译，直接透出到 toast 描述
    useToastError($ts('module.system.memberCoupon.voidFailed'), undefined, error instanceof Error ? error.message : '')
  } finally {
    voidSaving.value = false
  }
}

const columns = computed<TableColumn<SysMemberCouponRespDTO>[]>(() => {
  const actionColumn: TableColumn<SysMemberCouponRespDTO> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      // 使用记录只读反查，列表权限角色即可查看，始终展示
      actions.push(h(UButton, {
        variant: 'outline',
        color: 'neutral',
        size: 'xs',
        onClick: () => handleUses(row.original)
      }, { default: () => $ts('module.system.memberCoupon.uses') }))

      if (couponPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      // 已作废（status=2）的码不可重复作废
      if (canVoid.value && row.original.status !== 2) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'warning',
          size: 'xs',
          onClick: () => handleVoidOpen(row.original)
        }, { default: () => $ts('module.system.memberCoupon.void') }))
      }

      if (couponPermissions.canDel.value) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs'
          }, { default: () => $ts('common.delete') })
        }))
      }

      return h('div', { class: 'flex gap-2' }, actions)
    }
  }

  return [
    ...(couponPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      id: 'code',
      header: () => $ts('module.system.memberCoupon.code'),
      // 优惠码是要发给用户的：直接点一下就能复制，省得手动选中
      cell: ({ row }) => row.original.code
        ? h(CopyValueBadge, {
            label: '',
            value: String(row.original.code),
            color: 'primary',
            icon: 'i-lucide-ticket-percent'
          })
        : h('span', { class: 'text-muted' }, '-')
    },
    {
      accessorKey: 'name',
      header: () => $ts('module.system.memberCoupon.name')
    },
    {
      accessorKey: 'type',
      header: () => $ts('module.system.memberCoupon.typeLabel'),
      cell: ({ row }) => typeLabel(row.original.type)
    },
    {
      accessorKey: 'value',
      header: () => $ts('module.system.memberCoupon.value'),
      cell: ({ row }) => valueText(row.original)
    },
    {
      accessorKey: 'scene',
      header: () => $ts('module.system.memberCoupon.sceneLabel'),
      cell: ({ row }) => sceneLabel(row.original.scene)
    },
    {
      accessorKey: 'minAmount',
      header: () => $ts('module.system.memberCoupon.minAmount'),
      cell: ({ row }) => amountText(row.original.minAmount)
    },
    {
      accessorKey: 'giftAmount',
      header: () => $ts('module.system.memberCoupon.giftAmount'),
      cell: ({ row }) => amountText(row.original.giftAmount)
    },
    {
      id: 'validity',
      header: () => $ts('module.system.memberCoupon.validity'),
      cell: ({ row }) => validityText(row.original)
    },
    {
      id: 'usage',
      header: () => $ts('module.system.memberCoupon.usage'),
      cell: ({ row }) => usageText(row.original)
    },
    useBadgeColumn<SysMemberCouponRespDTO>('status', 'module.system.memberCoupon.statusLabel', memberCouponStatusConfig, 1),
    // 「使用记录」对所有列表权限角色可见，所以操作列不再随编辑/作废权限整体隐藏
    actionColumn
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysMemberCoupon.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.sysMemberCoupon.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

onMounted(async () => {
  await search()
})
</script>
