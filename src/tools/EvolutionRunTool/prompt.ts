/**
 * Evolution Run Tool 提示词配置
 *
 * 为 Claude 提供进化分析工具的使用说明
 */
export const EVOLUTION_RUN_TOOL_DESCRIPTION = `Trigger evolution analysis to identify performance gaps and optimization opportunities.

This tool runs a complete evolution cycle that:
1. Analyzes trading performance over a specified period
2. Compares current performance against target metrics
3. Identifies gaps and their root causes
4. Generates actionable recommendations
5. Optionally auto-applies recommendations

Parameters:
- period_days: Analysis period in days (optional, default 30)
- target_return: Target return percentage (optional, default 20)
- auto_apply: Auto-apply recommendations (optional, default false)

Example:
\`\`\`json
{
  "period_days": 30,
  "target_return": 20,
  "auto_apply": false
}
\`\`\`

## When to Use

- After completing trading sessions to review performance
- When seeking optimization insights and improvement opportunities
- For periodic performance reviews (weekly/monthly)
- When performance is below expectations

## Output

Evolution report containing:
- Performance metrics (return, win rate, Sharpe ratio, etc.)
- Gap analysis with attribution breakdown
- Actionable recommendations for improvement
- Actions taken (if auto_apply enabled)

## Usage Guidelines

1. **Regular reviews**: Run evolution analysis periodically to track progress
2. **Set realistic targets**: Adjust target_return based on market conditions
3. **Review recommendations**: Always review before enabling auto_apply
4. **Track improvements**: Compare reports over time to measure evolution`
