// src/state/AppState.ts
// 对标 Claude Code src/state/AppStateStore.ts
// 当前只包含工具实际需要读写的字段。
// Claude Code 的完整字段见注释，按需逐步添加。

import type { TodoItem, Task } from '../tasks/types.js'
import type { ToolPermissionContext } from '../permissions/types.js'
import { createEmptyPermissionContext } from '../permissions/types.js'

export type AppState = {
  // ── 当前已实现 ────────────────────────────────────────────────────────────

  /** Todo list — TodoWriteTool 写，reminder 注入器读 */
  readonly todos: readonly TodoItem[]

  /** Task 注册表 — Task*Tools 读写 */
  readonly tasks: ReadonlyMap<number, Task>

  /** Task 自增 ID 计数器 */
  readonly nextTaskId: number

  /** Permission rules and mode — loaded from settings.json */
  readonly permissionContext: ToolPermissionContext

  // ── 以下字段对标 Claude Code，暂未实现 ──────────────────────────────────────

  // agentId?: string
  //   当前 agent 的唯一 ID。主线程为 undefined，子 agent 有值。
  //   用途：多 agent 场景下区分 todo/task 归属（Claude Code 按 agentId 分桶存 todos）。
  //   参考：Claude Code AppState.todos: { [agentId: string]: TodoList }
  //   添加时机：实现子 agent 独立 todo 列表时。

  // cronTasks?: CronTask[]
  //   当前从 src/cron/cronStore.ts 独立管理。
  //   添加时机：cron 任务也需要提醒注入时。

  // isPlanMode?: boolean
  //   当前在 REPL.tsx useState 中。工具不需要读取它（通过 canUseTool 拦截写操作）。
  //   添加时机：工具需要感知当前是否处于计划模式时。

  // fileHistory?: FileHistoryState
  //   Claude Code 用于追踪文件读写历史，支持 post-compact 文件恢复。
  //   添加时机：实现上下文压缩后文件状态恢复功能时。
}

// ── 单例 store ────────────────────────────────────────────────────────────────

let _state: AppState = {
  todos: [],
  tasks: new Map<number, Task>() as ReadonlyMap<number, Task>,
  nextTaskId: 1,
  permissionContext: createEmptyPermissionContext(),
}

/** 读取当前 AppState 快照 */
export function getAppState(): Readonly<AppState> {
  return _state
}

/**
 * 以函数式方式更新 AppState（对标 Claude Code context.setAppState）。
 * updater 必须返回新对象（不可原地 mutate）。
 *
 * 注意：Claude Code 还有 setAppStateForTasks，专给后台任务用，
 * 确保子 agent 的 setAppState 能穿透到根 store。
 * 当前 pi 只有主线程，暂不需要，留注释备用：
 * // setAppStateForTasks?
 */
export function setAppState(updater: (prev: AppState) => AppState): void {
  _state = updater(_state)
}
