# Intelligence Services

## Purpose

The intelligence services directory contains the evolution system that enables continuous performance improvement through automated gap analysis and strategy adjustments.

## Architecture

### Core Components

1. **Comparator Service**
   - Compares actual vs target performance
   - Identifies performance gaps
   - Attributes gaps to specific factors (stock selection, timing, position sizing, risk management)

2. **Evolution Service**
   - Orchestrates the evolution cycle
   - Generates actionable recommendations
   - Tracks evolution history
   - Manages automated adjustments

### Data Flow

```
Trade Records
    ↓
Performance Analysis
    ↓
Gap Analysis (Comparator)
    ↓
Recommendations (Evolution Service)
    ↓
Strategy Adjustments
    ↓
New Trade Records
```

## Key Concepts

### Performance Metrics
- Total return, win rate, profit/loss ratios
- Risk metrics (max drawdown, Sharpe ratio)
- Used to evaluate strategy effectiveness

### Gap Analysis
- Quantifies performance_gap between actual and target
- Attributes gap to specific factors
- Provides actionable recommendations

### Evolution Report
- Documents each evolution cycle
- Tracks actions taken and results
- Enables historical analysis of improvements

## Usage

### Running Evolution Analysis

```typescript
import { runEvolution } from './evolution-service'

// Basic usage with defaults (last 30 days, 20% target return)
const report = await runEvolution()

// Custom period and target
const report = await runEvolution({
  period: {
    start: '2024-01-01',
    end: '2024-01-31'
  },
  target_return: 25,
  auto_apply: false
})

// Auto-apply recommendations
const report = await runEvolution({
  target_return: 20,
  auto_apply: true  // Saves recommendations to pending actions
})
```

### Accessing Reports

```typescript
import { getLatestReport } from './evolution-service'

// Get the most recent evolution report
const latestReport = await getLatestReport()

if (latestReport) {
  console.log('Performance Gap:', latestReport.gap_analysis.performance_gap)
  console.log('Recommendations:', latestReport.gap_analysis.recommendations)
}
```

### Report Structure

Evolution reports are saved to `.pi/evolution/reports/` and contain:
- Current and target performance metrics
- Gap analysis with attribution
- Actionable recommendations
- Actions taken (if auto_apply enabled)

The intelligence services are designed to:
1. Continuously monitor trading performance
2. Identify areas for improvement
3. Generate data-driven recommendations
4. Enable automated strategy evolution

## Integration

Intelligence services integrate with:
- Trading engine (for trade records)
- Strategy system (for adjustments)
- Monitoring system (for alerts)
