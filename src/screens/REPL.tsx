// 主屏幕 — 简化版，对标 Claude Code src/screens/REPL.tsx
// 目标 ≤300 行。职责：驱动 query 循环，处理 StreamEvent，协调 UI

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { query, type CanUseTool } from '../query.js'
import { getSystemPrompt } from '../constants/prompts.js'
import { useMergedTools } from '../hooks/useMergedTools.js'
import { getAllTools } from '../tools/index.js'
import { getPluginTools } from '../plugins/index.js'
import { useAssistantHistory } from '../hooks/useAssistantHistory.js'
import { Messages } from '../components/Messages.js'
import { PromptInput } from '../components/PromptInput.js'
import { Spinner } from '../components/Spinner.js'
import type { SSHSession } from '../ssh/index.js'
import type { SwarmConfig } from '../swarm/index.js'
import type { ToolUseContext } from '../Tool.js'

type Props = {
  // Stub props — 接口预留，当前不使用
  sshSession?: SSHSession
  swarmConfig?: SwarmConfig
}

type PermissionRequest = {
  toolName: string
  input: unknown
  resolve: (decision: 'allow' | 'deny') => void
}

type AskUserRequest = {
  question: string
  options: ReadonlyArray<{ label: string; description?: string }>
  resolve: (answer: string) => void
}

export function REPL(_props: Props) {
  const tools = useMergedTools()
  const allTools = useMemo(() => getAllTools(getPluginTools()), [])
  const history = useAssistantHistory()
  const [isLoading, setIsLoading] = useState(false)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [askUserRequest, setAskUserRequest] = useState<AskUserRequest | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // AbortController — 用于 Ctrl+C 中止当前 query（对标 Claude Code interrupt()）
  const abortControllerRef = useRef<AbortController | null>(null)

  // ── canUseTool 回调（传给 query()，在工具执行前弹出确认 UI）─────────────────
  // 对标 Claude Code canUseTool / wrappedCanUseTool
  const canUseTool = useCallback<CanUseTool>(
    (name, input) =>
      new Promise((resolve) => {
        setPermissionRequest({ toolName: name, input, resolve })
      }),
    [],
  )

  const askUser = useCallback<NonNullable<ToolUseContext['askUser']>>(
    (question, options) =>
      new Promise((resolve) => {
        setSelectedIndex(0)
        setAskUserRequest({ question, options, resolve })
      }),
    [],
  )

  // ── 处理用户提交 ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (input: string) => {
      // ── slash commands ──────────────────────────────────────────────────
      if (input === '/clear') {
        history.clearMessages()
        return
      }
      if (input === '/help') {
        history.appendUserMessage('/help')
        history.startAssistantMessage()
        history.appendStreamingDelta(
          'Available commands:\n  /help  — show this message\n  /clear — clear the conversation',
        )
        history.finalizeAssistantMessage()
        return
      }

      history.appendUserMessage(input)
      setIsLoading(true)
      history.startAssistantMessage()

      // 创建新的 AbortController（对标 Claude Code createAbortController）
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        // 注意：React state 异步，手动构造当前完整 messages
        const currentMessages = [
          ...history.messages,
          { type: 'user' as const, content: [{ type: 'text' as const, text: input }] },
        ]

        const gen = query({
          messages: currentMessages,
          tools,
          allTools,
          systemPrompt: getSystemPrompt(),
          canUseTool,
          askUser,
          abortSignal: abortController.signal,
        })

        for await (const event of gen) {
          switch (event.type) {
            // ── 生命周期 ────────────────────────────────────────────────
            case 'stream_request_start':
              // API 调用开始，UI 已在 isLoading 状态，无需额外操作
              break

            case 'done':
              history.finalizeAssistantMessage()
              break

            case 'max_turns_reached':
              history.finalizeAssistantMessage()
              history.appendUserMessage(`[System: reached ${event.turnCount} turn limit]`)
              break

            case 'error':
              history.finalizeAssistantMessage()
              console.error('Query error:', event.error)
              break

            // ── 流式文本 ────────────────────────────────────────────────
            case 'text_delta':
              history.appendStreamingDelta(event.delta)
              break

            // ── 工具调用 ────────────────────────────────────────────────
            // tool_use 在 canUseTool 返回 allow 之后才 yield，此处只做 UI 展示
            case 'tool_use':
              // 工具正在执行（权限已通过），此处关闭 permission UI
              setPermissionRequest(null)
              break

            case 'tool_result':
              history.appendToolResult(event.tool_use_id, event.content)
              break

            case 'tool_denied':
              // 用户拒绝，关闭 permission UI
              setPermissionRequest(null)
              break
          }
        }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [tools, history, canUseTool, askUser],
  )

  // ── 键盘输入处理 ──────────────────────────────────────────────────────────
  useInput(
    (input, key) => {
      if (askUserRequest) {
        if (key.upArrow) {
          setSelectedIndex((i) => Math.max(0, i - 1))
        } else if (key.downArrow) {
          setSelectedIndex((i) => Math.min(askUserRequest.options.length - 1, i + 1))
        } else if (key.return) {
          const answer = askUserRequest.options[selectedIndex]?.label ?? ''
          setAskUserRequest(null)
          askUserRequest.resolve(answer)
        }
        return
      }

      // 权限确认
      if (permissionRequest) {
        if (input === 'y' || key.return) {
          permissionRequest.resolve('allow')
        } else if (input === 'n' || key.escape) {
          permissionRequest.resolve('deny')
        }
        return
      }

      // Ctrl+C 中止当前 query（对标 Claude Code interrupt()）
      if (key.ctrl && input === 'c' && isLoading) {
        abortControllerRef.current?.abort()
      }
    },
    { isActive: true },
  )

  return (
    <Box flexDirection="column" padding={1}>
      {/* 消息历史 */}
      <Messages messages={history.messages} streamingText={history.streamingText} tools={tools} />

      {/* 工具权限确认 */}
      {permissionRequest && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow" bold>
            Allow tool use?
          </Text>
          <Text>
            Tool: <Text color="cyan">{permissionRequest.toolName}</Text>
          </Text>
          <Text>
            Input: <Text color="gray">{JSON.stringify(permissionRequest.input)}</Text>
          </Text>
          <Text>
            <Text color="green">y</Text> to allow, <Text color="red">n</Text> to deny
          </Text>
        </Box>
      )}

      {askUserRequest && (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1}>
          <Text color="magenta" bold>
            {askUserRequest.question}
          </Text>
          <Text> </Text>
          {askUserRequest.options.map((opt, i) => (
            <Box key={i}>
              <Text color={i === selectedIndex ? 'magenta' : 'gray'} bold={i === selectedIndex}>
                {i === selectedIndex ? '▶ ' : '  '}
                {opt.label}
              </Text>
              {opt.description && <Text color="gray"> — {opt.description}</Text>}
            </Box>
          ))}
          <Text> </Text>
          <Text color="gray" dimColor>
            ↑↓ navigate  Enter to select
          </Text>
        </Box>
      )}

      {/* 加载中 */}
      {isLoading && !permissionRequest && !askUserRequest && <Spinner />}

      {/* 输入框 */}
      {!isLoading && !askUserRequest && <PromptInput onSubmit={handleSubmit} isLoading={isLoading} />}
    </Box>
  )
}
