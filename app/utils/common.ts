
import { computed } from 'vue'
import type { ComputedRef } from 'vue'

interface SelectOption<T> {
    value: T;
    label: string;
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
