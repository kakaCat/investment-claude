import fs from 'fs/promises'
import { registerCommand } from './index.js'

function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  const sign = n >= 0 ? '+' : '-'
  if (abs >= 10000) return `${sign}¥${(abs / 10000).toFixed(1)}万`
  return `${sign}¥${abs.toFixed(0)}`
}

function pad(s: string, len: number): string {
  const visual = s.replace(/\x1b\[[0-9;]*m/g, '')
  return s + ' '.repeat(Math.max(0, len - visual.length))
}

const C = { r: '\x1b[0m', g: '\x1b[32m', red: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', b: '\x1b[1m' }

async function loadPortfolio() {
  try {
    const raw = await fs.readFile('.pi/portfolio.json', 'utf-8')
    const data = JSON.parse(raw)
    const holdings = data.holdings || []
    let totalValue = 0
    let totalCost = 0
    const rows = holdings.map((h: any) => {
      const price = h.avg_cost // TODO: 替换为实时价格
      const mv = h.quantity * price
      const cost = h.quantity * h.avg_cost
      const profit = mv - cost
      const rate = cost > 0 ? (profit / cost) * 100 : 0
      totalValue += mv
      totalCost += cost
      return { code: h.symbol, name: h.name, qty: h.quantity, cost: h.avg_cost, price, mv, profit, rate }
    })
    rows.sort((a: any, b: any) => b.mv - a.mv)
    const totalProfit = totalValue - totalCost
    const totalRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0
    return { rows, totalValue, totalProfit, totalRate }
  } catch { return null }
}

async function loadDecisions() {
  try {
    const content = await fs.readFile('.pi/decision-log.md', 'utf-8')
    const blocks = content.split(/### 决策 #\d+：/)
    const decisions: any[] = []
    for (const block of blocks.slice(1)) {
      const titleMatch = block.match(/^(.+?)（(\d+)）— (.+)/m)
      if (!titleMatch) continue
      const [, name, code, typeStr] = titleMatch
      const timeM = block.match(/\| \*\*时间\*\* \| (.+?) \|/)
      const reasonM = block.match(/\| \*\*理由\*\* \| (.+?) \|/)
      if (!timeM || !reasonM) continue
      let emoji = '⏸️'
      if (typeStr.includes('买入') || typeStr.includes('加仓')) emoji = '✅'
      else if (typeStr.includes('回避')) emoji = '❌'
      else if (typeStr.includes('卖出')) emoji = '💰'
      decisions.push({ date: timeM[1].split(' ')[0], time: timeM[1].split(' ')[1] || '', name, code, emoji, reason: reasonM[1].trim() })
    }
    decisions.sort((a: any, b: any) => (b.date + b.time).localeCompare(a.date + a.time))
    return decisions.slice(0, 5)
  } catch { return [] }
}

async function loadWatchlist() {
  try {
    const raw = await fs.readFile('.pi/watchlist.json', 'utf-8')
    const data = JSON.parse(raw)
    return (data.items || []).slice(0, 5).map((s: any) => ({
      code: s.symbol, name: s.name, price: 0, changeRate: 0,
    }))
  } catch { return [] }
}

function calcAlerts(portfolio: any, decisions: any[]) {
  const alerts: string[] = []
  if (portfolio) {
    for (const row of portfolio.rows) {
      if (row.rate > 30) alerts.push(`${C.y}⚠  ${row.name}(${row.code}) 盈亏+${row.rate.toFixed(1)}%，建议止盈${C.r}`)
      if (row.rate < -30) alerts.push(`${C.red}⚠  ${row.name}(${row.code}) 盈亏${row.rate.toFixed(1)}%，建议止损${C.r}`)
      if (portfolio.totalValue > 0 && row.mv / portfolio.totalValue > 0.3) {
        alerts.push(`${C.y}⚠  ${row.name}(${row.code}) 占比${((row.mv / portfolio.totalValue) * 100).toFixed(1)}%，重仓风险${C.r}`)
      }
    }
  }
  const now = new Date()
  for (const d of decisions) {
    const dt = new Date(d.date)
    const diff = Math.floor((now.getTime() - dt.getTime()) / 86400000)
    if (diff < 7) alerts.push(`${C.c}📋 ${d.date} 复盘: ${d.name} ${d.emoji}${C.r}`)
  }
  return alerts
}

registerCommand({
  name: 'dashboard',
  aliases: ['dash', 'db'],
  description: 'Show investment dashboard with portfolio, decisions, market, and alerts',
  async call(_args, ctx) {
    ctx.history.appendUserMessage('/dashboard')

    const [portfolio, decisions, watchlist] = await Promise.all([
      loadPortfolio(), loadDecisions(), loadWatchlist(),
    ])
    const alerts = calcAlerts(portfolio, decisions)

    const lines: string[] = []
    lines.push('')
    lines.push(`${C.b}${C.c}┌──────────────────────────────────────────────────────────────┐${C.r}`)
    lines.push(`${C.b}${C.c}│${C.r}  ${C.b}📊 投资仪表盘${C.r}${' '.repeat(48)}${C.c}│${C.r}`)
    lines.push(`${C.b}${C.c}├──────────────────────┬───────────────────────────────────────┤${C.r}`)

    // ── 持仓 ──
    const pfLeft: string[] = [`${C.b}💼 持仓${C.r}`]
    if (portfolio && portfolio.rows.length > 0) {
      const pc = portfolio.totalProfit > 0 ? C.g : C.red
      pfLeft.push(`${C.c}总市值 ${C.r}¥${portfolio.totalValue.toFixed(0)}  ${pc}${fmtMoney(portfolio.totalProfit)} (${portfolio.totalRate > 0 ? '+' : ''}${portfolio.totalRate.toFixed(1)}%)${C.r}`)
      pfLeft.push('')
      const hdr = `${pad('代码', 8)}${pad('名称', 10)}${pad('数量', 6)}${pad('成本', 8)}${pad('市值', 10)}${pad('盈亏', 10)}`
      pfLeft.push(`${C.c}${hdr}${C.r}`)
      for (const row of portfolio.rows.slice(0, 5)) {
        const pc2 = row.rate > 0 ? C.g : C.red
        pfLeft.push(
          `${pad(row.code, 8)}${pad(row.name, 10)}${pad(String(row.qty), 6)}` +
          `${pad('¥' + row.cost.toFixed(2), 8)}${pad('¥' + row.mv.toFixed(0), 10)}` +
          `${pc2}${pad(fmtMoney(row.profit) + ' ' + (row.rate > 0 ? '+' : '') + row.rate.toFixed(1) + '%', 10)}${C.r}`
        )
      }
    } else {
      pfLeft.push(`${C.y}暂无持仓数据${C.r}`)
    }

    // ── 决策 ──
    const dcRight: string[] = [`${C.b}📝 最近决策${C.r}`]
    if (decisions.length > 0) {
      for (const d of decisions) {
        dcRight.push(`${d.date.slice(5)} ${d.time}  ${d.emoji} ${d.name}(${d.code})`)
        if (d.reason.length > 35) {
          dcRight.push(`               ${d.reason.slice(0, 35)}...`)
        } else {
          dcRight.push(`               ${d.reason}`)
        }
      }
    } else {
      dcRight.push(`${C.y}暂无决策记录${C.r}`)
    }

    // 左右合并
    const maxLR = Math.max(pfLeft.length, dcRight.length)
    for (let i = 0; i < maxLR; i++) {
      const l = pfLeft[i] || ''
      const r = dcRight[i] || ''
      const lVisual = l.replace(/\x1b\[[0-9;]*m/g, '')
      lines.push(`${C.c}│${C.r} ${pad(l, 34)} ${C.c}│${C.r} ${pad(r, 35)}${C.c}│${C.r}`)
    }

    // ── 分隔 ──
    lines.push(`${C.b}${C.c}├──────────────────────┴───────────────────────────────────────┤${C.r}`)

    // ── 自选股 ──
    const watchRows: string[] = [`${C.b}📈 自选股${C.r}`]
    if (watchlist.length > 0) {
      for (const s of watchlist) {
        watchRows.push(`${s.code} ${pad(s.name, 8)} ¥---.--   ---.--%`)
      }
    } else {
      watchRows.push(`${C.y}暂无自选股${C.r}`)
    }

    // ── 风险提示 ──
    const alertRows: string[] = [`${C.b}⚠️  风险提示${C.r}`]
    if (alerts.length > 0) {
      for (const a of alerts.slice(0, 8)) alertRows.push(a)
    } else {
      alertRows.push(`${C.g}✅ 暂无风险提示${C.r}`)
    }

    const maxWA = Math.max(watchRows.length, alertRows.length)
    for (let i = 0; i < maxWA; i++) {
      const l = watchRows[i] || ''
      const r = alertRows[i] || ''
      lines.push(`${C.c}│${C.r} ${pad(l, 34)} ${C.c}│${C.r} ${pad(r, 35)}${C.c}│${C.r}`)
    }

    lines.push(`${C.b}${C.c}└──────────────────────────────────────────────────────────────┘${C.r}`)
    lines.push('')
    lines.push(`${C.c}提示: : = 命令模式 | r = 刷新 | q = 退出 | ? = 帮助${C.r}`)

    ctx.history.appendAssistantMessage(lines.join('\n'))
    return true
  },
})
