# 投资仪表盘设计文档

## 概述

创建一个富文本终端UI仪表盘，整合持仓、决策日志、市场数据和风险提示，提供类似专业交易员工作台的体验。

## 目标

- 替代markdown表格，提供更直观的数据展示
- 整合多个数据源（portfolio.json、decision-log.md、watchlist.json、akshare API）
- 支持命令式交互，保持终端操作的高效性
- 实时更新市场数据，静态展示持仓和决策

## 用户场景

用户启动仪表盘后，可以：
1. 一眼看到持仓盈亏、最近决策、市场行情、风险提示
2. 按 `:` 键输入命令进行股票分析、筛选、交易记录
3. 市场数据自动刷新（可配置间隔）
4. 快捷键快速操作（r刷新、q退出、?帮助）

## 技术方案

**选择：方案A - 纯Ink组件 + 自定义布局**

理由：
- 项目已使用Ink，无需引入新依赖
- 完全控制布局和样式
- React风格，代码可读性好
- 轻量级，性能优秀

## 整体架构

### 组件结构

```
Dashboard (主容器)
├── PortfolioPanel (左上 - 持仓)
├── DecisionLogPanel (右上 - 决策日志)
├── MarketPanel (左下 - 指数 + 自选股)
├── AlertPanel (右下 - 风险提示)
└── CommandInput (底部 - 命令输入框，按 : 唤醒)
```

### 数据流

1. **启动时**：加载 portfolio.json、decision-log.md、watchlist.json
2. **定时刷新**：每隔配置的间隔（默认60秒）调用 akshare 更新行情数据
3. **命令执行**：用户输入命令 → 调用现有的 InvestmentTool → 更新相关面板数据

### 状态管理

```typescript
type DashboardState = {
  portfolio: Portfolio        // 持仓数据（静态）
  decisions: Decision[]       // 决策日志（静态）
  watchlist: Stock[]          // 自选股（动态刷新）
  indices: Index[]            // 指数（动态刷新）
  alerts: Alert[]             // 风险提示（计算得出）
  refreshInterval: number     // 刷新间隔（可配置）
  commandMode: boolean        // 是否在命令输入模式
}
```

### 数据类型定义

```typescript
type Portfolio = {
  totalValue: number
  totalProfit: number
  profitRate: number
  holdings: Holding[]
}

type Holding = {
  code: string
  name: string
  quantity: number
  cost: number
  currentPrice: number
  marketValue: number
  profit: number
  profitRate: number
}

type Decision = {
  date: string
  time: string
  code: string
  name: string
  type: 'buy' | 'sell' | 'hold' | 'avoid'
  reason: string
  verifyDate?: string
}

type Stock = {
  code: string
  name: string
  price: number
  change: number
  changeRate: number
}

type Index = {
  name: string
  value: number
  change: number
  changeRate: number
}

type Alert = {
  type: 'error' | 'warning' | 'info'
  category: 'data' | 'risk' | 'todo'
  message: string
}
```

## 面板设计

### 1. PortfolioPanel (左上 - 持仓)

**数据源：** `.pi/portfolio.json`

**布局：**
```
┌─ 💼 持仓 (总市值: ¥595,772 | 总盈亏: +¥51,920 +9.5%) ─┐
│ 代码    名称      数量    成本      现价      市值      盈亏    │
│ 000425  徐工机械  400    ¥6.78   ¥10.25   ¥4,100   +51.2%  │
│ 601288  农业银行  1,100  ¥4.70   ¥6.76    ¥7,436   +43.8%  │
│ 601088  中国神华  400    ¥35.89  ¥45.17   ¥18,068  +25.8%  │
└──────────────────────────────────────────────────────────────┘
```

**特性：**
- 标题栏显示总市值和总盈亏
- 盈亏用颜色标识（绿色为盈利，红色为亏损）
- 按市值从大到小排序
- 支持滚动（如果持仓超过面板高度）
- 占屏幕左上 50% 宽度 × 50% 高度

**实现要点：**
- 使用 `<Box>` 组件设置边框和padding
- 使用 `<Text>` 组件的 `color` 属性设置颜色
- 表格对齐使用固定宽度字符串格式化

---

### 2. DecisionLogPanel (右上 - 决策日志)

**数据源：** `.pi/decision-log.md`

**布局：**
```
┌─ 📝 最近决策 ─────────────────────────────────────────────┐
│ 05-14 18:04  ✅ 青岛啤酒(600600) 加仓                      │
│              PE 5.83%分位，建议1000股                      │
│                                                            │
│ 05-14 18:04  ⏸️  腾讯控股(00700) 持有                      │
│              港股数据不可用，待恢复后重评                   │
│                                                            │
│ 05-14 14:04  ⏸️  小米集团(01810) 持有                      │
│              数据故障，无法判断                             │
│                                                            │
│ ⚠️  3条决策待7日验证                                        │
└──────────────────────────────────────────────────────────┘
```

**特性：**
- 只显示最近5条决策
- 决策类型用emoji标识（✅买入 / ❌回避 / ⏸️持有 / 💰卖出）
- 每条决策显示时间、股票、决策类型、核心理由
- 底部显示待验证决策数量
- 占屏幕右上 50% 宽度 × 50% 高度

**实现要点：**
- 解析 decision-log.md 的markdown表格
- 提取决策类型、时间、股票、理由字段
- 计算待验证数量（7天内的决策）

---

### 3. MarketPanel (左下 - 指数 + 自选股)

**数据源：** akshare API + `watchlist.json`

**布局：**
```
┌─ 📈 市场 (更新: 18:45:32) ────────────────────────────────┐
│ 【指数】                                                   │
│ 上证指数  3,089.26  +0.45%  ↑                             │
│ 深证成指  9,234.18  -0.23%  ↓                             │
│ 恒生指数  19,847.5  -1.05%  ↓                             │
│                                                            │
│ 【自选股】                                                 │
│ 600519  贵州茅台  ¥1,443.31  -0.73%  ↓                    │
│ 000858  五粮液    ¥128.45    +1.20%  ↑                    │
└──────────────────────────────────────────────────────────┘
```

**特性：**
- 标题栏显示最后更新时间
- 指数部分显示上证、深证、恒生三大指数
- 自选股部分显示 watchlist.json 中的股票
- 涨跌用颜色 + 箭头标识（绿色↑上涨，红色↓下跌）
- 自选股支持滚动
- 占屏幕左下 50% 宽度 × 50% 高度

**实现要点：**
- 调用 akshare API 获取指数和个股行情
- 定时刷新（默认60秒）
- 错误处理：API失败时显示上次数据 + "(数据可能过期)"

---

### 4. AlertPanel (右下 - 风险提示)

**数据源：** 计算得出

**布局：**
```
┌─ ⚠️  风险提示 ────────────────────────────────────────────┐
│ 【数据源状态】                                             │
│ ✅ A股数据正常                                             │
│ ❌ 港股数据不可用 (akshare故障)                            │
│                                                            │
│ 【风险警告】                                               │
│ • 腾讯控股(00700) 无法获取最新数据                         │
│ • 徐工机械(000425) 盈亏+51%，建议止盈                      │
│                                                            │
│ 【待办事项】                                               │
│ • 05-20 复盘: 中粮糖业回避决策                             │
│ • 05-20 复盘: 腾讯控股加仓决策                             │
└──────────────────────────────────────────────────────────┘
```

**特性：**
- 实时检测数据源健康状态（A股/港股API是否可用）
- 自动计算风险（高估、重仓、数据缺失）
- 提醒7日后需要复盘的决策
- 占屏幕右下 50% 宽度 × 50% 高度

**风险计算规则：**
- 单只股票盈亏超过±30% → 提示止盈/止损
- 单只股票市值占比超过30% → 提示重仓风险
- 港股/A股数据获取失败 → 提示数据源异常
- 决策日志中待验证的决策 → 提示复盘日期

## 命令输入与交互

### CommandInput 组件

**触发方式：**
- 默认隐藏，仪表盘全屏显示
- 按 `:` 键唤醒命令输入框
- 输入完成按 `Enter` 执行，按 `Esc` 取消

**命令格式：**
```
:analyze 腾讯          # 分析股票
:screen 低估值         # 筛选股票
:buy 600519 100       # 记录买入
:sell 000425 200      # 记录卖出
:refresh              # 手动刷新数据
:config interval 30   # 设置刷新间隔为30秒
:help                 # 显示帮助
:quit                 # 退出
```

**命令执行流程：**
1. 解析命令 → 识别命令类型和参数
2. 调用对应的 InvestmentTool（复用现有工具）
3. 工具返回结果 → 更新面板数据或显示临时弹窗
4. 命令输入框自动隐藏，回到仪表盘

**结果展示方式：**

**方式1：更新面板**（适合数据变更类命令）
- `:buy` / `:sell` → 更新 PortfolioPanel
- `:refresh` → 刷新所有动态数据

**方式2：临时弹窗**（适合查询类命令）
```
┌─ 分析结果 ────────────────────────────────────────────────┐
│ 腾讯控股 (00700)                                           │
│ 现价: HK$459.80  PE: 18.5倍  PB: 3.2倍                    │
│ 评级: 持有                                                 │
│ 理由: 港股数据源不可用，无法全面评估...                    │
│                                                            │
│ [按任意键关闭]                                             │
└──────────────────────────────────────────────────────────┘
```

**快捷键：**
- `:` - 唤醒命令输入
- `Esc` - 取消输入 / 关闭弹窗
- `r` - 快捷刷新（等同于 `:refresh`）
- `q` - 快捷退出（等同于 `:quit`）
- `?` - 快捷帮助（等同于 `:help`）

### 命令解析器

```typescript
type Command = {
  type: 'analyze' | 'screen' | 'buy' | 'sell' | 'refresh' | 'config' | 'help' | 'quit'
  args: string[]
}

function parseCommand(input: string): Command {
  const parts = input.trim().split(/\s+/)
  const type = parts[0]
  const args = parts.slice(1)
  return { type, args }
}
```

### 命令处理器

```typescript
async function handleCommand(cmd: Command, state: DashboardState): Promise<void> {
  switch (cmd.type) {
    case 'analyze':
      // 调用 InvestmentTool 分析股票
      const result = await analyzeStock(cmd.args[0])
      showModal(result)
      break

    case 'buy':
      // 记录买入，更新 portfolio.json
      await recordBuy(cmd.args[0], parseInt(cmd.args[1]))
      await reloadPortfolio()
      break

    case 'refresh':
      // 刷新所有数据
      await refreshAll()
      break

    case 'config':
      // 修改配置
      await updateConfig(cmd.args[0], cmd.args[1])
      break

    // ... 其他命令
  }
}
```

## 数据刷新与配置

### 刷新策略

**刷新配置：**
```typescript
type RefreshConfig = {
  interval: number           // 刷新间隔（秒），默认60
  autoRefresh: boolean       // 是否自动刷新，默认true
  refreshOnCommand: boolean  // 命令执行后是否刷新，默认true
}
```

**刷新逻辑：**

1. **启动时**：加载所有数据（静态 + 动态）
2. **定时器**：每隔 `interval` 秒刷新动态数据
   - 调用 akshare 获取自选股行情
   - 调用 akshare 获取指数数据
   - 更新持仓的现价和盈亏（基于最新行情）
3. **命令触发**：执行 `:buy` / `:sell` 后自动刷新
4. **手动刷新**：按 `r` 或 `:refresh` 立即刷新

**错误处理：**
- API调用失败 → 在 AlertPanel 显示错误
- 保留上次成功的数据，显示 "(数据可能过期)"
- 自动重试（最多3次，间隔5秒）

### 配置文件

**位置：** `.pi/dashboard-config.json`

**内容：**
```json
{
  "refreshInterval": 60,
  "autoRefresh": true,
  "theme": {
    "profit": "green",
    "loss": "red",
    "neutral": "gray"
  },
  "panels": {
    "portfolio": {
      "maxRows": 10,
      "sortBy": "marketValue"
    },
    "decisionLog": {
      "maxRows": 5
    },
    "market": {
      "indexCount": 3,
      "watchlistMaxRows": 5
    }
  }
}
```

**配置命令：**
```
:config interval 30        # 设置刷新间隔
:config autoRefresh false  # 关闭自动刷新
:config theme.profit cyan  # 修改盈利颜色
```

### 性能优化

1. **增量更新**：只刷新变化的数据，不重新渲染整个仪表盘
2. **缓存机制**：akshare 数据缓存5秒，避免重复请求
3. **懒加载**：面板内容超出高度时，只渲染可见部分
4. **防抖**：命令输入有200ms防抖，避免频繁触发

## 技术实现

### 目录结构

```
src/
├── screens/
│   └── Dashboard.tsx              # 主仪表盘组件
├── components/
│   ├── dashboard/
│   │   ├── PortfolioPanel.tsx     # 持仓面板
│   │   ├── DecisionLogPanel.tsx   # 决策日志面板
│   │   ├── MarketPanel.tsx        # 市场面板
│   │   ├── AlertPanel.tsx         # 风险提示面板
│   │   ├── CommandInput.tsx       # 命令输入框
│   │   ├── ResultModal.tsx        # 结果弹窗
│   │   └── Table.tsx              # 通用表格组件
│   └── ...
├── hooks/
│   ├── useDashboardData.ts        # 数据加载hook
│   ├── useAutoRefresh.ts          # 自动刷新hook
│   └── useCommandParser.ts        # 命令解析hook
├── utils/
│   ├── dashboardConfig.ts         # 配置加载/保存
│   └── alertCalculator.ts         # 风险计算
└── entrypoints/
    └── dashboard.tsx              # 仪表盘入口
```

### 核心组件实现

**Dashboard.tsx 结构：**

```typescript
export function Dashboard() {
  const [state, setState] = useState<DashboardState>({
    portfolio: null,
    decisions: [],
    watchlist: [],
    indices: [],
    alerts: [],
    refreshInterval: 60,
    commandMode: false,
  })
  const [modalContent, setModalContent] = useState<string | null>(null)

  // 加载初始数据
  useEffect(() => {
    loadPortfolio()
    loadDecisionLog()
    loadWatchlist()
    loadConfig()
  }, [])

  // 自动刷新
  useAutoRefresh(state.refreshInterval, () => {
    refreshMarketData()
  })

  // 快捷键处理
  useInput((input, key) => {
    if (modalContent) {
      // 弹窗模式：任意键关闭
      setModalContent(null)
      return
    }

    if (state.commandMode) {
      // 命令输入模式：由 CommandInput 处理
      return
    }

    // 仪表盘模式
    if (input === ':') setCommandMode(true)
    if (input === 'r') refreshAll()
    if (input === 'q') process.exit(0)
    if (input === '?') showHelp()
    if (key.escape) setCommandMode(false)
  })

  return (
    <Box flexDirection="column" height="100%">
      {/* 四宫格布局 */}
      <Box flexGrow={1}>
        <Box flexDirection="row" height="50%">
          <Box width="50%" borderStyle="single" borderColor="gray">
            <PortfolioPanel data={state.portfolio} />
          </Box>
          <Box width="50%" borderStyle="single" borderColor="gray">
            <DecisionLogPanel data={state.decisions} />
          </Box>
        </Box>
        <Box flexDirection="row" height="50%">
          <Box width="50%" borderStyle="single" borderColor="gray">
            <MarketPanel
              indices={state.indices}
              watchlist={state.watchlist}
              lastUpdate={state.lastUpdate}
            />
          </Box>
          <Box width="50%" borderStyle="single" borderColor="gray">
            <AlertPanel alerts={state.alerts} />
          </Box>
        </Box>
      </Box>

      {/* 命令输入框 */}
      {state.commandMode && (
        <CommandInput
          onSubmit={handleCommand}
          onCancel={() => setCommandMode(false)}
        />
      )}

      {/* 结果弹窗 */}
      {modalContent && (
        <ResultModal content={modalContent} onClose={() => setModalContent(null)} />
      )}
    </Box>
  )
}
```

**useAutoRefresh hook：**

```typescript
export function useAutoRefresh(interval: number, callback: () => void) {
  useEffect(() => {
    const timer = setInterval(callback, interval * 1000)
    return () => clearInterval(timer)
  }, [interval, callback])
}
```

**Table 组件（通用表格）：**

```typescript
type TableProps = {
  headers: string[]
  rows: string[][]
  columnWidths: number[]
  colorize?: (row: string[], rowIndex: number) => string[]
}

export function Table({ headers, rows, columnWidths, colorize }: TableProps) {
  const formatRow = (cells: string[]) => {
    return cells.map((cell, i) => cell.padEnd(columnWidths[i])).join('  ')
  }

  return (
    <Box flexDirection="column">
      <Text bold>{formatRow(headers)}</Text>
      {rows.map((row, i) => {
        const colors = colorize ? colorize(row, i) : []
        return (
          <Text key={i} color={colors[i]}>
            {formatRow(row)}
          </Text>
        )
      })}
    </Box>
  )
}
```

### 与现有代码集成

**启动方式：**

1. **新增命令：** `pi dashboard` 或 `npm run dashboard`
2. **入口文件：** `src/entrypoints/dashboard.tsx`
3. **package.json 添加脚本：**
   ```json
   {
     "scripts": {
       "dashboard": "tsx src/entrypoints/dashboard.tsx"
     }
   }
   ```

**代码复用：**
- 复用 `src/tools/InvestTools/` 的所有工具
- 复用 `python/akshare_bridge.py` 的数据获取逻辑
- 复用 `.pi/portfolio.json`、`.pi/decision-log.md`、`.pi/watchlist.json` 数据文件

**不影响现有功能：**
- REPL 对话模式保持不变（`npm run dev`）
- 仪表盘作为独立模式（`npm run dashboard`），互不干扰

### 数据加载实现

**加载持仓数据：**
```typescript
async function loadPortfolio(): Promise<Portfolio> {
  const data = await fs.readFile('.pi/portfolio.json', 'utf-8')
  const portfolio = JSON.parse(data)

  // 计算总市值和总盈亏
  const totalValue = portfolio.holdings.reduce((sum, h) => sum + h.marketValue, 0)
  const totalCost = portfolio.holdings.reduce((sum, h) => sum + h.cost * h.quantity, 0)
  const totalProfit = totalValue - totalCost
  const profitRate = (totalProfit / totalCost) * 100

  return { ...portfolio, totalValue, totalProfit, profitRate }
}
```

**解析决策日志：**
```typescript
async function loadDecisionLog(): Promise<Decision[]> {
  const content = await fs.readFile('.pi/decision-log.md', 'utf-8')

  // 正则匹配决策记录
  const decisionRegex = /### 决策 #\d+：(.+?)— (.+?)\n\n\| 项目 \| 内容 \|\n\|------|------\|\n\| \*\*时间\*\* \| (.+?) \|\n.*?\| \*\*决策\*\* \| (.+?) \|\n\| \*\*理由\*\* \| (.+?) \|/gs

  const decisions: Decision[] = []
  let match

  while ((match = decisionRegex.exec(content)) !== null) {
    const [, stockInfo, decisionType, time, , reason] = match
    const [name, code] = stockInfo.split('（')

    decisions.push({
      date: time.split(' ')[0],
      time: time.split(' ')[1],
      code: code?.replace('）', '') || '',
      name: name.trim(),
      type: parseDecisionType(decisionType),
      reason: reason.trim(),
    })
  }

  return decisions.slice(0, 5) // 只返回最近5条
}
```

**刷新市场数据：**
```typescript
async function refreshMarketData(): Promise<{ indices: Index[], watchlist: Stock[] }> {
  // 调用 akshare API
  const [indicesData, watchlistData] = await Promise.all([
    fetchIndices(['上证指数', '深证成指', '恒生指数']),
    fetchStocks(state.watchlist.map(s => s.code)),
  ])

  return { indices: indicesData, watchlist: watchlistData }
}
```

### 测试策略

1. **单元测试：**
   - 测试命令解析器（parseCommand）
   - 测试风险计算器（alertCalculator）
   - 测试数据加载函数（loadPortfolio, loadDecisionLog）

2. **集成测试：**
   - 测试命令执行流程（handleCommand）
   - 测试数据刷新流程（refreshMarketData）

3. **手动测试：**
   - 在真实终端中测试布局和交互
   - 测试不同终端尺寸下的显示效果
   - 测试快捷键和命令输入

## 实现步骤

1. **创建基础组件**
   - 实现 Table 通用表格组件
   - 实现 CommandInput 命令输入框
   - 实现 ResultModal 结果弹窗

2. **实现四个面板**
   - PortfolioPanel
   - DecisionLogPanel
   - MarketPanel
   - AlertPanel

3. **实现数据加载**
   - loadPortfolio
   - loadDecisionLog
   - loadWatchlist
   - refreshMarketData

4. **实现命令系统**
   - parseCommand 命令解析
   - handleCommand 命令处理
   - 集成现有 InvestmentTool

5. **实现自动刷新**
   - useAutoRefresh hook
   - 错误处理和重试逻辑

6. **实现配置系统**
   - 加载/保存配置文件
   - 配置命令处理

7. **测试和优化**
   - 单元测试
   - 集成测试
   - 性能优化

## 验收标准

- [ ] 仪表盘正确显示四个面板
- [ ] 持仓数据正确加载和显示
- [ ] 决策日志正确解析和显示
- [ ] 市场数据自动刷新（可配置间隔）
- [ ] 命令输入框按 `:` 唤醒
- [ ] 所有命令正确执行
- [ ] 快捷键正常工作（r刷新、q退出、?帮助）
- [ ] 风险提示正确计算和显示
- [ ] 配置文件正确加载和保存
- [ ] 错误处理正常（API失败、数据缺失等）
- [ ] 不同终端尺寸下布局正常
