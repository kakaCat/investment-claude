# System Prompt 实现设计

**日期**: 2026-04-28  
**状态**: 待实现  
**参考**: Claude Code `src/constants/prompts.ts` + `src/constants/systemPromptSections.ts`

---

## 背景与目标

当前 `src/constants/prompts.ts` 仅是 20 行的简单占位符，不包含任何动态上下文。目标是对标 Claude Code 的分段注册 + 缓存架构，将 CWD、git 状态、CLAUDE.md、MEMORY.md、工作空间等动态信息注入系统提示词，让 Pi 在每个 session 中拥有完整的项目感知能力。

---

## 文件结构

```
src/
├── constants/
│   ├── prompts.ts                ← 主组装入口（重写）
│   ├── promptSections.ts         ← 静态段落文本常量（新建）
│   └── systemPromptSections.ts   ← 分段注册 + 缓存机制（新建）
├── context/
│   ├── envContext.ts             ← CWD + 日期 + sessionId（新建）
│   ├── workspaceContext.ts       ← workspace 路径段文本（新建）
│   ├── gitContext.ts             ← git 状态读取（新建）
│   ├── claudeMdContext.ts        ← CLAUDE.md 加载（新建）
│   └── memoryContext.ts          ← MEMORY.md 加载（新建）
└── bootstrap/
    └── state.ts                  ← 已有，新增 sessionId、workspaceDir 字段
```

---

## 核心机制：分段注册 + 缓存

文件：`src/constants/systemPromptSections.ts`

### 类型定义

```typescript
type SectionContext = {
  cwd: string
  sessionId: string
  workspaceDir: string  // .pi/sessions/{sessionId}/workspace/
  isPlanMode: boolean
}

type SectionLoader = (ctx: SectionContext) => Promise<string | null>

type SectionEntry = {
  loader: SectionLoader
  volatile: boolean     // true = 每轮都重跑，false = 会话内缓存
  cached?: string | null
}
```

### API

```typescript
// 注册普通段（会话内缓存，/clear 或 /compact 时失效）
export function registerSection(id: string, loader: SectionLoader): void

// 注册 volatile 段（每次 resolveSystemPrompt 都重新加载）
// 对标 CC 的 DANGEROUS_uncachedSystemPromptSection
export function registerVolatileSection(id: string, loader: SectionLoader): void

// 并行 resolve 所有已注册段，按 sectionOrder 排序后拼接
export async function resolveSystemPrompt(ctx: SectionContext): Promise<string>

// 清空所有非 volatile 段的缓存
export function clearSectionCache(): void
```

### 缓存行为

| 类型 | 注册方式 | 何时加载 | 何时失效 |
|------|----------|----------|----------|
| 静态段 | `registerSection(id, () => STATIC_TEXT)` | 首次 resolve | 不失效 |
| 动态段 | `registerSection(id, asyncLoader)` | 首次 resolve | `/clear` 或 `/compact` |
| volatile 段 | `registerVolatileSection(id, loader)` | 每次 resolve | 不缓存 |

---

## 分段内容设计

### 注册顺序（即拼接顺序）

| # | sectionId | 类型 | 内容概要 |
|---|-----------|------|----------|
| 1 | `identity` | 静态 | Pi 是谁、核心职责 |
| 2 | `doing_tasks` | 静态 | 如何完成任务、安全原则、禁止事项 |
| 3 | `tone` | 静态 | 输出风格（简洁、直接、无废话） |
| 4 | `env_info` | 动态缓存 | CWD + OS + 日期 + sessionId |
| 5 | `workspace` | 动态缓存 | workspaceDir 路径，文件写入位置说明 |
| 6 | `git_status` | 动态缓存 | 分支、最近提交、M/?文件列表 |
| 7 | `claude_md` | 动态缓存 | 从 CWD 向上查找的所有 CLAUDE.md |
| 8 | `memory` | 动态缓存 | MEMORY.md 索引内容 |
| 9 | `plan_mode` | volatile | isPlanMode=true 时注入，限制写操作 |

### 各段示例内容

**`env_info` 段：**
```
# User Environment Info
Current project location: /path/to/project
Operating system: darwin
Session ID: abc123
Session date: 2026-04-28
```

**`workspace` 段：**
```
# Workspace
Session workspace: .pi/sessions/abc123/workspace/
All agent-generated files (plans, notes, scratchpad, temp outputs) should be written to this directory unless the user specifies otherwise.
```

**`git_status` 段：**
```
# Git Status
Current branch: main
Main branch: main
Git user: kakaCat
Recent commits:
  abc1234 feat: add query loop
  def5678 fix: tool error handling
Changed files:
  M src/constants/prompts.ts
  ?? src/context/gitContext.ts
```

**`plan_mode` 段（volatile）：**
```
PLAN MODE ACTIVE: Do NOT call write_file, edit_file, or bash tools. Only use read-only tools. When you have formulated a complete plan, call exit_plan_mode with the full plan text.
```

---

## 主入口：prompts.ts（重写）

```typescript
// src/constants/prompts.ts

import { registerSection, registerVolatileSection, resolveSystemPrompt, clearSectionCache } from './systemPromptSections.js'
import { IDENTITY, DOING_TASKS, TONE } from './promptSections.js'
import { loadEnvInfo } from '../context/envContext.js'
import { loadWorkspaceSection } from '../context/workspaceContext.js'
import { loadGitStatus } from '../context/gitContext.js'
import { loadClaudeMd } from '../context/claudeMdContext.js'
import { loadMemory } from '../context/memoryContext.js'
import { PLAN_MODE_SECTION } from './promptSections.js'

let initialized = false

export function initSystemPrompt(): void {
  if (initialized) return
  initialized = true

  registerSection('identity',    async () => IDENTITY)
  registerSection('doing_tasks', async () => DOING_TASKS)
  registerSection('tone',        async () => TONE)
  registerSection('env_info',    async (ctx) => loadEnvInfo(ctx))
  registerSection('workspace',   async (ctx) => loadWorkspaceSection(ctx))
  registerSection('git_status',  async (ctx) => loadGitStatus(ctx.cwd))
  registerSection('claude_md',   async (ctx) => loadClaudeMd(ctx.cwd))
  registerSection('memory',      async (ctx) => loadMemory(ctx.cwd))

  registerVolatileSection('plan_mode', async (ctx) =>
    ctx.isPlanMode ? PLAN_MODE_SECTION : null
  )
}

export async function getSystemPrompt(ctx: SectionContext): Promise<string> {
  return resolveSystemPrompt(ctx)
}

export { clearSectionCache }
```

---

## context 模块

### `gitContext.ts`

运行 `git status --short` 和 `git log --oneline -5`，解析后输出 `# Git Status` 段。

- git 不可用（非 git 仓库）时返回 `null`，该段不注入
- 输出内容限制 2000 字符（对标 CC）

### `claudeMdContext.ts`

- 从 `cwd` 向上遍历到 `$HOME`，收集所有 `CLAUDE.md`
- 加载 `~/.claude/CLAUDE.md`（全局配置）
- 每个文件前加注释 `# From: /path/to/CLAUDE.md`
- 无文件时返回 `null`

### `memoryContext.ts`

- 读取 `~/.claude/projects/{encoded-path}/memory/MEMORY.md`（当前项目 memory 索引）
- 无文件时返回 `null`

---

## bootstrap 集成

### `bootstrap/state.ts` 新增字段

```typescript
export type AppBootstrapState = {
  // 已有
  originalCwd: string
  projectRoot: string
  workDir: string

  // 新增
  sessionId: string        // randomUUID()，已有逻辑移入
  workspaceDir: string     // .pi/sessions/{sessionId}/workspace/
}
```

### 启动流程

```typescript
// entrypoints/cli.ts 或 REPL 初始化时

initSessionState()    // 设置 sessionId、workspaceDir
ensureWorkspaceDir()  // mkdir -p .pi/sessions/{sessionId}/workspace/
initSystemPrompt()    // 注册所有 section
```

### REPL.tsx 调用变更

```typescript
// 目前
systemPrompt: getSystemPrompt(isPlanModeRef.current)

// 改后
systemPrompt: await getSystemPrompt({
  cwd: getWorkDir(),
  sessionId: getSessionId(),
  workspaceDir: getWorkspaceDir(),
  isPlanMode: isPlanModeRef.current,
})
```

### `/clear` 和 `/compact` 时

```typescript
clearSectionCache()  // 下次 query 时重新加载动态段
```

---

## 验证方式

1. 启动 Pi，检查第一次 query 时系统提示词包含 git 状态、CWD、日期
2. 在 git 仓库中运行，确认 `git_status` 段存在
3. 在非 git 目录运行，确认 `git_status` 段静默跳过
4. 项目根目录放 CLAUDE.md，确认内容注入系统提示词
5. 触发 `/clear`，再次 query，确认动态段重新加载（日期/git 最新）
6. 进入 plan mode，确认 `plan_mode` volatile 段注入
7. 退出 plan mode，确认该段消失
8. 检查 `.pi/sessions/{sessionId}/workspace/` 目录在启动时自动创建
