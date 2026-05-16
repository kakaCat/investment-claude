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
