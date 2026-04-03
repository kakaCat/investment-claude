// 消息列表 — 对标 Claude Code src/components/Messages.tsx
// 渲染 user / assistant / tool_use / tool_result 消息

import React from 'react'
import { Box, Text } from 'ink'
import type { Message } from '../types/message.js'
import { getAssistantText, getToolUses } from '../utils/messages.js'

type Props = {
  messages: Message[]
  streamingText?: string  // 正在流式接收的文字
}

function UserBubble({ text }: { text: string }) {
  return (
    <Box marginBottom={1}>
      <Text color="blue" bold>You: </Text>
      <Text>{text}</Text>
    </Box>
  )
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text color="green" bold>Pi: </Text>
      <Text>{text}</Text>
    </Box>
  )
}

function ToolUseBubble({ name, input }: { name: string; input: unknown }) {
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color="yellow">⚙ {name}(</Text>
      <Text color="gray">{JSON.stringify(input)}</Text>
      <Text color="yellow">)</Text>
    </Box>
  )
}

function ToolResultBubble({ content }: { content: string }) {
  return (
    <Box marginBottom={1} paddingLeft={2} borderStyle="single" borderColor="gray">
      <Text color="gray">{content.slice(0, 500)}{content.length > 500 ? '…' : ''}</Text>
    </Box>
  )
}

export function Messages({ messages, streamingText }: Props) {
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
                  <ToolResultBubble key={j} content={r.content} />
                ) : null
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
                <ToolUseBubble key={j} name={t.name} input={t.input} />
              ))}
            </Box>
          )
        }

        return null
      })}

      {/* 流式接收中的文字 */}
      {streamingText && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="green" bold>Pi: </Text>
          <Text>{streamingText}</Text>
        </Box>
      )}
    </Box>
  )
}
