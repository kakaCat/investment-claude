import { appendFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { getProjectRoot, getSessionId } from './bootstrap/state.js'
import { registerCleanup } from './utils/cleanupRegistry.js'
import { getErrnoCode } from './utils/errors.js'
import { readLinesReverse } from './utils/fsOperations.js'
import { lock } from './utils/lockfile.js'
import {
  hashPastedText,
  retrievePastedText,
  storePastedText,
} from './utils/pasteStore.js'

const MAX_HISTORY_ITEMS = 100
const MAX_PASTED_CONTENT_LENGTH = 1024

export type PastedContent = {
  id: number
  type: 'text' | 'image'
  content: string
  mediaType?: string
  filename?: string
}

export type HistoryEntry = {
  display: string
  pastedContents: Record<number, PastedContent>
}

type StoredPastedContent = {
  id: number
  type: 'text' | 'image'
  content?: string
  contentHash?: string
  mediaType?: string
  filename?: string
}

type LogEntry = {
  display: string
  pastedContents: Record<number, StoredPastedContent>
  timestamp: number
  project: string
  sessionId?: string
}

function getPiConfigDir(): string {
  return join(homedir(), '.pi')
}

let pendingEntries: LogEntry[] = []
let isWriting = false
let currentFlushPromise: Promise<void> | null = null
let cleanupRegistered = false
let lastAddedEntry: LogEntry | null = null
const skippedTimestamps = new Set<number>()

async function immediateFlushHistory(): Promise<void> {
  if (pendingEntries.length === 0) return

  let release: (() => Promise<void>) | undefined
  try {
    const historyPath = join(getPiConfigDir(), 'history.jsonl')

    await writeFile(historyPath, '', {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'a',
    })

    release = await lock(historyPath, {
      stale: 10000,
      retries: { retries: 3, minTimeout: 50 },
    })

    const jsonLines = pendingEntries.map((entry) => JSON.stringify(entry) + '\n')
    pendingEntries = []

    await appendFile(historyPath, jsonLines.join(''), { mode: 0o600 })
  } catch {
    // non-critical
  } finally {
    if (release) await release()
  }
}

async function flushPromptHistory(retries: number): Promise<void> {
  if (isWriting || pendingEntries.length === 0) return
  if (retries > 5) return

  isWriting = true
  try {
    await immediateFlushHistory()
  } finally {
    isWriting = false
    if (pendingEntries.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      void flushPromptHistory(retries + 1)
    }
  }
}

async function addToPromptHistory(command: HistoryEntry | string): Promise<void> {
  const entry =
    typeof command === 'string'
      ? { display: command, pastedContents: {} as Record<number, PastedContent> }
      : command

  const storedPastedContents: Record<number, StoredPastedContent> = {}
  if (entry.pastedContents) {
    for (const [id, content] of Object.entries(entry.pastedContents)) {
      if (content.type === 'image') continue

      if (content.content.length <= MAX_PASTED_CONTENT_LENGTH) {
        storedPastedContents[Number(id)] = {
          id: content.id,
          type: content.type,
          content: content.content,
          mediaType: content.mediaType,
          filename: content.filename,
        }
      } else {
        const hash = hashPastedText(content.content)
        storedPastedContents[Number(id)] = {
          id: content.id,
          type: content.type,
          contentHash: hash,
          mediaType: content.mediaType,
          filename: content.filename,
        }
        void storePastedText(hash, content.content)
      }
    }
  }

  const logEntry: LogEntry = {
    display: entry.display,
    pastedContents: storedPastedContents,
    timestamp: Date.now(),
    project: getProjectRoot(),
    sessionId: getSessionId(),
  }

  pendingEntries.push(logEntry)
  lastAddedEntry = logEntry
  currentFlushPromise = flushPromptHistory(0)
  void currentFlushPromise
}

export function addToHistory(command: HistoryEntry | string): void {
  if (!cleanupRegistered) {
    cleanupRegistered = true
    registerCleanup(async () => {
      if (currentFlushPromise) await currentFlushPromise
      if (pendingEntries.length > 0) await immediateFlushHistory()
    })
  }
  void addToPromptHistory(command)
}

export function removeLastFromHistory(): void {
  if (!lastAddedEntry) return
  const entry = lastAddedEntry
  lastAddedEntry = null

  const idx = pendingEntries.lastIndexOf(entry)
  if (idx !== -1) {
    pendingEntries.splice(idx, 1)
  } else {
    skippedTimestamps.add(entry.timestamp)
  }
}

export function clearPendingHistoryEntries(): void {
  pendingEntries = []
  lastAddedEntry = null
  skippedTimestamps.clear()
}

function deserializeLogEntry(line: string): LogEntry {
  return JSON.parse(line) as LogEntry
}

async function resolveStoredPastedContent(
  stored: StoredPastedContent,
): Promise<PastedContent | null> {
  if (stored.content) {
    return {
      id: stored.id,
      type: stored.type,
      content: stored.content,
      mediaType: stored.mediaType,
      filename: stored.filename,
    }
  }
  if (stored.contentHash) {
    const content = await retrievePastedText(stored.contentHash)
    if (content) {
      return {
        id: stored.id,
        type: stored.type,
        content,
        mediaType: stored.mediaType,
        filename: stored.filename,
      }
    }
  }
  return null
}

async function logEntryToHistoryEntry(entry: LogEntry): Promise<HistoryEntry> {
  const pastedContents: Record<number, PastedContent> = {}
  for (const [id, stored] of Object.entries(entry.pastedContents || {})) {
    const resolved = await resolveStoredPastedContent(stored)
    if (resolved) pastedContents[Number(id)] = resolved
  }
  return { display: entry.display, pastedContents }
}

async function* makeLogEntryReader(): AsyncGenerator<LogEntry> {
  const currentSession = getSessionId()

  for (let i = pendingEntries.length - 1; i >= 0; i--) {
    yield pendingEntries[i]!
  }

  const historyPath = join(getPiConfigDir(), 'history.jsonl')
  try {
    for await (const line of readLinesReverse(historyPath)) {
      try {
        const entry = deserializeLogEntry(line)
        if (
          entry.sessionId === currentSession &&
          skippedTimestamps.has(entry.timestamp)
        ) {
          continue
        }
        yield entry
      } catch {
        // skip malformed lines
      }
    }
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code === 'ENOENT') return
    throw e
  }
}

export async function* makeHistoryReader(): AsyncGenerator<HistoryEntry> {
  for await (const entry of makeLogEntryReader()) {
    yield await logEntryToHistoryEntry(entry)
  }
}

export async function* getHistory(): AsyncGenerator<HistoryEntry> {
  const currentProject = getProjectRoot()
  const currentSession = getSessionId()
  const otherSessionEntries: LogEntry[] = []
  let yielded = 0

  for await (const entry of makeLogEntryReader()) {
    if (!entry || typeof entry.project !== 'string') continue
    if (entry.project !== currentProject) continue

    if (entry.sessionId === currentSession) {
      yield await logEntryToHistoryEntry(entry)
      yielded++
    } else {
      otherSessionEntries.push(entry)
    }

    if (yielded + otherSessionEntries.length >= MAX_HISTORY_ITEMS) break
  }

  for (const entry of otherSessionEntries) {
    if (yielded >= MAX_HISTORY_ITEMS) return
    yield await logEntryToHistoryEntry(entry)
    yielded++
  }
}

export type TimestampedHistoryEntry = {
  display: string
  timestamp: number
  resolve: () => Promise<HistoryEntry>
}

export async function* getTimestampedHistory(): AsyncGenerator<TimestampedHistoryEntry> {
  const currentProject = getProjectRoot()
  const seen = new Set<string>()

  for await (const entry of makeLogEntryReader()) {
    if (!entry || typeof entry.project !== 'string') continue
    if (entry.project !== currentProject) continue
    if (seen.has(entry.display)) continue
    seen.add(entry.display)

    yield {
      display: entry.display,
      timestamp: entry.timestamp,
      resolve: () => logEntryToHistoryEntry(entry),
    }

    if (seen.size >= MAX_HISTORY_ITEMS) return
  }
}
