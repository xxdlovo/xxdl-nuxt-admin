import { ZodError } from 'zod';
import { TRPCError } from '@trpc/server';
import type {TRPCFormattedError} from "#shared/types/common";

// tRPC errorFormatter 的参数类型
type ErrorFormatterOpts = {
    error: TRPCError;
    shape: {
        data: TRPCFormattedError;
        [key: string]: any;
    };
};

export const errorFormatter = ({ shape, error }: ErrorFormatterOpts) => {
    let customMessage = error.message;
    let errorType: string = 'server'; // 默认服务器错误

    console.log('后端:捕获到了trpc的错误')

    if (error.cause instanceof ZodError) {
        console.log('捕获到zod错误')
        errorType = 'zod'; // Zod 验证错误
        const { fieldErrors, formErrors } = error.cause.flatten();

        // 1. 优先尝试获取第一个字段错误
        const firstField = Object.keys(fieldErrors)[0];
        if (firstField) {
            const errors = fieldErrors[firstField as keyof typeof fieldErrors];
            const msg = Array.isArray(errors) ? errors[0] : undefined;
            if (msg) {
                customMessage = `${firstField}: ${msg}`;
            }
        }
        // 2. 如果字段错误为空，尝试获取表单级（全局）错误
        else if (formErrors.length > 0 && formErrors[0]) {
            customMessage = formErrors[0];
        }
        // 3. 回退方案
        else {
            customMessage = '提交的数据格式不正确';
        }
    }

    // return{
    //     code: 200,
    //     data: '222'
    // }

    // ✅ 返回类型：data 符合 TRPCFormattedError 类型
    return {
        ...shape,
        data: {
            ...shape.data,
            type: errorType,
            message: customMessage,
            code: error.code,
            // 生产环境隐藏堆栈，保持简洁
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        } as TRPCFormattedError,
    };
};