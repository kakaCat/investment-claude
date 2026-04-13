const cleanupFns: Array<() => Promise<void>> = []
let registered = false

export function registerCleanup(fn: () => Promise<void>): void {
  cleanupFns.push(fn)
  if (!registered) {
    registered = true
    const runCleanup = () => {
      void Promise.all(cleanupFns.map((f) => f().catch(() => {})))
    }
    process.on('exit', runCleanup)
    process.on('SIGTERM', () => {
      runCleanup()
      process.exit(0)
    })
    process.on('SIGINT', () => {
      runCleanup()
      process.exit(0)
    })
  }
}
