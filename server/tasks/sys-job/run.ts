import { runSysJob } from '#server/sys-router/job/SysJobRunner'

export default defineTask({
  meta: {
    name: 'sys-job:run',
    description: 'Run one configured system job.'
  },
  async run({ payload }) {
    const jobId = typeof payload.jobId === 'string' ? payload.jobId : ''
    const triggerType = payload.triggerType === 'schedule' ? 'schedule' : 'manual'
    if (!jobId) {
      throw new Error('jobId is required')
    }

    return {
      result: await runSysJob({ jobId, triggerType })
    }
  }
})
