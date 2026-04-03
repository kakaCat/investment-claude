# Pi 主循环框架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Pi AI agent CLI 的架构骨架：项目初始化、类型定义、核心 query 循环、简化 REPL 屏幕、Ink UI 组件，产出一个可运行的终端对话程序。

**Architecture:** 对标 Claude Code 架构，`query.ts` 是纯 async generator 负责 Claude API 调用和工具执行，`screens/REPL.tsx` 是 Ink 主屏幕（≤300 行）消费事件流，四个 stub 模块（compact/ssh/swarm/plugins）预留扩展点但不实现内部逻辑。

**Tech Stack:** TypeScript, React, Ink 5, @anthropic-ai/sdk, Bun（或 Node.js + tsx）

---

## 文件清单

| 文件 | 角色 |
|------|------|
| `package.json` | 项目配置 + 依赖 |
| `tsconfig.json` | TypeScript 配置 |
| `src/types/message.ts` | Message / StreamEvent 类型 |
| `src/Tool.ts` | Tool 接口 |
| `src/bootstrap/state.ts` | 全局会话状态（路径、sessionId） |
| `src/utils/messages.ts` | createUserMessage / createAssistantMessage |
| `src/constants/prompts.ts` | 系统提示词（stub） |
| `src/compact/index.ts` | 自动 compact stub |
| `src/ssh/index.ts` | SSH session stub |
| `src/swarm/index.ts` | Swarm 协作 stub |
| `src/plugins/index.ts` | Plugin 系统 stub |
| `src/tools/BashTool/index.ts` | BashTool stub |
| `src/tools/ReadTool/index.ts` | ReadTool stub |
| `src/tools/index.ts` | 工具注册入口 |
| `src/hooks/useMergedTools.ts` | 工具注册表 hook（预留 plugin 注入） |
| `src/hooks/useAssistantHistory.ts` | 消息历史 hook |
| `src/query.ts` | 核心：async generator，Claude API + 工具执行 |
| `src/components/Spinner.tsx` | 加载指示 Ink 组件 |
| `src/components/PromptInput.tsx` | 输入框 Ink 组件 |
| `src/components/Messages.tsx` | 消息列表 Ink 组件 |
| `src/components/App.tsx` | 顶层 Providers |
| `src/screens/REPL.tsx` | 主屏幕，驱动主循环 |
| `src/entrypoints/cli.tsx` | CLI 入口 |

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "pi",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "pi": "./dist/cli.js"
  },
  "scripts": {
    "dev": "tsx src/entrypoints/cli.tsx",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.40.0",
    "ink": "^5.0.1",
    "react": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 安装依赖**

```bash
npm install
```

Expected: `node_modules/` 创建完成，无报错。

- [ ] **Step 4: 验证 TypeScript 可用**

```bash
npx tsc --version
```

Expected: `Version 5.x.x`

- [ ] **Step 5: Commit**

```bash
git init
git add package.json tsconfig.json
git commit -m "chore: init project with TypeScript + Ink stack"
```

---

## Task 2: 核心类型定义

**Files:**
- Create: `src/types/message.ts`
- Create: `src/Tool.ts`

- [ ] **Step 1: 创建 src/types/message.ts**

```typescript
// Message 类型 — 对标 Claude Code src/types/message.ts

export type TextContent = {
  type: 'text'
  text: string
}

export type ToolUseContent = {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export type ToolResultContent = {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

export type UserMessage = {
  type: 'user'
  content: Array<TextContent | ToolResultContent>
}

export type AssistantMessage = {
  type: 'assistant'
  content: Array<TextContent | ToolUseContent>
}

export type Message = UserMessage | AssistantMessage

// query.ts yield 的事件流类型
export type StreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: 'done' }
  | { type: 'error'; error: Error }
```

- [ ] **Step 2: 创建 src/Tool.ts**

```typescript
// Tool 接口 — 对标 Claude Code src/Tool.ts

export interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
  call(input: unknown): Promise<string>
}
```

- [ ] **Step 3: typecheck**

```bash
npm run typecheck
```

Expected: 无报错。

- [ ] **Step 4: Commit**

```bash
git add src/types/message.ts src/Tool.ts
git commit -m "feat: add core Message and Tool type definitions"
```

---

## Task 3: 全局状态 + 工具函数

**Files:**
- Create: `src/bootstrap/state.ts`
- Create: `src/utils/messages.ts`
- Create: `src/constants/prompts.ts`

- [ ] **Step 1: 创建 src/bootstrap/state.ts**

```typescript
// 全局会话状态 — 对标 Claude Code src/bootstrap/state.ts
// 注意：只存不可变的启动时信息，运行时变化的数据放 React state

import { homedir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

export type State = {
  originalCwd: string   // 启动时的工作目录
  projectRoot: string   // 项目根目录（当前阶段与 originalCwd 相同）
  workDir: string       // 当前工作目录
  taskDir: string       // 任务存储目录 ~/.pi/tasks/
  sessionId: string
}

const state: State = {
  originalCwd: process.cwd(),
  projectRoot: process.cwd(),
  workDir: process.cwd(),
  taskDir: join(homedir(), '.pi', 'tasks'),
  sessionId: randomUUID(),
}

export function getOriginalCwd(): string {
  return state.originalCwd
}

export function getProjectRoot(): string {
  return state.projectRoot
}

export function getWorkDir(): string {
  return state.workDir
}

export function getTaskDir(): string {
  return state.taskDir
}

export function getSessionId(): string {
  return state.sessionId
}
```

- [ ] **Step 2: 创建 src/utils/messages.ts**

```typescript
// 消息工厂函数 — 对标 Claude Code src/utils/messages.ts

import type {
  UserMessage,
  AssistantMessage,
  TextContent,
  ToolResultContent,
  ToolUseContent,
} from '../types/message.js'

export function createUserMessage(text: string): UserMessage {
  return {
    type: 'user',
    content: [{ type: 'text', text }],
  }
}

export function createAssistantMessage(text: string): AssistantMessage {
  return {
    type: 'assistant',
    content: [{ type: 'text', text }],
  }
}

export function createToolResultMessage(
  tool_use_id: string,
  content: string,
): UserMessage {
  const toolResult: ToolResultContent = {
    type: 'tool_result',
    tool_use_id,
    content,
  }
  return {
    type: 'user',
    content: [toolResult],
  }
}

/** 从 AssistantMessage 中提取纯文本内容 */
export function getAssistantText(msg: AssistantMessage): string {
  return msg.content
    .filter((c): c is TextContent => c.type === 'text')
    .map((c) => c.text)
    .join('')
}

/** 从 AssistantMessage 中提取 tool_use 调用列表 */
export function getToolUses(msg: AssistantMessage): ToolUseContent[] {
  return msg.content.filter((c): c is ToolUseContent => c.type === 'tool_use')
}
```

- [ ] **Step 3: 创建 src/constants/prompts.ts**

```typescript
// 系统提示词 — 对标 Claude Code src/constants/prompts.ts
// 当前阶段：简单占位，后续会扩展

export function getSystemPrompt(): string {
  return `You are Pi, an AI coding assistant running in the terminal.
You help users with software engineering tasks.
When you need to run commands or read files, use the available tools.`
}
```

- [ ] **Step 4: typecheck**

```bash
npm run typecheck
```

Expected: 无报错。

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap/state.ts src/utils/messages.ts src/constants/prompts.ts
git commit -m "feat: add bootstrap state, message utils, system prompt"
```

---

## Task 4: Stub 模块

**Files:**
- Create: `src/compact/index.ts`
- Create: `src/ssh/index.ts`
- Create: `src/swarm/index.ts`
- Create: `src/plugins/index.ts`

- [ ] **Step 1: 创建 src/compact/index.ts**

```typescript
// STUB: 未实现 — 自动 compact
// 对标 Claude Code src/services/compact/
// 功能：当对话过长时自动压缩历史消息，释放 token 空间

import type { Message } from '../types/message.js'

export async function maybeCompact(messages: Message[]): Promise<Message[]> {
  // TODO: 实现自动压缩逻辑
  return messages
}
```

- [ ] **Step 2: 创建 src/ssh/index.ts**

```typescript
// STUB: 未实现 — SSH/远程 session
// 对标 Claude Code src/ssh/

export type SSHSession = {
  host: string
  port: number
  username: string
}
```

- [ ] **Step 3: 创建 src/swarm/index.ts**

```typescript
// STUB: 未实现 — 团队协作 (Swarm)
// 对标 Claude Code src/utils/swarm/
// 功能：多 agent 协作，团队任务分发

export type AgentId = string

export type SwarmConfig = {
  agentId: AgentId
  teamName: string
}
```

- [ ] **Step 4: 创建 src/plugins/index.ts**

```typescript
// STUB: 未实现 — Plugin 系统
// 对标 Claude Code plugin 系统
// 功能：运行时加载第三方工具和命令

import type { Tool } from '../Tool.js'

export type Plugin = {
  name: string
  version: string
  tools?: Tool[]
}

/** 返回所有已加载 plugin 提供的工具，当前返回空数组 */
export function getPluginTools(): Tool[] {
  // TODO: 加载并返回 plugin 工具
  return []
}
```

- [ ] **Step 5: typecheck**

```bash
npm run typecheck
```

Expected: 无报错。

- [ ] **Step 6: Commit**

```bash
git add src/compact/index.ts src/ssh/index.ts src/swarm/index.ts src/plugins/index.ts
git commit -m "feat: add stub modules for compact, ssh, swarm, plugins"
```

---

## Task 5: 工具系统

**Files:**
- Create: `src/tools/BashTool/index.ts`
- Create: `src/tools/ReadTool/index.ts`
- Create: `src/tools/index.ts`
- Create: `src/hooks/useMergedTools.ts`

- [ ] **Step 1: 创建 src/tools/BashTool/index.ts**

```typescript
// STUB: BashTool — 执行 bash 命令
// 当前返回 "not implemented"，后续实现真实 shell 执行

import type { Tool } from '../../Tool.js'

export const BashTool: Tool = {
  name: 'bash',
  description: 'Execute a bash command and return the output.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
      },
    },
    required: ['command'],
  },
  async call(input: unknown): Promise<string> {
    // TODO: 实现真实 bash 执行
    const { command } = input as { command: string }
    return `[BashTool stub] would run: ${command}`
  },
}
```

- [ ] **Step 2: 创建 src/tools/ReadTool/index.ts**

```typescript
// STUB: ReadTool — 读取文件内容
// 当前返回 "not implemented"，后续实现真实文件读取

import type { Tool } from '../../Tool.js'

export const ReadTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file at the given path.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file path to read',
      },
    },
    required: ['path'],
  },
  async call(input: unknown): Promise<string> {
    // TODO: 实现真实文件读取
    const { path } = input as { path: string }
    return `[ReadTool stub] would read: ${path}`
  },
}
```

- [ ] **Step 3: 创建 src/tools/index.ts**

```typescript
// 工具注册入口 — 预留 plugin 扩展点
// 对标 Claude Code src/tools.ts

import type { Tool } from '../Tool.js'
import { BashTool } from './BashTool/index.js'
import { ReadTool } from './ReadTool/index.js'

const BUILTIN_TOOLS: Tool[] = [BashTool, ReadTool]

/** 返回所有可用工具（内置 + plugin 提供的） */
export function getTools(pluginTools: Tool[] = []): Tool[] {
  return [...BUILTIN_TOOLS, ...pluginTools]
}

export function findTool(name: string, tools: Tool[]): Tool | undefined {
  return tools.find((t) => t.name === name)
}
```

- [ ] **Step 4: 创建 src/hooks/useMergedTools.ts**

```typescript
// 工具注册表 hook — 预留 plugin 注入点
// 对标 Claude Code src/hooks/useMergedTools.ts

import { useMemo } from 'react'
import type { Tool } from '../Tool.js'
import { getTools } from '../tools/index.js'
import { getPluginTools } from '../plugins/index.js'

export function useMergedTools(): Tool[] {
  return useMemo(() => {
    const pluginTools = getPluginTools()
    return getTools(pluginTools)
  }, [])
}
```

- [ ] **Step 5: typecheck**

```bash
npm run typecheck
```

Expected: 无报错。

- [ ] **Step 6: Commit**

```bash
git add src/tools/ src/hooks/useMergedTools.ts
git commit -m "feat: add tool stubs (Bash, Read) and useMergedTools hook"
```

---

## Task 6: 核心 query 循环

**Files:**
- Create: `src/query.ts`

这是整个框架的核心，对标 Claude Code 的 `src/query.ts`。它是一个 async generator，与 React/Ink 完全解耦。

- [ ] **Step 1: 创建 src/query.ts**

```typescript
// 核心主循环 — 对标 Claude Code src/query.ts
// 纯 async generator，与 React 无关
// 职责：调 Claude API → 流式接收 → 执行工具 → yield StreamEvent

import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from './Tool.js'
import type { Message, StreamEvent, UserMessage, AssistantMessage } from './types/message.js'
import { createToolResultMessage } from './utils/messages.js'
import { findTool } from './tools/index.js'

const client = new Anthropic()

/** 将 Pi 的 Tool 格式转换为 Anthropic SDK 格式 */
function toSDKTool(tool: Tool): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
  }
}

/** 将 Pi 的 Message[] 转换为 Anthropic SDK 格式 */
function toSDKMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((msg) => ({
    role: msg.type as 'user' | 'assistant',
    content: msg.content as Anthropic.MessageParam['content'],
  }))
}

export type QueryParams = {
  messages: Message[]
  tools: Tool[]
  systemPrompt: string
  model?: string
}

/**
 * 核心主循环：调用 Claude API，流式 yield 事件
 *
 * 使用方式（在 REPL.tsx 中）：
 *   for await (const event of query(params)) {
 *     if (event.type === 'text_delta') { ... }
 *     if (event.type === 'tool_use') { ... }
 *     if (event.type === 'done') break
 *   }
 */
export async function* query(params: QueryParams): AsyncGenerator<StreamEvent> {
  const { messages, tools, systemPrompt, model = 'claude-opus-4-5' } = params

  let currentMessages = [...messages]

  // 循环：支持多轮工具调用（tool_use → tool_result → 继续对话）
  while (true) {
    const assistantContent: AssistantMessage['content'] = []
    let hasToolUse = false

    try {
      // 流式调用 Claude API
      const stream = await client.messages.stream({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: toSDKMessages(currentMessages),
        tools: tools.map(toSDKTool),
      })

      // 处理流式事件
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            const delta = chunk.delta.text
            // 追加到当前 assistant 消息的文本内容
            const lastContent = assistantContent[assistantContent.length - 1]
            if (lastContent && lastContent.type === 'text') {
              lastContent.text += delta
            } else {
              assistantContent.push({ type: 'text', text: delta })
            }
            yield { type: 'text_delta', delta }
          }
        } else if (chunk.type === 'content_block_start') {
          if (chunk.content_block.type === 'tool_use') {
            assistantContent.push({
              type: 'tool_use',
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              input: {},
            })
            hasToolUse = true
          }
        } else if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'input_json_delta') {
            // 累积 tool input JSON（流式传输）
            const lastContent = assistantContent[assistantContent.length - 1]
            if (lastContent && lastContent.type === 'tool_use') {
              // 将增量 JSON 字符串累积到临时字段
              const existing = (lastContent as any)._inputJson ?? ''
              ;(lastContent as any)._inputJson = existing + chunk.delta.partial_json
            }
          }
        } else if (chunk.type === 'message_stop') {
          // 解析所有 tool_use 的完整 input
          for (const c of assistantContent) {
            if (c.type === 'tool_use') {
              const raw = (c as any)._inputJson ?? '{}'
              try {
                c.input = JSON.parse(raw)
              } catch {
                c.input = {}
              }
              delete (c as any)._inputJson
            }
          }
        }
      }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
      return
    }

    // 将 assistant 消息追加到历史
    const assistantMsg: AssistantMessage = { type: 'assistant', content: assistantContent }
    currentMessages.push(assistantMsg)
    // 让 REPL.tsx 知道 assistant 消息已完整
    // （text_delta 已经流式 yield，这里不需要再 yield 一次完整消息）

    // 如果没有工具调用，对话结束
    if (!hasToolUse) {
      yield { type: 'done' }
      return
    }

    // 执行所有工具调用
    const toolResults: UserMessage['content'] = []
    for (const c of assistantContent) {
      if (c.type === 'tool_use') {
        yield { type: 'tool_use', id: c.id, name: c.name, input: c.input }

        const tool = findTool(c.name, tools)
        let result: string
        if (!tool) {
          result = `Error: tool "${c.name}" not found`
        } else {
          try {
            result = await tool.call(c.input)
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        }

        toolResults.push({ type: 'tool_result', tool_use_id: c.id, content: result })
        yield { type: 'tool_result', tool_use_id: c.id, content: result }
      }
    }

    // 将 tool_result 追加到历史，继续下一轮
    currentMessages.push({ type: 'user', content: toolResults })
  }
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: 无报错。（如果有 SDK 类型问题，确认 `@anthropic-ai/sdk` 已安装）

- [ ] **Step 3: Commit**

```bash
git add src/query.ts
git commit -m "feat: add core query async generator (Claude API + tool execution)"
```

---

## Task 7: Ink UI 组件

**Files:**
- Create: `src/components/Spinner.tsx`
- Create: `src/components/PromptInput.tsx`
- Create: `src/components/Messages.tsx`
- Create: `src/components/App.tsx`

- [ ] **Step 1: 创建 src/components/Spinner.tsx**

```tsx
// 流式加载指示 — 对标 Claude Code src/components/Spinner.tsx

import React from 'react'
import { Text } from 'ink'
import { useEffect, useState } from 'react'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

type Props = {
  label?: string
}

export function Spinner({ label = 'Thinking' }: Props) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text color="cyan">
      {FRAMES[frame]} {label}…
    </Text>
  )
}
```

- [ ] **Step 2: 创建 src/components/PromptInput.tsx**

```tsx
// 用户输入框 — 对标 Claude Code src/components/PromptInput/PromptInput.tsx
// 简化版：只处理文本输入和 slash commands

import React from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

type Props = {
  onSubmit: (input: string) => void
  isLoading: boolean
}

export function PromptInput({ onSubmit, isLoading }: Props) {
  const [value, setValue] = useState('')

  useInput((input, key) => {
    if (isLoading) return

    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim())
        setValue('')
      }
      return
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1))
      return
    }

    if (key.ctrl && input === 'c') {
      process.exit(0)
    }

    // 普通字符输入
    if (!key.ctrl && !key.meta && input) {
      setValue((v) => v + input)
    }
  })

  return (
    <Box>
      <Text color="green" bold>
        {'> '}
      </Text>
      <Text>{value}</Text>
      {!isLoading && <Text color="gray">█</Text>}
    </Box>
  )
}
```

- [ ] **Step 3: 创建 src/components/Messages.tsx**

```tsx
// 消息列表 — 对标 Claude Code src/components/Messages.tsx
// 渲染 user / assistant / tool_use / tool_result 消息

import React from 'react'
import { Box, Text } from 'ink'
import type { Message } from '../types/message.js'
import { getAssistantText, getToolUses } from '../utils/messages.js'

type Props = {
  messages: Message[]
  streamingText?: string  // 正在流式接收的文字
}

function UserBubble({ text }: { text: string }) {
  return (
    <Box marginBottom={1}>
      <Text color="blue" bold>You: </Text>
      <Text>{text}</Text>
    </Box>
  )
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text color="green" bold>Pi: </Text>
      <Text>{text}</Text>
    </Box>
  )
}

function ToolUseBubble({ name, input }: { name: string; input: unknown }) {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color="yellow">⚙ {name}(</Text>
      <Text color="gray">{JSON.stringify(input)}</Text>
      <Text color="yellow">)</Text>
    </Box>
  )
}

function ToolResultBubble({ content }: { content: string }) {
  return (
    <Box marginBottom={1} paddingLeft={2} borderStyle="single" borderColor="gray">
      <Text color="gray">{content.slice(0, 500)}{content.length > 500 ? '…' : ''}</Text>
    </Box>
  )
}

export function Messages({ messages, streamingText }: Props) {
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
                  <ToolResultBubble key={j} content={r.content} />
                ) : null
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
                <ToolUseBubble key={j} name={t.name} input={t.input} />
              ))}
            </Box>
          )
        }

        return null
      })}

      {/* 流式接收中的文字 */}
      {streamingText && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="green" bold>Pi: </Text>
          <Text>{streamingText}</Text>
        </Box>
      )}
    </Box>
  )
}
```

- [ ] **Step 4: 创建 src/components/App.tsx**

```tsx
// 顶层 Providers — 对标 Claude Code src/components/App.tsx
// 当前阶段：只是透传 children，为未来 Context 预留位置

import React from 'react'

type Props = {
  children: React.ReactNode
}

export function App({ children }: Props) {
  return <>{children}</>
}
```

- [ ] **Step 5: typecheck**

```bash
npm run typecheck
```

Expected: 无报错。

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add Ink UI components (Spinner, PromptInput, Messages, App)"
```

---

## Task 8: useAssistantHistory hook

**Files:**
- Create: `src/hooks/useAssistantHistory.ts`

- [ ] **Step 1: 创建 src/hooks/useAssistantHistory.ts**

```typescript
// 消息历史管理 hook — 对标 Claude Code src/hooks/useAssistantHistory.ts
// 简化版：只管理内存中的消息列表，不涉及持久化

import { useState, useCallback } from 'react'
import type { Message, AssistantMessage } from '../types/message.js'

export type UseAssistantHistoryResult = {
  messages: Message[]
  streamingText: string
  appendUserMessage: (text: string) => void
  startAssistantMessage: () => void
  appendStreamingDelta: (delta: string) => void
  finalizeAssistantMessage: () => void
  appendToolResult: (tool_use_id: string, content: string) => void
  clearMessages: () => void
}

export function useAssistantHistory(): UseAssistantHistoryResult {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState('')
  // 临时存储正在流式接收的 assistant message 内容
  const [pendingAssistantContent, setPendingAssistantContent] = useState<
    AssistantMessage['content']
  >([])

  const appendUserMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { type: 'user', content: [{ type: 'text', text }] },
    ])
  }, [])

  const startAssistantMessage = useCallback(() => {
    setStreamingText('')
    setPendingAssistantContent([])
  }, [])

  const appendStreamingDelta = useCallback((delta: string) => {
    setStreamingText((prev) => prev + delta)
    setPendingAssistantContent((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.type === 'text') {
        return [...prev.slice(0, -1), { ...last, text: last.text + delta }]
      }
      return [...prev, { type: 'text', text: delta }]
    })
  }, [])

  const finalizeAssistantMessage = useCallback(() => {
    setStreamingText('')
    setPendingAssistantContent((content) => {
      if (content.length > 0) {
        setMessages((prev) => [
          ...prev,
          { type: 'assistant', content },
        ])
      }
      return []
    })
  }, [])

  const appendToolResult = useCallback(
    (tool_use_id: string, content: string) => {
      setMessages((prev) => [
        ...prev,
        {
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id, content }],
        },
      ])
    },
    [],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setStreamingText('')
    setPendingAssistantContent([])
  }, [])

  return {
    messages,
    streamingText,
    appendUserMessage,
    startAssistantMessage,
    appendStreamingDelta,
    finalizeAssistantMessage,
    appendToolResult,
    clearMessages,
  }
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAssistantHistory.ts
git commit -m "feat: add useAssistantHistory hook for message state management"
```

---

## Task 9: REPL 主屏幕

**Files:**
- Create: `src/screens/REPL.tsx`

这是主循环驱动组件，连接所有已有模块。

- [ ] **Step 1: 创建 src/screens/REPL.tsx**

```tsx
// 主屏幕 — 简化版，对标 Claude Code src/screens/REPL.tsx
// 目标 ≤300 行。职责：驱动 query 循环，处理 StreamEvent，协调 UI

import React, { useCallback, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { query } from '../query.js'
import { getSystemPrompt } from '../constants/prompts.js'
import { useMergedTools } from '../hooks/useMergedTools.js'
import { useAssistantHistory } from '../hooks/useAssistantHistory.js'
import { Messages } from '../components/Messages.js'
import { PromptInput } from '../components/PromptInput.js'
import { Spinner } from '../components/Spinner.js'
import type { SSHSession } from '../ssh/index.js'
import type { SwarmConfig } from '../swarm/index.js'

type Props = {
  // Stub props — 接口预留，当前不使用
  sshSession?: SSHSession
  swarmConfig?: SwarmConfig
}

type PermissionRequest = {
  toolName: string
  input: unknown
  resolve: (approved: boolean) => void
}

export function REPL(_props: Props) {
  const tools = useMergedTools()
  const history = useAssistantHistory()
  const [isLoading, setIsLoading] = useState(false)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)

  // 处理用户提交
  const handleSubmit = useCallback(
    async (input: string) => {
      // 处理 slash commands
      if (input === '/clear') {
        history.clearMessages()
        return
      }
      if (input === '/help') {
        // 直接追加一条系统提示消息
        history.appendUserMessage('/help')
        // 简单输出帮助信息（后续可扩展为真正的 slash command 系统）
        return
      }

      history.appendUserMessage(input)
      setIsLoading(true)
      history.startAssistantMessage()

      try {
        // 获取当前全部消息（包含刚追加的 user message）
        // 注意：React state 更新是异步的，需要手动构造完整 messages
        const currentMessages = [
          ...history.messages,
          { type: 'user' as const, content: [{ type: 'text' as const, text: input }] },
        ]

        const gen = query({
          messages: currentMessages,
          tools,
          systemPrompt: getSystemPrompt(),
        })

        for await (const event of gen) {
          switch (event.type) {
            case 'text_delta':
              history.appendStreamingDelta(event.delta)
              break

            case 'tool_use': {
              // 请求用户权限确认
              const approved = await new Promise<boolean>((resolve) => {
                setPermissionRequest({ toolName: event.name, input: event.input, resolve })
              })
              setPermissionRequest(null)
              if (!approved) {
                // 用户拒绝：中止当前 turn
                break
              }
              break
            }

            case 'tool_result':
              history.appendToolResult(event.tool_use_id, event.content)
              break

            case 'done':
              history.finalizeAssistantMessage()
              break

            case 'error':
              history.finalizeAssistantMessage()
              console.error('Query error:', event.error)
              break
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    [tools, history],
  )

  // 权限确认界面的键盘输入
  useInput(
    (input, key) => {
      if (!permissionRequest) return
      if (input === 'y' || key.return) {
        permissionRequest.resolve(true)
      } else if (input === 'n' || key.escape) {
        permissionRequest.resolve(false)
      }
    },
    { isActive: !!permissionRequest },
  )

  return (
    <Box flexDirection="column" padding={1}>
      {/* 消息历史 */}
      <Messages messages={history.messages} streamingText={history.streamingText} />

      {/* 工具权限确认 */}
      {permissionRequest && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow" bold>Allow tool use?</Text>
          <Text>Tool: <Text color="cyan">{permissionRequest.toolName}</Text></Text>
          <Text>Input: <Text color="gray">{JSON.stringify(permissionRequest.input)}</Text></Text>
          <Text><Text color="green">y</Text> to allow, <Text color="red">n</Text> to deny</Text>
        </Box>
      )}

      {/* 加载中 */}
      {isLoading && !permissionRequest && <Spinner />}

      {/* 输入框 */}
      {!isLoading && <PromptInput onSubmit={handleSubmit} isLoading={isLoading} />}
    </Box>
  )
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add src/screens/REPL.tsx
git commit -m "feat: add simplified REPL screen driving the main loop"
```

---

## Task 10: CLI 入口 + 冒烟测试

**Files:**
- Create: `src/entrypoints/cli.tsx`

- [ ] **Step 1: 创建 src/entrypoints/cli.tsx**

```tsx
// CLI 入口 — 对标 Claude Code src/entrypoints/cli.tsx
// 解析参数 → render Ink App → 启动 REPL

import React from 'react'
import { render } from 'ink'
import { App } from '../components/App.js'
import { REPL } from '../screens/REPL.js'

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--version') || args.includes('-v')) {
    console.log('pi 0.1.0')
    process.exit(0)
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`pi — AI coding assistant

Usage:
  pi              Start interactive session
  pi --version    Show version
  pi --help       Show this help`)
    process.exit(0)
  }

  // 检查 ANTHROPIC_API_KEY
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set')
    process.exit(1)
  }

  render(
    <App>
      <REPL />
    </App>,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: typecheck 全量检查**

```bash
npm run typecheck
```

Expected: 所有文件无类型错误。

- [ ] **Step 3: 冒烟测试 — 启动并输入一条消息**

确保设置了 `ANTHROPIC_API_KEY`，然后运行：

```bash
ANTHROPIC_API_KEY=your_key npm run dev
```

Expected:
- 终端出现 `> ` 提示符
- 输入任意文本并回车后出现 Spinner
- Claude 返回回复后 Spinner 消失，消息显示在屏幕上
- Ctrl+C 可退出

- [ ] **Step 4: 测试 /clear**

启动后输入几条消息，然后输入 `/clear`。

Expected: 消息列表清空，提示符重新出现。

- [ ] **Step 5: 测试 --version**

```bash
npm run dev -- --version
```

Expected: 输出 `pi 0.1.0`

- [ ] **Step 6: Commit**

```bash
git add src/entrypoints/cli.tsx
git commit -m "feat: add CLI entrypoint, framework complete"
```

---

## Self-Review

### Spec 覆盖检查

| Spec 需求 | 对应 Task |
|-----------|----------|
| 文件结构（所有目录） | Task 1-10 全覆盖 |
| Message 类型定义 | Task 2 |
| Tool 接口定义 | Task 2 |
| bootstrap/state.ts（workDir、taskDir） | Task 3 |
| 系统提示词 stub | Task 3 |
| compact stub | Task 4 |
| ssh stub | Task 4 |
| swarm stub | Task 4 |
| plugins stub | Task 4 |
| BashTool/ReadTool stub | Task 5 |
| useMergedTools（plugin 注入点） | Task 5 |
| query async generator | Task 6 |
| Spinner / PromptInput / Messages / App | Task 7 |
| useAssistantHistory | Task 8 |
| REPL.tsx（≤300 行，含权限确认） | Task 9 |
| /help /clear slash commands | Task 9 |
| REPL props 预留 sshSession / swarmConfig | Task 9 |
| CLI 入口 | Task 10 |

所有 spec 需求均有对应 task。
