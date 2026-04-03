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
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: 'done' }
  | { type: 'error'; error: Error }
