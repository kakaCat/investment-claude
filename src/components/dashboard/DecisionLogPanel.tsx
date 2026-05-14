// src/components/dashboard/DecisionLogPanel.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Decision } from '../../types/dashboard.js'

type Props = {
  data: Decision[]
}

const DECISION_EMOJI: Record<Decision['type'], string> = {
  buy: '🟢',
  sell: '🔴',
  hold: '👁️',
  avoid: '❌',
}

export function DecisionLogPanel({ data }: Props) {
  const pendingCount = data.filter((d) => d.verifyDate).length

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>📝 最近决策</Text>
      <Box flexDirection="column" marginTop={1}>
        {data.length === 0 ? (
          <Text color="gray">暂无决策记录</Text>
        ) : (
          data.map((decision, i) => (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text>
                {decision.date.slice(5)} {decision.time} {DECISION_EMOJI[decision.type]}{' '}
                {decision.name}({decision.code}) {decision.type === 'buy' ? '买入' : decision.type === 'sell' ? '卖出' : decision.type === 'hold' ? '观察' : '回避'}
              </Text>
              <Text color="gray">              {decision.reason}</Text>
            </Box>
          ))
        )}
      </Box>
      {pendingCount > 0 && (
        <Box marginTop={1}>
          <Text color="yellow">⚠️  {pendingCount}条决策待验证</Text>
        </Box>
      )}
    </Box>
  )
}
