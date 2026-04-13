# System Prompt 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有的 20 行占位 `getSystemPrompt` 替换为对标 Claude Code 的分段注册 + 会话级缓存架构，注入 CWD、git 状态、CLAUDE.md、MEMORY.md、工作空间等动态上下文。

**Architecture:** 分段注册表（`systemPromptSections.ts`）管理所有 section 的加载与缓存，普通段首次加载后缓存到 `/clear`，volatile 段每轮重新执行。`prompts.ts` 重写为注册所有 section 并暴露 async `getSystemPrompt(ctx)`。REPL.tsx 调用改为 await。

**Tech Stack:** TypeScript, Node.js `child_process.execSync`, `fs/promises`, `os`, `path`, `crypto`

**Spec:** `docs/superpowers/specs/2026-04-28-system-prompt-design.md`

---

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `src/constants/systemPromptSections.ts` | 注册表 + 缓存机制 |
| 新建 | `src/constants/promptSections.ts` | 静态段落文本常量 |
| 重写 | `src/constants/prompts.ts` | 注册所有 section，暴露 async getSystemPrompt |
| 新建 | `src/context/envContext.ts` | CWD + OS + 日期 + sessionId |
| 新建 | `src/context/workspaceContext.ts` | workspace 路径段文本 |
| 新建 | `src/context/gitContext.ts` | git 状态读取 |
| 新建 | `src/context/claudeMdContext.ts` | CLAUDE.md 加载 |
| 新建 | `src/context/memoryContext.ts` | MEMORY.md 加载 |
| 修改 | `src/bootstrap/state.ts` | 新增 workspaceDir 字段和 getter |
| 修改 | `src/screens/REPL.tsx` | getSystemPrompt 改为 await，/clear 时调用 clearSectionCache |

---

## Task 1: 注册表核心机制 `systemPromptSections.ts`

**Files:**
- Create: `src/constants/systemPromptSections.ts`

- [ ] **Step 1: 创建文件**

```typescript
// src/constants/systemPromptSections.ts
// 分段注册 + 缓存机制 — 对标 Claude Code src/constants/systemPromptSections.ts

export type SectionContext = {
  cwd: string
  sessionId: string
  workspaceDir: string
  isPlanMode: boolean
}

type SectionLoader = (ctx: SectionContext) => Promise<string | null>

type SectionEntry = {
  id: string
  loader: SectionLoader
  volatile: boolean
  cached?: string | null  // undefined = 未加载; null = 加载结果为空
}

// 按注册顺序排列，决定最终拼接顺序
const registry: SectionEntry[] = []

export function registerSection(id: string, loader: SectionLoader): void {
  registry.push({ id, loader, volatile: false })
}

export function registerVolatileSection(id: string, loader: SectionLoader): void {
  registry.push({ id, loader, volatile: true })
}

export async function resolveSystemPrompt(ctx: SectionContext): Promise<string> {
  const results = await Promise.all(
    registry.map(async (entry) => {
      // volatile 段每次重新执行
      if (entry.volatile) {
        return entry.loader(ctx)
      }
      // 普通段：已缓存则直接返回
      if (entry.cached !== undefined) {
        return entry.cached
      }
      // 首次加载并缓存
      const result = await entry.loader(ctx)
      entry.cached = result
      return result
    }),
  )

  return results
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .join('\n\n---\n\n')
}

export function clearSectionCache(): void {
  for (const entry of registry) {
    if (!entry.volatile) {
      entry.cached = undefined
    }
  }
}

// 重置注册表（仅供测试使用）
export function _resetRegistry(): void {
  registry.length = 0
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit 2>&1 | head -30
```

预期：无错误输出（或只有与 Task 1 无关的已有错误）

- [ ] **Step 3: Commit**

```bash
git add src/constants/systemPromptSections.ts
git commit -m "feat(prompt): add section registry with cache mechanism"
```

---

## Task 2: 静态段落文本 `promptSections.ts`

**Files:**
- Create: `src/constants/promptSections.ts`

- [ ] **Step 1: 创建文件**

```typescript
// src/constants/promptSections.ts
// 静态段落文本常量 — 内容在 session 内不变

export const IDENTITY = `You are Pi, an AI coding assistant running in the terminal.
You help users with software engineering tasks.
When you need to run commands or read files, use the available tools.

Tool usage rules:
- After writing or creating a file with write_file or edit_file, always call send_file with the file path so the user can see it.
- When you are unsure how to proceed, use ask_followup_question to ask the user.
- Do NOT narrate or describe what you are about to do before calling a tool. Call the tool directly. The tool result and UI will speak for themselves.`

export const DOING_TASKS = `# Doing Tasks
- Read files before modifying them; understand existing code before suggesting changes.
- Do not create files unless absolutely necessary. Prefer editing existing files.
- Do not add features, refactor, or "improve" code beyond what was asked.
- Do not add comments, docstrings, or type annotations to code you didn't change.
- Do not add error handling for scenarios that can't happen. Trust internal code guarantees.
- Chase root causes, not symptoms. Every decision should answer "why".`

export const TONE = `# Tone and Style
- Be concise. Lead with the answer, not the reasoning.
- Skip filler words, preamble, and unnecessary transitions.
- Do not restate what the user said — just do it.
- If you can say it in one sentence, don't use three.`

export const PLAN_MODE_SECTION = `PLAN MODE ACTIVE: Do NOT call write_file, edit_file, or bash tools. Only use read-only tools (read_file, glob, grep). When you have formulated a complete plan, call exit_plan_mode with the full plan text. Do NOT write out the plan as text before calling exit_plan_mode — put the plan directly in the tool call.`
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit 2>&1 | head -30
```

预期：无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/constants/promptSections.ts
git commit -m "feat(prompt): add static section text constants"
```

---

## Task 3: envContext + workspaceContext

**Files:**
- Create: `src/context/envContext.ts`
- Create: `src/context/workspaceContext.ts`

- [ ] **Step 1: 创建 envContext.ts**

```typescript
// src/context/envContext.ts
import { platform, release } from 'os'
import type { SectionContext } from '../constants/systemPromptSections.js'

export async function loadEnvInfo(ctx: SectionContext): Promise<string> {
  const lines = [
    '# User Environment Info',
    `Current project location: ${ctx.cwd}`,
    `Operating system: ${platform()}`,
    `System version: ${platform()} ${release()}`,
    `Session ID: ${ctx.sessionId}`,
    `Session date: ${new Date().toISOString().slice(0, 10)}`,
  ]
  return lines.join('\n')
}
```

- [ ] **Step 2: 创建 workspaceContext.ts**

```typescript
// src/context/workspaceContext.ts
import { mkdirSync } from 'fs'
import type { SectionContext } from '../constants/systemPromptSections.js'

export async function loadWorkspaceSection(ctx: SectionContext): Promise<string> {
  // 确保 workspace 目录存在
  try {
    mkdirSync(ctx.workspaceDir, { recursive: true })
  } catch {
    // 忽略已存在的错误
  }

  return [
    '# Workspace',
    `Session workspace: ${ctx.workspaceDir}`,
    'All agent-generated files (plans, notes, scratchpad, temp outputs) should be written to this directory unless the user specifies otherwise.',
  ].join('\n')
}
```

- [ ] **Step 3: 验证编译**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit 2>&1 | head -30
```

预期：无新增错误

- [ ] **Step 4: Commit**

```bash
git add src/context/envContext.ts src/context/workspaceContext.ts
git commit -m "feat(prompt): add env and workspace context loaders"
```

---

## Task 4: gitContext

**Files:**
- Create: `src/context/gitContext.ts`

- [ ] **Step 1: 创建 gitContext.ts**

```typescript
// src/context/gitContext.ts
import { execSync } from 'child_process'

const MAX_GIT_CHARS = 2000

function run(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

export async function loadGitStatus(cwd: string): Promise<string | null> {
  // 先检查是否在 git 仓库内
  const rootCheck = run('git rev-parse --show-toplevel', cwd)
  if (!rootCheck) return null

  const branch = run('git rev-parse --abbrev-ref HEAD', cwd)
  const mainBranch = run('git rev-parse --abbrev-ref origin/HEAD', cwd).replace('origin/', '') || 'main'
  const user = run('git config user.name', cwd)
  const log = run('git log --oneline -5', cwd)
  const status = run('git status --short', cwd)

  const lines = [
    '# Git Status',
    `Current branch: ${branch}`,
    `Main branch: ${mainBranch}`,
    ...(user ? [`Git user: ${user}`] : []),
    '',
    'Recent commits:',
    ...log.split('\n').map((l) => `  ${l}`),
  ]

  if (status) {
    lines.push('', 'Changed files:')
    lines.push(...status.split('\n').map((l) => `  ${l}`))
  }

  const result = lines.join('\n')
  // 截断防止超长
  return result.length > MAX_GIT_CHARS ? result.slice(0, MAX_GIT_CHARS) + '\n  ...(truncated)' : result
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit 2>&1 | head -30
```

预期：无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/context/gitContext.ts
git commit -m "feat(prompt): add git status context loader"
```

---

## Task 5: claudeMdContext + memoryContext

**Files:**
- Create: `src/context/claudeMdContext.ts`
- Create: `src/context/memoryContext.ts`

- [ ] **Step 1: 创建 claudeMdContext.ts**

```typescript
// src/context/claudeMdContext.ts
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'

function readFile(filePath: string): string | null {
  try {
    return existsSync(filePath) ? readFileSync(filePath, 'utf8').trim() : null
  } catch {
    return null
  }
}

export async function loadClaudeMd(cwd: string): Promise<string | null> {
  const home = homedir()
  const parts: string[] = []

  // 从 cwd 向上遍历到 home，收集所有 CLAUDE.md
  let dir = cwd
  while (dir !== home && dir !== dirname(dir)) {
    const candidate = join(dir, 'CLAUDE.md')
    const content = readFile(candidate)
    if (content) parts.push(`# From: ${candidate}\n\n${content}`)
    dir = dirname(dir)
  }

  // 全局配置
  const globalConfig = readFile(join(home, '.claude', 'CLAUDE.md'))
  if (globalConfig) parts.push(`# From: ~/.claude/CLAUDE.md\n\n${globalConfig}`)

  return parts.length > 0 ? parts.join('\n\n') : null
}
```

- [ ] **Step 2: 创建 memoryContext.ts**

```typescript
// src/context/memoryContext.ts
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export async function loadMemory(cwd: string): Promise<string | null> {
  // 对标 Claude Code 的 memory 路径：~/.claude/projects/{encoded-path}/memory/MEMORY.md
  const encoded = cwd.replace(/\//g, '-')
  const memoryPath = join(homedir(), '.claude', 'projects', encoded, 'memory', 'MEMORY.md')

  try {
    if (!existsSync(memoryPath)) return null
    const content = readFileSync(memoryPath, 'utf8').trim()
    return content ? `# Memory\n\n${content}` : null
  } catch {
    return null
  }
}
```

- [ ] **Step 3: 验证编译**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit 2>&1 | head -30
```

预期：无新增错误

- [ ] **Step 4: Commit**

```bash
git add src/context/claudeMdContext.ts src/context/memoryContext.ts
git commit -m "feat(prompt): add CLAUDE.md and MEMORY.md context loaders"
```

---

## Task 6: bootstrap/state.ts 新增 workspaceDir

**Files:**
- Modify: `src/bootstrap/state.ts`

- [ ] **Step 1: 修改 state.ts，新增 workspaceDir**

将文件替换为：

```typescript
// 全局会话状态 — 对标 Claude Code src/bootstrap/state.ts
// 注意：只存不可变的启动时信息，运行时变化的数据放 React state

import { homedir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

export type State = {
  originalCwd: string   // 启动时的工作目录
  projectRoot: string   // 项目根目录（当前阶段与 originalCwd 相同）
  workDir: string       // 当前工作目录
  taskDir: string       // 任务存储目录 ~/.pi/tasks/
  sessionId: string
  workspaceDir: string  // .pi/sessions/{sessionId}/workspace/
}

const _sessionId = randomUUID()

const state: State = {
  originalCwd: process.cwd(),
  projectRoot: process.cwd(),
  workDir: process.cwd(),
  taskDir: join(homedir(), '.pi', 'tasks'),
  sessionId: _sessionId,
  workspaceDir: join(process.cwd(), '.pi', 'sessions', _sessionId, 'workspace'),
}

export function getOriginalCwd(): string {
  return state.originalCwd
}

export function getProjectRoot(): string {
  return state.projectRoot
}

export function getWorkDir(): string {
  return state.workDir
}

export function getTaskDir(): string {
  return state.taskDir
}

export function getSessionId(): string {
  return state.sessionId
}

export function getWorkspaceDir(): string {
  return state.workspaceDir
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit 2>&1 | head -30
```

预期：无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/bootstrap/state.ts
git commit -m "feat(prompt): add workspaceDir to bootstrap state"
```

---

## Task 7: 重写 prompts.ts（主入口）

**Files:**
- Modify: `src/constants/prompts.ts`

- [ ] **Step 1: 重写 prompts.ts**

```typescript
// src/constants/prompts.ts
// 系统提示词主入口 — 对标 Claude Code src/constants/prompts.ts

import {
  registerSection,
  registerVolatileSection,
  resolveSystemPrompt,
  clearSectionCache,
  type SectionContext,
} from './systemPromptSections.js'
import { IDENTITY, DOING_TASKS, TONE, PLAN_MODE_SECTION } from './promptSections.js'
import { loadEnvInfo } from '../context/envContext.js'
import { loadWorkspaceSection } from '../context/workspaceContext.js'
import { loadGitStatus } from '../context/gitContext.js'
import { loadClaudeMd } from '../context/claudeMdContext.js'
import { loadMemory } from '../context/memoryContext.js'

let initialized = false

export function initSystemPrompt(): void {
  if (initialized) return
  initialized = true

  // 静态段（缓存后永不失效）
  registerSection('identity',    async () => IDENTITY)
  registerSection('doing_tasks', async () => DOING_TASKS)
  registerSection('tone',        async () => TONE)

  // 动态段（首次加载后缓存，/clear 时重置）
  registerSection('env_info',    (ctx) => loadEnvInfo(ctx))
  registerSection('workspace',   (ctx) => loadWorkspaceSection(ctx))
  registerSection('git_status',  (ctx) => loadGitStatus(ctx.cwd))
  registerSection('claude_md',   (ctx) => loadClaudeMd(ctx.cwd))
  registerSection('memory',      (ctx) => loadMemory(ctx.cwd))

  // volatile 段（每轮重新执行）
  registerVolatileSection('plan_mode', async (ctx) =>
    ctx.isPlanMode ? PLAN_MODE_SECTION : null,
  )
}

export async function getSystemPrompt(ctx: SectionContext): Promise<string> {
  return resolveSystemPrompt(ctx)
}

export { clearSectionCache }
export type { SectionContext }
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit 2>&1 | head -30
```

预期：无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/constants/prompts.ts
git commit -m "feat(prompt): rewrite prompts.ts with section registration"
```

---

## Task 8: 更新 REPL.tsx 调用

**Files:**
- Modify: `src/screens/REPL.tsx:8` (import)
- Modify: `src/screens/REPL.tsx:~246` (getSystemPrompt call)
- Modify: `src/screens/REPL.tsx:~152` (/clear handler)

- [ ] **Step 1: 更新 import 行**

在 REPL.tsx 顶部找到：
```typescript
import { getSystemPrompt } from '../constants/prompts.js'
```

替换为：
```typescript
import { getSystemPrompt, initSystemPrompt, clearSectionCache, type SectionContext } from '../constants/prompts.js'
import { getWorkDir, getSessionId, getWorkspaceDir } from '../bootstrap/state.js'
```

- [ ] **Step 2: 在 REPL 组件初始化时调用 initSystemPrompt**

找到 REPL 函数组件开头（`function REPL(` 或 `const REPL =`），在 state/ref 声明之前插入：

```typescript
// 初始化系统提示词注册表（只执行一次）
initSystemPrompt()
```

- [ ] **Step 3: 更新 getSystemPrompt 调用（约第 246 行）**

找到：
```typescript
systemPrompt: getSystemPrompt(isPlanModeRef.current),
```

替换为：
```typescript
systemPrompt: await getSystemPrompt({
  cwd: getWorkDir(),
  sessionId: getSessionId(),
  workspaceDir: getWorkspaceDir(),
  isPlanMode: isPlanModeRef.current,
}),
```

注意：这行在 `query()` 调用内，`query()` 所在的函数已经是 async，所以 await 合法。

- [ ] **Step 4: 在 /clear 处理中调用 clearSectionCache**

找到 /clear 命令处理块（约第 152 行），在 `history.clearMessages()` 之前插入：

```typescript
clearSectionCache()
```

结果应为：
```typescript
if (input === '/clear') {
  void executeHooks({ ... })
  sessionIdRef.current = randomUUID()
  void executeHooks({ ... })
  clearSectionCache()          // ← 新增
  history.clearMessages()
  conversationRef.current = []
  return
}
```

- [ ] **Step 5: 验证编译**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npx tsc --noEmit 2>&1 | head -30
```

预期：无错误

- [ ] **Step 6: 构建验证**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
npm run build 2>&1 | tail -20
```

预期：构建成功，无 error

- [ ] **Step 7: Commit**

```bash
git add src/screens/REPL.tsx
git commit -m "feat(prompt): wire async getSystemPrompt and clearSectionCache in REPL"
```

---

## Task 9: 端到端验证

- [ ] **Step 1: 启动 Pi，观察系统提示词**

```bash
cd /Users/mac/Documents/ai/pi-claude-code
PI_DEBUG_PROMPT=1 npm run dev 2>&1 | head -100
```

（如无 PI_DEBUG_PROMPT，改为在 `resolveSystemPrompt` 中临时加 `console.error(result.slice(0, 500))`）

预期：输出包含 `# User Environment Info`、`# Workspace`、`# Git Status` 等段落

- [ ] **Step 2: 验证 workspace 目录创建**

启动 Pi 后检查：
```bash
ls -la /Users/mac/Documents/ai/pi-claude-code/.pi/sessions/
```

预期：存在 `{sessionId}/workspace/` 目录

- [ ] **Step 3: 验证 plan mode volatile 段**

在 Pi 中输入 `/plan`（触发 plan mode），确认系统提示词新增 `PLAN MODE ACTIVE` 段，退出后消失。

- [ ] **Step 4: 验证 /clear 重置缓存**

在 Pi 中输入 `/clear`，再次 query，确认 `Session date` 和 git 状态是最新的（通过修改一个文件触发 git 变更后 clear，再 query 确认 Changed files 更新）。

- [ ] **Step 5: 最终 Commit（如有调整）**

```bash
git add -A
git commit -m "feat(prompt): complete system prompt dynamic context implementation"
```

---

## 自检结果

**Spec 覆盖：** ✅ 所有 9 个 section 均有对应 Task  
**占位符扫描：** ✅ 无 TBD/TODO  
**类型一致性：** ✅ `SectionContext` 在 systemPromptSections.ts 定义并导出，所有 context loader 签名一致  
**workspaceDir 创建：** ✅ 在 `loadWorkspaceSection` 中 `mkdirSync(recursive: true)`，无需单独 ensureWorkspaceDir  
**initSystemPrompt 幂等性：** ✅ `if (initialized) return` 保护
