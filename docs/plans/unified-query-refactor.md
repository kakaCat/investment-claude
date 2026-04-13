# 统一 Query 重构方案

## 🎯 目标

将两个改进合并为一次重构：
1. **修复无限循环问题** - 添加可靠的退出信号
2. **实现流式工具执行** - 提升用户体验

## 📋 为什么一起做？

### 优势
- ✅ 两个改进都需要重构主循环，一次性完成避免重复工作
- ✅ 流式执行本身就包含了 `pendingToolUses.length === 0` 的退出逻辑
- ✅ 减少代码变更次数，降低引入 bug 的风险
- ✅ 测试一次性覆盖两个功能

### 协同效应
```typescript
// 流式执行的设计天然包含了退出信号
const pendingToolUses: ToolUseBlock[] = []

// 流结束后
if (pendingToolUses.length === 0) {
  // ✅ 没有工具调用 → 退出（解决无限循环）
  break
}
```

---

## 🏗️ 统一架构设计

### 核心改动

```typescript
// src/query.ts - 主循环重构

export async function* query(params: QueryParams): AsyncGenerator<StreamEvent> {
  // ... 初始化
  
  while (true) {
    // ========== 1. 轮数检查（修复 maxTurns） ==========
    if (maxTurns && turnCount >= maxTurns) {
      yield { type: 'max_turns_reached', turnCount }
      return
    }
    
    // ========== 2. 构建消息 ==========
    let messagesForQuery = getMessagesAfterCompactBoundary(messages)
    messagesForQuery = await enforceToolResultBudget(messagesForQuery, replacementState)
    // ... snip, microcompact, autocompact
    
    yield { type: 'stream_request_start' }
    
    // ========== 3. 流式接收 + 收集工具调用 ==========
    const pendingToolUses: ToolUseContent[] = []
    let assistantContent: AssistantMessage['content'] = []
    let stopReason: string | null = null
    
    try {
      const stream = client.messages.stream({
        model,
        system: systemPrompt,
        messages: toSDKMessages(messagesForQuery, model),
        tools: tools.map(toSDKTool),
        max_tokens: 16000,
      }, { signal: abortSignal })
      
      // 内部流式循环
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'text') {
            assistantContent.push({ type: 'text', text: '' })
          } else if (event.content_block.type === 'tool_use') {
            assistantContent.push({
              type: 'tool_use',
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
            })
          }
        } else if (event.type === 'content_block_delta') {
          const last = assistantContent[assistantContent.length - 1]
          if (!last) continue
          
          if (event.delta.type === 'text_delta' && last.type === 'text') {
            last.text += event.delta.text
            yield { type: 'text_delta', delta: event.delta.text }
          } else if (event.delta.type === 'input_json_delta' && last.type === 'tool_use') {
            if (!('_inputJson' in last)) {
              (last as any)._inputJson = ''
            }
            (last as any)._inputJson += event.delta.partial_json
          }
        } else if (event.type === 'content_block_stop') {
          const last = assistantContent[assistantContent.length - 1]
          if (last?.type === 'tool_use' && '_inputJson' in last) {
            try {
              last.input = JSON.parse((last as any)._inputJson ?? '{}')
            } catch {
              last.input = {}
            }
            delete (last as any)._inputJson
            
            // ✅ 收集完整的 tool_use block
            pendingToolUses.push(last as ToolUseContent)
            yield {
              type: 'tool_use',
              id: last.id,
              name: last.name,
              input: last.input,
            }
          }
        } else if (event.type === 'message_delta') {
          stopReason = event.delta.stop_reason ?? null
        }
      }
    } catch (err) {
      // 错误处理
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
      return
    }
    
    // ========== 4. 退出检查（修复无限循环） ==========
    if (pendingToolUses.length === 0) {
      // ✅ 没有工具调用 → 对话结束
      const assistantMsg: AssistantMessage = {
        type: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
      }
      
      messages = [...messagesForQuery, assistantMsg]
      yield { type: 'messages_snapshot', messages: [...messages] }
      
      // Stop hooks
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
    
    // ========== 5. 权限检查（串行） ==========
    const permissionResult = yield* checkToolPermissions(
      pendingToolUses,
      tools,
      canUseTool,
      toolUseContext,
      sessionId,
    )
    
    // ========== 6. 并发执行工具 ==========
    const toolResultData = yield* executeToolsConcurrently(
      permissionResult.allowed,
      permissionResult.denied,
      toolUseContext,
      sessionId,
    )
    
    // ========== 7. 重建消息 ==========
    const assistantMsg: AssistantMessage = {
      type: 'assistant',
      content: assistantContent,
      timestamp: new Date().toISOString(),
    }
    
    const toolResultMsg: UserMessage = {
      type: 'user',
      content: toolResultData.content,
      toolUseResults: Object.keys(toolResultData.toolUseResults).length > 0
        ? toolResultData.toolUseResults
        : undefined,
    }
    
    messages = [...messagesForQuery, assistantMsg, toolResultMsg]
    yield { type: 'messages_snapshot', messages: [...messages] }
    
    // ========== 8. 下一轮 ==========
    turnCount++
  }
}
```

---

## 📝 详细改动清单

### 1. 移除 `streamOneTurn` 函数

**文件**: `src/query.ts`

```typescript
// ❌ 删除整个函数（约 100 行）
async function streamOneTurn(...) { ... }
```

**原因**: 逻辑内联到主循环，支持流式工具执行

### 2. 主循环重构

**文件**: `src/query.ts`

**改动点**:
- ✅ 添加 `pendingToolUses` 收集工具调用
- ✅ 内联流式接收逻辑
- ✅ 添加 `pendingToolUses.length === 0` 退出检查
- ✅ 移动 `maxTurns` 检查到循环开始
- ❌ 删除 `stopReason !== 'tool_use'` 检查

### 3. 提取工具执行函数

**文件**: `src/query.ts`

**新增函数**:

```typescript
// 权限检查（已存在，保持不变）
async function* checkToolPermissions(
  toolUses: ToolUseContent[],
  tools: Tool[],
  canUseTool: CanUseTool,
  context: ToolUseContext,
  sessionId: string,
): AsyncGenerator<StreamEvent, PermissionCheckResult>

// 并发执行（已存在，保持不变）
async function* executeToolsConcurrently(
  allowed: Array<{ toolUse: ToolUseContent; tool: Tool | undefined }>,
  denied: Array<{ toolUse: ToolUseContent; reason: string }>,
  context: ToolUseContext,
  sessionId: string,
): AsyncGenerator<StreamEvent, { content: UserMessage['content']; toolUseResults: Record<string, unknown> }>
```

**说明**: 这两个函数已经存在，不需要改动

### 4. 移除强制 send_file 规则

**文件**: `src/constants/promptSections.ts`

```typescript
// ❌ 删除
export const IDENTITY = `...
Tool usage rules:
- After writing or creating a file with write_file or edit_file, always call send_file with the file path so the user can see it.
...`

// ✅ 改为
export const IDENTITY = `...
Tool usage rules:
- When you are unsure how to proceed, use ask_followup_question to ask the user.
- Do NOT narrate or describe what you are about to do before calling a tool. Call the tool directly. The tool result and UI will speak for themselves.`
```

### 5. 改进 System Prompt（可选）

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
- User questions about your process do NOT require redoing the work - just answer the question.
- If a tool call fails repeatedly, stop and explain the issue instead of retrying indefinitely.`
```

---

## 🧪 测试策略

### 单元测试

**文件**: `src/__tests__/query-refactor.test.ts`

```typescript
describe('Query Refactor - Unified Tests', () => {
  describe('Exit Signal (Fix Infinite Loop)', () => {
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
      expect(events.filter(e => e.type === 'tool_use')).toHaveLength(0)
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
  })
  
  describe('Streaming Tool Execution', () => {
    it('should collect tool_use blocks during streaming', async () => {
      const mockStream = [
        { type: 'content_block_start', content_block: { type: 'tool_use', id: '1', name: 'read_file' } },
        { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"path":"test.txt"}' } },
        { type: 'content_block_stop' }
      ]
      
      const events = []
      for await (const event of query({ messages: [], tools: [readFileTool], systemPrompt: '' })) {
        events.push(event)
      }
      
      const toolUseEvents = events.filter(e => e.type === 'tool_use')
      expect(toolUseEvents).toHaveLength(1)
      expect(toolUseEvents[0]).toMatchObject({
        type: 'tool_use',
        id: '1',
        name: 'read_file',
        input: { path: 'test.txt' }
      })
    })
    
    it('should execute tools concurrently', async () => {
      const startTimes: Record<string, number> = {}
      const endTimes: Record<string, number> = {}
      
      const slowTool = {
        name: 'slow_tool',
        call: async () => {
          startTimes.slow = Date.now()
          await new Promise(resolve => setTimeout(resolve, 100))
          endTimes.slow = Date.now()
          return { data: 'slow result' }
        }
      }
      
      const fastTool = {
        name: 'fast_tool',
        call: async () => {
          startTimes.fast = Date.now()
          await new Promise(resolve => setTimeout(resolve, 10))
          endTimes.fast = Date.now()
          return { data: 'fast result' }
        }
      }
      
      // Mock 两个工具调用
      const events = []
      for await (const event of query({ 
        messages: [], 
        tools: [slowTool, fastTool], 
        systemPrompt: '' 
      })) {
        events.push(event)
      }
      
      // 验证并发执行：fast_tool 应该在 slow_tool 完成前就结束
      expect(endTimes.fast).toBeLessThan(endTimes.slow)
      expect(startTimes.fast - startTimes.slow).toBeLessThan(50) // 几乎同时开始
    })
  })
  
  describe('Integration', () => {
    it('should handle complete flow: stream → no tools → exit', async () => {
      const events = []
      for await (const event of query({ messages: [], tools: [], systemPrompt: '' })) {
        events.push(event)
      }
      
      expect(events).toEqual([
        { type: 'stream_request_start' },
        { type: 'text_delta', delta: expect.any(String) },
        { type: 'messages_snapshot', messages: expect.any(Array) },
        { type: 'done' }
      ])
    })
    
    it('should handle complete flow: stream → tools → execute → next turn', async () => {
      const events = []
      let turnCount = 0
      
      for await (const event of query({ 
        messages: [], 
        tools: [readFileTool], 
        systemPrompt: '',
        maxTurns: 2
      })) {
        events.push(event)
        if (event.type === 'messages_snapshot') {
          turnCount++
        }
      }
      
      expect(turnCount).toBeLessThanOrEqual(2)
      expect(events).toContainEqual({ type: 'done' })
    })
  })
})
```

### 集成测试

**文件**: `src/__tests__/query-integration.test.ts`

```typescript
describe('Query Integration - Real Scenarios', () => {
  it('Beijing-Tianjin trip: should not loop infinitely', async () => {
    const messages = [
      { 
        type: 'user', 
        content: [{ type: 'text', text: '做一个可执行的北京到天津旅行一日游,待一个html' }] 
      }
    ]
    
    const events = []
    let toolCallCount = 0
    let sendFileCount = 0
    
    for await (const event of query({ 
      messages, 
      tools: allTools, 
      systemPrompt,
      maxTurns: 10  // 安全阀
    })) {
      events.push(event)
      
      if (event.type === 'tool_use') {
        toolCallCount++
        if (event.name === 'send_file') {
          sendFileCount++
        }
      }
    }
    
    // 验证
    expect(events).toContainEqual({ type: 'done' })
    expect(toolCallCount).toBeLessThan(20)  // 不应该有太多工具调用
    expect(sendFileCount).toBeLessThanOrEqual(2)  // send_file 不重复
  })
  
  it('User follow-up question: should not redo work', async () => {
    const messages = [
      { type: 'user', content: [{ type: 'text', text: '创建 test.html' }] },
      { type: 'assistant', content: [{ type: 'tool_use', name: 'write_file', input: {...} }] },
      { type: 'user', content: [{ type: 'tool_result', content: 'File written' }] },
      { type: 'assistant', content: [{ type: 'text', text: 'File created successfully' }] },
      { type: 'user', content: [{ type: 'text', text: '你用的是什么模板？' }] }
    ]
    
    const events = []
    for await (const event of query({ messages, tools: allTools, systemPrompt })) {
      events.push(event)
    }
    
    // 验证：应该只回答问题，不重新调用 write_file 或 send_file
    const toolUseEvents = events.filter(e => e.type === 'tool_use')
    expect(toolUseEvents).toHaveLength(0)
    expect(events).toContainEqual({ type: 'done' })
  })
})
```

---

## 📅 实施计划

### Phase 1: 准备工作（0.5 天）

**Day 1 上午**:
- [ ] 创建功能分支 `feat/unified-query-refactor`
- [ ] 备份当前 `src/query.ts`
- [ ] 设置测试环境

### Phase 2: 核心重构（1 天）

**Day 1 下午**:
- [ ] 移除 `streamOneTurn` 函数
- [ ] 重构主循环：内联流式接收逻辑
- [ ] 添加 `pendingToolUses` 收集
- [ ] 添加退出检查 `if (pendingToolUses.length === 0)`

**Day 2 上午**:
- [ ] 移动 `maxTurns` 检查到循环开始
- [ ] 删除旧的 `stopReason !== 'tool_use'` 检查
- [ ] 验证 `checkToolPermissions` 和 `executeToolsConcurrently` 函数正常工作

### Phase 3: System Prompt 优化（0.5 天）

**Day 2 下午**:
- [ ] 修改 `src/constants/promptSections.ts`
- [ ] 移除强制 send_file 规则
- [ ] 添加任务完成指导

### Phase 4: 测试（1 天）

**Day 3**:
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 运行所有测试
- [ ] 手动测试关键场景

### Phase 5: 验证和发布（0.5 天）

**Day 4 上午**:
- [ ] 代码审查
- [ ] 性能测试
- [ ] 合并到主分支

**总计**: 3.5 天

---

## 🎯 验收标准

### 功能性

- [ ] 没有工具调用时正确退出（不依赖 stopReason）
- [ ] maxTurns 精确生效（在循环开始检查）
- [ ] 工具并发执行（总耗时 = max(单个耗时)）
- [ ] send_file 不重复调用（≤ 2 次）
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过

### 性能

- [ ] 多工具场景下，总耗时减少 30%+
- [ ] 用户感知延迟降低（文本输出时工具已在执行）

### 代码质量

- [ ] 主循环逻辑清晰，注释完整
- [ ] 无重复代码
- [ ] 错误处理完善

---

## 🚨 风险评估

### 高风险

1. **主循环重构破坏现有功能**
   - 缓解: 完整的单元测试 + 集成测试
   - 回滚: 保留 `streamOneTurn` 的备份

2. **退出逻辑错误导致提前退出**
   - 缓解: 多场景测试，特别是多轮对话
   - 监控: 添加日志记录退出原因

### 中风险

1. **并发执行导致 hook 顺序问题**
   - 缓解: Hook 本身是异步的，应该能处理乱序
   - 备选: 如果有问题，可以串行执行 hook

2. **流式接收逻辑错误**
   - 缓解: 参考 Claude Code 的实现
   - 测试: 覆盖各种 event 类型

### 低风险

1. **System Prompt 改动影响 LLM 行为**
   - 缓解: 改动很小，只是移除一条规则
   - 监控: 观察 send_file 调用频率

---

## 📊 成功指标

### 定量指标

- 工具调用重复率: < 5%
- 无限循环发生率: 0%
- maxTurns 准确率: 100%
- 多工具场景耗时: 减少 30%+
- send_file 调用次数: ≤ 2 次/任务

### 定性指标

- 用户不再需要手动中断
- Agent 能自主判断任务完成
- 工具执行体验更流畅
- 代码可读性提升

---

## 🔗 参考资料

- 流式工具执行规划: `blog/streaming-tool-execution-spec.md`
- 无限循环修复方案: `docs/plans/fix-infinite-loop.md`
- Claude Code 实现: `/Users/mac/Documents/ai/learn-claude-code/claude-code/src/query.ts`
- 问题日志: `.pi/logs/session-ob-20260412201504-797910.jsonl`

---

**方案制定人**: Claude (Kiro)
**制定日期**: 2026-04-13
**预计完成**: 2026-04-17 (3.5 天)
**优先级**: P0（核心功能改进）
