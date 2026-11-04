export default defineAppConfig({
  toaster: {
    position: 'bottom-right' as const,
    expand: true,
    duration: 5000
  },
  theme: {
    radius: 0.25,
    blackAsPrimary: false,
    colors: {} as Record<string, string>
  },
  ui: {
    colors: {
      primary: 'green',
      secondary: 'blue',
      success: 'green',
      info: 'blue',
      warning: 'yellow',
      error: 'red',
      neutral: 'slate'
    },
    //   设置鼠悬浮样式
    button: {
      slots: {
        base: 'cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed'
      }
    }
  }
})
