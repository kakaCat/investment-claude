// src/components/dashboard/PortfolioPanel.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { Table } from './Table.js'
import type { Portfolio } from '../../types/dashboard.js'

type Props = {
  data: Portfolio | null
}

export function PortfolioPanel({ data }: Props) {
  if (!data) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>💼 持仓</Text>
        <Text color="gray">加载中...</Text>
      </Box>
    )
  }

  const headers = ['代码', '名称', '数量', '成本', '现价', '市值', '盈亏']
  const rows = data.holdings.map((h) => [
    h.code,
    h.name,
    h.quantity.toString(),
    `¥${h.cost.toFixed(2)}`,
    `¥${h.currentPrice.toFixed(2)}`,
    `¥${h.marketValue.toFixed(0)}`,
    `${h.profitRate > 0 ? '+' : ''}${h.profitRate.toFixed(1)}%`,
  ])

  const columnWidths = [8, 10, 6, 10, 10, 10, 10]

  const colorize = (row: string[], rowIndex: number) => {
    const holding = data.holdings[rowIndex]
    const colors = new Array(row.length).fill(undefined)
    // 最后一列（盈亏）根据正负着色
    colors[6] = holding.profitRate > 0 ? 'green' : holding.profitRate < 0 ? 'red' : 'gray'
    return colors
  }

  const profitColor = data.totalProfit > 0 ? 'green' : data.totalProfit < 0 ? 'red' : 'gray'

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>
        💼 持仓 (总市值: ¥{data.totalValue.toFixed(0)} | 总盈亏:{' '}
        <Text color={profitColor}>
          {data.totalProfit > 0 ? '+' : ''}¥{data.totalProfit.toFixed(0)} {data.profitRate > 0 ? '+' : ''}
          {data.profitRate.toFixed(1)}%
        </Text>
        )
      </Text>
      <Box marginTop={1}>
        <Table headers={headers} rows={rows} columnWidths={columnWidths} colorize={colorize} />
      </Box>
    </Box>
  )
}
