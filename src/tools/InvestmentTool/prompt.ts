/**
 * Investment Tool 提示词配置
 *
 * 为 Claude 提供关于如何使用投资工具的详细说明
 */

export const INVESTMENT_TOOL_DESCRIPTION = `Investment analysis tool for Chinese stock market (A-share and HK stocks).

## Core Capabilities

### 📈 Stock Data
Real-time prices, historical data, and basic information for A-share and HK stocks.

### 💰 Financial Analysis
Complete financial statements, key metrics, and profitability indicators.

### 📊 Technical Analysis
Moving averages, MACD, RSI, Bollinger Bands, and price action analysis.

### 💎 Valuation
PE percentile, quality scoring, and valuation status assessment.

### 🌐 Market Data
Market indices, sector fund flows, northbound capital, and hot stocks.

### 📰 News & Information
Stock news, market news, and company announcements.

### 🔍 Stock Screening
Filter stocks by sector, quality score, financial metrics, and valuation.

### 🏢 Institutional Data
Dragon-tiger list, fund holdings, shareholder information, and margin trading.

### 📉 Macro Data
PMI, CPI, GDP, money supply, and social financing data.

### 💼 Portfolio Management
Track holdings, calculate returns, and manage investment portfolios.

### 💰 Trading (Mock/Simulation)
⚠️ **All trading is simulated - no real money involved**
Place orders, manage positions, track P&L with realistic commission and T+1 rules.

## Available Functions

### 📈 Stock Data (6 functions)
- **get_stock_realtime_price** - Get real-time A-share price
  - Params: {symbol: "600519"}
  - Returns: Current price, change %, volume, turnover
  - Use case: Quick price check during trading hours

- **get_stock_info** - Get A-share basic information
  - Params: {symbol: "600519"}
  - Returns: Company name, industry, listing date, total shares
  - Use case: Understanding company basics before analysis

- **get_stock_history** - Get A-share historical data
  - Params: {symbol: "600519", period?: "daily"|"weekly"|"monthly"}
  - Returns: OHLCV data for specified period
  - Use case: Technical analysis, backtesting

- **get_hk_stock_price** - Get HK stock real-time price
  - Params: {symbol: "00700"}
  - Returns: Current price in HKD, change %, volume
  - Use case: Monitoring HK stock prices

- **get_hk_stock_info** - Get HK stock information
  - Params: {symbol: "00700"}
  - Returns: Company details, market cap, PE ratio
  - Use case: HK stock fundamental overview

- **get_hk_stock_history** - Get HK stock historical data
  - Params: {symbol: "00700", period?: "daily"}
  - Returns: Historical OHLCV data
  - Use case: HK stock technical analysis

### 💰 Financial Analysis (5 functions)
- **get_financial_indicators** - Get key financial metrics
  - Params: {symbol: "600519"}
  - Returns: ROE, ROA, profit margin, debt ratio, etc.
  - Use case: Evaluating company profitability and efficiency

- **get_balance_sheet** - Get balance sheet
  - Params: {symbol: "600519"}
  - Returns: Assets, liabilities, equity breakdown
  - Use case: Analyzing financial health and capital structure

- **get_income_statement** - Get income statement
  - Params: {symbol: "600519"}
  - Returns: Revenue, costs, profits over time
  - Use case: Understanding revenue and profit trends

- **get_cash_flow** - Get cash flow statement
  - Params: {symbol: "600519"}
  - Returns: Operating, investing, financing cash flows
  - Use case: Assessing cash generation ability

- **get_hk_financials** - Get HK stock financials
  - Params: {symbol: "00700"}
  - Returns: Complete financial data for HK stocks
  - Use case: HK stock financial analysis

### 📊 Technical Analysis (3 functions)
- **calculate_technical_indicators** - Calculate technical indicators
  - Params: {symbol: "600519"}
  - Returns: MA5/10/20/60, MACD, RSI, KDJ, Bollinger Bands
  - Use case: Identifying entry/exit points

- **analyze_price_action** - Deep technical analysis
  - Params: {symbol: "600519"}
  - Returns: Trend analysis, support/resistance, signals
  - Use case: Comprehensive technical assessment

- **calculate_buy_range** - Calculate buy/sell range
  - Params: {symbol: "600519", current_price?: number}
  - Returns: Recommended buy/sell zones based on technicals
  - Use case: Setting target prices

### 💎 Valuation (4 functions)
- **get_stock_valuation** - Get valuation status
  - Params: {symbol: "600519"}
  - Returns: PE, PB, PS ratios and industry comparison
  - Use case: Determining if stock is overvalued/undervalued

- **get_pe_percentile** - Get PE historical percentile
  - Params: {symbol: "600519", years?: 5}
  - Returns: Current PE vs historical distribution
  - Use case: Timing entry based on valuation cycles

- **get_quality_score** - Get quality score (0-100)
  - Params: {symbol: "600519"}
  - Returns: Composite score based on profitability, growth, stability
  - Use case: Filtering high-quality companies

- **get_exit_plan** - Get exit strategy
  - Params: {symbol: "600519", buy_price: number, shares?: 100}
  - Returns: Target prices, stop loss, position sizing
  - Use case: Risk management and profit taking

### 🌐 Market Data (5 functions)
- **get_market_overview** - Get market indices overview
  - Params: {}
  - Returns: Shanghai, Shenzhen, ChiNext indices performance
  - Use case: Understanding overall market sentiment

- **get_sector_fund_flow** - Get sector fund flow
  - Params: {}
  - Returns: Capital inflow/outflow by sector
  - Use case: Identifying hot sectors

- **get_stock_fund_flow** - Get stock fund flow
  - Params: {symbol: "600519"}
  - Returns: Main force, retail, institutional flows
  - Use case: Tracking smart money movements

- **get_north_flow** - Get northbound capital flow
  - Params: {}
  - Returns: Foreign capital inflow via Stock Connect
  - Use case: Monitoring foreign investor sentiment

- **get_hot_stocks** - Get hot stocks
  - Params: {market?: "A股"}
  - Returns: Most active stocks by volume/turnover
  - Use case: Finding trading opportunities

### 📰 News & Information (3 functions)
- **get_stock_news** - Get stock-specific news
  - Params: {symbol: "600519", num?: 10}
  - Returns: Recent news articles about the stock
  - Use case: Staying updated on company developments

- **get_market_news** - Get market news
  - Params: {num?: 20}
  - Returns: General market news and analysis
  - Use case: Understanding market drivers

- **get_announcements** - Get company announcements
  - Params: {symbol: "600519"}
  - Returns: Official company disclosures
  - Use case: Checking for material events

### 🔍 Stock Screening (2 functions)
- **screen_stocks_by_sector** - Screen stocks by sector
  - Params: {sector: string, min_roe?: number, max_pe?: number, limit?: 20}
  - Returns: Filtered list of stocks meeting criteria
  - Use case: Finding investment candidates in specific sectors

- **screen_stocks_quality** - Screen by quality score
  - Params: {sector: string, min_score?: 50, max_pe?: number, limit?: 10}
  - Returns: High-quality stocks with reasonable valuation
  - Use case: Building a quality-focused portfolio

### 🏢 Institutional Data (6 functions)
- **get_lhb** - Get dragon-tiger list (large trades)
  - Params: {symbol?: "600519", date?: "20240101", period?: "近一月"}
  - Returns: Institutional buying/selling activity
  - Use case: Tracking institutional interest

- **get_fund_holdings** - Get fund holdings
  - Params: {symbol: "600519"}
  - Returns: Which funds hold the stock and their positions
  - Use case: Understanding institutional ownership

- **get_top_holders** - Get top shareholders
  - Params: {symbol: "600519", date?: "20231231"}
  - Returns: Top 10 shareholders and their stakes
  - Use case: Analyzing ownership structure

- **get_margin_data** - Get margin trading data
  - Params: {symbol: "600519"}
  - Returns: Margin buy/sell balances
  - Use case: Gauging leveraged sentiment

- **get_holder_changes** - Get shareholder count changes
  - Params: {symbol: "600519"}
  - Returns: Changes in number of shareholders
  - Use case: Tracking retail participation

- **get_insider_trades** - Get insider trades
  - Params: {symbol: "600519"}
  - Returns: Director and executive transactions
  - Use case: Monitoring insider sentiment

### 📉 Macro Data (4 functions)
- **get_macro_data** - Get macro indicators
  - Params: {indicators?: ["pmi", "cpi", "gdp"]}
  - Returns: Key economic indicators
  - Use case: Understanding economic backdrop

- **get_money_supply** - Get M0/M1/M2 data
  - Params: {}
  - Returns: Money supply growth rates
  - Use case: Assessing liquidity conditions

- **get_gdp_data** - Get GDP data
  - Params: {}
  - Returns: GDP growth and components
  - Use case: Economic cycle analysis

- **get_social_finance** - Get social financing data
  - Params: {}
  - Returns: Total social financing scale
  - Use case: Credit cycle analysis

### 💼 Portfolio Management (1 function)
- **manage_portfolio** - Manage investment portfolio
  - Params: {action: "get"|"get_with_pnl"|"add"|"remove"|"update", symbol?, name?, market?, quantity?, avg_cost?, notes?}
  - Actions:
    - get: View all holdings
    - get_with_pnl: Get holdings with real-time prices and P&L calculation
    - add: Add new stock to portfolio
    - remove: Remove stock from portfolio
    - update: Update quantity, cost, or notes for existing holding
  - Use case: Tracking investments and returns

### 💰 Trading (Mock/Simulation) (7 functions)
⚠️ **All trading is simulated - no real money involved**

- **get_account_info** - Get account information
  - Params: {}
  - Returns: Cash, total assets, market value, position ratio
  - Use case: Check available funds before trading

- **get_positions** - Get current positions
  - Params: {}
  - Returns: List of holdings with P&L, cost price, current price
  - Use case: Review portfolio holdings and performance

- **get_orders** - Get order history
  - Params: {status?: "pending"|"filled"|"cancelled"|"rejected"}
  - Returns: Order list with details (price, quantity, commission, time)
  - Use case: Review trade history

- **place_order** - Place buy/sell order
  - Params: {symbol: "600519", name: "贵州茅台", direction: "buy"|"sell", price: 1450.00, quantity: 100, current_price: 1450.00}
  - Returns: Order confirmation with commission and updated account
  - Use case: Execute trades (must be multiples of 100 shares)
  - Risk checks: Cash availability, position limits (30% per stock, 90% total), T+1 rule

- **cancel_order** - Cancel pending order
  - Params: {order_id: "ORD20260414001"}
  - Returns: Cancellation confirmation
  - Use case: Cancel unfilled orders (filled orders cannot be cancelled)

- **update_t1_available** - Update T+1 sellable quantity
  - Params: {}
  - Returns: Success message
  - Use case: Run daily to update sellable shares (auto-run in production)

- **reset_account** - Reset account to initial state
  - Params: {initial_cash?: 1000000.0}
  - Returns: Confirmation message
  - Use case: Start fresh simulation (clears all positions and orders)

### 🇭🇰 HK Stocks (1 function)
- **get_hk_analysis** - Comprehensive HK stock analysis
  - Params: {symbol: "00700"}
  - Returns: Complete analysis including fundamentals, technicals, valuation
  - Use case: One-stop HK stock research

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

## Example Usage

\`\`\`json
{
  "function": "get_stock_realtime_price",
  "symbol": "600519"
}
\`\`\`

\`\`\`json
{
  "function": "screen_stocks_quality",
  "sector": "食品饮料",
  "min_score": 70,
  "max_pe": 30,
  "limit": 10
}
\`\`\`

\`\`\`json
{
  "function": "place_order",
  "symbol": "600519",
  "name": "贵州茅台",
  "direction": "buy",
  "price": 1450.00,
  "quantity": 100,
  "current_price": 1450.00
}
\`\`\`

## Usage Guidelines

1. **Stock Symbols**: Use 6-digit codes for A-shares (e.g., "600519") and 5-digit codes for HK stocks (e.g., "00700")
2. **Error Handling**: Always check the success field in responses
3. **Data Freshness**: Real-time data is available during trading hours; historical data is updated daily
4. **Rate Limits**: Be mindful of API rate limits when making multiple requests
5. **Trading Rules**: All trades are simulated; follow T+1 rule (can't sell on same day as purchase)

## Best Practices

- Start with basic info (get_stock_info) before diving into detailed analysis
- Combine multiple data sources for comprehensive analysis
- Use screening functions to discover investment opportunities
- Always consider both fundamental and technical factors
- Check news and announcements for recent developments
- Test trading strategies in simulation before real implementation

## Risk Disclaimer

All data and analysis provided by this tool are for reference only and do not constitute investment advice.
Investment involves risks. Please make decisions based on your own risk tolerance and judgment.
All trading functions are simulated and do not involve real money.
`

export const FUNCTION_CATEGORIES = {
  'Stock Data': [
    'get_stock_realtime_price',
    'get_stock_info',
    'get_stock_history',
    'get_hk_stock_price',
    'get_hk_stock_info',
    'get_hk_stock_history',
  ],
  'Financial Analysis': [
    'get_financial_indicators',
    'get_financial_statements',
    'get_balance_sheet',
    'get_income_statement',
    'get_cash_flow',
    'get_hk_financials',
  ],
  'Technical Analysis': [
    'calculate_technical_indicators',
    'analyze_price_action',
    'calculate_buy_range',
  ],
  'Valuation': [
    'get_stock_valuation',
    'get_pe_percentile',
    'get_quality_score',
    'get_exit_plan',
  ],
  'Market Data': [
    'get_market_overview',
    'get_sector_fund_flow',
    'get_stock_fund_flow',
    'get_north_flow',
    'get_hot_stocks',
  ],
  'News & Info': [
    'get_stock_news',
    'get_market_news',
    'get_announcements',
  ],
  'Screening': [
    'screen_stocks_by_sector',
    'screen_stocks_quality',
  ],
  'Institutional Data': [
    'get_lhb',
    'get_fund_holdings',
    'get_top_holders',
    'get_holder_changes',
    'get_margin_data',
    'get_insider_trades',
  ],
  'Macro Data': [
    'get_macro_data',
    'get_money_supply',
    'get_social_finance',
    'get_gdp_data',
  ],
  'Portfolio': [
    'manage_portfolio',
  ],
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
  'Trading': [
    'get_account_info',
    'get_positions',
    'get_orders',
    'place_order',
    'cancel_order',
    'update_t1_available',
    'reset_account',
  ],
  'HK Stocks': [
    'get_hk_analysis',
  ],
}
