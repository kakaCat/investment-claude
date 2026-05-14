# 量化功能与 Agent 结合使用指南

## 概述

量化投资需要自动化、定时执行、数据驱动的决策能力。通过将量化策略与 Claude Agent 结合，可以实现：

1. **自动化监控** - 定时扫描市场，发现交易机会
2. **智能决策** - 基于多维度数据分析，生成交易信号
3. **风险控制** - 实时监控持仓，自动止损止盈
4. **策略回测** - 验证策略有效性
5. **通知推送** - 及时通知用户交易信号

## 核心架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户交互层                             │
│              (飞书/微信/Web界面)                          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Agent 调度层                              │
│  - 定时任务 (CronCreateTool)                             │
│  - 事件触发 (价格突破、信号生成)                          │
│  - 多 Agent 协作 (TeamCreate)                            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                量化策略层                                 │
│  - 信号生成 (技术指标、基本面筛选)                        │
│  - 风险控制 (止损、仓位管理)                              │
│  - 回测验证 (历史数据验证)                                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              数据与执行层                                 │
│  - InvestmentTool (市场数据)                             │
│  - Portfolio Management (持仓管理)                        │
│  - Notification (通知推送)                                │
└─────────────────────────────────────────────────────────┘
```

## 使用场景

### 场景 1: 每日选股 Agent

**目标**: 每天收盘后自动筛选优质股票

**实现方式**:

```typescript
// 用户设置定时任务
用户: "每天下午 3:30 帮我筛选一些优质股票"

AI: [调用 CronCreateTool]
{
  cron: "30 15 * * 1-5",  // 工作日下午 3:30
  prompt: "执行每日选股任务：\n1. 获取市场概览\n2. 筛选质量评分 >= 80 的股票\n3. 对候选股票进行技术分析\n4. 生成选股报告并推送",
  durable: true  // 持久化任务
}

// Agent 每天自动执行
Agent 执行流程:
1. 调用 get_market_overview - 判断市场环境
2. 调用 screen_stocks_quality - 筛选优质股票
3. 对每只候选股票:
   - 调用 calculate_technical_indicators - 技术分析
   - 调用 get_pe_percentile - 估值分析
   - 调用 get_stock_news - 查看最新消息
4. 生成报告并推送到飞书
```

**优势**:
- 自动化执行，无需人工干预
- 多维度分析，避免遗漏
- 定时推送，及时把握机会

### 场景 2: 持仓监控 Agent

**目标**: 实时监控持仓，触发止损/止盈

**实现方式**:

```typescript
// 用户添加持仓监控
用户: "帮我监控茅台，成本 1400，止损 1350，目标 1550"

AI: [创建监控任务]
1. 调用 manage_portfolio - 记录持仓
   {
     action: "add",
     symbol: "600519",
     quantity: 100,
     avg_cost: 1400,
     notes: "止损: 1350, 目标: 1550"
   }

2. 创建定时监控任务
   {
     cron: "*/5 9-15 * * 1-5",  // 交易时间每 5 分钟检查
     prompt: "监控持仓 600519：\n1. 获取实时价格\n2. 检查是否触发止损(1350)或止盈(1550)\n3. 如触发，立即推送通知",
     durable: true
   }

// Agent 定时执行
Agent 监控逻辑:
1. 调用 get_stock_realtime_price({symbol: "600519"})
2. 判断价格:
   - 如果 price <= 1350: 推送止损警告
   - 如果 price >= 1550: 推送止盈提醒
   - 如果 1350 < price < 1550: 继续监控
3. 记录监控日志
```

**优势**:
- 实时监控，不错过关键价位
- 自动提醒，避免情绪化决策
- 多持仓并行监控

### 场景 3: 多策略 Agent 团队

**目标**: 多个 Agent 协作，实现复杂量化策略

**实现方式**:

```typescript
// 用户启动量化团队
用户: "启动量化投资团队，帮我找到本周的交易机会"

AI: [创建 Agent 团队]
1. 创建团队
   TeamCreate({
     team_name: "quant-team",
     description: "量化投资团队 - 多策略协作"
   })

2. 创建任务列表
   TaskCreate({
     title: "市场扫描",
     description: "扫描市场，识别交易机会",
     owner: "market-scanner"
   })
   TaskCreate({
     title: "技术分析",
     description: "对候选股票进行技术分析",
     owner: "technical-analyst"
   })
   TaskCreate({
     title: "基本面验证",
     description: "验证候选股票基本面",
     owner: "fundamental-analyst"
   })
   TaskCreate({
     title: "风险评估",
     description: "评估交易风险",
     owner: "risk-manager"
   })

3. 启动 Agent 团队成员
   - Market Scanner Agent: 扫描市场，筛选候选股票
   - Technical Analyst Agent: 技术分析，判断买卖时机
   - Fundamental Analyst Agent: 基本面分析，验证投资价值
   - Risk Manager Agent: 风险控制，计算仓位和止损

// Agent 协作流程
Market Scanner:
  → 调用 get_market_overview
  → 调用 screen_stocks_quality
  → 将候选股票列表传递给 Technical Analyst

Technical Analyst:
  → 对每只股票调用 calculate_technical_indicators
  → 对每只股票调用 analyze_price_action
  → 筛选出技术面良好的股票，传递给 Fundamental Analyst

Fundamental Analyst:
  → 调用 get_financial_indicators
  → 调用 get_quality_score
  → 调用 get_pe_percentile
  → 验证基本面，传递给 Risk Manager

Risk Manager:
  → 调用 calculate_buy_range - 计算买入区间
  → 计算仓位大小（基于风险承受能力）
  → 生成最终交易建议
  → 推送给用户
```

**优势**:
- 分工明确，专业化分析
- 并行处理，提高效率
- 多维度验证，降低风险

### 场景 4: 策略回测 Agent

**目标**: 验证量化策略的历史表现

**实现方式**:

```typescript
// 用户启动回测
用户: "回测一下这个策略：买入 PE 分位数 < 20% 且 RSI < 30 的股票"

AI: [执行回测]
1. 定义回测参数
   - 回测周期: 2023-01-01 到 2024-12-31
   - 初始资金: 100万
   - 单只股票仓位: 10%
   - 止损: -8%
   - 止盈: +20%

2. 回测流程
   for date in 回测周期:
     // 每日扫描
     candidates = screen_stocks_by_criteria({
       pe_percentile_max: 20,
       rsi_max: 30
     })

     // 对每只候选股票
     for stock in candidates:
       // 获取历史数据
       history = get_stock_history({
         symbol: stock,
         start_date: date,
         end_date: date + 30天
       })

       // 模拟交易
       if 满足买入条件:
         buy(stock, 10% 仓位)

       // 检查止损止盈
       if 触发止损 or 触发止盈:
         sell(stock)

     // 记录每日收益

3. 生成回测报告
   - 总收益率: +35%
   - 年化收益率: +17.5%
   - 最大回撤: -12%
   - 胜率: 65%
   - 盈亏比: 2.1
   - 交易次数: 48
```

**优势**:
- 验证策略有效性
- 发现策略缺陷
- 优化参数设置

### 场景 5: 事件驱动 Agent

**目标**: 基于市场事件自动触发分析

**实现方式**:

```typescript
// 用户设置事件监听
用户: "当北向资金单日流入超过 100 亿时通知我"

AI: [创建事件监听]
{
  cron: "0 16 * * 1-5",  // 每天收盘后检查
  prompt: "检查北向资金流向：\n1. 调用 get_north_flow\n2. 如果单日流入 > 100亿，分析原因并推送\n3. 推荐受益板块和个股",
  durable: true
}

// Agent 执行
Agent 检测到事件:
1. 调用 get_north_flow
2. 发现单日流入 120 亿
3. 分析流入方向:
   - 调用 get_sector_fund_flow - 查看行业资金流向
   - 调用 get_lhb - 查看龙虎榜
4. 生成分析报告:
   "北向资金今日流入 120 亿，主要流入：
    - 食品饮料: +35 亿
    - 医药生物: +28 亿
    - 电子: +22 亿

    推荐关注:
    - 600519 贵州茅台 (北向持仓增加 0.5%)
    - 000858 五粮液 (北向持仓增加 0.3%)
    - 300750 宁德时代 (北向持仓增加 0.4%)"
5. 推送通知
```

**优势**:
- 及时捕捉市场变化
- 自动分析原因
- 推荐相关机会

## 实现步骤

### 第 1 步: 创建量化策略工具

创建 `src/tools/QuantStrategyTool/QuantStrategyTool.tsx`:

```typescript
// 量化策略工具 - 封装常用量化策略
export const QuantStrategyTool = buildTool({
  name: 'QuantStrategy',
  description: `Quantitative trading strategy tool.

  Available strategies:
  - value_investing: 价值投资策略 (低PE、高ROE、高股息)
  - momentum: 动量策略 (突破新高、成交量放大)
  - mean_reversion: 均值回归策略 (超跌反弹)
  - quality_growth: 质量成长策略 (高质量评分 + 成长性)

  Functions:
  - screen: 根据策略筛选股票
  - backtest: 回测策略
  - generate_signal: 生成交易信号`,

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['screen', 'backtest', 'generate_signal'],
      },
      strategy: {
        type: 'string',
        enum: ['value_investing', 'momentum', 'mean_reversion', 'quality_growth'],
      },
      params: {
        type: 'object',
        description: '策略参数',
      },
    },
    required: ['action', 'strategy'],
  },

  async call(input, context) {
    const { action, strategy, params } = input

    switch (action) {
      case 'screen':
        return await screenByStrategy(strategy, params)
      case 'backtest':
        return await backtestStrategy(strategy, params)
      case 'generate_signal':
        return await generateSignal(strategy, params)
    }
  },

  // ... 其他方法
})
```

### 第 2 步: 创建通知推送工具

创建 `src/tools/NotificationTool/NotificationTool.tsx`:

```typescript
// 通知推送工具 - 支持飞书、微信、邮件
export const NotificationTool = buildTool({
  name: 'Notification',
  description: `Send notifications to users via Feishu, WeChat, or Email.`,

  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        enum: ['feishu', 'wechat', 'email'],
      },
      title: {
        type: 'string',
        description: '通知标题',
      },
      content: {
        type: 'string',
        description: '通知内容',
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'urgent'],
        description: '优先级',
      },
    },
    required: ['channel', 'title', 'content'],
  },

  async call(input, context) {
    const { channel, title, content, priority } = input

    switch (channel) {
      case 'feishu':
        return await sendFeishuNotification(title, content, priority)
      case 'wechat':
        return await sendWechatNotification(title, content, priority)
      case 'email':
        return await sendEmailNotification(title, content, priority)
    }
  },

  // ... 其他方法
})
```

### 第 3 步: 创建量化 Agent 定义

创建 `.claude/agents/quant-scanner.md`:

```markdown
---
name: quant-scanner
description: Quantitative market scanner - finds trading opportunities
model: claude-sonnet-4-6
---

You are a quantitative market scanner agent. Your job is to:

1. Scan the market daily for trading opportunities
2. Apply quantitative strategies to filter stocks
3. Generate trading signals with entry/exit points
4. Notify users of high-quality opportunities

## Workflow

1. **Market Overview**
   - Call Investment tool: get_market_overview
   - Assess market sentiment (bullish/bearish/neutral)

2. **Stock Screening**
   - Call QuantStrategy tool: screen with selected strategy
   - Filter by quality score, valuation, technical indicators

3. **Deep Analysis**
   - For each candidate:
     - Technical analysis (trend, momentum, support/resistance)
     - Fundamental analysis (financials, valuation)
     - News sentiment
     - Risk assessment

4. **Signal Generation**
   - Generate buy/sell signals with:
     - Entry price range
     - Stop loss level
     - Target price
     - Position size recommendation
     - Risk/reward ratio

5. **Notification**
   - Call Notification tool to alert user
   - Include analysis summary and action items

## Strategy Selection

Choose strategy based on market conditions:
- Bull market → momentum, quality_growth
- Bear market → value_investing, mean_reversion
- Sideways → mean_reversion, quality_growth

## Risk Management

Always include:
- Stop loss (typically 5-8% below entry)
- Position size (max 10% per stock)
- Risk/reward ratio (minimum 2:1)
```

### 第 4 步: 使用示例

#### 示例 1: 启动每日选股

```bash
# 用户命令
用户: "每天下午 3:30 帮我扫描市场，找到交易机会"

# AI 响应
AI: 好的，我将创建一个每日市场扫描任务。

[调用 CronCreateTool]
{
  cron: "30 15 * * 1-5",
  prompt: "启动量化扫描 Agent，执行每日选股任务",
  durable: true
}

任务已创建！每个交易日下午 3:30，quant-scanner Agent 将自动：
1. 扫描市场，评估市场环境
2. 根据市场状态选择合适的量化策略
3. 筛选出符合条件的股票
4. 对候选股票进行深度分析
5. 生成交易信号并推送到飞书

您将收到包含以下信息的通知：
- 推荐股票列表
- 买入价格区间
- 止损位和目标价
- 风险评估
```

#### 示例 2: 持仓监控

```bash
# 用户命令
用户: "监控我的持仓，如果任何股票跌破止损位或达到目标价就通知我"

# AI 响应
AI: 好的，我将为您的持仓创建监控任务。

[读取持仓]
当前持仓:
- 600519 贵州茅台: 成本 1400, 止损 1350, 目标 1550
- 000858 五粮液: 成本 180, 止损 170, 目标 200

[创建监控任务]
{
  cron: "*/5 9-15 * * 1-5",  // 交易时间每 5 分钟
  prompt: "监控所有持仓，检查是否触发止损或止盈",
  durable: true
}

监控任务已启动！系统将每 5 分钟检查一次持仓状态。
如果触发止损或止盈，您将立即收到飞书通知。
```

#### 示例 3: 多策略团队

```bash
# 用户命令
用户: "启动量化团队，使用多个策略找到本周最佳交易机会"

# AI 响应
AI: 好的，我将创建一个量化投资团队，使用多策略协作。

[创建团队]
TeamCreate({
  team_name: "quant-team-week",
  description: "本周量化投资团队"
})

[创建任务]
1. 价值投资策略扫描
2. 动量策略扫描
3. 均值回归策略扫描
4. 质量成长策略扫描
5. 综合评估和排序

[启动 Agent]
- Value Scanner: 寻找低估值高质量股票
- Momentum Scanner: 寻找突破新高的强势股
- Mean Reversion Scanner: 寻找超跌反弹机会
- Quality Growth Scanner: 寻找高质量成长股

团队已启动！预计 30 分钟内完成分析。
您将收到一份综合报告，包含各策略的推荐股票。
```

## 最佳实践

### 1. 策略组合
- 不要依赖单一策略
- 根据市场环境动态调整
- 定期回测和优化

### 2. 风险控制
- 始终设置止损
- 控制单只股票仓位（≤10%）
- 分散投资（5-10 只股票）
- 保持现金储备（20-30%）

### 3. Agent 协作
- 明确分工，避免重复
- 使用任务列表协调
- 定期同步进度

### 4. 通知管理
- 设置优先级（紧急/重要/普通）
- 避免过度通知
- 关键信号立即推送

### 5. 数据质量
- 验证数据准确性
- 处理异常值
- 定期更新数据源

## 注意事项

⚠️ **重要提醒**

1. **回测偏差**: 历史表现不代表未来收益
2. **过度拟合**: 避免过度优化参数
3. **交易成本**: 考虑手续费和滑点
4. **市场变化**: 策略需要适应市场环境
5. **风险控制**: 严格执行止损，控制仓位

## 总结

量化功能与 Agent 的结合可以实现：

✅ **自动化** - 定时执行，无需人工干预
✅ **智能化** - 多维度分析，数据驱动决策
✅ **协作化** - 多 Agent 分工，提高效率
✅ **实时化** - 事件驱动，及时响应市场
✅ **可追溯** - 记录所有决策，便于优化

通过合理使用 Agent 系统，可以构建一个完整的量化投资平台！
