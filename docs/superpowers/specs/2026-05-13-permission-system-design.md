# Permission System Design

> 参照 Claude Code 权限架构，为 Pi 投资 Agent 实现工具权限管线

## 背景

当前 Pi Agent 的权限控制存在两个问题：

1. `query.ts` 中的 `defaultCanUseTool` 直接返回 `'allow'`，没有实际权限逻辑
2. `InvestmentTool.call()` 内部用 `askUser` 做写操作确认，但这是工具层面的临时方案，无法跨工具复用、无法持久化用户的选择

目标是参照 Claude Code 的 `PermissionMode` + `PermissionRule` + `ToolPermissionContext` 三层架构，实现：

- 权限模式切换（default / readonly / trust）
- per-tool 的 allow/deny/ask 规则，支持内容级匹配
- 终端弹窗让用户选择"允许/始终允许/拒绝/始终拒绝"
- "始终"选项写入 settings.json，跨会话生效

## 范围

- 仅针对终端交互场景（飞书/API 等无人值守场景不在范围内）
- 投资业务权限为主（控制持仓修改、交易记录、资金管理等敏感操作）
- 通用工具（Bash/FileWrite 等）可选择性接入，但不是本期重点

## 1. 核心类型系统

新增 `src/permissions/types.ts`，定义所有权限相关类型。

### 1.1 权限模式

```typescript
export type PermissionMode = 'default' | 'readonly' | 'trust'
```

| 模式 | 行为 | 类比 Claude Code |
|------|------|-----------------|
| `default` | 写操作弹窗确认，读操作自动放行 | `default` |
| `readonly` | 所有写操作直接拒绝 | `plan` |
| `trust` | 所有操作自动放行 | `bypassPermissions` |

简化理由：去掉 `acceptEdits`、`dontAsk`、`auto`、`bubble`，因为没有 classifier 等高级功能。

### 1.2 权限行为

```typescript
export type PermissionBehavior = 'allow' | 'deny' | 'ask'
```

### 1.3 权限规则

```typescript
export type PermissionRuleSource = 'userSettings' | 'projectSettings' | 'session'

export type PermissionRuleValue = {
  toolName: string        // e.g. 'Investment'
  ruleContent?: string    // e.g. 'manage_portfolio:add' 或 'manage_cash:*'
}

export type PermissionRule = {
  source: PermissionRuleSource
  behavior: PermissionBehavior
  value: PermissionRuleValue
}
```

简化理由：规则来源从 Claude Code 的 7 种减为 3 种，去掉 `flagSettings`、`policySettings`、`cliArg`、`command`。

### 1.4 权限上下文

```typescript
export type ToolPermissionContext = {
  mode: PermissionMode
  allowRules: Record<PermissionRuleSource, string[]>
  denyRules:  Record<PermissionRuleSource, string[]>
  askRules:   Record<PermissionRuleSource, string[]>
}
```

### 1.5 权限判定结果

```typescript
export type PermissionDecision =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message: string }
  | { behavior: 'ask'; message: string; suggestions?: PermissionUpdate[] }

export type PermissionUpdate = {
  type: 'addRules' | 'removeRules'
  destination: PermissionRuleSource
  rules: PermissionRuleValue[]
  behavior: PermissionBehavior
}
```

### 1.6 规则字符串格式

```
"ToolName"                         → 匹配整个工具
"ToolName(content)"                → 匹配特定内容
"Investment(manage_portfolio:*)"   → 通配符匹配
"Investment(manage_portfolio:add)" → 精确匹配
```

解析函数：

```typescript
// ruleValueToString: { toolName: 'Investment', ruleContent: 'manage_portfolio:add' }
//                   → 'Investment(manage_portfolio:add)'

// ruleValueFromString: 'Investment(manage_portfolio:add)'
//                    → { toolName: 'Investment', ruleContent: 'manage_portfolio:add' }
```

## 2. 权限检查管线

新增 `src/permissions/checkPermissions.ts`，实现权限检查主入口。

### 2.1 检查流程

```
工具调用
  │
  ▼
Step 1: deny 规则 ─── 命中 → deny
  │ 未命中
  ▼
Step 2: tool.checkPermissions() ─── deny → deny
  │ ask 或无
  ▼
Step 3: 模式判断
  ├── trust → allow
  ├── readonly + 非只读 → deny
  └── default → 继续
  │
  ▼
Step 4: allow 规则 ─── 命中 → allow
  │ 未命中
  ▼
Step 5: 只读工具 → allow，非只读 → ask（弹窗）
```

### 2.2 核心函数

```typescript
export function checkToolPermission(
  tool: Tool,
  input: Record<string, unknown>,
  context: ToolPermissionContext,
): PermissionDecision
```

### 2.3 规则匹配

```typescript
// src/permissions/ruleMatching.ts

export function findMatchingRule(
  rules: Record<PermissionRuleSource, string[]>,
  toolName: string,
  input: Record<string, unknown>,
): PermissionRule | null

export function ruleMatchesToolUse(
  ruleString: string,
  toolName: string,
  contentString?: string,
): boolean
```

通配符规则：`Investment(manage_portfolio:*)` 中 `*` 匹配任意 action。

### 2.4 Tool 接口扩展

```typescript
export interface Tool<Input, Output> {
  // ...existing...
  checkPermissions?(input: Input): PermissionDecision
}
```

`buildTool` 工厂提供默认实现：

```typescript
checkPermissions(input) {
  if (this.isReadOnly()) return { behavior: 'allow' }
  return { behavior: 'ask', message: `确认使用 ${this.name}？` }
}
```

即：只读工具返回 `allow`，非只读工具返回 `ask`。工具可覆盖此默认实现。

### 2.5 InvestmentTool 改造

将现有 `call()` 中的 `askUser` 确认逻辑移到 `checkPermissions`：

```typescript
checkPermissions(input: InvestmentInput): PermissionDecision {
  const WRITE_OPS = {
    manage_portfolio: ['add', 'remove', 'update'],
    manage_watchlist: ['add', 'remove', 'update'],
    manage_trade_log: ['create', 'append'],
    manage_cash: ['update'],
  }

  const writeActions = WRITE_OPS[input.function]
  if (writeActions?.includes(input.action)) {
    return {
      behavior: 'ask',
      message: formatWriteConfirmation(input.function, input),
      suggestions: [{
        type: 'addRules',
        destination: 'projectSettings',
        rules: [{ toolName: 'Investment', ruleContent: `${input.function}:${input.action}` }],
        behavior: 'allow',
      }],
    }
  }

  return { behavior: 'allow' }
}
```

`call()` 中删除 `askUser` 相关逻辑，权限检查由管线统一处理。

## 3. 规则持久化

新增 `src/permissions/settingsLoader.ts`。

### 3.1 settings.json 格式

```jsonc
// ~/.pi/settings.json (用户级) 或 .pi/settings.json (项目级)
{
  "hooks": { /* 现有 hooks 配置不变 */ },

  "permissions": {
    "defaultMode": "default",
    "allow": [
      "Investment(manage_portfolio:get)",
      "Investment(manage_watchlist:get)",
      "Read"
    ],
    "deny": [
      "Investment(manage_portfolio:remove)"
    ],
    "ask": [
      "Investment(manage_cash:*)"
    ]
  }
}
```

### 3.2 加载函数

```typescript
export function loadPermissionSettings(): ToolPermissionContext
```

从 `~/.pi/settings.json`（userSettings）和 `.pi/settings.json`（projectSettings）按顺序加载，项目级 `defaultMode` 覆盖用户级。

### 3.3 写入函数

```typescript
export function persistPermissionUpdate(update: PermissionUpdate): void
```

- `session` 类型不写磁盘
- `addRules` 追加去重
- `removeRules` 过滤删除

### 3.4 内存同步

```typescript
export function applyPermissionUpdate(
  context: ToolPermissionContext,
  update: PermissionUpdate,
): ToolPermissionContext
```

纯函数，返回新的 context 对象。在 REPL 中用户选择"始终允许/拒绝"后，同时调用 `persistPermissionUpdate`（写磁盘）和 `applyPermissionUpdate`（更新 AppState）。

## 4. 终端权限弹窗 UI

新增 `src/components/PermissionPrompt.tsx`。

### 4.1 弹窗样式

```
┌─────────────────────────────────────────────────────┐
│  🔒 Investment 需要权限                              │
│                                                     │
│  确认添加持仓：贵州茅台(600519) 100股 均价¥1443？     │
│                                                     │
│  ▸ ✅ 允许            允许本次操作                    │
│    ✅ 始终允许         将此操作加入允许规则            │
│    ❌ 拒绝            拒绝本次操作                    │
│    ❌ 始终拒绝         将此操作加入拒绝规则            │
│                                                     │
│  规则预览: Investment(manage_portfolio:add)           │
└─────────────────────────────────────────────────────┘
```

### 4.2 交互数据类型

```typescript
type PermissionRequest = {
  toolName: string
  input: unknown
  decision: PermissionDecision & { behavior: 'ask' }
  resolve: (result: PermissionUserChoice) => void
}

type PermissionUserChoice = {
  action: 'allow' | 'deny'
  persist: boolean
  destination?: PermissionRuleSource
}
```

### 4.3 REPL 集成

REPL 中的 `canUseTool` 回调改造为：

1. 调用 `checkToolPermission()` 获取 `PermissionDecision`
2. `allow` → 直接返回 `'allow'`
3. `deny` → 直接返回 `'deny'`
4. `ask` → 弹出 `PermissionPrompt`，等待用户选择
5. 用户选择"始终"时 → 调用 `persistPermissionUpdate` + `applyPermissionUpdate`
6. 返回 `'allow'` 或 `'deny'`

`query.ts` 的 `CanUseTool` 类型签名不变，仍返回 `Promise<'allow' | 'deny'>`。

## 5. AppState 集成与初始化

### 5.1 AppState 扩展

```typescript
export type AppState = {
  readonly todos: readonly TodoItem[]
  readonly tasks: ReadonlyMap<number, Task>
  readonly nextTaskId: number
  readonly permissionContext: ToolPermissionContext  // 新增
}
```

### 5.2 初始化

新增 `src/permissions/init.ts`：

```typescript
export function initPermissions(): void {
  const permissionContext = loadPermissionSettings()
  setAppState(prev => ({ ...prev, permissionContext }))
}
```

在 REPL `useEffect` 中，与 `initSessionMemory`、`initObservability` 同级调用。

## 6. 文件结构

### 新增文件

```
src/permissions/
├── types.ts              # 类型定义
├── checkPermissions.ts   # 权限检查管线
├── ruleMatching.ts       # 规则匹配 + 通配符
├── settingsLoader.ts     # 加载 & 持久化 settings.json
├── init.ts               # 初始化入口
└── index.ts              # 统一导出

src/components/
└── PermissionPrompt.tsx  # 弹窗 UI 组件
```

### 改动的现有文件

| 文件 | 改动 |
|------|------|
| `src/state/AppState.ts` | 新增 `permissionContext` 字段 |
| `src/Tool.tsx` | Tool 接口新增可选 `checkPermissions` 方法，`buildTool` 提供默认实现 |
| `src/screens/REPL.tsx` | `canUseTool` 改造为调用权限管线；渲染 `PermissionPrompt`；初始化调用 `initPermissions()` |
| `src/tools/InvestmentTool/InvestmentTool.tsx` | 移除 `call()` 中的 `askUser` 确认逻辑，新增 `checkPermissions` |

### 不改动的文件

| 文件 | 原因 |
|------|------|
| `src/query.ts` | `CanUseTool` 接口不变，权限逻辑封装在 REPL 层 |
| `src/hooks/` | hooks 系统独立运作，`PreToolUse` hook 在权限检查之前正常执行 |
| `src/tools/ReadTool/` | 只读工具默认放行，不需要改动 |

## 7. 测试策略

- `src/permissions/__tests__/ruleMatching.test.ts` — 规则解析和通配符匹配
- `src/permissions/__tests__/checkPermissions.test.ts` — 管线各步骤判定逻辑
- `src/permissions/__tests__/settingsLoader.test.ts` — 加载/写入/合并逻辑
- InvestmentTool 的 `checkPermissions` 可在现有测试中补充
