# Pi Agent 无限循环问题修复方案

## 📋 问题概述

**问题来源**: 分析日志 `.pi/logs/session-ob-20260412201504-797910.jsonl`

**核心问题**:
1. ❌ `send_file` 被重复调用 8 次
2. ❌ 网络工具被疯狂调用（4次 web_fetch + 2次 browser）
3. ❌ 用户被迫手动中断 5 次（5个 session_end）
4. ❌ Agent 不知道何时停止

**根本原因**:
- System prompt 强制规则："always call send_file"
- 只依赖不可靠的 `stopReason` 判断循环退出
- `maxTurns` 检查位置错误
- 缺少工具调用去重机制
- 缺少"任务完成"的自我认知

---

## 🎯 优化目标

1. **消除无限循环** - Agent 能自主判断何时停止
2. **减少重复工具调用** - 同一工具不重复调用
3. **精确控制轮数** - maxTurns 生效
4. **提升用户体验** - 减少不必要的中断

---

## 📐 设计方案

### 方案 A：最小改动方案（推荐）

**改动范围**: 3 个文件
**风险等级**: 低
**预计工时**: 2-3 小时

#### 1. 移除强制 send_file 规则

**文件**: `src/constants/promptSections.ts`

```typescript
// ❌ 删除
export const IDENTITY = `You are Pi, an AI coding assistant running in the terminal.
You help users with software engineering tasks.
When you need to run commands or read files, use the available tools.

Tool usage rules:
- After writing or creating a file with write_file or edit_file, always call send_file with the file path so the user can see it.
- When you are unsure how to proceed, use ask_followup_question to ask the user.
- Do NOT narrate or describe what you are about to do before calling a tool. Call the tool directly. The tool result and UI will speak for themselves.`

// ✅ 改为
export const IDENTITY = `You are Pi, an AI coding assistant running in the terminal.
You help users with software engineering tasks.
When you need to run commands or read files, use the available tools.

Tool usage rules:
- When you are unsure how to proceed, use ask_followup_question to ask the user.
- Do NOT narrate or describe what you are about to do before calling a tool. Call the tool directly. The tool result and UI will speak for themselves.`
```

**理由**: 
- Claude Code 没有这条规则
- "always" 太绝对，导致机械重复
- send_file 应该是可选的，不是强制的

#### 2. 添加 needsFollowUp 标志

**文件**: `src/query.ts`

```typescript
// 在主循环中添加（第 435 行附近）
while (true) {
  // ... 现有代码
  
  // ✅ 新增：追踪是否有工具调用
  let needsFollowUp = false
  const pendingToolUses: ToolUseContent[] = []
  
  // 在流式接收循环中
  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      if (event.content_block.type === 'tool_use') {
        needsFollowUp = true  // ✅ 标记有工具调用
        // ... 现有逻辑
      }
    }
    // ... 其他事件处理
  }
  
  // ✅ 新增：循环退出检查
  if (!needsFollowUp) {
    // 没有工具调用 → 对话结束
    messages = [...messagesForQuery, assistantMsg]
    yield { type: 'messages_snapshot', messages: [...messages] }
    
    const stopHookResult = await executeHooks({
      hook_event_name: 'Stop',
      stop_reason: 'done',
      session_id: sessionId,
      cwd: toolUseContext.cwd,
      messages,
    })
    
    if (stopHookResult.blockingErrors?.length) {
      messages = [...messages, ...stopHookResult.blockingErrors]
      continue  // 重试
    }
    
    yield { type: 'done' }
    return  // ✅ 退出循环
  }
  
  // ❌ 删除旧的退出检查
  // if (stopReason !== 'tool_use') { ... }
  
  // ... 继续执行工具
}
```

**理由**:
- Claude Code 的核心机制
- 不依赖不可靠的 `stopReason`
- 明确的退出信号

#### 3. 修正 maxTurns 检查位置

**文件**: `src/query.ts`

```typescript
// ❌ 删除旧位置（第 685 行）
// if (maxTurns && turnCount >= maxTurns) {
//   yield { type: 'max_turns_reached', turnCount }
//   return
// }

// ✅ 移到循环开始（第 435 行附近）
while (true) {
  // 1. 首先检查 maxTurns
  if (maxTurns && turnCount >= maxTurns) {
    yield { type: 'max_turns_reached', turnCount }
    return
  }
  
  // 2. 然后执行其他逻辑
  let messagesForQuery = getMessagesAfterCompactBoundary(messages)
  // ...
  
  // 3. 轮末递增
  turnCount++
}
```

**理由**:
- 精确控制轮数
- 避免多执行一轮
- 与 Claude Code 一致

---

### 方案 B：完整优化方案

**改动范围**: 5 个文件
**风险等级**: 中
**预计工时**: 1-2 天

在方案 A 基础上增加：

#### 4. 工具调用去重

**文件**: `src/query.ts`

```typescript
// 在 query 函数顶部添加
type ToolCallKey = string  // `${toolName}:${JSON.stringify(input)}`
const recentToolCalls = new Map<ToolCallKey, number>()  // key → timestamp
const DUPLICATE_WINDOW_MS = 5000  // 5秒内算重复

function isDuplicateToolCall(toolName: string, input: unknown): boolean {
  const key = `${toolName}:${JSON.stringify(input)}`
  const lastCall = recentToolCalls.get(key)
  const now = Date.now()
  
  if (lastCall && now - lastCall < DUPLICATE_WINDOW_MS) {
    return true  // 重复调用
  }
  
  recentToolCalls.set(key, now)
  
  // 清理过期记录（超过 1 分钟）
  for (const [k, ts] of recentToolCalls.entries()) {
    if (now - ts > 60000) {
      recentToolCalls.delete(k)
    }
  }
  
  return false
}

// 在权限检查中使用
async function* checkToolPermissions(...) {
  for (const toolUse of toolUses) {
    // ✅ 检查重复
    if (isDuplicateToolCall(toolUse.name, toolUse.input)) {
      yield { 
        type: 'tool_denied', 
        tool_use_id: toolUse.id, 
        name: toolUse.name,
        reason: 'Duplicate tool call within 5 seconds'
      }
      denied.push({ 
        toolUse, 
        reason: 'Tool was called with identical parameters 5 seconds ago. Skipping to avoid redundant work.'
      })
      continue
    }
    
    // ... 原有权限检查
  }
}
```

#### 5. 连续失败检测

**文件**: `src/query.ts`

```typescript
// 在主循环中添加
let consecutiveToolFailures = 0
const MAX_CONSECUTIVE_FAILURES = 3

// 在工具执行后检查
const hasFailures = toolResultData.content.some(c => 
  c.type === 'tool_result' && 
  typeof c.content === 'string' && 
  c.content.startsWith('Error:')
)

if (hasFailures) {
  consecutiveToolFailures++
  if (consecutiveToolFailures >= MAX_CONSECUTIVE_FAILURES) {
    yield { 
      type: 'error', 
      error: new Error(`Too many consecutive tool failures (${consecutiveToolFailures})`)
    }
    return  // 退出
  }
} else {
  consecutiveToolFailures = 0  // 重置
}
```

#### 6. 改进 System Prompt

**文件**: `src/constants/promptSections.ts`

```typescript
export const DOING_TASKS = `# Doing Tasks
- Read files before modifying them; understand existing code before suggesting changes.
- Do not create files unless absolutely necessary. Prefer editing existing files.
- Do not add features, refactor, or "improve" code beyond what was asked.
- Do not add comments, docstrings, or type annotations to code you didn't change.
- Do not add error handling for scenarios that can't happen. Trust internal code guarantees.
- Chase root causes, not symptoms. Every decision should answer "why".

# Task Completion
- When a task is complete, stop working. Do not continue optimizing or adding features.
- If you just sent a file to the user, the task is likely complete unless they ask for changes.
- User questions about your process (e.g., "how did you do that?") do NOT require redoing the work.
- If a tool call fails repeatedly (3+ times), stop and explain the issue to the user instead of retrying.`
```

#### 7. 状态管理重构

**文件**: `src/query.ts`

```typescript
// 定义 State 类型
type QueryState = {
  messages: Message[]
  toolUseContext: ToolUseContext
  turnCount: number
  maxTokensRecoveryAttempts: number
  consecutiveToolFailures: number
  recentToolCalls: Map<string, number>
  transition?: {
    reason: 'next_turn' | 'max_tokens_recovery' | 'stop_hook_blocking'
    metadata?: Record<string, unknown>
  }
}

// 使用 State 对象
let state: QueryState = {
  messages: initialMessages,
  toolUseContext,
  turnCount: 0,
  maxTokensRecoveryAttempts: 0,
  consecutiveToolFailures: 0,
  recentToolCalls: new Map(),
}

// 每次 continue 创建新 state
state = {
  ...state,
  messages: [...messagesForQuery, assistantMsg, toolResultMsg],
  turnCount: state.turnCount + 1,
  transition: { reason: 'next_turn' }
}
```

---

## 🧪 测试计划

### 单元测试

**文件**: `src/__tests__/query-loop-exit.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { query } from '../query'

describe('Query Loop Exit Conditions', () => {
  it('should exit when no tool_use blocks are present', async () => {
    const mockStream = [
      { type: 'content_block_start', content_block: { type: 'text' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Done!' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' } }
    ]
    
    const events = []
    for await (const event of query({ messages: [], tools: [], systemPrompt: '' })) {
      events.push(event)
    }
    
    expect(events).toContainEqual({ type: 'done' })
  })
  
  it('should respect maxTurns limit', async () => {
    const events = []
    for await (const event of query({ 
      messages: [], 
      tools: [], 
      systemPrompt: '',
      maxTurns: 2
    })) {
      events.push(event)
    }
    
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'max_turns_reached', turnCount: 2 })
    )
  })
  
  it('should detect duplicate tool calls', async () => {
    // Mock 两次相同的 send_file 调用
    const mockToolUses = [
      { id: '1', name: 'send_file', input: { path: 'test.html' } },
      { id: '2', name: 'send_file', input: { path: 'test.html' } }  // 重复
    ]
    
    const events = []
    for await (const event of query({ 
      messages: [], 
      tools: [sendFileTool], 
      systemPrompt: '' 
    })) {
      events.push(event)
    }
    
    expect(events).toContainEqual(
      expect.objectContaining({ 
        type: 'tool_denied',
        reason: expect.stringContaining('Duplicate')
      })
    )
  })
  
  it('should exit after consecutive tool failures', async () => {
    // Mock 3 次连续失败
    const mockFailures = Array(3).fill({
      type: 'tool_result',
      content: 'Error: Tool failed'
    })
    
    const events = []
    for await (const event of query({ 
      messages: [], 
      tools: [], 
      systemPrompt: '' 
    })) {
      events.push(event)
    }
    
    expect(events).toContainEqual(
      expect.objectContaining({ 
        type: 'error',
        error: expect.objectContaining({
          message: expect.stringContaining('consecutive tool failures')
        })
      })
    )
  })
})
```

### 集成测试

**文件**: `src/__tests__/query-integration.test.ts`

```typescript
describe('Query Integration Tests', () => {
  it('should handle the Beijing-Tianjin trip scenario without infinite loop', async () => {
    const messages = [
      { type: 'user', content: [{ type: 'text', text: '做一个可执行的北京到天津旅行一日游,待一个html' }] }
    ]
    
    const events = []
    let toolCallCount = 0
    
    for await (const event of query({ messages, tools: allTools, systemPrompt })) {
      events.push(event)
      if (event.type === 'tool_use') {
        toolCallCount++
      }
      
      // 安全阀：超过 20 个工具调用就失败
      if (toolCallCount > 20) {
        throw new Error('Infinite loop detected: too many tool calls')
      }
    }
    
    // 验证正常退出
    expect(events).toContainEqual({ type: 'done' })
    
    // 验证 send_file 不重复
    const sendFileCount = events.filter(e => 
      e.type === 'tool_use' && e.name === 'send_file'
    ).length
    expect(sendFileCount).toBeLessThanOrEqual(2)  // 最多 2 次
  })
})
```

### 手动测试场景

1. **场景 1: 简单文件创建**
   ```
   用户: "创建一个 hello.txt 文件，内容是 Hello World"
   预期: write_file → 完成（不调用 send_file）
   ```

2. **场景 2: 用户追问**
   ```
   用户: "创建一个 test.html"
   Agent: write_file → 完成
   用户: "你用的是什么模板？"
   预期: 回答问题（不重新 write_file 或 send_file）
   ```

3. **场景 3: 网络工具失败**
   ```
   用户: "获取北京天气"
   Agent: web_fetch → 失败
   Agent: web_fetch → 失败
   Agent: web_fetch → 失败
   预期: 第 3 次失败后停止，告知用户
   ```

4. **场景 4: maxTurns 限制**
   ```
   maxTurns = 3
   预期: 第 3 轮后停止，不执行第 4 轮
   ```

---

## 📅 实施计划

### Phase 1: 方案 A（1 天）

**Day 1 上午**:
- [ ] 修改 `src/constants/promptSections.ts`（移除 send_file 规则）
- [ ] 添加单元测试

**Day 1 下午**:
- [ ] 修改 `src/query.ts`（添加 needsFollowUp）
- [ ] 修正 maxTurns 位置
- [ ] 运行测试

**Day 1 晚上**:
- [ ] 手动测试 4 个场景
- [ ] 修复发现的问题

### Phase 2: 方案 B（可选，2 天）

**Day 2**:
- [ ] 实现工具调用去重
- [ ] 实现连续失败检测
- [ ] 添加测试

**Day 3**:
- [ ] 改进 System Prompt
- [ ] 状态管理重构
- [ ] 完整回归测试

---

## 🎯 验收标准

### 必须满足（方案 A）

- [ ] 日志中 send_file 调用次数 ≤ 2
- [ ] 没有无限循环（工具调用总数 < 20）
- [ ] maxTurns 精确生效
- [ ] 所有单元测试通过
- [ ] 4 个手动测试场景通过

### 期望满足（方案 B）

- [ ] 5 秒内无重复工具调用
- [ ] 3 次连续失败后自动停止
- [ ] 状态管理清晰可追踪
- [ ] 集成测试通过

---

## 🚨 风险评估

### 高风险

1. **needsFollowUp 逻辑错误**
   - 风险: 误判导致提前退出或无限循环
   - 缓解: 充分测试，添加日志

2. **破坏现有功能**
   - 风险: 改动影响其他正常流程
   - 缓解: 完整回归测试

### 中风险

1. **去重逻辑过于激进**
   - 风险: 合法的重复调用被拦截
   - 缓解: 5 秒窗口期，可配置

2. **失败检测误报**
   - 风险: 正常错误被当作连续失败
   - 缓解: 只计算真正的工具执行失败

### 低风险

1. **System Prompt 改动**
   - 风险: LLM 行为变化
   - 缓解: 渐进式改动，A/B 测试

---

## 📊 成功指标

### 定量指标

- 工具调用重复率: < 5%
- 无限循环发生率: 0%
- maxTurns 准确率: 100%
- 平均工具调用次数: 减少 30%

### 定性指标

- 用户不再需要手动中断
- Agent 能自主判断任务完成
- 日志清晰易读

---

## 🔗 参考资料

- Claude Code 源码: `/Users/mac/Documents/ai/learn-claude-code/claude-code/src/query.ts`
- 问题日志: `.pi/logs/session-ob-20260412201504-797910.jsonl`
- 相关 Issue: (待创建)

---

**方案制定人**: Claude (Kiro)
**制定日期**: 2026-04-13
**预计完成**: 2026-04-14 (方案 A) / 2026-04-16 (方案 B)
