// 消息工厂函数 — 对标 Claude Code src/utils/messages.ts

import type {
  UserMessage,
  AssistantMessage,
  TextContent,
  ToolResultContent,
  ToolUseContent,
} from '../types/message.js'

export function createUserMessage(text: string): UserMessage {
  return {
    type: 'user',
    content: [{ type: 'text', text }],
  }
}

export function createAssistantMessage(text: string): AssistantMessage {
  return {
    type: 'assistant',
    content: [{ type: 'text', text }],
  }
}

export function createToolResultMessage(
  tool_use_id: string,
  content: string,
): UserMessage {
  const toolResult: ToolResultContent = {
    type: 'tool_result',
    tool_use_id,
    content,
  }
  return {
    type: 'user',
    content: [toolResult],
  }
}

/** 从 AssistantMessage 中提取纯文本内容 */
export function getAssistantText(msg: AssistantMessage): string {
  return msg.content
    .filter((c): c is TextContent => c.type === 'text')
    .map((c) => c.text)
    .join('')
}

/** 从 AssistantMessage 中提取 tool_use 调用列表 */
export function getToolUses(msg: AssistantMessage): ToolUseContent[] {
  return msg.content.filter((c): c is ToolUseContent => c.type === 'tool_use')
}
