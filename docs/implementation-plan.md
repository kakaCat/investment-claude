# 量化投资 Agent 实施计划

> 将 investment-claude 从 coding agent 改造为量化投资 agent

**开始日期**: 2026-04-14
**预计完成**: 2026-06-01 (6-8周)

---

## 📋 改造清单

### 核心改造项

| 模块 | 当前状态 (Coding) | 目标状态 (Investment) | 优先级 |
|------|------------------|---------------------|--------|
| **系统提示词** | "你是 Pi，编程助手" | "你是投资顾问团队" | P0 |
| **工具集** | Read/Write/Edit/Bash | get_stock_price/analyze_technical | P0 |
| **Agent 定义** | general-purpose/explore/plan | market-analyst/stock-screener | P0 |
| **技能文件** | TDD/debugging/code-review | stock-screening/risk-management | P1 |
| **数据源** | 文件系统/Git | Sina/Akshare/Eastmoney | P0 |
| **输出格式** | 代码/文档 | 分析报告/交易信号 | P1 |

---

## 🎯 Phase 1: 基础框架改造 (Week 1-2)

### 1.1 改造系统提示词

**文件**: `src/constants/promptSections.ts`

**改造内容**:

```typescript
// 原来 (Coding)
export const IDENTITY = `You are Pi, an AI coding assistant...`

// 改为 (Investment)
export const IDENTITY = `You are an AI Investment Advisory Team.

You are a team of professional investment analysts working together to provide
quantitative investment advice. Your team includes:

- **Market Analyst**: Analyzes macro environment and market sentiment
- **Stock Screener**: Screens stocks based on fundamentals and valuation
- **Technical Analyst**: Analyzes technical indicators and trends
- **Risk Manager**: Manages position sizing and risk control
- **Quant Strategist**: Develops and backtests quantitative strategies
- **Portfolio Manager**: Tracks holdings and executes trades

## Your Primary Job

When a user asks about investment opportunities, you MUST:
1. Use tools to gather real-time market data
2. Analyze fundamentals, technicals, and risks
3. Generate trading signals with clear reasoning
4. Provide actionable recommendations

## Critical Rules

- ✅ Always use data and quantitative analysis
- ✅ Always check risk before recommending
- ✅ Always explain your reasoning
- ❌ Never make decisions without data
- ❌ Never recommend without risk assessment
- ❌ Never guarantee returns

## Tool Usage

- Use market data tools to get real-time prices and indicators
- Use fundamental tools to analyze financial health
- Use technical tools to identify trends and entry points
- Use risk tools to calculate position sizing
- Use portfolio tools to track holdings

## Response Format

When analyzing a stock, always provide:
1. **Quality Score** (0-100): Fundamental health
2. **Valuation Score** (0-100): Price attractiveness
3. **Technical Score** (0-100): Trend strength
4. **Risk Level** (Low/Medium/High)
5. **Recommendation** (Buy/Hold/Sell) with reasoning
6. **Position Sizing** (% of portfolio)
7. **Stop Loss** and **Take Profit** levels
`
```

**改造步骤**:
1. 备份原文件: `cp src/constants/promptSections.ts src/constants/promptSections.ts.backup`
2. 修改 `IDENTITY` 常量
3. 修改 `DOING_TASKS` 常量（去掉编程相关内容）
4. 保留 `TONE` 常量（简洁风格适用）
5. 测试提示词加载

### 1.2 创建投资工具集

**新建文件**: `src/tools/investment/`

```
src/tools/investment/
├── market-data-tools.ts      # 市场数据工具
├── fundamental-tools.ts       # 基本面工具
├── technical-tools.ts         # 技术分析工具
├── risk-tools.ts              # 风险管理工具
├── portfolio-tools.ts         # 持仓管理工具
└── index.ts                   # 工具注册
```

**从 pi-investment 迁移**:
- 复制 `pi-investment/src/infrastructure/tools/invest-tools.ts`
- 复制 `pi-investment/src/infrastructure/akshare-ts/`
- 复制 `pi-investment/python/akshare_bridge.py`
- 适配到当前项目的工具接口

### 1.3 定义投资 Agent

**新建文件**: `src/agents/investment/`

```
src/agents/investment/
├── team-lead.ts               # 投资总监
├── market-analyst.ts          # 市场分析师
├── stock-screener.ts          # 选股专家
├── technical-analyst.ts       # 技术分析师
├── risk-manager.ts            # 风险管理师
├── quant-strategist.ts        # 量化策略师
├── portfolio-manager.ts       # 组合管理师
└── index.ts
```

**Agent 定义模板**:

```typescript
// src/agents/investment/market-analyst.ts
export const MARKET_ANALYST_PROMPT = `You are a Market Analyst.

Your job is to analyze the macro environment and market sentiment.

## Tools Available
- get_market_overview: Get major indices overview
- get_north_flow: Get northbound capital flow
- get_macro_data: Get macro indicators (PMI, CPI, etc.)
- get_sector_fund_flow: Get sector capital flow

## Analysis Framework
1. Market Phase: Bull/Bear/Sideways
2. Market Temperature: 0-100 (overheated/normal/oversold)
3. Hot Sectors: Identify rotating sectors
4. Risk Signals: Margin debt, volatility, etc.
5. Recommended Position: 40%-80% based on environment

## Output Format
{
  "market_phase": "sideways",
  "temperature": 65,
  "recommended_position": "60%",
  "hot_sectors": ["新能源", "半导体"],
  "risk_signals": ["融资余额连续下降"],
  "reasoning": "..."
}
`
```

### 1.4 修改工具注册

**文件**: `src/Tool.tsx`

**改造内容**:
- 注释掉编程工具（Read/Write/Edit/Bash）
- 注册投资工具（get_stock_price/analyze_technical）
- 保留协作工具（SendMessage/TaskCreate/Agent）

```typescript
// src/Tool.tsx
import { investmentTools } from './tools/investment/index.js'
import { collaborationTools } from './tools/collaboration/index.js'

export const tools = [
  ...investmentTools,      // 投资工具
  ...collaborationTools,   // 协作工具（保留）
]
```

---

## 🎯 Phase 2: 信号生成器 (Week 3)

### 2.1 实现选股策略

**新建文件**: `src/services/strategy/stock-screening-strategy.ts`

```typescript
export class StockScreeningStrategy {
  async screen(params: {
    sector?: string;
    minROE?: number;
    maxPE?: number;
    minQualityScore?: number;
  }): Promise<StockCandidate[]> {
    // 1. 调用 screen_stocks_by_sector
    // 2. 获取每只股票的财务数据
    // 3. 计算质量评分
    // 4. 排序并返回 Top N
  }
}
```

### 2.2 实现信号生成器

**新建文件**: `src/services/signal/signal-generator.ts`

```typescript
export interface TradingSignal {
  action: 'buy' | 'sell' | 'hold';
  symbol: string;
  name: string;
  price_range: [number, number];
  position: string;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  reasoning: string;
  risk_level: 'low' | 'medium' | 'high';
}

export class SignalGenerator {
  async generate(analysis: ComprehensiveAnalysis): Promise<TradingSignal> {
    // 1. 综合评分
    // 2. 风险检查
    // 3. 计算仓位
    // 4. 设置止损止盈
    // 5. 生成信号
  }
}
```

### 2.3 实现风险检查

**新建文件**: `src/services/risk/risk-checker.ts`

```typescript
export class RiskChecker {
  async check(signal: TradingSignal, portfolio: Portfolio): Promise<RiskCheckResult> {
    // 1. 检查单只仓位是否超限
    // 2. 检查板块集中度
    // 3. 检查总仓位
    // 4. 检查黑名单
    // 5. 检查市场环境
  }
}
```

---

## 🎯 Phase 3: 通知推送 (Week 4)

### 3.1 飞书 Bot 集成

**复用**: `pi-investment/src/api/feishu.ts`

**改造内容**:
- 适配到当前项目结构
- 实现交易信号卡片模板
- 实现按钮交互处理

### 3.2 消息模板

**新建文件**: `src/services/notification/templates/`

```
templates/
├── buy-signal.json            # 买入信号模板
├── sell-signal.json           # 卖出信号模板
├── stop-loss-alert.json       # 止损提醒模板
├── take-profit-alert.json     # 止盈提醒模板
└── daily-review.json          # 每日复盘模板
```

### 3.3 用户确认处理

**新建文件**: `src/services/confirmation/user-confirmer.ts`

```typescript
export class UserConfirmer {
  async waitForConfirmation(
    signal: TradingSignal,
    timeout: number = 24 * 60 * 60 * 1000
  ): Promise<'confirmed' | 'rejected' | 'timeout'> {
    // 1. 推送飞书卡片
    // 2. 等待用户点击按钮
    // 3. 处理超时
  }
}
```

---

## 🎯 Phase 4: 持仓管理 (Week 5)

### 4.1 虚拟持仓管理

**复用**: `pi-investment/src/services/portfolio/portfolio-service.ts`

**数据文件**: `.pi-invest/portfolio.json`

### 4.2 交易记录

**数据文件**: `.pi-invest/trades.json`

### 4.3 收益计算

**新建文件**: `src/services/portfolio/performance-calculator.ts`

```typescript
export class PerformanceCalculator {
  calculateReturns(portfolio: Portfolio): PerformanceMetrics {
    // 1. 总收益率
    // 2. 年化收益率
    // 3. 夏普比率
    // 4. 最大回撤
    // 5. 胜率
  }
}
```

---

## 🎯 Phase 5: 监控守护 (Week 6)

### 5.1 定时任务调度

**复用**: `pi-investment/src/services/cron/cron-service.ts`

**配置文件**: `.pi-invest/TRADING_CRON.json`

### 5.2 止损止盈监控

**新建文件**: `src/services/monitor/stop-monitor.ts`

```typescript
export class StopMonitor {
  async checkStopLoss(portfolio: Portfolio): Promise<Alert[]> {
    // 1. 获取最新价格
    // 2. 检查每只持仓
    // 3. 触发止损/止盈时生成告警
  }
}
```

### 5.3 异常告警

**告警类型**:
- 止损触发
- 止盈触发
- 基本面恶化
- 技术面破位
- 重大公告
- 市场异常

---

## 🎯 Phase 6: 测试优化 (Week 7-8)

### 6.1 单元测试

**测试文件**: `src/**/*.test.ts`

**测试覆盖**:
- 工具调用
- 信号生成
- 风险检查
- 持仓管理
- 通知推送

### 6.2 集成测试

**测试场景**:
- 完整选股流程
- 止损触发流程
- 用户确认流程
- 定时任务执行

### 6.3 回测验证

**回测工具**: `src/services/backtest/backtest-engine.ts`

**验证指标**:
- 年化收益率 > 15%
- 夏普比率 > 1.5
- 最大回撤 < 20%
- 胜率 > 60%

---

## 📂 目录结构（改造后）

```
investment-claude/
├── src/
│   ├── agents/
│   │   └── investment/              # 投资 Agent 定义
│   │       ├── team-lead.ts
│   │       ├── market-analyst.ts
│   │       ├── stock-screener.ts
│   │       ├── technical-analyst.ts
│   │       ├── risk-manager.ts
│   │       ├── quant-strategist.ts
│   │       └── portfolio-manager.ts
│   │
│   ├── tools/
│   │   ├── investment/              # 投资工具（新增）
│   │   │   ├── market-data-tools.ts
│   │   │   ├── fundamental-tools.ts
│   │   │   ├── technical-tools.ts
│   │   │   ├── risk-tools.ts
│   │   │   └── portfolio-tools.ts
│   │   │
│   │   └── collaboration/           # 协作工具（保留）
│   │       ├── AgentTool/
│   │       ├── SendMessageTool/
│   │       ├── TaskCreateTool/
│   │       └── ...
│   │
│   ├── services/
│   │   ├── strategy/                # 策略服务
│   │   │   ├── stock-screening-strategy.ts
│   │   │   └── momentum-strategy.ts
│   │   │
│   │   ├── signal/                  # 信号生成
│   │   │   └── signal-generator.ts
│   │   │
│   │   ├── risk/                    # 风险管理
│   │   │   ├── risk-checker.ts
│   │   │   └── position-sizer.ts
│   │   │
│   │   ├── notification/            # 通知推送
│   │   │   ├── feishu-notifier.ts
│   │   │   └── templates/
│   │   │
│   │   ├── confirmation/            # 用户确认
│   │   │   └── user-confirmer.ts
│   │   │
│   │   ├── portfolio/               # 持仓管理
│   │   │   ├── portfolio-service.ts
│   │   │   └── performance-calculator.ts
│   │   │
│   │   ├── monitor/                 # 监控守护
│   │   │   ├── stop-monitor.ts
│   │   │   └── alert-service.ts
│   │   │
│   │   └── backtest/                # 回测引擎
│   │       └── backtest-engine.ts
│   │
│   ├── infrastructure/
│   │   ├── akshare-ts/              # TS 数据源（从 pi-investment 迁移）
│   │   └── data-sources/            # 数据源适配器
│   │
│   ├── constants/
│   │   ├── promptSections.ts        # 系统提示词（改造）
│   │   └── prompts.ts
│   │
│   └── index.ts
│
├── python/
│   └── akshare_bridge.py            # Python 数据桥接（从 pi-investment 迁移）
│
├── skills/                          # 投资技能文件（新增）
│   ├── stock-screening.md
│   ├── risk-management.md
│   ├── portfolio-review.md
│   └── market-analysis.md
│
├── .pi-invest/                      # 数据目录
│   ├── portfolio.json               # 持仓数据
│   ├── trades.json                  # 交易记录
│   ├── signals/                     # 信号历史
│   ├── sessions/                    # 会话历史
│   └── TRADING_CRON.json            # 定时任务配置
│
├── docs/
│   ├── semi-auto-trading-system.md  # 系统设计
│   ├── implementation-plan.md       # 实施计划（本文件）
│   ├── agent-prompts/               # Agent 提示词
│   └── api-reference.md             # API 文档
│
└── tests/
    ├── unit/                        # 单元测试
    ├── integration/                 # 集成测试
    └── backtest/                    # 回测测试
```

---

## 🚀 快速开始（改造后）

### 安装依赖

```bash
# Node.js 依赖
npm install

# Python 依赖
pip install akshare pandas numpy
```

### 配置环境变量

```bash
# .env
ANTHROPIC_API_KEY=your-key-here
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=your-secret
PI_DIR=.pi-invest
```

### 启动系统

```bash
# 启动飞书 Bot
npm run start:feishu

# 启动定时任务
npm run start:cron

# 交互式对话
npm run start:chat
```

### 测试

```bash
# 单元测试
npm test

# 集成测试
npm run test:integration

# 回测
npm run backtest
```

---

## ✅ 验收标准

### Phase 1 完成标准
- [ ] 系统提示词改为投资顾问
- [ ] 投资工具集成并可用
- [ ] 6 个 Agent 定义完成
- [ ] 工具调用测试通过

### Phase 2 完成标准
- [ ] 选股策略可以筛选出候选股票
- [ ] 信号生成器可以生成交易信号
- [ ] 风险检查可以拦截高风险信号
- [ ] 单元测试覆盖率 > 80%

### Phase 3 完成标准
- [ ] 飞书 Bot 可以推送交易信号
- [ ] 用户可以点击按钮确认/拒绝
- [ ] 超时机制正常工作
- [ ] 消息模板美观易读

### Phase 4 完成标准
- [ ] 可以记录虚拟持仓
- [ ] 可以记录交易历史
- [ ] 可以计算收益和绩效
- [ ] 数据持久化正常

### Phase 5 完成标准
- [ ] 定时任务可以按时执行
- [ ] 止损止盈监控正常
- [ ] 异常告警及时推送
- [ ] 日志记录完整

### Phase 6 完成标准
- [ ] 所有测试通过
- [ ] 回测年化收益 > 15%
- [ ] 系统稳定运行 1 周无崩溃
- [ ] 文档完善

---

## 📊 进度跟踪

| Phase | 任务 | 状态 | 开始日期 | 完成日期 | 负责人 |
|-------|------|------|---------|---------|--------|
| 1 | 改造系统提示词 | 待开始 | - | - | - |
| 1 | 集成投资工具 | 待开始 | - | - | - |
| 1 | 定义投资 Agent | 待开始 | - | - | - |
| 2 | 实现选股策略 | 待开始 | - | - | - |
| 2 | 实现信号生成器 | 待开始 | - | - | - |
| 2 | 实现风险检查 | 待开始 | - | - | - |
| 3 | 飞书 Bot 集成 | 待开始 | - | - | - |
| 3 | 消息模板设计 | 待开始 | - | - | - |
| 3 | 用户确认处理 | 待开始 | - | - | - |
| 4 | 虚拟持仓管理 | 待开始 | - | - | - |
| 4 | 交易记录 | 待开始 | - | - | - |
| 4 | 收益计算 | 待开始 | - | - | - |
| 5 | 定时任务调度 | 待开始 | - | - | - |
| 5 | 止损止盈监控 | 待开始 | - | - | - |
| 5 | 异常告警 | 待开始 | - | - | - |
| 6 | 单元测试 | 待开始 | - | - | - |
| 6 | 集成测试 | 待开始 | - | - | - |
| 6 | 回测验证 | 待开始 | - | - | - |

---

## 🎯 下一步行动

**立即开始**: Phase 1.1 - 改造系统提示词

1. 备份 `src/constants/promptSections.ts`
2. 修改 `IDENTITY` 常量
3. 修改 `DOING_TASKS` 常量
4. 测试提示词加载
5. 提交代码

**命令**:
```bash
# 备份
cp src/constants/promptSections.ts src/constants/promptSections.ts.backup

# 编辑文件
# 修改 IDENTITY 和 DOING_TASKS

# 测试
npm test

# 提交
git add src/constants/promptSections.ts
git commit -m "feat: 改造系统提示词为投资顾问"
```
