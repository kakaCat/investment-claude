# 记忆系统 + 助手模式设计文档

**日期**: 2026-04-29  
**状态**: 待实现  
**参考**: Claude Code `src/memdir/`, `src/utils/forkedAgent.ts`, `src/services/extractMemories/`

---

## 背景

### 现有记忆加载链路

```
第一次发消息
    ↓
getSystemPrompt(ctx) → resolveSystemPrompt()
    ↓
registerSection('memory') → loadMemory(cwd) 读取 MEMORY.md → 缓存
    ↓
MEMORY.md 内容注入系统提示词

后续每次发消息
    ↓
registerSection('memory') → 直接返回缓存（不再读文件）
```

存在两个问题：
1. 会话中途写入新记忆后索引立即过时（缓存无法感知）
2. 每次请求都携带索引 token，即使模型不需要查记忆

**新设计**：`memoryContext.ts` 整个删除，记忆系统说明并入静态常量 `MEMORY_SYSTEM_INSTRUCTIONS`，注入一段固定文本告知模型使用 `memory_search` 工具——与 ToolSearchTool 完全相同的模式，模型按需发现和加载，不依赖文件读取。

### 缺少的能力

pi 当前已有基础记忆加载，但缺少：

1. 树形类型系统（可扩展记忆类型）
2. 插件化存储后端（本地、Obsidian、向量数据库）
3. MemorySearchTool（模型主动加载记忆，与 ToolSearchTool 相同模式）
4. 记忆时效警告
5. 可复用的 Forked Agent 机制
6. 助手模式（主动推送、夜间整理、定时任务、Brief 摘要）

---

## 核心设计：Memory 系统对标 Tool 系统

### Memory 接口（类比 `Tool` 接口）

```typescript
// src/memdir/Memory.ts

/** 从 frontmatter 解析出的文件元数据（不含正文内容，供扫描/搜索使用） */
export interface MemoryFileMeta {
  filePath: string
  name: string
  description: string
  type: string        // 叶节点类型名，如 "中学数学"（不含路径）
  searchHint?: string
  mtimeMs: number
}

/** 完整记忆对象（含正文内容和类型处理器，供注入使用） */
export interface Memory extends MemoryFileMeta {
  content: string
  handler: MemoryTypeHandler
}

export interface MemoryTypeHandler {
  name: string
  description: string
  defaultWeight: number   // MemorySearchTool 关键词打分时的基础权重
  ageWarningDays: number  // 超过几天在 MemorySearchTool 返回结果时附加过时警告
  formatForInjection(memory: Memory): string
}
```

---

## 树形类型系统

### 结构

类型形成任意深度的树。4个基础类型是内置根节点，可扩展同级或子级节点：

```
根节点
  ├── user          （内置）
  ├── feedback      （内置）
  ├── project       （内置）
  ├── reference     （内置）
  ├── 数学          （自定义根节点）
  │   ├── 小学数学
  │   ├── 中学数学
  │   └── 高中数学
  └── 语文
      └── 古诗词

每个节点下挂 memory 文件（叶节点）
```

**规则：**
- 4个基础类型是内置根节点，不强制继承
- ForkedAgent 可新增任意根节点（与基础4个平级）
- 任意节点下可以挂子节点（任意深度）
- Memory 文件可以挂在树的任意节点上
- 搜索父节点时自动包含所有子节点下的记忆

### 内置类型定义（`src/memdir/types/`）

```
src/memdir/types/
  user.ts        defaultWeight=3, ageWarningDays=30
  feedback.ts    defaultWeight=4, ageWarningDays=90
  project.ts     defaultWeight=5, ageWarningDays=7
  reference.ts   defaultWeight=2, ageWarningDays=180
```

### 自定义类型存储（持久化到 memory 目录）

```yaml
# ~/.../memory/.types/数学.md
---
kind: memory-type
name: 数学
parent: null          # null = 根节点
description: 数学相关记忆
defaultWeight: 3
ageWarningDays: 30
injectOnStartup: false
searchHint: math 数学 计算 公式
---

# ~/.../memory/.types/中学数学.md
---
kind: memory-type
name: 中学数学
parent: 数学          # 挂在数学下
description: 中学数学相关记忆
---
```

### Memory 文件 frontmatter（扩展，兼容 CC）

`type` 字段只写叶节点名称（不含路径），树形结构由 `MemoryTypeRegistry` 负责解析：

```yaml
---
name: 二次方程解法
description: 解一元二次方程的方法
type: 中学数学         # 叶节点名，注册表知道它在 数学 → 中学数学
searchHint: 一元二次 配方法 求根公式    # 可选，CC 忽略未知字段
---
```

### 类型注册表（`src/memdir/typeRegistry.ts`）

```typescript
export class MemoryTypeRegistry {
  /** 加载内置4个类型 + 扫描 .types/ 目录的自定义类型 */
  async load(memoryDir: string): Promise<void>

  /** 获取指定类型的处理器（含继承链回退） */
  getHandler(typeName: string): MemoryTypeHandler

  /** 返回某节点及其所有子节点的类型名列表（用于树形搜索） */
  getSubtree(typeName: string): string[]

  /** ForkedAgent 调用：注册新类型并持久化到 .types/ */
  async registerType(def: CustomTypeDefinition): Promise<void>
}
```

---

## 插件化存储后端

记忆系统支持多种存储后端，通过统一接口对接：

```typescript
// src/memdir/backends/MemoryBackend.ts
export interface MemoryBackend {
  name: string

  /** 读取所有记忆文件元数据 */
  scanFiles(signal: AbortSignal): Promise<MemoryFileMeta[]>

  /** 读取指定记忆文件内容 */
  readFile(filePath: string): Promise<string>

  /** 写入记忆文件 */
  writeFile(filePath: string, content: string): Promise<void>

  /** 语义搜索（向量后端实现，本地后端返回 null 降级到关键词） */
  semanticSearch?(query: string, topK: number): Promise<MemoryFileMeta[]>
}
```

### 三种后端实现

#### 1. LocalFS（默认）

```typescript
// src/memdir/backends/LocalFSBackend.ts
// 路径：~/.claude/projects/{encoded-cwd}/memory/
// 与 CC 完全兼容
```

#### 2. Obsidian

```typescript
// src/memdir/backends/ObsidianBackend.ts
// 默认路径：~/Documents/Obsidian Vault/pi/memory/  （可配置）
// 读写使用直接文件操作（fs），不依赖 obsidian-cli
// obsidian-cli 仅用于搜索已有 Obsidian 笔记（非 memory 目录的笔记）
// 支持读取已有 Obsidian 笔记作为记忆（需有 name/description/type frontmatter）
```

配置示例（`settings.json`）：

```json
{
  "memory": {
    "backend": "obsidian",
    "obsidianVaultPath": "/Users/mac/Documents/Obsidian Vault",
    "obsidianMemoryFolder": "pi/memory"
  }
}
```

#### 3. VectorDB

```typescript
// src/memdir/backends/VectorDBBackend.ts
// 支持：sqlite-vec（本地）/ Chroma / Pinecone（远程）
// 写入时自动生成 embedding
// 搜索时使用语义相似度代替关键词打分
// 本地优先：默认使用 sqlite-vec，无需额外服务
```

配置示例：

```json
{
  "memory": {
    "backend": "vectordb",
    "vectordb": {
      "provider": "sqlite-vec",    // "sqlite-vec" | "chroma" | "pinecone"
      "path": "~/.pi/memory.db"    // sqlite-vec 本地路径
    }
  }
}
```

### 混合模式（推荐生产配置）

```json
{
  "memory": {
    "backend": "hybrid",
    "primary": "obsidian",          // 写入目标
    "search": "vectordb"            // 搜索引擎
  }
}
```

写入走 Obsidian，搜索走向量数据库。同步机制：**写入时双写**——`writeFile()` 先写 Obsidian，再将内容 embedding 写入向量库，两步均成功才返回。

### 搜索降级策略

```
向量后端可用？
    ├── 是 → 语义搜索（embedding 相似度）
    └── 否 → 关键词打分（scoreMemoryForQuery，类比 ToolSearchTool）
```

---

## Phase 1 — Forked Agent

### 目标

提供可复用的子 agent 运行机制，供 Phase 3 助手模式（Dream、Brief）调用。Phase 2 的 per-turn injection 使用本地关键词打分，不依赖 Forked Agent。

### 新文件：`src/utils/forkedAgent.ts`

```typescript
export type ForkedAgentParams = {
  /** 给子 agent 的任务描述 */
  promptMessages: Message[]
  /** 主对话最近 N 条消息，作为上下文 */
  contextMessages: Message[]
  /** 权限过滤函数 */
  canUseTool: CanUseToolFn
  /** 最大轮次，默认 5 */
  maxTurns?: number
  /** 日志标记 */
  label?: string
  /** 限制可访问的记忆类型（类型名列表，含子树） */
  memoryTypes?: string[]
}

export type ForkedAgentResult = {
  messages: Message[]
  totalUsage: Usage
}

export async function runForkedAgent(params: ForkedAgentParams): Promise<ForkedAgentResult>
```

**与 CC 的差异**：CC 通过 prompt cache 共享近乎零成本。pi 直接传入最近 N 条消息，重新处理 input token，功能等价，对本地工具规模完全可接受。

**ForkedAgent 创建新类型**：提取记忆时，若内容不适合现有任何类型，agent 调用 `MemoryTypeRegistry.registerType()` 创建新类型，再写入 memory 文件。

---

## Phase 2 — 记忆系统

### 2a. 记忆系统静态说明

**删除文件**: `src/context/memoryContext.ts`（不再需要）

**修改文件**: `src/constants/promptSections.ts` — 新增常量 `MEMORY_SYSTEM_INSTRUCTIONS`

**修改文件**: `src/constants/prompts.ts` — 将 `registerSection('memory', ...)` 改为引用静态常量

```typescript
// promptSections.ts
export const MEMORY_SYSTEM_INSTRUCTIONS = `
## Memory System

你有一个持久化记忆系统，通过 memory_search 工具访问（与 tool_search 使用方式相同）：
- memory_search({ query: "types" })           查看所有记忆类型树
- memory_search({ query: "search:<关键词>" }) 搜索相关记忆，返回内容 + 时效信息
- memory_search({ query: "select:<文件名>" }) 读取指定记忆文件全文
- memory_search({ query: "type:<类型名>" })   列出指定类型（含子类型）的所有记忆

发现值得记住的信息时主动写入记忆文件（四种基础类型：user / feedback / project / reference，
也可创建新类型）。写入格式见 frontmatter 规范，写完后更新 MEMORY.md 索引。
`

// prompts.ts
registerSection('memory', async () => MEMORY_SYSTEM_INSTRUCTIONS)  // 纯静态，无文件读取
```

```typescript
// TODO: 后续可在 Stop Hook 加入自动提取，参考 CC src/services/extractMemories/extractMemories.ts
// 触发：每轮模型无工具调用完成回复后，fire-and-forget 调用 runForkedAgent
// 权限：只允许读操作 + 写入 memory 目录
// 退出前 drain：drainPendingExtraction(60_000)
```

### 2b. MemorySearchTool 内部搜索逻辑

**新文件**: `src/memdir/memoryScan.ts` — 扫描文件元数据，供 MemorySearchTool 调用

打分规则（关键词模式，无向量后端时，与 `ToolSearchTool.scoreToolForQuery` 相同模式）：
- `name` 完全匹配 +10 / 包含 +5
- `searchHint` 词边界 +4 / 包含 +2
- `description` 词边界 +2 / 包含 +1
- `type` 树形匹配（含父节点） +3
- `handler.defaultWeight` 作为基础分

有向量后端时升级为语义搜索。

### 2c. 记忆时效警告

**新文件**: `src/memdir/memoryAge.ts`

```typescript
export function getMemoryAge(mtimeMs: number): string         // 今天 / 昨天 / N 天前
export function buildMemoryAgeWarning(mtimeMs: number, handler: MemoryTypeHandler): string | null
// 超过 handler.ageWarningDays 天时追加警告
```

### 2d. MemorySearchTool（类比 ToolSearchTool）

**新文件**: `src/tools/MemorySearchTool/MemorySearchTool.tsx`  
**注册位置**: `src/tools/index.ts`（与 ToolSearchTool 相同方式注册，模型直接调用）

模型可主动调用：

| 查询格式 | 行为 |
|---------|------|
| `type:feedback` | 列出所有 feedback 类型记忆（含时效信息） |
| `type:数学` | 列出数学及所有子类型记忆 |
| `search:二次方程` | 关键词/语义搜索，返回 Top 5 + 文件内容 |
| `select:feedback_testing.md` | 直接读取指定文件全文 |
| `types` | 列出完整类型树结构 |

模型决定何时调用，系统不自动注入记忆文件内容。

---

## Phase 3 — 助手模式

### 启动与状态

**修改文件**: `src/bootstrap/state.ts` — 新增 `assistantModeActive: boolean`  
**新命令**: `/assistant` — 切换开关，持久化到 settings

### 四个核心能力

#### 3a. 定时任务（Cron）

复用现有 `CronCreate`。助手模式启动时自动注册默认任务（Dream、Brief）。

#### 3b. 主动推送通知

**通知队列**: `~/.pi/assistant/notifications.jsonl`

```typescript
type AssistantNotification = {
  timestamp: string
  title: string
  body: string
  source: 'dream' | 'brief' | 'cron' | 'custom'
}
```

REPL 空闲时轮询队列，有新通知时界面展示。

#### 3c. 夜间 Dream 整理

**触发**: 每日 Cron（默认凌晨 2 点）  
**实现**: `runForkedAgent({ memoryTypes: ['*'] })` — 访问全部类型

流程：
1. 读取当日对话日志（`~/.pi/logs/session-ob-*.jsonl`）
2. 子 agent 按类型整理内容，必要时创建新类型
3. 写入 memory 文件（通过配置的存储后端）
4. 更新 `MEMORY.md` 索引
5. 写入通知："今日记忆已整理，新增 N 条"

#### 3d. Brief 摘要

**触发**: Cron（默认每天上午 9 点）  
**实现**: `runForkedAgent({ memoryTypes: ['project', 'feedback'] })`

流程：
1. 读取 project + feedback 类型记忆和 TODO 状态
2. 生成今日状态摘要
3. 写入通知队列

---

## 数据流总览

```
会话开始
    ↓
系统提示词注入"记忆系统使用说明"（固定文本，不含索引内容）

用户发消息 → 模型流式回复
    ↓（回复过程中，按需 tool_use）
    ├── memory_search("types")         → 发现有哪些记忆类型
    ├── memory_search("search:xxx")    → 搜索相关记忆，返回内容 + 时效警告
    ├── memory_search("select:xxx.md") → 读取指定文件全文
    └── write_file / edit_file         → 写入新记忆文件

（助手模式，独立运行）
Dream Cron  → 独立 API 调用（无主对话上下文）
              → 读 ~/.pi/logs/ → 整理记忆 → 写 memory 文件 → 通知队列
Brief Cron  → runForkedAgent（含近期对话上下文）
              → 读 project/feedback 记忆 + TODO → 生成摘要 → 通知队列
    ↓
REPL 空闲时轮询通知队列 → 展示通知
```

---

## 文件变更清单

| Phase | 文件 | 操作 |
|-------|------|------|
| 基础 | `src/memdir/Memory.ts` | 新建（接口定义） |
| 基础 | `src/memdir/types/user.ts` | 新建 |
| 基础 | `src/memdir/types/feedback.ts` | 新建 |
| 基础 | `src/memdir/types/project.ts` | 新建 |
| 基础 | `src/memdir/types/reference.ts` | 新建 |
| 基础 | `src/memdir/typeRegistry.ts` | 新建（含树形查询） |
| 基础 | `src/memdir/backends/MemoryBackend.ts` | 新建（接口） |
| 基础 | `src/memdir/backends/LocalFSBackend.ts` | 新建 |
| 基础 | `src/memdir/backends/ObsidianBackend.ts` | 新建 |
| 基础 | `src/memdir/backends/VectorDBBackend.ts` | 新建 |
| 1 | `src/utils/forkedAgent.ts` | 新建 |
| 2a | `src/context/memoryContext.ts` | **删除** |
| 2a | `src/constants/promptSections.ts` | 修改（新增 `MEMORY_SYSTEM_INSTRUCTIONS` 常量） |
| 2a | `src/constants/prompts.ts` | 修改（memory 段改用静态常量，去掉文件读取） |
| 2b | `src/memdir/memoryScan.ts` | 新建 |
| 2c | `src/memdir/memoryAge.ts` | 新建 |
| 2d | `src/tools/MemorySearchTool/MemorySearchTool.tsx` | 新建 |
| 3 | `src/bootstrap/state.ts` | 修改（assistantModeActive） |
| 3 | `src/commands/assistant.ts` | 新建 |
| 3 | `src/assistant/notifications.ts` | 新建 |
| 3 | `src/assistant/dream.ts` | 新建 |
| 3 | `src/assistant/brief.ts` | 新建 |

---

## 未在本期实现（TODO）

- **Stop Hook 自动提取**：每轮回复后 fire-and-forget 调用 forked agent 提取记忆，退出前 drain
- **Team Memory**：多人共享记忆目录
- **向量后端同步**：Obsidian 写入后自动同步到向量数据库
- **远程向量后端**：Pinecone / Chroma 的完整对接
