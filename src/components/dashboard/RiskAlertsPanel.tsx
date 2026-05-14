// src/components/dashboard/RiskAlertsPanel.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Alert } from '../../types/dashboard.js'

type Props = {
  alerts: Alert[]
}

export function RiskAlertsPanel({ alerts }: Props) {
  const dataAlerts = alerts.filter((a) => a.category === 'data')
  const riskAlerts = alerts.filter((a) => a.category === 'risk')
  const todoAlerts = alerts.filter((a) => a.category === 'todo')

  const getColor = (type: Alert['type']) => {
    switch (type) {
      case 'error':
        return 'red'
      case 'warning':
        return 'yellow'
      case 'info':
        return 'gray'
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>⚠️  风险提示</Text>

      {dataAlerts.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">【数据源状态】</Text>
          {dataAlerts.map((alert, i) => (
            <Text key={i} color={getColor(alert.type)}>
              {alert.message}
            </Text>
          ))}
        </Box>
      )}

      {riskAlerts.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">【风险警告】</Text>
          {riskAlerts.map((alert, i) => (
            <Text key={i} color={getColor(alert.type)}>
              {alert.message}
            </Text>
          ))}
        </Box>
      )}

      {todoAlerts.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">【待办事项】</Text>
          {todoAlerts.map((alert, i) => (
            <Text key={i} color={getColor(alert.type)}>
              {alert.message}
            </Text>
          ))}
        </Box>
      )}

      {alerts.length === 0 && <Text color="gray">暂无提示</Text>}
    </Box>
  )
}
