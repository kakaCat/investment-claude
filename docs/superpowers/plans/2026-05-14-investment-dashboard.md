# 投资仪表盘实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个富文本终端UI仪表盘，整合持仓、决策日志、市场数据和风险提示

**Architecture:** 使用Ink构建四宫格布局，左上显示持仓，右上显示决策日志，左下显示市场数据，右下显示风险提示。按 `:` 键唤醒命令输入框，支持股票分析、筛选、交易记录等命令。市场数据定时刷新（可配置间隔）。

**Tech Stack:** Ink (React for CLI), TypeScript, akshare (数据源)

---

## 文件结构

### 新建文件
- `src/screens/Dashboard.tsx` - 主仪表盘组件
- `src/components/dashboard/PortfolioPanel.tsx` - 持仓面板
- `src/components/dashboard/DecisionLogPanel.tsx` - 决策日志面板
- `src/components/dashboard/MarketPanel.tsx` - 市场面板
- `src/components/dashboard/AlertPanel.tsx` - 风险提示面板
- `src/components/dashboard/CommandInput.tsx` - 命令输入框
- `src/components/dashboard/ResultModal.tsx` - 结果弹窗
- `src/components/dashboard/Table.tsx` - 通用表格组件
- `src/hooks/useDashboardData.ts` - 数据加载hook
- `src/hooks/useAutoRefresh.ts` - 自动刷新hook
- `src/utils/dashboardConfig.ts` - 配置加载/保存
- `src/utils/alertCalculator.ts` - 风险计算
- `src/entrypoints/dashboard.tsx` - 仪表盘入口
- `src/types/dashboard.ts` - 仪表盘类型定义
- `.pi/dashboard-config.json` - 配置文件

### 修改文件
- `package.json` - 添加 dashboard 脚本

---

## Task 1: 创建类型定义

**Files:**
- Create: `src/types/dashboard.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
// src/types/dashboard.ts

export type Portfolio = {
  totalValue: number
  totalProfit: number
  profitRate: number
  holdings: Holding[]
}

export type Holding = {
  code: string
  name: string
  quantity: number
  cost: number
  currentPrice: number
  marketValue: number
  profit: number
  profitRate: number
}

export type Decision = {
  date: string
  time: string
  code: string
  name: string
  type: 'buy' | 'sell' | 'hold' | 'avoid'
  reason: string
  verifyDate?: string
}

export type Stock = {
  code: string
  name: string
  price: number
  change: number
  changeRate: number
}

export type Index = {
  name: string
  value: number
  change: number
  changeRate: number
}

export type Alert = {
  type: 'error' | 'warning' | 'info'
  category: 'data' | 'risk' | 'todo'
  message: string
}

export type DashboardState = {
  portfolio: Portfolio | null
  decisions: Decision[]
  watchlist: Stock[]
  indices: Index[]
  alerts: Alert[]
  refreshInterval: number
  commandMode: boolean
  lastUpdate?: Date
}

export type DashboardConfig = {
  refreshInterval: number
  autoRefresh: boolean
  theme: {
    profit: string
    loss: string
    neutral: string
  }
  panels: {
    portfolio: {
      maxRows: number
      sortBy: 'marketValue' | 'profitRate'
    }
    decisionLog: {
      maxRows: number
    }
    market: {
      indexCount: number
      watchlistMaxRows: number
    }
  }
}

export type Command = {
  type: 'analyze' | 'screen' | 'buy' | 'sell' | 'refresh' | 'config' | 'help' | 'quit'
  args: string[]
}
```

- [ ] **Step 2: 提交**

```bash
git add src/types/dashboard.ts
git commit -m "feat(dashboard): add type definitions"
```

---

## Task 2: 创建通用表格组件

**Files:**
- Create: `src/components/dashboard/Table.tsx`

- [ ] **Step 1: 创建表格组件**

```typescript
// src/components/dashboard/Table.tsx
import React from 'react'
import { Box, Text } from 'ink'

type TableProps = {
  headers: string[]
  rows: string[][]
  columnWidths: number[]
  colorize?: (row: string[], rowIndex: number) => (string | undefined)[]
}

export function Table({ headers, rows, columnWidths, colorize }: TableProps) {
  const formatRow = (cells: string[]) => {
    return cells.map((cell, i) => {
      const width = columnWidths[i] || 10
      return cell.padEnd(width).slice(0, width)
    }).join('  ')
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{formatRow(headers)}</Text>
      {rows.map((row, i) => {
        const colors = colorize ? colorize(row, i) : []
        const formattedRow = formatRow(row)

        if (colors.length === 0) {
          return <Text key={i}>{formattedRow}</Text>
        }

        return (
          <Box key={i}>
            {row.map((cell, j) => {
              const width = columnWidths[j] || 10
              const paddedCell = cell.padEnd(width).slice(0, width)
              return (
                <Text key={j} color={colors[j]}>
                  {paddedCell}
                  {j < row.length - 1 ? '  ' : ''}
                </Text>
              )
            })}
          </Box>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/dashboard/Table.tsx
git commit -m "feat(dashboard): add Table component"
```

---

## Task 3: 创建配置工具

**Files:**
- Create: `src/utils/dashboardConfig.ts`
- Create: `.pi/dashboard-config.json`

- [ ] **Step 1: 创建默认配置文件**

```json
{
  "refreshInterval": 60,
  "autoRefresh": true,
  "theme": {
    "profit": "green",
    "loss": "red",
    "neutral": "gray"
  },
  "panels": {
    "portfolio": {
      "maxRows": 10,
      "sortBy": "marketValue"
    },
    "decisionLog": {
      "maxRows": 5
    },
    "market": {
      "indexCount": 3,
      "watchlistMaxRows": 5
    }
  }
}
```

- [ ] **Step 2: 创建配置加载/保存工具**

```typescript
// src/utils/dashboardConfig.ts
import fs from 'fs/promises'
import path from 'path'
import type { DashboardConfig } from '../types/dashboard.js'

const CONFIG_PATH = '.pi/dashboard-config.json'

const DEFAULT_CONFIG: DashboardConfig = {
  refreshInterval: 60,
  autoRefresh: true,
  theme: {
    profit: 'green',
    loss: 'red',
    neutral: 'gray',
  },
  panels: {
    portfolio: {
      maxRows: 10,
      sortBy: 'marketValue',
    },
    decisionLog: {
      maxRows: 5,
    },
    market: {
      indexCount: 3,
      watchlistMaxRows: 5,
    },
  },
}

export async function loadConfig(): Promise<DashboardConfig> {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    return DEFAULT_CONFIG
  }
}

export async function saveConfig(config: DashboardConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export async function updateConfig(key: string, value: string): Promise<void> {
  const config = await loadConfig()

  // 支持嵌套键，如 "theme.profit"
  const keys = key.split('.')
  let current: any = config

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      throw new Error(`Invalid config key: ${key}`)
    }
    current = current[keys[i]]
  }

  const lastKey = keys[keys.length - 1]
  if (!(lastKey in current)) {
    throw new Error(`Invalid config key: ${key}`)
  }

  // 类型转换
  if (typeof current[lastKey] === 'number') {
    current[lastKey] = parseInt(value, 10)
  } else if (typeof current[lastKey] === 'boolean') {
    current[lastKey] = value === 'true'
  } else {
    current[lastKey] = value
  }

  await saveConfig(config)
}
```

- [ ] **Step 3: 提交**

```bash
git add src/utils/dashboardConfig.ts .pi/dashboard-config.json
git commit -m "feat(dashboard): add config utilities"
```

---

## Task 4: 创建风险计算工具

**Files:**
- Create: `src/utils/alertCalculator.ts`

- [ ] **Step 1: 创建风险计算工具**

```typescript
// src/utils/alertCalculator.ts
import type { Alert, Portfolio, Decision } from '../types/dashboard.js'

export function calculateAlerts(
  portfolio: Portfolio | null,
  decisions: Decision[],
  dataSourceStatus: { aStock: boolean; hkStock: boolean }
): Alert[] {
  const alerts: Alert[] = []

  // 数据源状态检查
  if (dataSourceStatus.aStock) {
    alerts.push({
      type: 'info',
      category: 'data',
      message: '✅ A股数据正常',
    })
  } else {
    alerts.push({
      type: 'error',
      category: 'data',
      message: '❌ A股数据不可用',
    })
  }

  if (dataSourceStatus.hkStock) {
    alerts.push({
      type: 'info',
      category: 'data',
      message: '✅ 港股数据正常',
    })
  } else {
    alerts.push({
      type: 'error',
      category: 'data',
      message: '❌ 港股数据不可用 (akshare故障)',
    })
  }

  // 持仓风险检查
  if (portfolio) {
    for (const holding of portfolio.holdings) {
      // 盈亏超过±30%
      if (holding.profitRate > 30) {
        alerts.push({
          type: 'warning',
          category: 'risk',
          message: `• ${holding.name}(${holding.code}) 盈亏+${holding.profitRate.toFixed(1)}%，建议止盈`,
        })
      } else if (holding.profitRate < -30) {
        alerts.push({
          type: 'warning',
          category: 'risk',
          message: `• ${holding.name}(${holding.code}) 盈亏${holding.profitRate.toFixed(1)}%，建议止损`,
        })
      }

      // 单只股票市值占比超过30%
      const ratio = (holding.marketValue / portfolio.totalValue) * 100
      if (ratio > 30) {
        alerts.push({
          type: 'warning',
          category: 'risk',
          message: `• ${holding.name}(${holding.code}) 占比${ratio.toFixed(1)}%，重仓风险`,
        })
      }
    }
  }

  // 待验证决策
  const now = new Date()
  const pendingDecisions = decisions.filter((d) => {
    if (!d.verifyDate) return false
    const verifyDate = new Date(d.verifyDate)
    return verifyDate > now
  })

  if (pendingDecisions.length > 0) {
    for (const decision of pendingDecisions) {
      alerts.push({
        type: 'info',
        category: 'todo',
        message: `• ${decision.verifyDate} 复盘: ${decision.name}${decision.type}决策`,
      })
    }
  }

  return alerts
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/alertCalculator.ts
git commit -m "feat(dashboard): add alert calculator"
```

---

## Task 5: 创建自动刷新hook

**Files:**
- Create: `src/hooks/useAutoRefresh.ts`

- [ ] **Step 1: 创建自动刷新hook**

```typescript
// src/hooks/useAutoRefresh.ts
import { useEffect, useRef } from 'react'

export function useAutoRefresh(
  interval: number,
  callback: () => void | Promise<void>,
  enabled: boolean = true
) {
  const callbackRef = useRef(callback)

  // 更新callback引用
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled || interval <= 0) {
      return
    }

    const timer = setInterval(() => {
      callbackRef.current()
    }, interval * 1000)

    return () => clearInterval(timer)
  }, [interval, enabled])
}
```

- [ ] **Step 2: 提交**

```bash
git add src/hooks/useAutoRefresh.ts
git commit -m "feat(dashboard): add useAutoRefresh hook"
```

---

## Task 6: 创建数据加载hook

**Files:**
- Create: `src/hooks/useDashboardData.ts`

- [ ] **Step 1: 创建数据加载hook**

```typescript
// src/hooks/useDashboardData.ts
import { useState, useCallback } from 'react'
import fs from 'fs/promises'
import type { Portfolio, Decision, Stock, Index } from '../types/dashboard.js'

export function useDashboardData() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [watchlist, setWatchlist] = useState<Stock[]>([])
  const [indices, setIndices] = useState<Index[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>()

  const loadPortfolio = useCallback(async () => {
    try {
      const content = await fs.readFile('.pi/portfolio.json', 'utf-8')
      const data = JSON.parse(content)

      // 计算总市值和总盈亏
      const totalValue = data.holdings.reduce((sum: number, h: any) => sum + h.marketValue, 0)
      const totalCost = data.holdings.reduce((sum: number, h: any) => sum + h.cost * h.quantity, 0)
      const totalProfit = totalValue - totalCost
      const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

      setPortfolio({
        totalValue,
        totalProfit,
        profitRate,
        holdings: data.holdings,
      })
    } catch (error) {
      console.error('Failed to load portfolio:', error)
      setPortfolio(null)
    }
  }, [])

  const loadDecisionLog = useCallback(async () => {
    try {
      const content = await fs.readFile('.pi/decision-log.md', 'utf-8')

      // 简化版解析：匹配决策标题和表格
      const decisionBlocks = content.split(/### 决策 #\d+：/)
      const parsedDecisions: Decision[] = []

      for (const block of decisionBlocks.slice(1)) {
        const lines = block.split('\n')
        const titleLine = lines[0] // "股票名称（代码）— 决策类型"

        const match = titleLine.match(/(.+?)（(.+?)）— (.+)/)
        if (!match) continue

        const [, name, code, decisionType] = match

        // 提取表格中的时间和理由
        const timeMatch = block.match(/\| \*\*时间\*\* \| (.+?) \|/)
        const reasonMatch = block.match(/\| \*\*理由\*\* \| (.+?) \|/)
        const verifyMatch = block.match(/\| \*\*待验证\*\* \| (.+?) \|/)

        if (!timeMatch || !reasonMatch) continue

        const [date, time] = timeMatch[1].split(' ')

        let type: Decision['type'] = 'hold'
        if (decisionType.includes('买入') || decisionType.includes('加仓')) type = 'buy'
        else if (decisionType.includes('卖出')) type = 'sell'
        else if (decisionType.includes('回避')) type = 'avoid'

        parsedDecisions.push({
          date,
          time: time || '',
          code: code.trim(),
          name: name.trim(),
          type,
          reason: reasonMatch[1].trim(),
          verifyDate: verifyMatch ? verifyMatch[1].split('后')[0] : undefined,
        })
      }

      setDecisions(parsedDecisions.slice(0, 5))
    } catch (error) {
      console.error('Failed to load decision log:', error)
      setDecisions([])
    }
  }, [])

  const loadWatchlist = useCallback(async () => {
    try {
      const content = await fs.readFile('.pi/watchlist.json', 'utf-8')
      const data = JSON.parse(content)
      setWatchlist(data.stocks || [])
    } catch (error) {
      console.error('Failed to load watchlist:', error)
      setWatchlist([])
    }
  }, [])

  const refreshMarketData = useCallback(async () => {
    // TODO: 调用 akshare API 获取实时数据
    // 这里先用模拟数据
    setIndices([
      { name: '上证指数', value: 3089.26, change: 13.89, changeRate: 0.45 },
      { name: '深证成指', value: 9234.18, change: -21.34, changeRate: -0.23 },
      { name: '恒生指数', value: 19847.5, change: -210.5, changeRate: -1.05 },
    ])

    setLastUpdate(new Date())
  }, [])

  return {
    portfolio,
    decisions,
    watchlist,
    indices,
    lastUpdate,
    loadPortfolio,
    loadDecisionLog,
    loadWatchlist,
    refreshMarketData,
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/hooks/useDashboardData.ts
git commit -m "feat(dashboard): add useDashboardData hook"
```

---

## Task 7: 创建持仓面板

**Files:**
- Create: `src/components/dashboard/PortfolioPanel.tsx`

- [ ] **Step 1: 创建持仓面板组件**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add src/components/dashboard/PortfolioPanel.tsx
git commit -m "feat(dashboard): add PortfolioPanel component"
```

---

## Task 8: 创建决策日志面板

**Files:**
- Create: `src/components/dashboard/DecisionLogPanel.tsx`

- [ ] **Step 1: 创建决策日志面板组件**

```typescript
// src/components/dashboard/DecisionLogPanel.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Decision } from '../../types/dashboard.js'

type Props = {
  data: Decision[]
}

const DECISION_EMOJI: Record<Decision['type'], string> = {
  buy: '✅',
  sell: '💰',
  hold: '⏸️',
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
                {decision.name}({decision.code}) {decision.type === 'buy' ? '买入' : decision.type === 'sell' ? '卖出' : decision.type === 'hold' ? '持有' : '回避'}
              </Text>
              <Text color="gray">              {decision.reason}</Text>
            </Box>
          ))
        )}
      </Box>
      {pendingCount > 0 && (
        <Box marginTop={1}>
          <Text color="yellow">⚠️  {pendingCount}条决策待7日验证</Text>
        </Box>
      )}
    </Box>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/dashboard/DecisionLogPanel.tsx
git commit -m "feat(dashboard): add DecisionLogPanel component"
```

---

## Task 9: 创建市场面板

**Files:**
- Create: `src/components/dashboard/MarketPanel.tsx`

- [ ] **Step 1: 创建市场面板组件**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add src/components/dashboard/MarketPanel.tsx
git commit -m "feat(dashboard): add MarketPanel component"
```

---

## Task 10: 创建风险提示面板

**Files:**
- Create: `src/components/dashboard/AlertPanel.tsx`

- [ ] **Step 1: 创建风险提示面板组件**

```typescript
// src/components/dashboard/AlertPanel.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Alert } from '../../types/dashboard.js'

type Props = {
  alerts: Alert[]
}

export function AlertPanel({ alerts }: Props) {
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
```

- [ ] **Step 2: 提交**

```bash
git add src/components/dashboard/AlertPanel.tsx
git commit -m "feat(dashboard): add AlertPanel component"
```

---

## Task 11: 创建命令输入框

**Files:**
- Create: `src/components/dashboard/CommandInput.tsx`

- [ ] **Step 1: 创建命令输入框组件**

```typescript
// src/components/dashboard/CommandInput.tsx
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

type Props = {
  onSubmit: (command: string) => void
  onCancel: () => void
}

export function CommandInput({ onSubmit, onCancel }: Props) {
  const [input, setInput] = useState('')

  useInput((char, key) => {
    if (key.return) {
      if (input.trim()) {
        onSubmit(input.trim())
      }
      setInput('')
    } else if (key.escape) {
      onCancel()
      setInput('')
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1))
    } else if (!key.ctrl && !key.meta && char) {
      setInput((prev) => prev + char)
    }
  })

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan">:</Text>
      <Text>{input}</Text>
      <Text color="gray"> (Enter提交 | Esc取消)</Text>
    </Box>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/dashboard/CommandInput.tsx
git commit -m "feat(dashboard): add CommandInput component"
```

---

## Task 12: 创建结果弹窗

**Files:**
- Create: `src/components/dashboard/ResultModal.tsx`

- [ ] **Step 1: 创建结果弹窗组件**

```typescript
// src/components/dashboard/ResultModal.tsx
import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  content: string
  onClose: () => void
}

export function ResultModal({ content }: Props) {
  return (
    <Box
      position="absolute"
      width="80%"
      height="60%"
      left="10%"
      top="20%"
      borderStyle="double"
      borderColor="cyan"
      padding={1}
      flexDirection="column"
    >
      <Text bold color="cyan">分析结果</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>{content}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">[按任意键关闭]</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/dashboard/ResultModal.tsx
git commit -m "feat(dashboard): add ResultModal component"
```

---

## Task 13: 创建主仪表盘组件

**Files:**
- Create: `src/screens/Dashboard.tsx`

- [ ] **Step 1: 创建主仪表盘组件**

```typescript
// src/screens/Dashboard.tsx
import React, { useState, useEffect } from 'react'
import { Box, useInput, useApp } from 'ink'
import { PortfolioPanel } from '../components/dashboard/PortfolioPanel.js'
import { DecisionLogPanel } from '../components/dashboard/DecisionLogPanel.js'
import { MarketPanel } from '../components/dashboard/MarketPanel.js'
import { AlertPanel } from '../components/dashboard/AlertPanel.js'
import { CommandInput } from '../components/dashboard/CommandInput.js'
import { ResultModal } from '../components/dashboard/ResultModal.js'
import { useDashboardData } from '../hooks/useDashboardData.js'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'
import { loadConfig, updateConfig } from '../utils/dashboardConfig.js'
import { calculateAlerts } from '../utils/alertCalculator.js'
import type { DashboardConfig, Command } from '../types/dashboard.js'

export function Dashboard() {
  const { exit } = useApp()
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [commandMode, setCommandMode] = useState(false)
  const [modalContent, setModalContent] = useState<string | null>(null)

  const {
    portfolio,
    decisions,
    watchlist,
    indices,
    lastUpdate,
    loadPortfolio,
    loadDecisionLog,
    loadWatchlist,
    refreshMarketData,
  } = useDashboardData()

  // 加载初始数据
  useEffect(() => {
    const init = async () => {
      const cfg = await loadConfig()
      setConfig(cfg)
      await Promise.all([loadPortfolio(), loadDecisionLog(), loadWatchlist(), refreshMarketData()])
    }
    init()
  }, [loadPortfolio, loadDecisionLog, loadWatchlist, refreshMarketData])

  // 自动刷新
  useAutoRefresh(
    config?.refreshInterval || 60,
    refreshMarketData,
    config?.autoRefresh ?? true
  )

  // 计算风险提示
  const alerts = calculateAlerts(
    portfolio,
    decisions,
    { aStock: true, hkStock: false } // TODO: 实际检测数据源状态
  )

  // 命令解析
  const parseCommand = (input: string): Command => {
    const parts = input.trim().split(/\s+/)
    const type = parts[0] as Command['type']
    const args = parts.slice(1)
    return { type, args }
  }

  // 命令处理
  const handleCommand = async (input: string) => {
    const cmd = parseCommand(input)

    switch (cmd.type) {
      case 'refresh':
        await refreshMarketData()
        await loadPortfolio()
        setCommandMode(false)
        break

      case 'config':
        if (cmd.args.length === 2) {
          await updateConfig(cmd.args[0], cmd.args[1])
          const newConfig = await loadConfig()
          setConfig(newConfig)
        }
        setCommandMode(false)
        break

      case 'help':
        setModalContent(
          ':analyze 股票名 - 分析股票\n' +
          ':screen 条件 - 筛选股票\n' +
          ':buy 代码 数量 - 记录买入\n' +
          ':sell 代码 数量 - 记录卖出\n' +
          ':refresh - 刷新数据\n' +
          ':config key value - 修改配置\n' +
          ':quit - 退出'
        )
        setCommandMode(false)
        break

      case 'quit':
        exit()
        break

      default:
        setModalContent(`未知命令: ${cmd.type}`)
        setCommandMode(false)
    }
  }

  // 快捷键处理
  useInput((input, key) => {
    if (modalContent) {
      setModalContent(null)
      return
    }

    if (commandMode) {
      return
    }

    if (input === ':') {
      setCommandMode(true)
    } else if (input === 'r') {
      refreshMarketData()
      loadPortfolio()
    } else if (input === 'q') {
      exit()
    } else if (input === '?') {
      setModalContent(
        '快捷键:\n' +
        ': - 命令模式\n' +
        'r - 刷新\n' +
        'q - 退出\n' +
        '? - 帮助'
      )
    }
  })

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} flexDirection="column">
        <Box height="50%">
          <Box width="50%" borderStyle="single" borderColor="gray">
            <PortfolioPanel data={portfolio} />
          </Box>
          <Box width="50%" borderStyle="single" borderColor="gray">
            <DecisionLogPanel data={decisions} />
          </Box>
        </Box>
        <Box height="50%">
          <Box width="50%" borderStyle="single" borderColor="gray">
            <MarketPanel indices={indices} watchlist={watchlist} lastUpdate={lastUpdate} />
          </Box>
          <Box width="50%" borderStyle="single" borderColor="gray">
            <AlertPanel alerts={alerts} />
          </Box>
        </Box>
      </Box>

      {commandMode && (
        <CommandInput onSubmit={handleCommand} onCancel={() => setCommandMode(false)} />
      )}

      {modalContent && <ResultModal content={modalContent} onClose={() => setModalContent(null)} />}
    </Box>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/screens/Dashboard.tsx
git commit -m "feat(dashboard): add Dashboard main component"
```

---

## Task 14: 创建入口文件

**Files:**
- Create: `src/entrypoints/dashboard.tsx`

- [ ] **Step 1: 创建入口文件**

```typescript
// src/entrypoints/dashboard.tsx
import React from 'react'
import { render } from 'ink'
import { Dashboard } from '../screens/Dashboard.js'

render(<Dashboard />)
```

- [ ] **Step 2: 修改 package.json 添加脚本**

```json
{
  "scripts": {
    "dev": "tsx src/entrypoints/cli.tsx",
    "dashboard": "tsx src/entrypoints/dashboard.tsx",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/entrypoints/dashboard.tsx package.json
git commit -m "feat(dashboard): add dashboard entrypoint and npm script"
```

---

## Task 15: 手动测试

**Files:**
- None (manual testing)

- [ ] **Step 1: 启动仪表盘**

Run: `npm run dashboard`

Expected: 仪表盘显示四个面板，布局正确

- [ ] **Step 2: 测试快捷键**

Actions:
- 按 `?` 查看帮助
- 按任意键关闭帮助弹窗
- 按 `r` 刷新数据
- 按 `:` 进入命令模式

Expected: 所有快捷键正常工作

- [ ] **Step 3: 测试命令输入**

Actions:
- 按 `:` 进入命令模式
- 输入 `help` 按 Enter
- 查看帮助信息
- 按任意键关闭
- 按 `:` 输入 `refresh` 按 Enter
- 观察数据刷新

Expected: 命令正确执行

- [ ] **Step 4: 测试自动刷新**

Actions:
- 等待60秒
- 观察市场面板的更新时间

Expected: 时间自动更新

- [ ] **Step 5: 测试退出**

Actions:
- 按 `q` 退出
- 或按 `:` 输入 `quit` 按 Enter

Expected: 程序正常退出

---

## 验收标准

- [ ] 仪表盘正确显示四个面板
- [ ] 持仓数据正确加载和显示
- [ ] 决策日志正确解析和显示（最近5条）
- [ ] 市场数据显示（当前为模拟数据）
- [ ] 风险提示正确计算和显示
- [ ] 命令输入框按 `:` 唤醒
- [ ] 快捷键正常工作（r刷新、q退出、?帮助）
- [ ] 配置文件正确加载
- [ ] 自动刷新功能正常（默认60秒）
- [ ] 程序可以正常启动和退出
