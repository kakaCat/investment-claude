// src/components/dashboard/MarketPanel.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Index, Stock } from '../../types/dashboard.js'

type Props = {
  indices: Index[]
  watchlist: Stock[]
  lastUpdate?: Date
}

export function MarketPanel({ indices, watchlist, lastUpdate }: Props) {
  const formatTime = (date?: Date) => {
    if (!date) return '--:--:--'
    return date.toLocaleTimeString('zh-CN', { hour12: false })
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>📈 市场 (更新: {formatTime(lastUpdate)})</Text>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyan">【指数】</Text>
        {indices.length === 0 ? (
          <Text color="gray">加载中...</Text>
        ) : (
          indices.map((index, i) => {
            const color = index.changeRate > 0 ? 'green' : index.changeRate < 0 ? 'red' : 'gray'
            const arrow = index.changeRate > 0 ? '↑' : index.changeRate < 0 ? '↓' : '→'
            return (
              <Text key={i}>
                {index.name.padEnd(10)} {index.value.toFixed(2).padStart(10)}{' '}
                <Text color={color}>
                  {index.changeRate > 0 ? '+' : ''}
                  {index.changeRate.toFixed(2)}% {arrow}
                </Text>
              </Text>
            )
          })
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyan">【自选股】</Text>
        {watchlist.length === 0 ? (
          <Text color="gray">暂无自选股</Text>
        ) : (
          watchlist.slice(0, 5).map((stock, i) => {
            const color = stock.changeRate > 0 ? 'green' : stock.changeRate < 0 ? 'red' : 'gray'
            const arrow = stock.changeRate > 0 ? '↑' : stock.changeRate < 0 ? '↓' : '→'
            return (
              <Text key={i}>
                {stock.code} {stock.name.padEnd(10)} ¥{stock.price.toFixed(2).padStart(8)}{' '}
                <Text color={color}>
                  {stock.changeRate > 0 ? '+' : ''}
                  {stock.changeRate.toFixed(2)}% {arrow}
                </Text>
              </Text>
            )
          })
        )}
      </Box>
    </Box>
  )
}
