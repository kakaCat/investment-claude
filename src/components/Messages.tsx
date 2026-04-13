// 消息列表 — 对标 Claude Code src/components/Messages.tsx
// 渲染 user / assistant / tool_use / tool_result 消息
// tools prop 用于调用每个工具自定义的 renderToolUse / renderToolResult

import React, { memo, useMemo } from 'react'
import { Box, Text } from 'ink'
import type { Message, TextContent, ThinkingContent } from '../types/message.js'
import type { Tool } from '../Tool.js'
import { findTool } from '../tools/index.js'
import { getAssistantText, getToolUses } from '../utils/messages.js'

type Props = {
  messages: Message[]
  tools: Tool[]
  maxHeight?: number
  scrollOffset?: number
}

export function isToolResultErrorContent(content: string): boolean {
  return (
    content.startsWith('Error') ||
    content.startsWith('ERROR:') ||
    /^Exit code \d+/.test(content)
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <Box marginBottom={1}>
      <Text color="blue" bold>
        You:{' '}
      </Text>
      <Text>{text}</Text>
    </Box>
  )
}

function ThinkingBlock({ text }: { text: string }) {
  const preview = text.length > 300 ? text.slice(0, 300) + '…' : text
  return (
    <Box marginBottom={1} flexDirection="column" paddingLeft={2}>
      <Text color="gray" dimColor>◆ Thinking</Text>
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor wrap="wrap">{preview}</Text>
      </Box>
    </Box>
  )
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text color="green" bold>
        Pi:{' '}
      </Text>
      <Text>{text}</Text>
    </Box>
  )
}

/**
 * Unified tool call block — matches Claude Code style.
 * Tool name + dot indicator sit above a round-border box.
 * Inside the box: IN section (tool input), optional separator + OUT section (result).
 */
function ToolCallBlock({
  name,
  input,
  tools,
  result,
  status,
}: {
  name: string
  input: unknown
  tools: Tool[]
  result?: string
  status?: 'success' | 'error'
}) {
  const dotColor = status === 'success' ? 'green' : status === 'error' ? 'red' : 'gray'
  const tool = findTool(name, tools)
  const hasResult = result !== undefined

  return (
    <Box marginBottom={1} flexDirection="column">
      {/* Tool name row — outside the box */}
      <Box paddingLeft={2} flexDirection="row" gap={1}>
        <Text color={dotColor}>●</Text>
        <Text bold>{name}</Text>
      </Box>

      {/* Combined IN / OUT box */}
      <Box paddingLeft={2} borderStyle="round" borderColor="gray" width="100%" flexDirection="column">
        {/* IN section */}
        <Box>
          {tool ? (
            tool.renderToolUse(input)
          ) : (
            <Text color="gray">{JSON.stringify(input)}</Text>
          )}
        </Box>

        {/* OUT section — only when result is available */}
        {hasResult && (
          <>
            <Text color="gray">{'─'.repeat(40)}</Text>
            <Box>
              {tool ? (
                tool.renderToolResult(result!)
              ) : (
                <Text wrap="wrap" color="gray">
                  {(result?.length ?? 0) > 500 ? result!.slice(0, 500) + '…' : result}
                </Text>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}

// Estimate line count for a message (rough heuristic: 1 line per 80 chars + 2 overhead)
function estimateLines(msg: Message): number {
  if (msg.type === 'user') {
    const text = msg.content.find((c) => c.type === 'text')
    if (!text || text.type !== 'text') return 0
    return Math.ceil(text.text.length / 80) + 2
  }
  if (msg.type === 'assistant') {
    let lines = 0
    for (const c of msg.content) {
      if (c.type === 'text') lines += Math.ceil(c.text.length / 80) + 2
      else if (c.type === 'tool_use') lines += 5
      else if (c.type === 'thinking') lines += 4
    }
    return lines
  }
  return 0
}

function MessagesInner({ messages, tools, maxHeight, scrollOffset = 0 }: Props) {
  // Build a lookup map: tool_use_id → result content (from tool_result blocks)
  const toolResults = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const msg of messages) {
      if (msg.type === 'user') {
        for (const c of msg.content) {
          if (c.type === 'tool_result') {
            map.set(c.tool_use_id, typeof c.content === 'string' ? c.content : '')
          }
        }
      }
    }
    return map
  }, [messages])

  // Build a lookup map: tool_use_id → 'success' | 'error'
  const toolUseResultStatus = useMemo<Map<string, 'success' | 'error'>>(() => {
    const map = new Map<string, 'success' | 'error'>()
    for (const msg of messages) {
      if (msg.type === 'user') {
        for (const c of msg.content) {
          if (c.type === 'tool_result') {
            const isError = isToolResultErrorContent(typeof c.content === 'string' ? c.content : '')
            map.set(c.tool_use_id, isError ? 'error' : 'success')
          }
        }
      }
    }
    return map
  }, [messages])

  // Trim messages to fit within maxHeight, with scrollOffset support.
  // scrollOffset > 0 means the user has scrolled up: shift the window back by that many lines.
  const visibleMessages = useMemo(() => {
    if (!maxHeight || maxHeight <= 0) return messages
    // Build a window from the bottom, then shift it up by scrollOffset lines.
    let total = 0
    let start = messages.length
    let end = messages.length
    // First pass: find the bottom window (no scroll)
    for (let i = messages.length - 1; i >= 0; i--) {
      const est = estimateLines(messages[i])
      if (est === 0) continue
      // Always include at least the last message, even if it exceeds maxHeight
      if (total + est > maxHeight && total > 0) break
      total += est
      start = i
    }
    // Second pass: if scrolled up, shift the window back
    if (scrollOffset > 0) {
      let skipped = 0
      for (let i = start - 1; i >= 0 && skipped < scrollOffset; i--) {
        const est = estimateLines(messages[i])
        if (est === 0) continue
        skipped += est
        start = i
        // drop one message from the bottom to keep window size
        for (let j = end - 1; j > start; j--) {
          const e = estimateLines(messages[j])
          if (e === 0) continue
          end = j
          break
        }
      }
    }
    return messages.slice(start, end)
  }, [messages, maxHeight, scrollOffset])

  return (
    <Box flexDirection="column">
      {visibleMessages.map((msg, i) => {
        // 生成稳定的 key：使用消息类型 + 索引
        // 避免使用纯索引，因为消息列表可能会变化
        const msgKey = `${msg.type}-${i}`

        if (msg.type === 'user') {
          // Only render text content; tool_result blocks are absorbed into ToolCallBlock above
          const textContent = msg.content.find((c) => c.type === 'text')
          if (!textContent || textContent.type !== 'text') return null
          return <UserBubble key={msgKey} text={textContent.text} />
        }

        if (msg.type === 'assistant') {
          const toolUses = getToolUses(msg)
          const thinkingBlocks = msg.content.filter((c): c is ThinkingContent => c.type === 'thinking')
          // Text that appears AFTER the last tool_use is the final reply — show it.
          // Text that appears BEFORE any tool_use is pre-tool narration — hide it.
          const lastToolUseIdx = msg.content.reduce(
            (last, c, idx) => (c.type === 'tool_use' ? idx : last),
            -1,
          )
          const trailingText = msg.content
            .slice(lastToolUseIdx + 1)
            .filter((c): c is TextContent => c.type === 'text')
            .map((c) => c.text)
            .join('')
          return (
            <Box key={msgKey} flexDirection="column">
              {thinkingBlocks.map((t, j) => (
                <ThinkingBlock key={`thinking-${j}`} text={t.thinking} />
              ))}
              {toolUses.map((t, j) => (
                <ToolCallBlock
                  key={`tool-${t.id}`}
                  name={t.name}
                  input={t.input}
                  tools={tools}
                  result={toolResults.get(t.id)}
                  status={toolUseResultStatus.get(t.id)}
                />
              ))}
              {trailingText && <AssistantBubble text={trailingText} />}
            </Box>
          )
        }

        return null
      })}
    </Box>
  )
}

export const Messages = memo(MessagesInner)
