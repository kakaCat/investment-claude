# System Prompt 优化 - 2026-05-14

## 问题描述

**用户反馈：** "我问持仓，为何他不看持仓，去上网查数据？"

**实际行为：**
用户输入："我的持仓"

Agent执行了：
1. ✅ `get_account_info` - 正确
2. ✅ `get_positions` - 正确
3. ❌ `get_hk_analysis(00700, 01810)` - 不必要
4. ❌ `get_stock_price(600600)` - 不必要
5. ❌ `get_financial_data`, `get_valuation`, `analyze_technical` - 不必要
6. ❌ `get_stock_news`, `web_fetch`, `browser` - 不必要
7. ❌ `Quant` 预测信号 - 不必要

**根本原因：**
System prompt过于激进，要求对"ANY investment-related question"都要"IMMEDIATELY use tools"进行深度分析。Agent把"我的持仓"理解成了"分析我的持仓"。

---

## 优化方案

### 核心思路：区分"信息查询"和"分析请求"

**信息查询** - 只返回数据，不做分析
- "我的持仓" / "账户" / "仓位"
- "我的订单"
- "XX股票现在多少钱"

**分析请求** - 需要深度分析
- "分析我的持仓"
- "持仓建议" / "应该调仓吗"
- "帮我看看XX股票"

---

## 具体修改

### 1. 添加"SIMPLE QUERIES"规则

**位置：** `src/constants/promptSections.ts` 第61-75行

**新增内容：**
```typescript
**SIMPLE QUERIES - Return data directly, DO NOT over-analyze:**
- "我的持仓" / "账户" / "仓位" → ONLY call get_account_info + get_positions, then format and display
- "我的订单" → ONLY call get_orders, then display
- DO NOT automatically analyze holdings unless user explicitly asks "分析我的持仓" or "持仓建议"

**ANALYSIS REQUESTS - Gather comprehensive data:**
- "分析我的持仓" → get_positions + analyze each holding (price, technical, valuation)
- "持仓建议" / "应该调仓吗" → get_positions + comprehensive analysis + recommendations
- "帮我看看XX股票" → comprehensive analysis with multiple tools
```

---

### 2. 修改"Required behavior"规则

**位置：** `src/constants/promptSections.ts` 第41-51行

**修改前：**
```
- User asks about account/positions → IMMEDIATELY use get_account_info, get_positions
```

**修改后：**
```
- User asks about account/positions → ONLY use get_account_info, get_positions (DO NOT analyze holdings unless explicitly asked)
```

---

### 3. 更新"Portfolio Management"工作流

**位置：** `src/constants/promptSections.ts` 第123-138行

**修改前：**
```
### 3. Portfolio Management
When managing portfolio:
1. Use get_account_info to check cash and total assets
2. Use get_positions to view current holdings
3. Use get_orders to review trade history
4. Calculate position sizing and risk exposure
5. Suggest rebalancing when needed
```

**修改后：**
```
### 3. Portfolio Management
When managing portfolio:

**For SIMPLE queries (just showing data):**
- "我的持仓" / "账户" / "仓位" → ONLY call get_account_info + get_positions, then format and display
- "我的订单" → ONLY call get_orders, then display
- DO NOT automatically fetch price updates, technical analysis, or news unless user asks

**For ANALYSIS requests (comprehensive review):**
- "分析我的持仓" / "持仓建议" / "应该调仓吗" → Then gather:
  1. Use get_account_info to check cash and total assets
  2. Use get_positions to view current holdings
  3. For each holding: get current price, technical indicators, valuation
  4. Calculate position sizing and risk exposure
  5. Suggest rebalancing when needed
- "我的XX股票怎么样" → Analyze that specific holding in detail
```

---

### 4. 更新响应格式示例

**位置：** `src/constants/promptSections.ts` 第242-255行

**修改前：**
```
### Account/Position Queries
Format: Clean summary with key metrics
Example:
```
账户总览:
- 总资产: ¥1,234,567
- 可用资金: ¥456,789
- 持仓市值: ¥777,778
- 仓位比例: 63%

持仓明细:
1. 贵州茅台(600519) 100股 | 成本¥1,450 | 现价¥1,443 | 浮亏-¥669 (-0.46%)
2. 腾讯控股(00700) 200股 | 成本HK$380 | 现价HK$385 | 浮盈+HK$1,000 (+1.32%)
```
```

**修改后：**
```
### Account/Position Queries
**For simple queries ("我的持仓"), show clean summary WITHOUT analysis:**
Example:
```
账户总览:
- 总资产: ¥999,982.50
- 可用资金: ¥952,982.50
- 持仓市值: ¥47,000.00
- 仓位比例: 4.70%

持仓明细:
1. 平安银行(000001) 1,000股 | 成本¥15.50 | 持仓市值¥15,500
2. 紫金矿业(601899) 200股 | 成本¥32.50 | 持仓市值¥6,500
3. 青岛啤酒(600600) 400股 | 成本¥62.50 | 持仓市值¥25,000
```

**Only add analysis if user explicitly asks:**
- "分析我的持仓" → Add current prices, P&L, technical signals, recommendations
- "持仓建议" → Add risk assessment, rebalancing suggestions
```

---

## 预期效果

### 优化前
```
用户: "我的持仓"
Agent:
  → get_account_info ✓
  → get_positions ✓
  → get_hk_analysis(00700) ✗
  → get_hk_analysis(01810) ✗
  → get_stock_price(600600) ✗
  → get_financial_data(600600) ✗
  → analyze_technical(600600) ✗
  → get_stock_news(600600) ✗
  → web_fetch(...) ✗
  → browser(...) ✗
  → Quant predict_signal ✗
  [返回大量分析数据]
```

### 优化后
```
用户: "我的持仓"
Agent:
  → get_account_info ✓
  → get_positions ✓
  [直接格式化显示持仓信息]

用户: "分析我的持仓"
Agent:
  → get_account_info ✓
  → get_positions ✓
  → get_stock_price(000001) ✓
  → get_stock_price(601899) ✓
  → get_stock_price(600600) ✓
  → analyze_technical(...) ✓
  → get_valuation(...) ✓
  [返回完整分析报告]
```

---

## 关键原则

1. **默认最小化** - 简单查询只返回必要数据
2. **显式触发** - 分析需要用户明确请求
3. **关键词识别** - 区分"持仓"vs"分析持仓"
4. **用户体验** - 快速响应 > 过度分析

---

## 测试建议

### 测试用例

| 用户输入 | 预期行为 | 工具调用 |
|---------|---------|---------|
| "我的持仓" | 只显示持仓列表 | get_account_info, get_positions |
| "账户" | 只显示账户信息 | get_account_info |
| "我的订单" | 只显示订单列表 | get_orders |
| "分析我的持仓" | 完整分析报告 | get_positions + 价格 + 技术分析 + 估值 |
| "持仓建议" | 分析+建议 | get_positions + 全面分析 + 调仓建议 |
| "我的茅台怎么样" | 单只股票分析 | get_positions + 茅台深度分析 |

---

## 部署

1. ✅ 修改 `src/constants/promptSections.ts`
2. ✅ 运行 `npm run build` 编译
3. ⏳ 重启服务使更改生效
4. ⏳ 测试验证

---

## 后续优化建议

1. **添加意图识别** - 在工具调用前判断用户意图
2. **上下文感知** - 如果用户刚问完持仓又问"怎么样"，理解为"分析持仓"
3. **用户偏好记忆** - 记住用户是喜欢简洁还是详细的风格
4. **性能监控** - 统计工具调用次数，优化过度调用

---

## 文件修改清单

- ✅ `src/constants/promptSections.ts` - System prompt优化
- ✅ `npm run build` - 编译生成 `dist/constants/promptSections.js`

---

## 总结

通过明确区分"信息查询"和"分析请求"，避免了Agent对简单查询的过度分析。这样既提高了响应速度，又保持了深度分析能力，提升了用户体验。
