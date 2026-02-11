
interface SelectOption {
    value: string;
    label: string;
}
/**
 * Transform record to option
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
 *   ```;
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
 * Toggle html class
 *
 * @param className
 */
export function toggleHtmlClass(className: string) {
    // 检查是否在浏览器环境
    if (typeof window === 'undefined') {
        return {
            add: () => {},
            remove: () => {}
        };
    }

    function add() {
        // @ts-ignore - document only exists in browser
        document.documentElement.classList.add(className);
    }

    function remove() {
        // @ts-ignore - document only exists in browser
        document.documentElement.classList.remove(className);
    }

    return {
        add,
        remove
    };
}