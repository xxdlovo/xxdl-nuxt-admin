
interface SelectOption {
    value: string;
    label: string;
}

/**
 * Transform record to option
 * @param record
 */
export function useTransformRecordToOption(record: Record<string, string>){
    const { $ts } = useI18n()
    return Object.entries(record).map(([value, label]) => ({
        value,
        label: $ts(label)
    })) as SelectOption[];
}