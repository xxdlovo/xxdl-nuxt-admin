/**
 * 移动端断点判断
 *
 * 统一全站的移动端判断逻辑（与 Tailwind 的 md 断点一致），
 * 组件卸载时自动清理媒体查询监听。
 *
 * @param maxWidth 触发移动端的最大宽度（px），默认 767（即 <768）
 */
export function useIsMobile(maxWidth = 767) {
  const isMobile = ref(false)
  let media: MediaQueryList | null = null

  const handleChange = (event: MediaQueryListEvent) => {
    isMobile.value = event.matches
  }

  onMounted(() => {
    media = window.matchMedia(`(max-width: ${maxWidth}px)`)
    isMobile.value = media.matches
    media.addEventListener('change', handleChange)
  })

  onUnmounted(() => {
    media?.removeEventListener('change', handleChange)
  })

  return isMobile
}
