# 灵活 Agent 方案 - 单 Agent + 按需 Teammate

> 主 Agent 常驻，复杂任务时按需启动 Teammate 协作

**版本**: v3.0 (灵活版)
**日期**: 2026-04-14
**预计完成**: 3-4 周

---

## 🎯 核心理念

**简单任务单 Agent，复杂任务启动 Teammate**

- ✅ 主 Agent: 投资顾问（常驻）
- ✅ Teammate: 专业助手（按需启动，用完即走）
- ✅ 使用 Agent + SendMessage 工具实现协作
- ✅ 灵活高效，省资源

---

## 📊 系统架构

```
┌─────────────────────────────────────────────────────┐
│              主 Agent (投资顾问)                      │
│  - 接收用户请求                                       │
│  - 判断任务复杂度                                     │
│  - 简单任务: 直接处理                                 │
│  - 复杂任务: 启动 Teammate                            │
│  - 汇总结果，生成建议                                 │
└─────────────────────────────────────────────────────┘
              ↓ (复杂任务时)
┌─────────────────────────────────────────────────────┐
│           按需启动的 Teammate                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Fundamental  │  │ Technical    │  │ Risk     │  │
│  │ Analyst      │  │ Analyst      │  │ Assessor │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
│  (并行执行，完成后返回结果给主 Agent)                  │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 工作流程

### 场景 1: 简单查询（不启动 Teammate）

```
用户: "茅台现在多少钱？"
  ↓
主 Agent:
  1. 判断: 简单查询，不需要 Teammate
  2. 调用工具: get_stock_realtime_price("600519")
  3. 返回: "贵州茅台当前价格 1850 元"
```

### 场景 2: 深度分析（启动 Teammate）

```
用户: "帮我深度分析贵州茅台，给出投资建议"
  ↓
主 Agent:
  1. 判断: 需要多维度分析，启动 Teammate
  2. 并行启动 3 个 Teammate:

     Agent({
       name: "fundamental",
       description: "分析茅台基本面",
       prompt: `分析 600519 的基本面:
       - 调用 get_financial_indicators
       - 调用 get_stock_valuation
       - 计算质量评分 (0-100)
       - 返回 JSON: {score, reasoning}`
     })

     Agent({
       name: "technical",
       description: "分析茅台技术面",
       prompt: `分析 600519 的技术面:
       - 调用 calculate_technical_indicators
       - 判断趋势方向和强度
       - 计算技术评分 (0-100)
       - 返回 JSON: {score, trend, reasoning}`
     })

     Agent({
       name: "risk",
       description: "评估茅台风险",
       prompt: `评估 600519 的风险:
       - 调用 get_stock_valuation (估值风险)
       - 调用 get_market_overview (市场风险)
       - 计算风险等级 (low/medium/high)
       - 返回 JSON: {level, reasoning}`
     })

  3. 等待 3 个 Teammate 返回结果

  4. 汇总结果:
     - 基本面评分: 92
     - 技术面评分: 85
     - 风险等级: medium

  5. 生成建议:
     "贵州茅台综合评分 88 分，推荐买入
      - 基本面优秀 (92分): ROE 25%, 负债率低
      - 技术面强势 (85分): 上升趋势，突破关键位
      - 风险中等: 估值偏高，注意回调
      建议仓位 10%，止损 1750，止盈 2000"
```

### 场景 3: 选股任务（启动多个 Teammate）

```
用户: "帮我在新能源板块选 3 只好股票"
  ↓
主 Agent:
  1. 判断: 需要筛选 + 逐个分析，启动 Teammate

  2. 先筛选候选:
     调用 screen_stocks_by_sector("新能源")
     得到 10 只候选

  3. 并行启动 10 个 Teammate 分析:
     for (const stock of candidates) {
       Agent({
         name: `analyst-${stock.symbol}`,
         description: `分析 ${stock.name}`,
         prompt: `深度分析 ${stock.symbol}，返回综合评分`
       })
     }

  4. 等待所有 Teammate 返回

  5. 排序，取 Top 3

  6. 返回推荐列表
```

---

## 🛠️ 实现细节

### 1. 主 Agent 提示词

**文件**: `src/constants/trader-system-prompt.ts`

在原有提示词基础上，增加 Teammate 使用指南：

```typescript
function getTeammateUsageSection(): string {
  return `# Using Teammates for Complex Analysis

When a task requires multi-dimensional analysis, you can spawn teammates to help:

## When to Use Teammates

✅ Use teammates when:
- User asks for "deep analysis" or "comprehensive review"
- Task requires analyzing multiple aspects (fundamental + technical + risk)
- Need to analyze multiple stocks in parallel
- Task is time-consuming and can be parallelized

❌ Don't use teammates when:
- Simple data query (just call tools directly)
- User wants quick answer
- Task is sequential and cannot be parallelized

## How to Spawn Teammates

Use the Agent tool with clear, focused prompts:

\`\`\`typescript
// Example: Deep stock analysis
Agent({
  name: "fundamental-analyst",
  description: "Analyze fundamentals",
  prompt: \`Analyze 600519 fundamentals:
  1. Call get_financial_indicators
  2. Call get_stock_valuation
  3. Calculate quality score (0-100)
  4. Return JSON: {score, reasoning}\`
})

Agent({
  name: "technical-analyst",
  description: "Analyze technicals",
  prompt: \`Analyze 600519 technicals:
  1. Call calculate_technical_indicators
  2. Judge trend direction and strength
  3. Calculate technical score (0-100)
  4. Return JSON: {score, trend, reasoning}\`
})
\`\`\`

## Teammate Response Format

Each teammate should return structured JSON for easy aggregation:

\`\`\`json
{
  "score": 85,
  "reasoning": "Strong fundamentals with ROE > 20%",
  "details": { ... }
}
\`\`\`

## Aggregating Results

After all teammates return, aggregate their results:

1. Collect all scores
2. Calculate weighted average
3. Combine reasoning from all teammates
4. Generate final recommendation

## Important Notes

- Spawn teammates in PARALLEL (multiple Agent calls in one response)
- Each teammate should be INDEPENDENT (no dependencies between them)
- Keep teammate prompts FOCUSED (one specific task per teammate)
- Always WAIT for all teammates before aggregating
`
}
```

### 2. Teammate 提示词模板

**新建文件**: `src/agents/teammate-prompts.ts`

```typescript
export const TEAMMATE_PROMPTS = {
  fundamental: (symbol: string) => `
You are a Fundamental Analyst. Analyze ${symbol}'s fundamentals.

Steps:
1. Call get_financial_indicators(symbol="${symbol}")
2. Call get_stock_valuation(symbol="${symbol}")
3. Calculate quality score based on:
   - ROE (>20% = excellent, >15% = good, <10% = poor)
   - Debt ratio (<30% = excellent, <50% = good, >70% = poor)
   - Profit margin (>20% = excellent, >10% = good, <5% = poor)
4. Return JSON:
{
  "score": 0-100,
  "reasoning": "Brief explanation",
  "metrics": {
    "roe": number,
    "debt_ratio": number,
    "profit_margin": number
  }
}
`,

  technical: (symbol: string) => `
You are a Technical Analyst. Analyze ${symbol}'s technicals.

Steps:
1. Call calculate_technical_indicators(symbol="${symbol}")
2. Calculate technical score based on:
   - Trend: uptrend = +30, sideways = +15, downtrend = 0
   - MA golden cross = +20
   - MACD bullish = +20
   - RSI (30-70 range) = +15
   - Volume increasing = +15
3. Return JSON:
{
  "score": 0-100,
  "trend": "uptrend" | "sideways" | "downtrend",
  "reasoning": "Brief explanation",
  "signals": {
    "ma_golden_cross": boolean,
    "macd_bullish": boolean,
    "rsi": number
  }
}
`,

  risk: (symbol: string) => `
You are a Risk Assessor. Evaluate ${symbol}'s risks.

Steps:
1. Call get_stock_valuation(symbol="${symbol}")
2. Call get_market_overview()
3. Assess risk level:
   - Valuation risk: PE > 50 = high, PE 30-50 = medium, PE < 30 = low
   - Market risk: Check market temperature
   - Concentration risk: Check if already heavily invested
4. Return JSON:
{
  "level": "low" | "medium" | "high",
  "reasoning": "Brief explanation",
  "factors": {
    "valuation_risk": string,
    "market_risk": string
  }
}
`,

  screener: (sector: string, criteria: any) => `
You are a Stock Screener. Screen stocks in ${sector} sector.

Steps:
1. Call screen_stocks_by_sector(sector="${sector}", min_roe=${criteria.min_roe}, max_pe=${criteria.max_pe})
2. Return top 10 candidates
3. Return JSON:
{
  "candidates": [
    {
      "symbol": string,
      "name": string,
      "roe": number,
      "pe": number
    }
  ]
}
`
}
```

### 3. 主 Agent 决策逻辑

**新建文件**: `src/services/agent/task-dispatcher.ts`

```typescript
export class TaskDispatcher {
  /**
   * 判断是否需要启动 Teammate
   */
  shouldUseTeammates(userMessage: string): boolean {
    const complexKeywords = [
      '深度分析', 'deep analysis', '全面分析', 'comprehensive',
      '详细分析', 'detailed analysis', '投资建议', 'investment advice',
      '选股', 'screen stocks', '筛选', 'filter'
    ];

    return complexKeywords.some(kw =>
      userMessage.toLowerCase().includes(kw.toLowerCase())
    );
  }

  /**
   * 生成 Teammate 启动配置
   */
  generateTeammateConfig(taskType: string, params: any) {
    switch (taskType) {
      case 'deep_analysis':
        return [
          {
            name: 'fundamental',
            description: '基本面分析',
            prompt: TEAMMATE_PROMPTS.fundamental(params.symbol)
          },
          {
            name: 'technical',
            description: '技术面分析',
            prompt: TEAMMATE_PROMPTS.technical(params.symbol)
          },
          {
            name: 'risk',
            description: '风险评估',
            prompt: TEAMMATE_PROMPTS.risk(params.symbol)
          }
        ];

      case 'stock_screening':
        return [
          {
            name: 'screener',
            description: '选股筛选',
            prompt: TEAMMATE_PROMPTS.screener(params.sector, params.criteria)
          }
        ];

      default:
        return [];
    }
  }

  /**
   * 汇总 Teammate 结果
   */
  aggregateResults(results: Array<{name: string, result: any}>) {
    const scores = results
      .filter(r => r.result.score !== undefined)
      .map(r => r.result.score);

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const reasoning = results
      .map(r => `- ${r.name}: ${r.result.reasoning}`)
      .join('\n');

    return {
      overall_score: Math.round(avgScore),
      reasoning,
      details: results
    };
  }
}
```

### 4. 使用示例

**在主 Agent 的处理逻辑中**:

```typescript
// src/core/agent/agent-loop.ts

import { TaskDispatcher } from '../../services/agent/task-dispatcher.js'

const dispatcher = new TaskDispatcher();

// 判断是否需要 Teammate
if (dispatcher.shouldUseTeammates(userMessage)) {
  // 启动 Teammate
  const teammates = dispatcher.generateTeammateConfig('deep_analysis', {
    symbol: '600519'
  });

  // 并行启动（在一个 response 中调用多次 Agent tool）
  const results = await Promise.all(
    teammates.map(t =>
      callAgentTool({
        name: t.name,
        description: t.description,
        prompt: t.prompt
      })
    )
  );

  // 汇总结果
  const aggregated = dispatcher.aggregateResults(results);

  // 生成最终建议
  return generateRecommendation(aggregated);
} else {
  // 简单任务，直接处理
  return handleSimpleQuery(userMessage);
}
```

---

## 📂 目录结构

```
investment-claude/
├── src/
│   ├── agents/
│   │   └── teammate-prompts.ts          # Teammate 提示词模板
│   │
│   ├── services/
│   │   ├── agent/
│   │   │   └── task-dispatcher.ts       # 任务分发器
│   │   ├── signal/
│   │   │   └── signal-generator.ts
│   │   ├── portfolio/
│   │   │   └── portfolio-service.ts
│   │   └── notification/
│   │       └── signal-pusher.ts
│   │
│   ├── tools/
│   │   └── investment/
│   │       └── invest-tools.ts          # 从 pi-investment 复制
│   │
│   ├── constants/
│   │   ├── trader-system-prompt.ts      # 主 Agent 提示词（增强）
│   │   └── prompts.ts
│   │
│   └── core/
│       └── agent/
│           └── agent-loop.ts            # 主循环（增加 Teammate 逻辑）
│
└── docs/
    └── flexible-agent-plan.md           # 本文件
```

---

## 🔄 改造步骤

### Step 1: 复制 pi-investment 代码 (Week 1)

同 simple-implementation-plan.md 的 Step 1

### Step 2: 增强主 Agent 提示词 (Week 1)

1. 修改 `src/constants/trader-system-prompt.ts`
2. 增加 Teammate 使用指南
3. 增加结果汇总指南

### Step 3: 实现 Teammate 系统 (Week 2)

1. 创建 `src/agents/teammate-prompts.ts`
2. 创建 `src/services/agent/task-dispatcher.ts`
3. 修改 `src/core/agent/agent-loop.ts`，增加 Teammate 启动逻辑

### Step 4: 测试 Teammate 协作 (Week 2)

```bash
# 测试简单查询（不启动 Teammate）
用户: "茅台多少钱？"
预期: 直接返回价格

# 测试深度分析（启动 Teammate）
用户: "深度分析茅台"
预期: 启动 3 个 Teammate，返回综合分析

# 测试选股（启动 Teammate）
用户: "在新能源板块选 3 只股票"
预期: 启动 screener + 多个 analyst
```

### Step 5: 实现信号推送 (Week 3)

同 simple-implementation-plan.md 的 Step 3

### Step 6: 实现定时任务 (Week 3-4)

同 simple-implementation-plan.md 的 Step 4-5

---

## ✅ 验收标准

### Week 1
- [ ] pi-investment 代码复制完成
- [ ] 主 Agent 提示词增强完成
- [ ] 工具调用测试通过

### Week 2
- [ ] Teammate 系统实现完成
- [ ] 简单查询不启动 Teammate
- [ ] 复杂任务正确启动 Teammate
- [ ] Teammate 结果正确汇总

### Week 3
- [ ] 信号推送实现完成
- [ ] 定时任务实现完成

### Week 4
- [ ] 所有测试通过
- [ ] 系统稳定运行

---

## 🎯 优势总结

相比固定多 Agent 团队：

| 特性 | 固定团队 | 灵活 Teammate |
|------|---------|--------------|
| **简单查询** | 6 个 Agent 都启动 | 主 Agent 直接处理 ✅ |
| **复杂分析** | 6 个 Agent 都启动 | 按需启动 3-4 个 ✅ |
| **资源消耗** | 高 | 低 ✅ |
| **响应速度** | 慢（需要协调） | 快（简单任务）✅ |
| **灵活性** | 固定结构 | 灵活扩展 ✅ |

---

**总结**: 这个方案结合了单 Agent 的简单和多 Agent 的能力，是最佳选择！
