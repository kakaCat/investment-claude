# PI-Investment 迁移实施补充文档

> 配套文档: 2026-05-15-pi-investment-migration-design.md
> 本文档提供详细的代码示例和实施步骤

---

## Phase 2 实施细节（续）

### 核心模块移植示例

**evolution-service.ts 完整实现**

```typescript
import type { ToolUseContext } from '../../Tool.js'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { calculateGap, attributeGap } from './comparator.js'
import { generateOptimizationSuggestions } from './compensator.js'
import { executeOptimizationSuggestions } from './evolution-executor.js'
import { generateEvolutionReport, formatReportAsMarkdown } from './evolution-reporter.js'
import { saveEvolutionHistory, loadRecentEvolutions } from './evolution-history.js'

const PI_DIR = join(process.cwd(), '.pi')
const DEFAULT_TARGET_RETURN = 10

export interface EvolutionConfig {
  targetReturn?: number
  tradeWindowDays?: number
  reviewWindowCount?: number
  evolutionWindowRecent?: number
}

const DEFAULT_CONFIG: Required<EvolutionConfig> = {
  targetReturn: 10,
  tradeWindowDays: 90,
  reviewWindowCount: 10,
  evolutionWindowRecent: 3,
}

interface Trade {
  date: string
  action: 'buy' | 'sell'
  symbol: string
  name: string
  quantity: number
  price: number
  amount: number
}

interface Holding {
  symbol: string
  name: string
  quantity: number
  avg_cost: number
  total_invested: number
}

export interface EvolutionResult {
  reportPath: string
  report: any
  executionResultPath?: string
  summary: {
    targetReturn: number
    realizedReturn: number
    winRate: number
    totalTrades: number
    attribution: string
    strategyLevel: string
    suggestionCount: number
    appliedCount: number
    manualTaskCount: number
  }
}

function loadJson<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) return null
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function loadPortfolio(): Holding[] {
  const data = loadJson<{ holdings: Holding[] }>(join(PI_DIR, 'portfolio.json'))
  return data?.holdings ?? []
}

function loadTrades(): Trade[] {
  const data = loadJson<{ trades: Trade[] }>(join(PI_DIR, 'trades.json'))
  return data?.trades ?? []
}

function filterTradesByWindow(trades: Trade[], windowDays?: number): Trade[] {
  if (!windowDays) return trades

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - windowDays)
  const cutoffStr = cutoffDate.toISOString().split('T')[0]

  return trades.filter(t => t.date >= cutoffStr)
}

function calcRealizedPnL(trades: Trade[]): {
  totalRealizedPnL: number
  totalInvested: number
  realizedReturn: number
  winCount: number
  lossCount: number
  winRate: number
} {
  const buyQueue: Array<{ symbol: string; quantity: number; price: number }> = []
  let totalPnL = 0
  let totalInvested = 0
  let winCount = 0
  let lossCount = 0

  for (const trade of trades) {
    if (trade.action === 'buy') {
      buyQueue.push({
        symbol: trade.symbol,
        quantity: trade.quantity,
        price: trade.price,
      })
      totalInvested += trade.amount
    } else if (trade.action === 'sell') {
      let remainingQty = trade.quantity
      while (remainingQty > 0 && buyQueue.length > 0) {
        const buy = buyQueue[0]
        if (buy.symbol !== trade.symbol) {
          buyQueue.shift()
          continue
        }

        const matchQty = Math.min(remainingQty, buy.quantity)
        const pnl = (trade.price - buy.price) * matchQty
        totalPnL += pnl

        if (pnl > 0) winCount++
        else if (pnl < 0) lossCount++

        buy.quantity -= matchQty
        remainingQty -= matchQty

        if (buy.quantity === 0) {
          buyQueue.shift()
        }
      }
    }
  }

  const realizedReturn = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const totalClosedTrades = winCount + lossCount
  const winRate = totalClosedTrades > 0 ? (winCount / totalClosedTrades) * 100 : 0

  return {
    totalRealizedPnL: totalPnL,
    totalInvested,
    realizedReturn,
    winCount,
    lossCount,
    winRate,
  }
}

function analyzeToolEfficiency(context: ToolUseContext) {
  const state = context.getAppState()
  const messages = state.messages || []

  const toolCalls: Array<{ tool: string; timestamp: string }> = []
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      for (const block of msg.content) {
        if (block.type === 'tool_use') {
          toolCalls.push({
            tool: block.name,
            timestamp: (msg as any).timestamp || new Date().toISOString(),
          })
        }
      }
    }
  }

  const toolStats: Record<string, { count: number; lastUsed: string }> = {}
  for (const call of toolCalls) {
    if (!toolStats[call.tool]) {
      toolStats[call.tool] = { count: 0, lastUsed: call.timestamp }
    }
    toolStats[call.tool].count++
    toolStats[call.tool].lastUsed = call.timestamp
  }

  return toolStats
}

export async function runWeeklyEvolution(
  config: EvolutionConfig = {},
  context: ToolUseContext
): Promise<EvolutionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  console.log('[进化] 开始进化分析...')
  console.log('[进化] 配置:', cfg)

  // 1. 加载数据
  const portfolio = loadPortfolio()
  const trades = loadTrades()
  const filteredTrades = filterTradesByWindow(trades, cfg.tradeWindowDays)

  console.log(`[进化] 加载交易记录: ${filteredTrades.length} 笔`)

  if (filteredTrades.length < 3) {
    throw new Error('交易记录不足（至少需要 3 笔）')
  }

  // 2. 计算指标
  const pnl = calcRealizedPnL(filteredTrades)
  const gap = calculateGap(cfg.targetReturn, pnl.realizedReturn)
  const attribution = attributeGap(gap, pnl)

  console.log(`[进化] 性能差距: ${gap.toFixed(2)}%`)
  console.log(`[进化] 归因: ${attribution.primary}`)

  // 3. 分析工具效能
  const toolEfficiency = analyzeToolEfficiency(context)

  console.log(`[进化] 工具调用统计: ${Object.keys(toolEfficiency).length} 个工具`)

  // 4. 生成优化建议
  const suggestions = await generateOptimizationSuggestions({
    gap,
    attribution,
    toolEfficiency,
    recentEvolutions: loadRecentEvolutions(cfg.evolutionWindowRecent),
  })

  console.log(`[进化] 生成优化建议: ${suggestions.length} 条`)

  // 5. 执行优化建议
  const executionResult = await executeOptimizationSuggestions(suggestions, context)

  console.log(`[进化] 执行结果: ${executionResult.appliedCount} 条已应用`)

  // 6. 生成报告
  const report = generateEvolutionReport({
    config: cfg,
    pnl,
    gap,
    attribution,
    suggestions,
    executionResult,
    toolEfficiency,
  })

  // 7. 保存报告
  const evolutionDir = join(PI_DIR, 'evolution')
  if (!existsSync(evolutionDir)) {
    mkdirSync(evolutionDir, { recursive: true })
  }

  const reportPath = join(evolutionDir, `evolution-${new Date().toISOString().split('T')[0]}.md`)
  const markdown = formatReportAsMarkdown(report)
  writeFileSync(reportPath, markdown)

  console.log(`[进化] 报告已保存: ${reportPath}`)

  // 8. 保存历史
  await saveEvolutionHistory(report)

  return {
    reportPath,
    report,
    executionResultPath: executionResult.path,
    summary: {
      targetReturn: cfg.targetReturn,
      realizedReturn: pnl.realizedReturn,
      winRate: pnl.winRate,
      totalTrades: filteredTrades.length,
      attribution: attribution.primary,
      strategyLevel: gap < 3 ? 'minor' : gap < 10 ? 'moderate' : 'major',
      suggestionCount: suggestions.length,
      appliedCount: executionResult.appliedCount,
      manualTaskCount: executionResult.manualTaskCount,
    },
  }
}
```

---

## Phase 3 实施细节

### EvolutionRunTool 完整实现

**src/tools/EvolutionRunTool/EvolutionRunTool.tsx**

```typescript
import React from 'react'
import { Text, Box } from 'ink'
import { buildTool, type ToolDef, type ToolResult } from '../../Tool.js'
import { runWeeklyEvolution } from '../../services/intelligence/evolution-service.js'

type EvolutionRunInput = {
  targetReturn?: number
  tradeWindowDays?: number
}

type EvolutionRunOutput = {
  success: boolean
  reportPath?: string
  summary?: any
  error?: string
}

const evolutionRunToolDef: ToolDef<EvolutionRunInput, EvolutionRunOutput> = {
  name: 'EvolutionRun',
  description: `Run agent evolution analysis to evaluate investment performance and generate optimization suggestions.

This tool:
- Calculates performance gap (target vs actual return)
- Performs attribution analysis (capability/execution/market)
- Analyzes tool efficiency from conversation history
- Generates optimization suggestions (tool adjustments, parameter tuning, experience updates)
- Automatically applies applicable improvements

Parameters:
- targetReturn: Target return percentage (default: 10)
- tradeWindowDays: Trade window in days (default: 90, undefined = all)

Use this when you want to review the agent's performance and evolve capabilities.`,

  inputSchema: {
    type: 'object',
    properties: {
      targetReturn: {
        type: 'number',
        description: 'Target return percentage (default: 10)',
      },
      tradeWindowDays: {
        type: 'number',
        description: 'Trade window in days (default: 90, undefined = all)',
      },
    },
    required: [],
  },

  isReadOnly: () => false,

  async call(input: EvolutionRunInput, context): Promise<ToolResult<EvolutionRunOutput>> {
    try {
      const result = await runWeeklyEvolution(input, context)

      return {
        data: {
          success: true,
          reportPath: result.reportPath,
          summary: result.summary,
        },
      }
    } catch (error) {
      return {
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: EvolutionRunOutput, toolUseId: string) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: JSON.stringify(data, null, 2),
    }
  },

  renderToolResultMessage(data: EvolutionRunOutput) {
    if (!data.success) {
      return <Text color="red">❌ 进化分析失败: {data.error}</Text>
    }

    const s = data.summary!
    return (
      <Box flexDirection="column">
        <Text color="green">✅ 进化分析完成</Text>
        <Text>📊 报告路径: {data.reportPath}</Text>
        <Text>📈 目标收益: {s.targetReturn}% | 实际收益: {s.realizedReturn.toFixed(2)}%</Text>
        <Text>🎯 胜率: {s.winRate.toFixed(1)}% | 交易次数: {s.totalTrades}</Text>
        <Text>🔍 归因: {s.attribution}</Text>
        <Text>💡 优化建议: {s.suggestionCount} 条</Text>
        {s.appliedCount > 0 && <Text>✨ 已自动应用: {s.appliedCount} 条</Text>}
        {s.manualTaskCount > 0 && <Text>⚠️  需人工处理: {s.manualTaskCount} 条</Text>}
      </Box>
    )
  },
}

export const EvolutionRunTool = buildTool(evolutionRunToolDef)
```

**src/tools/EvolutionRunTool/UI.tsx**

```typescript
import React from 'react'
import { Text, Box } from 'ink'

export function renderToolResultMessage(data: any) {
  if (!data.success) {
    return <Text color="red">❌ 进化分析失败: {data.error}</Text>
  }

  const s = data.summary
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="green" bold>✅ 进化分析完成</Text>
      <Box flexDirection="column" paddingLeft={2} paddingTop={1}>
        <Text dimColor>📊 报告路径: {data.reportPath}</Text>
        <Text>📈 目标收益: <Text color="cyan">{s.targetReturn}%</Text> | 实际收益: <Text color={s.realizedReturn >= s.targetReturn ? 'green' : 'yellow'}>{s.realizedReturn.toFixed(2)}%</Text></Text>
        <Text>🎯 胜率: <Text color="cyan">{s.winRate.toFixed(1)}%</Text> | 交易次数: <Text color="cyan">{s.totalTrades}</Text></Text>
        <Text>🔍 归因: <Text color="yellow">{s.attribution}</Text></Text>
        <Text>💡 优化建议: <Text color="cyan">{s.suggestionCount}</Text> 条</Text>
        {s.appliedCount > 0 && (
          <Text>✨ 已自动应用: <Text color="green">{s.appliedCount}</Text> 条</Text>
        )}
        {s.manualTaskCount > 0 && (
          <Text>⚠️  需人工处理: <Text color="yellow">{s.manualTaskCount}</Text> 条</Text>
        )}
      </Box>
    </Box>
  )
}
```

**src/tools/EvolutionRunTool/prompt.ts**

```typescript
export const EVOLUTION_RUN_TOOL_DESCRIPTION = `Run agent evolution analysis to evaluate investment performance and generate optimization suggestions.

This tool performs a complete evolution cycle:

1. **Performance Analysis**
   - Calculates realized return from trade history
   - Compares against target return to identify performance gap
   - Calculates win rate and trade statistics

2. **Attribution Analysis**
   - Identifies root cause of performance gap:
     * capability_insufficient: Missing tools or knowledge
     * execution_deviation: Poor decision execution
     * market_factor: External market conditions

3. **Tool Efficiency Analysis**
   - Analyzes tool usage from conversation history
   - Identifies frequently used vs rarely used tools
   - Calculates tool effectiveness metrics

4. **Optimization Suggestions**
   - Generates actionable improvement suggestions:
     * add_tool: Create new tools for missing capabilities
     * remove_tool: Remove ineffective tools
     * update_experience: Add learnings to experience database
     * update_prompt: Refine system prompts
     * adjust_parameter: Tune configuration parameters

5. **Automatic Application**
   - Automatically applies safe improvements
   - Creates manual tasks for complex changes
   - Generates detailed execution report

**When to use:**
- Weekly performance review
- After significant market events
- When performance deviates from target
- To identify capability gaps

**Parameters:**
- targetReturn: Target annual return percentage (default: 10%)
- tradeWindowDays: Number of days to analyze (default: 90, undefined = all trades)

**Output:**
- Evolution report (markdown)
- Performance summary
- Optimization suggestions
- Execution results`
```

### CRON 配置实现

**配置方式 1: 通过 REPL 命令**

```typescript
// 用户在 REPL 中执行
/cron create --cron "0 20 * * 0" --prompt "Run evolution analysis using EvolutionRun tool. Review the report and apply suggested improvements." --recurring --durable
```

**配置方式 2: 代码配置**

```typescript
// src/config/cron-tasks.ts
export const EVOLUTION_CRON_CONFIG = {
  id: 'weekly-evolution',
  schedule: '0 20 * * 0',  // 每周日 20:00
  prompt: `Run evolution analysis to review this week's investment performance.

Steps:
1. Call EvolutionRun tool with default parameters
2. Review the evolution report
3. If there are manual tasks, create a summary for the user
4. Log the completion status`,
  recurring: true,
  durable: true,
}

// src/entrypoints/cli.tsx 中初始化
import { CronCreateTool } from './tools/ScheduleCronTool/CronCreateTool.js'
import { EVOLUTION_CRON_CONFIG } from './config/cron-tasks.js'

async function initializeCronTasks(context: ToolUseContext) {
  // 检查是否已存在
  const existingTasks = await CronListTool.call({}, context)
  const hasEvolutionTask = existingTasks.data.some((t: any) => t.id === EVOLUTION_CRON_CONFIG.id)

  if (!hasEvolutionTask) {
    await CronCreateTool.call({
      cron: EVOLUTION_CRON_CONFIG.schedule,
      prompt: EVOLUTION_CRON_CONFIG.prompt,
      recurring: EVOLUTION_CRON_CONFIG.recurring,
      durable: EVOLUTION_CRON_CONFIG.durable,
    }, context)
    console.log('[CRON] Evolution task initialized')
  }
}
```

---

## 实施检查清单

### Phase 1: 工具扩展

- [ ] **TradeLogTool**
  - [ ] 实现 create/append/get/list 操作
  - [ ] 添加权限检查
  - [ ] 实现 UI 渲染
  - [ ] 编写单元测试
  - [ ] 注册到 tools/index.ts

- [ ] **OrderManagementTool**
  - [ ] 实现挂单 CRUD 操作
  - [ ] 添加自动成交检查
  - [ ] 实现 UI 渲染
  - [ ] 编写单元测试
  - [ ] 注册到 tools/index.ts

- [ ] **SectorRotationTool**
  - [ ] 实现板块资金流向分析
  - [ ] 集成 Python 数据源
  - [ ] 实现 UI 渲染
  - [ ] 编写单元测试
  - [ ] 注册到 tools/index.ts

- [ ] **StopLossCheckTool**
  - [ ] 实现止损触发检查
  - [ ] 添加通知机制
  - [ ] 实现 UI 渲染
  - [ ] 编写单元测试
  - [ ] 注册到 tools/index.ts

- [ ] **MarketSentimentTool**
  - [ ] 实现市场情绪指标计算
  - [ ] 集成多数据源
  - [ ] 实现 UI 渲染
  - [ ] 编写单元测试
  - [ ] 注册到 tools/index.ts

- [ ] **ExperienceQueryTool**
  - [ ] 实现经验库查询
  - [ ] 实现相似度匹配
  - [ ] 实现 UI 渲染
  - [ ] 编写单元测试
  - [ ] 注册到 tools/index.ts

### Phase 2: Evolution 核心

- [ ] **目录结构**
  - [ ] 创建 src/services/intelligence/
  - [ ] 创建 src/types/evolution.ts

- [ ] **Comparator（减法器）**
  - [ ] 移植 calculateGap 函数
  - [ ] 移植 attributeGap 函数
  - [ ] 编写单元测试

- [ ] **Compensator（补偿器）**
  - [ ] 移植 generateOptimizationSuggestions
  - [ ] 适配策略级别判断
  - [ ] 编写单元测试

- [ ] **Session Analyzer**
  - [ ] 实现从 AppState 读取对话历史
  - [ ] 实现工具调用链路分析
  - [ ] 实现工具效能计算
  - [ ] 编写单元测试

- [ ] **Experience Manager**
  - [ ] 移植经验库管理逻辑
  - [ ] 实现版本控制
  - [ ] 实现自动备份
  - [ ] 编写单元测试

- [ ] **Evolution Service**
  - [ ] 移植主流程逻辑
  - [ ] 适配数据加载（.pi/ 目录）
  - [ ] 集成所有子模块
  - [ ] 编写集成测试

- [ ] **Code Generator**
  - [ ] 适配到 AgentTool
  - [ ] 实现代码生成提示词
  - [ ] 实现代码提取逻辑
  - [ ] 编写单元测试

- [ ] **Sandbox Validator**
  - [ ] 实现编译验证
  - [ ] 实现单元测试验证
  - [ ] 实现集成测试验证
  - [ ] 编写单元测试

- [ ] **Evolution Executor**
  - [ ] 移植执行器逻辑
  - [ ] 实现建议分发
  - [ ] 实现回滚机制
  - [ ] 编写单元测试

- [ ] **Branch Manager**
  - [ ] 实现 Git 分支创建
  - [ ] 实现自动合并
  - [ ] 实现回滚机制
  - [ ] 编写单元测试

### Phase 3: 自动化集成

- [ ] **EvolutionRunTool**
  - [ ] 实现工具定义
  - [ ] 实现 UI 渲染
  - [ ] 编写单元测试
  - [ ] 注册到 tools/index.ts

- [ ] **CRON 配置**
  - [ ] 配置定时任务
  - [ ] 测试定时触发
  - [ ] 验证执行结果

- [ ] **端到端测试**
  - [ ] 编写完整流程测试
  - [ ] 测试错误处理
  - [ ] 测试回滚机制

- [ ] **文档**
  - [ ] 更新 README.md
  - [ ] 编写使用指南
  - [ ] 编写故障排查指南

---

## 故障排查指南

### 常见问题

**Q1: Evolution 分析失败：交易记录不足**
```
错误: 交易记录不足（至少需要 3 笔）
```
**解决方案**: 确保 `.pi/trades.json` 中至少有 3 笔交易记录。

**Q2: 工具效能分析返回空结果**
```
工具调用统计: 0 个工具
```
**解决方案**: 检查 AppState 中是否有对话历史。确保 `context.getAppState().messages` 不为空。

**Q3: 代码生成失败**
```
错误: AgentTool call failed
```
**解决方案**:
1. 检查 ANTHROPIC_API_KEY 是否配置
2. 检查网络连接
3. 检查 AgentTool 是否正确注册

**Q4: Git 分支管理失败**
```
错误: fatal: A branch named 'evolution/xxx' already exists
```
**解决方案**: 手动删除已存在的进化分支：
```bash
git branch -D evolution/xxx
```

**Q5: 权限检查失败**
```
错误: Permission denied for tool execution
```
**解决方案**:
1. 检查 checkPermissions 实现
2. 确认用户已授权写操作
3. 检查 .claude/settings.json 权限配置

---

## 性能优化建议

### 1. 缓存优化

```typescript
// 缓存交易数据计算结果
const tradeCache = new Map<string, any>()

function loadTradesWithCache(): Trade[] {
  const cacheKey = 'trades'
  if (tradeCache.has(cacheKey)) {
    return tradeCache.get(cacheKey)
  }

  const trades = loadTrades()
  tradeCache.set(cacheKey, trades)
  return trades
}
```

### 2. 并行执行

```typescript
// 并行执行独立的建议
async function executeOptimizationSuggestions(suggestions: OptimizationSuggestion[], context: ToolUseContext) {
  const independentSuggestions = suggestions.filter(s => s.autoApplicable)

  const results = await Promise.all(
    independentSuggestions.map(s => executeSuggestion(s, context))
  )

  return results
}
```

### 3. 增量分析

```typescript
// 只分析新增的对话历史
function analyzeToolEfficiencyIncremental(context: ToolUseContext, lastAnalyzedTimestamp: string) {
  const state = context.getAppState()
  const messages = state.messages.filter(m =>
    (m as any).timestamp > lastAnalyzedTimestamp
  )

  // 只分析新消息
  return analyzeMessages(messages)
}
```

---

## 总结

本补充文档提供了 PI-Investment 迁移的详细实施步骤和代码示例。通过遵循本文档的指导，可以系统地完成工具扩展和 Evolution 系统的迁移。

**关键要点**:
1. 严格遵循 investment-claude 的架构规范
2. 完整的测试覆盖确保质量
3. 渐进式迁移降低风险
4. 持续验证和优化

**下一步**:
1. 按照检查清单逐项实施
2. 遇到问题参考故障排查指南
3. 完成后更新主文档

---

**文档维护**: 请在实施过程中记录实际遇到的问题和解决方案，持续更新本文档。
