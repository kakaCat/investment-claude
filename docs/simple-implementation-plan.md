# 简化版实施计划 - 单 Agent 量化投资系统

> 将 investment-claude 改造为单 Agent 量化投资助手，参考 pi-investment

**版本**: v2.0 (简化版)
**日期**: 2026-04-14
**预计完成**: 3-4 周

---

## 🎯 核心理念

**简单实用，快速上线**

- ✅ 单 Agent 系统（不用多 Agent 团队）
- ✅ 复用 pi-investment 的工具和逻辑
- ✅ 专注核心功能：数据分析 + 信号推送 + 用户确认
- ✅ 后续可选：升级为多 Agent 团队

---

## 📊 系统架构（简化版）

```
┌─────────────────────────────────────────┐
│         数据采集层                       │
│  - 从 pi-investment 复用工具             │
│  - Sina/Eastmoney/Akshare               │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      单个投资顾问 Agent                  │
│  - 市场分析                              │
│  - 选股筛选                              │
│  - 技术分析                              │
│  - 风险评估                              │
│  - 生成交易信号                          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         飞书推送层                       │
│  - 推送交易信号                          │
│  - 用户确认/拒绝                         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         持仓管理层                       │
│  - 记录虚拟持仓                          │
│  - 监控止损止盈                          │
└─────────────────────────────────────────┘
```

---

## 🔄 改造步骤

### Step 1: 复制 pi-investment 核心代码 (Week 1)

**目标**: 把 pi-investment 的工具和服务迁移过来

#### 1.1 复制工具文件

```bash
# 创建目录
mkdir -p src/tools/investment
mkdir -p src/infrastructure/akshare-ts
mkdir -p src/infrastructure/data-sources
mkdir -p src/services/portfolio
mkdir -p src/utils

# 复制工具
cp /Users/mac/Documents/ai/pi-investment/src/infrastructure/tools/invest-tools.ts \
   src/tools/investment/

# 复制数据源
cp -r /Users/mac/Documents/ai/pi-investment/src/infrastructure/akshare-ts/* \
   src/infrastructure/akshare-ts/

cp -r /Users/mac/Documents/ai/pi-investment/src/infrastructure/data-sources/* \
   src/infrastructure/data-sources/

# 复制持仓服务
cp /Users/mac/Documents/ai/pi-investment/src/services/portfolio/portfolio-service.ts \
   src/services/portfolio/

# 复制工具函数
cp /Users/mac/Documents/ai/pi-investment/src/utils/china-time.ts \
   src/utils/

# 复制 Python 桥接
cp /Users/mac/Documents/ai/pi-investment/python/akshare_bridge.py \
   python/
```

#### 1.2 适配工具接口

**文件**: `src/tools/investment/invest-tools.ts`

需要适配的地方：
- 工具定义格式（从 pi-investment 格式 → investment-claude 格式）
- 导入路径调整

```typescript
// 原来 (pi-investment)
import type { ToolDefinition } from "./index.js";

// 改为 (investment-claude)
import type { Tool } from "../../Tool.js";

// 适配工具定义
export const investmentTools: Tool[] = [
  {
    name: "get_stock_realtime_price",
    description: "获取股票实时价格",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "股票代码" }
      },
      required: ["symbol"]
    },
    execute: async (params) => {
      return await callPython("get_stock_realtime_price", params);
    }
  },
  // ... 其他工具
];
```

#### 1.3 注册工具

**文件**: `src/Tool.tsx`

```typescript
// 导入投资工具
import { investmentTools } from './tools/investment/invest-tools.js'

// 注册工具
export const tools: Tool[] = [
  ...investmentTools,
  // 保留必要的协作工具
  // AgentTool, SendMessageTool, TaskCreateTool 等
]
```

---

### Step 2: 改造系统提示词 (Week 1)

**目标**: 把 coding 提示词改为投资顾问提示词

#### 2.1 复制 pi-investment 的提示词

```bash
# 复制交易员提示词
cp /Users/mac/Documents/ai/pi-investment/src/core/agent/trader-system-prompt.ts \
   src/constants/
```

#### 2.2 修改提示词加载逻辑

**文件**: `src/constants/promptSections.ts`

```typescript
// 原来
export const IDENTITY = `You are Pi, an AI coding assistant...`

// 改为
import { buildTraderSystemPrompt } from './trader-system-prompt.js'

export function buildInvestmentIdentity(params: {
  portfolioSummary?: string;
  recentTrades?: string;
  date: string;
  time: string;
  marketStatus: 'pre_open' | 'trading' | 'closed';
}): string {
  return buildTraderSystemPrompt(params);
}
```

#### 2.3 修改提示词组装

**文件**: `src/constants/prompts.ts`

```typescript
import { buildInvestmentIdentity } from './promptSections.js'
import { chinaDate, chinaTime } from '../utils/china-time.js'

export function initSystemPrompt(): void {
  if (initialized) return
  initialized = true

  // 动态生成投资顾问提示词
  registerSection('identity', async (ctx) => {
    const piDir = process.env.PI_DIR || '.pi-invest'

    return buildInvestmentIdentity({
      portfolioSummary: getPortfolioSummary(piDir),
      recentTrades: getRecentTrades(piDir),
      date: chinaDate(),
      time: chinaTime(),
      marketStatus: getMarketStatus(),
    })
  })

  // 其他段落...
}
```

---

### Step 3: 实现信号推送 (Week 2)

**目标**: 实现飞书推送交易信号

#### 3.1 复制飞书服务

```bash
cp /Users/mac/Documents/ai/pi-investment/src/services/notification/feishu-service.ts \
   src/services/notification/

cp /Users/mac/Documents/ai/pi-investment/src/api/feishu.ts \
   src/api/
```

#### 3.2 创建信号生成器

**新建文件**: `src/services/signal/signal-generator.ts`

```typescript
export interface TradingSignal {
  action: 'buy' | 'sell' | 'hold';
  symbol: string;
  name: string;
  price: number;
  position: string;  // "10%"
  stop_loss: number;
  take_profit: number;
  reasoning: string;
}

export class SignalGenerator {
  async generateBuySignal(analysis: {
    symbol: string;
    name: string;
    price: number;
    qualityScore: number;
    technicalScore: number;
    riskLevel: string;
  }): Promise<TradingSignal> {
    // 1. 判断是否值得买入
    if (analysis.qualityScore < 70 || analysis.technicalScore < 60) {
      return { action: 'hold', ... };
    }

    // 2. 计算仓位（简单规则）
    const position = this.calculatePosition(analysis.qualityScore);

    // 3. 设置止损止盈
    const stopLoss = analysis.price * 0.92;  // -8%
    const takeProfit = analysis.price * 1.15; // +15%

    return {
      action: 'buy',
      symbol: analysis.symbol,
      name: analysis.name,
      price: analysis.price,
      position,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      reasoning: `质量评分 ${analysis.qualityScore}，技术评分 ${analysis.technicalScore}`
    };
  }

  private calculatePosition(qualityScore: number): string {
    if (qualityScore >= 90) return '15%';
    if (qualityScore >= 80) return '10%';
    if (qualityScore >= 70) return '5%';
    return '0%';
  }
}
```

#### 3.3 创建推送服务

**新建文件**: `src/services/notification/signal-pusher.ts`

```typescript
import { FeishuService } from './feishu-service.js'
import type { TradingSignal } from '../signal/signal-generator.js'

export class SignalPusher {
  private feishu: FeishuService;

  constructor() {
    this.feishu = new FeishuService();
  }

  async pushSignal(signal: TradingSignal, chatId: string): Promise<void> {
    const card = this.buildSignalCard(signal);
    await this.feishu.sendCard(chatId, card);
  }

  private buildSignalCard(signal: TradingSignal) {
    return {
      header: {
        title: `📈 交易信号 - ${signal.action === 'buy' ? '买入' : '卖出'}推荐`,
        template: signal.action === 'buy' ? 'blue' : 'red'
      },
      elements: [
        {
          tag: 'div',
          text: {
            content: `**股票**: ${signal.name} (${signal.symbol})\n**价格**: ${signal.price}\n**建议仓位**: ${signal.position}`,
            tag: 'lark_md'
          }
        },
        {
          tag: 'div',
          text: {
            content: `**止损**: ${signal.stop_loss}\n**止盈**: ${signal.take_profit}`,
            tag: 'lark_md'
          }
        },
        {
          tag: 'div',
          text: {
            content: `📊 **分析依据**\n${signal.reasoning}`,
            tag: 'lark_md'
          }
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { content: '确认买入', tag: 'plain_text' },
              type: 'primary',
              value: { action: 'confirm', signal_id: Date.now() }
            },
            {
              tag: 'button',
              text: { content: '拒绝', tag: 'plain_text' },
              type: 'default',
              value: { action: 'reject', signal_id: Date.now() }
            }
          ]
        }
      ]
    };
  }
}
```

---

### Step 4: 实现定时任务 (Week 3)

**目标**: 每日自动选股推荐

#### 4.1 复制定时任务服务

```bash
cp /Users/mac/Documents/ai/pi-investment/src/services/cron/cron-service.ts \
   src/services/cron/
```

#### 4.2 创建选股任务

**新建文件**: `src/services/tasks/daily-screening-task.ts`

```typescript
import { callPython } from '../../tools/investment/invest-tools.js'
import { SignalGenerator } from '../signal/signal-generator.js'
import { SignalPusher } from '../notification/signal-pusher.js'

export class DailyScreeningTask {
  private signalGenerator = new SignalGenerator();
  private signalPusher = new SignalPusher();

  async execute(chatId: string): Promise<void> {
    // 1. 筛选股票
    const candidates = await this.screenStocks();

    // 2. 逐个分析
    for (const stock of candidates) {
      const analysis = await this.analyzeStock(stock.symbol);

      // 3. 生成信号
      const signal = await this.signalGenerator.generateBuySignal(analysis);

      // 4. 推送通知
      if (signal.action === 'buy') {
        await this.signalPusher.pushSignal(signal, chatId);
      }
    }
  }

  private async screenStocks() {
    const result = await callPython('screen_stocks_by_sector', {
      sector: '全部',
      min_roe: 15,
      max_pe: 30
    });
    return JSON.parse(result).slice(0, 5); // Top 5
  }

  private async analyzeStock(symbol: string) {
    // 并行调用多个工具
    const [price, technical, financial] = await Promise.all([
      callPython('get_stock_realtime_price', { symbol }),
      callPython('calculate_technical_indicators', { symbol }),
      callPython('get_financial_indicators', { symbol })
    ]);

    // 计算评分
    const qualityScore = this.calculateQualityScore(JSON.parse(financial));
    const technicalScore = this.calculateTechnicalScore(JSON.parse(technical));

    return {
      symbol,
      name: JSON.parse(price).name,
      price: JSON.parse(price).current,
      qualityScore,
      technicalScore,
      riskLevel: 'medium'
    };
  }

  private calculateQualityScore(financial: any): number {
    // 简单评分逻辑
    let score = 50;
    if (financial.roe > 20) score += 20;
    if (financial.roe > 15) score += 10;
    if (financial.debt_ratio < 50) score += 20;
    return Math.min(score, 100);
  }

  private calculateTechnicalScore(technical: any): number {
    // 简单评分逻辑
    let score = 50;
    if (technical.ma_golden_cross) score += 20;
    if (technical.macd_bullish) score += 15;
    if (technical.rsi > 30 && technical.rsi < 70) score += 15;
    return Math.min(score, 100);
  }
}
```

#### 4.3 配置定时任务

**配置文件**: `.pi-invest/TRADING_CRON.json`

```json
{
  "jobs": [
    {
      "name": "每日选股推荐",
      "cron": "0 9 * * 1-5",
      "enabled": true,
      "task": "daily_screening",
      "params": {
        "chat_id": "oc_xxx"
      }
    },
    {
      "name": "盘中监控",
      "cron": "*/30 9-15 * * 1-5",
      "enabled": true,
      "task": "monitor_positions",
      "params": {
        "chat_id": "oc_xxx"
      }
    }
  ]
}
```

---

### Step 5: 实现持仓监控 (Week 3)

**目标**: 监控止损止盈

#### 5.1 复制持仓服务

```bash
cp /Users/mac/Documents/ai/pi-investment/src/services/portfolio/portfolio-service.ts \
   src/services/portfolio/
```

#### 5.2 创建监控任务

**新建文件**: `src/services/tasks/monitor-positions-task.ts`

```typescript
import { PortfolioService } from '../portfolio/portfolio-service.js'
import { callPython } from '../../tools/investment/invest-tools.js'
import { SignalPusher } from '../notification/signal-pusher.js'

export class MonitorPositionsTask {
  private portfolio = new PortfolioService();
  private pusher = new SignalPusher();

  async execute(chatId: string): Promise<void> {
    // 1. 获取持仓
    const holdings = await this.portfolio.getHoldings();

    // 2. 检查每只股票
    for (const holding of holdings) {
      const currentPrice = await this.getCurrentPrice(holding.symbol);

      // 3. 检查止损
      if (currentPrice <= holding.stop_loss) {
        await this.alertStopLoss(holding, currentPrice, chatId);
      }

      // 4. 检查止盈
      if (currentPrice >= holding.take_profit) {
        await this.alertTakeProfit(holding, currentPrice, chatId);
      }
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const result = await callPython('get_stock_realtime_price', { symbol });
    return JSON.parse(result).current;
  }

  private async alertStopLoss(holding: any, currentPrice: number, chatId: string) {
    const signal = {
      action: 'sell' as const,
      symbol: holding.symbol,
      name: holding.name,
      price: currentPrice,
      position: '100%',
      stop_loss: 0,
      take_profit: 0,
      reasoning: `触发止损线 (${holding.stop_loss})，当前价 ${currentPrice}`
    };

    await this.pusher.pushSignal(signal, chatId);
  }

  private async alertTakeProfit(holding: any, currentPrice: number, chatId: string) {
    const signal = {
      action: 'sell' as const,
      symbol: holding.symbol,
      name: holding.name,
      price: currentPrice,
      position: '50%',  // 止盈卖一半
      stop_loss: 0,
      take_profit: 0,
      reasoning: `触发止盈线 (${holding.take_profit})，当前价 ${currentPrice}，建议卖出一半`
    };

    await this.pusher.pushSignal(signal, chatId);
  }
}
```

---

### Step 6: 测试和优化 (Week 4)

#### 6.1 单元测试

```bash
# 测试工具调用
npm test src/tools/investment/invest-tools.test.ts

# 测试信号生成
npm test src/services/signal/signal-generator.test.ts

# 测试持仓管理
npm test src/services/portfolio/portfolio-service.test.ts
```

#### 6.2 集成测试

```bash
# 测试完整流程
npm run test:integration
```

#### 6.3 手动测试

```bash
# 启动飞书 Bot
npm run start:feishu

# 在飞书发送消息
@投资顾问 帮我分析一下贵州茅台
```

---

## 📂 最终目录结构

```
investment-claude/
├── src/
│   ├── tools/
│   │   └── investment/
│   │       └── invest-tools.ts          # 从 pi-investment 复制
│   │
│   ├── infrastructure/
│   │   ├── akshare-ts/                  # 从 pi-investment 复制
│   │   └── data-sources/                # 从 pi-investment 复制
│   │
│   ├── services/
│   │   ├── portfolio/
│   │   │   └── portfolio-service.ts     # 从 pi-investment 复制
│   │   ├── signal/
│   │   │   └── signal-generator.ts      # 新建
│   │   ├── notification/
│   │   │   ├── feishu-service.ts        # 从 pi-investment 复制
│   │   │   └── signal-pusher.ts         # 新建
│   │   ├── cron/
│   │   │   └── cron-service.ts          # 从 pi-investment 复制
│   │   └── tasks/
│   │       ├── daily-screening-task.ts  # 新建
│   │       └── monitor-positions-task.ts # 新建
│   │
│   ├── constants/
│   │   ├── trader-system-prompt.ts      # 从 pi-investment 复制
│   │   ├── promptSections.ts            # 修改
│   │   └── prompts.ts                   # 修改
│   │
│   ├── utils/
│   │   └── china-time.ts                # 从 pi-investment 复制
│   │
│   └── Tool.tsx                         # 修改（注册投资工具）
│
├── python/
│   └── akshare_bridge.py                # 从 pi-investment 复制
│
├── .pi-invest/
│   ├── portfolio.json
│   ├── trades.json
│   └── TRADING_CRON.json
│
└── docs/
    └── simple-implementation-plan.md    # 本文件
```

---

## ✅ 验收标准

### Week 1 完成标准
- [ ] pi-investment 工具复制完成
- [ ] 工具接口适配完成
- [ ] 系统提示词改造完成
- [ ] 工具调用测试通过

### Week 2 完成标准
- [ ] 信号生成器实现完成
- [ ] 飞书推送服务实现完成
- [ ] 可以推送交易信号卡片
- [ ] 用户可以点击按钮确认

### Week 3 完成标准
- [ ] 定时任务服务实现完成
- [ ] 每日选股任务可以执行
- [ ] 持仓监控任务可以执行
- [ ] 止损止盈告警正常

### Week 4 完成标准
- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试通过
- [ ] 系统稳定运行

---

## 🚀 快速开始

### 1. 复制文件

```bash
# 执行 Step 1.1 的复制命令
bash scripts/copy-from-pi-investment.sh
```

### 2. 安装依赖

```bash
npm install
pip install akshare pandas numpy
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 API Key
```

### 4. 启动系统

```bash
# 启动飞书 Bot
npm run start:feishu

# 启动定时任务
npm run start:cron
```

---

## 🎯 后续可选：升级为多 Agent 团队

如果后续需要展示决策过程，可以升级为多 Agent 团队：

1. 创建 `src/agents/investment/` 目录
2. 定义 6 个专业 Agent
3. 实现 Team Lead 协调逻辑
4. 修改信号生成流程（单 Agent → 多 Agent 协作）

但现在先把单 Agent 版本做好，验证可行性。

---

## 📊 进度跟踪

| Week | 任务 | 状态 | 完成日期 |
|------|------|------|---------|
| 1 | 复制 pi-investment 代码 | 待开始 | - |
| 1 | 改造系统提示词 | 待开始 | - |
| 2 | 实现信号推送 | 待开始 | - |
| 3 | 实现定时任务 | 待开始 | - |
| 3 | 实现持仓监控 | 待开始 | - |
| 4 | 测试和优化 | 待开始 | - |

---

**总结**: 这个简化版方案更实用，3-4 周可以完成，后续可选升级为多 Agent 团队。
