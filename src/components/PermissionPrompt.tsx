// src/components/PermissionPrompt.tsx
// Terminal permission dialog — ref Claude Code src/components/permissions/PermissionDialog.tsx

import React, { useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { PermissionDecision, PermissionUserChoice } from '../permissions/types.js'
import { ruleValueToString } from '../permissions/ruleMatching.js'

export type PermissionPromptRequest = {
  toolName: string
  input: unknown
  decision: PermissionDecision & { behavior: 'ask' }
  resolve: (result: PermissionUserChoice) => void
}

type PermissionOption = {
  label: string
  description: string
  action: 'allow' | 'deny'
  persist: boolean
}

const OPTIONS: PermissionOption[] = [
  { label: '✅ 允许',     description: '允许本次操作',           action: 'allow', persist: false },
  { label: '✅ 始终允许', description: '将此操作加入允许规则',   action: 'allow', persist: true },
  { label: '❌ 拒绝',     description: '拒绝本次操作',           action: 'deny',  persist: false },
  { label: '❌ 始终拒绝', description: '将此操作加入拒绝规则',   action: 'deny',  persist: true },
]

type Props = {
  request: PermissionPromptRequest
  selectedIndex: number
  onSelectedIndexChange: (index: number) => void
}

export function PermissionPrompt({ request, selectedIndex, onSelectedIndexChange }: Props) {
  const rulePreview = React.useMemo(
    () => request.decision.suggestions?.[0]?.rules?.map(ruleValueToString).join(', '),
    [request.decision.suggestions]
  )

  // Handle keyboard input for navigation
  useInput((input, key) => {
    if (key.upArrow) {
      onSelectedIndexChange(Math.max(0, selectedIndex - 1))
    } else if (key.downArrow) {
      onSelectedIndexChange(Math.min(OPTIONS.length - 1, selectedIndex + 1))
    } else if (key.return) {
      const opt = OPTIONS[selectedIndex]!
      request.resolve({
        action: opt.action,
        persist: opt.persist,
        destination: opt.persist ? 'projectSettings' : undefined,
      })
    } else if (key.escape) {
      request.resolve({ action: 'deny', persist: false })
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      paddingX={1}
      paddingY={1}
      marginX={2}
      marginY={1}
    >
      {/* Header 区域 */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="yellow" bold>
          🔒 权限请求
        </Text>
        <Text color="gray" dimColor>
          {request.toolName}
        </Text>
      </Box>

      {/* 消息内容 */}
      <Box marginBottom={1} paddingLeft={2}>
        <Text>{request.decision.message}</Text>
      </Box>

      {/* 选项列表 */}
      <Box flexDirection="column" marginY={1}>
        {OPTIONS.map((opt, i) => {
          const isSelected = i === selectedIndex

          return (
            <Box key={i} marginY={0}>
              {isSelected ? (
                <Text inverse color="cyan" bold>
                  ▸ {opt.label.padEnd(15)} — {opt.description}
                </Text>
              ) : (
                <Text color="gray">
                  {'  '}{opt.label.padEnd(15)} — {opt.description}
                </Text>
              )}
            </Box>
          )
        })}
      </Box>

      {/* 规则预览 */}
      {rulePreview && (
        <Box paddingX={1} marginY={1}>
          <Text color="gray" dimColor>
            规则预览: {rulePreview}
          </Text>
        </Box>
      )}

      {/* 帮助文本 */}
      <Box justifyContent="center" marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ 选择  Enter 确认  Esc 取消
        </Text>
      </Box>
    </Box>
  )
}

export { OPTIONS as PERMISSION_OPTIONS }
