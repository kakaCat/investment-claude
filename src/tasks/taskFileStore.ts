import { mkdir, writeFile, readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import lockfile from 'proper-lockfile'
import { getSessionId } from './sessionId.js'
import { getAppState, setAppState } from '../state/AppState.js'
import type { Task } from './types.js'
import type { ToolUseContext } from '../Tool.js'

function getTaskDir(): string {
  return join(homedir(), '.claude', 'tasks', getSessionId())
}

function getTaskPath(id: number): string {
  return join(getTaskDir(), `${id}.json`)
}

function getLockPath(): string {
  return join(getTaskDir(), '.lock')
}

const LOCK_OPTIONS = {
  retries: { retries: 3, minTimeout: 50 },
  stale: 10000,
  realpath: false, // path is already absolute; avoids ENOENT if .lock is deleted externally
} as const

let _initialized = false

export async function initTaskStore(): Promise<void> {
  if (_initialized) return
  _initialized = true

  const dir = getTaskDir()
  await mkdir(dir, { recursive: true })

  try {
    await writeFile(getLockPath(), '', { flag: 'wx' })
  } catch {
    // Already exists
  }

  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return
  }

  const taskFiles = files.filter((f) => /^\d+\.json$/.test(f))
  const tasks = new Map<number, Task>()
  let maxId = 0

  for (const file of taskFiles) {
    try {
      const content = await readFile(join(dir, file), 'utf-8')
      const task: Task = JSON.parse(content)
      tasks.set(task.id, task)
      if (task.id > maxId) maxId = task.id
    } catch {
      console.warn(`[taskFileStore] Warning: failed to parse ${file}, skipping`)
    }
  }

  if (tasks.size === 0) return

  setAppState((prev) => ({
    ...prev,
    tasks: tasks as ReadonlyMap<number, Task>,
    nextTaskId: Math.max(prev.nextTaskId, maxId + 1),
  }))
}

export async function createTaskFile(
  data: Omit<Task, 'id'>,
  context: ToolUseContext,
): Promise<Task> {
  const lockPath = getLockPath()

  let release: (() => Promise<void>) | undefined
  try {
    release = await lockfile.lock(lockPath, LOCK_OPTIONS)
  } catch {
    throw new Error('Failed to acquire task lock, please retry')
  }

  try {
    const id = context.getAppState().nextTaskId
    const task: Task = { id, ...data }

    try {
      await writeFile(getTaskPath(id), JSON.stringify(task, null, 2), 'utf-8')
    } catch (err) {
      throw new Error(`Failed to write task file: ${err instanceof Error ? err.message : String(err)}`)
    }

    context.setAppState((prev) => ({
      ...prev,
      nextTaskId: prev.nextTaskId + 1,
      tasks: new Map(prev.tasks).set(id, task) as ReadonlyMap<number, Task>,
    }))

    return task
  } finally {
    await release!()
  }
}

export async function updateTaskFile(
  id: number,
  updates: Partial<Omit<Task, 'id'>>,
  context: ToolUseContext,
): Promise<Task | null> {
  const existing = context.getAppState().tasks.get(id)
  if (!existing) return null

  const lockPath = getLockPath()

  let release: (() => Promise<void>) | undefined
  try {
    release = await lockfile.lock(lockPath, LOCK_OPTIONS)
  } catch {
    throw new Error('Failed to acquire task lock, please retry')
  }

  try {
    const updated: Task = { ...existing, ...updates }

    try {
      await writeFile(getTaskPath(id), JSON.stringify(updated, null, 2), 'utf-8')
    } catch (err) {
      throw new Error(`Failed to write task file: ${err instanceof Error ? err.message : String(err)}`)
    }

    context.setAppState((prev) => ({
      ...prev,
      tasks: new Map(prev.tasks).set(id, updated) as ReadonlyMap<number, Task>,
    }))

    return updated
  } finally {
    await release!()
  }
}
