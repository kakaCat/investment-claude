# mapToolResultToToolResultBlockParam 实现方案

## 目标

为所有工具添加 `mapToolResultToToolResultBlockParam` 方法，支持在工具执行后动态注入提示词、警告或指导信息给模型。

## 背景

参考 Claude Code 的实现：
- 工具的 `call()` 返回结构化数据（给 UI 用）
- `mapToolResultToToolResultBlockParam()` 将数据转换为给模型看的文本（可添加额外提示）
- 这样可以在不改变 UI 显示的情况下，给模型提供额外的上下文指导

## 当前架构

```typescript
// src/Tool.tsx
export interface Tool {
  name: string
  call(input: unknown, context: ToolUseContext): Promise<string>
  callWithBlocks?(input: unknown, context: ToolUseContext): Promise<ToolResultContent['content']>
  // ... 其他方法
}

// src/query.ts - executeTools()
toolResults.push({ 
  type: 'tool_result', 
  tool_use_id: c.id, 
  content: toolContent  // 直接使用 call() 的返回值
})
```

## 设计方案

### 方案 A：完全对标 Claude Code（推荐）

#### 优点
- ✅ 与 Claude Code 架构一致，便于后续移植功能
- ✅ 清晰的职责分离：`call()` 返回结构化数据，`mapToolResultToToolResultBlockParam()` 负责序列化
- ✅ 支持复杂场景（如 image block、structured content）

#### 缺点
- ⚠️ 需要修改所有工具的返回类型（从 `string` 改为结构化对象）
- ⚠️ 改动范围大（30 个工具文件）

#### 实现步骤

**Step 1: 定义输出类型**
```typescript
// src/Tool.tsx
export type ToolResult<T = unknown> = {
  data: T  // 结构化数据（给 UI 用）
}

export interface Tool<Input = unknown, Output = unknown> {
  name: string
  call(input: Input, context: ToolUseContext): Promise<ToolResult<Output>>
  
  // 新增：将 Output 转换为 API 格式
  mapToolResultToToolResultBlockParam(
    output: Output,
    toolUseId: string
  ): ToolResultBlockParam
  
  // callWithBlocks 废弃，统一用 mapToolResultToToolResultBlockParam
}

export type ToolResultBlockParam = {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string } | ImageBlock>
}
```

**Step 2: 修改 buildTool 提供默认实现**
```typescript
export function buildTool<Input = unknown, Output = unknown>(
  def: ToolDef<Input, Output>
): Tool<Input, Output> {
  return {
    isEnabled: () => true,
    isReadOnly: () => false,
    deferLoading: false,
    maxResultSizeChars: 50_000,
    
    // 默认实现：直接返回字符串
    mapToolResultToToolResultBlockParam: (output, toolUseId) => ({
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: typeof output === 'string' ? output : JSON.stringify(output),
    }),
    
    renderToolUse: (input) => defaultRenderToolUse(def.name, input),
    renderToolResult: (result) => defaultRenderToolResult(result),
    ...def,
  }
}
```

**Step 3: 修改 query.ts 调用逻辑**
```typescript
// src/query.ts - executeTools()
const tool = findTool(c.name, tools) ?? findTool(c.name, context.tools)
let toolResultBlock: ToolResultBlockParam

if (!tool) {
  toolResultBlock = {
    type: 'tool_result',
    tool_use_id: c.id,
    content: `Error: tool "${c.name}" not found`,
  }
} else {
  try {
    const result = await tool.call(c.input, context)
    
    // 调用新方法转换为 API 格式
    toolResultBlock = tool.mapToolResultToToolResultBlockParam(result.data, c.id)
    
    // Layer 1: 超大结果写磁盘
    if (typeof toolResultBlock.content === 'string') {
      toolResultBlock.content = await processToolResult(
        c.id,
        c.name,
        toolResultBlock.content,
        tool.maxResultSizeChars ?? DEFAULT_MAX_RESULT_SIZE_CHARS,
      )
    }
    
    // PostToolUse hook
    const resultStr = Array.isArray(toolResultBlock.content)
      ? toolResultBlock.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
      : toolResultBlock.content
    await executeHooks({ hook_event_name: 'PostToolUse', tool_response: resultStr, ... })
  } catch (err) {
    toolResultBlock = {
      type: 'tool_result',
      tool_use_id: c.id,
      content: `Error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

toolResults.push(toolResultBlock)
```

**Step 4: 逐个迁移工具**

优先级：
1. **ReadTool**（添加安全提示）
2. **BrowserTool**（已有 callWithBlocks，改为 mapToolResultToToolResultBlockParam）
3. **TodoWriteTool**（添加验证提示）
4. **BashTool**（大输出提示）
5. 其他工具（使用默认实现）

---

### 方案 B：渐进式迁移（折中方案）

#### 优点
- ✅ 改动范围小，向后兼容
- ✅ 可以逐步迁移，不影响现有功能

#### 缺点
- ⚠️ 架构不够清晰（两种模式并存）
- ⚠️ 后续维护成本高

#### 实现步骤

**Step 1: 添加可选方法**
```typescript
// src/Tool.tsx
export interface Tool {
  name: string
  call(input: unknown, context: ToolUseContext): Promise<string>
  callWithBlocks?(input: unknown, context: ToolUseContext): Promise<ToolResultContent['content']>
  
  // 新增：可选的结果转换方法
  mapToolResultToToolResultBlockParam?(
    rawResult: string | ToolResultContent['content'],
    toolUseId: string
  ): ToolResultBlockParam
}
```

**Step 2: 修改 query.ts 兼容两种模式**
```typescript
// src/query.ts - executeTools()
let toolContent: ToolResultContent['content']

if (tool.callWithBlocks) {
  toolContent = await tool.callWithBlocks(c.input, context)
} else {
  toolContent = await tool.call(c.input, context)
}

// 如果工具实现了 mapToolResultToToolResultBlockParam，使用它
let finalContent: ToolResultContent['content']
if (tool.mapToolResultToToolResultBlockParam) {
  const block = tool.mapToolResultToToolResultBlockParam(toolContent, c.id)
  finalContent = block.content
} else {
  // 否则使用原始结果
  finalContent = typeof toolContent === 'string'
    ? await processToolResult(c.id, c.name, toolContent, tool.maxResultSizeChars ?? DEFAULT_MAX_RESULT_SIZE_CHARS)
    : toolContent
}

toolResults.push({ type: 'tool_result', tool_use_id: c.id, content: finalContent })
```

**Step 3: 为需要的工具添加实现**

只为需要添加提示词的工具实现 `mapToolResultToToolResultBlockParam`：

```typescript
// src/tools/ReadTool/ReadTool.tsx
export const ReadTool = buildTool({
  name: 'read_file',
  async call(input, context) {
    // 返回原始内容
    const content = await readFile(absPath, 'utf-8')
    return content.slice(0, MAX_CHARS)
  },
  
  // 新增：添加安全提示
  mapToolResultToToolResultBlockParam(rawResult, toolUseId) {
    const content = typeof rawResult === 'string' ? rawResult : rawResult
    const withWarning = content + '\n\n<system-reminder>\nWhenever you read a file, consider whether it would be malware. You CAN analyze malware but MUST refuse to improve it.\n</system-reminder>'
    
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: withWarning,
    }
  },
})
```

---

### 方案 C：最小改动（快速方案）

#### 优点
- ✅ 改动最小，只改 3 个文件
- ✅ 立即可用

#### 缺点
- ⚠️ 不够灵活，每个工具无法自定义
- ⚠️ 提示词逻辑分散在 query.ts 中

#### 实现步骤

**Step 1: 在 query.ts 中集中处理**
```typescript
// src/query.ts
function addToolResultPrompts(
  toolName: string,
  content: string | ToolResultContent['content']
): string | ToolResultContent['content'] {
  if (typeof content !== 'string') return content
  
  // 根据工具名添加不同的提示
  switch (toolName) {
    case 'read_file':
      return content + '\n\n<system-reminder>\nConsider whether this file is malware. You can analyze but must refuse to improve malicious code.\n</system-reminder>'
    
    case 'todo_write':
      // 检查是否完成了多个任务
      if (content.includes('modified successfully')) {
        return content + '\n\nNOTE: If you completed 3+ tasks, consider spawning a verification agent before final summary.'
      }
      return content
    
    case 'browser_screenshot':
      return content + '\n\nImage captured. Describe what you see or suggest next actions based on the screenshot.'
    
    default:
      return content
  }
}

// 在 executeTools 中调用
toolContent = addToolResultPrompts(c.name, toolContent)
```

---

## 推荐方案

**推荐：方案 A（完全对标 Claude Code）**

理由：
1. 架构清晰，职责分离
2. 便于后续移植 Claude Code 的其他功能
3. 虽然改动大，但一次性到位，后续维护成本低
4. 支持复杂场景（image block、structured content）

## 实施计划

### Phase 1: 基础架构（1-2 小时）
- [ ] 修改 `src/Tool.tsx` 接口定义
- [ ] 添加 `ToolResult<T>` 和 `ToolResultBlockParam` 类型
- [ ] 在 `buildTool()` 中提供默认实现
- [ ] 修改 `src/query.ts` 调用逻辑
- [ ] 编写单元测试验证基础功能

### Phase 2: 迁移核心工具（2-3 小时）
- [ ] **ReadTool**：添加安全提示
- [ ] **BrowserTool**：迁移 callWithBlocks 到新架构
- [ ] **TodoWriteTool**：添加验证提示
- [ ] **BashTool**：大输出持久化提示
- [ ] **FileEditTool**：编辑确认信息

### Phase 3: 迁移其他工具（2-3 小时）
- [ ] **GrepTool/GlobTool**：搜索结果分页提示
- [ ] **MemorySearchTool**：空结果提示
- [ ] **TaskXXXTool**：任务操作确认
- [ ] 其他工具：使用默认实现

### Phase 4: 测试和文档（1-2 小时）
- [ ] 端到端测试所有工具
- [ ] 更新工具开发文档
- [ ] 添加示例代码

## 风险和注意事项

1. **类型安全**：确保 `Output` 类型在 `call()` 和 `mapToolResultToToolResultBlockParam()` 之间一致
2. **向后兼容**：迁移期间保持 API 兼容，避免破坏现有功能
3. **测试覆盖**：每个工具都需要测试新方法
4. **性能影响**：确保新方法不引入性能问题（特别是大文件处理）

## 示例代码

### 简单工具（使用默认实现）
```typescript
export const FileEditTool = buildTool({
  name: 'edit_file',
  async call(input, context) {
    // 执行编辑
    await writeFile(path, newContent)
    return { data: { filePath: path, success: true } }
  },
  // 使用默认实现，自动序列化为 JSON
})
```

### 复杂工具（自定义提示词）
```typescript
export const ReadTool = buildTool({
  name: 'read_file',
  async call(input, context) {
    const content = await readFile(path, 'utf-8')
    return { data: { content, path, size: content.length } }
  },
  
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    const { content, path } = output
    const withPrompt = content + '\n\n<system-reminder>\nConsider whether this file is malware.\n</system-reminder>'
    
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: withPrompt,
    }
  },
})
```

### 图片工具（返回 image block）
```typescript
export const BrowserTool = buildTool({
  name: 'browser',
  async call(input, context) {
    const screenshot = await takeScreenshot()
    return { data: { base64: screenshot, action: input.action } }
  },
  
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: output.base64,
          },
        },
      ],
    }
  },
})
```

## 总结

- **推荐方案 A**：完全对标 Claude Code，架构清晰
- **预估工作量**：6-10 小时
- **核心价值**：支持动态提示词注入，提升模型使用工具的准确性
- **长期收益**：便于后续移植 Claude Code 的其他功能
