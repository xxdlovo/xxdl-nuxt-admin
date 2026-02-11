import { createTRPCNuxtClient , httpBatchLink, httpLink } from 'trpc-nuxt/client'
import type { AppRouter } from '#server/trpc/routers'
import {  TRPCClientError  } from '@trpc/client'
import type{ TRPCLink   } from '@trpc/client'
import {  retryLink   } from '@trpc/client'
import { observable } from '@trpc/server/observable';
import type {TRPCFormattedError} from "#shared/types/common";

// ==========  扩展 TRPC 错误类型 ==========
// 使用类型别名而不是继承，避免类型冲突
type TypedTRPCError = TRPCClientError<AppRouter> & {
  data: TRPCFormattedError;
};

/**
 * 重试机制
 * trpc对于500错误会自动重试, 所以需要在trpc的后端路由抛出400错误
 */
const retry = retryLink({
      retry(opts) {
        if (
          opts.error.data &&
          opts.error.data.code !== 'INTERNAL_SERVER_ERROR'
        ) {
          // Don't retry on non-500s
          return false;
        }
        if (opts.op.type !== 'query') {
          // Only retry queries
          return false;
        }
        // Retry up to 1 times
        return opts.attempts <= 0;
      },
      // Double every attempt, with max of 30 seconds (starting at 1 second)
      retryDelayMs: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    })
// 异常处理
const customLink: TRPCLink<AppRouter> = () => {
  const toast = useToast()
    // const {$ts} = useI18n()
    // console.log('翻译:',$ts('form.userName.required'))
  // here we just got initialized in the app - this happens once per app
  // useful for storing cache for instance
  return ({ next, op }) => {
    // this is when passing the result to the next link
    // each link needs to return an observable which propagates results
    return observable((observer) => {
      console.log('performing operation:', op);
        // console.log('翻译:',$ts('form.userName.required'))
      const unsubscribe = next(op).subscribe({
        next(value) {
          // console.log('we received value', value);
          observer.next(value);
        },
        error(err: TRPCClientError<AppRouter>) {
          // 类型断言为 TypedTRPCError（因为后端 errorFormatter 返回的数据格式）
          const typedErr = err as TypedTRPCError;
          console.log('we received error', typedErr.data.type);

          // 报错前先清空
          toast.clear()

          toast.add({
            title: typedErr.data?.type + '错误',
            description: getErrorDescription(typedErr),
            color: 'error',
          })
            observer.error(err)
        },
        complete() {
          observer.complete();
        },
      });
      return unsubscribe;
    });
  };
};

// 存放一些默认请求头
const getHeader =  ()=>{
  return {
    'zoo':  'zoo'
  }
}

export default defineNuxtPlugin(() => {
  const trpc = createTRPCNuxtClient<AppRouter>({
    links: [retry,customLink,httpBatchLink({
      url:'/api/trpc',
      headers: () => getHeader(),
      fetch(url, options){
        return fetch(url,{
          ...options,
          credentials: 'include'
        })
      } 
    }),],
  })
  return {
    provide: {
      trpc,
    },
  }
})

// 定义TRPC错误的结构类型
interface TRPCErrorDetail {
  origin: string;
  code: string;
  minimum?: number;
  inclusive?: boolean;
  path: string[];
  message: string;
}
/**
 * 从TRPC错误中提取并拼接所有错误信息
 * @param err - 错误对象
 * @returns 拼接后的错误描述字符串
 */
export const getErrorDescription = (err: unknown): string => {
  // 检查是否为TRPCClientError
  if (err instanceof TRPCClientError) {
    try {
      // 尝试从stack中提取错误数组字符串
      // stack的格式类似: "TRPCError: [ { ... }, { ... } ]\n    at ..."
      const stack = err.stack || '';
      const startIndex = stack.indexOf('[');
      const endIndex = stack.lastIndexOf(']') + 1;
      
      if (startIndex !== -1 && endIndex !== 0) {
        // 提取数组部分字符串
        const errorArrayStr = stack.substring(startIndex, endIndex);
        
        // 解析为对象数组
        const errors: TRPCErrorDetail[] = JSON.parse(errorArrayStr);
        
        // 拼接所有错误信息
        if (errors.length > 0) {
          return errors.map(e => e.message).join('；');
        }
      }
    } catch (parseError) {
      console.error('解析TRPC错误信息失败:', parseError);
    }
    
    // 如果解析失败，使用错误对象本身的message
    if (err.message) {
      return err.message;
    }
  }
  
  // 非TRPC错误的处理
  if (err instanceof Error) {
    return err.message || '发生未知错误';
  }
  
  return '发生未知错误';
};
