# Observability — Session Trace & HTML Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a session observability system that records every Pi session to a JSONL file and generates a self-contained HTML report on session end.

**Architecture:** Four new files under `src/observability/` handle logging, token counting, HTML generation, and hook registration. All hooks are registered once via `initObservability()` which is called in `REPL.tsx` alongside `initSessionMemory()`. The system is completely passive — all errors are silently ignored so it cannot interfere with agent execution.

**Tech Stack:** TypeScript, Node.js `fs/promises`, vitest, existing `roughTokenCount` utility, existing FunctionHook registration API.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/observability/logger.ts` | Create | Append JSONL events to `.pi/logs/session-<id>.jsonl` |
| `src/observability/tokenCount.ts` | Create | Estimate input/output tokens per turn |
| `src/observability/htmlReport.ts` | Create | Parse JSONL → generate self-contained HTML |
| `src/observability/index.ts` | Create | `initObservability()` — register all FunctionHooks |
| `src/observability/__tests__/logger.test.ts` | Create | Unit tests for logger |
| `src/observability/__tests__/tokenCount.test.ts` | Create | Unit tests for tokenCount |
| `src/observability/__tests__/htmlReport.test.ts` | Create | Smoke test for HTML generation |
| `src/screens/REPL.tsx` | Modify | Call `initObservability()` alongside `initSessionMemory()` |
| `.gitignore` | Modify | Add `.pi/` entry |

---

## Task 1: logger.ts — JSONL event writer

**Files:**
- Create: `src/observability/logger.ts`
- Test: `src/observability/__tests__/logger.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/observability/__tests__/logger.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { initLogger, appendEvent, getLogFilePath, getHtmlFilePath, resetLogger } from '../logger.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'obs-test-'))
  resetLogger()
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
  resetLogger()
})

describe('initLogger', () => {
  it('sets log and html file paths', () => {
    initLogger('sess-1', tmpDir)
    expect(getLogFilePath()).toBe(join(tmpDir, '.pi', 'logs', 'session-sess-1.jsonl'))
    expect(getHtmlFilePath()).toBe(join(tmpDir, '.pi', 'logs', 'session-sess-1.html'))
  })
})

describe('appendEvent', () => {
  it('writes a valid JSON line to the log file', async () => {
    initLogger('sess-2', tmpDir)
    await appendEvent({ event: 'test', value: 42 })
    const content = await readFile(getLogFilePath()!, 'utf-8')
    const parsed = JSON.parse(content.trim())
    expect(parsed.event).toBe('test')
    expect(parsed.value).toBe(42)
  })

  it('appends multiple events as separate lines', async () => {
    initLogger('sess-3', tmpDir)
    await appendEvent({ event: 'a' })
    await appendEvent({ event: 'b' })
    const content = await readFile(getLogFilePath()!, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).event).toBe('a')
    expect(JSON.parse(lines[1]).event).toBe('b')
  })

  it('is a no-op when logger is not initialized', async () => {
    // Should not throw
    await expect(appendEvent({ event: 'x' })).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx vitest run src/observability/__tests__/logger.test.ts
```

Expected: FAIL — "Cannot find module '../logger.js'"

- [ ] **Step 3: Create `src/observability/logger.ts`**

```ts
import { appendFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

let logFilePath: string | null = null

export function initLogger(sessionId: string, cwd: string): void {
  const logsDir = join(cwd, '.pi', 'logs')
  logFilePath = join(logsDir, `session-${sessionId}.jsonl`)
  mkdir(logsDir, { recursive: true }).catch(() => {})
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/observability/__tests__/logger.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/observability/logger.ts src/observability/__tests__/logger.test.ts
git commit -m "feat(observability): add JSONL event logger"
```

---

## Task 2: tokenCount.ts — per-turn token estimation

**Files:**
- Create: `src/observability/tokenCount.ts`
- Test: `src/observability/__tests__/tokenCount.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/observability/__tests__/tokenCount.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeTurnTokens, computeTotalTokens } from '../tokenCount.js'
import type { Message } from '../../types/message.js'

function makeUser(text: string): Message {
  return { type: 'user', content: [{ type: 'text', text }] }
}
function makeAssistant(text: string): Message {
  return { type: 'assistant', content: [{ type: 'text', text }] }
}

describe('computeTurnTokens', () => {
  it('returns empty array for empty messages', () => {
    expect(computeTurnTokens([])).toEqual([])
  })

  it('returns one entry per user message', () => {
    const msgs: Message[] = [
      makeUser('hello'),
      makeAssistant('world'),
      makeUser('again'),
      makeAssistant('ok'),
    ]
    const result = computeTurnTokens(msgs)
    expect(result).toHaveLength(2)
  })

  it('inputTokens grows with context across turns', () => {
    const msgs: Message[] = [
      makeUser('first'),
      makeAssistant('reply1'),
      makeUser('second'),
      makeAssistant('reply2'),
    ]
    const result = computeTurnTokens(msgs)
    expect(result[1].inputTokens).toBeGreaterThan(result[0].inputTokens)
  })

  it('skips compact_boundary messages', () => {
    const msgs: Message[] = [
      makeUser('hello'),
      { type: 'compact_boundary', trigger: 'auto', preCompactTokenCount: 1000 },
      makeAssistant('world'),
    ]
    const result = computeTurnTokens(msgs)
    expect(result).toHaveLength(1)
    expect(result[0].outputTokens).toBeGreaterThan(0)
  })
})

describe('computeTotalTokens', () => {
  it('returns 0 for empty array', () => {
    expect(computeTotalTokens([])).toBe(0)
  })

  it('returns last inputTokens + all outputTokens', () => {
    const turns = [
      { inputTokens: 100, outputTokens: 20 },
      { inputTokens: 200, outputTokens: 30 },
    ]
    // 200 + 20 + 30 = 250
    expect(computeTotalTokens(turns)).toBe(250)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/observability/__tests__/tokenCount.test.ts
```

Expected: FAIL — "Cannot find module '../tokenCount.js'"

- [ ] **Step 3: Create `src/observability/tokenCount.ts`**

```ts
import { roughTokenCount } from '../sessionMemory/utils.js'
import type { Message } from '../types/message.js'

export type TurnTokens = {
  inputTokens: number
  outputTokens: number
}

/**
 * Compute estimated input/output token counts for each turn.
 * A "turn" starts at each user message in the messages array.
 * compact_boundary messages are excluded from counting.
 */
export function computeTurnTokens(messages: Message[]): TurnTokens[] {
  const filtered = messages.filter((m): m is Exclude<Message, { type: 'compact_boundary' }> =>
    m.type !== 'compact_boundary',
  )

  const userIndices: number[] = []
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i].type === 'user') userIndices.push(i)
  }

  return userIndices.map((userIdx, turnIdx) => {
    // Input = everything up to and including this turn's user message
    const inputMsgs = filtered.slice(0, userIdx + 1)
    const inputTokens = roughTokenCount(inputMsgs as Message[])

    // Output = assistant message(s) before the next user message
    const nextUserIdx = userIndices[turnIdx + 1] ?? filtered.length
    const outputMsgs = filtered.slice(userIdx + 1, nextUserIdx).filter((m) => m.type === 'assistant')
    const outputTokens = roughTokenCount(outputMsgs as Message[])

    return { inputTokens, outputTokens }
  })
}

/**
 * Compute total session tokens.
 * = last turn's inputTokens (peak context sent to API) + all output tokens
 */
export function computeTotalTokens(turns: TurnTokens[]): number {
  if (turns.length === 0) return 0
  const lastInputTokens = turns[turns.length - 1].inputTokens
  const totalOutputTokens = turns.reduce((sum, t) => sum + t.outputTokens, 0)
  return lastInputTokens + totalOutputTokens
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/observability/__tests__/tokenCount.test.ts
```

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/observability/tokenCount.ts src/observability/__tests__/tokenCount.test.ts
git commit -m "feat(observability): add per-turn token estimation"
```

---

## Task 3: htmlReport.ts — JSONL → self-contained HTML

**Files:**
- Create: `src/observability/htmlReport.ts`
- Test: `src/observability/__tests__/htmlReport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/observability/__tests__/htmlReport.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { generateReport } from '../htmlReport.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'obs-html-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

function makeFixtureJsonl(): string {
  const events = [
    { event: 'session_start', session_id: 'test-123', cwd: '/proj', system_prompt: 'You are Pi.', ts: 1000 },
    { event: 'user_prompt', prompt: 'Write a sort function', ts: 1001 },
    { event: 'tool_call', tool: 'Read', input: '{"file_path":"src/utils.ts"}', ts: 1005 },
    { event: 'tool_result', tool: 'Read', result: 'export function...', duration_ms: 45, ts: 1050 },
    { event: 'tool_call', tool: 'Write', input: '{"file_path":"src/utils.ts"}', ts: 1060 },
    { event: 'tool_result', tool: 'Write', result: 'ok', duration_ms: 12, ts: 1072 },
    {
      event: 'session_end',
      stop_reason: 'done',
      messages: [
        { type: 'user', content: [{ type: 'text', text: 'Write a sort function' }] },
        { type: 'assistant', content: [{ type: 'text', text: 'Done! I added quickSort to src/utils.ts.' }] },
      ],
      ts: 1100,
    },
  ]
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n'
}

describe('generateReport', () => {
  it('creates an HTML file at the specified path', async () => {
    const jsonlPath = join(tmpDir, 'session-test-123.jsonl')
    const htmlPath = join(tmpDir, 'session-test-123.html')
    await writeFile(jsonlPath, makeFixtureJsonl(), 'utf-8')

    await generateReport(jsonlPath, htmlPath)

    const html = await readFile(htmlPath, 'utf-8')
    expect(html.length).toBeGreaterThan(1000)
  })

  it('includes session ID in the output', async () => {
    const jsonlPath = join(tmpDir, 'session.jsonl')
    const htmlPath = join(tmpDir, 'session.html')
    await writeFile(jsonlPath, makeFixtureJsonl(), 'utf-8')
    await generateReport(jsonlPath, htmlPath)
    const html = await readFile(htmlPath, 'utf-8')
    expect(html).toContain('test-123')
  })

  it('includes user prompt text in the output', async () => {
    const jsonlPath = join(tmpDir, 'session.jsonl')
    const htmlPath = join(tmpDir, 'session.html')
    await writeFile(jsonlPath, makeFixtureJsonl(), 'utf-8')
    await generateReport(jsonlPath, htmlPath)
    const html = await readFile(htmlPath, 'utf-8')
    expect(html).toContain('Write a sort function')
  })

  it('includes tool names in the output', async () => {
    const jsonlPath = join(tmpDir, 'session.jsonl')
    const htmlPath = join(tmpDir, 'session.html')
    await writeFile(jsonlPath, makeFixtureJsonl(), 'utf-8')
    await generateReport(jsonlPath, htmlPath)
    const html = await readFile(htmlPath, 'utf-8')
    expect(html).toContain('Read')
    expect(html).toContain('Write')
  })

  it('does not throw when JSONL path does not exist', async () => {
    const htmlPath = join(tmpDir, 'out.html')
    await expect(generateReport('/no/such/file.jsonl', htmlPath)).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/observability/__tests__/htmlReport.test.ts
```

Expected: FAIL — "Cannot find module '../htmlReport.js'"

- [ ] **Step 3: Create `src/observability/htmlReport.ts`**

```ts
import { readFile, writeFile } from 'fs/promises'
import { computeTurnTokens, computeTotalTokens, type TurnTokens } from './tokenCount.js'
import type { Message, AssistantMessage } from '../types/message.js'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToolCallLog = {
  tool: string
  input: string
  result?: string
  error?: string
  durationMs: number
  ts: number
}

type TurnData = {
  index: number
  userPrompt: string
  startTs: number
  endTs: number
  durationMs: number
  toolCalls: ToolCallLog[]
  inputTokens: number
  outputTokens: number
  isSlow: boolean
  thinkingText: string
  replyText: string
  // Serialized messages for LLM detail panel (JSON string for embedding in HTML)
  llmDetailJson: string
}

type SessionData = {
  sessionId: string
  cwd: string
  systemPrompt: string
  startTs: number
  endTs: number
  durationMs: number
  stopReason: string
  turns: TurnData[]
  totalTokens: number
  slowestTool: { name: string; durationMs: number; turnIdx: number } | null
  totalToolCalls: number
}

// ── JSONL parser ──────────────────────────────────────────────────────────────

function parseJsonlToSession(jsonl: string): SessionData {
  const lines = jsonl.trim().split('\n').filter(Boolean)
  const events: Record<string, unknown>[] = []
  for (const line of lines) {
    try { events.push(JSON.parse(line)) } catch { /* skip malformed */ }
  }

  let sessionId = 'unknown'
  let cwd = ''
  let systemPrompt = ''
  let startTs = 0
  let endTs = 0
  let stopReason = 'unknown'
  let allMessages: Message[] = []

  // Per-turn accumulation
  const turns: Omit<TurnData, 'inputTokens' | 'outputTokens' | 'isSlow' | 'thinkingText' | 'replyText' | 'llmDetailJson'>[] = []
  let currentTurn: typeof turns[0] | null = null
  let pendingToolCalls = new Map<string, number>() // tool -> startTs stack
  let globalSlowTool: SessionData['slowestTool'] = null

  for (const ev of events) {
    const ts = (ev.ts as number) ?? 0
    switch (ev.event) {
      case 'session_start':
        sessionId = (ev.session_id as string) ?? 'unknown'
        cwd = (ev.cwd as string) ?? ''
        systemPrompt = (ev.system_prompt as string) ?? ''
        startTs = ts
        break

      case 'user_prompt':
        if (currentTurn) {
          currentTurn.endTs = ts
          currentTurn.durationMs = ts - currentTurn.startTs
          turns.push(currentTurn)
        }
        currentTurn = {
          index: turns.length,
          userPrompt: (ev.prompt as string) ?? '',
          startTs: ts,
          endTs: ts,
          durationMs: 0,
          toolCalls: [],
        }
        break

      case 'tool_call': {
        const tool = (ev.tool as string) ?? ''
        pendingToolCalls.set(tool, ts)
        break
      }

      case 'tool_result': {
        const tool = (ev.tool as string) ?? ''
        const callStartTs = pendingToolCalls.get(tool) ?? ts
        pendingToolCalls.delete(tool)
        const dMs = (ev.duration_ms as number) ?? (ts - callStartTs)
        if (currentTurn) {
          const call: ToolCallLog = {
            tool,
            input: (ev.input as string) ?? '',
            result: (ev.result as string) ?? '',
            durationMs: dMs,
            ts,
          }
          currentTurn.toolCalls.push(call)
          if (!globalSlowTool || dMs > globalSlowTool.durationMs) {
            globalSlowTool = { name: tool, durationMs: dMs, turnIdx: currentTurn.index }
          }
        }
        break
      }

      case 'tool_error': {
        const tool = (ev.tool as string) ?? ''
        const callStartTs = pendingToolCalls.get(tool) ?? ts
        pendingToolCalls.delete(tool)
        const dMs = (ev.duration_ms as number) ?? (ts - callStartTs)
        if (currentTurn) {
          const call: ToolCallLog = {
            tool,
            input: (ev.input as string) ?? '',
            error: (ev.error as string) ?? '',
            durationMs: dMs,
            ts,
          }
          currentTurn.toolCalls.push(call)
          if (!globalSlowTool || dMs > globalSlowTool.durationMs) {
            globalSlowTool = { name: tool, durationMs: dMs, turnIdx: currentTurn.index }
          }
        }
        break
      }

      case 'session_end':
        endTs = ts
        stopReason = (ev.stop_reason as string) ?? 'unknown'
        allMessages = (ev.messages as Message[]) ?? []
        if (currentTurn) {
          currentTurn.endTs = ts
          currentTurn.durationMs = ts - currentTurn.startTs
          turns.push(currentTurn)
        }
        currentTurn = null
        break
    }
  }

  if (!endTs) endTs = Date.now()

  // Compute per-turn tokens from messages
  const turnTokens: TurnTokens[] = computeTurnTokens(allMessages)
  const totalTokens = computeTotalTokens(turnTokens)

  // Compute average duration for slow turn detection
  const avgDuration = turns.length
    ? turns.reduce((s, t) => s + t.durationMs, 0) / turns.length
    : 0

  // Extract LLM details from messages per turn
  const filtered = allMessages.filter((m) => m.type !== 'compact_boundary')
  const userIndices: number[] = []
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i].type === 'user') userIndices.push(i)
  }

  const fullTurns: TurnData[] = turns.map((t, i) => {
    const tokens = turnTokens[i] ?? { inputTokens: 0, outputTokens: 0 }
    const isSlow = avgDuration > 0 && t.durationMs > avgDuration * 2

    // Extract thinking and reply from assistant messages
    let thinkingText = ''
    let replyText = ''
    const nextUserIdx = userIndices[i + 1] ?? filtered.length
    const userIdx = userIndices[i]
    if (userIdx !== undefined) {
      const assistantMsgs = filtered
        .slice(userIdx + 1, nextUserIdx)
        .filter((m): m is AssistantMessage => m.type === 'assistant')
      for (const am of assistantMsgs) {
        for (const block of am.content) {
          if ((block as any).type === 'thinking') {
            thinkingText += (block as any).thinking ?? ''
          } else if (block.type === 'text') {
            replyText += block.text
          }
        }
      }
    }

    // LLM detail: messages up to and including current user message + assistant output
    const inputMessages = filtered.slice(0, (userIndices[i] ?? 0) + 1)
    const outputMessages = filtered
      .slice((userIndices[i] ?? 0) + 1, nextUserIdx)
      .filter((m) => m.type === 'assistant')

    const llmDetail = {
      systemPrompt,
      inputMessages: inputMessages.map((m) => ({
        role: m.type,
        content: JSON.stringify(m.content).slice(0, 500),
        isNew: m === filtered[userIndices[i]],
      })),
      outputMessages: outputMessages.map((m) => ({
        role: 'assistant',
        content: JSON.stringify((m as AssistantMessage).content).slice(0, 500),
      })),
      thinkingText: thinkingText.slice(0, 2000),
      replyText: replyText.slice(0, 2000),
    }

    return {
      ...t,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      isSlow,
      thinkingText,
      replyText,
      llmDetailJson: JSON.stringify(llmDetail)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026'),
    }
  })

  return {
    sessionId,
    cwd,
    systemPrompt,
    startTs,
    endTs,
    durationMs: endTs - startTs,
    stopReason,
    turns: fullTurns,
    totalTokens,
    slowestTool: globalSlowTool,
    totalToolCalls: fullTurns.reduce((s, t) => s + t.toolCalls.length, 0),
  }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

function buildHtml(data: SessionData): string {
  const { sessionId, cwd, startTs, durationMs, stopReason, turns, totalTokens, slowestTool, totalToolCalls } = data
  const statusColor = stopReason === 'done' ? '#34d399' : '#f87171'
  const statusText = stopReason === 'done' ? '✓ 完成' : `✗ ${stopReason}`

  // Flowchart nodes
  const flowNodes = turns.map((t, i) => {
    const slowMark = t.isSlow ? '<span style="color:#f87171">⚠</span>' : ''
    const preview = esc(t.userPrompt.slice(0, 20)) + (t.userPrompt.length > 20 ? '…' : '')
    return `
      <div class="flow-node" onclick="scrollToTurn(${i});showLlmPanel(${i})" title="Click to see LLM input/output">
        <div class="flow-label">Turn ${i + 1}</div>
        <div class="flow-preview">${preview}</div>
        <div class="flow-stats">
          <span style="color:#0ea5e9">🔧×${t.toolCalls.length}</span>
          <span>${slowMark}${fmtMs(t.durationMs)}</span>
          <span style="color:#fbbf24">~${fmtTokens(t.inputTokens + t.outputTokens)}</span>
        </div>
      </div>
      ${i < turns.length - 1 ? '<div class="flow-arrow">→</div>' : ''}`
  }).join('')

  // Timeline bar segments
  const totalDur = durationMs || 1
  const timelineSegments = turns.map((t, i) => {
    const pct = (t.durationMs / totalDur * 100).toFixed(1)
    const left = (turns.slice(0, i).reduce((s, x) => s + x.durationMs, 0) / totalDur * 100).toFixed(1)
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444']
    const color = colors[i % colors.length]
    return `<div style="position:absolute;left:${left}%;width:${pct}%;height:100%;background:${color};opacity:0.6"></div>`
  }).join('')

  // Turn detail sections
  const turnSections = turns.map((t, i) => {
    const toolCallHtml = t.toolCalls.map((c) => {
      const isError = c.error !== undefined
      const borderColor = isError ? '#ef4444' : '#0ea5e9'
      const resultLabel = isError ? 'error' : 'result'
      const resultText = isError ? (c.error ?? '') : (c.result ?? '')
      return `
        <div class="tool-call" style="border-left:3px solid ${borderColor}">
          <div class="tool-header">
            <span style="color:${borderColor};font-weight:600">🔧 ${esc(c.tool)}</span>
            <span style="color:#64748b;font-size:11px">${fmtMs(c.durationMs)}</span>
          </div>
          <div class="tool-body">
            <span class="field-label">input:</span>
            <span class="expandable" data-full="${esc(c.input)}">${esc(c.input.slice(0, 200))}${c.input.length > 200 ? '… <a class="expand-link" href="#">展开</a>' : ''}</span>
          </div>
          <div class="tool-body">
            <span class="field-label">${resultLabel}:</span>
            <span class="expandable" style="color:${isError ? '#f87171' : '#34d399'}" data-full="${esc(resultText)}">${esc(resultText.slice(0, 200))}${resultText.length > 200 ? '… <a class="expand-link" href="#">展开</a>' : ''}</span>
          </div>
        </div>`
    }).join('')

    const thinkingHtml = t.thinkingText
      ? `<div class="thinking-block"><span class="field-label" style="color:#7c3aed">思考</span> ${esc(t.thinkingText.slice(0, 500))}${t.thinkingText.length > 500 ? '…' : ''}</div>`
      : ''

    return `
      <div class="turn-section" id="turn-${i}">
        <div class="turn-header" onclick="toggleTurn(${i})">
          <span><span class="turn-arrow" id="arrow-${i}">▼</span> <strong>Turn ${i + 1}</strong>&nbsp;<span style="color:#64748b">${fmtDate(t.startTs)}</span>&nbsp;<span style="color:#94a3b8;font-size:12px">${esc(t.userPrompt.slice(0, 40))}${t.userPrompt.length > 40 ? '…' : ''}</span>${t.isSlow ? '&nbsp;<span style="color:#f87171;font-size:11px">⚠ 慢</span>' : ''}</span>
          <span style="font-size:12px;color:#64748b">⏱ ${fmtMs(t.durationMs)}&nbsp;&nbsp;🪙 ~${fmtTokens(t.inputTokens + t.outputTokens)} tok</span>
        </div>
        <div class="turn-body" id="body-${i}" style="${i === 0 ? '' : 'display:none'}">
          <div class="user-msg"><span style="color:#60a5fa">👤</span><div class="msg-bubble user-bubble">${esc(t.userPrompt)}</div></div>
          ${thinkingHtml}
          ${toolCallHtml}
          <div class="assistant-msg"><span style="color:#a78bfa">🤖</span><div class="msg-bubble assistant-bubble">${esc(t.replyText || '(no text reply)')}</div></div>
        </div>
      </div>`
  }).join('')

  const slowToolStr = slowestTool
    ? `${esc(slowestTool.name)}·${fmtMs(slowestTool.durationMs)} (T${slowestTool.turnIdx + 1})`
    : '—'

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>Pi Session ${esc(sessionId)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0f1a;color:#e2e8f0;font-family:ui-monospace,'Cascadia Code','Fira Code',monospace;font-size:13px;line-height:1.5}
a{color:inherit;text-decoration:none}
#header{background:#1e293b;padding:14px 20px;border-bottom:1px solid #334155}
#flowchart{background:#0c1220;padding:20px;border-bottom:2px solid #1e293b;overflow-x:auto}
.flow-row{display:flex;align-items:center;gap:0;min-width:600px}
.flow-node{background:#1e3a5f;border:2px solid #3b82f6;border-radius:8px;padding:8px 14px;text-align:center;min-width:110px;cursor:pointer;transition:border-color .15s}
.flow-node:hover{border-color:#60a5fa}
.flow-label{color:#60a5fa;font-weight:700;font-size:12px}
.flow-preview{color:#94a3b8;font-size:10px;margin-top:2px}
.flow-stats{display:flex;justify-content:center;gap:6px;margin-top:4px;font-size:10px}
.flow-arrow{color:#475569;font-size:18px;margin:0 4px}
.flow-start,.flow-end{border-radius:20px;padding:5px 12px;font-size:11px}
.flow-start{background:#334155;color:#94a3b8}
.flow-end{background:#14532d;border:1px solid #16a34a;color:#34d399}
#timeline{margin-top:12px;position:relative;height:6px;background:#1e293b;border-radius:3px;min-width:600px}
.tl-label{position:absolute;top:10px;font-size:10px;color:#475569}
.turn-section{border-bottom:1px solid #1e293b}
.turn-header{background:#0f172a;padding:8px 16px;display:flex;justify-content:space-between;cursor:pointer;user-select:none}
.turn-header:hover{background:#172033}
.turn-body{padding:12px 16px}
.user-msg,.assistant-msg{display:flex;gap:8px;margin-bottom:8px;align-items:flex-start}
.msg-bubble{border-radius:6px;padding:7px 11px;flex:1}
.user-bubble{background:#1e3a5f;color:#bfdbfe}
.assistant-bubble{background:#1a1f2e;color:#e2e8f0}
.thinking-block{background:#1e1b4b;border-left:3px solid #7c3aed;border-radius:6px;padding:7px 11px;margin-bottom:8px;color:#c4b5fd;font-size:12px}
.tool-call{background:#162032;border-radius:6px;padding:7px 11px;margin:0 0 6px 28px}
.tool-header{display:flex;justify-content:space-between;margin-bottom:4px}
.tool-body{font-size:11px;color:#64748b;margin-top:2px;word-break:break-all}
.field-label{margin-right:4px}
.expand-link{color:#60a5fa;cursor:pointer}
#footer{background:#0f172a;padding:10px 16px;border-top:1px solid #1e293b}
#llm-panel{position:fixed;top:0;right:0;width:50%;height:100vh;background:#0f172a;border-left:2px solid #334155;overflow-y:auto;z-index:100;display:none;padding:16px}
#llm-panel-close{position:sticky;top:0;background:#0f172a;padding:8px 0;cursor:pointer;color:#94a3b8;font-size:12px;display:block;margin-bottom:12px}
.llm-section{margin-bottom:16px}
.llm-section-title{color:#a78bfa;font-weight:700;font-size:12px;margin-bottom:6px;cursor:pointer}
.llm-section-body{background:#1e293b;border-radius:6px;padding:8px;font-size:11px;color:#94a3b8;word-break:break-all;white-space:pre-wrap;max-height:200px;overflow-y:auto}
.llm-msg{background:#162032;border-radius:4px;padding:6px 8px;margin-bottom:4px;font-size:11px}
.llm-msg.new-msg{border-left:3px solid #60a5fa}
.llm-output{background:#1e1b4b;border-left:3px solid #7c3aed;border-radius:6px;padding:8px;font-size:12px;color:#c4b5fd;white-space:pre-wrap;margin-bottom:8px}
.llm-reply{background:#1a1f2e;border-radius:6px;padding:8px;font-size:12px;color:#e2e8f0;white-space:pre-wrap}
</style>
</head>
<body>
<div id="header">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="color:#a78bfa;font-weight:700;font-size:15px">Pi Session <span style="color:#64748b;font-weight:400;font-size:12px">${esc(sessionId)}</span></span>
    <span style="font-size:12px;color:#64748b">${fmtDate(startTs)} · ${esc(cwd)}</span>
  </div>
  <div style="display:flex;gap:20px;margin-top:6px;font-size:12px">
    <span style="color:${statusColor}">${statusText}</span>
    <span style="color:#94a3b8">⏱ ${fmtMs(durationMs)}</span>
    <span style="color:#fbbf24">🪙 ~${totalTokens.toLocaleString()} tok</span>
    <span style="color:#94a3b8">${turns.length} 轮 · ${totalToolCalls} 工具调用</span>
  </div>
</div>

<div id="flowchart">
  <div class="flow-row">
    <div class="flow-start">开始</div>
    <div class="flow-arrow">→</div>
    ${flowNodes}
    <div class="flow-arrow">→</div>
    <div class="flow-end">✓ ${esc(stopReason)}</div>
  </div>
  <div id="timeline">
    ${timelineSegments}
    <div class="tl-label" style="left:0">0</div>
    <div class="tl-label" style="right:0">${fmtMs(durationMs)}</div>
  </div>
</div>

${turnSections}

<div id="footer">
  <div style="font-size:12px;color:#64748b;display:flex;gap:20px">
    <span>总耗时 <strong style="color:#e2e8f0">${fmtMs(durationMs)}</strong></span>
    <span>tokens <strong style="color:#fbbf24">~${totalTokens.toLocaleString()}</strong></span>
    <span>最慢 <strong style="color:#f87171">${slowToolStr}</strong></span>
    <span>工具 <strong style="color:#e2e8f0">${totalToolCalls} 次</strong></span>
  </div>
</div>

<div id="llm-panel">
  <span id="llm-panel-close" onclick="closeLlmPanel()">✕ 关闭 LLM 详情</span>
  <div id="llm-panel-content"></div>
</div>

<script>
var TURNS_DATA = [${turns.map((t) => t.llmDetailJson).join(',')}];

function toggleTurn(i) {
  var body = document.getElementById('body-' + i);
  var arrow = document.getElementById('arrow-' + i);
  if (body.style.display === 'none') {
    body.style.display = '';
    arrow.textContent = '▼';
  } else {
    body.style.display = 'none';
    arrow.textContent = '▶';
  }
}

function scrollToTurn(i) {
  var el = document.getElementById('turn-' + i);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showLlmPanel(i) {
  var data = TURNS_DATA[i];
  if (!data) return;
  var panel = document.getElementById('llm-panel');
  var content = document.getElementById('llm-panel-content');

  var sysPart = data.systemPrompt
    ? '<div class="llm-section"><div class="llm-section-title" onclick="toggleSection(this)">▶ 系统提示词</div><div class="llm-section-body" style="display:none">' + escHtml(data.systemPrompt) + '</div></div>'
    : '';

  var msgsPart = '<div class="llm-section"><div class="llm-section-title" onclick="toggleSection(this)">▼ 发送给 API 的 messages (' + data.inputMessages.length + ' 条)</div><div class="llm-section-body">'
    + data.inputMessages.map(function(m) {
        return '<div class="llm-msg' + (m.isNew ? ' new-msg' : '') + '"><strong>' + m.role + '</strong>: ' + escHtml(m.content) + '</div>';
      }).join('')
    + '</div></div>';

  var thinkPart = data.thinkingText
    ? '<div class="llm-section"><div class="llm-section-title">🤖 思考</div><div class="llm-output">' + escHtml(data.thinkingText) + '</div></div>'
    : '';

  var replyPart = '<div class="llm-section"><div class="llm-section-title">🤖 最终回复</div><div class="llm-reply">' + escHtml(data.replyText || '(no text)') + '</div></div>';

  content.innerHTML = '<h3 style="color:#a78bfa;margin-bottom:12px">Turn ' + (i + 1) + ' — LLM 详情</h3>' + sysPart + msgsPart + thinkPart + replyPart;
  panel.style.display = 'block';
}

function closeLlmPanel() {
  document.getElementById('llm-panel').style.display = 'none';
}

function toggleSection(title) {
  var body = title.nextElementSibling;
  if (body.style.display === 'none') {
    body.style.display = '';
    title.textContent = title.textContent.replace('▶', '▼');
  } else {
    body.style.display = 'none';
    title.textContent = title.textContent.replace('▼', '▶');
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.querySelectorAll('.expand-link').forEach(function(link) {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    var span = this.parentElement;
    var full = span.dataset.full;
    if (full) span.textContent = full;
  });
});
</script>
</body>
</html>`
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read a JSONL session log and write a self-contained HTML report.
 * Silently does nothing if the JSONL file cannot be read.
 */
export async function generateReport(jsonlPath: string, htmlPath: string): Promise<void> {
  let jsonl: string
  try {
    jsonl = await readFile(jsonlPath, 'utf-8')
  } catch {
    return // JSONL not found — silent
  }
  try {
    const data = parseJsonlToSession(jsonl)
    const html = buildHtml(data)
    await writeFile(htmlPath, html, 'utf-8')
  } catch {
    // HTML generation failed — JSONL still preserved
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/observability/__tests__/htmlReport.test.ts
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/observability/htmlReport.ts src/observability/__tests__/htmlReport.test.ts
git commit -m "feat(observability): add JSONL-to-HTML report generator"
```

---

## Task 4: index.ts — register all observability hooks

**Files:**
- Create: `src/observability/index.ts`

No unit test for this file — it wires together already-tested modules and registers hooks, which requires the full runtime.

- [ ] **Step 1: Create `src/observability/index.ts`**

```ts
import { registerFunctionHook } from '../hooks/index.js'
import { getSessionId, getWorkDir, getWorkspaceDir } from '../bootstrap/state.js'
import { getSystemPrompt } from '../constants/prompts.js'
import { initLogger, appendEvent, getLogFilePath, getHtmlFilePath } from './logger.js'
import { generateReport } from './htmlReport.js'

const MAX_FIELD_LEN = 2000

function trunc(s: string): string {
  return s.length > MAX_FIELD_LEN ? s.slice(0, MAX_FIELD_LEN) : s
}

// Per-tool start timestamps for duration computation.
// Tool calls are sequential (not parallel) so a single slot per tool name suffices.
const toolStartTs = new Map<string, number>()

export function initObservability(): void {
  const sessionId = getSessionId()
  const cwd = getWorkDir()
  initLogger(sessionId, cwd)

  // SessionStart — capture system prompt and log session_start event
  registerFunctionHook('SessionStart', async () => {
    try {
      const systemPrompt = await getSystemPrompt({
        cwd: getWorkDir(),
        sessionId: getSessionId(),
        workspaceDir: getWorkspaceDir(),
        isPlanMode: false,
      })
      await appendEvent({
        event: 'session_start',
        session_id: sessionId,
        cwd,
        system_prompt: trunc(systemPrompt),
        ts: Date.now(),
      })
    } catch {
      // silent
    }
  })

  // UserPromptSubmit — start of a new turn
  registerFunctionHook('UserPromptSubmit', async (input) => {
    if (input.hook_event_name !== 'UserPromptSubmit') return
    await appendEvent({
      event: 'user_prompt',
      prompt: trunc(input.prompt),
      ts: Date.now(),
    })
  })

  // PreToolUse — record tool call start
  registerFunctionHook('PreToolUse', async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return
    const ts = Date.now()
    toolStartTs.set(input.tool_name, ts)
    await appendEvent({
      event: 'tool_call',
      tool: input.tool_name,
      input: trunc(JSON.stringify(input.tool_input)),
      ts,
    })
  })

  // PostToolUse — record successful result + duration
  registerFunctionHook('PostToolUse', async (input) => {
    if (input.hook_event_name !== 'PostToolUse') return
    const ts = Date.now()
    const startTs = toolStartTs.get(input.tool_name) ?? ts
    toolStartTs.delete(input.tool_name)
    await appendEvent({
      event: 'tool_result',
      tool: input.tool_name,
      result: trunc(input.tool_response),
      duration_ms: ts - startTs,
      ts,
    })
  })

  // PostToolUseFailure — record error + duration
  registerFunctionHook('PostToolUseFailure', async (input) => {
    if (input.hook_event_name !== 'PostToolUseFailure') return
    const ts = Date.now()
    const startTs = toolStartTs.get(input.tool_name) ?? ts
    toolStartTs.delete(input.tool_name)
    await appendEvent({
      event: 'tool_error',
      tool: input.tool_name,
      error: trunc(input.tool_error),
      duration_ms: ts - startTs,
      ts,
    })
  })

  // Stop — record session_end with full messages[], then generate HTML report
  registerFunctionHook('Stop', async (input) => {
    if (input.hook_event_name !== 'Stop') return
    try {
      await appendEvent({
        event: 'session_end',
        stop_reason: input.stop_reason,
        messages: input.messages ?? [],
        ts: Date.now(),
      })
      const jsonlPath = getLogFilePath()
      const htmlPath = getHtmlFilePath()
      if (jsonlPath && htmlPath) {
        await generateReport(jsonlPath, htmlPath)
      }
    } catch {
      // silent — JSONL file preserved even if HTML fails
    }
  })
}
```

- [ ] **Step 2: Run full test suite to ensure no regressions**

```bash
npx vitest run
```

Expected: All existing tests PASS, new tests for logger/tokenCount/htmlReport PASS

- [ ] **Step 3: Commit**

```bash
git add src/observability/index.ts
git commit -m "feat(observability): add initObservability() hook registration"
```

---

## Task 5: REPL integration + .gitignore

**Files:**
- Modify: `src/screens/REPL.tsx` (line 340 — add `initObservability()` call)
- Modify: `.gitignore` (add `.pi/` entry)

- [ ] **Step 1: Add import to REPL.tsx**

In `src/screens/REPL.tsx`, add the import after the existing `initSessionMemory` import (line 23):

```ts
import { initSessionMemory } from '../sessionMemory/index.js'
import { initObservability } from '../observability/index.js'
```

- [ ] **Step 2: Call initObservability() in the initialization guard**

In `src/screens/REPL.tsx`, the initialization block is at approximately line 337–341:

Current:
```ts
  useEffect(() => {
    if (!smInitializedRef.current) {
      smInitializedRef.current = true
      initSessionMemory()
    }
```

Change to:
```ts
  useEffect(() => {
    if (!smInitializedRef.current) {
      smInitializedRef.current = true
      initSessionMemory()
      initObservability()
    }
```

- [ ] **Step 3: Add `.pi/` to .gitignore**

Check if `.gitignore` already has `.pi/`. If not, append it:

```bash
grep -qxF '.pi/' /Users/mac/Documents/ai/pi-claude-code/.gitignore || echo '.pi/' >> /Users/mac/Documents/ai/pi-claude-code/.gitignore
```

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npx vitest run
```

Expected: All tests PASS

- [ ] **Step 5: Build check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/screens/REPL.tsx .gitignore
git commit -m "feat(observability): integrate initObservability() into REPL startup"
```

---

## Done

After all 5 tasks, the observability system is complete:
- Every session produces `.pi/logs/session-<id>.jsonl` (live-appended)
- On session end, `.pi/logs/session-<id>.html` is generated (self-contained, no server needed)
- HTML shows: header stats → clickable turn flowchart → collapsible turn details → LLM detail panel
- All failures are silent — the agent is never interrupted
