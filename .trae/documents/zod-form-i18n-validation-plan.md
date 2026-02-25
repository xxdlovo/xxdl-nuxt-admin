# UForm 校验错误消息国际化方案（优化版）

## 问题分析

### 当前情况

1. **Schema 定义**: `SysUserAddSchema` 中的错误消息使用 i18n key，如 `form.userName.required`
2. **后端处理**: 通过 `getErrorDescription` 函数在 TRPC 错误处理中翻译
3. **前端问题**: UForm 组件直接显示 Zod 返回的 `message`，没有翻译过程

### 需求场景

1. **表单校验**: 整个表单提交时的批量校验
2. **单字段校验**: 输入框实时校验（如 blur/input 时）
3. **独立校验**: 不依赖表单的独立输入校验

***

## 解决方案：useZodValidation composable

### 设计思路

创建一个通用的 `useZodValidation` composable，提供：

1. **表单级别校验**: `validate` 函数，用于 UForm 的 `validate` prop
2. **字段级别校验**: `validateField` 函数，用于单个字段的实时校验
3. **独立校验**: `parse` 函数，用于非表单场景的校验

### API 设计

```typescript
interface UseZodValidationOptions<T> {
  schema: ZodSchema<T> | (() => ZodSchema<T>)
  translate?: boolean
}

interface UseZodValidationReturn<T> {
  schema: ComputedRef<ZodSchema<T>>
  validate: (state: unknown) => Promise<FormError[]>
  validateField: (name: string, value: unknown) => Promise<string | null>
  parse: (data: unknown) => SafeParseResult<T>
  translateError: (message: string) => string
}
```

### 完整实现

```typescript
// app/composables/useZodValidation.ts
import type { ZodSchema, SafeParseReturnType } from 'zod'

export interface FormError {
  name: string
  message: string
}

export interface UseZodValidationOptions<T> {
  schema: ZodSchema<T> | (() => ZodSchema<T>)
  translate?: boolean
}

export function useZodValidation<T>(options: UseZodValidationOptions<T>) {
  const { $ts } = useI18n()
  const { schema: schemaInput, translate = true } = options

  const schema = computed(() => {
    return typeof schemaInput === 'function' ? schemaInput() : schemaInput
  })

  const translateError = (message: string): string => {
    if (!translate) return message
    return $ts(message)
  }

  const validate = async (state: unknown): Promise<FormError[]> => {
    const result = schema.value.safeParse(state)
    
    if (result.success) {
      return []
    }
    
    return result.error.issues.map(issue => ({
      name: issue.path.join('.'),
      message: translateError(issue.message)
    }))
  }

  const validateField = async (name: string, value: unknown): Promise<string | null> => {
    const fieldSchema = schema.value.shape?.[name]
    
    if (!fieldSchema) {
      console.warn(`Field "${name}" not found in schema`)
      return null
    }
    
    const result = fieldSchema.safeParse(value)
    
    if (result.success) {
      return null
    }
    
    return translateError(result.error.issues[0]?.message || 'Validation failed')
  }

  const parse = (data: unknown): SafeParseReturnType<unknown, T> => {
    return schema.value.safeParse(data)
  }

  return {
    schema,
    validate,
    validateField,
    parse,
    translateError
  }
}
```

***

## 使用场景

### 场景一：表单整体校验

```vue
<script setup lang="ts">
import { SysUserAddSchema, type SysUserAddDTO } from "#shared/system/user"

const props = defineProps<{
  operateType: string
}>()

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysUserAddSchema : SysUserUpdateSchema
})

const state = ref<SysUserAddDTO>({
  id: '',
  username: '',
  password: '',
  email: '',
})
</script>

<template>
  <UForm :validate="validate" :schema="schema" :state="state">
    <UFormField name="username" required label="用户名">
      <UInput v-model="state.username" />
    </UFormField>
    <!-- 其他字段 -->
  </UForm>
</template>
```

### 场景二：单字段实时校验

```vue
<script setup lang="ts">
import { SysUserAddSchema } from "#shared/system/user"

const { validateField } = useZodValidation({
  schema: SysUserAddSchema
})

const username = ref('')
const usernameError = ref<string | null>(null)

const handleBlur = async () => {
  usernameError.value = await validateField('username', username.value)
}
</script>

<template>
  <div>
    <UInput 
      v-model="username" 
      @blur="handleBlur"
      :error="!!usernameError"
    />
    <span v-if="usernameError" class="text-red-500">{{ usernameError }}</span>
  </div>
</template>
```

### 场景三：独立输入校验（非表单）

```vue
<script setup lang="ts">
import { z } from 'zod'

const emailSchema = z.string().email('form.email.invalid')

const { validateField, translateError } = useZodValidation({
  schema: emailSchema
})

const email = ref('')
const emailError = ref('')

watch(email, async (val) => {
  const result = emailSchema.safeParse(val)
  emailError.value = result.success ? '' : translateError(result.error.issues[0].message)
})
</script>

<template>
  <UInput 
    v-model="email" 
    :error="!!emailError"
  />
</template>
```

### 场景四：提交时获取校验结果

```vue
<script setup lang="ts">
import { SysUserAddSchema } from "#shared/system/user"

const { schema, validate, parse } = useZodValidation({
  schema: SysUserAddSchema
})

const state = ref({ ... })

const handleSubmit = async () => {
  const errors = await validate(state.value)
  
  if (errors.length > 0) {
    console.log('校验失败:', errors)
    return
  }
  
  const result = parse(state.value)
  if (result.success) {
    const validatedData = result.data
    await submitForm(validatedData)
  }
}
</script>
```

***

## 高级用法

### 动态 Schema 切换

```vue
<script setup lang="ts">
import { SysUserAddSchema, SysUserUpdateSchema } from "#shared/system/user"

const props = defineProps<{
  mode: 'add' | 'edit'
}>()

const { schema, validate } = useZodValidation({
  schema: () => props.mode === 'add' ? SysUserAddSchema : SysUserUpdateSchema
})
</script>
```

### 关闭自动翻译

```typescript
const { validate } = useZodValidation({
  schema: MySchema,
  translate: false
})
```

### 嵌套字段校验

```typescript
const { validateField } = useZodValidation({
  schema: z.object({
    user: z.object({
      profile: z.object({
        name: z.string().min(1, 'form.name.required')
      })
    })
  })
})

const error = await validateField('user.profile.name', 'test')
```

***

## 文件修改清单

| 文件                                                      | 操作                          |
| ------------------------------------------------------- | --------------------------- |
| `app/composables/useZodValidation.ts`                   | 新建 - 创建通用 Zod 校验 composable |
| `app/pages/system/user/components/sys-user-operate.vue` | 修改 - 使用 useZodValidation    |

***

## 类型定义补充

```typescript
// types/validation.ts
export interface FormError {
  name: string
  message: string
}

export interface FieldValidationResult {
  valid: boolean
  error: string | null
}

export type ValidationMode = 'blur' | 'input' | 'change' | 'submit'
```

***

## 注意事项

1. **翻译 key 必须存在**: 确保 `form.userName.required` 等 key 在 locale 文件中定义
2. **服务端验证**: 后端仍需保持现有的翻译逻辑
3. **嵌套对象**: `validateField` 支持点分隔的嵌套路径，如 `user.profile.name`
4. **性能**: 对于大型表单，建议使用 `validateField` 进行局部校验，避免每次都校验整个表单

