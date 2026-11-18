/**
 * 可拖拽的悬浮按钮
 *
 * 提供位置（style）、拖拽状态和事件处理器，支持：
 * - 拖拽移动并限制在视口内
 * - 松手后把位置记忆到 localStorage
 * - 拖拽结束后的那一次 click 自动忽略（避免"拖完又触发点击"）
 * - 点击（未拖拽）时执行 onClick
 */
export interface UseDraggableFabOptions {
  /** 位置记忆的 localStorage key */
  storageKey?: string
  /** 按钮尺寸（px），用于边界计算 */
  size?: number
  /** 距视口边缘的最小距离（px） */
  edge?: number
  /** 默认距底部的距离（px） */
  bottomOffset?: number
  /** 点击（未拖拽）时回调 */
  onClick?: () => void
}

export function useDraggableFab(options: UseDraggableFabOptions = {}) {
  const size = options.size ?? 48
  const edge = options.edge ?? 12
  const bottomOffset = options.bottomOffset ?? 96
  const storageKey = options.storageKey ?? 'draggable-fab-pos'

  const left = ref(0)
  const top = ref(0)
  const dragging = ref(false)

  const maxLeft = () => Math.max(edge, window.innerWidth - size - edge)
  const maxTop = () => Math.max(edge, window.innerHeight - size - edge)
  const clampX = (value: number) => Math.min(Math.max(value, edge), maxLeft())
  const clampY = (value: number) => Math.min(Math.max(value, edge), maxTop())

  const placeDefault = () => {
    left.value = maxLeft()
    top.value = Math.max(edge, window.innerHeight - size - bottomOffset)
  }

  const handleResize = () => {
    left.value = clampX(left.value)
    top.value = clampY(top.value)
  }

  let pointer: {
    id: number
    startX: number
    startY: number
    left: number
    top: number
    moved: boolean
  } | null = null

  let ignoreNextClick = false

  const onPointerDown = (event: PointerEvent) => {
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: left.value,
      top: top.value,
      moved: false
    }
    dragging.value = true
    ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) {
      return
    }

    const dx = event.clientX - pointer.startX
    const dy = event.clientY - pointer.startY

    // 手指点击会有轻微抖动，阈值太小会被误判为拖拽
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      pointer.moved = true
    }

    if (!pointer.moved) {
      return
    }

    left.value = clampX(pointer.left + dx)
    top.value = clampY(pointer.top + dy)
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) {
      return
    }

    const moved = pointer.moved
    pointer = null
    dragging.value = false
    ;(event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId)

    if (!moved) {
      return
    }

    window.localStorage.setItem(storageKey, JSON.stringify({ left: left.value, top: top.value }))

    // 拖拽结束后浏览器可能还会补一次 click
    ignoreNextClick = true
    window.setTimeout(() => {
      ignoreNextClick = false
    }, 300)
  }

  const onClick = () => {
    if (ignoreNextClick) {
      return
    }

    options.onClick?.()
  }

  const style = computed(() => ({
    left: `${left.value}px`,
    top: `${top.value}px`
  }))

  onMounted(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) {
        const position = JSON.parse(saved) as { left?: number, top?: number }
        left.value = clampX(Number(position.left))
        top.value = clampY(Number(position.top))
      } else {
        placeDefault()
      }
    } catch {
      placeDefault()
    }

    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    left,
    top,
    dragging,
    style,
    /**
     * 直接用于 `v-on="handlers"`：v-on 对象语法里的 key 必须是原生事件名，
     * 不能写成 onPointerdown（那样会绑定成同名的自定义事件，导致按钮完全无响应）。
     */
    handlers: {
      pointerdown: onPointerDown,
      pointermove: onPointerMove,
      pointerup: onPointerUp,
      pointercancel: onPointerUp,
      click: onClick
    }
  }
}
