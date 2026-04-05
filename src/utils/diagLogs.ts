import { appendFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { getSessionId } from '../tasks/sessionId.js'

export type DiagnosticLogLevel = 'debug' | 'info' | 'warn' | 'error'

type DiagnosticLogEntry = {
  timestamp: string
  level: DiagnosticLogLevel
  event: string
  data: Record<string, unknown>
}

function getDiagnosticLogFile(): string {
  return (
    process.env.PI_DIAGNOSTICS_FILE ??
    join(homedir(), '.pi', 'diagnostics', `${getSessionId()}.jsonl`)
  )
}

export function logForDiagnosticsNoPII(
  level: DiagnosticLogLevel,
  event: string,
  data?: Record<string, unknown>,
): void {
  const logFile = getDiagnosticLogFile()
  const entry: DiagnosticLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    data: data ?? {},
  }
  const line = JSON.stringify(entry) + '\n'

  try {
    appendFileSync(logFile, line)
  } catch {
    try {
      mkdirSync(dirname(logFile), { recursive: true })
      appendFileSync(logFile, line)
    } catch {
      // non-critical, silent fail
    }
  }
}

export async function withDiagnosticsTiming<T>(
  event: string,
  fn: () => Promise<T>,
  getData?: (result: T) => Record<string, unknown>,
): Promise<T> {
  const startTime = Date.now()
  logForDiagnosticsNoPII('info', `${event}_started`)

  try {
    const result = await fn()
    const additionalData = getData ? getData(result) : {}
    logForDiagnosticsNoPII('info', `${event}_completed`, {
      duration_ms: Date.now() - startTime,
      ...additionalData,
    })
    return result
  } catch (error) {
    logForDiagnosticsNoPII('error', `${event}_failed`, {
      duration_ms: Date.now() - startTime,
    })
    throw error
  }
}
