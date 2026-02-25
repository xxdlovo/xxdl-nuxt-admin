# SysUserOperate 组件控制计划

## 任务分析

### 当前状态

* 组件使用 `UModal` 展示

* `closeDrawer` 函数已定义但为空

* 组件通过 props 接收 `operateType`

* 父组件使用 `useOverlay()` 创建模态框

* 父组件通过 `modal.open({operateType:'add'})` 打开组件

### 需求

* `closeDrawer` 函数需要控制组件的展示与否

* 实现组件的关闭逻辑

## 实现计划

### \[ ] 任务 1: 添加 close prop 支持

* **Priority**: P0

* **Depends On**: None

* **Description**:

  * 为组件添加 `close` prop，用于关闭由 overlay 创建的模态框

  * 这是 useOverlay() 系统自动传递的函数

* **Success Criteria**:

  * 组件可以接收 `close` 函数作为 prop

* **Test Requirements**:

  * `programmatic` TR-1.1: 组件接收 `close` prop

  * `programmatic` TR-1.2: 组件接收 `operateType` prop

### \[ ] 任务 2: 实现 closeDrawer 函数

* **Priority**: P0

* **Depends On**: Task 1

* **Description**:

  * 实现 `closeDrawer` 函数，调用 `props.close()` 来关闭模态框

  * 确保函数安全调用，处理 close 不存在的情况

* **Success Criteria**:

  * `closeDrawer` 函数调用时关闭组件

* **Test Requirements**:

  * `programmatic` TR-2.1: 调用 `closeDrawer` 触发 `props.close()`

  * `human-judgement` TR-2.2: 点击取消按钮组件关闭

### \[ ] 任务 3: 处理确认按钮逻辑

* **Priority**: P1

* **Depends On**: Task 1, Task 2

* **Description**:

  * 实现 `handleSubmit` 函数

  * 调用表单校验

  * 校验通过后关闭组件

* **Success Criteria**:

  * 确认按钮点击后执行校验并关闭组件

* **Test Requirements**:

  * `programmatic` TR-3.1: 点击确认按钮触发表单校验

  * `programmatic` TR-3.2: 校验通过后关闭组件

### \[ ] 任务 4: 优化 UModal 配置

* **Priority**: P2

* **Depends On**: Task 1

* **Description**:

  * 移除 `dismissible` 属性，由 overlay 系统控制

  * 确保 UModal 与 overlay 系统正确集成

* **Success Criteria**:

  * 组件通过 overlay 系统正确显示和关闭

* **Test Requirements**:

  * `human-judgement` TR-4.1: 组件显示/隐藏正常

  * `human-judgement` TR-4.2: 关闭按钮功能正常

## 技术实现细节

### 组件 Props 更新

```typescript
const props = defineProps<{
  operateType: string;
  close?: () => void;
}>();
```

### closeDrawer 实现

```typescript
const closeDrawer = () => {
  props.close?.();
};
```

### handleSubmit 实现

```typescript
const handleSubmit = async () => {
  if (form.value) {
    try {
      await form.value.validate();
      // 可以在这里添加提交逻辑
      closeDrawer();
    } catch (error) {
      // 校验失败，不关闭
    }
  }
};
```

### UModal 更新

```vue
<UModal
  :title="title"
  :dismissible="false"
  :ui="{
    content:'max-w-[70%]',
    footer: 'justify-end'
  }"
>
```

## 测试计划

1. **基本功能测试**:

   * 组件可以通过 `modal.open()` 打开

   * 点击取消按钮关闭组件

   * 点击确认按钮执行校验并关闭

2. **边界情况测试**:

   * 表单校验失败时不关闭组件

   * 多次打开/关闭组件正常工作

3. **集成测试**:

   * 与 overlay 系统正确集成

   * `operateType` 传递正常

## 风险评估

* **低风险**: 实现逻辑简单，只涉及 Vue 的基本特性

* **注意事项**: 确保 `close` prop 是可选的，以避免在非 overlay 场景下的错误

## 预期交付

* 更新后的 `sys-user-operate.vue` 组件

* 支持通过 `close` prop 关闭组件

* 完整的 `closeDrawer` 和 `handleSubmit` 函数实现

