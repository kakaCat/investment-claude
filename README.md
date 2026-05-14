# Investment Claude - AI 投资顾问

[![CI](https://github.com/YOUR_USERNAME/investment-claude/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/investment-claude/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/YOUR_USERNAME/investment-claude/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/investment-claude)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)

> 基于 Claude Agent SDK 的智能投资分析助手，专注于中国股市（A股和港股）

## 特性

✨ **实时数据** - 基于 akshare 获取实时股票数据
📊 **全面分析** - 基本面、技术面、估值、资金流向一站式分析
🤖 **智能对话** - 自然语言交互，无需记忆复杂命令
📈 **股票筛选** - 按行业、质量、估值等多维度筛选股票
💼 **持仓管理** - 记录和跟踪投资组合
🔔 **风险提示** - 自动提供风险警示和投资建议

## 快速开始

### 安装依赖

```bash
# Node.js 依赖
npm install

# Python 依赖
pip install akshare pandas numpy requests beautifulsoup4
```

### 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### 使用示例

```
你: 贵州茅台现在多少钱？
AI: 贵州茅台 ¥1,443.31 (-0.73%)
    支撑位: ¥1,433 | 阻力位: ¥1,465
    短期震荡整理

你: 帮我分析一下腾讯控股
AI: [提供港股 00700 的综合分析报告]

你: 筛选一些食品饮料行业的优质股票
AI: [按质量评分筛选并展示候选股票]

你: 今天市场怎么样？
AI: [展示主要指数涨跌情况]
```

## 核心功能

### 📈 股票分析
- 实时价格查询（A股/港股）
- 基本面分析（财务指标、报表）
- 技术分析（MA、MACD、RSI、KDJ等）
- 估值分析（PE分位数、质量评分）

### 🔍 市场研究
- 市场概览（指数行情）
- 资金流向（北向资金、行业资金流）
- 新闻资讯（个股新闻、市场新闻）
- 机构数据（龙虎榜、基金持仓、股东信息）

### 🎯 股票筛选
- 按行业筛选
- 按质量评分筛选
- 自定义筛选条件

### 💼 持仓管理
- 添加/删除持仓
- 查看持仓盈亏
- 持仓监控（计划中）

## 技术架构

```
┌─────────────────────────────────────────────────┐
│                   用户交互层                      │
│              (自然语言对话)                       │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              Claude Agent SDK                    │
│         (对话管理、工具调度)                      │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│             InvestmentTool                       │
│         (投资工具统一接口)                        │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│            Python Bridge                         │
│         (Node.js ↔ Python 桥接)                  │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│          akshare_bridge.py                       │
│         (数据获取和处理)                          │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              数据源                               │
│   (akshare / 新浪财经 / 东方财富)                │
└─────────────────────────────────────────────────┘
```

## 可用功能

详细功能列表请查看 [使用文档](docs/USAGE.md)

### 📈 Stock Data (6 functions)
获取股票的实时价格、基本信息和历史行情

- **get_stock_realtime_price** - A股实时价格
  - 参数: `{symbol: "600519"}`
  - 返回: 当前价格、涨跌幅、成交量、成交额
  - 使用场景: 交易时段快速查价

- **get_stock_info** - A股基本信息
  - 参数: `{symbol: "600519"}`
  - 返回: 公司名称、行业、上市日期、总股本
  - 使用场景: 分析前了解公司基础

- **get_stock_history** - A股历史行情
  - 参数: `{symbol: "600519", period?: "daily"|"weekly"|"monthly"}`
  - 返回: 指定周期的 OHLCV 数据
  - 使用场景: 技术分析、回测

- **get_hk_stock_price** - 港股实时价格
  - 参数: `{symbol: "00700"}`
  - 返回: 港币价格、涨跌幅、成交量

- **get_hk_stock_info** - 港股基本信息
  - 参数: `{symbol: "00700"}`
  - 返回: 公司详情、市值、PE

- **get_hk_stock_history** - 港股历史数据
  - 参数: `{symbol: "00700", period?: "daily"}`

### 💰 Financial Analysis (5 functions)
完整的财务报表、关键指标和盈利能力分析

- **get_financial_indicators** - 财务指标
  - 参数: `{symbol: "600519"}`
  - 返回: ROE、ROA、利润率、负债率等
  - 使用场景: 评估公司盈利能力和效率

- **get_balance_sheet** - 资产负债表
  - 参数: `{symbol: "600519"}`
  - 返回: 资产、负债、权益明细
  - 使用场景: 分析财务健康和资本结构

- **get_income_statement** - 利润表
  - 参数: `{symbol: "600519"}`
  - 返回: 营收、成本、利润趋势

- **get_cash_flow** - 现金流量表
  - 参数: `{symbol: "600519"}`
  - 返回: 经营、投资、筹资现金流

- **get_hk_financials** - 港股财务数据
  - 参数: `{symbol: "00700"}`

### 📊 Technical Analysis (3 functions)
技术指标计算和价格走势分析

- **calculate_technical_indicators** - 技术指标
  - 参数: `{symbol: "600519"}`
  - 返回: MA5/10/20/60、MACD、RSI、KDJ、布林带
  - 使用场景: 识别买卖点

- **analyze_price_action** - 深度技术分析
  - 参数: `{symbol: "600519"}`
  - 返回: 趋势分析、支撑阻力、交易信号

- **calculate_buy_range** - 买卖区间
  - 参数: `{symbol: "600519", current_price?: number}`
  - 返回: 基于技术面的建议买卖区间

### 💎 Valuation (4 functions)
估值状态评估和质量评分

- **get_stock_valuation** - 估值状态
  - 参数: `{symbol: "600519"}`
  - 返回: PE、PB、PS 及行业对比
  - 使用场景: 判断高估/低估

- **get_pe_percentile** - PE历史分位数
  - 参数: `{symbol: "600519", years?: 5}`
  - 返回: 当前PE在历史分布中的位置
  - 使用场景: 基于估值周期择时

- **get_quality_score** - 质量评分 (0-100)
  - 参数: `{symbol: "600519"}`
  - 返回: 基于盈利、成长、稳定性的综合评分
  - 使用场景: 筛选优质公司

- **get_exit_plan** - 退出策略
  - 参数: `{symbol: "600519", buy_price: number, shares?: 100}`
  - 返回: 目标价、止损价、仓位管理

### 🌐 Market Data (5 functions)
市场指数、板块资金流向和热门股票

- **get_market_overview** - 市场概览
  - 参数: `{}`
  - 返回: 沪深、创业板指数表现

- **get_sector_fund_flow** - 板块资金流
  - 参数: `{}`
  - 返回: 各板块资金流入流出

- **get_stock_fund_flow** - 个股资金流
  - 参数: `{symbol: "600519"}`
  - 返回: 主力、散户、机构资金流向

- **get_north_flow** - 北向资金
  - 参数: `{}`
  - 返回: 通过互联互通的外资流入

- **get_hot_stocks** - 热门股票
  - 参数: `{market?: "A股"}`
  - 返回: 成交量/额最活跃的股票

### 📰 News & Info (3 functions)
股票新闻、市场资讯和公司公告

- **get_stock_news** - 个股新闻
  - 参数: `{symbol: "600519", num?: 10}`
  - 返回: 该股票的最新新闻

- **get_market_news** - 市场新闻
  - 参数: `{num?: 20}`
  - 返回: 大盘新闻和分析

- **get_announcements** - 公司公告
  - 参数: `{symbol: "600519"}`
  - 返回: 官方披露信息

### 🔍 Stock Screening (2 functions)
按行业、质量、估值等多维度筛选股票

- **screen_stocks_by_sector** - 按板块筛选
  - 参数: `{sector: string, min_roe?: number, max_pe?: number, limit?: 20}`
  - 返回: 符合条件的股票列表
  - 使用场景: 在特定板块寻找投资标的

- **screen_stocks_quality** - 按质量筛选
  - 参数: `{sector: string, min_score?: 50, max_pe?: number, limit?: 10}`
  - 返回: 高质量且估值合理的股票
  - 使用场景: 构建质量导向的投资组合

### 🏢 Institutional Data (6 functions)
机构持仓、龙虎榜和融资融券数据

- **get_lhb** - 龙虎榜
  - 参数: `{symbol?: "600519", date?: "20240101", period?: "近一月"}`
  - 返回: 机构买卖活动

- **get_fund_holdings** - 基金持仓
  - 参数: `{symbol: "600519"}`
  - 返回: 持有该股的基金及仓位

- **get_top_holders** - 十大股东
  - 参数: `{symbol: "600519", date?: "20231231"}`
  - 返回: 前十大股东及持股比例

- **get_margin_data** - 融资融券
  - 参数: `{symbol: "600519"}`
  - 返回: 融资融券余额

- **get_holder_changes** - 股东户数变化
  - 参数: `{symbol: "600519"}`

- **get_insider_trades** - 内部交易
  - 参数: `{symbol: "600519"}`

### 📉 Macro Data (4 functions)
宏观经济指标和货币供应数据

- **get_macro_data** - 宏观指标
  - 参数: `{indicators?: ["pmi", "cpi", "gdp"]}`
  - 返回: 关键经济指标

- **get_money_supply** - 货币供应量
  - 参数: `{}`
  - 返回: M0/M1/M2 增速

- **get_gdp_data** - GDP数据
  - 参数: `{}`
  - 返回: GDP增长及构成

- **get_social_finance** - 社会融资
  - 参数: `{}`

### 💼 Portfolio (1 function)
投资组合管理和收益跟踪

- **manage_portfolio** - 组合管理
  - 参数: `{action: "get"|"add"|"remove", symbol?: string, quantity?: number, avg_cost?: number, notes?: string}`
  - 返回: 持仓及收益情况

### 🇭🇰 HK Stocks (1 function)
港股综合分析

- **get_hk_analysis** - 港股综合分析
  - 参数: `{symbol: "00700"}`
  - 返回: 基本面、技术面、估值的完整分析

## 项目结构

```
investment-claude/
├── src/
│   ├── tools/
│   │   ├── InvestmentTool/
│   │   │   └── InvestmentTool.tsx    # 投资工具主文件
│   │   └── index.ts                   # 工具注册
│   ├── utils/
│   │   └── python-bridge.ts           # Python 桥接层
│   ├── constants/
│   │   ├── prompts.ts                 # 系统提示词入口
│   │   └── promptSections.ts          # 提示词段落
│   └── ...
├── python/
│   └── akshare_bridge.py              # Python 数据获取脚本
├── docs/
│   ├── USAGE.md                       # 使用文档
│   └── ...
└── package.json
```

## 风险提示

⚠️ **重要声明**

- 本工具提供的所有信息仅供参考，不构成投资建议
- 投资有风险，入市需谨慎
- 请根据自身风险承受能力做出投资决策
- 建议结合多方信息进行综合判断

## 数据来源

- **A股数据**: akshare (东方财富、新浪财经)
- **港股数据**: 新浪财经、stooq
- **财务数据**: 东方财富、新浪财经
- **新闻数据**: 东方财富、新浪财经、财新、百度

## 开发指南

### 环境要求

- **Node.js**: >= 18.0.0
- **Python**: >= 3.8
- **npm**: >= 8.0.0
- **操作系统**: macOS / Linux / Windows

### 开发环境设置

#### 1. 克隆项目

```bash
git clone <repository-url>
cd investment-claude
```

#### 2. 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Python 依赖
pip install akshare pandas numpy requests beautifulsoup4
```

#### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置必要的 API 密钥
# ANTHROPIC_API_KEY=your_api_key_here
```

#### 4. 启动开发服务器

```bash
npm run dev
```

### 代码规范

本项目遵循以下代码规范，确保代码质量和一致性：

#### TypeScript/JavaScript 规范

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码

```bash
# 类型检查
npm run typecheck

# 运行测试
npm test
```

#### Python 规范

- 使用 **black** 进行代码格式化
- 使用 **pylint** 进行代码检查
- 使用 **mypy** 进行类型检查

```bash
# 格式化 Python 代码
black python/

# 代码检查
pylint python/

# 类型检查
mypy python/
```

### 项目结构说明

```
investment-claude/
├── src/                          # TypeScript 源代码
│   ├── tools/                    # 工具定义
│   │   ├── InvestmentTool/       # 投资工具主模块
│   │   │   ├── InvestmentTool.tsx    # 工具实现
│   │   │   ├── UI.tsx                # UI 组件
│   │   │   └── prompt.ts             # 提示词定义
│   │   └── index.ts              # 工具注册入口
│   ├── utils/                    # 工具函数
│   │   └── python-bridge.ts      # Python 桥接层
│   ├── constants/                # 常量定义
│   │   ├── prompts.ts            # 系统提示词
│   │   └── promptSections.ts     # 提示词段落
│   ├── agents/                   # Agent 定义
│   └── entrypoints/              # 入口文件
│       └── cli.tsx               # CLI 入口
│
├── python/                       # Python 数据处理模块
│   └── akshare_bridge.py         # AKShare 数据桥接
│
├── docs/                         # 文档目录
│   ├── USAGE.md                  # 使用文档
│   ├── PROJECT_PLAN.md           # 项目计划
│   └── QUANT_ENTERPRISE_ASSESSMENT.md  # 企业级评估
│
├── tests/                        # 测试目录（计划中）
│   ├── unit/                     # 单元测试
│   └── integration/              # 集成测试
│
├── dist/                         # 编译输出目录
├── package.json                  # Node.js 依赖配置
├── tsconfig.json                 # TypeScript 配置
└── README.md                     # 项目说明
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm test -- --coverage

# 运行特定测试文件
npm test -- path/to/test.test.ts
```

### 贡献指南

我们欢迎所有形式的贡献！在提交 PR 之前，请确保：

#### 1. 代码质量检查

```bash
# TypeScript 类型检查
npm run typecheck

# Python 代码格式化
black python/

# Python 代码检查
pylint python/ --rcfile=.pylintrc

# 运行测试
npm test
```

#### 2. 提交规范

使用语义化的提交信息：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建/工具链更新
```

示例：
```bash
git commit -m "feat: 添加美股实时价格查询功能"
git commit -m "fix: 修复港股数据解析错误"
git commit -m "docs: 更新 API 使用文档"
```

#### 3. Pull Request 流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

#### 4. PR 检查清单

- [ ] 代码通过类型检查 (`npm run typecheck`)
- [ ] 代码通过所有测试 (`npm test`)
- [ ] Python 代码已格式化 (`black python/`)
- [ ] 添加了必要的测试用例
- [ ] 更新了相关文档
- [ ] 提交信息符合规范
- [ ] 代码无明显的性能问题

### 调试技巧

#### 1. 调试 TypeScript 代码

```bash
# 使用 tsx 直接运行
tsx src/entrypoints/cli.tsx

# 使用 Node.js 调试器
node --inspect-brk -r tsx/register src/entrypoints/cli.tsx
```

#### 2. 调试 Python 代码

```bash
# 直接运行 Python 脚本
python python/akshare_bridge.py get_stock_realtime_price 600519

# 使用 pdb 调试器
python -m pdb python/akshare_bridge.py
```

#### 3. 查看日志

```bash
# 查看详细日志
DEBUG=* npm run dev

# 查看 Python 桥接日志
tail -f logs/python-bridge.log
```

### 常见开发问题

#### Q: 如何添加新的数据源？
A: 在 `python/akshare_bridge.py` 中添加新的函数，然后在 `src/tools/InvestmentTool/InvestmentTool.tsx` 中注册新的工具方法。

#### Q: 如何修改 AI 提示词？
A: 编辑 `src/constants/promptSections.ts` 文件，修改相应的提示词段落。

#### Q: 如何添加新的技术指标？
A: 在 `python/akshare_bridge.py` 的 `calculate_technical_indicators` 函数中添加计算逻辑。

#### Q: 测试失败怎么办？
A: 检查依赖是否正确安装，确保 Python 环境配置正确，查看错误日志定位问题。

## 后续计划

- [ ] 实现信号生成系统（买入/卖出信号）
- [ ] 实现飞书推送通知
- [ ] 实现持仓监控和止损提醒
- [ ] 添加回测功能
- [ ] 支持美股数据
- [ ] 添加期货/期权分析

## 常见问题

### Q: 数据更新频率是多少？
A: 实时价格在交易时间内实时更新，财务数据随季报更新，新闻每日更新。

### Q: 可以分析美股吗？
A: 当前版本仅支持 A股和港股，美股支持计划中。

### Q: 如何自定义筛选条件？
A: 可以通过修改 `python/akshare_bridge.py` 中的筛选函数来添加自定义条件。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 致谢

- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) - AI Agent 框架
- [AKShare](https://github.com/akfamily/akshare) - 金融数据接口
