interface SelectOption {
    value: string;
    label: string;
}

/**
 * Transform record to option.
 *
 * @example
 *   ```ts
 *   const record = {
 *     key1: 'label1',
 *     key2: 'label2'
 *   };
 *   const options = transformRecordToOption(record);
 *   // [
 *   //   { value: 'key1', label: 'label1' },
 *   //   { value: 'key2', label: 'label2' }
 *   // ]
 *   ```
 *
 * @param record
 */
export function transformRecordToOption<T extends Record<string, string>>(record: T) {
    return Object.entries(record).map(([value, label]) => ({
        value,
        label
    })) as SelectOption[];
}

/**
 * Toggle html class when a browser document is available.
 *
 * @param className
 */
export function toggleHtmlClass(className: string) {
    const browserGlobal = globalThis as typeof globalThis & {
        document?: {
            documentElement?: {
                classList?: {
                    add: (value: string) => void
                    remove: (value: string) => void
                }
            }
        }
    }

    if (!browserGlobal.document?.documentElement?.classList) {
        return {
            add: () => {},
            remove: () => {}
        };
    }

    function add() {
        browserGlobal.document?.documentElement?.classList?.add(className);
    }

    function remove() {
        browserGlobal.document?.documentElement?.classList?.remove(className);
    }

    return {
        add,
        remove
    };
}
