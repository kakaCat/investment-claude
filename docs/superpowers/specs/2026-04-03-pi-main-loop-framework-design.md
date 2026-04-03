# Pi 主循环框架设计

**日期**: 2026-04-03  
**状态**: 已确认  
**参考**: Claude Code 源码 `/Users/mac/Documents/ai/learn-claude-code/claude-code`

---

## 目标

实现 Pi 的架构骨架：文件结构 + 接口定义 + 可运行的简化主循环。

Pi 是一个基于 React + Ink 的 AI agent CLI 工具，对标 Claude Code 架构，边学习边上线。

---

## 技术栈

- **运行时**: Node.js / Bun
- **UI 框架**: React + [Ink](https://github.com/vadimdemedes/ink)（终端 UI）
- **语言**: TypeScript
- **AI SDK**: `@anthropic-ai/sdk`

---

## 文件结构

```
src/
├── entrypoints/
│   └── cli.tsx              # 入口：解析 CLI 参数 → render Ink App
│
├── screens/
│   └── REPL.tsx             # 主屏幕（简化版，目标 ≤300 行）
│
├── components/
│   ├── App.tsx              # 顶层 Providers 包装（对标 CC App.tsx）
│   ├── Messages.tsx         # 消息列表展示
│   ├── PromptInput.tsx      # 用户输入框（Ink TextInput 封装）
│   └── Spinner.tsx          # 流式加载指示
│
├── hooks/
│   ├── useAssistantHistory.ts   # 消息历史管理（对标 CC useAssistantHistory）
│   └── useMergedTools.ts        # 工具注册表，预留 plugin 注入点
│
├── query.ts                 # 核心：async generator，调 Claude API + 执行工具
│
├── Tool.ts                  # Tool 接口定义
│
├── tools/
│   ├── index.ts             # 工具注册入口，预留 plugin 扩展点
│   ├── BashTool/
│   │   └── index.ts         # stub
│   └── ReadTool/
│       └── index.ts         # stub
│
├── types/
│   └── message.ts           # Message 类型定义
│
├── constants/
│   └── prompts.ts           # 系统提示词（stub）
│
├── bootstrap/
│   └── state.ts             # 全局会话状态（路径、session 信息）
│
├── utils/
│   └── messages.ts          # createUserMessage / createAssistantMessage 等
│
│   ── stub 模块（接口预留，内部不实现）──
│
├── compact/
│   └── index.ts             # 自动 compact stub
│
├── ssh/
│   └── index.ts             # SSH/远程 session stub
│
├── swarm/
│   └── index.ts             # 团队协作 stub
│
└── plugins/
    └── index.ts             # Plugin 系统 stub
```

---

## 核心数据流

```
用户输入（PromptInput）
        ↓
REPL.tsx → handleSubmit(input)
        ↓
  append UserMessage → messages
        ↓
query(messages, tools, systemPrompt)    ← query.ts
        ↓  async generator，yield StreamEvent
   ┌────┴──────────────────────────────┐
   │  text_delta  → 更新 AssistantMessage 内容
   │  tool_use    → 显示权限确认 → 执行工具 → append ToolResult
   │  done        → isLoading = false
   └────────────────────────────────────┘
        ↓
Messages.tsx 重新渲染
```

---

## 关键接口定义

### Message 类型（types/message.ts）

```ts
type Role = 'user' | 'assistant'

type TextContent = { type: 'text'; text: string }
type ToolUseContent = { type: 'tool_use'; id: string; name: string; input: unknown }
type ToolResultContent = { type: 'tool_result'; tool_use_id: string; content: string }

type UserMessage = {
  type: 'user'
  content: Array<TextContent | ToolResultContent>
}

type AssistantMessage = {
  type: 'assistant'
  content: Array<TextContent | ToolUseContent>
}

type Message = UserMessage | AssistantMessage
```

### Tool 接口（Tool.ts）

```ts
interface Tool {
  name: string
  description: string
  inputSchema: object          // JSON Schema
  call(input: unknown): Promise<string>
}
```

### StreamEvent（query.ts yield 的事件）

```ts
type StreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: 'done' }
  | { type: 'error'; error: Error }

async function* query(
  messages: Message[],
  tools: Tool[],
  systemPrompt: string,
): AsyncGenerator<StreamEvent>
```

### 全局状态（bootstrap/state.ts）

```ts
type State = {
  originalCwd: string      // 启动目录
  projectRoot: string      // 项目根目录
  workDir: string          // 当前工作目录
  taskDir: string          // 任务存储目录 ~/.pi/tasks/
  sessionId: string
}
```

---

## REPL.tsx 简化范围

### 当前阶段实现

- 消息历史（`useState<Message[]>`）
- 流式接收并更新 AssistantMessage
- 工具执行（调 `tool.call()`）
- 工具执行前权限确认（终端 y/n 提示）
- Spinner（流式中显示）
- 基础 slash command：`/help`、`/clear`

### Stub 预留（接口存在，逻辑为空）

- Plugin 系统：`useMergedTools` 预留 plugin 工具注入口
- 自动 compact：`compact/index.ts` 导出 `maybeCompact()` 空函数，REPL.tsx import 但不调用
- SSH/远程 session：`ssh/index.ts` 导出类型，REPL.tsx props 预留 `sshSession?: SSHSession`
- Swarm/团队协作：`swarm/index.ts` 导出类型，REPL.tsx props 预留 `agentId?: string`

### 裁掉

- 语音输入

---

## Stub 模块规范

每个 stub 模块需要：
1. 导出完整的 TypeScript 类型（让 REPL.tsx 能正确 import）
2. 导出空实现函数（避免运行时报错）
3. 文件顶部注释标注 `// STUB: 未实现`

示例（compact/index.ts）：
```ts
// STUB: 未实现
export async function maybeCompact(_messages: Message[]): Promise<Message[]> {
  return _messages
}
```

---

## 与 Claude Code 对照关系

| Pi 文件 | Claude Code 对应 | 说明 |
|---------|-----------------|------|
| `screens/REPL.tsx` | `src/screens/REPL.tsx` | 简化版，≤300 行 |
| `query.ts` | `src/query.ts` | 保留核心 stream + tool 执行逻辑 |
| `components/App.tsx` | `src/components/App.tsx` | 顶层 Provider |
| `bootstrap/state.ts` | `src/bootstrap/state.ts` | 全局状态 |
| `types/message.ts` | `src/types/message.ts` | 消息类型 |
| `hooks/useAssistantHistory.ts` | `src/hooks/useAssistantHistory.ts` | 消息历史 |
| `hooks/useMergedTools.ts` | `src/hooks/useMergedTools.ts` | 工具注册表 |
| `compact/` | `src/services/compact/` | stub |
| `ssh/` | `src/ssh/` | stub |
| `swarm/` | `src/utils/swarm/` | stub |
| `plugins/` | plugin 系统 | stub |
