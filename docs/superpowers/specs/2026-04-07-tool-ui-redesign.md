# Tool UI 重设计 spec

**日期**: 2026-04-07  
**状态**: 待实现

---

## 目标

优化工具调用的终端 UI，解决三个问题：
1. 无法识别使用了哪个工具
2. 结果框样式不统一、不美观
3. 框宽度随内容变化，视觉不一致

参考：Claude Code 的 `AssistantToolUseMessage` + `UserToolSuccessMessage` 分层架构。

---

## 视觉效果

```
● Bash  $ cat src/tools/index.ts
╭────────────────────────────────────────────────────────╮
│ // 工具注册表 — 对标 Claude Code src/tools.ts          │
│ // getAllTools: 所有工具 (含 deferLoading)              │
╰────────────────────────────────────────────────────────╯

● Read  src/Tool.tsx
╭────────────────────────────────────────────────────────╮
│ // Tool 接口层 — 对标 Claude Code src/Tool.ts          │
╰────────────────────────────────────────────────────────╯

● glob  **/*.ts
╭────────────────────────────────────────────────────────╮
│ src/Tool.tsx                                           │
│ src/query.ts                                           │
╰────────────────────────────────────────────────────────╯

● Bash  $ invalid-command      ← 失败时红点
╭────────────────────────────────────────────────────────╮
│ Error: command not found                               │
╰────────────────────────────────────────────────────────╯
```

**dot 颜色规则：**
- `gray`：工具已调用，结果尚未到达（pendingstate）
- `green`：有对应结果，且不是错误
- `red`：有对应结果，且判定为错误

---

## 架构设计

### 分层原则（对标 Claude Code）

```
Messages.tsx（外框层）          各工具 UI 文件（内容层）
ToolUseBubble                   tool.renderToolUse()
  ├─ ● dot（颜色由结果决定）      └─ 返回调用参数描述（无外框）
  └─ 工具名（粗体）

ToolResultBubble                tool.renderToolResult()
  └─ Box borderStyle="round"      └─ 返回结果内容（无外框）
       width="100%"
       Text wrap="wrap"
```

**外框统一由 `Messages.tsx` 管理，工具 UI 只负责内容，不加边框。**

---

## 改动范围

### 1. `src/components/Messages.tsx`

**新增计算：`toolUseResultStatus`**

```ts
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

**`ToolUseBubble` 改造：**

```tsx
function ToolUseBubble({ name, input, tools, status }: {
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
      <Text bold color="white">{name}</Text>
      <Box>
        {tool ? tool.renderToolUse(input) : <Text color="gray">{JSON.stringify(input)}</Text>}
      </Box>
    </Box>
  )
}
```

**`ToolResultBubble` 改造：**

```tsx
function ToolResultBubble({ toolUseId, content, tools, toolUseNames }: ...) {
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

**渲染时传入 status：**

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

---

### 2. 各工具 Result UI — 移除自带边框

以下 3 个文件有 `borderStyle="single"`，需改为只返回内容（无 Box 边框）：

| 文件 | 改动 |
|------|------|
| `src/tools/BashTool/UI.tsx` | 去掉 `BashToolResultUI` 的 `borderStyle="single"` Box，直接返回 `<Text>` |
| `src/tools/ReadTool/UI.tsx` | 同上 |
| `src/tools/AgentTool/UI.tsx` | 同上 |

其他工具（GlobTool、GrepTool、FileEditTool 等）本身无边框，无需改动。

---

### 3. `src/Tool.tsx` — 默认渲染器

`defaultRenderToolResult` 移除 `borderStyle="single"`，只返回纯文本（外框由 `ToolResultBubble` 统一管理）：

```tsx
function defaultRenderToolResult(result: string): React.ReactNode {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return <Text color="gray" wrap="wrap">{display}</Text>
}
```

`defaultRenderToolUse` 移除工具名（名称由 `ToolUseBubble` 统一注入）：

```tsx
function defaultRenderToolUse(_name: string, input: unknown): React.ReactNode {
  return <Text color="gray">{JSON.stringify(input)}</Text>
}
```

---

## 错误判断

```ts
const isError = (content: string): boolean =>
  content.startsWith('Error') || content.startsWith('ERROR:')
```

此逻辑仅用于 `toolUseResultStatus` 计算，在 `Messages.tsx` 中实现。

---

## 不在此次范围内

- 复制功能
- 工具结果折叠/展开
- 鼠标交互

---

## 文件清单

| 文件 | 改动类型 |
|------|---------|
| `src/components/Messages.tsx` | 主要改动（外框、dot、status map） |
| `src/Tool.tsx` | 移除默认渲染器里的边框 |
| `src/tools/BashTool/UI.tsx` | 移除 Result 边框 |
| `src/tools/ReadTool/UI.tsx` | 移除 Result 边框 |
| `src/tools/AgentTool/UI.tsx` | 移除 Result 边框 |
