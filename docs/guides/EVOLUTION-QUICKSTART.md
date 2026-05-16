# Evolution System Quick Start Guide

Get started with the Evolution System in 5 minutes.

---

## What is the Evolution System?

The Evolution System automatically analyzes your trading performance, identifies gaps between your results and targets, and provides actionable recommendations for improvement.

**Key Benefits:**
- Automated performance analysis
- Data-driven recommendations
- Learn from historical decisions
- Continuous improvement

---

## Prerequisites

- Investment Claude installed and running
- At least a few trade logs recorded
- Basic understanding of your investment strategy

---

## 5-Minute Setup

### Step 1: Record Your First Trade (1 minute)

Create a trade log when you make an investment:

```
You: Create a trade log for 贵州茅台 (600519), bought at ¥1650 on 2026-05-01
```

The system will:
- Create a persistent log file
- Record entry details
- Generate a unique log ID

### Step 2: Add Trade Events (1 minute)

As your trade progresses, record events:

```
You: Add to 600519 log: sold at ¥1720 on 2026-05-15, profit taking
```

Events can include:
- Buy/sell actions
- Price observations
- Strategy adjustments
- Exit decisions

### Step 3: Run Your First Evolution Analysis (2 minutes)

Trigger an evolution analysis:

```
You: Run evolution analysis for the last 30 days with 15% target return
```

The system will:
1. Load all trade logs from the period
2. Calculate performance metrics
3. Compare against target
4. Identify performance gaps
5. Generate recommendations

### Step 4: Review the Report (1 minute)

The evolution report shows:

**Performance Metrics:**
- Total return: 8.2%
- Win rate: 65%
- Average profit: +4.2%
- Average loss: -2.1%
- Max drawdown: -5.3%

**Gap Analysis:**
- Performance gap: 6.8 percentage points
- Attribution:
  - Stock Selection: 2.7% (40% weight)
  - Timing: 2.0% (30% weight)
  - Position Sizing: 1.4% (20% weight)
  - Risk Management: 0.7% (10% weight)

**Recommendations:**
- Improve stock selection by focusing on quality scores > 70
- Enhance timing by waiting for technical confirmation
- Optimize position sizing using Kelly criterion
- Tighten stop-loss rules to 8% maximum

---

## Understanding the Report

### Performance Gap

```
Performance Gap = Target Return - Actual Return
```

Example:
- Target: 15%
- Actual: 8.2%
- Gap: 6.8 percentage points

This gap is then attributed to specific decision categories.

### Attribution Breakdown

The system attributes the gap to four categories:

| Category | Weight | What It Measures |
|----------|--------|------------------|
| **Stock Selection** | 40% | Quality of stocks chosen |
| **Timing** | 30% | Entry/exit timing decisions |
| **Position Sizing** | 20% | Capital allocation per trade |
| **Risk Management** | 10% | Stop-loss and risk controls |

**How to Read Attribution:**

If Stock Selection shows 2.7%:
- This category contributed 2.7 percentage points to the gap
- It's the largest contributor (40% weight)
- Focus improvement efforts here first

### Recommendations

Recommendations are:
- **Specific:** Clear actions to take
- **Actionable:** You can implement them immediately
- **Prioritized:** Ordered by potential impact
- **Data-driven:** Based on your historical performance

---

## Common Workflows

### Workflow 1: Weekly Performance Review

**Every Monday morning:**

1. Run evolution analysis:
   ```
   You: Run evolution for last 7 days
   ```

2. Review recommendations

3. Adjust strategy for the week

4. Record decision in decision log

### Workflow 2: Post-Trade Analysis

**After closing a position:**

1. Update trade log with exit details:
   ```
   You: Add to 600519 log: sold at ¥1720, +4.2% profit
   ```

2. Record lessons learned:
   ```
   You: Add to 600519 log: observation - should have held longer, uptrend continued
   ```

3. Query similar past trades:
   ```
   You: Query experiences about 茅台 timing decisions
   ```

### Workflow 3: Strategy Adjustment

**When performance lags:**

1. Run extended analysis:
   ```
   You: Run evolution for last 90 days with 20% target
   ```

2. Identify top gap contributor

3. Query historical experiences in that category:
   ```
   You: Query experiences in stock_selection category
   ```

4. Implement top 3 recommendations

5. Monitor improvement in next period

### Workflow 4: Learning from History

**Before making a decision:**

1. Query similar past situations:
   ```
   You: Query experiences about 白酒行业 估值
   ```

2. Review what worked and what didn't

3. Apply lessons to current decision

4. Record new decision in trade log

---

## Troubleshooting

### "Not enough data for analysis"

**Problem:** Insufficient trade history

**Solution:**
- Need at least 5-10 trades for meaningful analysis
- Reduce analysis period (try 7 or 14 days)
- Continue recording trades and try again later

### "Performance gap is negative"

**Problem:** You're exceeding your target return

**Solution:**
- This is good news!
- Review what's working well
- Consider raising your target return
- Document successful strategies

### "All recommendations are generic"

**Problem:** Limited historical experience data

**Solution:**
- Add more detail to trade log notes
- Record decisions in decision log
- Build up experience database over time
- Recommendations improve with more data

### "Attribution doesn't match my intuition"

**Problem:** Attribution weights may not fit your strategy

**Solution:**
- Attribution weights are configurable
- Default weights: Stock Selection (40%), Timing (30%), Position Sizing (20%), Risk Management (10%)
- Adjust weights in configuration if needed
- Remember: attribution is an estimate, not absolute truth

---

## Best Practices

### Recording Trades

**Do:**
- Record trades immediately after execution
- Include detailed notes about reasoning
- Update logs with observations during holding period
- Record exit details and lessons learned

**Don't:**
- Wait to record trades in batches
- Skip notes (they're valuable for learning)
- Forget to record exits
- Delete or modify historical logs

### Running Evolution Analysis

**Do:**
- Run analysis regularly (weekly or monthly)
- Use consistent target returns
- Review full report, not just summary
- Act on top recommendations

**Don't:**
- Run analysis too frequently (daily is too often)
- Change targets constantly
- Ignore recommendations
- Expect perfect attribution

### Using Recommendations

**Do:**
- Prioritize by potential impact
- Implement 2-3 recommendations at a time
- Track which recommendations you applied
- Measure improvement in next period

**Don't:**
- Try to implement all recommendations at once
- Ignore your own judgment
- Expect immediate results
- Blame the system for losses

---

## Next Steps

### After Your First Analysis

1. **Review the full migration report:**
   - [PI-Investment Migration Complete](../superpowers/reports/2026-05-16-pi-investment-migration-complete.md)

2. **Explore the API reference:**
   - [Evolution API Documentation](../api/EVOLUTION-API.md)

3. **Set up automated analysis:**
   - Configure CRON for weekly runs
   - See automation section in migration report

4. **Build your experience database:**
   - Record all decisions in decision log
   - Add notes to trade logs
   - Query experiences regularly

### Advanced Usage

**Custom Analysis Periods:**
```typescript
{
  period_days: 90,  // Last 3 months
  target_return: 0.25  // 25% target
}
```

**Category-Specific Queries:**
```typescript
{
  query: "止损",
  category: "risk_management",
  limit: 20
}
```

**Automated Recommendations:**
```typescript
{
  period_days: 30,
  target_return: 0.15,
  auto_apply: true  // Automatically apply recommendations
}
```

---

## Tips for Success

1. **Consistency is key:** Record every trade, no exceptions

2. **Detail matters:** More detailed notes = better recommendations

3. **Regular analysis:** Weekly or monthly, not daily

4. **Act on insights:** Analysis without action doesn't improve performance

5. **Iterate:** Implement → Measure → Adjust → Repeat

6. **Be patient:** Building a useful experience database takes time

7. **Stay honest:** Record losses and mistakes, they're the best teachers

8. **Review history:** Query past experiences before making decisions

---

## Quick Reference

### Trade Log Commands

```
Create: "Create trade log for [symbol] at [price] on [date]"
Append: "Add to [symbol] log: [event] at [price]"
Query:  "Show me the log for [symbol]"
List:   "List all trade logs"
```

### Experience Query Commands

```
Simple:   "Query experiences about [topic]"
Category: "Query [category] experiences about [topic]"
Limited:  "Query top 5 experiences about [topic]"
```

### Evolution Commands

```
Basic:    "Run evolution analysis"
Period:   "Run evolution for last [N] days"
Target:   "Run evolution with [X]% target return"
Advanced: "Run evolution for [N] days with [X]% target"
```

---

## Support

**Need help?**
- Check the [full migration report](../superpowers/reports/2026-05-16-pi-investment-migration-complete.md)
- Review [API documentation](../api/EVOLUTION-API.md)
- Examine test files for usage examples
- Consult decision log for historical context

**Found a bug?**
- Check if it's a known limitation
- Review test coverage
- Open a GitHub issue with details

---

**Last Updated:** 2026-05-16
**Version:** 1.0.0

Happy evolving! 🚀
