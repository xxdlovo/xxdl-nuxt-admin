
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import {useRbacProfileStore} from "~/stores/rbacProfile";
import {useTabsStore} from "~/stores/tabs";

interface SelectOption<T> {
    value: T;
    label: string;
}

// 判断用户登录后是否需要清理相关store
export function afterUserLogin(username:string){

    const rbac = useRbacProfileStore()
   // const oldUser =  rbac.profile?.user?.username || ''
   //  if(oldUser === username){
   //      return
   //  }
    rbac.clearProfile()
    const tabs = useTabsStore()
    tabs.closeAll()
}

/**
 * Translate options
 *
 * @param options
 */
export function translateOptions<T>(options: SelectOption<T>[]): SelectOption<number>[] {
    const { $ts } = useNuxtApp()
  return options.map(option => ({
    value: Number(option.value),
    label: $ts(option.label)
  }));
}

export function isPresent(value: unknown) {
    return value !== undefined && value !== null && value !== ''
}

export function displayOrDash(value: unknown) {
    return isPresent(value) ? String(value) : '-'
}


// export function translateOptions<T>(options: SelectOption<T>[]): ComputedRef<SelectOption<number>[]> {
//     const { $ts } = useNuxtApp()
//     return computed(() => options.map(option => ({
//         value: Number(option.value),
//         label: $ts(option.label)
//     })));
// }
