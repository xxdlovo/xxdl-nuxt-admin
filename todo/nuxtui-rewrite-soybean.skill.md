# Skill：Soybean Admin 页面迁移到 Nuxt4 + Nuxt UI（4.4.0）

## 🎯目标

你正在将 Soybean Admin（Vue3 + NaiveUI）的页面组件  
迁移重写为 Nuxt4 + Nuxt UI（版本 4.4.0）。

你的任务是：

- 完全替换 UI 组件库
- 保持布局与交互逻辑一致
- i18n 翻译直接复用
- 禁止真实 API 请求
- Pinia/共享状态先留 TODO
- 代码必须符合 Nuxt 最佳实践
- 最终输出必须无报错、无报红

---

## ✅硬性要求（必须严格遵守）

---

### 1. UI 组件必须替换为 Nuxt UI（4.4.0）

Soybean Admin 使用 NaiveUI，例如：

- n-card
- n-form
- n-input
- n-button
- n-table
- n-tabs
- n-modal
- n-dropdown

这些必须全部替换为 Nuxt UI：

| NaiveUI 组件       | Nuxt UI 组件（4.4.0） |
|-------------------|----------------------|
| `<n-card>`        | `<UCard>`           |
| `<n-button>`      | `<UButton>`         |
| `<n-input>`       | `<UInput>`          |
| `<n-form>`        | `<UForm>`           |
| `<n-form-item>`   | `<UFormGroup>`      |
| `<n-table>`       | `<UTable>`          |
| `<n-modal>`       | `<UModal>`          |
| `<n-tabs>`        | `<UTabs>`           |
| `<n-dropdown>`    | `<UDropdown>`       |

❌禁止保留任何 NaiveUI import。

---

### 2. 页面布局与功能必须保持不变

必须保持：

- 页面结构一致
- 表单字段一致
- 表格列一致
- Modal 行为一致
- 按钮位置一致
- Tabs 交互一致

允许修改实现方式，但禁止重新设计 UI。

---

### 3. i18n 翻译必须复用 Soybean 原 key

Soybean 中常见写法：

```ts
$t('common.login')
$t('route.system.user')
```

必须原样保留：

- 不允许改 key
- 不允许写死中文
- 不允许替换为新翻译

---

### 4. 禁止任何网络请求

禁止出现：

- fetch
- axios
- $fetch
- useFetch
- useAsyncData

所有接口调用必须 stub：

```ts
// TODO: 后续接入真实 API
```

如果页面必须展示数据，可使用 mock 数据。

---

### 5. Pinia / 共享状态暂时留空 TODO

Soybean 中如果出现：

```ts
const userStore = useUserStore()
```

必须替换为：

```ts
// TODO: 后续接入 Pinia 全局状态
```

不要实现 store，不要模拟复杂逻辑。

---

### 6. Nuxt4 写法必须规范优化

必须使用 Nuxt 推荐方式：

- `<script setup lang="ts">`
- 自动导入 composables
- 正确使用 useRoute/useRouter

---

### 7. 输出代码必须无报错无报红

最终输出必须：

- TypeScript 无错误
- Nuxt UI props 正确
- 无 unused imports
- 无缺失组件
- 可直接复制运行

如果不确定，宁可简化实现，也不能报错。

---

## 📌输出格式要求

每次 rewrite 页面时必须输出：

1. 完整 `.vue` 文件
2. 必要 imports
3. mock 数据（如需要）
4. TODO 标记（共享状态/API）

示例：

```vue
<script setup lang="ts">
// TODO: 接入真实接口
</script>
```

---

## ✅重写检查清单（输出前必须自检）

- ✅ 页面功能一致
- ✅ UI 组件全部替换为 Nuxt UI
- ✅ i18n key 完全复用
- ✅ 无网络请求
- ✅ Pinia/shared state 留 TODO
- ✅ Nuxt4 最佳实践
- ✅ 无任何报红/报错

---

## 🔥组件替换示例

### Soybean（NaiveUI）

```vue
<n-button type="primary" @click="submit">
  {{ $t('common.confirm') }}
</n-button>
```

### Nuxt UI（正确写法）

```vue
<UButton color="primary" @click="submit">
  {{ $t('common.confirm') }}
</UButton>
```

---

## ⚠️重要原则

- 不允许重新设计页面
- 不允许删功能
- 只迁移实现方式
- 输出必须可以直接运行


---

### 8. 自动读取相关依赖文件（必须）

当用户提供一个源文件时，你必须：

- 自动分析该文件引用的组件、样式、hooks、utils
- 如果存在同目录或相关路径文件，需要一并读取并理解
- 保证迁移后页面逻辑完整

例如：

- `import './index.scss'`
- `import { useAuth } from '@/hooks/useAuth'`
- `import UserModal from './components/UserModal.vue'`

必须自动跟进这些依赖文件。

---

### 9. 自动拆分组件（保持 Soybean 结构）

如果源文件中包含：

- 大段表单
- 多个弹窗
- 表格 + 工具栏 + 查询区
- 重复 UI 块

必须自动拆分为 Nuxt4 推荐组件结构，例如：

```
pages/system/user/index.vue
pages/system/user/components/UserForm.vue
pages/system/user/components/UserModal.vue
components/CommonTable.vue
components/CommonSearch.vue
```

拆分要求：

- 保持原功能一致
- 不改变交互行为
- 组件命名清晰
- props/emits 类型完整
- 避免单文件过大
- 区分全局组件和页面级组件
- 全局组件放到app/components中
- 页面级组件放到输出文件同目录的components中

---

### 10. 样式迁移规则（保持一致）

如果 Soybean 使用：

- scss
- tailwind
- css module
- scoped style

必须做到：

- 样式不丢失
- 页面视觉布局保持一致
- 如果 Nuxt UI 默认样式足够，可减少冗余
- 如果无法迁移，标记：

```css
/* TODO: 样式迁移补全 */
```

禁止直接删除样式。

---

## ✅补充检查清单

输出前额外确认：

- ✅ 已读取所有关联文件
- ✅ 页面已自动拆分组件
- ✅ 样式迁移未丢失
