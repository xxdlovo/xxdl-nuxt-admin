import { defineStore } from 'pinia'
import type { SysDictDataDto } from '#shared/system/dictData'
import { localStoragePersist } from './persistedStorage'

export const useDictStore = defineStore('dict', () => {
  const itemsByCode = ref<Record<string, SysDictDataDto[]>>({})
  const loadingByCode = ref<Record<string, boolean>>({})
  const errorByCode = ref<Record<string, Error | null>>({})
  const pendingByCode = new Map<string, Promise<SysDictDataDto[]>>()

  async function loadDict(code: string, force = false) {
    if (!force && itemsByCode.value[code]) {
      return itemsByCode.value[code]
    }

    const pending = pendingByCode.get(code)
    if (!force && pending) {
      return pending
    }

    const { $trpc } = useNuxtApp()

    loadingByCode.value[code] = true
    errorByCode.value[code] = null

    const request = (async () => {
      const items = await $trpc.sysDictData.listByTypeCode.query(code)
      itemsByCode.value[code] = items
      return items
    })()

    pendingByCode.set(code, request)

    try {
      return await request
    } catch (err) {
      errorByCode.value[code] = err as Error
      throw err
    } finally {
      pendingByCode.delete(code)
      loadingByCode.value[code] = false
    }
  }

  function clearDict(code?: string) {
    if (!code) {
      itemsByCode.value = {}
      loadingByCode.value = {}
      errorByCode.value = {}
      pendingByCode.clear()
      return
    }

    delete itemsByCode.value[code]
    delete loadingByCode.value[code]
    delete errorByCode.value[code]
    pendingByCode.delete(code)
  }

  return {
    itemsByCode,
    loadingByCode,
    errorByCode,
    loadDict,
    clearDict
  }
}, {
  persist: {
    key: 'dict',
    storage: localStoragePersist,
    pick: ['itemsByCode']
  }
})
