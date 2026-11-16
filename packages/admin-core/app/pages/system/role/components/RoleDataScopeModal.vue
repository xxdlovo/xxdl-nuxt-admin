<script setup lang="ts">
import type { SysRoleDto } from '#admin/shared/system/role'
import { businessDictCode } from '#admin/shared/constants/business'
import { useToastSuccess } from '#admin/app/utils/toast'

const props = defineProps<{
  open: boolean
  role?: SysRoleDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const visible = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
})

const saving = ref(false)
const loadingDepts = ref(false)
const deptItems = ref<Array<{ label: string, value: string }>>([])
const state = reactive({
  dataScope: '5',
  deptIds: [] as string[]
})

const dataScopeOptions = useDictOptions(businessDictCode.dataScope)
const dataScopeItems = computed(() =>
  dataScopeOptions.value.map(item => ({ ...item }))
)

async function loadDeptOptions() {
  loadingDepts.value = true
  try {
    const depts = await $trpc.sysDept.list.query({}) as Array<{ id?: string | null, name?: string | null, code?: string | null }>
    deptItems.value = depts
      .filter(dept => Boolean(dept.id))
      .map(dept => ({
        label: dept.name || dept.code || dept.id || '',
        value: dept.id as string
      }))
  } finally {
    loadingDepts.value = false
  }
}

watch(
  () => [props.open, props.role?.id, props.role?.dataScope] as const,
  async ([open]) => {
    if (!open) {
      return
    }

    state.dataScope = props.role?.dataScope ?? '5'
    state.deptIds = []
    await loadDeptOptions()

    if (state.dataScope === '2' && props.role?.id) {
      state.deptIds = await $trpc.sysRole.deptIds.query(props.role.id)
    }
  },
  { immediate: true }
)

async function save() {
  if (!props.role?.id) {
    return
  }

  saving.value = true
  try {
    await $trpc.sysRole.updateDataScope.mutate({
      id: props.role.id,
      dataScope: state.dataScope as '1' | '2' | '3' | '4' | '5' | '6',
      deptIds: state.dataScope === '2' ? state.deptIds : []
    })
    useToastSuccess($ts('common.modifySuccess'))
    emit('saved')
    visible.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="`${$ts('module.system.role.dataScope')} - ${role?.name || ''}`"
    :dismissible="!saving"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[520px] overflow-hidden', body: 'p-4 sm:p-6', footer: 'justify-end gap-2 p-4 sm:px-6' }"
  >
    <template #body>
      <UForm :state="state" class="space-y-4" @submit="save">
        <UFormField name="dataScope" :label="$ts('module.system.role.dataScope')">
          <URadioGroup v-model="state.dataScope" :items="dataScopeItems" variant="table" />
        </UFormField>

        <UFormField
          v-if="state.dataScope === '2'"
          name="deptIds"
          :label="$ts('module.system.role.deptScope')"
        >
          <USelectMenu
            v-model="state.deptIds"
            multiple
            value-key="value"
            :items="deptItems"
            :loading="loadingDepts"
            :disabled="loadingDepts"
            :placeholder="$ts('module.system.role.form.deptScope')"
            class="w-full"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" :disabled="saving" @click="visible = false" />
      <UButton :label="$ts('common.confirm')" color="primary" :loading="saving" @click="save" />
    </template>
  </UModal>
</template>
