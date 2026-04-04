# Task File Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade pi's task system from in-memory Map to file-per-task persistence (`~/.claude/tasks/{sessionId}/{id}.json`), so task data survives process restarts.

**Architecture:** File storage is the source of truth; AppState (`tasks` Map + `nextTaskId`) is a read cache loaded on startup. Every write goes to file first (under `proper-lockfile`), then updates AppState — if the file write fails, AppState is not updated.

**Tech Stack:** Node.js `fs/promises`, `proper-lockfile` (file locking), `crypto.randomUUID` (session ID), TypeScript ESM

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/tasks/sessionId.ts` | Module-level UUID singleton for session isolation |
| Create | `src/tasks/taskFileStore.ts` | `initTaskStore`, `createTaskFile`, `updateTaskFile` |
| Modify | `package.json` | Add `proper-lockfile` + `@types/proper-lockfile` |
| Modify | `src/query.ts` | Call `initTaskStore()` at loop start |
| Modify | `src/tools/TaskCreateTool/TaskCreateTool.tsx` | Replace `setAppState` closure with `createTaskFile` |
| Modify | `src/tools/TaskUpdateTool/TaskUpdateTool.tsx` | Replace `setAppState` closure with `updateTaskFile` |
| Modify | `src/tools/TaskStopTool/TaskStopTool.tsx` | Replace `setAppState` closure with `updateTaskFile` |

---

## Task 1: Install proper-lockfile

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /path/to/pi-claude-code
npm install proper-lockfile
npm install -D @types/proper-lockfile
```

- [ ] **Step 2: Verify package.json updated**

`package.json` should now contain:
```json
"dependencies": {
  "proper-lockfile": "^4.1.2",
  ...
}
```

- [ ] **Step 3: Typecheck passes**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add proper-lockfile for task file locking"
```

---

## Task 2: Create sessionId.ts

**Files:**
- Create: `src/tasks/sessionId.ts`

- [ ] **Step 1: Create the file**

`src/tasks/sessionId.ts`:

```typescript
import { randomUUID } from 'crypto'

let _sessionId: string | undefined

export function getSessionId(): string {
  if (!_sessionId) _sessionId = randomUUID()
  return _sessionId
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/tasks/sessionId.ts
git commit -m "feat: add session ID singleton for task directory isolation"
```

---

## Task 3: Create taskFileStore.ts

**Files:**
- Create: `src/tasks/taskFileStore.ts`

This is the core file. Read `src/tasks/types.ts` (for `Task` type), `src/state/AppState.ts` (for `getAppState`/`setAppState`), and `src/Tool.tsx` (for `ToolUseContext`) before implementing.

- [ ] **Step 1: Create the file**

`src/tasks/taskFileStore.ts`:

```typescript
import { mkdir, writeFile, readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import lockfile from 'proper-lockfile'
import { getSessionId } from './sessionId.js'
import { getAppState, setAppState } from '../state/AppState.js'
import type { Task } from './types.js'
import type { ToolUseContext } from '../Tool.js'

// ── Path helpers ──────────────────────────────────────────────────────────────

function getTaskDir(): string {
  return join(homedir(), '.claude', 'tasks', getSessionId())
}

function getTaskPath(id: number): string {
  return join(getTaskDir(), `${id}.json`)
}

/** proper-lockfile requires the lock target to be an existing file */
function getLockPath(): string {
  return join(getTaskDir(), '.lock')
}

// ── initTaskStore ─────────────────────────────────────────────────────────────

/**
 * Initialize: create session directory, ensure .lock file exists,
 * load all task JSON files into AppState.
 *
 * Idempotent: if AppState already has tasks, skip loading.
 * Call once at the start of query() before toolUseContext is constructed.
 */
export async function initTaskStore(): Promise<void> {
  const dir = getTaskDir()
  await mkdir(dir, { recursive: true })

  // Ensure .lock file exists (proper-lockfile requires target to pre-exist)
  try {
    await writeFile(getLockPath(), '', { flag: 'wx' })
  } catch {
    // Already exists — fine
  }

  // Idempotent: skip if tasks already loaded
  if (getAppState().tasks.size > 0) return

  // Load task files
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

// ── createTaskFile ────────────────────────────────────────────────────────────

/**
 * Create a new task: write file (under lock), then update AppState.
 * ID is taken from getAppState().nextTaskId.
 * Throws with a user-readable message on lock failure.
 */
export async function createTaskFile(
  data: Omit<Task, 'id'>,
  context: ToolUseContext,
): Promise<Task> {
  const lockPath = getLockPath()

  let release: (() => Promise<void>) | undefined
  try {
    release = await lockfile.lock(lockPath, {
      retries: { retries: 3, minTimeout: 50 },
      stale: 10000,
    })
  } catch {
    throw new Error('Failed to acquire task lock, please retry')
  }

  try {
    const id = context.getAppState().nextTaskId
    const task: Task = { id, ...data }

    await writeFile(getTaskPath(id), JSON.stringify(task, null, 2), 'utf-8')

    context.setAppState((prev) => ({
      ...prev,
      nextTaskId: prev.nextTaskId + 1,
      tasks: new Map(prev.tasks).set(id, task) as ReadonlyMap<number, Task>,
    }))

    return task
  } finally {
    await release()
  }
}

// ── updateTaskFile ────────────────────────────────────────────────────────────

/**
 * Update an existing task: write file (under lock), then update AppState.
 * Returns null without touching the file if the task ID does not exist in AppState.
 * Throws with a user-readable message on lock failure.
 */
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
    release = await lockfile.lock(lockPath, {
      retries: { retries: 3, minTimeout: 50 },
      stale: 10000,
    })
  } catch {
    throw new Error('Failed to acquire task lock, please retry')
  }

  try {
    const updated: Task = { ...existing, ...updates }

    await writeFile(getTaskPath(id), JSON.stringify(updated, null, 2), 'utf-8')

    context.setAppState((prev) => ({
      ...prev,
      tasks: new Map(prev.tasks).set(id, updated) as ReadonlyMap<number, Task>,
    }))

    return updated
  } finally {
    await release()
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors. If you see "Cannot find module 'proper-lockfile'" errors, run `npm install` first.

- [ ] **Step 3: Commit**

```bash
git add src/tasks/taskFileStore.ts
git commit -m "feat: add taskFileStore with file-per-task persistence and proper-lockfile"
```

---

## Task 4: Wire initTaskStore into query.ts

**Files:**
- Modify: `src/query.ts` (lines 1–10, the import section, and line ~215, start of `query()`)

Read `src/query.ts` before editing. The change is two lines: one import and one `await initTaskStore()` call.

- [ ] **Step 1: Add import at top of query.ts**

After the existing imports (around line 10), add:

```typescript
import { initTaskStore } from './tasks/taskFileStore.js'
```

- [ ] **Step 2: Call initTaskStore at the start of query()**

Inside the `query()` function, before the `toolUseContext` construction (before the line `const toolUseContext: ToolUseContext = {`), add:

```typescript
await initTaskStore()
```

The result should look like:

```typescript
export async function* query(params: QueryParams): AsyncGenerator<StreamEvent> {
  const { ... } = params

  await initTaskStore()

  // ToolUseContext 在整个 query 生命周期内复用
  const toolUseContext: ToolUseContext = {
    ...
  }
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/query.ts
git commit -m "feat: call initTaskStore at query() start for task file persistence"
```

---

## Task 5: Migrate TaskCreateTool

**Files:**
- Modify: `src/tools/TaskCreateTool/TaskCreateTool.tsx`

Read the current file first. The `call()` method currently uses a `setAppState` closure. Replace it entirely with `createTaskFile`.

- [ ] **Step 1: Add import**

Replace the current import block at the top of `TaskCreateTool.tsx`. Remove `import type { Task } from '../../tasks/types.js'` and add:

```typescript
import { createTaskFile } from '../../tasks/taskFileStore.js'
```

The full import block should be:

```typescript
import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskCreateToolUseUI, TaskCreateToolResultUI } from './UI.js'
import { createTaskFile } from '../../tasks/taskFileStore.js'
```

- [ ] **Step 2: Replace call() method**

Replace the entire `async call(input, context)` method with:

```typescript
async call(input, context) {
  const { subject, description, activeForm, blockedBy } = input as {
    subject: string
    description?: string
    activeForm?: string
    blockedBy?: number[]
  }
  const now = new Date().toISOString()
  try {
    const task = await createTaskFile(
      {
        subject,
        description,
        activeForm,
        status: 'pending',
        blockedBy: blockedBy ?? [],
        owner: undefined,
        createdAt: now,
        updatedAt: now,
      },
      context,
    )
    return JSON.stringify(task)
  } catch (err) {
    return `ERROR: ${err instanceof Error ? err.message : String(err)}`
  }
},
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/tools/TaskCreateTool/TaskCreateTool.tsx
git commit -m "feat: TaskCreateTool uses createTaskFile for persistence"
```

---

## Task 6: Migrate TaskUpdateTool and TaskStopTool

**Files:**
- Modify: `src/tools/TaskUpdateTool/TaskUpdateTool.tsx`
- Modify: `src/tools/TaskStopTool/TaskStopTool.tsx`

Read both files first.

### TaskUpdateTool

- [ ] **Step 1: Add import to TaskUpdateTool.tsx**

Replace:
```typescript
import type { Task, TaskStatus } from '../../tasks/types.js'
```
With:
```typescript
import type { Task, TaskStatus } from '../../tasks/types.js'
import { updateTaskFile } from '../../tasks/taskFileStore.js'
```

- [ ] **Step 2: Replace call() in TaskUpdateTool.tsx**

Replace the entire `async call(input, context)` method with:

```typescript
async call(input, context) {
  const { id, status, owner, output, description } = input as {
    id: number
    status?: TaskStatus
    owner?: string
    output?: string
    description?: string
  }
  const now = new Date().toISOString()
  const updates: Partial<Omit<Task, 'id'>> = { updatedAt: now }
  if (status !== undefined) updates.status = status
  if (owner !== undefined) updates.owner = owner
  if (output !== undefined) updates.output = output
  if (description !== undefined) updates.description = description

  try {
    const updated = await updateTaskFile(id, updates, context)
    if (!updated) return `ERROR: Task ${id} not found.`
    return JSON.stringify(updated)
  } catch (err) {
    return `ERROR: ${err instanceof Error ? err.message : String(err)}`
  }
},
```

### TaskStopTool

- [ ] **Step 3: Add import to TaskStopTool.tsx**

Replace:
```typescript
import type { Task } from '../../tasks/types.js'
```
With:
```typescript
import { updateTaskFile } from '../../tasks/taskFileStore.js'
```

- [ ] **Step 4: Replace call() in TaskStopTool.tsx**

Replace the entire `async call(input, context)` method with:

```typescript
async call(input, context) {
  const { id } = input as { id: number }
  const task = context.getAppState().tasks.get(id)
  if (!task) return `ERROR: Task ${id} not found.`
  if (task.status === 'stopped' || task.status === 'completed') {
    return `ERROR: Task ${id} is already ${task.status}.`
  }

  try {
    await updateTaskFile(id, { status: 'stopped', updatedAt: new Date().toISOString() }, context)
    return 'Task stopped.'
  } catch (err) {
    return `ERROR: ${err instanceof Error ? err.message : String(err)}`
  }
},
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/tools/TaskUpdateTool/TaskUpdateTool.tsx src/tools/TaskStopTool/TaskStopTool.tsx
git commit -m "feat: TaskUpdateTool and TaskStopTool use updateTaskFile for persistence"
```

---

## Task 7: Smoke Test

Manual verification that task files are actually written to disk.

- [ ] **Step 1: Start pi in dev mode**

```bash
npm run dev
```

- [ ] **Step 2: In pi, ask it to create a task**

Type something like:
```
task_create でタスクを作って: subject "test task"
```

Or if pi has a direct way to invoke tools, use `task_create` directly.

- [ ] **Step 3: Check the file was created**

In a separate terminal:
```bash
ls ~/.claude/tasks/
# Should show a UUID directory, e.g.:
# 550e8400-e29b-41d4-a716-446655440000/

ls ~/.claude/tasks/*/
# Should show:
# 1.json
# .lock

cat ~/.claude/tasks/*/1.json
# Should show:
# {
#   "id": 1,
#   "subject": "test task",
#   "status": "pending",
#   ...
# }
```

Expected: the JSON file exists with correct task data.

- [ ] **Step 4: Restart pi and verify task is reloaded**

Exit pi (Ctrl+C), restart with `npm run dev`, then call `task_list`.
Expected: task 1 is still listed (loaded from file).

- [ ] **Step 5: Commit if any final cleanup needed**

```bash
git add -p
git commit -m "chore: task persistence smoke test verified"
```
