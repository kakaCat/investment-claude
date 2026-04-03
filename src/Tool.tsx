// Tool 接口层 — 对标 Claude Code src/Tool.ts
// 包含: ToolUseContext, Tool 接口, ToolDef, buildTool 工厂, 默认 UI 渲染器

import React from 'react'
import { Box, Text } from 'ink'

/** 工具执行上下文（对标 Claude Code ToolUseContext，简化版） */
export type ToolUseContext = {
  abortSignal: AbortSignal
  cwd: string
  /** 全部工具列表（含 deferLoading），供 ToolSearchTool 遍历 */
  tools: Tool[]
  // Design note: agent definitions are NOT stored in ToolUseContext.
  // AgentTool loads them directly from disk + built-in registry.
  // Rationale: context = execution environment; agent registry = AgentTool's concern.
  // If multiple tools ever need agent access, follow Claude Code's pattern of
  // a toolUseContext.options bag rather than polluting the core context fields.
  /** 将工具问题交还给 REPL，等待用户选择后再继续 */
  askUser?: (
    question: string,
    options: ReadonlyArray<{ label: string; description?: string }>,
  ) => Promise<string>
  /** Signal REPL to activate plan mode */
  enterPlanMode?: () => Promise<void>
  /** Present plan to user, wait for approval. Resolves 'approved', 'rejected', or a rejection reason string */
  exitPlanMode?: (plan: string) => Promise<string>
  /** Present execution summary to user, wait for verification. Resolves 'verified', 'rejected', or a rejection reason string */
  verifyExecution?: (summary: string) => Promise<string>
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

function defaultRenderToolUse(name: string, input: unknown): React.ReactNode {
  return (
    <Box>
      <Text color="cyan" bold>
        {name}{' '}
      </Text>
      <Text color="gray">{JSON.stringify(input)}</Text>
    </Box>
  )
}

function defaultRenderToolResult(result: string): React.ReactNode {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="gray">{display}</Text>
    </Box>
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
