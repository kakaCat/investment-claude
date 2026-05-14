// src/components/PermissionPrompt.tsx
// Terminal permission dialog — ref Claude Code src/components/permissions/PermissionDialog.tsx

import React from 'react'
import { Box, Text } from 'ink'
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
}

export function PermissionPrompt({ request, selectedIndex }: Props) {
  const rulePreview = request.decision.suggestions?.[0]?.rules
    ?.map(ruleValueToString)
    .join(', ')

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>
        🔒 {request.toolName} 需要权限
      </Text>
      <Text> </Text>
      <Text>{request.decision.message}</Text>
      <Text> </Text>
      {OPTIONS.map((opt, i) => (
        <Box key={i}>
          <Text color={i === selectedIndex ? 'cyan' : 'gray'} bold={i === selectedIndex}>
            {i === selectedIndex ? '▸ ' : '  '}
            {opt.label}
          </Text>
          <Text color="gray"> — {opt.description}</Text>
        </Box>
      ))}
      {rulePreview && (
        <>
          <Text> </Text>
          <Text color="gray">规则预览: {rulePreview}</Text>
        </>
      )}
      <Text> </Text>
      <Text color="gray" dimColor>
        ↑↓ 选择  Enter 确认
      </Text>
    </Box>
  )
}

export { OPTIONS as PERMISSION_OPTIONS }
