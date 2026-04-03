# AgentTool 设计文档

**日期**: 2026-04-14  
**状态**: 待实现

---

## 目标

为 pi-claude-code 实现 AgentTool，让模型可以派生子 agent 执行独立任务。

**范围（最小可用版 + 预留完整版空间）**：
- ✅ 同步子 agent（父 agent 阻塞等待结果）
- ✅ 内置 agent 类型 + 目录加载自定义 agent
- ✅ 按 agent 定义过滤 tool pool
- 🔲 `run_in_background`（schema 预留，暂不实现）
- 🔲 fork 模式（无 `subagent_type` 继承父上下文）
- 🔲 worktree 隔离

---

## 架构概览

**分层设计（对标 Claude Code AgentTool 目录结构）**：

```
src/
├── agents/
│   ├── types.ts               — AgentDefinition 类型
│   ├── loadAgents.ts          — 加载目录 + 注册内置 agent
│   ├── assembleToolPool.ts    — 按 agent 定义过滤 tool pool
│   ├── resolveModel.ts        — model 别名 → 实际 model 名
│   └── built-in/
│       ├── generalPurposeAgent.ts
│       ├── exploreAgent.ts
│       └── planAgent.ts
│
└── tools/AgentTool/
    ├── AgentTool.tsx          — 工具入口（输入校验 + 路由）
    ├── runSubAgent.ts         — 子 agent 执行（组装 pool + 调 query）
    ├── prompt.ts              — description / searchHint
    └── UI.tsx                 — renderToolUse / renderToolResult
```

---

## AgentDefinition 类型

文件：`src/agents/types.ts`

```typescript
export type AgentDefinition = {
  agentType: string          // 唯一 ID，如 'general-purpose'
  whenToUse: string          // 给模型看的使用场景描述
  tools?: string[]           // ['*'] = 全集；['bash','read'] = 子集；未声明 = 全集
  disallowedTools?: string[] // 黑名单，从 pool 中排除
  model?: string             // 'haiku'|'sonnet'|'opus'|'inherit'|未声明
  maxTurns?: number          // 未声明默认 10
  getSystemPrompt(): string
  source: 'built-in' | 'custom'
}
```

---

## Agent 加载（loadAgents.ts）

扫描顺序（后者同名覆盖前者）：
1. 内置 agent（代码里注册）
2. `~/.claude/agents/` — 用户全局自定义
3. `{cwd}/.claude/agents/` — 项目级自定义

自定义 agent 文件格式（`.md`）：

```markdown
---
description: Fast read-only codebase explorer
tools: [read, glob, grep, bash]
model: haiku
maxTurns: 20
---

System prompt 正文从这里开始...
```

解析规则：
- YAML frontmatter 中的 `description` 字段作为 `whenToUse`
- `tools` / `disallowedTools` 支持数组格式
- `model` 支持别名字符串
- frontmatter 结束后的全部内容作为 `getSystemPrompt()` 返回值

---

## Tool Pool 组装（assembleToolPool.ts）

```typescript
export function assembleToolPool(
  allTools: Tool[],
  agentDef: AgentDefinition,
): Tool[] {
  // 基础 pool：已启用且非延迟加载的工具
  let pool = allTools.filter(t => t.isEnabled() && !t.deferLoading)

  // tools 声明了具体子集（非 '*'）→ 按白名单过滤
  if (agentDef.tools && !agentDef.tools.includes('*')) {
    pool = pool.filter(t => agentDef.tools!.includes(t.name))
  }

  // 黑名单排除
  if (agentDef.disallowedTools?.length) {
    pool = pool.filter(t => !agentDef.disallowedTools!.includes(t.name))
  }

  return pool
}
```

---

## Model 解析规则

| agent def 中的 model | 实际使用 |
|---|---|
| 未声明 | `process.env.PI_MODEL`（继承父 agent） |
| `'inherit'` | 同上 |
| `'haiku'` / `'sonnet'` / `'opus'` | 通过环境变量别名映射到实际 model 名 |

Model 别名映射（`src/agents/resolveModel.ts`）：

```typescript
const MODEL_ALIASES: Record<string, string> = {
  haiku:  process.env.PI_MODEL_HAIKU  ?? 'claude-haiku-4-5',
  sonnet: process.env.PI_MODEL_SONNET ?? 'claude-sonnet-4-5',
  opus:   process.env.PI_MODEL_OPUS   ?? 'claude-opus-4-5',
}

export function resolveModel(model?: string): string {
  if (!model || model === 'inherit') return process.env.PI_MODEL ?? 'deepseek-chat'
  return MODEL_ALIASES[model] ?? model
}
```

---

## runSubAgent

文件：`src/tools/AgentTool/runSubAgent.ts`

```typescript
export async function runSubAgent(
  agentDef: AgentDefinition,
  prompt: string,
  parentContext: {
    allTools: Tool[]
    abortSignal: AbortSignal
    cwd: string
  },
): Promise<string> {
  const toolPool = assembleToolPool(parentContext.allTools, agentDef)
  const model = resolveModel(agentDef.model)
  const messages: Message[] = [
    { type: 'user', content: [{ type: 'text', text: prompt }] },
  ]

  let result = ''
  const gen = query({
    messages,
    tools: toolPool,
    allTools: toolPool,
    systemPrompt: agentDef.getSystemPrompt(),
    model,
    maxTurns: agentDef.maxTurns ?? 10,
    abortSignal: parentContext.abortSignal,
    canUseTool: () => Promise.resolve('allow'),  // pool 内全部允许
  })

  for await (const event of gen) {
    if (event.type === 'text_delta') result += event.delta
    if (event.type === 'error') throw event.error
  }

  return result.trim() || '(no output)'
}
```

---

## AgentTool

**输入 schema：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `description` | string | ✅ | 3-5 字任务描述（UI 展示用） |
| `prompt` | string | ✅ | 给子 agent 的完整任务指令 |
| `subagent_type` | string | ❌ | 省略则用 `general-purpose` |
| `run_in_background` | boolean | ❌ | schema 预留，当前忽略 |

**call() 主干：**

```typescript
async call(input, context) {
  const { prompt, subagent_type } = input
  const agents = await loadAgents(context.cwd)

  const type = subagent_type ?? 'general-purpose'
  const agentDef = agents.find(a => a.agentType === type)
  if (!agentDef) {
    const available = agents.map(a => a.agentType).join(', ')
    return `ERROR: Unknown agent type '${type}'. Available: ${available}`
  }

  return runSubAgent(agentDef, prompt, {
    allTools: context.tools,
    abortSignal: context.abortSignal,
    cwd: context.cwd,
  })
}
```

**预留扩展点（注释标记）：**

```typescript
// TODO(background): run_in_background=true → 包进 async task，返回 task ID
// TODO(fork): subagent_type 省略 + fork gate → buildForkedMessages + 继承父上下文
// TODO(worktree): isolation='worktree' → createAgentWorktree before runSubAgent
```

---

## 内置 Agent 类型（对标 Claude Code）

### general-purpose
- `tools: ['*']`
- model: inherit
- 用途：通用研究、代码搜索、多步骤任务

### Explore
- `disallowedTools: ['agent', 'exit_plan_mode', 'write_file', 'edit_file']`
- model: haiku
- 用途：只读代码库探索，快速文件搜索

### Plan
- `tools: ['read_file', 'glob', 'grep', 'bash']`（只读工具）
- model: inherit
- 用途：制定实现计划，不执行写操作

---

## ToolUseContext 设计备注

**不在 context 里存 agent 定义**（vs 方案三的取舍）：

```typescript
// src/Tool.tsx
export type ToolUseContext = {
  abortSignal: AbortSignal
  cwd: string
  tools: Tool[]
  // 设计备注：agent 定义不放在 context 里，由 AgentTool 自行加载。
  // 职责清晰：context = 执行环境，agent 注册表 = AgentTool 内部关注。
  // 若未来多个工具都需要访问 agent 列表，
  // 参考 Claude Code 的 toolUseContext.options 模式扩展。
  askUser?: ...
}
```

---

## 与 Claude Code 的对比

| 功能 | Claude Code | pi-claude-code（本期） |
|---|---|---|
| 同步执行 | ✅ | ✅ |
| background 异步 | ✅ | 🔲 预留 schema |
| fork 模式 | ✅（实验性） | 🔲 预留注释 |
| worktree 隔离 | ✅ | 🔲 预留注释 |
| 内置 agent 类型 | 6 种 | 3 种（general-purpose / Explore / Plan） |
| 自定义 agent 目录 | ✅ | ✅ |
| 多 agent 团队 | ✅ | 🔲 swarm stub 已有 |
