// 消息列表 — 对标 Claude Code 实际 TUI 样式
// 每个工具调用单独一行：● ToolName  description + 结果
// Thinking：显示简短摘要，非全部展开
// Pi 回复：最新一条始终展开

import React, { memo, useMemo } from 'react'
import { Box, Text } from 'ink'
import type { Message, TextContent, ThinkingContent } from '../types/message.js'
import type { Tool } from '../Tool.js'
import { findTool } from '../tools/index.js'
import { getToolUses } from '../utils/messages.js'
import { SmartContent, MixedContent } from './HtmlView.js'

export type CollapseState = {
  expandedToolGroups: Set<number>
  expandedAssistants: Set<number>
  expandedThinkings: Set<number>
}

export const EMPTY_COLLAPSE: CollapseState = {
  expandedToolGroups: new Set(),
  expandedAssistants: new Set(),
  expandedThinkings: new Set(),
}

type Props = {
  messages: Message[]
  tools: Tool[]
  maxHeight?: number
  scrollOffset?: number
  collapse: CollapseState
  onToggleToolGroup?: (index: number) => void
  onToggleAssistant?: (index: number) => void
  onToggleThinking?: (index: number) => void
}

// ── helpers ──────────────────────────────────────────────────────

export function isToolResultErrorContent(content: string): boolean {
  return (
    content.startsWith('Error') ||
    content.startsWith('ERROR:') ||
    /^Exit code \d+/.test(content)
  )
}

const PREVIEW_LINES = 3

function previewLines(text: string): string {
  const lines = text.split('\n')
  if (lines.length <= PREVIEW_LINES) return text
  return lines.slice(0, PREVIEW_LINES).join('\n') + '…'
}

// ── UserBubble ───────────────────────────────────────────────────
// 对标 Claude Code: "❯ " 蓝色提示符 + 用户输入

const UserBubble = React.memo(({ text }: { text: string }) => {
  return (
    <Box marginBottom={1}>
      <Text color="blue" bold>❯ </Text>
      <Text bold>{text}</Text>
    </Box>
  )
})

// ── ThinkingLine ─────────────────────────────────────────────────
// 对标 Claude Code: thinking 显示简短摘要
// 折叠时: "◆ Thinking …摘要…"
// 展开时: 显示全文

const ThinkingLine = React.memo(({
  blocks,
  isExpanded,
}: {
  blocks: ThinkingContent[]
  isExpanded: boolean
}) => {
  if (blocks.length === 0) return null

  const allText = blocks.map(b => b.thinking).join('\n')
  const preview = allText.length > 120
    ? allText.slice(0, 120).replace(/\n/g, ' ') + '…'
    : allText.replace(/\n/g, ' ')

  if (isExpanded) {
    return (
      <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
        <Text color="gray">◆ Thinking</Text>
        <Box borderStyle="round" borderColor="gray" paddingX={1}>
          <Text color="gray" wrap="wrap">{allText}</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box marginBottom={0} paddingLeft={2}>
      <Text color="gray">◆ </Text>
      <Text color="gray" italic>{preview}</Text>
    </Box>
  )
})

// ── ToolCallLine ─────────────────────────────────────────────────
// 对标 Claude Code 实际样式:
//   ● Read  REPL.tsx (lines 7221-7228)
//   ● Bash  Find scrollOffset references in REPL
//     IN   grep -n "scrollOffset" ...
//     OUT  120: ...
// 每个工具调用单独一行，不分组

type ToolCallInfo = {
  id: string
  name: string
  input: unknown
  result?: string
  status?: 'success' | 'error' | 'pending'
  toolOutput?: unknown
}

const ToolCallLine = React.memo(({
  call,
  tools,
}: {
  call: ToolCallInfo
  tools: Tool[]
}) => {
  const callTool = findTool(call.name, tools)
  const isError = call.status === 'error'
  const isDone = call.status === 'success' || call.status === 'error'
  const dotColor = isError ? 'red' : isDone ? 'green' : 'yellow'

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      marginLeft={2}
      paddingX={1}
      paddingY={1}
      borderStyle="single"
      borderLeft
      borderColor="cyan"
    >
      {/* 头部: ● ToolName  description */}
      <Box gap={1}>
        <Text color={dotColor}>●</Text>
        <Text color="cyan" bold>{call.name}</Text>
        {callTool && callTool.renderToolUse(call.input)}
      </Box>

      {/* 结果 — 直接显示在下方，对标 Claude Code */}
      {(call.result !== undefined || call.toolOutput !== undefined) && (
        <Box paddingLeft={2} paddingTop={1}>
          {callTool ? (
            call.toolOutput !== undefined && callTool.renderToolResultMessage ? (
              callTool.renderToolResultMessage(call.toolOutput, {
                style: undefined,
                tools,
                verbose: false,
                input: call.input,
              })
            ) : (
              callTool.renderToolResult(call.result ?? '')
            )
          ) : (
            <Text color="gray" dimColor wrap="wrap">
              {call.result && call.result.length > 300
                ? call.result.slice(0, 300) + '…'
                : call.result ?? ''}
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
})

// ── AssistantBubble ──────────────────────────────────────────────
// 对标 Claude Code: 直接显示文本，最新一条始终展开

const AssistantBubble = React.memo(({
  text,
  isExpanded,
  isLatest,
}: {
  text: string
  isExpanded: boolean
  isLatest: boolean
}) => {
  const lines = text.split('\n').length
  const isLong = lines > PREVIEW_LINES
  const showFull = isExpanded || isLatest

  return (
    <Box marginBottom={1} flexDirection="column">
      {isLong && !showFull && (
        <Box paddingLeft={2}>
          <Text color="gray" dimColor>▶ ({lines} lines collapsed — Ctrl+E)</Text>
        </Box>
      )}
      <Box>
        <Text color="cyan">Pi ▸ </Text>
        <Box flexDirection="column" flexGrow={1}>
          {showFull ? (
            <MixedContent text={text} />
          ) : (
            <Text color="gray">{previewLines(text)}</Text>
          )}
        </Box>
      </Box>
    </Box>
  )
})

// ── estimateLines ────────────────────────────────────────────────

function estimateLines(
  msg: Message,
  collapse: CollapseState,
  globalMsgIndex: number,
  thinkingGroupIdx: number,
  isLastAssistant: boolean,
): number {
  if (msg.type === 'user') {
    const text = msg.content.find((c) => c.type === 'text')
    if (!text || text.type !== 'text') return 0
    return Math.ceil(text.text.length / 80) + 2
  }
  if (msg.type === 'assistant') {
    let lines = 0
    const thinkingBlocks = msg.content.filter(c => c.type === 'thinking')
    const toolUseCount = msg.content.filter(c => c.type === 'tool_use').length

    // Thinking: 1 line collapsed, more expanded
    if (thinkingBlocks.length > 0) {
      lines += collapse.expandedThinkings.has(thinkingGroupIdx)
        ? 2 + thinkingBlocks.length * 4
        : 1
    }

    // Each tool call ≈ 2 lines (header + result)
    lines += toolUseCount * 2

    // Text
    for (const c of msg.content) {
      if (c.type === 'text') {
        const expanded = isLastAssistant || collapse.expandedAssistants.has(globalMsgIndex)
        if (expanded) {
          lines += Math.ceil(c.text.length / 80) + 1
        } else {
          lines += Math.ceil(previewLines(c.text).length / 80) + 1
        }
      }
    }
    return lines
  }
  return 0
}

// ── MsgMeta ──────────────────────────────────────────────────────

type MsgMeta = {
  globalMsgIndex: number
  thinkingGroupIdx: number
  isLastAssistant: boolean
  isLatestTurn: boolean
}

function buildMsgMeta(messages: Message[]): MsgMeta[] {
  let thinkingGroupCounter = 0

  let lastAssistantIdx = -1
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'assistant' && lastAssistantIdx < 0) lastAssistantIdx = i
    if (messages[i].type === 'user' && lastUserIdx < 0) lastUserIdx = i
    if (lastAssistantIdx >= 0 && lastUserIdx >= 0) break
  }

  return messages.map((msg, i) => {
    const meta: MsgMeta = {
      globalMsgIndex: i,
      thinkingGroupIdx: -1,
      isLastAssistant: i === lastAssistantIdx,
      isLatestTurn: i >= lastUserIdx,
    }

    if (msg.type === 'assistant' && msg.content.some(c => c.type === 'thinking')) {
      meta.thinkingGroupIdx = thinkingGroupCounter++
    }

    return meta
  })
}

// ── MessagesInner ────────────────────────────────────────────────

function MessagesInner({
  messages,
  tools,
  maxHeight,
  scrollOffset = 0,
  collapse,
}: Props) {
  const allMeta = useMemo(() => buildMsgMeta(messages), [messages])

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

  const toolUseResultsMap = useMemo<Map<string, unknown>>(() => {
    const map = new Map<string, unknown>()
    for (const msg of messages) {
      if (msg.type === 'user' && msg.toolUseResults) {
        for (const [id, output] of Object.entries(msg.toolUseResults)) {
          map.set(id, output)
        }
      }
    }
    return map
  }, [messages])

  const toolUseResultStatus = useMemo<Map<string, 'success' | 'error'>>(() => {
    const map = new Map<string, 'success' | 'error'>()
    for (const msg of messages) {
      if (msg.type === 'user') {
        for (const c of msg.content) {
          if (c.type === 'tool_result') {
            const isError = isToolResultErrorContent(
              typeof c.content === 'string' ? c.content : '',
            )
            map.set(c.tool_use_id, isError ? 'error' : 'success')
          }
        }
      }
    }
    return map
  }, [messages])

  // ── visible window ──────────────────────────────────────────────
  const { visible: visibleMessages, visibleMeta, hiddenAboveCount } = useMemo(() => {
    if (!maxHeight || maxHeight <= 0) {
      return { visible: messages, visibleMeta: allMeta, hiddenAboveCount: 0 }
    }

    let total = 0
    let start = messages.length

    for (let i = messages.length - 1; i >= 0; i--) {
      const m = allMeta[i]!
      const est = estimateLines(
        messages[i], collapse, m.globalMsgIndex,
        m.thinkingGroupIdx, m.isLastAssistant,
      )
      if (est === 0) continue
      if (total + est > maxHeight && total > 0) break
      total += est
      start = i
    }

    if (scrollOffset > 0) {
      let skipped = 0
      for (let i = start - 1; i >= 0 && skipped < scrollOffset; i--) {
        const m = allMeta[i]!
        const est = estimateLines(
          messages[i], collapse, m.globalMsgIndex,
          m.thinkingGroupIdx, m.isLastAssistant,
        )
        if (est === 0) continue
        skipped += est
        start = i
      }
    }

    return {
      visible: messages.slice(start),
      visibleMeta: allMeta.slice(start),
      hiddenAboveCount: start,
    }
  }, [messages, allMeta, maxHeight, scrollOffset, collapse])

  return (
    <Box flexDirection="column" key={`msgs-${messages.length}`} paddingBottom={1}>
      {hiddenAboveCount > 0 && (
        <Box justifyContent="center" marginBottom={1}>
          <Text color="blue" dimColor>↑ earlier messages</Text>
        </Box>
      )}

      {visibleMessages.map((msg, vi) => {
        const meta = visibleMeta[vi]!
        const msgKey = `${msg.type}-${meta.globalMsgIndex}`

        if (msg.type === 'user') {
          const textContent = msg.content.find((c) => c.type === 'text')
          if (!textContent || textContent.type !== 'text') return null
          return <UserBubble key={msgKey} text={textContent.text} />
        }

        if (msg.type === 'assistant') {
          const toolUses = getToolUses(msg)
          const thinkingBlocks = msg.content.filter(
            (c): c is ThinkingContent => c.type === 'thinking',
          )

          const lastToolUseIdx = msg.content.reduce(
            (last, c, idx) => (c.type === 'tool_use' ? idx : last), -1,
          )
          const trailingText = msg.content
            .slice(lastToolUseIdx + 1)
            .filter((c): c is TextContent => c.type === 'text')
            .map((c) => c.text)
            .join('')

          // Look for tool results in the next user message
          const nextUserMsg = visibleMessages
            .slice(vi + 1)
            .find((m) => m.type === 'user')
          const toolUseResults =
            nextUserMsg?.type === 'user' ? nextUserMsg.toolUseResults : undefined

          const toolCalls: ToolCallInfo[] = toolUses.map((t) => ({
            id: t.id,
            name: t.name,
            input: t.input,
            result: toolResults.get(t.id),
            status: toolUseResultStatus.get(t.id),
            toolOutput: toolUseResultsMap.get(t.id) ?? toolUseResults?.[t.id],
          }))

          return (
            <Box key={msgKey} flexDirection="column">
              {/* Thinking — 简短摘要，对标 Claude Code */}
              {thinkingBlocks.length > 0 && (
                <ThinkingLine
                  blocks={thinkingBlocks}
                  isExpanded={
                    meta.thinkingGroupIdx >= 0
                      ? collapse.expandedThinkings.has(meta.thinkingGroupIdx)
                      : false
                  }
                />
              )}

              {/* 每个工具调用单独一行 — 对标 Claude Code */}
              {toolCalls.map((tc) => (
                <ToolCallLine
                  key={tc.id}
                  call={tc}
                  tools={tools}
                />
              ))}

              {/* 文本回复 */}
              {trailingText && (
                <AssistantBubble
                  text={trailingText}
                  isExpanded={collapse.expandedAssistants.has(meta.globalMsgIndex)}
                  isLatest={meta.isLastAssistant}
                />
              )}
            </Box>
          )
        }

        return null
      })}
    </Box>
  )
}

export const Messages = memo(MessagesInner)
