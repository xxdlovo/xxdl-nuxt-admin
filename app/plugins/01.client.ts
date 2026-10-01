import { createTRPCNuxtClient , httpLink } from 'trpc-nuxt/client'
import type { AppRouter } from '#server/trpc/routers'
import {  TRPCClientError  } from '@trpc/client'
import type{ TRPCLink   } from '@trpc/client'
import { observable } from '@trpc/server/observable';
import type {TRPCFormattedError} from "#shared/types/common";

// ==========  扩展 TRPC 错误类型 ==========
// 使用类型别名而不是继承，避免类型冲突
type TypedTRPCError = TRPCClientError<AppRouter> & {
  data: TRPCFormattedError;
};

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

          // 错误信息已在服务端翻译好，直接使用
          const description = typedErr.message || '发生未知错误'

          toast.add({
            title: typedErr.data?.type,
            description,
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
  const locale = useCookie<string>('i18n_locale').value || 'en'

  return {
    'zoo':  'zoo',
    'x-locale': locale,
    'accept-language': locale
  }
}

export default defineNuxtPlugin(() => {
  const trpc = createTRPCNuxtClient<AppRouter>({
    // 使用 httpLink：一次调用一个请求，不做批量合并
    links: [customLink, httpLink({
      url:'/api/trpc',
      headers: () => getHeader(),
      fetch(url, options){
        return fetch(url,{
          ...options,
          credentials: 'include'
        })
      } 
    })],
  })
  return {
    provide: {
      trpc,
    },
  }
})

