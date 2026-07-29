<script setup lang="ts">
import type { SysRoleDto } from '#shared/system/role'
import { businessDictCode } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

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
const state = reactive({
  dataScope: '5'
})

const dataScopeOptions = useDictOptions(businessDictCode.dataScope)
const dataScopeItems = computed(() =>
  dataScopeOptions.value.map(item => ({
    ...item,
    disabled: item.value === '2'
  }))
)

watch(
  () => [props.open, props.role?.id, props.role?.dataScope] as const,
  ([open]) => {
    if (open) {
      state.dataScope = props.role?.dataScope ?? '5'
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
      dataScope: state.dataScope as '1' | '2' | '3' | '4' | '5' | '6'
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
      </UForm>
    </template>

    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" :disabled="saving" @click="visible = false" />
      <UButton :label="$ts('common.confirm')" color="primary" :loading="saving" @click="save" />
    </template>
  </UModal>
</template>
