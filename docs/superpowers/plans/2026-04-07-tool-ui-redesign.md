# Tool UI 重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给工具调用行加 `● 工具名` 标识，结果框统一改为全宽圆角，成功绿点失败红点。

**Architecture:** 外框层统一由 `Messages.tsx` 的 `ToolUseBubble` / `ToolResultBubble` 管理；各工具 UI 文件只返回内容，不加边框。`Messages.tsx` 新增 `toolUseResultStatus` Map，根据 tool_result 内容判断成功/失败，传入 `ToolUseBubble` 控制 dot 颜色。

**Tech Stack:** React 18, Ink 5, TypeScript

---

## 文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/Tool.tsx` | Modify | 移除默认渲染器里的边框，`defaultRenderToolUse` 不再包含工具名 |
| `src/tools/BashTool/UI.tsx` | Modify | 移除 `BashToolResultUI` 的 `borderStyle="single"` 外框 |
| `src/tools/ReadTool/UI.tsx` | Modify | 移除 `ReadToolResultUI` 的 `borderStyle="single"` 外框 |
| `src/tools/AgentTool/UI.tsx` | Modify | 移除 `AgentToolResultUI` 的 `borderStyle="single"` 外框 |
| `src/components/Messages.tsx` | Modify | 主要改动：加 `toolUseResultStatus` Map、重写 `ToolUseBubble`、重写 `ToolResultBubble` |

---

### Task 1: 清理 `Tool.tsx` 默认渲染器

**Files:**
- Modify: `src/Tool.tsx:60-78`

- [ ] **Step 1: 更新 `defaultRenderToolUse`**

将 `src/Tool.tsx` 第 60-69 行替换为（去掉工具名，只显示 input JSON，因为工具名由 `ToolUseBubble` 统一注入）：

```tsx
function defaultRenderToolUse(_name: string, input: unknown): React.ReactNode {
  return <Text color="gray">{JSON.stringify(input)}</Text>
}
```

- [ ] **Step 2: 更新 `defaultRenderToolResult`**

将 `src/Tool.tsx` 第 71-78 行替换为（移除 `borderStyle`，只返回纯文本）：

```tsx
function defaultRenderToolResult(result: string): React.ReactNode {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return <Text color="gray" wrap="wrap">{display}</Text>
}
```

- [ ] **Step 3: 类型检查**

```bash
npm run typecheck
```

期望：无报错。

- [ ] **Step 4: Commit**

```bash
git add src/Tool.tsx
git commit -m "refactor: remove border from default tool renderers"
```

---

### Task 2: 移除 BashTool Result 边框

**Files:**
- Modify: `src/tools/BashTool/UI.tsx:15-22`

- [ ] **Step 1: 更新 `BashToolResultUI`**

将 `src/tools/BashTool/UI.tsx` 第 15-22 行替换为：

```tsx
export function BashToolResultUI({ result }: { result: string }) {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return <Text wrap="wrap">{display}</Text>
}
```

注意：移除了 `Box`，直接返回 `Text`。同时可以移除文件顶部 `import` 里的 `Box`（如果 `BashToolUseUI` 也不用 `Box` 则一起移除，否则保留）。

检查 `BashToolUseUI` 是否还用 `Box`：当前第 4-13 行用了 `Box`，保留 `Box` import。更新后文件完整内容：

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
  return <Text wrap="wrap">{display}</Text>
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

期望：无报错。

- [ ] **Step 3: Commit**

```bash
git add src/tools/BashTool/UI.tsx
git commit -m "refactor: remove border from BashToolResultUI"
```

---

### Task 3: 移除 ReadTool Result 边框

**Files:**
- Modify: `src/tools/ReadTool/UI.tsx:15-22`

- [ ] **Step 1: 更新 `ReadToolResultUI`**

将 `src/tools/ReadTool/UI.tsx` 完整内容替换为：

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
  return <Text color="gray" wrap="wrap">{display}</Text>
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

期望：无报错。

- [ ] **Step 3: Commit**

```bash
git add src/tools/ReadTool/UI.tsx
git commit -m "refactor: remove border from ReadToolResultUI"
```

---

### Task 4: 移除 AgentTool Result 边框

**Files:**
- Modify: `src/tools/AgentTool/UI.tsx:21-29`

- [ ] **Step 1: 更新 `AgentToolResultUI`**

将 `src/tools/AgentTool/UI.tsx` 完整内容替换为：

```tsx
// src/tools/AgentTool/UI.tsx

import React from 'react'
import { Box, Text } from 'ink'

export function AgentToolUseUI({
  input,
}: {
  input: { description: string; subagent_type?: string }
}) {
  return (
    <Box>
      <Text color="magenta" bold>
        agent({input.subagent_type ?? 'general-purpose'}){' '}
      </Text>
      <Text color="gray">{input.description}</Text>
    </Box>
  )
}

export function AgentToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('ERROR:')
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return <Text color={isError ? 'red' : 'gray'} wrap="wrap">{display}</Text>
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run typecheck
```

期望：无报错。

- [ ] **Step 3: Commit**

```bash
git add src/tools/AgentTool/UI.tsx
git commit -m "refactor: remove border from AgentToolResultUI"
```

---

### Task 5: 重写 Messages.tsx — 核心改动

**Files:**
- Modify: `src/components/Messages.tsx`

- [ ] **Step 1: 添加 `toolUseResultStatus` 计算**

在 `Messages` 函数组件内，`toolUseNames` 的 `useMemo` 之后，添加：

```tsx
// Build a lookup map: tool_use_id → 'success' | 'error'
// Used to color the dot in ToolUseBubble
const toolUseResultStatus = useMemo<Map<string, 'success' | 'error'>>(() => {
  const map = new Map<string, 'success' | 'error'>()
  for (const msg of messages) {
    if (msg.type === 'user') {
      for (const c of msg.content) {
        if (c.type === 'tool_result') {
          const isError =
            c.content.startsWith('Error') || c.content.startsWith('ERROR:')
          map.set(c.tool_use_id, isError ? 'error' : 'success')
        }
      }
    }
  }
  return map
}, [messages])
```

- [ ] **Step 2: 重写 `ToolUseBubble`**

将原来的 `ToolUseBubble` 函数（第 40-63 行）替换为：

```tsx
function ToolUseBubble({
  name,
  input,
  tools,
  status,
}: {
  name: string
  input: unknown
  tools: Tool[]
  status?: 'success' | 'error'
}) {
  const dotColor = status === 'success' ? 'green' : status === 'error' ? 'red' : 'gray'
  const tool = findTool(name, tools)
  return (
    <Box marginBottom={0} paddingLeft={2} flexDirection="row" gap={1}>
      <Text color={dotColor}>●</Text>
      <Text bold>{name}</Text>
      {tool ? (
        tool.renderToolUse(input)
      ) : (
        <Text color="gray">{JSON.stringify(input)}</Text>
      )}
    </Box>
  )
}
```

- [ ] **Step 3: 重写 `ToolResultBubble`**

将原来的 `ToolResultBubble` 函数（第 65-92 行）替换为：

```tsx
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
    <Box
      marginBottom={1}
      paddingLeft={2}
      borderStyle="round"
      borderColor="gray"
      width="100%"
    >
      <Box width="100%">
        {tool ? (
          tool.renderToolResult(content)
        ) : (
          <Text wrap="wrap" color="gray">
            {content.length > 500 ? content.slice(0, 500) + '…' : content}
          </Text>
        )}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: 在渲染时传入 `status`**

在 `Messages` 函数的返回值里，找到 `ToolUseBubble` 的渲染（约第 144-146 行），更新为：

```tsx
{toolUses.map((t, j) => (
  <ToolUseBubble
    key={j}
    name={t.name}
    input={t.input}
    tools={tools}
    status={toolUseResultStatus.get(t.id)}
  />
))}
```

- [ ] **Step 5: 类型检查**

```bash
npm run typecheck
```

期望：无报错。

- [ ] **Step 6: 手动验证**

```bash
npm run dev
```

在 pi 里执行一个 Bash 命令（如 `ls`），观察：
- 工具调用行显示 `● Bash  $ ls`，dot 初始灰色，结果返回后变绿
- 结果框为圆角，宽度占满终端
- 内容过长时自动换行

再执行一个会失败的命令（如 `cat /nonexistent`），观察：
- dot 变红色

- [ ] **Step 7: Commit**

```bash
git add src/components/Messages.tsx
git commit -m "feat: tool UI — dot indicator, tool name label, full-width round result box"
```
