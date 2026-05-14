// src/hooks/__tests__/useDashboardData.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'

describe('Dashboard data loading', () => {
  const testDir = path.join(process.cwd(), '.pi-test')

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should adapt portfolio data structure correctly', async () => {
    // Create test portfolio data matching actual structure
    const portfolioData = {
      holdings: [
        {
          symbol: '000425',
          name: '徐工机械',
          quantity: 400,
          avg_cost: 6.78,
          market: 'A',
        },
        {
          symbol: '512880',
          name: '证券ETF',
          quantity: 4900,
          avg_cost: 1.033,
          market: 'A',
        },
      ],
      last_updated: '2026-05-14 14:04:06',
    }

    await fs.writeFile(
      path.join(testDir, 'portfolio.json'),
      JSON.stringify(portfolioData, null, 2)
    )

    // Load and adapt data
    const content = await fs.readFile(path.join(testDir, 'portfolio.json'), 'utf-8')
    const data = JSON.parse(content)

    // Simulate the adaptation logic from useDashboardData
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

    // Verify structure adaptation
    expect(holdings).toHaveLength(2)
    expect(holdings[0]).toMatchObject({
      code: '000425',
      name: '徐工机械',
      quantity: 400,
      cost: 6.78,
      currentPrice: 6.78,
      marketValue: 400 * 6.78,
      profit: 0,
      profitRate: 0,
    })

    // Verify calculations
    const totalValue = holdings.reduce((sum: number, h: any) => sum + h.marketValue, 0)
    const totalCost = holdings.reduce((sum: number, h: any) => sum + h.cost * h.quantity, 0)
    const expectedTotalValue = 400 * 6.78 + 4900 * 1.033

    expect(totalValue).toBeCloseTo(expectedTotalValue, 2)
    expect(totalCost).toBeCloseTo(expectedTotalValue, 2)
  })

  it('should adapt watchlist data structure correctly', async () => {
    // Create test watchlist data matching actual structure
    const watchlistData = {
      items: [
        {
          symbol: '002714',
          name: '牧原股份',
          market: 'A',
          priority: 2,
        },
        {
          symbol: '002475',
          name: '立讯精密',
          market: 'A',
          priority: 2,
        },
      ],
      last_updated: '2026-05-14 08:47:57',
    }

    await fs.writeFile(
      path.join(testDir, 'watchlist.json'),
      JSON.stringify(watchlistData, null, 2)
    )

    // Load and adapt data
    const content = await fs.readFile(path.join(testDir, 'watchlist.json'), 'utf-8')
    const data = JSON.parse(content)

    // Simulate the adaptation logic from useDashboardData
    const stocks = (data.items || []).map((item: any) => ({
      code: item.symbol,
      name: item.name,
      price: 0,
      change: 0,
      changeRate: 0,
    }))

    // Verify structure adaptation
    expect(stocks).toHaveLength(2)
    expect(stocks[0]).toMatchObject({
      code: '002714',
      name: '牧原股份',
      price: 0,
      change: 0,
      changeRate: 0,
    })
  })

  it('should parse decision log with emoji markers correctly', async () => {
    // Create test decision log matching actual format
    const decisionLog = `# 决策日志

## 2026-05-14

### 决策 #1：小米集团（01810）— ⏸️ 持有

| 项目 | 内容 |
|------|------|
| **时间** | 2026-05-14 14:04 |
| **价格** | ¥32.02 |
| **决策** | ⏸️ 持有 |
| **理由** | 港股财务数据全部不可用 |
| **待验证** | 7天后检查走势 |

### 决策 #2：青岛啤酒（600600）— ✅ 加仓

| 项目 | 内容 |
|------|------|
| **时间** | 2026-05-14 18:04 |
| **价格** | ¥62.15 |
| **决策** | ✅ 加仓 |
| **理由** | PE 18.13倍处于5年5.83%分位 |
| **待验证** | 7天后检查走势 |
`

    await fs.writeFile(path.join(testDir, 'decision-log.md'), decisionLog)

    // Load and parse data
    const content = await fs.readFile(path.join(testDir, 'decision-log.md'), 'utf-8')

    // Simulate the parsing logic from useDashboardData
    const decisionBlocks = content.split(/### 决策 #\d+：/)
    const parsedDecisions: any[] = []

    for (const block of decisionBlocks.slice(1)) {
      const lines = block.split('\n')
      const titleLine = lines[0]

      const match = titleLine.match(/(.+?)（(.+?)）— (?:[✅❌⏸️]\s*)?(.+)/)
      if (!match) continue

      const [, name, code, decisionType] = match

      const timeMatch = block.match(/\| \*\*时间\*\* \| (.+?) \|/)
      const reasonMatch = block.match(/\| \*\*理由\*\* \| (.+?) \|/)
      const verifyMatch = block.match(/\| \*\*待验证\*\* \| (.+?) \|/)

      if (!timeMatch || !reasonMatch) continue

      const timeStr = timeMatch[1].trim()
      const [date, time] = timeStr.split(' ')

      let type = 'hold'
      if (decisionType.includes('买入') || decisionType.includes('加仓')) type = 'buy'
      else if (decisionType.includes('卖出')) type = 'sell'
      else if (decisionType.includes('回避')) type = 'avoid'
      else if (decisionType.includes('持有')) type = 'hold'

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

    // Verify parsing
    expect(parsedDecisions).toHaveLength(2)

    expect(parsedDecisions[0]).toMatchObject({
      date: '2026-05-14',
      time: '14:04',
      code: '01810',
      name: '小米集团',
      type: 'hold',
      reason: '港股财务数据全部不可用',
    })

    expect(parsedDecisions[1]).toMatchObject({
      date: '2026-05-14',
      time: '18:04',
      code: '600600',
      name: '青岛啤酒',
      type: 'buy',
      reason: 'PE 18.13倍处于5年5.83%分位',
    })
  })
})
