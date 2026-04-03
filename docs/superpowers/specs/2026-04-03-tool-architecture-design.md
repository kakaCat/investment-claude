# Pi 工具架构设计

**日期**: 2026-04-03  
**目标**: 实现对标 Claude Code 的工具加载与链接架构，不实现工具的具体逻辑

---

## Goal

为 Pi 搭建一套完整的工具架构层：工具如何定义、如何注册、如何传递执行上下文、如何渲染 UI、如何按需动态发现。工具的具体执行逻辑（如真实 bash 执行、文件读写）保持 stub，架构完成后再逐个实现。

---

## Architecture

对标 Claude Code 的静态注册 + 动态发现模式：

- `buildTool` 工厂函数统一创建工具，填充默认值
- 每个工具独立文件夹，包含实现、UI 组件、描述文本
- `src/tools/index.ts` 中心注册表，静态 import 所有内置工具
- `isEnabled()` — 工具运行时自决是否可用
- `searchHint` — 工具声明自己的关键词，供 ToolSearchTool 检索
- `deferLoading` — 工具太多时标记为延迟加载，不占初始 context
- `ToolSearchTool` — 模型用它按需发现 deferLoading 工具（含 skill 包装的工具）
- `ToolUseContext` 执行上下文从 query 循环贯穿到 `tool.call()`
- `Messages.tsx` 通过 `renderToolUse` / `renderToolResult` 渲染自定义 UI

---

## Tech Stack

TypeScript、React、Ink 5（终端 UI）、@anthropic-ai/sdk

---

## 文件清单

| 文件 | 角色 | 变化类型 |
|------|------|---------|
| `src/Tool.ts` | Tool 接口 + ToolUseContext + buildTool | 修改 |
| `src/tools/index.ts` | 注册表 getTools/getActiveTools/findTool | 修改 |
| `src/tools/BashTool/BashTool.ts` | BashTool 定义（stub call） | 重构 |
| `src/tools/BashTool/UI.tsx` | BashTool Ink UI 组件 | 新增 |
| `src/tools/BashTool/prompt.ts` | BashTool description 文本 | 新增 |
| `src/tools/ReadTool/ReadTool.ts` | ReadTool 定义（stub call） | 重构 |
| `src/tools/ReadTool/UI.tsx` | ReadTool Ink UI 组件 | 新增 |
| `src/tools/ReadTool/prompt.ts` | ReadTool description 文本 | 新增 |
| `src/tools/ToolSearchTool/ToolSearchTool.ts` | 动态工具发现工具 | 新增 |
| `src/tools/ToolSearchTool/UI.tsx` | ToolSearchTool UI | 新增 |
| `src/query.ts` | executeTools 传入 ToolUseContext；传递 activeTools | 修改 |
| `src/components/Messages.tsx` | 调用 tool.renderToolUse/renderToolResult | 修改 |
| `src/screens/REPL.tsx` | 把 tools 传给 Messages | 修改 |

---

## 详细设计

### 1. `src/Tool.ts` — 核心接口层

```typescript
import type React from 'react'

/** 工具执行上下文（对标 Claude Code ToolUseContext，简化版） */
export type ToolUseContext = {
  abortSignal: AbortSignal
  cwd: string
  /** 当前所有工具（ToolSearchTool 需要访问完整工具列表） */
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
  /**
   * 工具搜索关键词（对标 Claude Code searchHint）。
   * ToolSearchTool 用它做文本匹配，未设置则只匹配 name/description。
   */
  searchHint?: string
  /**
   * 是否延迟加载（对标 Claude Code deferLoading）。
   * true = 工具存在但不放入初始 context，等模型用 ToolSearchTool 发现后才激活。
   */
  deferLoading?: boolean
  /** 运行时决定工具是否可用（对标 Claude Code isEnabled） */
  isEnabled(): boolean
  /** 是否只读（不修改文件/系统状态） */
  isReadOnly(): boolean
  /** 执行工具，返回结果字符串 */
  call(input: unknown, context: ToolUseContext): Promise<string>
  /** 工具调用中展示的 UI（Ink 组件） */
  renderToolUse(input: unknown): React.ReactNode
  /** 工具结果展示的 UI（Ink 组件） */
  renderToolResult(result: string): React.ReactNode
}

/** buildTool 的输入定义（call 必填，其余有默认值） */
export type ToolDef = Pick<Tool, 'name' | 'description' | 'inputSchema' | 'call'> &
  Partial<Omit<Tool, 'name' | 'description' | 'inputSchema' | 'call'>>

/** 工具工厂：填充所有默认值 */
export function buildTool(def: ToolDef): Tool {
  return {
    isEnabled:        () => true,
    isReadOnly:       () => false,
    deferLoading:     false,
    renderToolUse:    (input)  => defaultRenderToolUse(def.name, input),
    renderToolResult: (result) => defaultRenderToolResult(result),
    ...def,
  }
}
```

**默认 UI**（同文件，使用 Ink）：
- `defaultRenderToolUse(name, input)` — 显示工具名 + 序列化 input（灰色）
- `defaultRenderToolResult(result)` — 显示结果字符串，超过 500 字符截断

---

### 2. `src/tools/index.ts` — 注册表

```typescript
import { BashTool } from './BashTool/BashTool.js'
import { ReadTool } from './ReadTool/ReadTool.js'
import { ToolSearchTool } from './ToolSearchTool/ToolSearchTool.js'

// 内置工具静态列表 — 新增工具在此加一行 import + 加入数组
const BUILTIN_TOOLS: Tool[] = [BashTool, ReadTool, ToolSearchTool]

/** 所有工具（含 isEnabled=false 的），用于 ToolSearchTool 搜索 */
export function getAllTools(pluginTools: Tool[] = []): Tool[] {
  return [...BUILTIN_TOOLS, ...pluginTools]
}

/**
 * 传给模型的激活工具：isEnabled() 且 deferLoading=false。
 * deferLoading 工具不放入初始 context，等 ToolSearchTool 激活。
 */
export function getActiveTools(pluginTools: Tool[] = []): Tool[] {
  return getAllTools(pluginTools).filter(t => t.isEnabled() && !t.deferLoading)
}

export function findTool(name: string, tools: Tool[]): Tool | undefined {
  return tools.find(t => t.name === name)
}
```

---

### 3. 工具文件夹结构（以 BashTool 为例）

**`BashTool/prompt.ts`**：
```typescript
export const DESCRIPTION = 'Execute a bash command in a shell and return the output.'
export const SEARCH_HINT = 'run commands, shell, terminal, execute, script'
```

**`BashTool/UI.tsx`**：
```tsx
// BashToolUseUI: cyan 色代码框显示将要执行的命令
// BashToolResultUI: 显示输出结果（区分正常输出 / 错误）
export function BashToolUseUI({ input }: { input: { command: string } }) { ... }
export function BashToolResultUI({ result }: { result: string }) { ... }
```

**`BashTool/BashTool.ts`**：
```typescript
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { BashToolUseUI, BashToolResultUI } from './UI.js'

export const BashTool = buildTool({
  name: 'bash',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: { command: { type: 'string', description: 'The bash command to run' } },
    required: ['command'],
  },
  isReadOnly: () => false,
  renderToolUse:    input  => <BashToolUseUI input={input as { command: string }} />,
  renderToolResult: result => <BashToolResultUI result={result} />,
  async call(input, _context) {
    // TODO: 真实 bash 执行（Phase 2）
    const { command } = input as { command: string }
    return `[BashTool stub] would run: ${command}`
  },
})
```

---

### 4. ToolSearchTool — 动态工具发现

工具太多时（或工具标记了 `deferLoading: true`），模型调用此工具按关键词搜索可用工具。

**触发时机**：`getActiveTools()` 返回的工具中包含 ToolSearchTool 本身，模型可以随时调用它。

**`ToolSearchTool/ToolSearchTool.ts`**：
```typescript
export const ToolSearchTool = buildTool({
  name: 'tool_search',
  description: 'Search for available tools by keyword. Use when you need a tool but are not sure if it exists.',
  searchHint: 'find tools, discover, search tools, what tools',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keywords' },
      max_results: { type: 'number', description: 'Max results to return (default 5)' },
    },
    required: ['query'],
  },
  isReadOnly: () => true,
  async call(input, context) {
    const { query, max_results = 5 } = input as { query: string; max_results?: number }
    const allTools = context.tools  // 从 ToolUseContext 拿完整工具列表（含 deferLoading）

    // 文本匹配：name + description + searchHint
    const matches = allTools
      .filter(t => t.isEnabled())
      .filter(t => matchesTool(t, query))
      .slice(0, max_results)

    if (matches.length === 0) {
      return `No tools found matching "${query}".`
    }

    return matches
      .map(t => `- **${t.name}**: ${t.description}`)
      .join('\n')
  },
})

function matchesTool(tool: Tool, query: string): boolean {
  const q = query.toLowerCase()
  return (
    tool.name.toLowerCase().includes(q) ||
    tool.description.toLowerCase().includes(q) ||
    (tool.searchHint ?? '').toLowerCase().includes(q)
  )
}
```

**`ToolSearchTool/UI.tsx`**：
```tsx
// ToolSearchUseUI: 显示搜索关键词
// ToolSearchResultUI: 列表展示匹配到的工具名 + 描述
```

---

### 5. `src/query.ts` — ToolUseContext 注入

`QueryParams` 新增 `toolUseContext` 字段，`executeTools` 构造完整 context：

```typescript
export type QueryParams = {
  messages: Message[]
  tools: Tool[]          // getActiveTools() 的结果（传给模型）
  allTools?: Tool[]      // getAllTools() 的结果（传给 ToolUseContext，供 ToolSearchTool 用）
  systemPrompt: string
  model?: string
  maxTurns?: number
  abortSignal?: AbortSignal
  canUseTool?: CanUseTool
}

// executeTools 内部构造 ToolUseContext：
const context: ToolUseContext = {
  abortSignal: abortSignal ?? new AbortController().signal,
  cwd: process.cwd(),
  tools: params.allTools ?? params.tools,  // ToolSearchTool 能看到所有工具
}
result = await tool.call(c.input, context)
```

---

### 6. `src/components/Messages.tsx` — 工具 UI 渲染

```typescript
type Props = {
  messages: Message[]
  streamingText?: string
  tools: Tool[]   // 新增，用于查找工具的 render 方法
}

// ToolUseBubble:
//   findTool(name, tools)?.renderToolUse(input) ?? defaultRenderToolUse(name, input)
//
// ToolResultBubble:
//   从 messages 里通过 tool_use_id 反查工具名
//   findTool(toolName, tools)?.renderToolResult(content) ?? defaultRenderToolResult(content)
```

### 7. `src/screens/REPL.tsx` — 透传 tools

```tsx
// REPL 用 getActiveTools() 传给 query（模型只看到激活工具）
// 同时把 tools 传给 Messages 用于渲染
const tools = useMergedTools()  // 内部调用 getActiveTools()

<Messages messages={history.messages} streamingText={history.streamingText} tools={tools} />

query({
  messages: currentMessages,
  tools,                          // 激活工具（传给 API）
  allTools: getAllTools(),         // 全部工具（传给 ToolUseContext）
  systemPrompt: getSystemPrompt(),
  canUseTool,
  abortSignal: abortController.signal,
})
```

---

## 数据流

```
启动时
  getActiveTools()  →  [BashTool, ReadTool, ToolSearchTool]  →  传给模型

用户输入
  → REPL.handleSubmit()
  → query({ tools: activeTools, allTools: getAllTools() })
      → streamOneTurn()               # API 流式响应（模型只看到 activeTools）
      → executeTools(context)
          → canUseTool()              # 权限检查
          → tool.call(input, { tools: allTools })  # ToolSearchTool 能访问全部
          → yield tool_use / tool_result
  → Messages 渲染
      → tool.renderToolUse(input)     # 自定义 UI
      → tool.renderToolResult(result)

模型调用 ToolSearchTool("read file")
  → matchesTool 遍历 allTools
  → 返回匹配工具列表（含 deferLoading 工具）
  → 模型下一轮调用找到的工具
```

---

## 不在本次范围内

- 工具的真实执行逻辑（bash、文件读写等）
- MCP 工具集成
- skill 文件目录加载（skill 包装成 Tool 的机制）
- 权限黑名单规则（`getDenyRuleForTool`）
- ToolUseContext 扩展字段（messages、permissions 等）
