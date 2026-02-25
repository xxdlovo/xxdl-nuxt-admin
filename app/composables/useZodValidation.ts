/**
 * Zod 校验国际化 composable
 * 用于处理表单校验和独立字段校验的错误消息翻译
 * 
 * @example
 * // 表单校验
 * const { schema, validate } = useZodValidation({
 *   schema: SysUserAddSchema
 * })
 * 
 * // 单字段校验
 * const { validateField } = useZodValidation({
 *   schema: SysUserAddSchema
 * })
 * 
 * const error = await validateField('username', 'test')
 */
// app/composables/useZodValidation.ts
import { computed } from 'vue'
import type { ZodSchema, ZodSafeParseResult } from 'zod'

/**
 * 表单错误接口
 */
export interface FormError {
    /** 字段名称 */
    name: string
    /** 错误消息 */
    message: string
}

/**
 * 校验选项接口
 */
export interface UseZodValidationOptions<T> {
    /** Zod schema 或返回 schema 的函数 */
    schema: ZodSchema<T> | (() => ZodSchema<T>)
    /** 是否翻译错误消息，默认 true */
    translate?: boolean
}

/**
 * Zod 校验国际化 composable
 * 
 * @template T - Schema 类型
 * @param options - 配置选项
 * @returns 校验相关的方法和属性
 */
export function useZodValidation<T>(options: UseZodValidationOptions<T>) {
    const { $ts } = useI18n()
    const { schema: schemaInput, translate = true } = options

    /**
     * 计算出的 schema 对象
     */
    const schema = computed(() => {
        return typeof schemaInput === 'function' ? schemaInput() : schemaInput
    })

    /**
     * 翻译错误消息
     * 
     * @param message - 错误消息或翻译 key
     * @returns 翻译后的错误消息
     */
    const translateError = (message: string): string => {
        if (!translate) return message
        return $ts(message)
    }

    /**
     * 表单级别校验
     * 用于 UForm 的 validate prop
     * 
     * @param state - 表单状态
     * @returns 错误数组
     */
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

    /**
     * 字段级别校验
     * 用于单个字段的实时校验
     * 
     * @param name - 字段名称
     * @param value - 字段值
     * @returns 错误消息或 null
     */
    const validateField = async (name: string, value: unknown): Promise<string | null> => {
        try {
            // 使用类型断言来访问内部属性
            const schemaObj = schema.value as any
            
            if (schemaObj && schemaObj._zod && schemaObj._zod.def && schemaObj._zod.def.shape) {
                const fieldSchema = schemaObj._zod.def.shape[name]
                
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
        } catch (error) {
            console.warn('Error accessing schema shape:', error)
        }
        
        console.warn('Schema does not have shape property')
        return null
    }

    /**
     * 独立校验
     * 用于非表单场景的校验
     * 
     * @param data - 要校验的数据
     * @returns 校验结果
     */
    const parse = (data: unknown): ZodSafeParseResult<T> => {
        return schema.value.safeParse(data)
    }

    return {
        /** 计算出的 schema 对象 */
        schema,
        /** 表单级别校验函数 */
        validate,
        /** 字段级别校验函数 */
        validateField,
        /** 独立校验函数 */
        parse,
        /** 错误消息翻译函数 */
        translateError
    }
}