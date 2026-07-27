import { AppError } from '#server/utils/appError'

type DemoRuntimeConfig = {
  demoMode?: boolean | string
}

export const demoReadonlyMiddleware = async (opts: any) => {
  const config = useRuntimeConfig(opts.ctx.event) as DemoRuntimeConfig
  const demoMode = process.env.NUXT_DEMO_MODE === 'true' || String(config.demoMode) === 'true'
  if (demoMode) {
    throw new AppError('system.demoReadonly')
  }

  return opts.next()
}
