# Tool Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Claude Code-style tool loading and linking architecture: `ToolUseContext`, `buildTool` factory, per-tool folder structure, `ToolSearchTool`, `getActiveTools`/`getAllTools` registry, custom UI rendering in `Messages.tsx`, and full wiring through `query.ts` + `REPL.tsx`.

**Architecture:** Static tool registry in `src/tools/index.ts` with `getActiveTools()` (model-visible tools) and `getAllTools()` (full list for ToolSearchTool discovery). Each tool lives in its own folder: `ToolName.tsx` + `UI.tsx` + `prompt.ts`. `buildTool()` factory fills defaults. `ToolUseContext` flows from the query loop into each `tool.call()`. No test framework — use `npm run typecheck` to verify each task.

**Tech Stack:** TypeScript, React 18, Ink 5 (terminal UI), `@anthropic-ai/sdk`. ESM modules with `.js` import extensions.

**Spec:** `docs/superpowers/specs/2026-04-03-tool-architecture-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/Tool.ts` | Delete | Replaced by `Tool.tsx` |
| `src/Tool.tsx` | Create | `ToolUseContext`, `Tool` interface, `ToolDef`, `buildTool`, default UI renderers |
| `src/tools/index.ts` | Modify | Add `getAllTools()`, `getActiveTools()`, update imports to new tool files |
| `src/tools/BashTool/index.ts` | Delete | Replaced by `BashTool.tsx` |
| `src/tools/BashTool/prompt.ts` | Create | `DESCRIPTION`, `SEARCH_HINT` |
| `src/tools/BashTool/UI.tsx` | Create | `BashToolUseUI`, `BashToolResultUI` |
| `src/tools/BashTool/BashTool.tsx` | Create | `BashTool` via `buildTool` |
| `src/tools/ReadTool/index.ts` | Delete | Replaced by `ReadTool.tsx` |
| `src/tools/ReadTool/prompt.ts` | Create | `DESCRIPTION`, `SEARCH_HINT` |
| `src/tools/ReadTool/UI.tsx` | Create | `ReadToolUseUI`, `ReadToolResultUI` |
| `src/tools/ReadTool/ReadTool.tsx` | Create | `ReadTool` via `buildTool` |
| `src/tools/ToolSearchTool/UI.tsx` | Create | `ToolSearchUseUI`, `ToolSearchResultUI` |
| `src/tools/ToolSearchTool/ToolSearchTool.tsx` | Create | `ToolSearchTool`: keyword search over all tools |
| `src/query.ts` | Modify | Add `allTools` to `QueryParams`, construct `ToolUseContext`, pass to `tool.call()` |
| `src/components/Messages.tsx` | Modify | Add `tools` prop, call `tool.renderToolUse()`/`tool.renderToolResult()` |
| `src/screens/REPL.tsx` | Modify | Pass `allTools` to `query()`, pass `tools` to `<Messages>` |
| `src/hooks/useMergedTools.ts` | Modify | Use `getActiveTools()` instead of `getTools()` |

---

## Task 1: Create `src/Tool.tsx` — Core interface layer

**Files:**
- Delete: `src/Tool.ts`
- Create: `src/Tool.tsx`

- [ ] **Step 1: Delete `src/Tool.ts`**

```bash
git rm src/Tool.ts
```

- [ ] **Step 2: Create `src/Tool.tsx` with complete content**

Create `src/Tool.tsx`:

```tsx
// Tool 接口层 — 对标 Claude Code src/Tool.ts
// 包含: ToolUseContext, Tool 接口, ToolDef, buildTool 工厂, 默认 UI 渲染器

import React from 'react'
import { Box, Text } from 'ink'

/** 工具执行上下文（对标 Claude Code ToolUseContext，简化版） */
export type ToolUseContext = {
  abortSignal: AbortSignal
  cwd: string
  /** 全部工具列表（含 deferLoading），供 ToolSearchTool 遍历 */
  tools: Tool[]
}

/** 工具接口 */
export interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
  /** 搜索关键词，供 ToolSearchTool 做文本匹配 */
  searchHint?: string
  /** true = 不放入初始 API context，等模型通过 ToolSearchTool 发现后再激活 */
  deferLoading?: boolean
  /** 运行时决定工具是否可用 */
  isEnabled(): boolean
  /** 是否只读（不修改文件/系统状态） */
  isReadOnly(): boolean
  /** 执行工具，返回结果字符串 */
  call(input: unknown, context: ToolUseContext): Promise<string>
  /** 工具调用时展示的 Ink UI */
  renderToolUse(input: unknown): React.ReactNode
  /** 工具结果展示的 Ink UI */
  renderToolResult(result: string): React.ReactNode
}

/** buildTool 的输入定义（call 必填，其余有默认值） */
export type ToolDef = Pick<Tool, 'name' | 'description' | 'inputSchema' | 'call'> &
  Partial<Omit<Tool, 'name' | 'description' | 'inputSchema' | 'call'>>

function defaultRenderToolUse(name: string, input: unknown): React.ReactNode {
  return (
    <Box>
      <Text color="cyan" bold>
        {name}{' '}
      </Text>
      <Text color="gray">{JSON.stringify(input)}</Text>
    </Box>
  )
}

function defaultRenderToolResult(result: string): React.ReactNode {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="gray">{display}</Text>
    </Box>
  )
}

/** 工具工厂：填充所有默认值 */
export function buildTool(def: ToolDef): Tool {
  return {
    isEnabled: () => true,
    isReadOnly: () => false,
    deferLoading: false,
    renderToolUse: (input) => defaultRenderToolUse(def.name, input),
    renderToolResult: (result) => defaultRenderToolResult(result),
    ...def,
  }
}
```

- [ ] **Step 3: Verify `Tool.tsx` typechecks in isolation**

The typecheck will still fail on other files (they still reference the old `Tool.ts`). Check only that the new file has no errors by looking for errors referencing `Tool.tsx`:

```bash
npm run typecheck 2>&1 | grep "Tool.tsx"
```

Expected: no lines mentioning `Tool.tsx` errors.

- [ ] **Step 4: Commit**

```bash
git add src/Tool.tsx
git commit -m "feat: Tool.tsx — ToolUseContext, Tool interface, buildTool factory, default UI renderers"
```

---

## Task 2: Refactor BashTool into 3-file folder structure

**Files:**
- Delete: `src/tools/BashTool/index.ts`
- Create: `src/tools/BashTool/prompt.ts`
- Create: `src/tools/BashTool/UI.tsx`
- Create: `src/tools/BashTool/BashTool.tsx`

Note: `src/tools/index.ts` still imports from `./BashTool/index.js` — it will have a broken import until Task 5 updates it. That's expected; the typecheck may fail there.

- [ ] **Step 1: Create `src/tools/BashTool/prompt.ts`**

```typescript
export const DESCRIPTION =
  'Execute a bash command in a shell and return the output. ' +
  'Use for running scripts, listing files, or any shell operation.'

export const SEARCH_HINT = 'run commands, shell, terminal, execute, script, bash'
```

- [ ] **Step 2: Create `src/tools/BashTool/UI.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'

export function BashToolUseUI({ input }: { input: { command: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>
        ${' '}
      </Text>
      <Text>{input.command}</Text>
    </Box>
  )
}

export function BashToolResultUI({ result }: { result: string }) {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text>{display}</Text>
    </Box>
  )
}
```

- [ ] **Step 3: Create `src/tools/BashTool/BashTool.tsx`**

```tsx
import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { BashToolUseUI, BashToolResultUI } from './UI.js'

export const BashTool = buildTool({
  name: 'bash',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The bash command to run' },
    },
    required: ['command'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => (
    <BashToolUseUI input={input as { command: string }} />
  ),
  renderToolResult: (result) => <BashToolResultUI result={result} />,
  async call(input, _context) {
    const { command } = input as { command: string }
    return `[BashTool stub] would run: ${command}`
  },
})
```

- [ ] **Step 4: Delete the old `src/tools/BashTool/index.ts`**

```bash
git rm src/tools/BashTool/index.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/BashTool/
git commit -m "feat: refactor BashTool into prompt.ts + UI.tsx + BashTool.tsx folder structure"
```

---

## Task 3: Refactor ReadTool into 3-file folder structure

**Files:**
- Delete: `src/tools/ReadTool/index.ts`
- Create: `src/tools/ReadTool/prompt.ts`
- Create: `src/tools/ReadTool/UI.tsx`
- Create: `src/tools/ReadTool/ReadTool.tsx`

- [ ] **Step 1: Create `src/tools/ReadTool/prompt.ts`**

```typescript
export const DESCRIPTION =
  'Read the contents of a file at the given path. ' +
  'Returns the full file content as a string.'

export const SEARCH_HINT = 'read file, open file, file contents, view file, cat'
```

- [ ] **Step 2: Create `src/tools/ReadTool/UI.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'

export function ReadToolUseUI({ input }: { input: { path: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>
        read{' '}
      </Text>
      <Text color="gray">{input.path}</Text>
    </Box>
  )
}

export function ReadToolResultUI({ result }: { result: string }) {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="gray">{display}</Text>
    </Box>
  )
}
```

- [ ] **Step 3: Create `src/tools/ReadTool/ReadTool.tsx`**

```tsx
import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { ReadToolUseUI, ReadToolResultUI } from './UI.js'

export const ReadTool = buildTool({
  name: 'read_file',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The file path to read' },
    },
    required: ['path'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <ReadToolUseUI input={input as { path: string }} />
  ),
  renderToolResult: (result) => <ReadToolResultUI result={result} />,
  async call(input, _context) {
    const { path } = input as { path: string }
    return `[ReadTool stub] would read: ${path}`
  },
})
```

- [ ] **Step 4: Delete the old `src/tools/ReadTool/index.ts`**

```bash
git rm src/tools/ReadTool/index.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/ReadTool/
git commit -m "feat: refactor ReadTool into prompt.ts + UI.tsx + ReadTool.tsx folder structure"
```

---

## Task 4: Create ToolSearchTool

**Files:**
- Create: `src/tools/ToolSearchTool/UI.tsx`
- Create: `src/tools/ToolSearchTool/ToolSearchTool.tsx`

- [ ] **Step 1: Create `src/tools/ToolSearchTool/UI.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'

export function ToolSearchUseUI({
  input,
}: {
  input: { query: string; max_results?: number }
}) {
  return (
    <Box>
      <Text color="cyan" bold>
        tool_search{' '}
      </Text>
      <Text color="gray">"{input.query}"</Text>
    </Box>
  )
}

export function ToolSearchResultUI({ result }: { result: string }) {
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color="gray">{result}</Text>
    </Box>
  )
}
```

- [ ] **Step 2: Create `src/tools/ToolSearchTool/ToolSearchTool.tsx`**

```tsx
import React from 'react'
import { buildTool, type Tool } from '../../Tool.js'
import { ToolSearchUseUI, ToolSearchResultUI } from './UI.js'

function matchesTool(tool: Tool, query: string): boolean {
  const q = query.toLowerCase()
  return (
    tool.name.toLowerCase().includes(q) ||
    tool.description.toLowerCase().includes(q) ||
    (tool.searchHint ?? '').toLowerCase().includes(q)
  )
}

export const ToolSearchTool = buildTool({
  name: 'tool_search',
  description:
    'Search for available tools by keyword. Use when you need a tool but are not sure if it exists or how it is named.',
  searchHint: 'find tools, discover tools, search tools, what tools are available',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keywords to find relevant tools' },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
      },
    },
    required: ['query'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <ToolSearchUseUI input={input as { query: string; max_results?: number }} />
  ),
  renderToolResult: (result) => <ToolSearchResultUI result={result} />,
  async call(input, context) {
    const { query, max_results = 5 } = input as { query: string; max_results?: number }
    // context.tools contains ALL tools including deferLoading ones
    const matches = context.tools
      .filter((t) => t.isEnabled())
      .filter((t) => matchesTool(t, query))
      .slice(0, max_results)

    if (matches.length === 0) {
      return `No tools found matching "${query}".`
    }

    return matches.map((t) => `- **${t.name}**: ${t.description}`).join('\n')
  },
})
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/ToolSearchTool/
git commit -m "feat: add ToolSearchTool — keyword search over all tools including deferred ones"
```

---

## Task 5: Update `src/tools/index.ts` registry

**Files:**
- Modify: `src/tools/index.ts`

This task fixes the broken imports from Tasks 2–4 and adds `getAllTools`/`getActiveTools`.

- [ ] **Step 1: Replace `src/tools/index.ts` with complete new content**

```typescript
// 工具注册表 — 对标 Claude Code src/tools.ts
// getAllTools: 所有工具（含 deferLoading），供 ToolSearchTool 搜索
// getActiveTools: 传给模型的工具（isEnabled() && !deferLoading）

import type { Tool } from '../Tool.js'
import { BashTool } from './BashTool/BashTool.js'
import { ReadTool } from './ReadTool/ReadTool.js'
import { ToolSearchTool } from './ToolSearchTool/ToolSearchTool.js'

// 内置工具静态列表 — 新增工具在此 import + 加入数组
const BUILTIN_TOOLS: Tool[] = [BashTool, ReadTool, ToolSearchTool]

/** 所有工具（含 isEnabled=false 和 deferLoading=true），供 ToolSearchTool 搜索 */
export function getAllTools(pluginTools: Tool[] = []): Tool[] {
  return [...BUILTIN_TOOLS, ...pluginTools]
}

/**
 * 传给模型的激活工具：isEnabled() 且 deferLoading=false。
 * deferLoading 工具不在初始 context 里，等 ToolSearchTool 激活后模型才能调用。
 */
export function getActiveTools(pluginTools: Tool[] = []): Tool[] {
  return getAllTools(pluginTools).filter((t) => t.isEnabled() && !t.deferLoading)
}

export function findTool(name: string, tools: Tool[]): Tool | undefined {
  return tools.find((t) => t.name === name)
}
```

- [ ] **Step 2: Run typecheck — expect it to pass on all tool files**

```bash
npm run typecheck 2>&1 | grep -E "tools/"
```

Expected: no errors in `src/tools/` directory.

- [ ] **Step 3: Run typecheck — check overall status**

```bash
npm run typecheck 2>&1 | head -30
```

Expected: errors only in files not yet updated — `query.ts` (old `Tool` interface), `Messages.tsx`, `REPL.tsx`, `useMergedTools.ts`. No errors in tool files.

- [ ] **Step 4: Commit**

```bash
git add src/tools/index.ts
git commit -m "feat: update tools registry — getAllTools, getActiveTools, add ToolSearchTool"
```

---

## Task 6: Update `src/query.ts` — inject ToolUseContext

**Files:**
- Modify: `src/query.ts`

The key changes:
1. Import `ToolUseContext` from `./Tool.js`
2. Add `allTools?: Tool[]` to `QueryParams`
3. `executeTools` receives a `ToolUseContext` and passes it to `tool.call(input, context)`
4. `query()` constructs the `ToolUseContext` before calling `executeTools`

- [ ] **Step 1: Update the import line at the top of `src/query.ts`**

Current line 6–7:
```typescript
import type { Tool } from './Tool.js'
```

Replace with:
```typescript
import type { Tool, ToolUseContext } from './Tool.js'
```

- [ ] **Step 2: Add `allTools` to `QueryParams` type**

Current `QueryParams` (lines 18–29):
```typescript
export type QueryParams = {
  messages: Message[]
  tools: Tool[]
  systemPrompt: string
  model?: string
  maxTurns?: number
  abortSignal?: AbortSignal
  canUseTool?: CanUseTool
}
```

Replace with:
```typescript
export type QueryParams = {
  messages: Message[]
  /** 激活工具（传给 API，isEnabled() && !deferLoading） */
  tools: Tool[]
  /** 全部工具（传给 ToolUseContext，供 ToolSearchTool 访问） */
  allTools?: Tool[]
  systemPrompt: string
  model?: string
  maxTurns?: number
  abortSignal?: AbortSignal
  canUseTool?: CanUseTool
}
```

- [ ] **Step 3: Update `executeTools` signature to accept `ToolUseContext`**

Current `executeTools` signature (line 140–144):
```typescript
async function* executeTools(
  toolUses: AssistantMessage['content'],
  tools: Tool[],
  canUseTool: CanUseTool,
): AsyncGenerator<StreamEvent, UserMessage['content']> {
```

Replace with:
```typescript
async function* executeTools(
  toolUses: AssistantMessage['content'],
  tools: Tool[],
  canUseTool: CanUseTool,
  context: ToolUseContext,
): AsyncGenerator<StreamEvent, UserMessage['content']> {
```

- [ ] **Step 4: Update `tool.call()` inside `executeTools` to pass context**

Current (line ~172):
```typescript
        result = await tool.call(c.input)
```

Replace with:
```typescript
        result = await tool.call(c.input, context)
```

- [ ] **Step 5: Destructure `allTools` in `query()` and construct `ToolUseContext`**

In `query()`, find the destructure block (around line 207):
```typescript
  const {
    messages,
    tools,
    systemPrompt,
    model = process.env.PI_MODEL ?? 'deepseek-chat',
    maxTurns = 10,
    abortSignal,
    canUseTool = defaultCanUseTool,
  } = params
```

Replace with:
```typescript
  const {
    messages,
    tools,
    allTools,
    systemPrompt,
    model = process.env.PI_MODEL ?? 'deepseek-chat',
    maxTurns = 10,
    abortSignal,
    canUseTool = defaultCanUseTool,
  } = params

  // ToolUseContext 在整个 query 生命周期内复用（对标 Claude Code ToolUseContext）
  const toolUseContext: ToolUseContext = {
    abortSignal: abortSignal ?? new AbortController().signal,
    cwd: process.cwd(),
    tools: allTools ?? tools,  // ToolSearchTool 能看到所有工具，包括 deferLoading 的
  }
```

- [ ] **Step 6: Pass `toolUseContext` to `executeTools`**

Find the `executeTools` call (around line 268):
```typescript
    const toolResults = yield* executeTools(assistantContent, tools, canUseTool)
```

Replace with:
```typescript
    const toolResults = yield* executeTools(assistantContent, tools, canUseTool, toolUseContext)
```

- [ ] **Step 7: Verify typecheck passes for query.ts**

```bash
npm run typecheck 2>&1 | grep "query.ts"
```

Expected: no errors in `query.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/query.ts
git commit -m "feat: query.ts — ToolUseContext injection, allTools QueryParam, pass context to tool.call()"
```

---

## Task 7: Update `src/components/Messages.tsx` — custom tool UI rendering

**Files:**
- Modify: `src/components/Messages.tsx`

Changes: add `tools: Tool[]` prop, update `ToolUseBubble` to call `tool.renderToolUse()`, update `ToolResultBubble` to look up the tool by `tool_use_id` and call `tool.renderToolResult()`.

- [ ] **Step 1: Replace `src/components/Messages.tsx` with complete new content**

```tsx
// 消息列表 — 对标 Claude Code src/components/Messages.tsx
// 渲染 user / assistant / tool_use / tool_result 消息
// tools prop 用于调用每个工具自定义的 renderToolUse / renderToolResult

import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import type { Message } from '../types/message.js'
import type { Tool } from '../Tool.js'
import { findTool } from '../tools/index.js'
import { getAssistantText, getToolUses } from '../utils/messages.js'

type Props = {
  messages: Message[]
  streamingText?: string
  tools: Tool[]
}

function UserBubble({ text }: { text: string }) {
  return (
    <Box marginBottom={1}>
      <Text color="blue" bold>
        You:{' '}
      </Text>
      <Text>{text}</Text>
    </Box>
  )
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text color="green" bold>
        Pi:{' '}
      </Text>
      <Text>{text}</Text>
    </Box>
  )
}

function ToolUseBubble({
  name,
  input,
  tools,
}: {
  name: string
  input: unknown
  tools: Tool[]
}) {
  const tool = findTool(name, tools)
  return (
    <Box marginBottom={1} paddingLeft={2}>
      {tool ? (
        tool.renderToolUse(input)
      ) : (
        <>
          <Text color="yellow">⚙ {name}(</Text>
          <Text color="gray">{JSON.stringify(input)}</Text>
          <Text color="yellow">)</Text>
        </>
      )}
    </Box>
  )
}

function ToolResultBubble({
  toolUseId,
  content,
  tools,
  toolUseNames,
}: {
  toolUseId: string
  content: string
  tools: Tool[]
  toolUseNames: Map<string, string>
}) {
  const toolName = toolUseNames.get(toolUseId)
  const tool = toolName ? findTool(toolName, tools) : undefined
  return (
    <Box marginBottom={1} paddingLeft={2}>
      {tool ? (
        tool.renderToolResult(content)
      ) : (
        <Box borderStyle="single" borderColor="gray">
          <Text color="gray">
            {content.slice(0, 500)}
            {content.length > 500 ? '…' : ''}
          </Text>
        </Box>
      )}
    </Box>
  )
}

export function Messages({ messages, streamingText, tools }: Props) {
  // Build a lookup map: tool_use_id → tool name
  // Needed so ToolResultBubble can find the right tool to render results
  const toolUseNames = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const msg of messages) {
      if (msg.type === 'assistant') {
        for (const c of msg.content) {
          if (c.type === 'tool_use') {
            map.set(c.id, c.name)
          }
        }
      }
    }
    return map
  }, [messages])

  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => {
        if (msg.type === 'user') {
          const textContent = msg.content.find((c) => c.type === 'text')
          const toolResults = msg.content.filter((c) => c.type === 'tool_result')

          return (
            <Box key={i} flexDirection="column">
              {textContent && textContent.type === 'text' && (
                <UserBubble text={textContent.text} />
              )}
              {toolResults.map((r, j) =>
                r.type === 'tool_result' ? (
                  <ToolResultBubble
                    key={j}
                    toolUseId={r.tool_use_id}
                    content={r.content}
                    tools={tools}
                    toolUseNames={toolUseNames}
                  />
                ) : null,
              )}
            </Box>
          )
        }

        if (msg.type === 'assistant') {
          const text = getAssistantText(msg)
          const toolUses = getToolUses(msg)
          return (
            <Box key={i} flexDirection="column">
              {text && <AssistantBubble text={text} />}
              {toolUses.map((t, j) => (
                <ToolUseBubble key={j} name={t.name} input={t.input} tools={tools} />
              ))}
            </Box>
          )
        }

        return null
      })}

      {streamingText && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="green" bold>
            Pi:{' '}
          </Text>
          <Text>{streamingText}</Text>
        </Box>
      )}
    </Box>
  )
}
```

- [ ] **Step 2: Verify typecheck on Messages.tsx**

```bash
npm run typecheck 2>&1 | grep "Messages.tsx"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Messages.tsx
git commit -m "feat: Messages.tsx — add tools prop, delegate rendering to tool.renderToolUse/renderToolResult"
```

---

## Task 8: Wire REPL.tsx and useMergedTools.ts

**Files:**
- Modify: `src/screens/REPL.tsx`
- Modify: `src/hooks/useMergedTools.ts`

This is the final wiring task. After this, `npm run typecheck` should pass with zero errors.

- [ ] **Step 1: Update `src/hooks/useMergedTools.ts`**

Replace the full file content:

```typescript
// 工具注册表 hook — 返回激活工具（isEnabled() && !deferLoading）
// 对标 Claude Code src/hooks/useMergedTools.ts

import { useMemo } from 'react'
import type { Tool } from '../Tool.js'
import { getActiveTools } from '../tools/index.js'
import { getPluginTools } from '../plugins/index.js'

export function useMergedTools(): Tool[] {
  return useMemo(() => {
    const pluginTools = getPluginTools()
    return getActiveTools(pluginTools)
  }, [])
}
```

- [ ] **Step 2: Update `src/screens/REPL.tsx` — add allTools and pass tools to Messages**

The changes to `REPL.tsx`:
1. Import `getAllTools` from `'../tools/index.js'` and `getPluginTools` from `'../plugins/index.js'`
2. Add `useMemo` import (it's needed for `allTools`)
3. Inside the component, compute `allTools`
4. Pass `allTools` to `query()`
5. Pass `tools` to `<Messages>`

Find the import block at the top of `src/screens/REPL.tsx`. Current:
```typescript
import React, { useCallback, useRef, useState } from 'react'
```

Replace with:
```typescript
import React, { useCallback, useMemo, useRef, useState } from 'react'
```

- [ ] **Step 3: Add the missing imports in REPL.tsx**

After the existing imports (after the `useMergedTools` import line), add:
```typescript
import { getAllTools } from '../tools/index.js'
import { getPluginTools } from '../plugins/index.js'
```

- [ ] **Step 4: Add `allTools` computation inside the `REPL` component**

After `const tools = useMergedTools()` line (currently line 29 in REPL.tsx), add:
```typescript
  const allTools = useMemo(() => getAllTools(getPluginTools()), [])
```

- [ ] **Step 5: Pass `allTools` to `query()` in the `handleSubmit` callback**

Find the `query({...})` call inside `handleSubmit`. Current:
```typescript
        const gen = query({
          messages: currentMessages,
          tools,
          systemPrompt: getSystemPrompt(),
          canUseTool,
          abortSignal: abortController.signal,
        })
```

Replace with:
```typescript
        const gen = query({
          messages: currentMessages,
          tools,
          allTools,
          systemPrompt: getSystemPrompt(),
          canUseTool,
          abortSignal: abortController.signal,
        })
```

- [ ] **Step 6: Pass `tools` to `<Messages>` in the JSX**

Find the `<Messages>` component usage in REPL.tsx (currently line ~163):
```tsx
      <Messages messages={history.messages} streamingText={history.streamingText} />
```

Replace with:
```tsx
      <Messages messages={history.messages} streamingText={history.streamingText} tools={tools} />
```

- [ ] **Step 7: Run full typecheck — expect zero errors**

```bash
npm run typecheck 2>&1
```

Expected: no output (zero errors). If there are errors, fix them before committing.

- [ ] **Step 8: Run smoke test**

```bash
npm run dev
```

Type "hello" and verify the app runs without errors. Type a message that triggers a tool (e.g., "run ls in the current directory") and verify:
- Tool use renders with `BashToolUseUI` (shows `$ ls`)
- Tool result renders with `BashToolResultUI` (shows stub result in a box)

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useMergedTools.ts src/screens/REPL.tsx
git commit -m "feat: wire REPL + useMergedTools — allTools to query, tools to Messages, getActiveTools"
```

---

## Post-Implementation Checklist

After all 8 tasks are committed:

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run dev` — app starts
- [ ] Chat responds to text messages
- [ ] Tool calls show custom UI (BashToolUseUI, ReadToolUseUI)
- [ ] ToolSearchTool is registered and searchable
- [ ] `getActiveTools()` returns BashTool, ReadTool, ToolSearchTool (all `deferLoading=false` by default)
- [ ] `getAllTools()` returns same 3 tools (extendable with plugin tools)
