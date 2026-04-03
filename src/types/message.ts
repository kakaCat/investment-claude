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

export type ToolResultContent = {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

export type UserMessage = {
  type: 'user'
  content: Array<TextContent | ToolResultContent>
}

export type AssistantMessage = {
  type: 'assistant'
  content: Array<TextContent | ToolUseContent>
}

export type Message = UserMessage | AssistantMessage

// query.ts yield 的事件流类型
export type StreamEvent =
  // --- 生命周期 ---
  | { type: 'stream_request_start' }          // 每轮 API 调用开始前（对标 Claude Code stream_request_start）
  | { type: 'done' }                           // 对话正常结束（无工具调用）
  | { type: 'max_turns_reached'; turnCount: number }  // 达到 maxTurns 上限
  | { type: 'error'; error: Error }            // 不可恢复错误
  // --- 流式文本 ---
  | { type: 'text_delta'; delta: string }
  // --- 工具调用 ---
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: 'tool_denied'; tool_use_id: string; name: string }  // canUseTool 拒绝
