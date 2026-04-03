import type { CronTask } from './types.js'
import { listCronTasks, removeCronTask, updateLastFired } from './cronStore.js'
import { nextCronRunMs } from './cron.js'

const CHECK_INTERVAL_MS = 1000
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type Options = {
  onFire: (prompt: string) => void
  isLoading: () => boolean
}

export function createCronScheduler(options: Options): { start(): void; stop(): void } {
  const { onFire, isLoading } = options
  const nextFireAt = new Map<string, number>()
  let timer: ReturnType<typeof setInterval> | null = null

  function check() {
    if (isLoading()) return
    const now = Date.now()
    for (const t of listCronTasks()) {
      let next = nextFireAt.get(t.id)
      if (next === undefined) {
        // Anchor: recurring from lastFiredAt ?? createdAt, one-shot from createdAt
        const anchor = t.recurring ? (t.lastFiredAt ?? t.createdAt) : t.createdAt
        next = nextCronRunMs(t.cron, anchor) ?? Infinity
        nextFireAt.set(t.id, next)
      }
      if (now < next) continue
      // Fire
      onFire(t.prompt)
      const aged = t.recurring && (now - t.createdAt >= MAX_AGE_MS)
      if (t.recurring && !aged) {
        // Reschedule from now
        const newNext = nextCronRunMs(t.cron, now) ?? Infinity
        nextFireAt.set(t.id, newNext)
        updateLastFired(t.id, now)
      } else {
        // One-shot or aged-out recurring: delete
        removeCronTask(t.id)
        nextFireAt.delete(t.id)
      }
    }
    // Evict stale entries for removed tasks
    const ids = new Set(listCronTasks().map((t: CronTask) => t.id))
    for (const id of nextFireAt.keys()) {
      if (!ids.has(id)) nextFireAt.delete(id)
    }
  }

  return {
    start() {
      timer = setInterval(check, CHECK_INTERVAL_MS)
      timer.unref?.()
    },
    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}
