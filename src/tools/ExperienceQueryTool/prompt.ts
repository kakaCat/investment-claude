/**
 * Experience Query Tool 提示词配置
 *
 * 为 Claude 提供投资经验查询工具的使用说明
 */
export const EXPERIENCE_QUERY_TOOL_DESCRIPTION = `Query investment experience and lessons learned from historical memory.

This tool searches through experience data stored in .pi/memory/ directory, including:
- Daily experience logs (memory/daily/*.jsonl)
- Stock-specific memories (memory/stocks/*.md)

Parameters:
- query: Search query string (required)
- category: Filter by category (optional)
  - stock_selection: Stock picking decisions
  - timing: Entry/exit timing
  - position_sizing: Position management
  - risk_management: Risk control
  - market_analysis: Market analysis insights
- limit: Maximum results to return (default 10)

Example:
\`\`\`json
{
  "query": "止损",
  "category": "risk_management",
  "limit": 5
}
\`\`\`

## Usage Guidelines

1. **Broad queries**: Use general terms to find related experiences
2. **Category filtering**: Narrow down results by specific investment aspect
3. **Learn from history**: Review past decisions to avoid repeating mistakes`
