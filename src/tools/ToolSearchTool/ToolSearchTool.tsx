import React from 'react'
import { buildTool, type Tool } from '../../Tool.js'
import { ToolSearchUseUI, ToolSearchResultUI } from './UI.js'

function matchesTool(tool: Tool, query: string): boolean {
  const q = query.toLowerCase()
  return (
    tool.name.toLowerCase().includes(q) ||
    tool.description.toLowerCase().includes(q) ||
    (tool.searchHint ?? '').toLowerCase().includes(q)
  )
}

export const ToolSearchTool = buildTool({
  name: 'tool_search',
  description:
    'Search for available tools by keyword. Use when you need a tool but are not sure if it exists or how it is named.',
  searchHint: 'find tools, discover tools, search tools, what tools are available',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keywords to find relevant tools' },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
      },
    },
    required: ['query'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <ToolSearchUseUI input={input as { query: string; max_results?: number }} />
  ),
  renderToolResult: (result) => <ToolSearchResultUI result={result} />,
  async call(input, context) {
    const { query, max_results = 5 } = input as { query: string; max_results?: number }
    // context.tools contains ALL tools including deferLoading ones
    const matches = context.tools
      .filter((t) => t.isEnabled())
      .filter((t) => matchesTool(t, query))
      .slice(0, max_results)

    if (matches.length === 0) {
      return `No tools found matching "${query}".`
    }

    return matches.map((t) => `- **${t.name}**: ${t.description}`).join('\n')
  },
})
