// 消息历史管理 hook — 对标 Claude Code src/hooks/useAssistantHistory.ts
// 简化版：只管理内存中的消息列表，不涉及持久化

import { useState, useCallback, useMemo, useRef } from 'react'
import type { Message, AssistantMessage } from '../types/message.js'

export type UseAssistantHistoryResult = {
  messages: Message[]
  displayMessages: Message[]
  isStreaming: boolean
  appendUserMessage: (text: string) => void
  appendAssistantMessage: (text: string) => void
  startAssistantMessage: () => void
  appendStreamingDelta: (delta: string) => void
  appendThinkingDelta: (delta: string) => void
  appendToolUse: (id: string, name: string, input: unknown) => void
  finalizeAssistantMessage: () => void
  appendToolResult: (tool_use_id: string, content: string) => void
  clearMessages: () => void
}

export function useAssistantHistory(): UseAssistantHistoryResult {
  const [messages, setMessages] = useState<Message[]>([])
  // 临时存储正在流式接收的 assistant message 内容
  const [pendingAssistantContent, setPendingAssistantContent] = useState<
    AssistantMessage['content']
  >([])
  // Ref mirror — lets finalizeAssistantMessage read current pending outside a state updater,
  // avoiding nested setState calls (which are side effects and may run twice in React strict mode)
  const pendingRef = useRef<AssistantMessage['content']>([])

  const displayMessages = useMemo<Message[]>(() => {
    if (pendingAssistantContent.length === 0) return messages
    // 只在 pendingAssistantContent 有内容时创建新数组
    // 避免每次流式更新都重新创建整个列表
    return [...messages, { type: 'assistant', content: pendingAssistantContent }]
  }, [messages, pendingAssistantContent])

  const appendUserMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { type: 'user', content: [{ type: 'text', text }] },
    ])
  }, [])

  const startAssistantMessage = useCallback(() => {
    pendingRef.current = []
    setPendingAssistantContent([])
  }, [])

  const appendStreamingDelta = useCallback((delta: string) => {
    setPendingAssistantContent((prev) => {
      const last = prev[prev.length - 1]
      const next = last && last.type === 'text'
        ? [...prev.slice(0, -1), { ...last, text: last.text + delta }]
        : [...prev, { type: 'text' as const, text: delta }]
      pendingRef.current = next
      return next
    })
  }, [])

  const appendThinkingDelta = useCallback((delta: string) => {
    setPendingAssistantContent((prev) => {
      const last = prev[prev.length - 1]
      const next = last && last.type === 'thinking'
        ? [...prev.slice(0, -1), { ...last, thinking: last.thinking + delta }]
        : [...prev, { type: 'thinking' as const, thinking: delta }]
      pendingRef.current = next
      return next
    })
  }, [])

  const appendToolUse = useCallback((id: string, name: string, input: unknown) => {
    setPendingAssistantContent((prev) => {
      const next = [...prev, { type: 'tool_use' as const, id, name, input }]
      pendingRef.current = next
      return next
    })
  }, [])

  const finalizeAssistantMessage = useCallback(() => {
    const content = pendingRef.current
    pendingRef.current = []
    setPendingAssistantContent([])
    if (content.length > 0) {
      setMessages((prev) => [...prev, { type: 'assistant', content }])
    }
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

  const appendAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { type: 'assistant', content: [{ type: 'text' as const, text }] },
    ])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setPendingAssistantContent([])
  }, [])

  return {
    messages,
    displayMessages,
    isStreaming: pendingAssistantContent.length > 0,
    appendUserMessage,
    appendAssistantMessage,
    startAssistantMessage,
    appendStreamingDelta,
    appendThinkingDelta,
    appendToolUse,
    finalizeAssistantMessage,
    appendToolResult,
    clearMessages,
  }
}
