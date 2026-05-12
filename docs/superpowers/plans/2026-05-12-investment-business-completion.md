# Investment Business Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add investment business capabilities (bootstrap persona, portfolio P&L, watchlist, trade log, daily review) to the existing investment-claude Agent framework, sharing data with pi-investment via symlinks.

**Architecture:** All new investment functions live in `python/akshare_bridge.py` and are called via the existing `InvestmentTool` → `callPython()` bridge. System prompt enhancements use the existing `registerSection` / `registerVolatileSection` mechanism in `src/constants/prompts.ts`. Write operations go through `askUser` confirmation in `InvestmentTool.tsx`.

**Tech Stack:** TypeScript (Ink/React), Python (akshare), Anthropic SDK

---

## File Structure

| File | Responsibility |
|------|---------------|
| `.pi/bootstrap/IDENTITY.md` | (create) Decisor persona — direct conclusions, no hedging |
| `.pi/bootstrap/OUTPUT.md` | (create) Three-section output format — decision/data/follow-up |
| `.pi/bootstrap/DATA_INTEGRITY.md` | (create) Data integrity rules — tool failure = stop, cite sources |
| `python/akshare_bridge.py` | (modify) Enhance `manage_portfolio`, add `manage_watchlist`, `manage_trade_log`, `manage_cash`, `daily_review`, register missing functions, fix `.pi-invest/` → `.pi/` paths |
| `src/tools/InvestmentTool/InvestmentTool.tsx` | (modify) Add `askUser` confirmation for write operations |
| `src/tools/InvestmentTool/prompt.ts` | (modify) Add documentation for new functions |
| `src/constants/prompts.ts` | (modify) Add bootstrap loader section + portfolio P&L volatile section |

---

### Task 1: Symlink Data Sharing + Path Fix

**Files:**
- Create: `.pi/bootstrap/` (directory)
- Create: `.pi/portfolio.json` (symlink)
- Create: `.pi/watchlist.json` (symlink)
- Create: `.pi/cash.json` (symlink)
- Create: `.pi/reviews/` (symlink)
- Create: `.pi/trade-log/` (symlink)
- Modify: `python/akshare_bridge.py` (path fix)

- [ ] **Step 1: Create `.pi/` directory and bootstrap subdirectory**

```bash
mkdir -p .pi/bootstrap
```

- [ ] **Step 2: Create symlinks to pi-investment data**

```bash
ln -s /Users/mac/Documents/ai/pi-investment/.pi-invest/portfolio.json .pi/portfolio.json
ln -s /Users/mac/Documents/ai/pi-investment/.pi-invest/watchlist.json .pi/watchlist.json
ln -s /Users/mac/Documents/ai/pi-investment/.pi-invest/cash.json .pi/cash.json
ln -s /Users/mac/Documents/ai/pi-investment/.pi-invest/reviews .pi/reviews
ln -s /Users/mac/Documents/ai/pi-investment/.pi-invest/trade-log .pi/trade-log
```

- [ ] **Step 3: Verify symlinks work**

```bash
cat .pi/portfolio.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"holdings\"])} holdings loaded')"
```

Expected: `15 holdings loaded` (or current count)

- [ ] **Step 4: Fix all `.pi-invest/` paths in akshare_bridge.py**

In `python/akshare_bridge.py`, replace the **one** occurrence at line 1356:

```python
# BEFORE:
portfolio_path = os.path.join(os.getcwd(), ".pi-invest", "portfolio.json")

# AFTER:
portfolio_path = os.path.join(os.getcwd(), ".pi", "portfolio.json")
```

- [ ] **Step 5: Verify the Python bridge reads from new path**

```bash
cd /Users/mac/Documents/ai/investment-claude
python/akshare_bridge.py manage_portfolio '{"action": "get"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"holdings\"])} holdings')"
```

Expected: Same count as step 3.

- [ ] **Step 6: Add `.pi/` data files to `.gitignore`**

Append to `.gitignore`:

```
# Investment data (symlinks to pi-investment)
.pi/portfolio.json
.pi/watchlist.json
.pi/cash.json
.pi/reviews
.pi/trade-log
```

Do NOT ignore `.pi/bootstrap/` — those are project-specific files to commit.

- [ ] **Step 7: Commit**

```bash
git add .pi/bootstrap/.gitkeep .gitignore python/akshare_bridge.py
git commit -m "feat: set up .pi/ data directory with symlinks to pi-investment"
```

---

### Task 2: Bootstrap Persona Files

**Files:**
- Create: `.pi/bootstrap/IDENTITY.md`
- Create: `.pi/bootstrap/OUTPUT.md`
- Create: `.pi/bootstrap/DATA_INTEGRITY.md`

- [ ] **Step 1: Create IDENTITY.md**

Write to `.pi/bootstrap/IDENTITY.md`:

```markdown
# 核心定位

你是 **投资决策总监**，不是建议者，是决策者。

## 职责

1. 基于数据做明确投资决策（买入/观望/回避）
2. 给出具体操作指令（买入价、仓位、止损、止盈）
3. 承担决策责任（不推卸给用户）

## 禁止表达

❌ "建议您考虑买入..."
❌ "您可以根据风险偏好决定..."
❌ "这需要您自己判断..."
❌ "仅供参考"

## 正确表达

✅ "买入，分3次建仓，买入价 150~155元"
✅ "观望，等回调到 140元再买入"
✅ "回避，基本面恶化，不符合标准"

## 行为准则

- 宁愿少做但做对，不愿多做却犯错
- 决策简洁有力：结论在前，数据支撑在后
- 不说"非常好的问题""当然可以""很高兴为您分析"
- 用户问 → 直接答。能分析就分析，不问"您想了解哪个方面"
- 能决策就决策，不说"这要看您的风险偏好"
```

- [ ] **Step 2: Create OUTPUT.md**

Write to `.pi/bootstrap/OUTPUT.md`:

```markdown
# 输出格式

## 强制三段式结构

### 第一段：【决策】（3-5行）

【决策】
✅ 买入 / ⏸️ 观望 / ❌ 回避

买入价：XX ~ XX元
仓位：分3次，每次1/3
止损：XX元
止盈：XX元

### 第二段：【数据】（3-5行）

【数据】
质量 XX/100 | 估值 PE XX倍(XX%分位) | 走势 短期XX 中期XX
风险：XX（最重要的1条）

### 第三段：【追问】（1行）

💡 追问："为什么？" "财务如何？" "技术面？"

## 严禁格式

- ❌ "综合分析报告"
- ❌ "一、基本信息"
- ❌ "二、财务数据分析"
- ❌ 任何超过3段的结构
- ❌ 长篇大论的分析报告

用户追问时才展开详细数据。
```

- [ ] **Step 3: Create DATA_INTEGRITY.md**

Write to `.pi/bootstrap/DATA_INTEGRITY.md`:

```markdown
# 数据诚信（零容忍）

## 绝对禁止

- ❌ 编造、模拟、假设任何股票数据（价格/PE/ROE/财务）
- ❌ 用"市场常识"替代真实数据
- ❌ 工具失败后继续分析

## 工具失败 = 立即停止

工具调用失败 → 停止任务 → 告知原因 → 建议重试时间 → 结束

## 数据引用格式（强制）

每个具体数据必须标注来源：

✅ "茅台 1680元（get_stock_realtime_price, 2026-04-01）"
✅ "ROE 32.5%（get_financial_indicators, 2025年报）"

❌ "茅台约1680元"（缺来源）
❌ "ROE很高"（缺数值+来源）

格式：`数据内容（工具名, 时间/来源）`
```

- [ ] **Step 4: Commit**

```bash
git add .pi/bootstrap/
git commit -m "feat: add bootstrap persona files (identity, output format, data integrity)"
```

---

### Task 3: Bootstrap Loader in prompts.ts

**Files:**
- Modify: `src/constants/prompts.ts`

- [ ] **Step 1: Add fs imports and bootstrap section registration**

At the top of `src/constants/prompts.ts`, add the `fs` and `path` imports, then add a `registerSection('bootstrap', ...)` call inside `initSystemPrompt()`, right after the `identity` registration:

```typescript
// Add to imports at top of file:
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
```

Inside `initSystemPrompt()`, after `registerSection('identity', ...)`:

```typescript
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
```

- [ ] **Step 2: Verify it loads by running the dev server**

```bash
npm run dev
```

Type a test message. The AI should now respond in the "decisor" style (direct conclusions, no hedging). If the `.pi/bootstrap/` files don't exist, the system should still start normally (null return = section skipped).

- [ ] **Step 3: Commit**

```bash
git add src/constants/prompts.ts
git commit -m "feat: load bootstrap persona files into system prompt"
```

---

### Task 4: Enhance manage_portfolio in Python

**Files:**
- Modify: `python/akshare_bridge.py` (lines ~1353-1384)

- [ ] **Step 1: Rewrite manage_portfolio with get_with_pnl, update, name/market support**

Replace the entire `manage_portfolio` function (lines 1353-1384) with:

```python
def manage_portfolio(action: str, symbol: str = None, name: str = None, market: str = "A",
                     quantity: int = None, avg_cost: float = None, notes: str = "") -> dict:
    """持仓管理：get / get_with_pnl / add / remove / update"""
    import os
    from datetime import datetime

    portfolio_path = os.path.join(os.getcwd(), ".pi", "portfolio.json")
    os.makedirs(os.path.dirname(portfolio_path), exist_ok=True)

    if not os.path.exists(portfolio_path):
        data = {"holdings": [], "last_updated": ""}
    else:
        with open(portfolio_path) as f:
            data = json.load(f)

    if action == "get":
        return data

    elif action == "get_with_pnl":
        holdings = data.get("holdings", [])
        total_cost = 0
        total_value = 0
        results = []
        for h in holdings:
            sym = h["symbol"]
            mkt = h.get("market", "A")
            qty = h.get("quantity", 0)
            cost = h.get("avg_cost", 0)
            position_cost = qty * cost
            total_cost += position_cost

            # Fetch current price
            try:
                if mkt == "HK":
                    price_data = get_hk_stock_price(sym)
                else:
                    price_data = get_stock_realtime_price(sym)
                current_price = _safe_float(price_data.get("price", price_data.get("current_price", 0)))
                change_pct = _safe_float(price_data.get("change_pct", price_data.get("pct_change", 0)))
            except Exception:
                current_price = cost  # fallback to cost if price fetch fails
                change_pct = 0

            market_value = qty * current_price
            total_value += market_value
            pnl_amount = market_value - position_cost
            pnl_pct = (pnl_amount / position_cost * 100) if position_cost > 0 else 0

            results.append({
                **h,
                "current_price": round(current_price, 3),
                "change_pct": round(change_pct, 2),
                "market_value": round(market_value, 2),
                "pnl_amount": round(pnl_amount, 2),
                "pnl_pct": round(pnl_pct, 2),
            })

        total_pnl = total_value - total_cost
        total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0

        return {
            "holdings": results,
            "total_cost": round(total_cost, 2),
            "total_value": round(total_value, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_pct": round(total_pnl_pct, 2),
            "as_of": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    elif action == "add" and symbol:
        holdings = data["holdings"]
        existing = next((h for h in holdings if h["symbol"] == symbol), None)
        if existing:
            # Weighted average cost
            old_qty = existing.get("quantity", 0)
            old_cost = existing.get("avg_cost", 0)
            new_qty = quantity or old_qty
            new_cost = avg_cost or old_cost
            if quantity and avg_cost and old_qty > 0:
                total_qty = old_qty + quantity
                weighted_cost = (old_qty * old_cost + quantity * avg_cost) / total_qty
                existing["quantity"] = total_qty
                existing["avg_cost"] = round(weighted_cost, 3)
            else:
                if quantity: existing["quantity"] = new_qty
                if avg_cost: existing["avg_cost"] = new_cost
            if name: existing["name"] = name
            if market: existing["market"] = market
            if notes: existing["notes"] = notes
        else:
            holdings.append({
                "symbol": symbol,
                "name": name or symbol,
                "quantity": quantity or 0,
                "avg_cost": avg_cost or 0,
                "market": market,
                "notes": notes,
                "added_date": datetime.now().strftime("%Y-%m-%d"),
            })
        data["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(portfolio_path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": f"已添加/更新 {name or symbol}({symbol})"}

    elif action == "update" and symbol:
        holdings = data["holdings"]
        existing = next((h for h in holdings if h["symbol"] == symbol), None)
        if not existing:
            return {"error": f"未找到持仓 {symbol}"}
        if quantity is not None: existing["quantity"] = quantity
        if avg_cost is not None: existing["avg_cost"] = avg_cost
        if name: existing["name"] = name
        if notes is not None: existing["notes"] = notes
        data["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(portfolio_path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": f"已更新 {symbol}"}

    elif action == "remove" and symbol:
        data["holdings"] = [h for h in data["holdings"] if h["symbol"] != symbol]
        data["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(portfolio_path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": f"已删除 {symbol}"}

    return {"error": f"未知操作: {action}"}
```

- [ ] **Step 2: Add manage_cash function**

Add after `manage_portfolio`:

```python
def manage_cash(action: str = "get", amount: float = None, reason: str = "") -> dict:
    """资金管理：get / update"""
    import os
    from datetime import datetime

    cash_path = os.path.join(os.getcwd(), ".pi", "cash.json")
    os.makedirs(os.path.dirname(cash_path), exist_ok=True)

    if not os.path.exists(cash_path):
        data = {"available_cash": 0, "currency": "CNY", "last_updated": "", "notes": ""}
    else:
        with open(cash_path) as f:
            data = json.load(f)

    if action == "get":
        return data

    elif action == "update" and amount is not None:
        data["available_cash"] = amount
        data["last_updated"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        if reason:
            data["notes"] = reason
        with open(cash_path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": f"资金更新为 ¥{amount:,.2f}", "reason": reason}

    return {"error": f"未知操作: {action}"}
```

- [ ] **Step 3: Register manage_cash in FUNCTIONS table**

In the `FUNCTIONS` dict at the bottom of `akshare_bridge.py`, add:

```python
    "manage_cash": manage_cash,
```

- [ ] **Step 4: Verify manage_portfolio get_with_pnl works**

```bash
python/akshare_bridge.py manage_portfolio '{"action": "get_with_pnl"}' 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Total P&L: {d[\"total_pnl\"]:+.2f} ({d[\"total_pnl_pct\"]:+.2f}%)')"
```

Expected: Something like `Total P&L: +27000.00 (+7.00%)`

- [ ] **Step 5: Commit**

```bash
git add python/akshare_bridge.py
git commit -m "feat: enhance manage_portfolio with get_with_pnl, update action, name/market fields"
```

---

### Task 5: askUser Confirmation for Write Operations

**Files:**
- Modify: `src/tools/InvestmentTool/InvestmentTool.tsx`

- [ ] **Step 1: Add write-operation confirmation logic**

Replace the `call` method in `InvestmentTool.tsx` (the `async call(input, _context)` block, lines ~38-73) with:

```typescript
  async call(input, context) {
    const { function: funcName, ...params } = input

    // Write operations that require user confirmation
    const WRITE_OPS: Record<string, string[]> = {
      manage_portfolio: ['add', 'remove', 'update'],
      manage_watchlist: ['add', 'remove', 'update'],
      manage_trade_log: ['create', 'append'],
      manage_cash: ['update'],
    }

    const writeActions = WRITE_OPS[funcName]
    if (writeActions && writeActions.includes(params.action) && context.askUser) {
      const desc = formatWriteConfirmation(funcName, params)
      const answer = await context.askUser(desc, [
        { label: '确认' },
        { label: '取消' },
      ])
      if (answer !== '确认') {
        return {
          data: {
            success: false,
            error: '操作已取消',
            function: funcName,
          },
        }
      }
    }

    try {
      // 调用 Python 桥接脚本
      const result = await callPython(funcName, params)

      // 检查 Python 返回的错误
      if (result && typeof result === 'object' && 'error' in result) {
        return {
          data: {
            success: false,
            error: result.error,
            function: funcName,
            data: result,
          },
        }
      }

      return {
        data: {
          success: true,
          data: result,
          function: funcName,
        },
      }
    } catch (error) {
      return {
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          function: funcName,
        },
      }
    }
  },
```

- [ ] **Step 2: Add the formatWriteConfirmation helper**

Add before the `investmentToolDef` definition:

```typescript
/** Format a human-readable confirmation message for write operations */
function formatWriteConfirmation(funcName: string, params: Record<string, any>): string {
  const action = params.action ?? ''
  const symbol = params.symbol ?? ''
  const name = params.name ?? symbol

  switch (funcName) {
    case 'manage_portfolio': {
      if (action === 'add') {
        const qty = params.quantity ?? '?'
        const cost = params.avg_cost ?? '?'
        return `确认添加持仓：${name}(${symbol}) ${qty}股 均价¥${cost}？`
      }
      if (action === 'remove') return `确认删除持仓：${name}(${symbol})？`
      if (action === 'update') return `确认更新持仓：${name}(${symbol})？`
      return `确认执行 ${funcName}.${action}？`
    }
    case 'manage_watchlist': {
      if (action === 'add') return `确认添加关注：${name}(${symbol})？`
      if (action === 'remove') return `确认移除关注：${name}(${symbol})？`
      if (action === 'update') return `确认更新关注：${name}(${symbol})？`
      return `确认执行 ${funcName}.${action}？`
    }
    case 'manage_trade_log': {
      if (action === 'create') return `确认创建交易日志：${name}(${symbol})？`
      if (action === 'append') return `确认追加交易记录：${name}(${symbol})？`
      return `确认执行 ${funcName}.${action}？`
    }
    case 'manage_cash': {
      const amount = params.amount ?? '?'
      return `确认更新可用资金为 ¥${amount}？`
    }
    default:
      return `确认执行 ${funcName}？`
  }
}
```

- [ ] **Step 3: Fix the context parameter name**

In the `call` method signature, change `_context` to `context`:

The original had `async call(input, _context)` — we now use `context`, so the underscore prefix must be removed.

- [ ] **Step 4: Commit**

```bash
git add src/tools/InvestmentTool/InvestmentTool.tsx
git commit -m "feat: add askUser confirmation for portfolio/watchlist/trade-log write operations"
```

---

### Task 6: Portfolio P&L Volatile Section

**Files:**
- Modify: `src/constants/prompts.ts`

- [ ] **Step 1: Add callPython import and portfolio_pnl volatile section**

In `src/constants/prompts.ts`, add import for `callPython`:

```typescript
import { callPython } from '../utils/python-bridge.js'
```

Then inside `initSystemPrompt()`, add before the `plan_mode` volatile section:

```typescript
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
```

- [ ] **Step 2: Add the formatPnlSection helper**

Add at the bottom of the file, before the exports:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/constants/prompts.ts
git commit -m "feat: inject real-time portfolio P&L into system prompt every turn"
```

---

### Task 7: Watchlist, Trade Log, Daily Review, and Cash Functions

**Files:**
- Modify: `python/akshare_bridge.py`

- [ ] **Step 1: Add manage_watchlist function**

Add after `manage_cash` in `python/akshare_bridge.py`:

```python
def manage_watchlist(action: str = "list", symbol: str = None, name: str = None,
                     market: str = "A", buy_range_low: float = None, buy_range_high: float = None,
                     target_price: float = None, stop_loss: float = None,
                     priority: int = 3, pool: str = "B", status: str = "watching",
                     reason: str = "", notes: str = "") -> dict:
    """观察清单管理：list / add / remove / update"""
    import os
    from datetime import datetime

    wl_path = os.path.join(os.getcwd(), ".pi", "watchlist.json")
    os.makedirs(os.path.dirname(wl_path), exist_ok=True)

    if not os.path.exists(wl_path):
        data = {"items": [], "last_updated": ""}
    else:
        with open(wl_path) as f:
            data = json.load(f)

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if action == "list":
        return data

    elif action == "add" and symbol:
        items = data["items"]
        existing = next((i for i in items if i["symbol"] == symbol), None)
        if existing:
            return {"error": f"{symbol} 已在观察清单中"}
        items.append({
            "symbol": symbol, "name": name or symbol, "market": market,
            "buy_range_low": buy_range_low or 0, "buy_range_high": buy_range_high or 0,
            "target_price": target_price or 0, "stop_loss": stop_loss or 0,
            "priority": priority, "pool": pool, "status": status,
            "reason": reason, "notes": notes,
            "created_at": now_str, "updated_at": now_str,
        })
        data["last_updated"] = now_str
        with open(wl_path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": f"已添加 {name or symbol} 到观察清单"}

    elif action == "remove" and symbol:
        data["items"] = [i for i in data["items"] if i["symbol"] != symbol]
        data["last_updated"] = now_str
        with open(wl_path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": f"已从观察清单移除 {symbol}"}

    elif action == "update" and symbol:
        items = data["items"]
        existing = next((i for i in items if i["symbol"] == symbol), None)
        if not existing:
            return {"error": f"观察清单中未找到 {symbol}"}
        if buy_range_low is not None: existing["buy_range_low"] = buy_range_low
        if buy_range_high is not None: existing["buy_range_high"] = buy_range_high
        if target_price is not None: existing["target_price"] = target_price
        if stop_loss is not None: existing["stop_loss"] = stop_loss
        if priority is not None: existing["priority"] = priority
        if pool: existing["pool"] = pool
        if status: existing["status"] = status
        if reason: existing["reason"] = reason
        if notes is not None: existing["notes"] = notes
        existing["updated_at"] = now_str
        data["last_updated"] = now_str
        with open(wl_path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": f"已更新 {symbol}"}

    return {"error": f"未知操作: {action}"}
```

- [ ] **Step 2: Add manage_trade_log function**

```python
def manage_trade_log(action: str = "list", symbol: str = None, name: str = None,
                     content: str = "") -> dict:
    """交易日志管理：list / read / create / append"""
    import os, glob
    from datetime import datetime

    log_dir = os.path.join(os.getcwd(), ".pi", "trade-log")
    os.makedirs(log_dir, exist_ok=True)

    if action == "list":
        files = glob.glob(os.path.join(log_dir, "*.md"))
        logs = []
        for f in sorted(files):
            basename = os.path.basename(f)
            logs.append(basename)
        return {"logs": logs, "count": len(logs)}

    elif action == "read" and symbol:
        # Find file matching symbol
        files = glob.glob(os.path.join(log_dir, f"{symbol}-*.md"))
        if not files:
            return {"error": f"未找到 {symbol} 的交易日志"}
        with open(files[0], "r", encoding="utf-8") as f:
            return {"content": f.read(), "file": os.path.basename(files[0])}

    elif action == "create" and symbol and name:
        date = datetime.now().strftime("%Y-%m-%d")
        filename = f"{symbol}-{name}.md"
        filepath = os.path.join(log_dir, filename)
        if os.path.exists(filepath):
            return {"error": f"交易日志已存在: {filename}"}
        template = f"""# {name}（{symbol}）交易日志

> 创建日期：{date}

---

## 📋 持仓总览

| 项目 | 数值 |
|------|------|
| 总建仓股数 | - |
| 加权成本 | - |
| 总投入 | - |

---

## 🏗️ 建仓

**买入逻辑：**
- （待补充）

**建仓记录：**
| 日期 | 股数 | 价格 | 金额 |
|------|------|------|------|

---

## 🎯 交易计划

（待补充）
"""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(template)
        return {"success": True, "message": f"已创建交易日志: {filename}"}

    elif action == "append" and symbol:
        files = glob.glob(os.path.join(log_dir, f"{symbol}-*.md"))
        if not files:
            return {"error": f"未找到 {symbol} 的交易日志，请先 create"}
        with open(files[0], "a", encoding="utf-8") as f:
            f.write(f"\n{content}\n")
        return {"success": True, "message": f"已追加记录到 {os.path.basename(files[0])}"}

    return {"error": f"未知操作: {action}"}
```

- [ ] **Step 3: Add daily_review function**

```python
def daily_review(action: str = "generate", date: str = None) -> dict:
    """每日复盘：generate / read / list"""
    import os, glob
    from datetime import datetime

    reviews_dir = os.path.join(os.getcwd(), ".pi", "reviews")
    os.makedirs(reviews_dir, exist_ok=True)

    if action == "list":
        files = glob.glob(os.path.join(reviews_dir, "*.md"))
        dates = sorted([os.path.basename(f).replace(".md", "") for f in files], reverse=True)
        return {"dates": dates, "count": len(dates)}

    elif action == "read":
        target_date = date or datetime.now().strftime("%Y-%m-%d")
        filepath = os.path.join(reviews_dir, f"{target_date}.md")
        if not os.path.exists(filepath):
            return {"error": f"未找到 {target_date} 的复盘报告"}
        with open(filepath, "r", encoding="utf-8") as f:
            return {"content": f.read(), "date": target_date}

    elif action == "generate":
        today = datetime.now().strftime("%Y-%m-%d")
        portfolio_path = os.path.join(os.getcwd(), ".pi", "portfolio.json")
        if not os.path.exists(portfolio_path):
            return {"error": "未找到持仓文件"}

        with open(portfolio_path) as f:
            portfolio = json.load(f)

        holdings = portfolio.get("holdings", [])
        if not holdings:
            return {"error": "持仓为空，无需复盘"}

        # Get market overview
        try:
            market = get_market_overview()
        except Exception:
            market = {"error": "大盘数据不可用"}

        # Generate report
        lines = [f"# 每日复盘 {today}", ""]

        # Market section
        lines.append("## 大盘环境")
        if "error" not in market:
            indices = market.get("indices", [])
            if isinstance(indices, list):
                idx_parts = []
                for idx in indices[:3]:
                    if isinstance(idx, dict):
                        idx_name = idx.get("name", "?")
                        idx_price = idx.get("price", idx.get("close", "?"))
                        idx_change = idx.get("change_pct", idx.get("pct_change", "?"))
                        idx_parts.append(f"{idx_name} {idx_price} ({idx_change}%)")
                lines.append(" | ".join(idx_parts) if idx_parts else "数据不可用")
            else:
                lines.append("数据不可用")
        else:
            lines.append("大盘数据不可用")
        lines.append("")

        # Holdings section
        lines.append("## 持仓明细")
        lines.append("| 代码 | 名称 | 成本 | 现价 | 盈亏 | 操作建议 |")
        lines.append("|------|------|------|------|------|---------|")

        total_cost = 0
        total_value = 0
        for h in holdings:
            sym = h["symbol"]
            h_name = h.get("name", sym)
            qty = h.get("quantity", 0)
            cost = h.get("avg_cost", 0)
            mkt = h.get("market", "A")
            position_cost = qty * cost
            total_cost += position_cost

            try:
                if mkt == "HK":
                    pd = get_hk_stock_price(sym)
                else:
                    pd = get_stock_realtime_price(sym)
                cp = _safe_float(pd.get("price", pd.get("current_price", 0)))
            except Exception:
                cp = cost

            mv = qty * cp
            total_value += mv
            pnl_pct = ((cp - cost) / cost * 100) if cost > 0 else 0
            pnl_str = f"{pnl_pct:+.1f}%"
            lines.append(f"| {sym} | {h_name} | {cost} | {cp} | {pnl_str} | - |")

        lines.append("")

        # Summary
        total_pnl = total_value - total_cost
        total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0
        lines.append("## 总结")
        lines.append(f"总盈亏: {'+'if total_pnl>=0 else ''}¥{total_pnl:,.0f} ({total_pnl_pct:+.1f}%)")
        lines.append("")

        report = "\n".join(lines)

        # Save
        filepath = os.path.join(reviews_dir, f"{today}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(report)

        return {"success": True, "date": today, "report": report, "file": f"{today}.md"}

    return {"error": f"未知操作: {action}"}
```

- [ ] **Step 4: Register all new functions in FUNCTIONS table**

Add to the `FUNCTIONS` dict:

```python
    # Portfolio & data management
    "manage_watchlist": manage_watchlist,
    "manage_trade_log": manage_trade_log,
    "manage_cash": manage_cash,
    "daily_review": daily_review,
```

- [ ] **Step 5: Verify new functions work**

```bash
python/akshare_bridge.py manage_watchlist '{"action": "list"}' | python3 -m json.tool | head -5
python/akshare_bridge.py manage_trade_log '{"action": "list"}' | python3 -m json.tool
python/akshare_bridge.py manage_cash '{"action": "get"}' | python3 -m json.tool
python/akshare_bridge.py daily_review '{"action": "list"}' | python3 -m json.tool
```

- [ ] **Step 6: Commit**

```bash
git add python/akshare_bridge.py
git commit -m "feat: add watchlist, trade log, daily review, and cash management functions"
```

---

### Task 8: Register Missing Macro Functions

**Files:**
- Modify: `python/akshare_bridge.py`

- [ ] **Step 1: Add missing functions to FUNCTIONS table**

These functions already exist in the file but were never registered:

```python
    "get_money_supply": get_money_supply,
    "get_social_finance": get_social_finance,
    "get_gdp_data": get_gdp_data,
```

- [ ] **Step 2: Verify they work**

```bash
python/akshare_bridge.py get_money_supply '{}' 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if 'error' not in d else d['error'])"
```

- [ ] **Step 3: Commit**

```bash
git add python/akshare_bridge.py
git commit -m "feat: register missing macro functions (money_supply, social_finance, gdp_data)"
```

---

### Task 9: Update InvestmentTool Prompt Documentation

**Files:**
- Modify: `src/tools/InvestmentTool/prompt.ts`

- [ ] **Step 1: Add new function documentation to INVESTMENT_TOOL_DESCRIPTION**

Append these sections before the `## Example Usage` section in the description string:

```typescript
### 📋 Watchlist Management (1 function)
- **manage_watchlist** - Manage stock watchlist
  - Params: {action: "list"|"add"|"remove"|"update", symbol?, name?, market?, buy_range_low?, buy_range_high?, target_price?, stop_loss?, priority?, pool?, status?, reason?, notes?}
  - Actions:
    - list: View all watched stocks grouped by pool (A=core, B=candidate, C=research)
    - add: Add stock to watchlist with target prices and rationale
    - remove: Remove stock from watchlist
    - update: Update status (watching/ready/bought/discarded) or price targets
  - Use case: Track stocks you want to buy but haven't yet

### 📝 Trade Log (1 function)
- **manage_trade_log** - Manage per-stock trade journals
  - Params: {action: "list"|"read"|"create"|"append", symbol?, name?, content?}
  - Actions:
    - list: List all trade log files
    - read: Read trade log for a specific stock
    - create: Create new trade log from template
    - append: Add entry to existing trade log
  - Use case: Document buy/sell rationale and track trade history

### 📊 Daily Review (1 function)
- **daily_review** - Generate and manage daily portfolio reviews
  - Params: {action: "generate"|"read"|"list", date?}
  - Actions:
    - generate: Create today's review (fetches prices for all holdings, saves to .pi/reviews/)
    - read: Read review for a specific date
    - list: List all available review dates
  - Use case: End-of-day portfolio health check

### 💰 Cash Management (1 function)
- **manage_cash** - Manage available cash balance
  - Params: {action: "get"|"update", amount?, reason?}
  - Actions:
    - get: View current available cash
    - update: Update cash balance with reason
  - Use case: Track available funds for new investments

### 📉 Additional Macro Data (3 functions)
- **get_money_supply** - Get M0/M1/M2 money supply data
- **get_social_finance** - Get total social financing data
- **get_gdp_data** - Get quarterly GDP data
```

- [ ] **Step 2: Add new functions to FUNCTION_CATEGORIES**

```typescript
  'Watchlist': [
    'manage_watchlist',
  ],
  'Trade Log': [
    'manage_trade_log',
  ],
  'Daily Review': [
    'daily_review',
  ],
  'Cash': [
    'manage_cash',
  ],
```

And add the three macro functions to the existing `'Macro Data'` category:

```typescript
  'Macro Data': [
    'get_macro_data',
    'get_money_supply',
    'get_social_finance',
    'get_gdp_data',
  ],
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/InvestmentTool/prompt.ts
git commit -m "docs: add watchlist, trade log, daily review, cash management to tool documentation"
```

---

## Verification

After all tasks are complete:

1. `npm run dev` — start the agent, verify bootstrap persona loads (direct decisor style)
2. Ask "看看我的持仓" — should call `manage_portfolio(get_with_pnl)` and show P&L
3. Check system prompt includes `<portfolio_pnl>` section with real-time data
4. Ask "添加 000001 平安银行 到观察清单" — should trigger askUser confirmation
5. Ask "今天复盘一下" — should generate review report
6. Verify symlink data matches: `diff <(cat .pi/portfolio.json) <(cat /Users/mac/Documents/ai/pi-investment/.pi-invest/portfolio.json)`
