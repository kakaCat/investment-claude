/**
 * 投资工具 — 全部独立工具（对标 pi-investment 的分离式工具架构）
 *
 * 每个功能是独立的 buildTool，有自己的名称、参数、描述。
 * 与旧版 InvestmentTool（单体工具 + function 枚举）的区别：
 * - 无 is_error 包装：Python 错误以原始 JSON 字符串返回，模型当普通文本处理
 * - 无 JSON.parse → JSON.stringify 循环：callPython 返回原始字符串直接透传
 * - 市场检测：A股专用工具在 TS 层拦截港股代码
 * - 写操作权限：交易/持仓管理需要用户确认
 */
import React from 'react'
import { Text, Box } from 'ink'
import { buildTool, type Tool, type ToolDef, type ToolResult } from '../../Tool.js'
import { callPython, detectMarket, requireAshare } from './core.js'
import type { PermissionDecision } from '../../permissions/types.js'

// ===== 工具工厂 ==============================================================

interface PyToolConfig {
  name: string
  description: string
  inputSchema: {
    properties: Record<string, { type: string; description: string; items?: { type: string } }>
    required: string[]
  }
  pyFunc: string
  buildArgs?: (input: Record<string, unknown>) => Record<string, unknown>
  requireAshare?: boolean
  askConfirm?: (input: Record<string, unknown>) => string | undefined
}

function pyToolDef(config: PyToolConfig): ToolDef {
  const readOnly = !config.askConfirm
  return {
    name: config.name,
    description: config.description,
    inputSchema: { type: 'object', properties: config.inputSchema.properties, required: config.inputSchema.required },

    isReadOnly: () => readOnly,

    checkPermissions: config.askConfirm
      ? (input: Record<string, unknown>): PermissionDecision => {
          const msg = config.askConfirm!(input)
          if (msg === undefined || msg === null) return { behavior: 'allow' }
          return { behavior: 'ask', message: String(msg) }
        }
      : undefined,

    async call(input: Record<string, unknown>): Promise<ToolResult<string>> {
      // A股校验
      if (config.requireAshare && input.symbol) {
        const err = requireAshare(String(input.symbol))
        if (err) return { data: err }
      }
      // 市场自适应（A/HK 共用工具）
      if (config.pyFunc === '_adaptive_price') {
        const market = detectMarket(String(input.symbol))
        if (market === 'invalid') {
          return { data: JSON.stringify({ error: `不支持的股票代码 "${input.symbol}"` }) }
        }
        const pyFn = market === 'hk' ? 'get_hk_stock_price' : 'get_stock_realtime_price'
        const result = await callPython(pyFn, { symbol: input.symbol })
        return { data: result }
      }
      if (config.pyFunc === '_adaptive_info') {
        const market = detectMarket(String(input.symbol))
        if (market === 'invalid') {
          return { data: JSON.stringify({ error: `不支持的股票代码 "${input.symbol}"` }) }
        }
        const pyFn = market === 'hk' ? 'get_hk_stock_info' : 'get_stock_info'
        const result = await callPython(pyFn, { symbol: input.symbol })
        return { data: result }
      }
      if (config.pyFunc === '_adaptive_history') {
        const market = detectMarket(String(input.symbol))
        if (market === 'invalid') {
          return { data: JSON.stringify({ error: `不支持的股票代码 "${input.symbol}"` }) }
        }
        const pyFn = market === 'hk' ? 'get_hk_stock_history' : 'get_stock_history'
        const args = config.buildArgs ? config.buildArgs(input) : input
        const result = await callPython(pyFn, args as Record<string, unknown>)
        return { data: result }
      }
      const args = config.buildArgs ? config.buildArgs(input) : input
      const result = await callPython(config.pyFunc, args as Record<string, unknown>)
      return { data: result }
    },

    mapToolResultToToolResultBlockParam(data: string, toolUseId: string) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: data,
      }
    },

    renderToolResultMessage(data: string) {
      // 尝试解析 JSON 并格式化显示
      try {
        const parsed = JSON.parse(data)

        // 错误情况
        if (parsed.error) {
          return <Text color="red">{parsed.error}</Text>
        }

        // 限制显示长度 - 超过 500 字符截断
        const jsonStr = JSON.stringify(parsed, null, 2)
        if (jsonStr.length > 500) {
          const preview = jsonStr.slice(0, 500)
          const lines = preview.split('\n')
          return (
            <Box flexDirection="column">
              {lines.slice(0, 8).map((line, i) => (
                <Text key={i} color="gray" dimColor>{line}</Text>
              ))}
              <Text color="gray" dimColor italic>... ({jsonStr.length} chars total)</Text>
            </Box>
          )
        }

        // 正常显示
        return (
          <Box flexDirection="column">
            {jsonStr.split('\n').map((line, i) => (
              <Text key={i} color="gray" dimColor>{line}</Text>
            ))}
          </Box>
        )
      } catch {
        // JSON 解析失败，显示原始文本（截断）
        const preview = data.length > 300 ? data.slice(0, 300) + '...' : data
        return <Text color="gray" dimColor>{preview}</Text>
      }
    },
  }
}

function buildPyTool(config: PyToolConfig): Tool {
  return buildTool(pyToolDef(config))
}

// =====📈 行情 ================================================================

export const GetStockPriceTool = buildPyTool({
  name: 'get_stock_price',
  description:
    '获取股票实时行情：当前价、涨跌幅、最高/最低、成交量、PE、PB、市值。' +
    '支持A股（6位代码）和港股（1-5位代码）。' +
    '始终用此工具获取实时价格，不要依赖训练数据中的过期价格。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '股票代码，如 "600519" 或 "9988"' },
    },
    required: ['symbol'],
  },
  pyFunc: '_adaptive_price',
})

export const GetStockInfoTool = buildPyTool({
  name: 'get_stock_info',
  description:
    '获取股票基本信息：公司名、行业、PE、PB、市值、上市日期。' +
    '支持A股和港股。分析任何股票前先调用此工具了解基本面。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '股票代码' },
    },
    required: ['symbol'],
  },
  pyFunc: '_adaptive_info',
})

export const GetStockHistoryTool = buildPyTool({
  name: 'get_stock_history',
  description:
    '获取历史K线数据（开高低收量），默认最近60个交易日。' +
    '支持A股和港股。用于趋势分析和技术指标计算。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '股票代码' },
      period: { type: 'string', description: "周期: 'daily'/'weekly'/'monthly'，默认 daily" },
      count: { type: 'number', description: '返回条数，默认60，最大1000' },
    },
    required: ['symbol'],
  },
  pyFunc: '_adaptive_history',
  buildArgs: (input) => {
    const args: Record<string, unknown> = { symbol: input.symbol }
    if (input.period) args.period = input.period
    if (input.count) args.count = input.count
    return args
  },
})

// ===== 💰 财务 ================================================================

export const GetFinancialDataTool = buildPyTool({
  name: 'get_financial_data',
  description:
    '获取最近4个季度的关键财务指标：ROE、毛利率、净利率、负债率、流动比率。' +
    '用于快速盈利能力筛选。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_financial_indicators',
  requireAshare: true,
})

export const GetFinancialStatementsTool = buildPyTool({
  name: 'get_financial_statements',
  description: '获取完整财务报表（利润表+资产负债表+现金流），最近8个报告期。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_financial_statements',
  requireAshare: true,
})

export const GetBalanceSheetTool = buildPyTool({
  name: 'get_balance_sheet',
  description: '获取资产负债表：总资产、总负债、股东权益等。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_balance_sheet',
  requireAshare: true,
})

export const GetIncomeStatementTool = buildPyTool({
  name: 'get_income_statement',
  description: '获取利润表：营业收入、营业成本、净利润等。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_income_statement',
  requireAshare: true,
})

export const GetCashFlowTool = buildPyTool({
  name: 'get_cash_flow',
  description: '获取现金流量表：经营/投资/筹资现金流。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_cash_flow',
  requireAshare: true,
})

export const GetHkFinancialsTool = buildPyTool({
  name: 'get_hk_financials',
  description: '获取港股完整财务数据（利润表+资产负债表）。仅支持港股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '港股代码，如 "00700"' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_hk_financials',
})

// =====📊 技术分析 =============================================================

export const AnalyzeTechnicalTool = buildPyTool({
  name: 'analyze_technical',
  description:
    '计算技术指标：MA(5/10/20/60)、MACD、RSI-14、布林带。' +
    '返回趋势判断和多空信号。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'calculate_technical_indicators',
  requireAshare: true,
})

export const AnalyzePriceActionTool = buildPyTool({
  name: 'analyze_price_action',
  description: '深度技术分析：趋势判断、支撑/阻力位、K线形态信号。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'analyze_price_action',
  requireAshare: true,
})

export const GetBuyRangeTool = buildPyTool({
  name: 'get_buy_range',
  description:
    '基于MA20/MA60/20日低点/布林下轨计算买入区间、止损位、目标价。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
      current_price: { type: 'number', description: '当前价格（可选，不传则自动获取）' },
    },
    required: ['symbol'],
  },
  pyFunc: 'calculate_buy_range',
  requireAshare: true,
})

// ===== 💎 估值 ================================================================

export const GetValuationTool = buildPyTool({
  name: 'get_valuation',
  description: '获取估值状态：PE/PB/PS及其行业分位。用于判断高估/低估。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_stock_valuation',
  requireAshare: true,
})

export const GetPePercentileTool = buildPyTool({
  name: 'get_pe_percentile',
  description: '获取PE历史分位数（默认5年），判断当前估值在历史中的位置。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
      years: { type: 'number', description: '回溯年数，默认5' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_pe_percentile',
  requireAshare: true,
})

export const GetQualityScoreTool = buildPyTool({
  name: 'get_quality_score',
  description: '获取质量评分（0-100），基于盈利能力、成长性、稳定性综合评估。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_quality_score',
  requireAshare: true,
})

export const GetExitPlanTool = buildPyTool({
  name: 'get_exit_plan',
  description: '基于买入价计算退出策略：目标价、止损位、仓位建议。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
      buy_price: { type: 'number', description: '买入均价' },
      shares: { type: 'number', description: '持仓股数（默认100）' },
    },
    required: ['symbol', 'buy_price'],
  },
  pyFunc: 'get_exit_plan',
  requireAshare: true,
})

// ===== 🌐 市场 ================================================================

export const GetMarketOverviewTool = buildPyTool({
  name: 'get_market_overview',
  description: '获取主要指数概况：上证、深证、创业板。用于判断整体市场情绪。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'get_market_overview',
})

export const GetSectorFundFlowTool = buildPyTool({
  name: 'get_sector_fund_flow',
  description: '获取板块资金流向：各行业主力资金净流入/流出。用于识别热门板块。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'get_sector_fund_flow',
})

export const GetStockFundFlowTool = buildPyTool({
  name: 'get_stock_fund_flow',
  description: '获取个股资金流向：主力/散户/机构资金进出。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_stock_fund_flow',
  requireAshare: true,
})

export const GetNorthFlowTool = buildPyTool({
  name: 'get_north_flow',
  description: '获取北向资金流向：外资通过沪深港通买卖A股的情况。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'get_north_flow',
})

export const GetHotStocksTool = buildPyTool({
  name: 'get_hot_stocks',
  description: '获取热门股票：按成交额/换手率排序的最活跃个股。',
  inputSchema: {
    properties: {
      market: { type: 'string', description: "市场: 'A股'（默认）" },
    },
    required: [],
  },
  pyFunc: 'get_hot_stocks',
})

// =====📰 新闻 ================================================================

export const GetStockNewsTool = buildPyTool({
  name: 'get_stock_news',
  description: '获取个股相关新闻。用于了解近期催化剂、政策变化和市场情绪。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
      num: { type: 'number', description: '返回条数，默认10' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_stock_news',
  requireAshare: true,
})

export const GetMarketNewsTool = buildPyTool({
  name: 'get_market_news',
  description: '获取市场要闻。用于了解市场驱动因素和宏观动态。',
  inputSchema: {
    properties: {
      num: { type: 'number', description: '返回条数，默认20' },
    },
    required: [],
  },
  pyFunc: 'get_market_news',
})

export const GetAnnouncementsTool = buildPyTool({
  name: 'get_announcements',
  description: '获取公司公告（官方披露）。用于检查重大事项。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_announcements',
  requireAshare: true,
})

// ===== 🔍 选股 ================================================================

export const GetSectorListTool = buildPyTool({
  name: 'get_sector_list',
  description:
    '列出所有A股行业板块。使用 screen_stocks 前先调用此工具确认准确的板块名称。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'get_sector_list',
})

export const ScreenStocksTool = buildPyTool({
  name: 'screen_stocks',
  description:
    '按行业板块选股，按市值降序排列。可选PE过滤。用于在特定行业寻找投资标的。',
  inputSchema: {
    properties: {
      sector: { type: 'string', description: '行业板块名，如 "白酒"、"银行"' },
      max_pe: { type: 'number', description: 'PE上限过滤' },
      limit: { type: 'number', description: '返回条数，默认20' },
    },
    required: ['sector'],
  },
  pyFunc: 'screen_stocks_by_sector',
})

export const ScreenStocksQualityTool = buildPyTool({
  name: 'screen_stocks_quality',
  description:
    '板块选股+质量评分一步完成：按行业筛选并自动打分排序。' +
    '返回每只股票的：代码、名称、PE、价格、质量分(0-100)、等级、ROE、负债率、毛利率。',
  inputSchema: {
    properties: {
      sector: { type: 'string', description: '行业板块名' },
      min_score: { type: 'number', description: '最低质量分，默认50' },
      max_pe: { type: 'number', description: 'PE上限' },
      limit: { type: 'number', description: '返回条数，默认10' },
    },
    required: ['sector'],
  },
  pyFunc: 'screen_stocks_quality',
})

export const GetConceptStocksTool = buildPyTool({
  name: 'get_concept_stocks',
  description:
    '获取概念板块成分股。用于主题投资（如AI、芯片、新能源）。' +
    '概念名需用中文精确匹配。',
  inputSchema: {
    properties: {
      concept: { type: 'string', description: '概念名，如 "人工智能"' },
    },
    required: ['concept'],
  },
  pyFunc: 'get_concept_stocks',
})

// ===== 🏢 机构数据 ============================================================

export const GetLhbTool = buildPyTool({
  name: 'get_lhb',
  description:
    '获取龙虎榜数据：大额交易席位买卖明细。' +
    '可按个股/日期/近一月查询。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '可选：6位A股代码' },
      date: { type: 'string', description: '可选：日期 YYYYMMDD' },
      period: { type: 'string', description: "可选：'近一月'" },
    },
    required: [],
  },
  pyFunc: 'get_lhb',
})

export const GetFundHoldingsTool = buildPyTool({
  name: 'get_fund_holdings',
  description: '获取基金持仓数据：哪些基金持有该股票及持仓比例。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '股票代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_fund_holdings',
})

export const GetTopHoldersTool = buildPyTool({
  name: 'get_top_holders',
  description: '获取前十大股东及持股比例。用于分析股权结构。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '股票代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_top_holders',
})

export const GetHolderChangesTool = buildPyTool({
  name: 'get_holder_changes',
  description: '获取股东户数变化趋势。用于判断散户参与度。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_holder_changes',
  requireAshare: true,
})

export const GetMarginDataTool = buildPyTool({
  name: 'get_margin_data',
  description: '获取融资融券数据：融资买入/偿还余额。用于判断杠杆情绪。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_margin_data',
  requireAshare: true,
})

export const GetInsiderTradesTool = buildPyTool({
  name: 'get_insider_trades',
  description: '获取内部人交易：董事/高管买卖记录。用于判断内部人信心。仅支持A股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '6位A股代码' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_insider_trades',
  requireAshare: true,
})

// =====📉 宏观 ================================================================

export const GetMacroDataTool = buildPyTool({
  name: 'get_macro_data',
  description: '获取宏观经济指标：PMI、CPI、GDP等。用于判断经济周期位置。',
  inputSchema: {
    properties: {
      indicators: {
        type: 'array',
        description: "指标列表，如 ['pmi', 'cpi', 'gdp']",
        items: { type: 'string' },
      },
    },
    required: [],
  },
  pyFunc: 'get_macro_data',
})

export const GetMoneySupplyTool = buildPyTool({
  name: 'get_money_supply',
  description: '获取货币供应量数据：M0/M1/M2增速。用于判断流动性环境。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'get_money_supply',
})

export const GetGdpDataTool = buildPyTool({
  name: 'get_gdp_data',
  description: '获取GDP数据：总量及分项增速。用于经济周期分析。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'get_gdp_data',
})

export const GetSocialFinanceTool = buildPyTool({
  name: 'get_social_finance',
  description: '获取社会融资规模数据。用于判断信用周期。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'get_social_finance',
})

// ===== 🇭🇰 港股专用 ==========================================================

export const GetHkAnalysisTool = buildPyTool({
  name: 'get_hk_analysis',
  description: '港股一站式分析：基本面+技术面+估值。仅支持港股。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '港股代码，如 "00700"' },
    },
    required: ['symbol'],
  },
  pyFunc: 'get_hk_analysis',
})

// ===== 💼 组合管理 ============================================================

export const ManagePortfolioTool = buildPyTool({
  name: 'manage_portfolio',
  description:
    '管理投资组合：查看/添加/删除/更新持仓。' +
    'action: get(get_with_pnl) / add / remove / update',
  inputSchema: {
    properties: {
      action: { type: 'string', description: "get / get_with_pnl / add / remove / update" },
      symbol: { type: 'string', description: '股票代码' },
      name: { type: 'string', description: '股票名称' },
      market: { type: 'string', description: "市场: 'A股' / '港股'" },
      quantity: { type: 'number', description: '持仓数量' },
      avg_cost: { type: 'number', description: '持仓均价' },
      notes: { type: 'string', description: '备注' },
    },
    required: ['action'],
  },
  pyFunc: 'manage_portfolio',
  askConfirm: (input) => {
    const { action, symbol, name, quantity, avg_cost } = input
    if (action === 'add') return `确认添加持仓：${name || symbol} ${quantity}股 均价¥${avg_cost}？`
    if (action === 'remove') return `确认删除持仓：${name || symbol}？`
    if (action === 'update') return `确认更新持仓：${name || symbol}？`
    return undefined
  },
})

export const ManageWatchlistTool = buildPyTool({
  name: 'manage_watchlist',
  description:
    '管理股票关注列表：查看/添加/删除/更新。' +
    'pool: A(核心) / B(候选) / C(研究)',
  inputSchema: {
    properties: {
      action: { type: 'string', description: "list / add / remove / update" },
      symbol: { type: 'string', description: '股票代码' },
      name: { type: 'string', description: '股票名称' },
      market: { type: 'string', description: "市场" },
      pool: { type: 'string', description: "A / B / C" },
      reason: { type: 'string', description: '关注理由' },
    },
    required: ['action'],
  },
  pyFunc: 'manage_watchlist',
  askConfirm: (input) => {
    const { action, symbol, name } = input
    if (action === 'add') return `确认添加关注：${name || symbol}？`
    if (action === 'remove') return `确认移除关注：${name || symbol}？`
    if (action === 'update') return `确认更新关注：${name || symbol}？`
    return undefined
  },
})

export const ManageTradeLogTool = buildPyTool({
  name: 'manage_trade_log',
  description: '管理交易日志：查看/创建/追加单只股票的交易记录。',
  inputSchema: {
    properties: {
      action: { type: 'string', description: "list / read / create / append" },
      symbol: { type: 'string', description: '股票代码' },
      name: { type: 'string', description: '股票名称' },
      content: { type: 'string', description: '日志内容' },
    },
    required: ['action'],
  },
  pyFunc: 'manage_trade_log',
  askConfirm: (input) => {
    const { action, symbol, name } = input
    if (action === 'create') return `确认创建交易日志：${name || symbol}？`
    if (action === 'append') return `确认追加交易记录：${name || symbol}？`
    return undefined
  },
})

export const DailyReviewTool = buildPyTool({
  name: 'daily_review',
  description: '每日复盘：生成/查看持仓复盘报告。',
  inputSchema: {
    properties: {
      action: { type: 'string', description: "generate / read / list" },
      date: { type: 'string', description: '日期 YYYY-MM-DD' },
    },
    required: ['action'],
  },
  pyFunc: 'daily_review',
  askConfirm: (input) => {
    if (input.action === 'generate') return '确认生成本日复盘报告？'
    return undefined
  },
})

export const ManageCashTool = buildPyTool({
  name: 'manage_cash',
  description: '管理可用资金余额。',
  inputSchema: {
    properties: {
      action: { type: 'string', description: "get / update" },
      amount: { type: 'number', description: '金额（update时必填）' },
      reason: { type: 'string', description: '变动原因' },
    },
    required: ['action'],
  },
  pyFunc: 'manage_cash',
  askConfirm: (input) => {
    if (input.action === 'update') return `确认更新可用资金为 ¥${input.amount}？`
    return undefined
  },
})

// ===== 💰 模拟交易 ===========================================================

export const GetAccountInfoTool = buildPyTool({
  name: 'get_account_info',
  description: '获取模拟账户信息：可用资金、总资产、市值、仓位比例。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'get_account_info',
})

export const GetPositionsTool = buildPyTool({
  name: 'get_positions',
  description: '获取当前持仓列表：股票、成本、现价、盈亏。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'get_positions',
})

export const GetOrdersTool = buildPyTool({
  name: 'get_orders',
  description: '获取订单历史：可按状态筛选 pending/filled/cancelled/rejected。',
  inputSchema: {
    properties: {
      status: { type: 'string', description: '订单状态筛选' },
    },
    required: [],
  },
  pyFunc: 'get_orders',
})

export const PlaceOrderTool = buildPyTool({
  name: 'place_order',
  description:
    '⚠️ 模拟交易 — 无真实资金。下单买卖股票。' +
    '需100股整数倍。T+1规则：当日买入次日可卖。' +
    '风险控制：单只≤30%，总仓位≤90%。',
  inputSchema: {
    properties: {
      symbol: { type: 'string', description: '股票代码' },
      name: { type: 'string', description: '股票名称' },
      direction: { type: 'string', description: "'buy' 或 'sell'" },
      price: { type: 'number', description: '委托价格' },
      quantity: { type: 'number', description: '数量（100的整数倍）' },
      current_price: { type: 'number', description: '当前市价' },
    },
    required: ['symbol', 'name', 'direction', 'price', 'quantity', 'current_price'],
  },
  pyFunc: 'place_order',
  askConfirm: (input) => {
    const { direction, name, symbol, price, quantity } = input
    const dirLabel = direction === 'buy' ? '买入' : '卖出'
    const amount = Number(price) * Number(quantity)
    return `确认${dirLabel}：${name}(${symbol}) ${quantity}股 @¥${price} ≈ ¥${amount}？(模拟交易)`
  },
})

export const CancelOrderTool = buildPyTool({
  name: 'cancel_order',
  description: '撤销未成交订单。已成交的订单不可撤销。',
  inputSchema: {
    properties: {
      order_id: { type: 'string', description: '订单ID' },
    },
    required: ['order_id'],
  },
  pyFunc: 'cancel_order',
  askConfirm: (input) => `确认撤销订单 ${input.order_id}？`,
})

export const UpdateT1AvailableTool = buildPyTool({
  name: 'update_t1_available',
  description: '更新T+1可卖数量（每日自动执行）。',
  inputSchema: {
    properties: {},
    required: [],
  },
  pyFunc: 'update_t1_available',
})

export const ResetAccountTool = buildPyTool({
  name: 'reset_account',
  description: '重置模拟账户到初始状态（清空持仓和订单）。',
  inputSchema: {
    properties: {
      initial_cash: { type: 'number', description: '初始资金，默认100万' },
    },
    required: [],
  },
  pyFunc: 'reset_account',
  askConfirm: () => '确认重置模拟账户？所有持仓和订单将被清除。',
})

export const GetRiskAlertsTool = buildPyTool({
  name: 'get_risk_alerts',
  description: '获取持仓风险警报：止损（亏损超阈值）和止盈提醒。',
  inputSchema: {
    properties: {
      stop_loss_pct: { type: 'number', description: '止损阈值%，默认-15' },
      take_profit_pct: { type: 'number', description: '止盈阈值%，默认30' },
    },
    required: [],
  },
  pyFunc: 'get_risk_alerts',
})

export const SyncPortfolioRiskAlertsTool = buildPyTool({
  name: 'sync_portfolio_risk_alerts',
  description: '从真实持仓(.pi/portfolio.json)获取风险警报。',
  inputSchema: {
    properties: {
      stop_loss_pct: { type: 'number', description: '止损阈值%' },
      take_profit_pct: { type: 'number', description: '止盈阈值%' },
    },
    required: [],
  },
  pyFunc: 'sync_portfolio_risk_alerts',
})

export const AutoDecisionLogTool = buildPyTool({
  name: 'auto_decision_log',
  description: '自动记录投资决策到 .pi/decision-log.md。每次买入/卖出/持有决策都应记录。',
  inputSchema: {
    properties: {
      action: { type: 'string', description: "buy / sell / hold / avoid" },
      symbol: { type: 'string', description: '股票代码' },
      name: { type: 'string', description: '股票名称' },
      price: { type: 'number', description: '决策时价格' },
      quantity: { type: 'number', description: '数量' },
      rationale: { type: 'string', description: '决策理由' },
    },
    required: ['action', 'symbol', 'name', 'price'],
  },
  pyFunc: 'auto_decision_log',
  askConfirm: (input) => {
    const actionLabels: Record<string, string> = { buy: '买入', sell: '卖出', hold: '持有', avoid: '回避' }
    return `确认记录决策：${actionLabels[String(input.action)] || input.action} ${input.name}(${input.symbol}) @¥${input.price}？`
  },
})

export const VerifyPastDecisionsTool = buildPyTool({
  name: 'verify_past_decisions',
  description: '验证N天前的决策：对比当时价格与现价，输出正确/偏差判断。用于自我复盘。',
  inputSchema: {
    properties: {
      days_ago: { type: 'number', description: '回溯天数，默认7' },
    },
    required: [],
  },
  pyFunc: 'verify_past_decisions',
})

// ===== 全部工具列表 ==========================================================

export const allInvestTools: Tool[] = [
  //📈 行情
  GetStockPriceTool,
  GetStockInfoTool,
  GetStockHistoryTool,
  // 💰 财务
  GetFinancialDataTool,
  GetFinancialStatementsTool,
  GetBalanceSheetTool,
  GetIncomeStatementTool,
  GetCashFlowTool,
  GetHkFinancialsTool,
  //📊 技术分析
  AnalyzeTechnicalTool,
  AnalyzePriceActionTool,
  GetBuyRangeTool,
  // 💎 估值
  GetValuationTool,
  GetPePercentileTool,
  GetQualityScoreTool,
  GetExitPlanTool,
  // 🌐 市场
  GetMarketOverviewTool,
  GetSectorFundFlowTool,
  GetStockFundFlowTool,
  GetNorthFlowTool,
  GetHotStocksTool,
  //📰 新闻
  GetStockNewsTool,
  GetMarketNewsTool,
  GetAnnouncementsTool,
  // 🔍 选股
  GetSectorListTool,
  ScreenStocksTool,
  ScreenStocksQualityTool,
  GetConceptStocksTool,
  // 🏢 机构数据
  GetLhbTool,
  GetFundHoldingsTool,
  GetTopHoldersTool,
  GetHolderChangesTool,
  GetMarginDataTool,
  GetInsiderTradesTool,
  //📉 宏观
  GetMacroDataTool,
  GetMoneySupplyTool,
  GetGdpDataTool,
  GetSocialFinanceTool,
  // 🇭🇰 港股专用
  GetHkAnalysisTool,
  // 💼 组合管理
  ManagePortfolioTool,
  ManageWatchlistTool,
  ManageTradeLogTool,
  DailyReviewTool,
  ManageCashTool,
  // 💰 模拟交易
  GetAccountInfoTool,
  GetPositionsTool,
  GetOrdersTool,
  PlaceOrderTool,
  CancelOrderTool,
  UpdateT1AvailableTool,
  ResetAccountTool,
  GetRiskAlertsTool,
  SyncPortfolioRiskAlertsTool,
  AutoDecisionLogTool,
  VerifyPastDecisionsTool,
]
