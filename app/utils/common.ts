

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
