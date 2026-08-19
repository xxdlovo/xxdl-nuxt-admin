import { ZodError } from 'zod'
import { TRPCError } from '@trpc/server'
import { getCookie, getHeader } from 'h3'
import type { TRPCFormattedError } from '#shared/types/common'

type ErrorFormatterOpts = {
    error: TRPCError;
    shape: {
        data: any;
        [key: string]: any;
    };
    ctx?: any;
};

const supportedLocales = new Set(['en', 'zh'])

function normalizeLocale(locale?: string | null) {
    if (!locale) {
        return null
    }

    const normalized = locale.toLowerCase().split(',')[0]?.trim().split('-')[0]
    return normalized && supportedLocales.has(normalized) ? normalized : null
}

function getRequestLocale(ctx?: any) {
    const event = ctx?.event

    if (!event) {
        return 'en'
    }

    return normalizeLocale(getHeader(event, 'x-locale'))
        ?? normalizeLocale(getCookie(event, 'i18n_locale'))
        ?? normalizeLocale(getHeader(event, 'accept-language'))
        ?? 'en'
}

export const errorFormatter = ({ shape, error, ctx }: ErrorFormatterOpts) => {
    const locale = getRequestLocale(ctx)
    const $t = createLocaleT(locale)
    const unauthorizedKeys = new Set([
        'auth.unauthorized'
    ])

    let customMessage = error.message
    let errorType = $t("system.serverError")
    let trpcCode = shape.data.code
    let httpStatus = shape.data.httpStatus
    let i18nKey: string | undefined

    if (error.cause instanceof AppError) {
        i18nKey = error.cause.i18nKey
        errorType = $t(error.cause.i18nKey)
        // errorType = $t("system.serverError")
        // errorType = unauthorizedKeys.has(error.cause.i18nKey)
        //     ? $t("auth.unauthorized")
        //     : $t("system.serverError")
        // customMessage = $t(error.cause.i18nKey) + ': ' + customMessage
        if (unauthorizedKeys.has(error.cause.i18nKey)) {
            trpcCode = 'UNAUTHORIZED'
            httpStatus = 401
        }
    }
    else if (error.cause instanceof ZodError) {
        errorType = $t("system.zodError")
        const { fieldErrors, formErrors } = error.cause.flatten()
        const allMessages: string[] = []

        for (const field of Object.keys(fieldErrors)) {
            const errors = fieldErrors[field as keyof typeof fieldErrors]
            if (errors) {
                ;(errors as string[]).forEach((msg) => {
                    allMessages.push($t(msg))
                })
            }
        }

        if (allMessages.length > 0) {
            customMessage = allMessages.join('，')
        }
        else if (formErrors.length > 0 && formErrors[0]) {
            customMessage = $t(formErrors[0])
        }
        else {
            customMessage = $t('common.pleaseCheckValue')
        }
    }
    else if (isDatabaseError(error.cause)) {
        errorType = $t("system.dbError")
        const dbErr = error.cause as any
        customMessage = dbErr.cause?.message || 'Database error'
    }
    else if (error.cause instanceof Error) {
        customMessage = error.cause.message
    }

    if (customMessage && customMessage.includes('.') && !customMessage.includes('，')) {
        const translated = $t(customMessage)
        if (translated !== customMessage) {
            customMessage = translated
        }
    }

    shape.message = customMessage
    return {
        ...shape,
        data: {
            ...shape.data,
            type: errorType,
            message: customMessage,
            i18nKey,
            code: trpcCode,
            httpStatus,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        } as TRPCFormattedError,
    }
}

function isDatabaseError(cause: unknown): boolean {
    if (!cause || typeof cause !== 'object') return false

    const err = cause as any

    return (
        typeof err.cause?.code === 'string' ||
        typeof err.cause?.sql === 'string' ||
        typeof err.cause?.constraint === 'string'
    )
}
