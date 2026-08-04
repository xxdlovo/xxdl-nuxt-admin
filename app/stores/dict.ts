import { defineStore } from 'pinia'
import type { SysDictDataDto } from '#shared/system/dictData'
import { localStoragePersist } from './persistedStorage'

export const useDictStore = defineStore('dict', () => {
  const itemsByCode = ref<Record<string, SysDictDataDto[]>>({})
  const loadingByCode = ref<Record<string, boolean>>({})
  const errorByCode = ref<Record<string, Error | null>>({})
  const codeByTypeId = ref<Record<string, string>>({})
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

  function setTypeCode(typeId?: string | null, code?: string | null) {
    if (typeId && code) {
      codeByTypeId.value[typeId] = code
    }
  }

  function removeTypeCode(typeId?: string | null) {
    if (typeId) {
      delete codeByTypeId.value[typeId]
    }
  }

  function clearDictByCodes(codes: Array<string | null | undefined>) {
    const uniqueCodes = new Set(codes.filter((code): code is string => Boolean(code)))
    uniqueCodes.forEach(code => clearDict(code))
  }

  async function getCodeByTypeId(typeId?: string | null) {
    if (!typeId) return undefined

    const cachedCode = codeByTypeId.value[typeId]
    if (cachedCode) return cachedCode

    const { $trpc } = useNuxtApp()
    const dictType = await $trpc.sysDictType.getById.query(typeId)

    if (dictType.code) {
      codeByTypeId.value[typeId] = dictType.code
    }

    return dictType.code
  }

  async function clearDictByTypeIds(typeIds: Array<string | null | undefined>, fallbackCode?: string) {
    const codes = new Set<string>()

    try {
      for (const typeId of typeIds) {
        const code = await getCodeByTypeId(typeId)
        if (code) {
          codes.add(code)
        }
      }

      if (codes.size === 0) {
        clearDict(fallbackCode)
        return
      }

      clearDictByCodes([...codes])
    } catch {
      clearDict(fallbackCode)
    }
  }

  return {
    itemsByCode,
    loadingByCode,
    errorByCode,
    codeByTypeId,
    loadDict,
    clearDict,
    setTypeCode,
    removeTypeCode,
    clearDictByCodes,
    clearDictByTypeIds
  }
}, {
  persist: {
    key: 'dict',
    storage: localStoragePersist,
    pick: ['itemsByCode']
  }
})
