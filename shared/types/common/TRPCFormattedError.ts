export interface TRPCFormattedError {
    message: string;           // 错误消息
    i18nKey?: string;          // AppError 原始国际化 key，供前端判断可自行处理的业务错误
    type?: string;             // 错误类型, 比如zod/user/server/other
    code: string;              // tRPC 错误码 (BAD_REQUEST, UNAUTHORIZED 等)
    httpStatus?: number;       // HTTP 状态码
    stack?: string;            // 堆栈信息（仅开发环境）
    path?: string;             // 错误路径
    timestamp?: string;         // 时间戳（可选）
}
