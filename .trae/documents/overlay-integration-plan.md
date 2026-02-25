# 父子组件 Overlay 集成计划

## 任务分析

### 当前状态
- 父组件 `index.vue` 已使用 `useOverlay()` 创建模态框
- 子组件 `sys-user-operate.vue` 已定义但 `closeDrawer` 函数为空
- 父组件通过 `modal.open({operateType:'add'})` 打开子组件

### 需求
- 实现子组件的关闭逻辑
- 提供父组件的正确实现方式
- 确保父子组件通过 overlay 系统正确集成

## 实现计划

### [ ] 任务 1: 父组件 useOverlay 最佳实践
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 优化父组件的 useOverlay 实现
  - 添加类型定义和错误处理
  - 实现打开不同类型操作的方法
- **Success Criteria**:
  - 父组件可以正确创建和使用 overlay 实例
- **Test Requirements**:
  - `programmatic` TR-1.1: 父组件正确导入 `useOverlay`
  - `programmatic` TR-1.2: overlay 实例创建成功
  - `human-judgement` TR-1.3: 点击按钮可以打开模态框

### [ ] 任务 2: 子组件添加 close prop
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 为子组件添加 `close` prop，用于关闭 overlay 模态框
  - 这是 useOverlay() 系统自动传递的函数
- **Success Criteria**:
  - 子组件可以接收 `close` 函数作为 prop
- **Test Requirements**:
  - `programmatic` TR-2.1: 子组件接收 `close` prop
  - `programmatic` TR-2.2: 子组件接收 `operateType` prop

### [ ] 任务 3: 子组件实现 closeDrawer 函数
- **Priority**: P0
- **Depends On**: Task 2
- **Description**:
  - 实现 `closeDrawer` 函数，调用 `props.close()` 关闭模态框
  - 添加安全检查，处理 close 不存在的情况
- **Success Criteria**:
  - `closeDrawer` 函数可以关闭组件
- **Test Requirements**:
  - `programmatic` TR-3.1: 调用 `closeDrawer` 触发 `props.close()`
  - `human-judgement` TR-3.2: 点击取消按钮组件关闭

### [ ] 任务 4: 子组件实现 handleSubmit 函数
- **Priority**: P1
- **Depends On**: Task 3
- **Description**:
  - 实现表单提交逻辑
  - 调用表单校验
  - 校验通过后关闭组件
- **Success Criteria**:
  - 确认按钮可以提交表单并关闭组件
- **Test Requirements**:
  - `programmatic` TR-4.1: 点击确认按钮触发表单校验
  - `programmatic` TR-4.2: 校验通过后关闭组件

## 技术实现细节

### 父组件完整实现

```typescript
// app/pages/system/user/index.vue
<template>
  <div>
    <!-- 其他内容 -->
    <UButton @click="addUser">新增用户</UButton>
    <UButton @click="editUser">编辑用户</UButton>
  </div>
</template>

<script setup lang="ts">
import { useOverlay } from '@nuxt/ui'
import SysUserOperate from './components/sys-user-operate.vue'
import type { SysUserDto } from '#shared/system/user/common'

// 创建 overlay 实例
const overlay = useOverlay()
const userOperateModal = overlay.create(SysUserOperate)

// 打开新增用户模态框
const addUser = () => {
  userOperateModal.open({
    operateType: 'add'
  })
}

// 打开编辑用户模态框
const editUser = (user?: SysUserDto) => {
  userOperateModal.open({
    operateType: 'edit',
    userData: user // 可选：传递用户数据
  })
}
</script>
```

### 子组件完整实现

```typescript
// app/pages/system/user/components/sys-user-operate.vue
<script setup lang="ts">
import { useZodValidation } from '~/composables/useZodValidation'
import { SysUserAddSchema, SysUserUpdateSchema } from '#shared/system/user'
import { useTransformRecordToOption } from '~/composables/useTransformRecordToOption'
import { enableStatusRecord, userGenderRecord } from '#shared/constants/business'

const props = defineProps<{
  operateType: string
  close?: () => void
  userData?: any
}>()

const { $ts } = useI18n()
const form = useTemplateRef('form')

// 状态管理
const state = ref({
  id: '',
  username: '',
  password: '',
  nickname: '',
  email: '',
  gender: 0,
  status: 0,
  phone: ''
})

// 计算属性
const genderValue = computed({
  get: () => String(state.value.gender || 0),
  set: (val) => state.value.gender = Number(val)
})

const statusValue = computed({
  get: () => String(state.value.status || 0),
  set: (val) => state.value.status = Number(val)
})

// 校验
const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysUserAddSchema : SysUserUpdateSchema
})

// 选项数据
const genderItems = useTransformRecordToOption(userGenderRecord)
const statusItems = useTransformRecordToOption(enableStatusRecord)

// 标题
const title = computed(() => {
  const titles = {
    add: $ts('module.system.user.addUser'),
    edit: $ts('module.system.user.editUser')
  }
  return titles[props.operateType as keyof typeof titles] || ''
})

// 关闭函数
const closeDrawer = () => {
  props.close?.()
}

// 提交函数
const handleSubmit = async () => {
  if (form.value) {
    try {
      await form.value.validate()
      // 这里可以添加 API 调用逻辑
      closeDrawer()
    } catch (error) {
      // 校验失败，不关闭
      console.log('校验失败:', error)
    }
  }
}
</script>

<template>
  <UModal
    :title="title"
    :dismissible="false"
    :ui="{
      content: 'max-w-[70%]',
      footer: 'justify-end'
    }"
  >
    <template #body>
      <UForm
        ref="form"
        :validate="validate"
        :state="state"
        :schema="schema"
        class="p-2"
      >
        <!-- 表单字段 -->
      </UForm>
    </template>
    <template #footer>
      <UButton :label="$ts('common.cancel')" @click="closeDrawer" />
      <UButton :label="$ts('common.confirm')" @click="handleSubmit" />
    </template>
  </UModal>
</template>
```

## 测试计划

### 功能测试
1. **打开测试**:
   - 点击父组件按钮打开子组件
   - 验证 `operateType` 传递正确

2. **关闭测试**:
   - 点击子组件取消按钮关闭
   - 点击子组件确认按钮关闭
   - 验证表单校验失败时不关闭

3. **集成测试**:
   - 多次打开/关闭模态框
   - 切换不同操作类型
   - 验证 overlay 系统正常工作

### 边界情况
- **空数据测试**: 打开时不传递 userData
- **类型错误测试**: 传递错误的 operateType
- **网络错误测试**: 模拟 API 调用失败

## 最佳实践

### 父组件
- **类型安全**: 添加 overlay 实例的类型定义
- **错误处理**: 添加 try-catch 处理打开失败的情况
- **方法分离**: 为不同操作类型创建独立的打开方法
- **数据传递**: 合理使用 props 传递初始数据

### 子组件
- **Props 验证**: 为所有 props 添加类型定义
- **安全调用**: 对可选 props 进行安全检查
- **状态管理**: 使用 ref 和 computed 管理表单状态
- **校验集成**: 使用 useZodValidation 处理国际化校验

## 预期交付

- **父组件**:
  - 优化后的 useOverlay 实现
  - 类型安全的打开方法
  - 清晰的代码结构

- **子组件**:
  - 支持 close prop 的实现
  - 完整的关闭和提交逻辑
  - 与 overlay 系统的正确集成

- **文档**:
  - 详细的使用说明
  - 代码注释和类型定义
  - 测试用例和边界情况

## 技术栈

- **Vue 3 Composition API**
- **TypeScript**
- **Nuxt UI useOverlay**
- **Zod 校验**
- **i18n 国际化**