// Tool 接口层 — 对标 Claude Code src/Tool.ts
// 包含: ToolUseContext, Tool 接口, ToolDef, buildTool 工厂, 默认 UI 渲染器

import React from 'react'
import { Box, Text } from 'ink'
import type { AppState } from './state/AppState.js'
import type { ToolResultContent, ImageBlock } from './types/message.js'

// ── 工具返回类型 ────────────────────────────────────────────────────────────

/**
 * 工具执行结果包装器（对标 Claude Code ToolResult<T>）
 *
 * call() 返回此类型，data 字段存储结构化数据供 UI 和后续处理使用。
 * mapToolResultToToolResultBlockParam() 负责将 data 序列化为 API 格式。
 */
export type ToolResult<T = unknown> = {
  /** 结构化数据（给 UI 和 mapToolResultToToolResultBlockParam 使用） */
  data: T
}

/**
 * API tool_result block 参数（对标 Anthropic SDK ToolResultBlockParam）
 *
 * 这是发送给 Claude API 的格式，content 可以是：
 * - string: 纯文本结果
 * - Array: 包含 text/image block 的数组（用于截图等场景）
 */
export type ToolResultBlockParam = {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string } | ImageBlock>
}

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
  /** Exit the session gracefully (fires SessionEnd hook then process.exit) */
  onExit?: () => Promise<void>

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

/**
 * 工具接口（对标 Claude Code Tool<Input, Output, P>）
 *
 * 泛型参数：
 * - Input: 工具输入类型（从 inputSchema 推导）
 * - Output: call() 返回的 data 类型
 */
export interface Tool<Input = unknown, Output = unknown> {
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

  /**
   * 执行工具，返回结构化数据。
   *
   * 职责：
   * - 执行工具逻辑
   * - 返回结构化数据（给 UI 和 mapToolResultToToolResultBlockParam 使用）
   * - 不负责序列化为 API 格式（由 mapToolResultToToolResultBlockParam 负责）
   */
  call(input: Input, context: ToolUseContext): Promise<ToolResult<Output>>

  /**
   * 可选：直接返回 content blocks（用于需要返回 image 等复杂内容的工具）
   *
   * 如果实现了此方法，query.ts 会优先调用它而不是 call()。
   * 返回值直接作为 tool_result 的 content，跳过 mapToolResultToToolResultBlockParam。
   */
  callWithBlocks?(
    input: Input,
    context: ToolUseContext,
  ): Promise<ToolResultContent['content']>

  /**
   * 将工具输出转换为 API tool_result block 格式。
   *
   * 职责：
   * - 将 call() 返回的结构化数据序列化为字符串或 content block 数组
   * - 可以添加额外的提示词、警告或指导信息给模型
   * - 支持返回 image block（用于截图等场景）
   *
   * 对标 Claude Code 的 mapToolResultToToolResultBlockParam 方法。
   */
  mapToolResultToToolResultBlockParam(
    output: Output,
    toolUseId: string,
  ): ToolResultBlockParam

  /**
   * Layer 1 budget: result 超过此字符数时写磁盘并返回预览。
   * Infinity = opt-out（工具自己管理截断）。默认 50_000。
   */
  maxResultSizeChars?: number

  /** 工具调用时展示的 Ink UI */
  renderToolUse(input: unknown): React.ReactNode
  /** 工具结果展示的 Ink UI */
  renderToolResult(result: string): React.ReactNode
}

/**
 * buildTool 的输入定义（call 和 mapToolResultToToolResultBlockParam 必填，其余有默认值）
 *
 * 对标 Claude Code ToolDef<Input, Output, P>
 */
export type ToolDef<Input = unknown, Output = unknown> = Pick<
  Tool<Input, Output>,
  'name' | 'description' | 'inputSchema' | 'call' | 'mapToolResultToToolResultBlockParam'
> &
  Partial<Omit<Tool<Input, Output>, 'name' | 'description' | 'inputSchema' | 'call' | 'mapToolResultToToolResultBlockParam'>>

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

/**
 * 工具工厂：填充所有默认值
 *
 * 对标 Claude Code buildTool<D extends AnyToolDef>(def: D): BuiltTool<D>
 */
export function buildTool<Input = unknown, Output = unknown>(
  def: ToolDef<Input, Output>,
): Tool<Input, Output> {
  return {
    isEnabled: () => true,
    isReadOnly: () => false,
    deferLoading: false,
    maxResultSizeChars: 50_000,
    renderToolUse: (input) => defaultRenderToolUse(def.name, input),
    renderToolResult: (result) => defaultRenderToolResult(result),
    ...def,
  }
}
