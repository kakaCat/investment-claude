// 消息列表 — 对标 Claude Code src/components/Messages.tsx
// 渲染 user / assistant / tool_use / tool_result 消息
// tools prop 用于调用每个工具自定义的 renderToolUse / renderToolResult

import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import type { Message } from '../types/message.js'
import type { Tool } from '../Tool.js'
import { findTool } from '../tools/index.js'
import { getAssistantText, getToolUses } from '../utils/messages.js'

type Props = {
  messages: Message[]
  streamingText?: string
  tools: Tool[]
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
                tool.renderToolResult(result)
              ) : (
                <Text wrap="wrap" color="gray">
                  {result.length > 500 ? result.slice(0, 500) + '…' : result}
                </Text>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}

export function Messages({ messages, streamingText, tools }: Props) {
  // Build a lookup map: tool_use_id → result content (from tool_result blocks)
  const toolResults = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const msg of messages) {
      if (msg.type === 'user') {
        for (const c of msg.content) {
          if (c.type === 'tool_result') {
            map.set(c.tool_use_id, c.content)
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
            const isError = isToolResultErrorContent(c.content)
            map.set(c.tool_use_id, isError ? 'error' : 'success')
          }
        }
      }
    }
    return map
  }, [messages])

  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => {
        if (msg.type === 'user') {
          // Only render text content; tool_result blocks are absorbed into ToolCallBlock above
          const textContent = msg.content.find((c) => c.type === 'text')
          if (!textContent || textContent.type !== 'text') return null
          return <UserBubble key={i} text={textContent.text} />
        }

        if (msg.type === 'assistant') {
          const text = getAssistantText(msg)
          const toolUses = getToolUses(msg)
          return (
            <Box key={i} flexDirection="column">
              {text && <AssistantBubble text={text} />}
              {toolUses.map((t, j) => (
                <ToolCallBlock
                  key={j}
                  name={t.name}
                  input={t.input}
                  tools={tools}
                  result={toolResults.get(t.id)}
                  status={toolUseResultStatus.get(t.id)}
                />
              ))}
            </Box>
          )
        }

        return null
      })}

      {streamingText && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="green" bold>
            Pi:{' '}
          </Text>
          <Text>{streamingText}</Text>
        </Box>
      )}
    </Box>
  )
}
