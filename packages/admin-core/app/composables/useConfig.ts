type ConfigDefault = string | number | boolean | null

export function useConfig() {
    const {$trpc} = useNuxtApp()
    const {$ts} = useI18n()

    async function getConfigValue(key: string): Promise<string>
    async function getConfigValue<TDefault extends ConfigDefault>(key: string, defaultValue: TDefault): Promise<string | TDefault>
    async function getConfigValue<TDefault extends ConfigDefault>(key: string, defaultValue?: TDefault) {
        const value = await $trpc.sysConfig.getValueByKey.query(key)

        if (value != null) {
            return value
        }

        if (arguments.length >= 2) {
            return defaultValue as TDefault
        }
        const toast = useToast()
        toast.add({
            title: $ts('module.system.config.configNotExist', {key}),
            color: 'warning'
        })
        throw new Error($ts('module.system.config.configNotExist', {key}))
    }

    return {
        getConfigValue
    }
}
