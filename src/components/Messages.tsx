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

function ToolUseBubble({
  name,
  input,
  tools,
  status,
}: {
  name: string
  input: unknown
  tools: Tool[]
  status?: 'success' | 'error'
}) {
  const dotColor = status === 'success' ? 'green' : status === 'error' ? 'red' : 'gray'
  const tool = findTool(name, tools)
  return (
    <Box marginBottom={0} paddingLeft={2} flexDirection="row" gap={1}>
      <Text color={dotColor}>●</Text>
      <Text bold>{name}</Text>
      {tool ? (
        tool.renderToolUse(input)
      ) : (
        <Text color="gray">{JSON.stringify(input)}</Text>
      )}
    </Box>
  )
}

function ToolResultBubble({
  toolUseId,
  content,
  tools,
  toolUseNames,
}: {
  toolUseId: string
  content: string
  tools: Tool[]
  toolUseNames: Map<string, string>
}) {
  const toolName = toolUseNames.get(toolUseId)
  const tool = toolName ? findTool(toolName, tools) : undefined
  return (
    <Box
      marginBottom={1}
      paddingLeft={2}
      borderStyle="round"
      borderColor="gray"
      width="100%"
    >
      <Box width="100%">
        {tool ? (
          tool.renderToolResult(content)
        ) : (
          <Text wrap="wrap" color="gray">
            {content.length > 500 ? content.slice(0, 500) + '…' : content}
          </Text>
        )}
      </Box>
    </Box>
  )
}

export function Messages({ messages, streamingText, tools }: Props) {
  // Build a lookup map: tool_use_id → tool name
  // Needed so ToolResultBubble can find the right tool to render results
  const toolUseNames = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const msg of messages) {
      if (msg.type === 'assistant') {
        for (const c of msg.content) {
          if (c.type === 'tool_use') {
            map.set(c.id, c.name)
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
            const isError =
              c.content.startsWith('Error') || c.content.startsWith('ERROR:')
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
          const textContent = msg.content.find((c) => c.type === 'text')
          const toolResults = msg.content.filter((c) => c.type === 'tool_result')

          return (
            <Box key={i} flexDirection="column">
              {textContent && textContent.type === 'text' && (
                <UserBubble text={textContent.text} />
              )}
              {toolResults.map((r, j) =>
                r.type === 'tool_result' ? (
                  <ToolResultBubble
                    key={j}
                    toolUseId={r.tool_use_id}
                    content={r.content}
                    tools={tools}
                    toolUseNames={toolUseNames}
                  />
                ) : null,
              )}
            </Box>
          )
        }

        if (msg.type === 'assistant') {
          const text = getAssistantText(msg)
          const toolUses = getToolUses(msg)
          return (
            <Box key={i} flexDirection="column">
              {text && <AssistantBubble text={text} />}
              {toolUses.map((t, j) => (
                <ToolUseBubble
                  key={j}
                  name={t.name}
                  input={t.input}
                  tools={tools}
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
