<script setup lang="ts">
import { businessDictCode } from '#shared/constants/business'
import {
  type MenuButtonDraft,
  SysMenuAddSchema,
  SysMenuUpdateSchema,
  type SysMenuAddDTO,
  type SysMenuDto,
  type SysMenuUpdateDTO
} from '#shared/system/menu'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { useToastSuccess } from '~/utils/toast'
import type { MenuOperateType } from '#shared/system/menu'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const props = defineProps<{
  operateType: MenuOperateType
  data?: SysMenuDto | null
  parentId?: string | null
  defaultType?: number
  parentOptions: Array<{ label: string, value: string }>
  allMenus: SysMenuDto[]
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { required: true })

const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const ROOT_PARENT_VALUE = '0'

const emptyState = (): SysMenuAddDTO | SysMenuUpdateDTO => ({
  id: '',
  parentId: ROOT_PARENT_VALUE,
  name: '',
  code: '',
  type: 1,
  path: '',
  component: '',
  icon: '',
  sortOrder: 0,
  visible: 0,
  status: 1,
  remark: ''
})

const state = ref<SysMenuAddDTO | SysMenuUpdateDTO>(emptyState())

const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysMenuAddSchema : SysMenuUpdateSchema
})

const typeItems = useDictOptions(businessDictCode.menuType)
const menuTypeItems = computed(() => typeItems.value.filter(item => item.value !== '2'))
const statusItems = useDictOptions(businessDictCode.enableStatus)
const iconTypeValue = ref('iconify')
const iconTypeItems = computed(() => [
  { label: $ts('module.system.menu.iconType.iconify'), value: 'iconify' },
  { label: $ts('module.system.menu.iconType.local'), value: 'local' }
])
const disabledParentIds = computed(() => {
  const currentId = props.operateType === 'edit' ? props.data?.id : null
  const ids = new Set<string>()

  if (!currentId) {
    return ids
  }

  ids.add(currentId)
  let changed = true

  // A menu cannot be moved under itself or any of its descendants.
  while (changed) {
    changed = false
    props.allMenus.forEach((item) => {
      if (item.id && item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id)
        changed = true
      }
    })
  }

  return ids
})
const parentSelectItems = computed(() => [
  { label: $ts('module.system.menu.rootMenu'), value: ROOT_PARENT_VALUE },
  ...props.parentOptions.filter(item => !disabledParentIds.value.has(item.value))
])
const buttonRows = ref<MenuButtonDraft[]>([])
const removedButtonIds = ref<string[]>([])
const buttonColumns = computed<TableColumn<MenuButtonDraft>[]>(() => [
  {
    accessorKey: 'name',
    header: $ts('module.system.menu.buttonDesc')
  },
  {
    accessorKey: 'code',
    header: $ts('module.system.menu.buttonCode')
  },
  {
    accessorKey: 'sortOrder',
    header: $ts('module.system.menu.order')
  },
  {
    accessorKey: 'status',
    header: $ts('module.system.menu.menuStatus')
  },
  {
    id: 'actions',
    header: $ts('common.operate')
  }
])

const typeValue = computed({
  get: () => String(state.value.type ?? 1),
  set: (val) => {
    state.value.type = Number(val)
  }
})

const statusValue = computed({
  get: () => String(state.value.status || 1),
  set: val => state.value.status = Number(val)
})

const parentValue = computed({
  get: () => state.value.parentId || ROOT_PARENT_VALUE,
  set: val => state.value.parentId = val || ROOT_PARENT_VALUE
})

const visibleValue = computed({
  get: () => Number(state.value.visible ?? 0) === 0,
  set: val => state.value.visible = val ? 0 : 1
})

const hiddenValue = computed({
  get: () => !visibleValue.value,
  set: val => visibleValue.value = !val
})

const remarkValue = computed({
  get: () => state.value.remark || '',
  set: val => { state.value.remark = val }
})

const previewIcon = computed(() => normalizeNavigationIcon(state.value.icon))

const title = computed(() => props.operateType === 'add'
  ? $ts('module.system.menu.addMenu')
  : $ts('module.system.menu.editMenu')
)

const toMenuFormState = (menu?: SysMenuDto | null): SysMenuAddDTO | SysMenuUpdateDTO => ({
  ...emptyState(),
  id: menu?.id || '',
  parentId: menu?.parentId || ROOT_PARENT_VALUE,
  name: menu?.name || '',
  code: menu?.code || '',
  type: Number(menu?.type ?? 1),
  path: menu?.path || '',
  component: menu?.component || '',
  icon: menu?.icon || '',
  sortOrder: menu?.sortOrder ?? 0,
  visible: menu?.visible ?? 0,
  status: menu?.status ?? 1,
  remark: menu?.remark || ''
})

const buildSubmitPayload = (): SysMenuAddDTO | SysMenuUpdateDTO => ({
  ...toMenuFormState(state.value),
  parentId: state.value.parentId || null,
  type: Number(state.value.type ?? 1),
  sortOrder: state.value.sortOrder ?? 0,
  visible: state.value.visible ?? 0,
  status: state.value.status ?? 1
})

const getButtonChildren = (menuId?: string | null): MenuButtonDraft[] => {
  if (!menuId) {
    return []
  }

  return props.allMenus
    .filter(item => item.parentId === menuId && item.type === 2)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(item => ({
      id: item.id,
      name: item.name || '',
      code: item.code || '',
      sortOrder: item.sortOrder ?? 0,
      status: item.status ?? 1,
      remark: item.remark || ''
    }))
}

const initFormData = () => {
  removedButtonIds.value = []

  if (props.operateType === 'edit') {
    if (!props.data) {
      state.value = emptyState()
      buttonRows.value = []
      return
    }

    state.value = toMenuFormState(props.data)
    buttonRows.value = Number(props.data.type ?? 1) === 1 ? getButtonChildren(props.data.id) : []
    return
  }

  state.value = {
    ...toMenuFormState(),
    parentId: props.parentId || ROOT_PARENT_VALUE,
    type: Number(props.defaultType ?? 1),
    visible: 0
  }
  buttonRows.value = []
}

watch(
  () => [open.value, props.operateType, props.data?.id, props.parentId, props.defaultType],
  () => {
    if (open.value) {
      initFormData()
    }
  },
  { immediate: true }
)

const setOpen = (value: boolean) => {
  open.value = value
}

const closeModal = () => {
  setOpen(false)
}

const addButtonRow = () => {
  buttonRows.value.push({
    name: '',
    code: '',
    sortOrder: buttonRows.value.length + 1,
    status: 1,
    remark: ''
  })
}

const removeButtonRow = (row: MenuButtonDraft) => {
  if (row.id) {
    removedButtonIds.value.push(row.id)
  }
  buttonRows.value = buttonRows.value.filter(item => item !== row)
}

const syncButtonRows = async (menuId: string) => {
  if (state.value.type !== 1) {
    const originalButtonIds = getButtonChildren(menuId).map(row => row.id).filter(Boolean) as string[]
    const removeIds = Array.from(new Set([...removedButtonIds.value, ...originalButtonIds]))
    await Promise.all(removeIds.map(id => $trpc.sysMenu.remove.mutate(id)))
    return
  }

  const normalizedRows = buttonRows.value.filter(row => row.name.trim() && row.code.trim())
  const keptIds = new Set(normalizedRows.map(row => row.id).filter(Boolean))
  const originalButtonIds = getButtonChildren(menuId).map(row => row.id).filter(Boolean) as string[]
  const autoRemovedIds = originalButtonIds.filter(id => !keptIds.has(id))
  const removeIds = Array.from(new Set([...removedButtonIds.value, ...autoRemovedIds]))

  await Promise.all(removeIds.map(id => $trpc.sysMenu.remove.mutate(id)))

  for (const row of normalizedRows) {
    const payload = {
      id: row.id || '',
      parentId: menuId,
      name: row.name,
      code: row.code,
      type: 2,
      path: '',
      component: '',
      icon: '',
      sortOrder: row.sortOrder ?? 0,
      visible: 1,
      status: row.status ?? 1,
      remark: row.remark || ''
    }

    if (row.id) {
      await $trpc.sysMenu.update.mutate(payload as SysMenuUpdateDTO)
    } else {
      await $trpc.sysMenu.create.mutate(payload as SysMenuAddDTO)
    }
  }
}

const handleSubmit = async (_event: FormSubmitEvent<SysMenuAddDTO | SysMenuUpdateDTO>) => {
  const payload = buildSubmitPayload()
  let menuId = payload.id

  if (props.operateType === 'add') {
    menuId = await $trpc.sysMenu.create.mutate(payload as SysMenuAddDTO)
    useToastSuccess($ts('common.addSuccess'))
  } else {
    await $trpc.sysMenu.update.mutate(payload as SysMenuUpdateDTO)
    useToastSuccess($ts('common.modifySuccess'))
  }

  if (menuId) {
    await syncButtonRows(menuId)
  }

  closeModal()
  emit('saved')
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :dismissible="true"
    :ui="{
      content: 'max-w-[820px]',
      header: 'px-6 py-4',
      body: 'px-6 py-5',
      footer: 'justify-end'
    }"
    @update:open="setOpen"
  >
    <template #body>
      <UForm :validate="validate" :state="state" class="space-y-5" @submit="handleSubmit">
        <div class="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
          <UFormField name="type" required :label="$ts('module.system.menu.menuType')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="typeValue" orientation="horizontal" :items="menuTypeItems" />
          </UFormField>

          <UFormField name="parentId" :label="$ts('module.system.menu.parentId')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="parentValue" :items="parentSelectItems" class="w-full" />
          </UFormField>

          <UFormField name="name" required :label="$ts('module.system.menu.menuName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.menu.form.menuName')" class="w-full" />
          </UFormField>

          <UFormField name="code" required :label="$ts('module.system.menu.routeName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.code" :placeholder="$ts('module.system.menu.form.routeName')" class="w-full" />
          </UFormField>

          <template v-if="state.type !== 2">
            <UFormField name="path" :label="$ts('module.system.menu.routePath')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.path" :placeholder="$ts('module.system.menu.form.routePath')" class="w-full" />
            </UFormField>

            <UFormField name="component" :label="$ts('module.system.menu.page')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.component" :placeholder="$ts('module.system.menu.form.page')" class="w-full" />
            </UFormField>

            <UFormField name="iconType" :label="$ts('module.system.menu.iconTypeTitle')" orientation="horizontal" :ui="formItemUi">
              <URadioGroup v-model="iconTypeValue" orientation="horizontal" :items="iconTypeItems" />
            </UFormField>

            <UFormField name="icon" :label="$ts('module.system.menu.icon')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.icon" :placeholder="$ts('module.system.menu.form.icon')" class="w-full">
                <template #trailing>
                  <UIcon v-if="previewIcon" :name="previewIcon" class="size-5 text-muted" />
                </template>
              </UBaseInput>
            </UFormField>
          </template>

          <UFormField name="sortOrder" :label="$ts('module.system.menu.order')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.sortOrder" :placeholder="$ts('module.system.menu.form.order')" class="w-full" />
          </UFormField>

          <UFormField name="visible" :label="$ts('module.system.menu.hideInMenu')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup
              v-model="hiddenValue"
              orientation="horizontal"
              :items="[
                { label: $ts('common.yesOrNo.yes'), value: true },
                { label: $ts('common.yesOrNo.no'), value: false }
              ]"
            />
          </UFormField>

          <UFormField name="status" :label="$ts('module.system.menu.menuStatus')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="statusValue" orientation="horizontal" :items="statusItems" />
          </UFormField>

          <UFormField name="remark" :label="$ts('module.system.menu.remark')" orientation="horizontal" :ui="formItemUi" class="md:col-span-2">
            <UTextarea v-model="remarkValue" :rows="3" class="w-full" />
          </UFormField>
        </div>

        <section v-if="state.type === 1" class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-sm font-medium text-default">
              <UIcon name="i-lucide-square-mouse-pointer" class="size-4 text-muted" />
              <span>{{ $ts('module.system.menu.buttonPermission') }}</span>
            </div>
            <UButton v-if="buttonRows.length > 0" type="button" icon="i-lucide-plus" size="sm" variant="outline" @click="addButtonRow">
              {{ $ts('module.system.menu.addButton') }}
            </UButton>
          </div>

          <UTable
            v-if="buttonRows.length > 0"
            :data="buttonRows"
            :columns="buttonColumns"
            :ui="{ base: 'min-w-[720px]', td: 'align-top' }"
          >
            <template #name-cell="{ row }">
              <UBaseInput v-model="row.original.name" :placeholder="$ts('module.system.menu.form.buttonDesc')" class="w-full" />
            </template>

            <template #code-cell="{ row }">
              <UBaseInput v-model="row.original.code" :placeholder="$ts('module.system.menu.form.buttonCode')" class="w-full" />
            </template>

            <template #sortOrder-cell="{ row }">
              <UInputNumber v-model="row.original.sortOrder" class="w-28" />
            </template>

            <template #status-cell="{ row }">
              <USelect
                :model-value="String(row.original.status || 1)"
                :items="statusItems"
                class="w-28"
                @update:model-value="value => row.original.status = Number(value)"
              />
            </template>

            <template #actions-cell="{ row }">
              <UButton type="button" icon="i-lucide-trash-2" variant="ghost" color="error" size="xs" @click="removeButtonRow(row.original)" />
            </template>
          </UTable>

          <UButton
            v-else
            type="button"
            color="neutral"
            variant="ghost"
            class="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-default text-sm text-muted transition hover:border-primary hover:text-primary"
            @click="addButtonRow"
          >
            <UIcon name="i-lucide-plus" class="size-4" />
            <span>{{ $ts('module.system.menu.addButton') }}</span>
          </UButton>
        </section>

        <USeparator />

        <div class="flex justify-end gap-2">
          <UButton type="button" :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeModal" />
          <UButton :label="$ts('common.confirm')" color="primary" type="submit" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
