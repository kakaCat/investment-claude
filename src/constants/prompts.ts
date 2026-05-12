// src/constants/prompts.ts
// 系统提示词主入口 — 对标 Claude Code src/constants/prompts.ts

import {
  registerSection,
  registerVolatileSection,
  resolveSystemPrompt,
  clearSectionCache,
  type SectionContext,
} from './systemPromptSections.js'
import {
  IDENTITY,
  DOING_TASKS,
  TONE,
  PLAN_MODE_SECTION,
  MEMORY_SYSTEM_INSTRUCTIONS,
  SNIP_NUDGE,
} from './promptSections.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { loadEnvInfo } from '../context/envContext.js'
import { loadWorkspaceSection } from '../context/workspaceContext.js'
import { loadGitStatus } from '../context/gitContext.js'
import { loadClaudeMd } from '../context/claudeMdContext.js'
import { callPython } from '../utils/python-bridge.js'

let initialized = false

export function initSystemPrompt(): void {
  if (initialized) return
  initialized = true

  // 静态段（缓存后永不失效）- 投资顾问身份
  registerSection('identity', async () => IDENTITY)

  // Bootstrap persona files from .pi/bootstrap/
  registerSection('bootstrap', async (ctx) => {
    const bootstrapDir = join(ctx.cwd, '.pi', 'bootstrap')
    if (!existsSync(bootstrapDir)) return null
    const files = ['IDENTITY.md', 'OUTPUT.md', 'DATA_INTEGRITY.md']
    const sections: string[] = []
    for (const file of files) {
      const filePath = join(bootstrapDir, file)
      if (existsSync(filePath)) {
        sections.push(readFileSync(filePath, 'utf-8').trim())
      }
    }
    return sections.length > 0 ? sections.join('\n\n---\n\n') : null
  })

  registerSection('doing_tasks', async () => DOING_TASKS)
  registerSection('tone', async () => TONE)

  // 动态段（首次加载后缓存，/clear 时重置）
  registerSection('env_info', (ctx) => loadEnvInfo(ctx))
  registerSection('workspace', (ctx) => loadWorkspaceSection(ctx))
  registerVolatileSection('git_status', (ctx) => loadGitStatus(ctx.cwd))

  // CLAUDE.md 加载已禁用 - 投资领域规则已内置在 promptSections.ts
  // 如需启用通用开发规范，设置环境变量 LOAD_CLAUDE_MD=1
  if (process.env.LOAD_CLAUDE_MD === '1') {
    registerSection('claude_md', (ctx) => loadClaudeMd(ctx.cwd))
  }

  registerSection('memory', async () => MEMORY_SYSTEM_INSTRUCTIONS)
  registerSection('snip_nudge', async () => SNIP_NUDGE)

  // volatile 段（每轮重新执行）
  // Portfolio P&L — injected every turn so the AI always knows profit/loss status
  registerVolatileSection('portfolio_pnl', async (ctx) => {
    const portfolioPath = join(ctx.cwd, '.pi', 'portfolio.json')
    if (!existsSync(portfolioPath)) return null

    try {
      const snapshot = await callPython('manage_portfolio', { action: 'get_with_pnl' })
      if (!snapshot || snapshot.error || !snapshot.holdings) return null
      return formatPnlSection(snapshot)
    } catch {
      return null // Silently skip if Python bridge fails
    }
  })

  registerVolatileSection('plan_mode', async (ctx) =>
    ctx.isPlanMode ? PLAN_MODE_SECTION : null,
  )
}

export async function getSystemPrompt(ctx: SectionContext): Promise<string> {
  return resolveSystemPrompt(ctx)
}

function formatPnlSection(snapshot: {
  holdings: Array<{
    symbol: string
    name?: string
    quantity: number
    avg_cost: number
    current_price: number
    pnl_amount: number
    pnl_pct: number
  }>
  total_cost: number
  total_value: number
  total_pnl: number
  total_pnl_pct: number
  as_of: string
}): string {
  const lines: string[] = ['<portfolio_pnl>']
  lines.push(`持仓盈亏（实时）:`)
  lines.push(
    `总市值: ¥${snapshot.total_value.toLocaleString()} | 总成本: ¥${snapshot.total_cost.toLocaleString()} | 总盈亏: ${snapshot.total_pnl >= 0 ? '+' : ''}¥${snapshot.total_pnl.toLocaleString()} (${snapshot.total_pnl_pct >= 0 ? '+' : ''}${snapshot.total_pnl_pct.toFixed(1)}%)`,
  )
  lines.push('')

  for (const h of snapshot.holdings) {
    const pnlSign = h.pnl_pct >= 0 ? '+' : ''
    lines.push(
      `${h.symbol} ${h.name ?? ''}  ${h.quantity}股  成本${h.avg_cost}  现价${h.current_price}  ${pnlSign}${h.pnl_amount.toFixed(0)} (${pnlSign}${h.pnl_pct.toFixed(1)}%)`,
    )
  }

  lines.push('')
  lines.push(`更新: ${snapshot.as_of}`)
  lines.push('</portfolio_pnl>')
  return lines.join('\n')
}

export { clearSectionCache }
export type { SectionContext }
