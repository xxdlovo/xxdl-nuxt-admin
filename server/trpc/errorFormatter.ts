import { ZodError } from 'zod';
import { TRPCError } from '@trpc/server';
import type {TRPCFormattedError} from "#shared/types/common";
// createLocaleT / getCookie / AppError 由 Nitro auto-import，无需显式导入

// tRPC errorFormatter 的参数类型（tRPC v11 会传入 ctx）
type ErrorFormatterOpts = {
    error: TRPCError;
    shape: {
        data: any;
        [key: string]: any;
    };
    ctx?: any;
};

export const errorFormatter = ({ shape, error, ctx }: ErrorFormatterOpts) => {
    // 从请求上下文中获取语言环境，创建翻译函数
    const locale = ctx?.event ? (getCookie(ctx.event, 'i18n_locale') || 'en') : 'en'
    const $t = createLocaleT(locale)

    let customMessage = error.message;
    let errorType: string = 'server';

    // ========== 1️⃣ AppError — 翻译 i18n key ==========
    if (error.cause instanceof AppError) {
        errorType = 'app';
        customMessage = $t(error.cause.i18nKey)
    }
    // ========== 2️⃣ Zod 验证错误 ==========
    else if (error.cause instanceof ZodError) {
        errorType = 'zod';
        const { fieldErrors, formErrors } = error.cause.flatten();

        // 收集并翻译所有字段错误
        const allMessages: string[] = []
        for (const field of Object.keys(fieldErrors)) {
            const errors = fieldErrors[field as keyof typeof fieldErrors]
            if (errors) {
                ;(errors as string[]).forEach((msg: string) => {
                    allMessages.push($t(msg))
                })
            }
        }

        if (allMessages.length > 0) {
            customMessage = allMessages.join('；')
        }
        else if (formErrors.length > 0 && formErrors[0]) {
            customMessage = $t(formErrors[0])
        }
        else {
            customMessage = '提交的数据格式不正确'
        }
    }
    // ========== 3️⃣ Drizzle / 数据库错误 ==========
    else if (isDatabaseError(error.cause)) {
        errorType = 'database';
        const dbErr = error.cause as any
        customMessage = dbErr.cause?.message || '数据库异常'
    }
    // ========== 4️⃣ 普通 Error（如服务层 throw new Error('xxx')） ==========
    else if (error.cause instanceof Error) {
        // 保持原始消息，不做翻译
        customMessage = error.cause.message
    }

    // 如果消息看起来是 i18n key（含点号），尝试翻译
    if (customMessage && customMessage.includes('.') && !customMessage.includes('；')) {
        const translated = $t(customMessage)
        if (translated !== customMessage) {
            customMessage = translated
        }
    }

    shape.message = customMessage;
    return {
        ...shape,
        data: {
            ...shape.data,
            type: errorType,
            message: customMessage,
            code: error.code,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        } as TRPCFormattedError,
    };
};

/**
 * 判断是否是数据库错误（带空安全）
 */
function isDatabaseError(cause: unknown): boolean {
    if (!cause || typeof cause !== 'object') return false;

    const err = cause as any;

    // 使用可选链，防止 err.cause 为 undefined 时抛异常
    return (
        typeof err.cause?.code === 'string' ||        // pg/mysql error
        typeof err.cause?.sql === 'string' ||         // drizzle query error
        typeof err.cause?.constraint === 'string'     // pg constraint
    );
}
