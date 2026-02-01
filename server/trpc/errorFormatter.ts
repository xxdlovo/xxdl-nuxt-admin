import { ZodError } from 'zod';

export const errorFormatter = ({ shape, error }: any) => {
    let customMessage = error.message;

    if (error.cause instanceof ZodError) {
        const { fieldErrors, formErrors } = error.cause.flatten();

        // 1. 优先尝试获取第一个字段错误
        const firstField = Object.keys(fieldErrors)[0];
        if (firstField) {
            const msg = fieldErrors[firstField]?.[0];
            customMessage = `${firstField}: ${msg}`;
        }
        // 2. 如果字段错误为空，尝试获取表单级（全局）错误
        else if (formErrors.length > 0) {
            customMessage = formErrors[0];
        }
        // 3. 回退方案
        else {
            customMessage = '提交的数据格式不正确';
        }
    }

    return {
        ...shape,
        data: {
            ...shape.data,
            message: customMessage,
            code: error.code,
            // 生产环境隐藏堆栈，保持简洁
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        },
    };
};