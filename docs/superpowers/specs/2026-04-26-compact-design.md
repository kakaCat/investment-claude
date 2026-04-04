# Context Compression Design

**Date**: 2026-04-26  
**Status**: Approved  
**Reference**: Claude Code `src/services/compact/` + `src/services/SessionMemory/`

---

## 1. 目标

实现对标 Claude Code 的全量上下文压缩系统，支持 4 种压缩模式：

| 模式 | 触发方式 | 对标 CC |
|------|---------|---------|
| Auto | token 超阈值自动触发 | `autoCompactIfNeeded()` |
| Manual | 用户输入 `/compact` | `/compact` 命令 |
| Session Memory | auto 时先尝试轻量压缩 | `trySessionMemoryCompaction()` |
| Partial | 选定消息为轴，只压缩一部分 | `partialCompactConversation()` |

---

## 2. 架构总览

### 目录结构

```
src/
  compact/
    index.ts          ← compactConversation(), partialCompactConversation()
    autoCompact.ts    ← shouldAutoCompact(), autoCompactIfNeeded(), token 阈值计算
    sessionMemory.ts  ← trySessionMemoryCompaction()（读取 SM 文件构建摘要）
    prompt.ts         ← 移植 CC 的 9 段式 prompt（BASE / PARTIAL / UP_TO 三种模板）
  sessionMemory/
    index.ts          ← initSessionMemory(), extractSessionMemoryIfNeeded(), manuallyExtract()
    utils.ts          ← 状态跟踪（对标 CC sessionMemoryUtils.ts）
    prompts.ts        ← SM 文件模板 + update prompt（9 节结构）
    path.ts           ← getSessionMemoryPath() → .claude/session-memory/notes.md
```

### 数据流

```
每轮 query 开始（query.ts while 循环顶部）
    ↓
autoCompactIfNeeded(currentMessages)
    ├── token < 阈值 → 跳过
    └── token ≥ 阈值
         ↓
        trySessionMemoryCompaction()
         ├── SM 文件有内容 → 截断保留最近消息，构建 CompactResult，替换 currentMessages
         └── SM 文件为空/不满足条件 → null
              ↓
             compactConversation()（全量，调 API）
              └── 替换 currentMessages，yield compact_start / compact_done 事件

每轮 done 事件后（REPL.tsx）
    └── fire-and-forget: extractSessionMemoryIfNeeded(messages)

/compact 命令（REPL.tsx handleSubmit）
    └── compactConversation() → history.replaceMessages()

Partial compact（REPL.tsx 消息选择模式）
    └── partialCompactConversation(messages, pivotIndex, direction) → history.replaceMessages()
```

---

## 3. 类型变更

### `src/types/message.ts`

新增压缩边界消息类型：

```ts
export type CompactBoundaryMessage = {
  type: 'compact_boundary'
  trigger: 'auto' | 'manual' | 'partial'
  preCompactTokenCount: number
}

// Message union 新增 CompactBoundaryMessage
export type Message = UserMessage | AssistantMessage | CompactBoundaryMessage
```

### `src/types/stream.ts`（或 query.ts 内的 StreamEvent）

```ts
// 新增两种事件
| { type: 'compact_start' }
| { type: 'compact_done'; savedTokens: number; summaryLength: number; newMessages: Message[] }
```

---

## 4. `src/compact/prompt.ts`

直接移植 CC `services/compact/prompt.ts`，删除 Pi 不需要的部分：

**保留**：
- `BASE_COMPACT_PROMPT`（9 节摘要模板）
- `PARTIAL_COMPACT_PROMPT`（仅压缩尾部）
- `PARTIAL_COMPACT_UP_TO_PROMPT`（仅压缩头部）
- `NO_TOOLS_PREAMBLE` / `NO_TOOLS_TRAILER`
- `formatCompactSummary()`（剥离 `<analysis>` 草稿块）
- `getCompactPrompt()`、`getPartialCompactPrompt()`
- `getCompactUserSummaryMessage()`

**删除**：
- `proactiveModule` 相关代码（Pi 无 proactive 模式）

---

## 5. `src/compact/index.ts`

### 接口

```ts
export type CompactResult = {
  newMessages: Message[]   // [CompactBoundaryMessage, summaryUserMessage, ...reinjected]
  savedTokens: number
  summaryLength: number
}

export async function compactConversation(
  messages: Message[],
  options?: {
    suppressFollowUpQuestions?: boolean
    customInstructions?: string
    isAutoCompact?: boolean
  }
): Promise<CompactResult>

export async function partialCompactConversation(
  allMessages: Message[],
  pivotIndex: number,
  direction: 'from' | 'up_to'
): Promise<CompactResult>
```

### `compactConversation()` 流程

1. 估算 token 数：`roughTokenCount(messages) = Math.floor(JSON.stringify(messages).length / 4)`
2. 构建 `summaryRequest`：`getCompactPrompt(customInstructions)`
3. 调 Anthropic API（同 query.ts 的 `streamOneTurn`，但工具列表为空）
4. `formatCompactSummary()` 格式化摘要
5. 构建新消息数组：
   ```
   [CompactBoundaryMessage, summaryUserMessage, todoReminderIfNeeded]
   ```
6. 返回 `CompactResult`

**错误处理**：
- API 调用失败 → 抛出错误，调用方处理（auto compact 静默失败，manual 显示错误）
- 摘要为空 → 抛出 `'Failed to generate summary'`

### `partialCompactConversation()` 流程

1. 按 `direction` 切分：
   - `'from'`：压缩 `messages[pivotIndex:]`，保留 `messages[:pivotIndex]`
   - `'up_to'`：压缩 `messages[:pivotIndex]`，保留 `messages[pivotIndex:]`
2. 调 API 对切分部分生成摘要（用 `getPartialCompactPrompt(undefined, direction)`）
3. 构建新消息数组：
   - `'from'`：`[...keptMessages, CompactBoundary, summaryMsg]`
   - `'up_to'`：`[CompactBoundary, summaryMsg, ...keptMessages]`
4. 返回 `CompactResult`

---

## 6. `src/compact/autoCompact.ts`

### 常量

```ts
const CONTEXT_WINDOW = 200_000          // claude-3-5 默认
const MAX_OUTPUT_TOKENS_RESERVE = 20_000
const AUTOCOMPACT_BUFFER = 13_000
// 有效阈值 = 200k - 20k - 13k = 167k tokens
```

### 接口

```ts
export function roughTokenCount(messages: Message[]): number
export function getAutoCompactThreshold(): number
export function shouldAutoCompact(messages: Message[]): boolean

export async function autoCompactIfNeeded(
  messages: Message[]
): Promise<{ wasCompacted: boolean; result?: CompactResult }>
```

### `autoCompactIfNeeded()` 流程

```
shouldAutoCompact() → false → return { wasCompacted: false }
                    → true
                         ↓
                    trySessionMemoryCompaction()
                         ├── 成功 → return { wasCompacted: true, result }
                         └── null
                              ↓
                         compactConversation(..., { isAutoCompact: true })
                              ├── 成功 → return { wasCompacted: true, result }
                              └── 失败 → return { wasCompacted: false }（静默）
```

**熔断机制**（对标 CC `MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3`）：  
维护 `consecutiveFailures` 计数，连续失败 3 次后停止尝试。

---

## 7. `src/compact/sessionMemory.ts`

```ts
export async function trySessionMemoryCompaction(
  messages: Message[],
  threshold: number
): Promise<CompactResult | null>
```

流程：
1. `waitForSessionMemoryExtraction()`（最多等 15s）
2. 读取 SM 文件内容（`getSessionMemoryContent()`）
3. 若为空 → 返回 null
4. 截断到 40k token（`truncateSessionMemoryForCompact()`）
5. 计算可保留的最近消息（token 预算 50%，至少 5 条有文本的消息）
6. 构建：`[CompactBoundary, smSummaryMsg, ...recentMessages]`
7. 返回 `CompactResult`

---

## 8. `src/sessionMemory/`

### 8.1 `path.ts`

```ts
export function getSessionMemoryDir(): string  // ~/.claude/session-memory/
export function getSessionMemoryPath(): string  // ~/.claude/session-memory/notes.md
```

### 8.2 `utils.ts`（对标 CC `sessionMemoryUtils.ts`）

状态（module-level 变量）：

```ts
let sessionMemoryConfig: SessionMemoryConfig   // 初始化阈值、更新间隔、工具调用次数
let lastSummarizedMessageId: string | undefined
let extractionPromise: Promise<void> | undefined  // 替代 CC 的 extractionStartedAt
let tokensAtLastExtraction: number
let sessionMemoryInitialized: boolean
```

导出函数（直接对标 CC）：
- `shouldExtractMemory(messages)`
- `markExtractionStarted()` / `markExtractionCompleted()`
- `waitForSessionMemoryExtraction()`（等待 `extractionPromise`，15s timeout）
- `getSessionMemoryContent()`
- `hasMetInitializationThreshold()` / `hasMetUpdateThreshold()`
- `getToolCallsBetweenUpdates()`
- `resetSessionMemoryState()`（测试用）

**默认配置**（对标 CC）：

```ts
const DEFAULT_CONFIG = {
  minimumMessageTokensToInit: 10_000,
  minimumTokensBetweenUpdate: 5_000,
  toolCallsBetweenUpdates: 3,
}
```

### 8.3 `prompts.ts`（对标 CC `SessionMemory/prompts.ts`）

直接移植：
- `DEFAULT_SESSION_MEMORY_TEMPLATE`（9 节 markdown 结构）
- `buildSessionMemoryUpdatePrompt(currentMemory, memoryPath)`
- `truncateSessionMemoryForCompact(content, maxTokens = 40_000)`
- `isSessionMemoryEmpty(content)`

### 8.4 `index.ts`

```ts
export function initSessionMemory(): void
// 设置好状态，供 REPL 在每轮 done 后调用 extractSessionMemoryIfNeeded

export async function extractSessionMemoryIfNeeded(
  messages: Message[]
): Promise<void>
// apiKey 直接读 process.env.ANTHROPIC_API_KEY
// shouldExtractMemory() → false → 返回
// 已有进行中的 extraction → 跳过
// 否则 fire-and-forget 调 Anthropic API（仅 EditFile 权限，限定 SM 文件）

export async function manuallyExtractSessionMemory(
  messages: Message[]
): Promise<{ success: boolean; memoryPath?: string; error?: string }>
// apiKey 直接读 process.env.ANTHROPIC_API_KEY
// 绕过阈值检查，直接提取（供 /summary 命令使用）
```

**提取机制（替代 CC 的 `runForkedAgent`）**：

1. 读取 SM 文件当前内容
2. 用 `buildSessionMemoryUpdatePrompt()` 构建 prompt
3. 创建独立 Anthropic client，调一次 API（`max_tokens: 4096`，工具只有 `EditFile`，且 `canUseTool` 只允许编辑 SM 文件）
4. 提取完成后调 `recordExtractionTokenCount()` + `updateLastSummarizedMessageIdIfSafe()`

---

## 9. 现有文件变更

### `src/hooks/useAssistantHistory.ts`

新增方法：

```ts
replaceMessages: (messages: Message[]) => void
// 用于 /compact 和 partial compact 替换全部历史
```

### `src/query.ts`

在 `while (true)` 循环**顶部**加：

```ts
// Auto compact 检查
const compactResult = await autoCompactIfNeeded(currentMessages)
if (compactResult.wasCompacted && compactResult.result) {
  currentMessages = compactResult.result.newMessages
  yield { type: 'compact_start' }
  yield {
    type: 'compact_done',
    savedTokens: compactResult.result.savedTokens,
    summaryLength: compactResult.result.summaryLength,
  }
}
```

### `src/screens/REPL.tsx`

**1. `/compact` 命令**（在 handleSubmit slash command 区）：

```ts
if (input === '/compact') {
  setIsLoading(true)
  try {
    const result = await compactConversation(history.messages, {
      suppressFollowUpQuestions: false,
    })
    history.replaceMessages(result.newMessages)
  } catch (err) {
    // 显示错误提示
  } finally {
    setIsLoading(false)
  }
  return
}
```

**2. Session Memory 提取（每轮 done 后）**：

```ts
case 'done':
  history.finalizeAssistantMessage()
  // fire-and-forget SM 提取
  void extractSessionMemoryIfNeeded(history.messages, process.env.ANTHROPIC_API_KEY!)
  break
```

**3. compact 事件处理**：

```ts
case 'compact_start':
  // 显示 "Compressing conversation..." 提示
  break
case 'compact_done':
  history.replaceMessages(event.newMessages)
  // 显示 "Compressed, saved ~X tokens"
  break
```

> **注意**：auto compact 时 `currentMessages` 在 `query.ts` 内更新，通过 `compact_done` 事件携带 `newMessages` 传给 REPL，REPL 收到后调 `history.replaceMessages()`，保证 React state 与 query 内部状态同步。

**4. Partial compact 消息选择模式**：

新增 UI 状态：

```ts
const [isSelectingMessage, setIsSelectingMessage] = useState(false)
const [selectedMessageIndex, setSelectedMessageIndex] = useState(0)
```

触发：用户输入 `/compact partial`

操作：
- `j/k` 上下导航消息列表，高亮选中消息
- 选中后显示菜单：`[f] compact from here` / `[u] compact up to here` / `[Esc] cancel`
- 确认后调 `partialCompactConversation()`，替换历史

---

## 10. 不实现的 CC 功能

以下 CC 功能在 Pi 中跳过（复杂度高、收益低）：

| CC 功能 | 原因 |
|---------|------|
| `promptCacheSharingEnabled`（forked agent 共享缓存前缀） | Pi 无 prompt cache 优化 |
| PTL retry（prompt-too-long 截断重试） | 可后续加，首版跳过 |
| Pre/Post compact hooks | Pi 无 hook 系统 |
| `reAppendSessionMetadata` | Pi 无 session 持久化 |
| Analytics / logEvent | Pi 无分析系统 |
| `stripImagesFromMessages` | Pi 当前无图片消息 |
| `KAIROS` / `PROACTIVE` feature flags | Pi 不涉及 |

---

## 11. 测试范围

| 测试项 | 方式 |
|--------|------|
| `roughTokenCount` 估算精度 | 单元测试，对比已知字符串 |
| `shouldAutoCompact` 阈值边界 | 单元测试 |
| `formatCompactSummary` 剥离 `<analysis>` | 单元测试 |
| `compactConversation` 输出结构 | Mock API，验证 newMessages 结构 |
| `trySessionMemoryCompaction` 空文件场景 | 单元测试 |
| `shouldExtractMemory` 触发条件 | 单元测试（直接用 sessionMemoryUtils） |
| `/compact` 命令 E2E | 手动测试 |
| Auto compact 触发 E2E | 设置低阈值（env var）手动触发 |
