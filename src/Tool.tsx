// Tool 接口层 — 对标 Claude Code src/Tool.ts
// 包含: ToolUseContext, Tool 接口, ToolDef, buildTool 工厂, 默认 UI 渲染器

import React from 'react'
import { Box, Text } from 'ink'
import type { AppState } from './state/AppState.js'

/** 工具执行上下文（对标 Claude Code ToolUseContext） */
export type ToolUseContext = {
  abortSignal: AbortSignal
  cwd: string
  /** 全部工具列表（含 deferLoading），供 ToolSearchTool 遍历 */
  tools: Tool[]
  // Design note: agent definitions are NOT stored in ToolUseContext.
  // AgentTool loads them directly from disk + built-in registry.

  // ── AppState 读写（对标 Claude Code getAppState / setAppState）────────────
  /** 读取当前全局运行时状态快照 */
  getAppState(): Readonly<AppState>
  /**
   * 以函数式方式更新全局运行时状态。
   * updater 必须返回新对象（不可原地 mutate）。
   *
   * Claude Code 还有 setAppStateForTasks，专给后台任务用（子 agent 调用时
   * 穿透到根 store）。当前 pi 只有主线程，暂不需要，留注释备用：
   * // setAppStateForTasks?: (updater: (prev: AppState) => AppState) => void
   */
  setAppState(updater: (prev: AppState) => AppState): void

  // ── 用户交互回调 ──────────────────────────────────────────────────────────
  /** 将工具问题交还给 REPL，等待用户选择后再继续 */
  askUser?: (
    question: string,
    options: ReadonlyArray<{ label: string; description?: string }>,
  ) => Promise<string>
  /** Signal REPL to activate plan mode */
  enterPlanMode?: () => Promise<void>
  /** Present plan to user, wait for approval. Resolves 'approved', 'rejected', or a rejection reason string */
  exitPlanMode?: (plan: string) => Promise<string>
  /** Present execution summary to user, wait for verification */
  verifyExecution?: (summary: string) => Promise<string>

  // ── 以下字段对标 Claude Code，暂未实现 ─────────────────────────────────────

  // messages?: Message[]
  //   当前对话历史快照。Claude Code 的部分工具（如 TodoWrite reminder 逻辑）
  //   需要扫描消息历史。当前 pi 的 reminder 逻辑在 query.ts 里完成，工具本身不需要读。
  //   添加时机：工具自身需要读取对话历史时。

  // agentId?: string
  //   当前 agent ID。主线程为 undefined，子 agent 有值。
  //   用途：子 agent 隔离各自的 AppState（Claude Code 按 agentId 分桶存 todos）。
  //   添加时机：实现子 agent 独立 todo/task 列表时。

  // setToolJSX?: (args: { jsx: React.ReactNode | null; ... } | null) => void
  //   工具注入自定义 UI（覆盖默认的 renderToolResult）。
  //   添加时机：需要工具动态注入持续展示的 UI 面板时（如 Tmux、WebBrowser）。

  // appendSystemMessage?: (msg: SystemMessage) => void
  //   向对话追加 UI-only 系统消息（不发给 API）。
  //   添加时机：工具需要在对话流中插入提示性系统消息时。

  // readFileState?: FileStateCache
  //   LRU 缓存已读文件内容，避免重复读取。
  //   添加时机：实现文件读取缓存 / post-compact 恢复时。
}

/** 工具接口 */
export interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
  /** 搜索关键词，供 ToolSearchTool 做文本匹配 */
  searchHint?: string
  /** true = 不放入初始 API context，等模型通过 ToolSearchTool 发现后再激活 */
  deferLoading?: boolean
  /** 运行时决定工具是否可用 */
  isEnabled(): boolean
  /** 是否只读（不修改文件/系统状态） */
  isReadOnly(): boolean
  /** 执行工具，返回结果字符串 */
  call(input: unknown, context: ToolUseContext): Promise<string>
  /** 工具调用时展示的 Ink UI */
  renderToolUse(input: unknown): React.ReactNode
  /** 工具结果展示的 Ink UI */
  renderToolResult(result: string): React.ReactNode
}

/** buildTool 的输入定义（call 必填，其余有默认值） */
export type ToolDef = Pick<Tool, 'name' | 'description' | 'inputSchema' | 'call'> &
  Partial<Omit<Tool, 'name' | 'description' | 'inputSchema' | 'call'>>

function defaultRenderToolUse(_name: string, input: unknown): React.ReactNode {
  return <Text color="gray">{JSON.stringify(input)}</Text>
}

function defaultRenderToolResult(result: string): React.ReactNode {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Text color="gray" wrap="wrap">
      {display}
    </Text>
  )
}

/** 工具工厂：填充所有默认值 */
export function buildTool(def: ToolDef): Tool {
  return {
    isEnabled: () => true,
    isReadOnly: () => false,
    deferLoading: false,
    renderToolUse: (input) => defaultRenderToolUse(def.name, input),
    renderToolResult: (result) => defaultRenderToolResult(result),
    ...def,
  }
}
