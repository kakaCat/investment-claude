import { appendFile } from 'fs/promises'
import { mkdirSync } from 'fs'
import { join } from 'path'

let logFilePath: string | null = null

export function initLogger(sessionId: string, cwd: string): void {
  const logsDir = join(cwd, '.pi', 'logs')
  logFilePath = join(logsDir, `session-ob-${sessionId}.jsonl`)
  try {
    mkdirSync(logsDir, { recursive: true })
  } catch {
    // silent — permission error, etc.
  }
}

export async function appendEvent(event: Record<string, unknown>): Promise<void> {
  if (!logFilePath) return
  const line = JSON.stringify(event) + '\n'
  try {
    await appendFile(logFilePath, line, 'utf-8')
  } catch {
    // silent — disk full, permission error, etc.
  }
}

export function getLogFilePath(): string | null {
  return logFilePath
}

export function getHtmlFilePath(): string | null {
  if (!logFilePath) return null
  return logFilePath.replace(/\.jsonl$/, '.html')
}

/** Test helper — resets module state between tests */
export function resetLogger(): void {
  logFilePath = null
}
