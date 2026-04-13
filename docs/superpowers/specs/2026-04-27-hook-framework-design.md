# Hook 框架设计方案

**Date**: 2026-04-27  
**Status**: Draft  
**Reference**: Claude Code `src/utils/hooks.ts` + `src/utils/hooks/` + `src/types/hooks.ts`

---

## 1. 目标

实现对标 Claude Code 的完整 Hook 框架，支持全部 **27 个 Hook 事件**，让用户和内部模块都可以在 Pi 生命周期的关键节点注入行为。

---

## 2. 架构总览

### 目录结构

```
src/
  hooks/
    types.ts              ← HookEvent 枚举、所有 HookInput 类型、HookResult 类型
    registry.ts           ← 注册表（settings + session + internal function hooks）
    executor.ts           ← 执行引擎（command / function hook 执行逻辑）
    settings.ts           ← 从 .claude/settings.json 读取 hook 配置
    events.ts             ← HookEvent 广播系统（对标 CC hookEvents.ts）
    postSamplingHooks.ts  ← 内部 PostSampling hook（SM 提取等）
    index.ts              ← 对外统一 export
```

### Hook 流程总览

```
settings.json
  └─ 用户定义 command hooks
                    ┐
session hooks       ├─ registry.ts 统一注册表
  └─ 运行时注册      │     ↓
                    │  executor.ts 执行引擎
internal hooks      │     ↓
  └─ registerFn()  ┘  HookResult → 调用方处理
```

---

## 3. 27 个 Hook 事件

| # | 事件名 | 触发时机 | Pi 对应位置 |
|---|--------|----------|-------------|
| 1 | `PreToolUse` | 工具执行前 | `query.ts` executeTools() |
| 2 | `PostToolUse` | 工具执行成功后 | `query.ts` executeTools() |
| 3 | `PostToolUseFailure` | 工具执行失败后 | `query.ts` executeTools() |
| 4 | `Stop` | 对话正常结束（done）前 | `query.ts` while loop |
| 5 | `StopFailure` | API 错误导致轮次结束时 | `query.ts` catch |
| 6 | `UserPromptSubmit` | 用户提交 prompt 时 | `REPL.tsx` handleSubmit |
| 7 | `SessionStart` | REPL 初始化时 | `REPL.tsx` useEffect init |
| 8 | `SessionEnd` | REPL 退出 / clear 时 | `REPL.tsx` cleanup |
| 9 | `Notification` | 发送通知时 | 通知系统调用处 |
| 10 | `PreCompact` | 压缩对话前 | `compact/index.ts` |
| 11 | `PostCompact` | 压缩对话后 | `compact/index.ts` |
| 12 | `SubagentStart` | Agent 工具启动子 agent 时 | `tools/AgentTool` |
| 13 | `SubagentStop` | 子 agent 完成时 | `tools/AgentTool` |
| 14 | `TeammateIdle` | Swarm teammate 进入 idle 时 | `swarm/` |
| 15 | `TaskCreated` | TodoWrite 创建任务时 | `tools/TodoWriteTool` |
| 16 | `TaskCompleted` | TodoWrite 标记完成时 | `tools/TodoWriteTool` |
| 17 | `PermissionRequest` | 弹出权限对话框时 | `REPL.tsx` canUseTool |
| 18 | `PermissionDenied` | 工具被拒绝后 | `query.ts` executeTools() |
| 19 | `Setup` | REPL 初始化时（仓库 setup） | `REPL.tsx` init |
| 20 | `Elicitation` | MCP server 请求用户输入时 | MCP 工具层 |
| 21 | `ElicitationResult` | 用户回应 MCP 请求后 | MCP 工具层 |
| 22 | `ConfigChange` | settings 文件变化时 | 文件监听器 |
| 23 | `WorktreeCreate` | 创建 worktree 时 | worktree 工具 |
| 24 | `WorktreeRemove` | 删除 worktree 时 | worktree 工具 |
| 25 | `InstructionsLoaded` | CLAUDE.md 文件加载时 | systemPrompt 构建时 |
| 26 | `CwdChanged` | 工作目录变化时 | cwd 变更处 |
| 27 | `FileChanged` | 被监听的文件变化时 | 文件监听器 |

---

## 4. 类型系统（`src/hooks/types.ts`）

### HookEvent

```ts
export const HOOK_EVENTS = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'Stop', 'StopFailure',
  'UserPromptSubmit',
  'SessionStart', 'SessionEnd',
  'Notification',
  'PreCompact', 'PostCompact',
  'SubagentStart', 'SubagentStop',
  'TeammateIdle',
  'TaskCreated', 'TaskCompleted',
  'PermissionRequest', 'PermissionDenied',
  'Setup',
  'Elicitation', 'ElicitationResult',
  'ConfigChange',
  'WorktreeCreate', 'WorktreeRemove',
  'InstructionsLoaded',
  'CwdChanged', 'FileChanged',
] as const

export type HookEvent = typeof HOOK_EVENTS[number]
```

### HookInput（对标 CC，每个事件有专属字段）

```ts
// 所有 hook 共有的基础字段（对标 CC createBaseHookInput）
export type BaseHookInput = {
  hook_event_name: HookEvent
  session_id: string
  cwd: string
}

// PreToolUse / PostToolUse / PostToolUseFailure
export type PreToolUseHookInput = BaseHookInput & {
  hook_event_name: 'PreToolUse'
  tool_name: string
  tool_input: unknown
}

export type PostToolUseHookInput = BaseHookInput & {
  hook_event_name: 'PostToolUse'
  tool_name: string
  tool_input: unknown
  tool_response: string
}

export type PostToolUseFailureHookInput = BaseHookInput & {
  hook_event_name: 'PostToolUseFailure'
  tool_name: string
  tool_input: unknown
  tool_error: string
}

// Stop / StopFailure
export type StopHookInput = BaseHookInput & {
  hook_event_name: 'Stop'
  stop_reason: 'done' | 'max_turns_reached'
}

export type StopFailureHookInput = BaseHookInput & {
  hook_event_name: 'StopFailure'
  error: string
}

// UserPromptSubmit
export type UserPromptSubmitHookInput = BaseHookInput & {
  hook_event_name: 'UserPromptSubmit'
  prompt: string
}

// SessionStart / SessionEnd
export type SessionStartHookInput = BaseHookInput & {
  hook_event_name: 'SessionStart'
  source: 'startup' | 'resume' | 'clear'
}

export type SessionEndHookInput = BaseHookInput & {
  hook_event_name: 'SessionEnd'
  exit_reason?: string
}

// Notification
export type NotificationHookInput = BaseHookInput & {
  hook_event_name: 'Notification'
  message: string
}

// PreCompact / PostCompact
export type PreCompactHookInput = BaseHookInput & {
  hook_event_name: 'PreCompact'
  trigger: 'auto' | 'manual' | 'partial'
}

export type PostCompactHookInput = BaseHookInput & {
  hook_event_name: 'PostCompact'
  trigger: 'auto' | 'manual' | 'partial'
  saved_tokens: number
}

// SubagentStart / SubagentStop
export type SubagentStartHookInput = BaseHookInput & {
  hook_event_name: 'SubagentStart'
  agent_id: string
}

export type SubagentStopHookInput = BaseHookInput & {
  hook_event_name: 'SubagentStop'
  agent_id: string
}

// TeammateIdle
export type TeammateIdleHookInput = BaseHookInput & {
  hook_event_name: 'TeammateIdle'
  teammate_name: string
}

// TaskCreated / TaskCompleted
export type TaskCreatedHookInput = BaseHookInput & {
  hook_event_name: 'TaskCreated'
  task_id: string
  content: string
}

export type TaskCompletedHookInput = BaseHookInput & {
  hook_event_name: 'TaskCompleted'
  task_id: string
  content: string
}

// PermissionRequest / PermissionDenied
export type PermissionRequestHookInput = BaseHookInput & {
  hook_event_name: 'PermissionRequest'
  tool_name: string
  tool_input: unknown
}

export type PermissionDeniedHookInput = BaseHookInput & {
  hook_event_name: 'PermissionDenied'
  tool_name: string
  tool_input: unknown
}

// Setup
export type SetupHookInput = BaseHookInput & {
  hook_event_name: 'Setup'
}

// Elicitation / ElicitationResult
export type ElicitationHookInput = BaseHookInput & {
  hook_event_name: 'Elicitation'
  message: string
}

export type ElicitationResultHookInput = BaseHookInput & {
  hook_event_name: 'ElicitationResult'
  result: unknown
}

// ConfigChange
export type ConfigChangeHookInput = BaseHookInput & {
  hook_event_name: 'ConfigChange'
  config_path: string
}

// WorktreeCreate / WorktreeRemove
export type WorktreeCreateHookInput = BaseHookInput & {
  hook_event_name: 'WorktreeCreate'
  worktree_path: string
  branch: string
}

export type WorktreeRemoveHookInput = BaseHookInput & {
  hook_event_name: 'WorktreeRemove'
  worktree_path: string
}

// InstructionsLoaded
export type InstructionsLoadedHookInput = BaseHookInput & {
  hook_event_name: 'InstructionsLoaded'
  file_path: string
  content_length: number
}

// CwdChanged
export type CwdChangedHookInput = BaseHookInput & {
  hook_event_name: 'CwdChanged'
  old_cwd: string
  new_cwd: string
}

// FileChanged
export type FileChangedHookInput = BaseHookInput & {
  hook_event_name: 'FileChanged'
  file_path: string
}

// 联合类型
export type HookInput =
  | PreToolUseHookInput | PostToolUseHookInput | PostToolUseFailureHookInput
  | StopHookInput | StopFailureHookInput
  | UserPromptSubmitHookInput
  | SessionStartHookInput | SessionEndHookInput
  | NotificationHookInput
  | PreCompactHookInput | PostCompactHookInput
  | SubagentStartHookInput | SubagentStopHookInput
  | TeammateIdleHookInput
  | TaskCreatedHookInput | TaskCompletedHookInput
  | PermissionRequestHookInput | PermissionDeniedHookInput
  | SetupHookInput
  | ElicitationHookInput | ElicitationResultHookInput
  | ConfigChangeHookInput
  | WorktreeCreateHookInput | WorktreeRemoveHookInput
  | InstructionsLoadedHookInput
  | CwdChangedHookInput | FileChangedHookInput
```

### HookCommand 类型（Phase 1：command + function）

```ts
// Phase 1
export type CommandHook = {
  type: 'command'
  command: string
  timeout?: number           // 秒，默认 60
  async?: boolean            // fire-and-forget
}

export type FunctionHook = {
  type: 'function'
  id?: string                // 用于移除
  callback: (input: HookInput) => Promise<void> | void
  timeout?: number
}

// Phase 2 扩展（先定义类型，实现后补）
export type PromptHook = {
  type: 'prompt'
  prompt: string
  model?: string
}

export type HttpHook = {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

export type HookCommand = CommandHook | FunctionHook | PromptHook | HttpHook
```

### HookMatcher（settings.json 配置单元）

```ts
export type HookMatcher = {
  matcher?: string           // 工具名匹配 pattern，空 = 全匹配
  hooks: HookCommand[]
}

export type HooksSettings = Partial<Record<HookEvent, HookMatcher[]>>
```

### HookResult

```ts
export type HookResult = {
  outcome: 'success' | 'blocking' | 'non_blocking_error' | 'cancelled'
  // PreToolUse 专用
  permissionDecision?: 'allow' | 'deny' | 'ask'
  updatedInput?: Record<string, unknown>
  // Stop 专用
  preventContinuation?: boolean
  stopReason?: string
  // 所有事件通用
  additionalContext?: string
  systemMessage?: string
  // UserPromptSubmit 专用
  initialUserMessage?: string
  // SessionStart 专用
  watchPaths?: string[]
}

export type AggregatedHookResult = {
  permissionDecision?: 'allow' | 'deny' | 'ask'
  updatedInput?: Record<string, unknown>
  preventContinuation?: boolean
  stopReason?: string
  additionalContexts?: string[]
  systemMessage?: string
  initialUserMessage?: string
  watchPaths?: string[]
}
```

---

## 5. 注册表（`src/hooks/registry.ts`）

三层来源合并：

```
┌─────────────────────────────────────────────┐
│              HookRegistry                   │
│                                             │
│  1. settings hooks  ← .claude/settings.json │
│  2. session hooks   ← 运行时 addHook()       │
│  3. function hooks  ← registerFn()（内部）   │
│                                             │
│  getMatchingHooks(event, matcher?) → Hook[] │
└─────────────────────────────────────────────┘
```

```ts
// 对外 API
export function registerFunctionHook(
  event: HookEvent,
  fn: FunctionHook['callback'],
  options?: { id?: string; timeout?: number }
): string  // 返回 hookId

export function removeFunctionHook(event: HookEvent, id: string): void

export function addSessionHook(
  event: HookEvent,
  matcher: string,
  hook: CommandHook,
): void

export function getMatchingHooks(
  event: HookEvent,
  matcherQuery?: string,
): HookCommand[]
```

---

## 6. 执行引擎（`src/hooks/executor.ts`）

```ts
export async function executeHooks(
  input: HookInput,
  options?: {
    signal?: AbortSignal
    timeoutMs?: number
    messages?: Message[]
    matcherQuery?: string   // 工具名等，用于 matcher 过滤
  }
): Promise<AggregatedHookResult>
```

**执行流程：**

```
getMatchingHooks(event, matcherQuery)
  ↓
for each hook:
  ├── command → spawn shell，解析 stdout JSON，mapHookResult()
  ├── function → await callback(input)
  ├── prompt → [Phase 2] 调 LLM API
  └── http → [Phase 2] POST 请求
  ↓
aggregateResults() → AggregatedHookResult
```

**Command hook 输入（JSON via env / stdin）：**

```bash
# 通过环境变量传递给 shell 命令（对标 CC）
HOOK_INPUT='{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{...},...}'
```

**Command hook 输出（stdout JSON）：**

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow"
  }
}
```

---

## 7. Settings 读取（`src/hooks/settings.ts`）

`.claude/settings.json` 格式（完全对标 CC）：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"About to run: $HOOK_INPUT\"",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude done\"'"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cat .claude/context.md 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

读取逻辑：

```ts
// 优先级：.claude/settings.local.json > .claude/settings.json > ~/.claude/settings.json
export function loadHooksSettings(): HooksSettings
```

---

## 8. 事件广播系统（`src/hooks/events.ts`）

对标 CC `hookEvents.ts`，供 UI 展示 hook 执行进度：

```ts
export type HookExecutionEvent =
  | { type: 'started'; hookEvent: string; command: string }
  | { type: 'progress'; hookEvent: string; output: string }
  | { type: 'response'; hookEvent: string; outcome: 'success'|'error'|'cancelled'; output: string }

export function registerHookEventHandler(handler: (e: HookExecutionEvent) => void): void
export function emitHookStarted(hookEvent: string, command: string): void
export function emitHookProgress(hookEvent: string, output: string): void
export function emitHookResponse(hookEvent: string, outcome: string, output: string): void
```

---

## 9. 现有文件变更

### `src/hooks/postSamplingHooks.ts`

迁移已有的内部 PostSampling hook，改用 `registerFunctionHook` 注册：

```ts
// 现在（模块级 array）
const postSamplingHooks: PostSamplingHook[] = []

// 改为
import { registerFunctionHook } from './registry.js'

export function initPostSamplingHooks(): void {
  // 由各模块自己调用 registerFunctionHook('PostSampling', ...)
}
```

> **注意**：PostSampling 不是标准 HookEvent（CC 独立处理），Pi 可选择将其融入 `Stop` 事件，或保留为单独的内部 hook 机制。

### `src/sessionMemory/index.ts`

```ts
export function initSessionMemory(): void {
  registerFunctionHook('Stop', async (input) => {
    await extractSessionMemoryIfNeeded(input.messages)
  })
}
```

### `src/query.ts`

在关键位置调用 `executeHooks()`：

```ts
// PreToolUse（工具执行前）
const hookResult = await executeHooks({
  hook_event_name: 'PreToolUse',
  tool_name: c.name,
  tool_input: c.input,
  session_id, cwd,
})
if (hookResult.permissionDecision === 'deny') { /* 拒绝 */ }

// PostToolUse（工具执行后）
await executeHooks({
  hook_event_name: 'PostToolUse',
  tool_name: c.name,
  tool_input: c.input,
  tool_response: result,
  session_id, cwd,
})

// Stop（done 前）
await executeHooks({ hook_event_name: 'Stop', stop_reason: 'done', session_id, cwd })
```

### `src/screens/REPL.tsx`

```ts
// SessionStart
await executeHooks({ hook_event_name: 'SessionStart', source: 'startup', session_id, cwd })

// UserPromptSubmit
const hookResult = await executeHooks({
  hook_event_name: 'UserPromptSubmit',
  prompt: input,
  session_id, cwd,
})

// PermissionRequest（工具弹框时）
await executeHooks({
  hook_event_name: 'PermissionRequest',
  tool_name, tool_input,
  session_id, cwd,
})
```

### `src/compact/index.ts`

```ts
// PreCompact / PostCompact
await executeHooks({ hook_event_name: 'PreCompact', trigger, session_id, cwd })
// ... compact ...
await executeHooks({ hook_event_name: 'PostCompact', trigger, saved_tokens, session_id, cwd })
```

---

## 10. 实现阶段

### Phase 1 — 框架骨架（当前目标）

| 任务 | 文件 | 说明 |
|------|------|------|
| 类型系统 | `src/hooks/types.ts` | 全部 27 事件类型 |
| 注册表 | `src/hooks/registry.ts` | settings + function hook |
| 执行引擎 | `src/hooks/executor.ts` | command + function |
| Settings 读取 | `src/hooks/settings.ts` | .claude/settings.json |
| 接入 PreToolUse/PostToolUse | `src/query.ts` | 最高优先级 |
| 接入 Stop | `src/query.ts` | 对话结束 |
| 接入 SessionStart/End | `src/screens/REPL.tsx` | |
| 接入 UserPromptSubmit | `src/screens/REPL.tsx` | |
| 接入 PreCompact/PostCompact | `src/compact/index.ts` | |
| SM 迁移 | `src/sessionMemory/index.ts` | function hook |

### Phase 2 — 扩展

| 任务 | 说明 |
|------|------|
| prompt / http hook 类型 | 实现 LLM 和 HTTP 调用 |
| matcher 过滤 | 按工具名 pattern 过滤 |
| async hook | `async: true` fire-and-forget |
| SubagentStart/Stop | Agent 工具接入 |
| TeammateIdle | Swarm 接入 |
| TaskCreated/Completed | TodoWrite 接入 |
| PermissionRequest/Denied | canUseTool 接入 |
| ConfigChange / FileChanged | 文件监听器接入 |
| WorktreeCreate/Remove | worktree 工具接入 |
| InstructionsLoaded | systemPrompt 接入 |
| CwdChanged | cwd 变更接入 |
| Elicitation/ElicitationResult | MCP 接入 |

### Phase 3 — UI

- `/hooks` 命令（展示当前注册的 hooks）
- hook 执行进度展示（spinner + output）

---

## 11. 不实现的 CC 功能（暂缓）

| CC 功能 | 原因 |
|---------|------|
| 工作区信任检查 | Pi 无 trust dialog |
| `CLAUDE_ENV_FILE` | 环境变量传递机制，后续加 |
| Plugin hooks | Pi 无 plugin settings 系统 |
| Policy hooks（disableAllHooks）| Pi 无 managed policy |
| Telemetry（tengu_run_hook） | Pi 无分析系统 |
| Beta tracing spans | Pi 无 OTEL |
| `asyncRewake` | 复杂度高，后续加 |
