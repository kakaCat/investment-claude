# Task Persistence Design

**日期**: 2026-04-14  
**状态**: 草稿

---

## Goal

将 pi 的 task 系统从纯内存 Map 升级为文件持久化 + 内存缓存，对标 Claude Code 的 `utils/tasks.ts` 实现。重启后 task 数据不丢失，并为未来多进程并发（AgentTool 子 agent）做好准备。

---

## Architecture

**写路径**：Tool `call()` → `taskFileStore` 写文件（加锁）→ 更新 AppState 内存  
**读路径**：Tool `call()` → `context.getAppState().tasks`（纯内存，快）  
**启动**：`initTaskStore()` 扫描目录，把所有 `*.json` 加载进 AppState

内存是文件的读缓存。文件是真正的持久化存储。两者始终保持同步（写失败则不更新内存）。

---

## File Storage

### 目录结构

```
~/.claude/tasks/{sessionId}/
  1.json
  2.json
  3.json
  .lock           ← proper-lockfile 使用的锁文件
```

**Session ID**：每次进程启动生成一个 `crypto.randomUUID()`，模块级单例（`src/tasks/sessionId.ts`）。  
Session 目录隔离保证不同进程不会互相干扰。

> **Future: Team 支持**  
> Claude Code 用 `~/.claude/tasks/{teamName}/` 支持多 agent 共享同一 task list。  
> pi 实现 TeamCreate 工具时，目录结构改为 `~/.claude/tasks/{teamName}/{sessionId}/`（leader 用 `~/.claude/tasks/{teamName}/`）。  
> 当前用 `sessionId` 作为唯一路径，无需 team 即可运行。

### Task 文件格式

每个 task 对应一个 JSON 文件，文件名为 `{id}.json`：

```json
{
  "id": 1,
  "subject": "Implement login page",
  "description": "Add email/password login form",
  "activeForm": "Implementing login page",
  "status": "in_progress",
  "owner": "agent-1",
  "blockedBy": [],
  "output": null,
  "createdAt": "2026-04-14T10:00:00.000Z",
  "updatedAt": "2026-04-14T10:05:00.000Z"
}
```

---

## New Files

### `src/tasks/sessionId.ts`

模块级单例，生成并缓存当前 session ID。进程内唯一，跨模块共享。

```typescript
let _sessionId: string | undefined

export function getSessionId(): string {
  if (!_sessionId) _sessionId = crypto.randomUUID()
  return _sessionId
}
```

### `src/tasks/taskFileStore.ts`

封装所有文件 I/O。对外暴露三个函数：

```typescript
/**
 * 初始化：创建 session 目录，从文件加载所有 tasks 到 AppState。
 * 在 query() 开始前调用一次。
 */
export async function initTaskStore(): Promise<void>

/**
 * 创建新 task：分配 ID，写文件（加锁），更新 AppState。
 * 返回创建的 Task。
 */
export async function createTaskFile(
  data: Omit<Task, 'id'>,
  context: ToolUseContext,
): Promise<Task>

/**
 * 更新已有 task：写文件（加锁），更新 AppState。
 * Task 不存在时返回 null（不走文件）。
 */
export async function updateTaskFile(
  id: number,
  updates: Partial<Omit<Task, 'id'>>,
  context: ToolUseContext,
): Promise<Task | null>
```

**ID 分配**：`nextTaskId` 仍存在 AppState，`createTaskFile` 从 `getAppState().nextTaskId` 取值，写文件成功后再通过 `context.setAppState` 递增。

**文件锁**：使用 `proper-lockfile` 包，配置 `{ retries: { retries: 3, minTimeout: 50 }, stale: 10000 }`。每次写操作锁 `{dir}/.lock` 文件，写完释放。

---

## Modified Files

### `src/query.ts`

在 `query()` 函数开始（构造 `toolUseContext` 之前）调用一次 `initTaskStore()`：

```typescript
import { initTaskStore } from './tasks/taskFileStore.js'

// query() 内，toolUseContext 构造之前：
await initTaskStore()
```

`initTaskStore` 内部是幂等的（目录已存在时不报错，AppState 已有 tasks 时跳过加载）。

### `src/tools/TaskCreateTool/TaskCreateTool.tsx`

`call()` 改为调 `createTaskFile(data, context)`，移除手动 `setAppState` 逻辑。

### `src/tools/TaskUpdateTool/TaskUpdateTool.tsx`

`call()` 改为调 `updateTaskFile(id, updates, context)`，移除手动 `setAppState` 逻辑。

### `src/tools/TaskStopTool/TaskStopTool.tsx`

`call()` 改为调 `updateTaskFile(id, { status: 'stopped', updatedAt: now }, context)`。

### 不变的文件

- `TaskGetTool` — 仍从 `context.getAppState().tasks` 读内存，无需改动
- `TaskListTool` — 同上
- `TaskOutputTool` — 同上
- `src/state/AppState.ts` — 类型不变，`tasks` / `nextTaskId` 字段保留

---

## Error Handling

| 场景 | 处理 |
|------|------|
| 文件锁超时（3次重试后失败） | tool 返回 `ERROR: Failed to acquire task lock, please retry` |
| 文件写失败 | 不更新 AppState，tool 返回 `ERROR: Failed to write task file: {reason}` |
| 启动加载时某文件解析失败 | 跳过该文件，log warning，不影响其他 task |
| session 目录不存在 | `initTaskStore` 自动 `mkdir -p` 创建 |
| task ID 不存在（updateTaskFile） | 内存里查不到直接返回 null，不走文件 |

---

## Dependencies

新增 npm 包：**`proper-lockfile`**（MIT 协议，零依赖，Node.js 文件锁标准库）。

```bash
npm install proper-lockfile
npm install -D @types/proper-lockfile
```

---

## Out of Scope

- Task reminder 注入（类似 todo reminder）— task 靠 `task_list` 主动查询，不需要注入
- Team 支持 — 见 Future 注释，留待后续实现
- Task 数据迁移 — session 隔离，每次启动新 session，无历史数据迁移需求
