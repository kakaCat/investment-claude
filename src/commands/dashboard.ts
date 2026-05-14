import { readFile } from 'fs/promises'
import { registerCommand } from './index.js'

// ── CJK-aware visual width ──────────────────────────────────────────────────

function charWidth(code: number): number {
  if (
    (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4DBF) || // CJK Unified Extension A
    (code >= 0x20000 && code <= 0x2A6DF) || // Extension B
    (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
    (code >= 0x2F800 && code <= 0x2FA1F) || // CJK Compatibility Supplement
    (code >= 0x3000 && code <= 0x303F) || // CJK Symbols & Punctuation
    (code >= 0xFF01 && code <= 0xFF60) || // Fullwidth Forms
    (code >= 0xFFE0 && code <= 0xFFE6) || // Fullwidth Signs
    (code >= 0xFE30 && code <= 0xFE4F) // CJK Compatibility Forms
  ) {
    return 2
  }
  return 1
}

function visualWidth(s: string): number {
  // Strip ANSI escape codes first
  const plain = s.replace(/\x1b\[[0-9;]*m/g, '')
  let w = 0
  for (const c of plain) {
    w += charWidth(c.codePointAt(0) ?? 0)
  }
  return w
}

function pad(s: string, targetWidth: number): string {
  const current = visualWidth(s)
  return s + ' '.repeat(Math.max(0, targetWidth - current))
}

function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  const sign = n >= 0 ? '+' : '-'
  if (abs >= 10000) return `${sign}¥${(abs / 10000).toFixed(1)}万`
  return `${sign}¥${abs.toFixed(0)}`
}

// ── ANSI helpers ────────────────────────────────────────────────────────────

const C = { r: '\x1b[0m', g: '\x1b[32m', red: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', b: '\x1b[1m', dim: '\x1b[2m' }

function dim(s: string) { return `${C.dim}${s}${C.r}` }
function green(s: string) { return `${C.g}${s}${C.r}` }
function red(s: string) { return `${C.red}${s}${C.r}` }
function yellow(s: string) { return `${C.y}${s}${C.r}` }
function cyan(s: string) { return `${C.c}${s}${C.r}` }
function bold(s: string) { return `${C.b}${s}${C.r}` }
function colorPct(pct: number) { return pct > 0 ? green : red }

// ── Layout constants ────────────────────────────────────────────────────────
// Terminal width: 80 cols
// Box structure: │ [left 36] │ [right 36] │
// Total: 1 + 1 + 36 + 1 + 1 + 1 + 36 + 1 = 78 cols

const BOX_WIDTH = 78
const LEFT_WIDTH = 36
const RIGHT_WIDTH = 36

function divider(char: string, left: string, mid: string, right: string): string {
  // │────────────────────┬────────────────────│
  const leftPart = char.repeat(LEFT_WIDTH + 1) // +1 for space after │
  const rightPart = char.repeat(RIGHT_WIDTH + 1) // +1 for space before │
  return cyan(left + leftPart + mid + rightPart + right)
}

// ── Data loading ────────────────────────────────────────────────────────────

interface Holding {
  symbol: string; name: string; quantity: number; avg_cost: number; sector?: string
}
interface PortfolioRow extends Holding { mv: number; profit: number; rate: number }

async function loadPortfolio(): Promise<{ rows: PortfolioRow[]; totalValue: number; totalProfit: number; totalRate: number } | null> {
  try {
    const raw = await readFile('.pi/portfolio.json', 'utf-8')
    const data = JSON.parse(raw)
    const holdings: Holding[] = data.holdings || []
    let totalValue = 0; let totalCost = 0
    const rows: PortfolioRow[] = holdings.map(h => {
      const price = h.avg_cost
      const mv = h.quantity * price
      const cost = h.quantity * h.avg_cost
      const profit = mv - cost
      const rate = cost > 0 ? (profit / cost) * 100 : 0
      totalValue += mv; totalCost += cost
      return { ...h, mv, profit, rate }
    })
    rows.sort((a, b) => b.mv - a.mv)
    const totalProfit = totalValue - totalCost
    const totalRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0
    return { rows, totalValue, totalProfit, totalRate }
  } catch { return null }
}

interface Decision {
  date: string; time: string; name: string; code: string; emoji: string; reason: string
}

async function loadDecisions(): Promise<Decision[]> {
  try {
    const content = await readFile('.pi/decision-log.md', 'utf-8')
    const blocks = content.split(/### 决策 #\d+：/)
    const decisions: Decision[] = []
    for (const block of blocks.slice(1)) {
      const titleM = block.match(/^(.+?)（(\d+)）— (.+)/m)
      if (!titleM) continue
      const [, name, code, typeStr] = titleM
      const timeM = block.match(/\| \*\*时间\*\* \| (.+?) \|/)
      const reasonM = block.match(/\| \*\*理由\*\* \| (.+?) \|/)
      if (!timeM || !reasonM) continue
      let emoji = '⏸️'
      if (typeStr.includes('买入') || typeStr.includes('加仓')) emoji = '✅'
      else if (typeStr.includes('回避')) emoji = '❌'
      else if (typeStr.includes('卖出')) emoji = '💰'
      decisions.push({ date: timeM[1].split(' ')[0], time: timeM[1].split(' ')[1] || '', name, code, emoji, reason: reasonM[1].trim() })
    }
    decisions.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    return decisions.slice(0, 5)
  } catch { return [] }
}

interface WatchItem { code: string; name: string }

async function loadWatchlist(): Promise<WatchItem[]> {
  try {
    const raw = await readFile('.pi/watchlist.json', 'utf-8')
    const data = JSON.parse(raw)
    return (data.items || []).slice(0, 5).map((s: any) => ({ code: s.symbol, name: s.name }))
  } catch { return [] }
}

function calcAlerts(portfolio: { rows: PortfolioRow[]; totalValue: number } | null, decisions: Decision[]): string[] {
  const alerts: string[] = []
  if (portfolio) {
    for (const row of portfolio.rows) {
      if (row.rate > 30) alerts.push(`⚠  ${row.name}(${row.symbol}) 盈亏+${row.rate.toFixed(1)}%，建议止盈`)
      if (row.rate < -30) alerts.push(`⚠  ${row.name}(${row.symbol}) 盈亏${row.rate.toFixed(1)}%，建议止损`)
      if (portfolio.totalValue > 0 && row.mv / portfolio.totalValue > 0.3) {
        alerts.push(`⚠  ${row.name}(${row.symbol}) 占比${((row.mv / portfolio.totalValue) * 100).toFixed(1)}%，重仓风险`)
      }
    }
  }
  const now = new Date()
  for (const d of decisions) {
    const dt = new Date(d.date)
    const diff = Math.floor((now.getTime() - dt.getTime()) / 86400000)
    if (diff < 7) alerts.push(`📋 ${d.date} 复盘: ${d.name} ${d.emoji}`)
  }
  return alerts
}

// ── Panel renderers ─────────────────────────────────────────────────────────

function renderPortfolio(pf: { rows: PortfolioRow[]; totalValue: number; totalProfit: number; totalRate: number } | null): string[] {
  const lines: string[] = []
  lines.push(bold('💼 持仓'))

  if (pf && pf.rows.length > 0) {
    const pc = pf.totalProfit > 0 ? green : red
    lines.push(`${dim('总市值')} ¥${pf.totalProfit > 0 ? green : red}${pf.totalValue.toFixed(0)}  ${pc(fmtMoney(pf.totalProfit))} (${pf.totalRate > 0 ? '+' : ''}${pf.totalRate.toFixed(1)}%)${C.r}`)
    lines.push('')

    // CJK-aware column layout:
    // name=6vis(3ch CJK~=6 or 4ch ASCII), code=6, qty=4, cost=7, mv=7, pnl=9 → total ~39
    // "代码  名称      数量  成本     市值     盈亏"
    const header = `${pad('代码', 8)}${pad('名称', 10)}${pad('数量', 6)}${pad('成本', 8)}${pad('市值', 10)}${'盈亏'}`
    lines.push(dim(header))

    for (const row of pf.rows.slice(0, 6)) {
      const pctStr = `${row.rate > 0 ? '+' : ''}${row.rate.toFixed(1)}%`
      const profitStr = `${fmtMoney(row.profit)} ${pctStr}`
      const pColor = colorPct(row.rate)
      lines.push(
        `${pad(row.symbol, 8)}${pad(row.name, 10)}${pad(String(row.quantity), 6)}` +
        `${pad('¥' + row.avg_cost.toFixed(2), 8)}${pad('¥' + row.mv.toFixed(0), 10)}` +
        `${pColor(profitStr)}${C.r}`
      )
    }
  } else {
    lines.push(yellow('暂无持仓数据'))
  }
  return lines
}

function renderDecisions(decisions: Decision[]): string[] {
  const lines: string[] = []
  lines.push(bold('📝 最近决策'))

  if (decisions.length > 0) {
    for (const d of decisions) {
      const dateStr = d.date.slice(5) // MM-DD
      lines.push(`${dateStr} ${d.time}  ${d.emoji} ${d.name}(${d.code})`)
      const reason = d.reason.length > 36 ? d.reason.slice(0, 36) + '...' : d.reason
      lines.push(`         ${reason}`)
    }
  } else {
    lines.push(yellow('暂无决策记录'))
  }
  return lines
}

function renderWatchlist(items: WatchItem[]): string[] {
  const lines: string[] = []
  lines.push(bold('📈 自选股 Top5'))

  if (items.length > 0) {
    for (const s of items) {
      lines.push(`${s.code}  ${pad(s.name, 8)} ¥---.--   ---.--%`)
    }
  } else {
    lines.push(yellow('暂无自选股'))
  }
  return lines
}

function renderAlerts(alerts: string[]): string[] {
  const lines: string[] = []
  lines.push(bold('⚠️  风险提示'))

  if (alerts.length > 0) {
    for (const a of alerts.slice(0, 8)) {
      const isWarning = a.startsWith('⚠')
      lines.push(isWarning ? yellow(a) : a)
    }
  } else {
    lines.push(green('✅ 暂无风险提示'))
  }
  return lines
}

// ── Side-by-side layout ─────────────────────────────────────────────────────

function sideBySide(left: string[], right: string[]): string[] {
  const lines: string[] = []
  const maxLen = Math.max(left.length, right.length)

  for (let i = 0; i < maxLen; i++) {
    const l = left[i] ?? ''
    const r = right[i] ?? ''
    lines.push(`${cyan('│')} ${pad(l, LEFT_WIDTH)} ${cyan('│')} ${pad(r, RIGHT_WIDTH)} ${cyan('│')}`)
  }
  return lines
}

// ── Main command ────────────────────────────────────────────────────────────

registerCommand({
  name: 'dashboard',
  aliases: ['dash', 'db', '仪表盘'],
  description: '📊 投资仪表盘 — 显示持仓、决策日志、自选股、风险提示',
  async call(_args, ctx) {
    ctx.history.appendUserMessage('/dashboard')

    const [portfolio, decisions, watchlist] = await Promise.all([
      loadPortfolio(), loadDecisions(), loadWatchlist(),
    ])
    const alerts = calcAlerts(portfolio, decisions)

    const lines: string[] = []
    lines.push('')
    lines.push(cyan('┌' + '─'.repeat(BOX_WIDTH - 2) + '┐'))
    lines.push(`${cyan('│')}  ${bold('📊 投资仪表盘')}${' '.repeat(BOX_WIDTH - 15)}${cyan('│')}`)
    lines.push(divider('─', '├', '┬', '┤'))

    // Panel 1: Portfolio (left) | Decisions (right)
    const pfLines = renderPortfolio(portfolio)
    const dcLines = renderDecisions(decisions)
    lines.push(...sideBySide(pfLines, dcLines))

    lines.push(divider('─', '├', '┴', '┤'))

    // Panel 2: Watchlist (left) | Alerts (right)
    const wlLines = renderWatchlist(watchlist)
    const alLines = renderAlerts(alerts)
    lines.push(...sideBySide(wlLines, alLines))

    lines.push(cyan('└' + '─'.repeat(BOX_WIDTH - 2) + '┘'))
    lines.push('')
    lines.push(dim('提示: / 命令模式 | ↑↓ 滚动 | Ctrl+C 中断'))

    ctx.history.appendAssistantMessage(lines.join('\n'))
    return true
  },
})
