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
