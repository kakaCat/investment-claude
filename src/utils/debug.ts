import { appendFile, mkdir, symlink, unlink } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { getSessionId } from '../tasks/sessionId.js'
import { registerCleanup } from './cleanupRegistry.js'

export type DebugLogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error'

let pendingWrite: Promise<void> = Promise.resolve()
let cleanupRegistered = false
let symlinkCreated = false

export function getDebugLogPath(): string {
  return join(homedir(), '.pi', 'debug', `${getSessionId()}.txt`)
}

async function ensureDirAndSymlink(logPath: string): Promise<void> {
  const dir = dirname(logPath)
  await mkdir(dir, { recursive: true }).catch(() => {})
  if (!symlinkCreated) {
    symlinkCreated = true
    const latestPath = join(dir, 'latest')
    await unlink(latestPath).catch(() => {})
    await symlink(logPath, latestPath).catch(() => {})
  }
}

export function logForDebugging(
  message: string,
  options?: { level?: DebugLogLevel },
): void {
  const level = (options?.level ?? 'debug').toUpperCase()
  const timestamp = new Date().toISOString()
  const line = `${timestamp} [${level}] ${message.trim()}\n`
  const logPath = getDebugLogPath()

  if (!cleanupRegistered) {
    cleanupRegistered = true
    registerCleanup(async () => {
      await pendingWrite
    })
  }

  pendingWrite = pendingWrite
    .then(async () => {
      await ensureDirAndSymlink(logPath)
      await appendFile(logPath, line, 'utf-8')
    })
    .catch(() => {})
}
