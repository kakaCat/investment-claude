// Message 类型 — 对标 Claude Code src/types/message.ts

export type TextContent = {
  type: 'text'
  text: string
}

export type ToolUseContent = {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export type ImageBlock = {
  type: 'image'
  source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg'; data: string }
}

export type ToolResultContent = {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string } | ImageBlock>
}

export type UserMessage = {
  type: 'user'
  content: Array<TextContent | ToolResultContent>
  /** Stable ID for SnipTool referencing — injected as [id:xxx] in API-bound messages */
  uuid?: string
  /** Meta messages (system injections) are not tagged with [id:xxx] */
  isMeta?: true
}

export type ThinkingContent = {
  type: 'thinking'
  thinking: string
  /** Anthropic 返回的加密签名，多轮对话时必须原样回传，否则 API 报错 */
  signature?: string
}

export type AssistantMessage = {
  type: 'assistant'
  content: Array<TextContent | ToolUseContent | ThinkingContent>
  /** ISO string，streamOneTurn 完成后注入，microcompact time-based 触发需要 */
  timestamp?: string
}

export type CompactBoundaryMessage = {
  type: 'compact_boundary'
  trigger: 'auto' | 'manual' | 'partial'
  preCompactTokenCount: number
}

export type Message = UserMessage | AssistantMessage | CompactBoundaryMessage

// query.ts yield 的事件流类型
export type StreamEvent =
  // --- 生命周期 ---
  | { type: 'stream_request_start' }          // 每轮 API 调用开始前（对标 Claude Code stream_request_start）
  | { type: 'done' }                           // 对话正常结束（无工具调用）
  | { type: 'max_turns_reached'; turnCount: number }  // 达到 maxTurns 上限
  | { type: 'error'; error: Error }            // 不可恢复错误
  // --- 流式文本 ---
  | { type: 'text_delta'; delta: string }
  // --- 扩展思考 ---
  | { type: 'thinking_delta'; delta: string }
  // --- 工具调用 ---
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: 'tool_denied'; tool_use_id: string; name: string }  // canUseTool 拒绝
  | { type: 'messages_snapshot'; messages: Message[] }          // 每轮结束时的完整消息快照（用于下一轮 API 调用）
  | { type: 'compact_start' }
  | { type: 'compact_done'; savedTokens: number; summaryLength: number; newMessages: Message[] }
  | { type: 'snip_done'; messagesRemoved: number; tokensFreed: number }
  | { type: 'microcompact_done'; toolsCleared: number; tokensSaved: number }
  | { type: 'output_truncated' }  // 输出 token 上限，多次续写仍未完成时通知 UI
