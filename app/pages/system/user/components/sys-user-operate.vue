<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SysRoleDto } from '#shared/system/role'
import type { SysDeptDto } from '#shared/system/department'
import { SysUserAddSchema, SysUserUpdateSchema, type SysUserAddDTO, type SysUserDto, type SysUserUpdateDTO } from '#shared/system/user'
import { businessDictCode } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysUserDto
  defaultDeptId?: string | null
  close?: () => void
  refresh?: () => void
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const formItemUi = {
  root: 'flex flex-col gap-1 sm:flex-row sm:items-center',
  label: 'sm:w-20 sm:text-right sm:pr-2 flex-shrink-0',
  container: 'flex-1'
}

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const state = ref({
  id: '',
  username: '',
  password: '',
  nickname: '',
  email: '',
  phone: '',
  deptId: '',
  gender: 0,
  status: 1,
  remark: ''
})

const selectedRoleIds = ref<string[]>([])
const roleItems = ref<Array<{ label: string, value: string }>>([])
const loadingRoles = ref(false)
const deptItems = ref<Array<{ label: string, value: string }>>([])
const loadingDepts = ref(false)

const genderItems = useDictOptions(businessDictCode.userGender)
const statusItems = useDictOptions(businessDictCode.enableStatus)

const { validate } = useZodValidation({
  schema: () => (props.operateType === 'add' ? SysUserAddSchema : SysUserUpdateSchema) as any
})

const genderValue = computed({
  get: () => String(state.value.gender || 0),
  set: val => {
    state.value.gender = Number(val)
  }
})

const statusValue = computed({
  get: () => String(state.value.status || 0),
  set: val => {
    state.value.status = Number(val)
  }
})

function normalizeDeptId(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    const deptId = String(value).trim()
    return deptId || null
  }

  if (value && typeof value === 'object' && 'value' in value) {
    const deptId = (value as { value?: unknown }).value
    return normalizeDeptId(deptId)
  }

  return null
}

const deptIdValue = computed({
  get: () => state.value.deptId || undefined,
  set: value => {
    state.value.deptId = normalizeDeptId(value) || ''
  }
})

function handleDeptIdChange(value: unknown) {
  deptIdValue.value = normalizeDeptId(value) || undefined
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.user.addUser'),
    edit: $ts('module.system.user.editUser')
  }
  return titles[props.operateType]
})

function closeDrawer() {
  props.close?.()
}

function resetFormState() {
  Object.assign(state.value, {
    id: '',
    username: '',
    password: '',
    nickname: '',
    email: '',
    phone: '',
    deptId: props.defaultDeptId || '',
    gender: 0,
    status: 1,
    remark: ''
  })
  selectedRoleIds.value = []
}

function fillFormData() {
  resetFormState()

  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id,
      username: props.data.username || '',
      nickname: props.data.nickname || '',
      email: props.data.email || '',
      phone: props.data.phone || '',
      deptId: normalizeDeptId(props.data.deptId) || '',
      gender: props.data.gender ?? 0,
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  }
}

async function loadRoleOptions() {
  loadingRoles.value = true
  try {
    const roles = await $trpc.sysRole.list.query({}) as SysRoleDto[]

    roleItems.value = roles
      .filter(role => Boolean(role.id))
      .map(role => ({
        label: role.name || role.code || role.id || '',
        value: role.id as string
      }))
  } finally {
    loadingRoles.value = false
  }
}

function buildDeptOptions(depts: SysDeptDto[]) {
  const map = new Map<string, SysDeptDto[]>()
  const roots: SysDeptDto[] = []

  depts
    .filter(dept => Boolean(dept.id))
    .forEach((dept) => {
      const parentId = dept.parentId || '0'
      if (parentId === '0') {
        roots.push(dept)
        return
      }

      const siblings = map.get(parentId) || []
      siblings.push(dept)
      map.set(parentId, siblings)
    })

  const sortDepts = (items: SysDeptDto[]) => {
    return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name || a.code || '').localeCompare(String(b.name || b.code || '')))
  }

  const options: Array<{ label: string, value: string }> = []
  const walk = (items: SysDeptDto[], depth = 0) => {
    sortDepts(items).forEach((dept) => {
      if (!dept.id) {
        return
      }

      options.push({
        label: `${'  '.repeat(depth)}${dept.name || dept.code || dept.id}`,
        value: String(dept.id)
      })
      walk(map.get(dept.id) || [], depth + 1)
    })
  }

  walk(roots)
  return options
}

async function loadDeptOptions() {
  loadingDepts.value = true
  try {
    deptItems.value = buildDeptOptions(await $trpc.sysDept.list.query({}) as SysDeptDto[])
  } finally {
    loadingDepts.value = false
  }
}

async function loadAssignedRoles() {
  if (!props.data?.id) {
    selectedRoleIds.value = []
    return
  }

  selectedRoleIds.value = await $trpc.sysUser.assignedRoleIds.query({
    userId: props.data.id
  })
}

async function initFormData() {
  fillFormData()

  if (props.operateType === 'edit' && props.data?.id) {
    await Promise.all([
      loadRoleOptions(),
      loadDeptOptions(),
      loadAssignedRoles()
    ])
  } else {
    roleItems.value = []
    deptItems.value = []
  }
}

async function handleSubmit(_event: FormSubmitEvent<SysUserAddDTO>) {
  if (props.operateType === 'add') {
    await handleSave()
  } else if (props.operateType === 'edit') {
    await handleEdit()
  }

  closeDrawer()
  props.refresh?.()
}

async function handleEdit() {
  const payload = {
    ...state.value,
    deptId: normalizeDeptId(state.value.deptId)
  } as SysUserUpdateDTO

  await $trpc.sysUser.update.mutate(payload)
  await $trpc.sysUser.assignRoles.mutate({
    userId: state.value.id,
    roleIds: selectedRoleIds.value
  })
  useToastSuccess($ts('common.modifySuccess'))
}

async function handleSave() {
  await $trpc.sysUser.create.mutate(state.value as SysUserAddDTO)
  useToastSuccess($ts('common.addSuccess'))
}

watch(visible, (newVal) => {
  if (newVal) {
    initFormData()
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="title"
    :dismissible="false"
    :scrollable="false"
    :ui="{
      content: 'w-[calc(100vw-2rem)] max-w-[720px] overflow-hidden',
      body: 'p-4 sm:p-6 overflow-hidden',
      footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6'
    }"
  >
    <template #body>
      <UForm
        id="sys-user-form"
        :validate="validate"
        :state="state"
        autocomplete="off"
        class="max-h-[min(70vh,560px)] overflow-y-auto p-1"
        @submit="handleSubmit"
      >
        <div class="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
          <UFormField
            name="username"
            required
            :label="$ts('module.system.user.userName')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UBaseInput
              v-model="state.username"
              :placeholder="$ts('module.system.user.form.userName')"
              trailing="clear"
              autocomplete="new-username"
            />
          </UFormField>

          <UFormField
            v-if="props.operateType === 'add'"
            name="password"
            required
            :label="$ts('module.system.user.password')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UBaseInput
              v-model="state.password"
              :placeholder="$ts('module.system.user.form.password')"
              trailing="password"
              autocomplete="new-password"
            />
          </UFormField>

          <UFormField
            name="nickname"
            :label="$ts('module.system.user.nickName')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UBaseInput v-model="state.nickname" :placeholder="$ts('module.system.user.form.nickName')" trailing="clear" />
          </UFormField>

          <UFormField
            name="phone"
            :label="$ts('module.system.user.userPhone')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UBaseInput v-model="state.phone" :placeholder="$ts('module.system.user.form.userPhone')" trailing="clear" />
          </UFormField>

          <UFormField
            name="email"
            required
            :label="$ts('module.system.user.userEmail')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UBaseInput v-model="state.email" :placeholder="$ts('module.system.user.form.userEmail')" trailing="clear" />
          </UFormField>

          <UFormField
            v-if="props.operateType === 'edit'"
            name="deptId"
            :label="$ts('module.system.user.userDept')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <USelect
              v-model="deptIdValue"
              value-key="value"
              label-key="label"
              :items="deptItems"
              :loading="loadingDepts"
              :disabled="loadingDepts"
              :placeholder="$ts('module.system.user.form.userDept')"
              class="w-full"
              @update:model-value="handleDeptIdChange"
            />
          </UFormField>

          <UFormField
            name="gender"
            :label="$ts('module.system.user.userGender')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <URadioGroup
              v-model="genderValue"
              orientation="horizontal"
              :placeholder="$ts('module.system.user.form.userGender')"
              :items="genderItems"
            />
          </UFormField>

          <UFormField
            name="status"
            :label="$ts('module.system.user.userStatus')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <URadioGroup
              v-model="statusValue"
              orientation="horizontal"
              :placeholder="$ts('module.system.user.form.userStatus')"
              :items="statusItems"
            />
          </UFormField>

          <UFormField
            v-if="props.operateType === 'edit'"
            :label="$ts('module.system.user.userRole')"
            orientation="horizontal"
            :ui="formItemUi"
            class="md:col-span-2"
          >
            <USelectMenu
              v-model="selectedRoleIds"
              multiple
              value-key="value"
              :items="roleItems"
              :loading="loadingRoles"
              :disabled="loadingRoles"
              :placeholder="$ts('module.system.user.form.userRole')"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="remark"
            :label="$ts('module.system.user.remark')"
            orientation="horizontal"
            :ui="formItemUi"
            class="md:col-span-2"
          >
            <UTextarea v-model="state.remark" :placeholder="$ts('module.system.user.form.remark')" :rows="3" class="w-full" />
          </UFormField>
        </div>
      </UForm>
    </template>

    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer" />
      <UButton :label="$ts('common.confirm')" color="primary" type="submit" form="sys-user-form" />
    </template>
  </UModal>
</template>
