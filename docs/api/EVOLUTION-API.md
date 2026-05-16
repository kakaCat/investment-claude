# Evolution System API Reference

Complete API documentation for the Evolution System.

---

## Table of Contents

- [Overview](#overview)
- [Core Functions](#core-functions)
- [Type Definitions](#type-definitions)
- [Tool Interfaces](#tool-interfaces)
- [Configuration Options](#configuration-options)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

The Evolution System provides three main tools and two core services for automated performance analysis and continuous improvement.

**Tools:**
- `TradeLogTool` - Trade journal management
- `ExperienceQueryTool` - Historical experience search
- `EvolutionRunTool` - Evolution analysis trigger

**Services:**
- `ComparatorService` - Gap analysis and attribution
- `EvolutionService` - Workflow orchestration

---

## Core Functions

### `runEvolution(options)`

Orchestrates the complete evolution analysis workflow.

**Signature:**
```typescript
async function runEvolution(options: EvolutionOptions): Promise<EvolutionReport>
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | `{start: string, end: string}` | Yes | - | Analysis period (ISO date format) |
| `target_return` | `number` | No | `0.15` | Target return rate (0.15 = 15%) |
| `auto_apply` | `boolean` | No | `false` | Auto-apply recommendations |

**Returns:** `Promise<EvolutionReport>`

**Example:**
```typescript
const report = await runEvolution({
  period: {
    start: '2026-04-01',
    end: '2026-05-01'
  },
  target_return: 0.15,
  auto_apply: false
})
```

**Throws:**
- `Error` - If period is invalid
- `Error` - If insufficient trade data
- `Error` - If file system errors occur

---

### `comparePerformance(current, target)`

Calculates performance gap and attributes it to decision categories.

**Signature:**
```typescript
function comparePerformance(
  current: PerformanceMetrics,
  target: PerformanceMetrics
): GapAnalysis
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `current` | `PerformanceMetrics` | Yes | Current performance metrics |
| `target` | `PerformanceMetrics` | Yes | Target performance metrics |

**Returns:** `GapAnalysis`

**Example:**
```typescript
const gap = comparePerformance(
  {
    total_return: 0.082,
    win_rate: 0.65,
    avg_profit: 0.042,
    avg_loss: -0.021,
    max_drawdown: -0.053
  },
  {
    total_return: 0.15,
    win_rate: 0.70,
    avg_profit: 0.05,
    avg_loss: -0.02,
    max_drawdown: -0.05
  }
)
```

---

## Type Definitions

### `PerformanceMetrics`

Performance metrics for evaluating trading strategy effectiveness.

```typescript
interface PerformanceMetrics {
  total_return: number        // Total return rate (0.15 = 15%)
  win_rate: number           // Win rate (0.65 = 65%)
  avg_profit: number         // Average profit per winning trade
  avg_loss: number           // Average loss per losing trade
  max_drawdown: number       // Maximum drawdown (negative value)
  sharpe_ratio?: number      // Sharpe ratio (optional)
}
```

**Field Details:**

- `total_return`: Cumulative return over the period
  - Range: -1.0 to +∞
  - Example: 0.15 = 15% gain, -0.10 = 10% loss

- `win_rate`: Percentage of profitable trades
  - Range: 0.0 to 1.0
  - Example: 0.65 = 65% of trades were profitable

- `avg_profit`: Average profit on winning trades
  - Range: 0.0 to +∞
  - Example: 0.042 = 4.2% average gain per winner

- `avg_loss`: Average loss on losing trades
  - Range: -1.0 to 0.0
  - Example: -0.021 = 2.1% average loss per loser

- `max_drawdown`: Largest peak-to-trough decline
  - Range: -1.0 to 0.0
  - Example: -0.053 = 5.3% maximum drawdown

- `sharpe_ratio`: Risk-adjusted return (optional)
  - Range: -∞ to +∞
  - Example: 1.5 = good risk-adjusted performance

---

### `GapAnalysis`

Gap analysis result identifying performance differences and their causes.

```typescript
interface GapAnalysis {
  performance_gap: number
  attribution: {
    stock_selection: number
    timing: number
    position_sizing: number
    risk_management: number
  }
  recommendations: string[]
}
```

**Field Details:**

- `performance_gap`: Difference between target and actual return
  - Calculation: `target_return - actual_return`
  - Example: 0.068 = 6.8 percentage point gap

- `attribution`: Breakdown of gap by decision category
  - `stock_selection`: Impact from stock picking (40% weight)
  - `timing`: Impact from entry/exit timing (30% weight)
  - `position_sizing`: Impact from capital allocation (20% weight)
  - `risk_management`: Impact from risk controls (10% weight)

- `recommendations`: Actionable improvement suggestions
  - Prioritized by potential impact
  - Specific and measurable
  - Based on historical data

**Attribution Formula:**
```typescript
category_impact = performance_gap × category_weight × category_score
```

**Category Weights:**
- Stock Selection: 40%
- Timing: 30%
- Position Sizing: 20%
- Risk Management: 10%

---

### `EvolutionReport`

Evolution report documenting analysis results and actions taken.

```typescript
interface EvolutionReport {
  timestamp: string
  period: { start: string; end: string }
  current_performance: PerformanceMetrics
  target_performance: PerformanceMetrics
  gap_analysis: GapAnalysis
  actions_taken: string[]
  status: 'success' | 'partial' | 'failed'
}
```

**Field Details:**

- `timestamp`: Report generation time (ISO 8601 format)
  - Example: `"2026-05-16T09:00:00.000Z"`

- `period`: Analysis time period
  - `start`: Period start date (YYYY-MM-DD)
  - `end`: Period end date (YYYY-MM-DD)

- `current_performance`: Actual performance metrics
  - See `PerformanceMetrics` type

- `target_performance`: Target performance metrics
  - See `PerformanceMetrics` type

- `gap_analysis`: Gap analysis results
  - See `GapAnalysis` type

- `actions_taken`: List of actions performed
  - Empty if `auto_apply: false`
  - Contains applied recommendations if `auto_apply: true`

- `status`: Report status
  - `'success'`: Analysis completed successfully
  - `'partial'`: Analysis completed with warnings
  - `'failed'`: Analysis failed

---

### `TradeRecord`

Trade record for historical performance analysis.

```typescript
interface TradeRecord {
  symbol: string
  name: string
  entry_date: string
  entry_price: number
  exit_date?: string
  exit_price?: number
  quantity: number
  profit?: number
  profit_rate?: number
  notes?: string
}
```

**Field Details:**

- `symbol`: Stock symbol
  - Example: `"600519"` (A-share), `"00700"` (HK stock)

- `name`: Stock name
  - Example: `"贵州茅台"`, `"腾讯控股"`

- `entry_date`: Entry date (YYYY-MM-DD)
  - Example: `"2026-05-01"`

- `entry_price`: Entry price
  - Example: `1650.00`

- `exit_date`: Exit date (optional, for closed positions)
  - Example: `"2026-05-15"`

- `exit_price`: Exit price (optional, for closed positions)
  - Example: `1720.00`

- `quantity`: Number of shares
  - Example: `100`

- `profit`: Absolute profit (optional, calculated)
  - Example: `7000.00` (= (1720 - 1650) × 100)

- `profit_rate`: Profit rate (optional, calculated)
  - Example: `0.042` (= 4.2%)

- `notes`: Additional notes
  - Example: `"PE处于历史低位，基本面稳健"`

---

## Tool Interfaces

### TradeLogTool

Trade journal management tool.

**Tool Name:** `trade-log`

**Input Schema:**
```typescript
interface TradeLogInput {
  action: 'create' | 'append' | 'get' | 'list'
  symbol?: string
  name?: string
  entry_price?: number
  entry_date?: string
  notes?: string
  log_id?: string
  record?: {
    date: string
    event: string
    price?: number
    notes?: string
  }
}
```

**Output Schema:**
```typescript
interface TradeLogOutput {
  success: boolean
  data?: TradeLog | TradeLog[]
  error?: string
}
```

**Actions:**

#### `create` - Create new trade log

**Required Fields:**
- `symbol`: Stock symbol
- `name`: Stock name
- `entry_price`: Entry price
- `entry_date`: Entry date (YYYY-MM-DD)

**Optional Fields:**
- `notes`: Entry notes

**Example:**
```typescript
{
  action: "create",
  symbol: "600519",
  name: "贵州茅台",
  entry_price: 1650.00,
  entry_date: "2026-05-01",
  notes: "PE处于历史低位"
}
```

**Returns:**
```typescript
{
  success: true,
  data: {
    log_id: "600519_2026-05-01",
    symbol: "600519",
    name: "贵州茅台",
    entry_price: 1650.00,
    entry_date: "2026-05-01",
    notes: "PE处于历史低位",
    created_at: "2026-05-01T10:30:00.000Z",
    records: []
  }
}
```

#### `append` - Add event to existing log

**Required Fields:**
- `log_id`: Log identifier
- `record`: Event record
  - `date`: Event date (YYYY-MM-DD)
  - `event`: Event type (buy, sell, hold, observation)

**Optional Fields:**
- `record.price`: Price at event time
- `record.notes`: Event notes

**Example:**
```typescript
{
  action: "append",
  log_id: "600519_2026-05-01",
  record: {
    date: "2026-05-15",
    event: "sell",
    price: 1720.00,
    notes: "达到目标价位"
  }
}
```

#### `get` - Query specific log

**Required Fields:**
- `log_id`: Log identifier

**Example:**
```typescript
{
  action: "get",
  log_id: "600519_2026-05-01"
}
```

#### `list` - List all logs

**Required Fields:** None

**Example:**
```typescript
{
  action: "list"
}
```

---

### ExperienceQueryTool

Historical experience search tool.

**Tool Name:** `experience-query`

**Input Schema:**
```typescript
interface ExperienceQueryInput {
  query: string
  category?: 'stock_selection' | 'timing' | 'position_sizing' | 'risk_management' | 'market_analysis'
  limit?: number
}
```

**Output Schema:**
```typescript
interface ExperienceQueryOutput {
  success: boolean
  data?: ExperienceRecord[]
  error?: string
  query?: string
  total?: number
}
```

**Parameters:**

- `query`: Search keywords
  - Example: `"茅台 估值"`

- `category`: Filter by category (optional)
  - `stock_selection`: Stock picking decisions
  - `timing`: Entry/exit timing
  - `position_sizing`: Position size decisions
  - `risk_management`: Risk control measures
  - `market_analysis`: Market condition analysis

- `limit`: Maximum results (optional, default: 10)
  - Range: 1 to 100

**Example:**
```typescript
{
  query: "止损",
  category: "risk_management",
  limit: 5
}
```

**Returns:**
```typescript
{
  success: true,
  query: "止损",
  total: 12,
  data: [
    {
      source: "decision-log.md",
      content: "设止损56.4，跌至60-61加仓",
      category: "risk_management",
      timestamp: "2026-05-14"
    },
    // ... more results
  ]
}
```

---

### EvolutionRunTool

Evolution analysis trigger tool.

**Tool Name:** `evolution-run`

**Input Schema:**
```typescript
interface EvolutionRunInput {
  period_days?: number
  target_return?: number
  auto_apply?: boolean
}
```

**Output Schema:**
```typescript
interface EvolutionRunOutput {
  success: boolean
  report?: EvolutionReport
  error?: string
}
```

**Parameters:**

- `period_days`: Analysis period in days (optional, default: 30)
  - Range: 1 to 365
  - Example: `30` = last 30 days

- `target_return`: Target return rate (optional, default: 0.15)
  - Range: -1.0 to +∞
  - Example: `0.15` = 15% target return

- `auto_apply`: Auto-apply recommendations (optional, default: false)
  - `true`: Automatically apply recommendations
  - `false`: Generate recommendations only

**Example:**
```typescript
{
  period_days: 30,
  target_return: 0.15,
  auto_apply: false
}
```

**Returns:**
```typescript
{
  success: true,
  report: {
    timestamp: "2026-05-16T09:00:00.000Z",
    period: {
      start: "2026-04-16",
      end: "2026-05-16"
    },
    current_performance: {
      total_return: 0.082,
      win_rate: 0.65,
      avg_profit: 0.042,
      avg_loss: -0.021,
      max_drawdown: -0.053
    },
    target_performance: {
      total_return: 0.15,
      win_rate: 0.70,
      avg_profit: 0.05,
      avg_loss: -0.02,
      max_drawdown: -0.05
    },
    gap_analysis: {
      performance_gap: 0.068,
      attribution: {
        stock_selection: 0.027,
        timing: 0.020,
        position_sizing: 0.014,
        risk_management: 0.007
      },
      recommendations: [
        "Improve stock selection by focusing on quality scores > 70",
        "Enhance timing by waiting for technical confirmation",
        "Optimize position sizing using Kelly criterion"
      ]
    },
    actions_taken: [],
    status: "success"
  }
}
```

---

## Configuration Options

### CRON Configuration

Configure automated evolution runs in `.claude/settings.json`:

```json
{
  "cron": {
    "jobs": [
      {
        "name": "evolution_analysis",
        "schedule": "0 9 * * 1",
        "command": "evolution-run",
        "args": {
          "period_days": 30,
          "target_return": 0.15,
          "auto_apply": false
        },
        "enabled": true
      }
    ]
  }
}
```

**Configuration Fields:**

- `name`: Job identifier
- `schedule`: Cron expression (minute hour day month weekday)
- `command`: Tool to execute (`evolution-run`)
- `args`: Tool arguments
- `enabled`: Enable/disable job

**Cron Expression Examples:**

| Expression | Description |
|------------|-------------|
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `0 0 1 * *` | First day of month at midnight |
| `0 */6 * * *` | Every 6 hours |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |

---

### Attribution Weights

Default attribution weights (configurable in future versions):

```typescript
const ATTRIBUTION_WEIGHTS = {
  stock_selection: 0.40,   // 40%
  timing: 0.30,            // 30%
  position_sizing: 0.20,   // 20%
  risk_management: 0.10    // 10%
}
```

**Rationale:**
- Stock selection has highest weight (quality matters most)
- Timing is second (entry/exit timing is critical)
- Position sizing is third (capital allocation impacts returns)
- Risk management is fourth (prevents catastrophic losses)

---

## Error Handling

### Common Errors

#### `INSUFFICIENT_DATA`

**Cause:** Not enough trade logs for analysis

**Message:** `"Insufficient trade data for analysis. Need at least 5 trades."`

**Solution:**
- Record more trades
- Reduce analysis period
- Wait for more trading activity

#### `INVALID_PERIOD`

**Cause:** Invalid date range

**Message:** `"Invalid period: start date must be before end date"`

**Solution:**
- Check date format (YYYY-MM-DD)
- Ensure start < end
- Use valid dates

#### `FILE_NOT_FOUND`

**Cause:** Trade log file not found

**Message:** `"Trade log not found: {log_id}"`

**Solution:**
- Verify log_id is correct
- Check if log was created
- List all logs to find correct ID

#### `INVALID_INPUT`

**Cause:** Missing or invalid parameters

**Message:** `"Invalid input: {field} is required"`

**Solution:**
- Check required fields
- Validate parameter types
- Review API documentation

### Error Response Format

```typescript
{
  success: false,
  error: "Error message describing the issue",
  data: undefined
}
```

### Error Handling Example

```typescript
try {
  const report = await runEvolution({
    period: { start: '2026-04-01', end: '2026-05-01' },
    target_return: 0.15
  })

  if (report.status === 'success') {
    console.log('Analysis completed successfully')
  } else if (report.status === 'partial') {
    console.warn('Analysis completed with warnings')
  }
} catch (error) {
  if (error.message.includes('Insufficient data')) {
    console.error('Need more trade history')
  } else {
    console.error('Analysis failed:', error.message)
  }
}
```

---

## Examples

### Example 1: Complete Evolution Workflow

```typescript
// Step 1: Create trade logs
await tradeLogTool.execute({
  action: 'create',
  symbol: '600519',
  name: '贵州茅台',
  entry_price: 1650.00,
  entry_date: '2026-04-01',
  notes: 'PE历史低位，基本面稳健'
})

// Step 2: Add trade events
await tradeLogTool.execute({
  action: 'append',
  log_id: '600519_2026-04-01',
  record: {
    date: '2026-04-15',
    event: 'sell',
    price: 1720.00,
    notes: '达到目标价位，止盈'
  }
})

// Step 3: Run evolution analysis
const report = await evolutionRunTool.execute({
  period_days: 30,
  target_return: 0.15,
  auto_apply: false
})

// Step 4: Review recommendations
console.log('Performance Gap:', report.report.gap_analysis.performance_gap)
console.log('Top Recommendation:', report.report.gap_analysis.recommendations[0])

// Step 5: Query relevant experiences
const experiences = await experienceQueryTool.execute({
  query: '茅台 估值',
  category: 'stock_selection',
  limit: 5
})

console.log('Similar past decisions:', experiences.data)
```

### Example 2: Automated Weekly Analysis

```typescript
// Configure in .claude/settings.json
{
  "cron": {
    "jobs": [
      {
        "name": "weekly_evolution",
        "schedule": "0 9 * * 1",  // Every Monday at 9 AM
        "command": "evolution-run",
        "args": {
          "period_days": 7,
          "target_return": 0.03,  // 3% weekly target
          "auto_apply": false
        },
        "enabled": true
      }
    ]
  }
}
```

### Example 3: Custom Attribution Analysis

```typescript
// Run analysis
const report = await runEvolution({
  period: { start: '2026-04-01', end: '2026-05-01' },
  target_return: 0.15
})

// Extract attribution
const { attribution } = report.gap_analysis

// Find top contributor
const topCategory = Object.entries(attribution)
  .sort(([, a], [, b]) => b - a)[0]

console.log(`Top gap contributor: ${topCategory[0]} (${topCategory[1]}%)`)

// Query experiences in that category
const experiences = await experienceQueryTool.execute({
  query: '',
  category: topCategory[0],
  limit: 10
})

console.log(`Found ${experiences.total} relevant experiences`)
```

### Example 4: Performance Tracking Over Time

```typescript
// Run monthly analyses
const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']
const results = []

for (const month of months) {
  const report = await runEvolution({
    period: {
      start: `${month}-01`,
      end: `${month}-30`
    },
    target_return: 0.05  // 5% monthly target
  })

  results.push({
    month,
    return: report.current_performance.total_return,
    gap: report.gap_analysis.performance_gap
  })
}

// Analyze trend
console.log('Performance trend:', results)
```

---

## Best Practices

### API Usage

1. **Always handle errors:**
   ```typescript
   try {
     const result = await tool.execute(input)
     if (!result.success) {
       console.error(result.error)
     }
   } catch (error) {
     console.error('Unexpected error:', error)
   }
   ```

2. **Validate inputs before calling:**
   ```typescript
   if (!symbol || !entry_price || !entry_date) {
     throw new Error('Missing required fields')
   }
   ```

3. **Use appropriate analysis periods:**
   - Daily trading: 7-14 days
   - Swing trading: 30-60 days
   - Position trading: 90-180 days

4. **Set realistic targets:**
   - Conservative: 10-15% annual
   - Moderate: 15-25% annual
   - Aggressive: 25%+ annual

5. **Review recommendations before applying:**
   - Never use `auto_apply: true` without review
   - Validate recommendations against strategy
   - Implement gradually

---

## Version History

**v1.0.0** (2026-05-16)
- Initial release
- TradeLogTool, ExperienceQueryTool, EvolutionRunTool
- Comparator and Evolution services
- CRON automation support

---

## See Also

- [Evolution Quick Start Guide](../guides/EVOLUTION-QUICKSTART.md)
- [Migration Completion Report](../superpowers/reports/2026-05-16-pi-investment-migration-complete.md)
- [Main README](../../README.md)

---

**Last Updated:** 2026-05-16
**Version:** 1.0.0
