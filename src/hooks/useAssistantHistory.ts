// 消息历史管理 hook — 对标 Claude Code src/hooks/useAssistantHistory.ts
// 简化版：只管理内存中的消息列表，不涉及持久化

import { useState, useCallback, useMemo } from 'react'
import type { Message, AssistantMessage } from '../types/message.js'

export type UseAssistantHistoryResult = {
  messages: Message[]
  displayMessages: Message[]
  appendUserMessage: (text: string) => void
  startAssistantMessage: () => void
  appendStreamingDelta: (delta: string) => void
  appendToolUse: (id: string, name: string, input: unknown) => void
  finalizeAssistantMessage: () => void
  appendToolResult: (tool_use_id: string, content: string) => void
  clearMessages: () => void
  replaceMessages: (messages: Message[]) => void
}

export function useAssistantHistory(): UseAssistantHistoryResult {
  const [messages, setMessages] = useState<Message[]>([])
  // 临时存储正在流式接收的 assistant message 内容
  const [pendingAssistantContent, setPendingAssistantContent] = useState<
    AssistantMessage['content']
  >([])

  const displayMessages = useMemo<Message[]>(() => {
    if (pendingAssistantContent.length === 0) return messages
    return [...messages, { type: 'assistant', content: pendingAssistantContent }]
  }, [messages, pendingAssistantContent])

  const appendUserMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { type: 'user', content: [{ type: 'text', text }] },
    ])
  }, [])

  const startAssistantMessage = useCallback(() => {
    setPendingAssistantContent([])
  }, [])

  const appendStreamingDelta = useCallback((delta: string) => {
    setPendingAssistantContent((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.type === 'text') {
        return [...prev.slice(0, -1), { ...last, text: last.text + delta }]
      }
      return [...prev, { type: 'text', text: delta }]
    })
  }, [])

  const appendToolUse = useCallback((id: string, name: string, input: unknown) => {
    setPendingAssistantContent((prev) => [
      ...prev,
      { type: 'tool_use', id, name, input },
    ])
  }, [])

  const finalizeAssistantMessage = useCallback(() => {
    setPendingAssistantContent((content) => {
      if (content.length > 0) {
        setMessages((prev) => [
          ...prev,
          { type: 'assistant', content },
        ])
      }
      return []
    })
  }, [])

  const appendToolResult = useCallback(
    (tool_use_id: string, content: string) => {
      setMessages((prev) => [
        ...prev,
        {
          type: 'user',
          content: [{ type: 'tool_result', tool_use_id, content }],
        },
      ])
    },
    [],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setPendingAssistantContent([])
  }, [])

  const replaceMessages = useCallback((newMessages: Message[]) => {
    setMessages(newMessages)
    setPendingAssistantContent([])
  }, [])

  return {
    messages,
    displayMessages,
    appendUserMessage,
    startAssistantMessage,
    appendStreamingDelta,
    appendToolUse,
    finalizeAssistantMessage,
    appendToolResult,
    clearMessages,
    replaceMessages,
  }
}
