# 投资业务完善设计文档

> 参考项目：pi-investment
> 目标：将 pi-investment 的核心投资业务能力补充到 investment-claude 中
> 开发风格：以 Claude Code 架构为准

---

## 背景

investment-claude 已有成熟的 Agent 框架（query loop、Tool 接口、buildTool 工厂、压缩/snip/hooks、系统提示词分段注册）和完整的 Python 数据层（akshare_bridge.py，45 个函数）。

缺失的是：投资领域的业务服务层、人格/提示词增强、持仓盈亏感知。

---

## 模块总览

| # | 模块 | 改动范围 | 工作量 |
|---|------|---------|--------|
| 1 | Bootstrap 人格系统 | 新建 `.pi/bootstrap/` 4 个 md 文件 + `prompts.ts` 加载逻辑 | 中 |
| 2 | 持仓管理完善 | `akshare_bridge.py` 完善 `manage_portfolio` + `InvestmentTool.tsx` 加 askUser | 中 |
| 3 | 持仓盈亏感知 | `prompts.ts` 新增 volatileSection + Python 侧 `get_portfolio_pnl` | 中 |
| 4 | Watchlist 观察清单 | `akshare_bridge.py` 新增函数 + `prompt.ts` 补文档 | 小 |
| 5 | 交易日志 | `akshare_bridge.py` 新增函数 + `prompt.ts` 补文档 | 小 |
| 6 | 每日复盘 | `akshare_bridge.py` 新增函数 + `prompt.ts` 补文档 | 中 |
| 7 | 补齐遗漏 + 路径统一 | `akshare_bridge.py` 注册遗漏函数 + 全局 `.pi-invest/` → `.pi/` | 小 |

---

## 模块 1：Bootstrap 人格系统

### 方案

从 `.pi/bootstrap/` 目录加载 markdown 文件，通过 `registerSection` 注入系统提示词。

### 文件清单

| 文件 | 内容 | 来源 |
|------|------|------|
| `IDENTITY.md` | 决策者人格 — "不是建议者，是决策者"；禁止表达（"建议您考虑..."）；正确表达（"买入，分3次建仓"） | pi-investment IDENTITY.md |
| `RULES.md` | 投资硬规则 — ROE≥12%/负债率<60%/毛利率>20%/质量≥65；PE分位<40%才算好价格；止损8%/止盈三档；数据诚信铁律（工具失败=停止，数据必须标注来源） | pi-investment SOUL.md |
| `OUTPUT.md` | 三段式输出格式 — 【决策】买入/观望/回避 + 具体操作指令；【数据】质量/估值/走势一行摘要；【追问】引导用户深入 | pi-investment INVESTMENT_ADVICE.md |
| `SCORING.md` | 交易决策评分体系 — 质量30%+估值25%+技术20%+量化25%；≥70分买入/50-69观望/<50回避；买入和卖出的具体信号条件 | pi-investment trade-decision SKILL |

### 实现

在 `src/constants/prompts.ts` 的 `initSystemPrompt()` 中：

```typescript
// 加载 .pi/bootstrap/ 文件，注册为静态 section（session 内缓存）
registerSection('bootstrap', async (ctx) => {
  const bootstrapDir = join(ctx.cwd, '.pi', 'bootstrap')
  if (!existsSync(bootstrapDir)) return null
  const files = ['IDENTITY.md', 'RULES.md', 'OUTPUT.md', 'SCORING.md']
  const sections: string[] = []
  for (const file of files) {
    const filePath = join(bootstrapDir, file)
    if (existsSync(filePath)) {
      sections.push(readFileSync(filePath, 'utf-8').trim())
    }
  }
  return sections.length > 0 ? sections.join('\n\n---\n\n') : null
})
```

约 20 行代码。文件不存在时静默跳过，不影响无 `.pi/` 目录的场景。

---

## 模块 2：持仓管理完善

### 现状

`manage_portfolio` 在 `akshare_bridge.py` 中已有 get/add/remove，但：
- 没有 `get_with_pnl`（带实时盈亏查询）
- `add` 时不记录 `name`/`market` 字段
- 路径写死 `.pi-invest/`

### 改动

#### 2a. Python 侧（akshare_bridge.py）

**完善 `manage_portfolio` 函数**：

- 新增 `action="get_with_pnl"`：遍历持仓，对每只股票调 `get_stock_realtime_price`（A股）或 `get_hk_stock_price`（港股），计算盈亏百分比和金额，返回完整持仓快照
- `add` 操作：增加 `name`/`market` 参数，自动加权平均成本
- `update` 操作：支持修改 `quantity`/`avg_cost`/`notes`
- 路径改为 `.pi/portfolio.json`

**新增 `manage_cash` 函数**：
- `get`：读取 `.pi/cash.json`
- `update`：更新可用资金（需记录原因）

#### 2b. TypeScript 侧（InvestmentTool.tsx）

**在 `call()` 中添加 askUser 拦截**：

```typescript
async call(input, context) {
  const { function: funcName, ...params } = input

  // 写操作需要用户确认
  const writeOps = ['add', 'remove', 'update']
  if (funcName === 'manage_portfolio' && writeOps.includes(params.action)) {
    if (context.askUser) {
      const desc = formatPortfolioChange(params) // 格式化变更描述
      const answer = await context.askUser(desc, [
        { label: '确认' },
        { label: '取消' },
      ])
      if (answer !== '确认') {
        return { data: { success: false, function: funcName, error: '操作已取消' } }
      }
    }
  }

  // ... 原有逻辑
}
```

同样的 askUser 拦截也适用于 `manage_watchlist`、`manage_trade_log` 的写操作、`manage_cash` 的更新操作。

---

## 模块 3：持仓盈亏感知

### 方案

通过 `registerVolatileSection` 每轮自动注入持仓盈亏摘要到系统提示词。

### 实现

在 `src/constants/prompts.ts` 中注册 volatile section：

```typescript
registerVolatileSection('portfolio_pnl', async (ctx) => {
  const portfolioPath = join(ctx.cwd, '.pi', 'portfolio.json')
  if (!existsSync(portfolioPath)) return null

  // 调用 Python 获取带盈亏的持仓快照
  const snapshot = await callPython('manage_portfolio', { action: 'get_with_pnl' })

  // 格式化为紧凑摘要
  return formatPnlSection(snapshot)
})
```

输出格式：
```
<portfolio_pnl>
持仓盈亏（实时）:
总市值: ¥412,000 | 总成本: ¥385,000 | 总盈亏: +¥27,000 (+7.0%)

600737 中粮糖业  2800股  成本9.29  现价10.15  +2408 (+9.3%)
601088 中国神华   700股  成本35.09  现价33.50  -1113 (-4.5%)
...
更新: 2026-05-12 14:30
</portfolio_pnl>
```

### 性能考虑

- 每轮调用会对所有持仓拉实时价格（约 10-15 只股票）
- Python 侧内部并行请求，预计 2-3 秒
- 非交易时段用最后缓存价格，避免无效请求

---

## 模块 4：Watchlist 观察清单

### 数据存储

`.pi/watchlist.json`，沿用 pi-investment 数据结构：

```json
{
  "items": [{
    "symbol": "002714",
    "name": "牧原股份",
    "market": "A",
    "buy_range_low": 42,
    "buy_range_high": 44,
    "target_price": 52,
    "stop_loss": 39,
    "priority": 1,
    "pool": "A",
    "status": "watching",
    "reason": "猪肉周期上行...",
    "notes": "",
    "created_at": "2026-05-11 13:10:11",
    "updated_at": "2026-05-11 13:10:11"
  }],
  "last_updated": "..."
}
```

### 新增函数（akshare_bridge.py）

- `manage_watchlist(action="list")` — 返回全部项目，按 pool 分组
- `manage_watchlist(action="add", symbol, name, market, buy_range_low, buy_range_high, target_price, stop_loss, priority, pool, reason)` — 添加关注（需 askUser）
- `manage_watchlist(action="remove", symbol)` — 移除（需 askUser）
- `manage_watchlist(action="update", symbol, ...)` — 更新状态/价格区间

注册到 `FUNCTIONS` 表，`InvestmentTool/prompt.ts` 补充函数文档。

---

## 模块 5：交易日志

### 数据存储

`.pi/trade-log/{symbol}-{name}.md`，每只股票独立文件，使用 markdown 模板：

```markdown
# 牧原股份（002714）交易日志

> 创建日期：2026-05-12

## 📋 持仓总览
| 项目 | 数值 |
|------|------|
| 总建仓股数 | 800 |
| 加权成本 | ¥38.74 |
| 总投入 | ¥30,992 |

## 🏗️ 建仓
**买入逻辑：** 猪肉周期上行...
| 日期 | 股数 | 价格 | 金额 |
|------|------|------|------|
| 2026-05-06 | 800 | 38.74 | 30,992 |

## 🎯 交易计划
...
```

### 新增函数（akshare_bridge.py）

- `manage_trade_log(action="list")` — 列出所有日志文件
- `manage_trade_log(action="read", symbol)` — 读取指定日志
- `manage_trade_log(action="create", symbol, name)` — 用模板新建日志（需 askUser）
- `manage_trade_log(action="append", symbol, name, content)` — 追加记录（需 askUser）

---

## 模块 6：每日复盘

### 数据存储

`.pi/reviews/YYYY-MM-DD.md`，每日一个 markdown 报告。

### 新增函数（akshare_bridge.py）

- `daily_review(action="generate")` — 核心功能：
  1. 读取 `.pi/portfolio.json`
  2. 对每只持仓并行拉取：实时价格 + 技术指标 + 新闻
  3. 拉取大盘概览
  4. 生成结构化复盘报告，保存到 `.pi/reviews/YYYY-MM-DD.md`
  5. 返回报告内容

- `daily_review(action="read", date="2026-05-12")` — 读取指定日期复盘
- `daily_review(action="list")` — 列出所有复盘日期

### 复盘报告格式

```markdown
# 每日复盘 2026-05-12

## 大盘环境
上证 3380 (+0.5%) | 深证 10800 (+0.8%) | 创业板 2150 (+1.2%)

## 持仓明细
| 代码 | 名称 | 成本 | 现价 | 盈亏 | 技术面 | 操作建议 |
|------|------|------|------|------|--------|---------|
| 600737 | 中粮糖业 | 9.29 | 10.15 | +9.3% | MA20上方 | 持有 |
| ... | ... | ... | ... | ... | ... | ... |

## 总结
总盈亏: +¥27,000 (+7.0%)
关注事项: ...
```

---

## 模块 7：补齐遗漏 + 路径统一

### 7a. 注册遗漏函数

以下函数在 Python 中已实现但未注册到 `FUNCTIONS` 表：

```python
FUNCTIONS = {
    ...
    # 补齐遗漏
    "get_money_supply": get_money_supply,
    "get_social_finance": get_social_finance,
    "get_gdp_data": get_gdp_data,
    # 新增业务函数
    "manage_watchlist": manage_watchlist,
    "manage_trade_log": manage_trade_log,
    "manage_cash": manage_cash,
    "daily_review": daily_review,
}
```

### 7b. 路径统一

全局替换 `akshare_bridge.py` 中所有 `.pi-invest/` → `.pi/`：
- `portfolio.json` 路径
- 其他可能硬编码的路径

### 7c. 提示词更新

`src/tools/InvestmentTool/prompt.ts` 补充新增函数文档：
- Watchlist 管理（4 个 action）
- 交易日志（4 个 action）
- 每日复盘（3 个 action）
- 资金管理（2 个 action）
- 宏观数据补齐（3 个函数）

---

## askUser 拦截汇总

以下操作在 `InvestmentTool.tsx` 的 `call()` 里拦截，需用户确认后才执行：

| 函数 | 需确认的 action |
|------|----------------|
| `manage_portfolio` | add, remove, update |
| `manage_watchlist` | add, remove, update |
| `manage_trade_log` | create, append |
| `manage_cash` | update |

查询类操作（get, list, read, get_with_pnl, generate）**不拦截**，保持流畅。

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `.pi/bootstrap/IDENTITY.md` | 新建 | 决策者人格 |
| `.pi/bootstrap/RULES.md` | 新建 | 投资硬规则 |
| `.pi/bootstrap/OUTPUT.md` | 新建 | 三段式输出格式 |
| `.pi/bootstrap/SCORING.md` | 新建 | 决策评分体系 |
| `python/akshare_bridge.py` | 修改 | 完善 manage_portfolio + 新增 watchlist/trade-log/review/cash 函数 + 注册遗漏 + 路径统一 |
| `src/tools/InvestmentTool/InvestmentTool.tsx` | 修改 | 添加 askUser 写操作拦截 |
| `src/tools/InvestmentTool/prompt.ts` | 修改 | 补充新函数文档 |
| `src/constants/prompts.ts` | 修改 | 添加 bootstrap 加载 + portfolio_pnl volatile section |
