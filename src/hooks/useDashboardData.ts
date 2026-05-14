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

      // 适配实际数据结构：symbol -> code, avg_cost -> cost/currentPrice
      // TODO: 集成实时价格API后替换 currentPrice 的计算
      const holdings = data.holdings.map((h: any) => {
        const cost = h.avg_cost
        const currentPrice = h.avg_cost // TODO: 替换为实时价格
        const marketValue = h.quantity * currentPrice
        const totalCost = h.quantity * cost
        const profit = marketValue - totalCost
        const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0

        return {
          code: h.symbol,
          name: h.name,
          quantity: h.quantity,
          cost,
          currentPrice,
          marketValue,
          profit,
          profitRate,
        }
      })

      // 计算总市值和总盈亏
      const totalValue = holdings.reduce((sum: number, h: any) => sum + h.marketValue, 0)
      const totalCost = holdings.reduce((sum: number, h: any) => sum + h.cost * h.quantity, 0)
      const totalProfit = totalValue - totalCost
      const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

      setPortfolio({
        totalValue,
        totalProfit,
        profitRate,
        holdings,
      })
    } catch (error) {
      console.error('Failed to load portfolio:', error)
      setPortfolio(null)
    }
  }, [])

  const loadDecisionLog = useCallback(async () => {
    try {
      const content = await fs.readFile('.pi/decision-log.md', 'utf-8')

      // 解析决策日志：匹配 "### 决策 #N：股票名称（代码）— 决策类型"
      const decisionBlocks = content.split(/### 决策 #\d+：/)
      const parsedDecisions: Decision[] = []

      for (const block of decisionBlocks.slice(1)) {
        const lines = block.split('\n')
        const titleLine = lines[0] // "股票名称（代码）— 决策类型"

        // 匹配格式：名称（代码）— 决策 或 名称（代码）— ✅/❌/⏸️/🔴 决策
        const match = titleLine.match(/(.+?)（(.+?)）— (?:[✅❌⏸️🔴]\s*)?(.+)/)
        if (!match) continue

        const [, name, code, decisionType] = match

        // 从表格中提取字段
        const timeMatch = block.match(/\| \*\*时间\*\* \| (.+?) \|/)
        const reasonMatch = block.match(/\| \*\*理由\*\* \| (.+?) \|/)
        const verifyMatch = block.match(/\| \*\*待验证\*\* \| (.+?) \|/)

        if (!timeMatch || !reasonMatch) continue

        const timeStr = timeMatch[1].trim()
        const [date, time] = timeStr.split(' ')

        // 决策类型映射
        let type: Decision['type'] = 'hold'
        if (decisionType.includes('买入') || decisionType.includes('加仓')) type = 'buy'
        else if (decisionType.includes('卖出')) type = 'sell'
        else if (decisionType.includes('回避')) type = 'avoid'
        else if (decisionType.includes('持有')) type = 'hold'

        // 解析待验证日期："7天后检查走势" -> 计算实际日期
        let verifyDate: string | undefined
        if (verifyMatch) {
          const verifyText = verifyMatch[1].trim()
          const daysMatch = verifyText.match(/(\d+)天后/)
          if (daysMatch && date) {
            const days = parseInt(daysMatch[1], 10)
            const baseDate = new Date(date)
            baseDate.setDate(baseDate.getDate() + days)
            verifyDate = baseDate.toISOString().split('T')[0]
          }
        }

        parsedDecisions.push({
          date,
          time: time || '',
          code: code.trim(),
          name: name.trim(),
          type,
          reason: reasonMatch[1].trim(),
          verifyDate,
        })
      }

      // 按时间倒序排序（最新的在前）
      parsedDecisions.sort((a, b) => {
        const dateTimeA = `${a.date} ${a.time}`
        const dateTimeB = `${b.date} ${b.time}`
        return dateTimeB.localeCompare(dateTimeA)
      })

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

      // 适配实际数据结构：data.items -> data.stocks
      // TODO: 集成实时价格API后添加 price, change, changeRate
      const stocks = (data.items || []).map((item: any) => ({
        code: item.symbol,
        name: item.name,
        price: 0, // TODO: 替换为实时价格
        change: 0, // TODO: 替换为实时涨跌额
        changeRate: 0, // TODO: 替换为实时涨跌幅
      }))

      setWatchlist(stocks)
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
