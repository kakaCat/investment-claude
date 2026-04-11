# Streaming Tool Execution - Design Spec

## 目标

实现流式工具执行：在 assistant 文本流式输出的同时，每当一个完整的 `tool_use` block 接收完毕就立刻执行，而不是等整个响应流结束后再批量执行。

## 背景

当前实现（Pi）：
- `streamOneTurn()` 等整个 stream 结束后返回完整的 `assistantContent`
- 主 loop 拿到完整内容后调用 `executeTools()` 串行执行工具
- 用户体验：文本输出完毕后才开始看到工具执行

目标实现（对齐 CC）：
- 文本流式输出时，工具已经在后台执行
- `content_block_stop` 事件触发时立刻将完整的 `tool_use` block 加入待执行队列
- 流结束后：串行权限检查 → 并发执行所有 allowed 工具

## 架构变化

### 删除 `streamOneTurn` 函数

将其逻辑内联进主 `while(true)` loop，主 loop 直接处理 API stream 事件。

### 主 loop 新增内部流式循环

```ts
while (true) {
  // 1. 构建 messages（每轮重新拼接）
  const messagesForQuery = [...]
  
  // 2. 发起 API stream
  const stream = await anthropic.messages.stream({...})
  
  // 3. 内部流式循环
  const pendingToolUses: ToolUseBlock[] = []
  const assistantContent: AssistantMessage['content'] = []
  let currentBlock: Partial<ToolUseBlock> | null = null
  
  for await (const event of stream) {
    switch (event.type) {
      case 'content_block_start':
        if (event.content_block.type === 'tool_use') {
          currentBlock = { ...event.content_block, input: '' }
        } else if (event.content_block.type === 'text') {
          assistantContent.push({ type: 'text', text: '' })
        }
        break
        
      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text }
          // 更新 assistantContent 最后一个 text block
        } else if (event.delta.type === 'input_json_delta') {
          currentBlock!.input += event.delta.partial_json
        }
        break
        
      case 'content_block_stop':
        if (currentBlock && currentBlock.type === 'tool_use') {
          // 完整 tool_use block 接收完毕，立刻加入队列
          pendingToolUses.push(currentBlock as ToolUseBlock)
          assistantContent.push(currentBlock as ToolUseBlock)
          currentBlock = null
        }
        break
        
      case 'message_stop':
        // 流结束，跳出内部循环
        break
    }
  }
  
  // 4. 流结束后：权限检查 + 并发执行
  const { allowed, denied } = await checkToolPermissions(pendingToolUses)
  
  // yield tool_denied 事件
  for (const deniedTool of denied) {
    yield { type: 'tool_denied', ... }
  }
  
  const toolResults = await executeToolsConcurrently(allowed)
  
  // 5. 重建 messages
  messages = [
    ...messagesForQuery,
    { role: 'assistant', content: assistantContent },
    { role: 'user', content: toolResults }
  ]
  
  // 6. 判断是否需要下一轮
  if (pendingToolUses.length === 0) break
}
```

## 关键数据结构

### 流式循环内收集

```ts
// 待执行的 tool_use blocks（保持原始顺序）
const pendingToolUses: ToolUseBlock[] = []

// 完整的 assistant 内容（包含 text + tool_use）
const assistantContent: AssistantMessage['content'] = []

// 当前正在接收的 block
let currentBlock: Partial<ToolUseBlock> | null = null
```

### 权限检查结果

```ts
type AllowedTool = {
  block: ToolUseBlock
  tool: Tool | undefined  // undefined 表示 tool 不存在但用户允许继续
}

type PermissionCheckResult = {
  allowed: AllowedTool[]
  denied: Array<{
    block: ToolUseBlock
    reason: string
  }>
}
```

### 并发执行结果

```ts
// Promise.allSettled 返回的结果，保持原始顺序
type ToolExecutionResult = 
  | { status: 'fulfilled', value: ToolResultContent }
  | { status: 'rejected', reason: Error }

// 转换成统一的 ToolResultContent[]
const toolResults: ToolResultContent[] = results.map(r => 
  r.status === 'fulfilled' 
    ? r.value 
    : { type: 'tool_result', tool_use_id: '...', content: `Error: ${r.reason.message}` }
)
```

## 函数拆分

### `checkToolPermissions(blocks: ToolUseBlock[])`

串行检查每个工具的权限（因为权限检查可能需要用户交互）。

```ts
async function checkToolPermissions(
  blocks: ToolUseBlock[],
  tools: Tool[],
  canUseTool: (tool: Tool, input: any) => Promise<boolean>
): Promise<PermissionCheckResult> {
  const allowed: AllowedTool[] = []
  const denied: Array<{ block: ToolUseBlock, reason: string }> = []
  
  for (const block of blocks) {
    const tool = tools.find(t => t.name === block.name)
    
    if (!tool) {
      denied.push({ block, reason: `Tool ${block.name} not found` })
      continue
    }
    
    const permitted = await canUseTool(tool, block.input)
    
    if (permitted) {
      allowed.push({ block, tool })
    } else {
      denied.push({ block, reason: 'Permission denied by user' })
    }
  }
  
  return { allowed, denied }
}
```

### `executeToolsConcurrently(allowed: AllowedTool[])`

并发执行所有 allowed 工具，返回有序结果数组。

```ts
async function executeToolsConcurrently(
  allowed: AllowedTool[],
  executeHooks: ExecuteHooksFunction,
  // ... 其他参数
): Promise<ToolResultContent[]> {
  const results = await Promise.allSettled(
    allowed.map(async ({ block, tool }) => {
      // PreToolUse hook
      await executeHooks('PreToolUse', { toolName: block.name, input: block.input })
      
      // 执行工具
      const result = await executeSingleTool(block, tool, ...)
      
      // PostToolUse hook
      await executeHooks('PostToolUse', { toolName: block.name, result })
      
      return result
    })
  )
  
  // 转换 rejected 为 error 字符串
  return results.map((r, i) => 
    r.status === 'fulfilled'
      ? r.value
      : {
          type: 'tool_result',
          tool_use_id: allowed[i].block.id,
          content: `Error: ${r.reason.message}`,
          is_error: true
        }
  )
}
```

### `executeSingleTool(block, tool, ...)`

单个工具的执行逻辑（从现有 `executeTools` 中提取）。

```ts
async function executeSingleTool(
  block: ToolUseBlock,
  tool: Tool | undefined,
  // ... 其他参数
): Promise<ToolResultContent> {
  if (!tool) {
    return {
      type: 'tool_result',
      tool_use_id: block.id,
      content: `Error: Tool ${block.name} not found`,
      is_error: true
    }
  }
  
  try {
    const result = await tool.execute(block.input)
    return {
      type: 'tool_result',
      tool_use_id: block.id,
      content: result
    }
  } catch (error) {
    return {
      type: 'tool_result',
      tool_use_id: block.id,
      content: `Error: ${error.message}`,
      is_error: true
    }
  }
}
```

## 错误处理

### 单个工具执行失败

使用 `Promise.allSettled` 而不是 `Promise.all`，确保单个工具失败不影响其他工具执行。

```ts
const results = await Promise.allSettled([...])

// rejected 的转成 error 字符串
results.map(r => 
  r.status === 'rejected' 
    ? { type: 'tool_result', content: `Error: ${r.reason.message}`, is_error: true }
    : r.value
)
```

### Stream 异常

主 loop 的 `try-catch` 捕获 stream 异常，yield `error` 事件后退出。

```ts
try {
  for await (const event of stream) { ... }
} catch (error) {
  yield { type: 'error', error: error.message }
  break
}
```

## 对现有接口的影响

### `StreamEvent` 类型

不变，已有 `text_delta`、`tool_use`、`tool_result`、`tool_denied` 等事件类型。

### `QueryParams` 类型

不变，`canUseTool`、`executeHooks` 等参数保持原样。

### Hook 调用时机

- `PreToolUse`：工具执行前（并发触发）
- `PostToolUse`：工具执行后（并发触发）
- 时机不变，只是从串行变成并发

## 性能优化

### 并发执行

多个工具同时执行，总耗时 = max(单个工具耗时)，而不是 sum(单个工具耗时)。

### 流式体验

用户看到文本输出的同时，工具已经在后台执行，减少感知延迟。

## 测试计划

### 单元测试

- `checkToolPermissions`：测试权限检查逻辑（allowed/denied 分类）
- `executeToolsConcurrently`：测试并发执行 + 错误处理
- `executeSingleTool`：测试单个工具执行 + 异常捕获

### 集成测试

- 主 loop：测试完整流程（stream → 权限检查 → 并发执行 → 重建 messages）
- 多轮对话：测试 messages 重拼接逻辑
- 错误场景：测试单个工具失败、stream 异常等

## 实现步骤

1. 提取 `executeSingleTool` 函数（从现有 `executeTools` 中）
2. 实现 `checkToolPermissions` 函数
3. 实现 `executeToolsConcurrently` 函数
4. 删除 `streamOneTurn`，将逻辑内联进主 loop
5. 更新主 loop：添加内部流式循环 + 权限检查 + 并发执行
6. 测试：单元测试 + 集成测试
7. 清理：删除旧的 `executeTools` 函数

## 风险与缓解

### 风险 1：并发执行导致 hook 顺序混乱

**缓解**：Hook 本身就是异步的，调用方应该能处理乱序。如果确实需要顺序，可以在 `executeToolsConcurrently` 内串行调用 hook。

### 风险 2：权限检查阻塞用户体验

**缓解**：权限检查必须串行（需要用户交互），无法优化。但可以在 UI 层面优化，比如批量展示所有待检查的工具。

### 风险 3：主 loop 变长，可读性下降

**缓解**：通过注释和清晰的代码结构保持可读性。内部流式循环可以提取成独名函数（如 `processStreamEvents`），但这会增加状态传递复杂度，权衡后选择内联。

## 参考

- Claude Code 实现：`/Users/mac/Documents/ai/learn-claude-code/claude-code/src/query.ts` (第 659-779 行)
- Pi 当前实现：`/Users/mac/Documents/ai/pi-claude-code/src/query.ts`
