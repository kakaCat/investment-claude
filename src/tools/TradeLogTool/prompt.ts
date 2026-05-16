/**
 * Trade Log Tool 提示词配置
 *
 * 为 Claude 提供交易日志管理工具的使用说明
 */
export const TRADE_LOG_TOOL_DESCRIPTION = `Manage trading logs for tracking decision-making process and performance analysis.

Actions:
- create: Create a new trade log for a stock
- append: Add a record to an existing trade log
- get: Get a specific trade log
- list: List all trade logs

Example:
\`\`\`json
{
  "action": "create",
  "symbol": "600519",
  "name": "贵州茅台",
  "entry_price": 1650.00,
  "entry_date": "2026-05-16",
  "notes": "基本面优秀，估值合理"
}
\`\`\`

## Usage Guidelines

1. **Create before append**: Always create a trade log before appending records
2. **One log per stock**: Each stock should have its own trade log file
3. **Structured records**: Use consistent format for all log entries`
