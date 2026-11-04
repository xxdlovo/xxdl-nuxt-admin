import 'pinia-plugin-persistedstate'

export const localStoragePersist = {
  getItem: (key: string) => import.meta.client ? window.localStorage.getItem(key) : null,
  setItem: (key: string, value: string) => {
    if (import.meta.client) {
      window.localStorage.setItem(key, value)
    }
  }
}
