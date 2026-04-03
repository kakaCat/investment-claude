// 主屏幕 — 简化版，对标 Claude Code src/screens/REPL.tsx
// 目标 ≤300 行。职责：驱动 query 循环，处理 StreamEvent，协调 UI

import React, { useCallback, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { query } from '../query.js'
import { getSystemPrompt } from '../constants/prompts.js'
import { useMergedTools } from '../hooks/useMergedTools.js'
import { useAssistantHistory } from '../hooks/useAssistantHistory.js'
import { Messages } from '../components/Messages.js'
import { PromptInput } from '../components/PromptInput.js'
import { Spinner } from '../components/Spinner.js'
import type { SSHSession } from '../ssh/index.js'
import type { SwarmConfig } from '../swarm/index.js'

type Props = {
  // Stub props — 接口预留，当前不使用
  sshSession?: SSHSession
  swarmConfig?: SwarmConfig
}

type PermissionRequest = {
  toolName: string
  input: unknown
  resolve: (approved: boolean) => void
}

export function REPL(_props: Props) {
  const tools = useMergedTools()
  const history = useAssistantHistory()
  const [isLoading, setIsLoading] = useState(false)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)

  // 处理用户提交
  const handleSubmit = useCallback(
    async (input: string) => {
      // 处理 slash commands
      if (input === '/clear') {
        history.clearMessages()
        return
      }
      if (input === '/help') {
        // 直接追加一条系统提示消息
        history.appendUserMessage('/help')
        // 简单输出帮助信息（后续可扩展为真正的 slash command 系统）
        return
      }

      history.appendUserMessage(input)
      setIsLoading(true)
      history.startAssistantMessage()

      try {
        // 获取当前全部消息（包含刚追加的 user message）
        // 注意：React state 更新是异步的，需要手动构造完整 messages
        const currentMessages = [
          ...history.messages,
          { type: 'user' as const, content: [{ type: 'text' as const, text: input }] },
        ]

        const gen = query({
          messages: currentMessages,
          tools,
          systemPrompt: getSystemPrompt(),
        })

        for await (const event of gen) {
          switch (event.type) {
            case 'text_delta':
              history.appendStreamingDelta(event.delta)
              break

            case 'tool_use': {
              // 请求用户权限确认
              const approved = await new Promise<boolean>((resolve) => {
                setPermissionRequest({ toolName: event.name, input: event.input, resolve })
              })
              setPermissionRequest(null)
              if (!approved) {
                // 用户拒绝：中止当前 turn
                break
              }
              break
            }

            case 'tool_result':
              history.appendToolResult(event.tool_use_id, event.content)
              break

            case 'done':
              history.finalizeAssistantMessage()
              break

            case 'error':
              history.finalizeAssistantMessage()
              console.error('Query error:', event.error)
              break
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    [tools, history],
  )

  // 权限确认界面的键盘输入
  useInput(
    (input, key) => {
      if (!permissionRequest) return
      if (input === 'y' || key.return) {
        permissionRequest.resolve(true)
      } else if (input === 'n' || key.escape) {
        permissionRequest.resolve(false)
      }
    },
    { isActive: !!permissionRequest },
  )

  return (
    <Box flexDirection="column" padding={1}>
      {/* 消息历史 */}
      <Messages messages={history.messages} streamingText={history.streamingText} />

      {/* 工具权限确认 */}
      {permissionRequest && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow" bold>Allow tool use?</Text>
          <Text>Tool: <Text color="cyan">{permissionRequest.toolName}</Text></Text>
          <Text>Input: <Text color="gray">{JSON.stringify(permissionRequest.input)}</Text></Text>
          <Text><Text color="green">y</Text> to allow, <Text color="red">n</Text> to deny</Text>
        </Box>
      )}

      {/* 加载中 */}
      {isLoading && !permissionRequest && <Spinner />}

      {/* 输入框 */}
      {!isLoading && <PromptInput onSubmit={handleSubmit} isLoading={isLoading} />}
    </Box>
  )
}
