# Harness Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two system-level logging modules — Debug log (always-on text file) and Harness diagnostics log (PII-free JSONL) — and instrument executor, cli, and REPL to emit events.

**Architecture:** Two independent utility modules (`debug.ts`, `diagLogs.ts`) with no cross-dependency. `debug.ts` writes async text to `~/.pi/debug/{sessionId}.txt` with a `latest` symlink. `diagLogs.ts` writes sync JSONL to `~/.pi/diagnostics/{sessionId}.jsonl` (overridable via `PI_DIAGNOSTICS_FILE`). Both are instrumented at: hook executor (command hooks), CLI entrypoint, and REPL lifecycle events.

**Tech Stack:** Node.js `fs/promises` + `fs` sync, `os.homedir()`, existing `registerCleanup` and `getSessionId` utilities.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/debug.ts` | Create | Async text debug logger, symlink, cleanup |
| `src/utils/diagLogs.ts` | Create | Sync JSONL harness diagnostics logger |
| `src/hooks/executor.ts` | Modify | Log command hook start/complete/fail/timeout |
| `src/entrypoints/cli.tsx` | Modify | Emit `cli_entry` on startup |
| `src/screens/REPL.tsx` | Modify | Emit compact, session_end, streaming_idle_warning |

---

### Task 1: Create `src/utils/debug.ts`

**Files:**
- Create: `src/utils/debug.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/debug.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, appendFileSync } from 'fs'
import { symlink, unlink } from 'fs/promises'

// Mock fs modules before importing debug.ts
vi.mock('fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  symlink: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/cleanupRegistry.js', () => ({
  registerCleanup: vi.fn(),
}))

vi.mock('../../tasks/sessionId.js', () => ({
  getSessionId: vi.fn().mockReturnValue('test-session-123'),
}))

describe('debug logger', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('logForDebugging writes formatted line to debug file', async () => {
    const { logForDebugging } = await import('../debug.js')
    const { appendFile } = await import('fs/promises')

    logForDebugging('hello world')

    // Wait for async write
    await new Promise(r => setTimeout(r, 10))

    expect(appendFile).toHaveBeenCalledWith(
      expect.stringContaining('test-session-123.txt'),
      expect.stringMatching(/\d{4}-\d{2}-\d{2}T.*\[DEBUG\] hello world\n/),
      'utf-8',
    )
  })

  it('getDebugLogPath returns path with sessionId', async () => {
    const { getDebugLogPath } = await import('../debug.js')
    expect(getDebugLogPath()).toContain('test-session-123.txt')
    expect(getDebugLogPath()).toContain('.pi/debug')
  })

  it('logForDebugging respects level in output', async () => {
    const { logForDebugging } = await import('../debug.js')
    const { appendFile } = await import('fs/promises')
    vi.mocked(appendFile).mockClear()

    logForDebugging('warn message', { level: 'warn' })
    await new Promise(r => setTimeout(r, 10))

    expect(appendFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('[WARN]'),
      'utf-8',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm test src/utils/__tests__/debug.test.ts 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../debug.js'"

- [ ] **Step 3: Implement `src/utils/debug.ts`**

```ts
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

  pendingWrite = pendingWrite.then(async () => {
    await ensureDirAndSymlink(logPath)
    await appendFile(logPath, line, 'utf-8')
  }).catch(() => {})
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test src/utils/__tests__/debug.test.ts 2>&1 | tail -10
```

Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/utils/debug.ts src/utils/__tests__/debug.test.ts
git commit -m "feat(harness): add debug logger (always-on text log to ~/.pi/debug/)"
```

---

### Task 2: Create `src/utils/diagLogs.ts`

**Files:**
- Create: `src/utils/diagLogs.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/diagLogs.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('fs', () => ({
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

vi.mock('../../tasks/sessionId.js', () => ({
  getSessionId: vi.fn().mockReturnValue('test-session-456'),
}))

describe('diagLogs', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.PI_DIAGNOSTICS_FILE
  })

  it('logForDiagnosticsNoPII writes JSONL to default path', async () => {
    const { logForDiagnosticsNoPII } = await import('../diagLogs.js')
    const fs = await import('fs')

    logForDiagnosticsNoPII('info', 'cli_entry')

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('test-session-456.jsonl'),
      expect.stringMatching(/"event":"cli_entry"/),
    )
  })

  it('uses PI_DIAGNOSTICS_FILE env var when set', async () => {
    process.env.PI_DIAGNOSTICS_FILE = '/tmp/test-diag.jsonl'
    const { logForDiagnosticsNoPII } = await import('../diagLogs.js')
    const fs = await import('fs')

    logForDiagnosticsNoPII('info', 'test_event')

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      '/tmp/test-diag.jsonl',
      expect.any(String),
    )
  })

  it('withDiagnosticsTiming logs started and completed events', async () => {
    const { withDiagnosticsTiming } = await import('../diagLogs.js')
    const fs = await import('fs')
    vi.mocked(fs.appendFileSync).mockClear()

    const result = await withDiagnosticsTiming('test_op', async () => 42)

    expect(result).toBe(42)
    const calls = vi.mocked(fs.appendFileSync).mock.calls.map(c => c[1] as string)
    expect(calls.some(c => c.includes('test_op_started'))).toBe(true)
    expect(calls.some(c => c.includes('test_op_completed'))).toBe(true)
    expect(calls.some(c => c.includes('duration_ms'))).toBe(true)
  })

  it('withDiagnosticsTiming logs failed on error', async () => {
    const { withDiagnosticsTiming } = await import('../diagLogs.js')
    const fs = await import('fs')
    vi.mocked(fs.appendFileSync).mockClear()

    await expect(
      withDiagnosticsTiming('fail_op', async () => { throw new Error('oops') })
    ).rejects.toThrow('oops')

    const calls = vi.mocked(fs.appendFileSync).mock.calls.map(c => c[1] as string)
    expect(calls.some(c => c.includes('fail_op_failed'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/utils/__tests__/diagLogs.test.ts 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../diagLogs.js'"

- [ ] **Step 3: Implement `src/utils/diagLogs.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test src/utils/__tests__/diagLogs.test.ts 2>&1 | tail -10
```

Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/utils/diagLogs.ts src/utils/__tests__/diagLogs.test.ts
git commit -m "feat(harness): add diagnostics logger (PII-free JSONL to ~/.pi/diagnostics/)"
```

---

### Task 3: Instrument `src/hooks/executor.ts`

**Files:**
- Modify: `src/hooks/executor.ts`

Command hooks get full logging (both debug + diag). Function hooks get debug-only (no exit code, no stdout).

- [ ] **Step 1: Add imports to executor.ts**

Add at the top of `src/hooks/executor.ts` after existing imports:

```ts
import { logForDebugging } from '../utils/debug.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'
```

- [ ] **Step 2: Instrument function hook execution**

In `executeHookSafely`, find the `hook.type === 'function'` branch and add debug logging:

```ts
if (hook.type === 'function') {
  logForDebugging(`hook ${input.hook_event_name} fn called`)
  return await withTimeout(
    {
      promise: Promise.resolve(hook.callback(input) as unknown as HookResult | undefined),
    },
    toMilliseconds(hook.timeout ?? 60),
  )
}
```

- [ ] **Step 3: Instrument command hook execution**

Replace the `hook.type === 'command'` sync branch in `executeHookSafely`:

```ts
if (hook.type === 'command') {
  const hookName = input.hook_event_name
  const startTs = Date.now()
  logForDebugging(`hook ${hookName} started (command)`)
  logForDiagnosticsNoPII('info', 'hook_started', { hook: hookName, type: 'command' })

  if (hook.async) {
    executeCommandHookDetached(hook, input, signal)
    return undefined
  }

  try {
    const result = await withTimeout(
      executeCommandHook(hook, input, signal),
      toMilliseconds(hook.timeout ?? 60),
    )
    const duration_ms = Date.now() - startTs
    const outcome = result?.outcome ?? 'success'
    logForDebugging(`hook ${hookName} completed outcome=${outcome} duration=${duration_ms}ms`)
    logForDiagnosticsNoPII('info', 'hook_completed', { hook: hookName, duration_ms, outcome })
    return result
  } catch (err) {
    const duration_ms = Date.now() - startTs
    const isTimeout = err instanceof Error && err.message.includes('timed out')
    if (isTimeout) {
      logForDebugging(`hook ${hookName} timed out after ${duration_ms}ms`, { level: 'warn' })
      logForDiagnosticsNoPII('warn', 'hook_failed', { hook: hookName, duration_ms, reason: 'timeout' })
    } else {
      logForDebugging(`hook ${hookName} error: ${err instanceof Error ? err.message : String(err)}`, { level: 'error' })
      logForDiagnosticsNoPII('error', 'hook_failed', { hook: hookName, duration_ms })
    }
    return undefined
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/hooks/executor.ts
git commit -m "feat(harness): instrument hook executor with debug + diagnostics logging"
```

---

### Task 4: Instrument `src/entrypoints/cli.tsx`

**Files:**
- Modify: `src/entrypoints/cli.tsx`

- [ ] **Step 1: Add imports**

Add after existing imports in `src/entrypoints/cli.tsx`:

```ts
import { logForDebugging } from '../utils/debug.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'
```

- [ ] **Step 2: Emit cli_entry after loadEnv()**

In the `main()` function, add right after `loadEnv()`:

```ts
async function main() {
  loadEnv()

  logForDebugging(`pi started pid=${process.pid}`)
  logForDiagnosticsNoPII('info', 'cli_entry', { pid: process.pid })

  const args = process.argv.slice(2)
  // ... rest unchanged
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/cli.tsx
git commit -m "feat(harness): emit cli_entry event on startup"
```

---

### Task 5: Instrument `src/screens/REPL.tsx`

**Files:**
- Modify: `src/screens/REPL.tsx`

Three events: compact triggered, session ended, streaming idle warning.

- [ ] **Step 1: Add imports**

Add to existing imports in `src/screens/REPL.tsx`:

```ts
import { logForDebugging } from '../utils/debug.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'
```

- [ ] **Step 2: Emit compact_triggered**

In `handleSubmit`, find the `/compact` branch. After `history.appendUserMessage('/compact')` and before `setIsLoading(true)`, add:

```ts
logForDebugging('compact triggered')
logForDiagnosticsNoPII('info', 'compact_triggered')
```

- [ ] **Step 3: Emit session_end**

In `doExit`, add before `process.exit(0)`:

```ts
logForDebugging('session ended reason=exit_command')
logForDiagnosticsNoPII('info', 'session_end', { reason: 'exit_command' })
```

In the `/clear` handler (session reset), add after `sessionIdRef.current = randomUUID()`:

```ts
logForDebugging('session ended reason=clear')
logForDiagnosticsNoPII('info', 'session_end', { reason: 'clear' })
```

- [ ] **Step 4: Emit streaming_idle_warning**

In REPL.tsx, add a ref for stream start time. Find where the query `gen` is iterated (`for await (const event of gen)`). Add timing around the loop:

Add ref near other refs at top of REPL component:
```ts
const streamStartTsRef = useRef<number>(0)
const streamIdleWarningFiredRef = useRef(false)
```

When query starts (just before `for await`):
```ts
streamStartTsRef.current = Date.now()
streamIdleWarningFiredRef.current = false
```

Inside the `for await` loop, at the top of each iteration:
```ts
const now = Date.now()
if (!streamIdleWarningFiredRef.current && now - streamStartTsRef.current > 30_000) {
  streamIdleWarningFiredRef.current = true
  const duration_ms = now - streamStartTsRef.current
  logForDebugging(`streaming idle ${duration_ms}ms`, { level: 'warn' })
  logForDiagnosticsNoPII('warn', 'streaming_idle_warning', { duration_ms })
}
// reset timer on each received event
streamStartTsRef.current = now
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: exit 0

- [ ] **Step 6: Run all tests**

```bash
npm test 2>&1 | grep "Test Files"
```

Expected: same pass count as before (no regressions)

- [ ] **Step 7: Commit**

```bash
git add src/screens/REPL.tsx
git commit -m "feat(harness): emit compact, session_end, streaming_idle_warning events"
```
