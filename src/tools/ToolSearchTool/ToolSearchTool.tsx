import React from 'react'
import { buildTool, type Tool } from '../../Tool.js'
import { ToolSearchUseUI, ToolSearchResultUI } from './UI.js'

function scoreToolForQuery(tool: Tool, terms: string[]): number {
  const name = tool.name.toLowerCase()
  const hint = (tool.searchHint ?? '').toLowerCase()
  const desc = tool.description.toLowerCase()
  let score = 0
  for (const term of terms) {
    if (name === term) {
      score += 10
    } else if (name.includes(term)) {
      score += 5
    }
    // word boundary check in hint
    if (hint.split(/\W+/).includes(term)) {
      score += 4
    } else if (hint.includes(term)) {
      score += 2
    }
    // word boundary check in description
    if (desc.split(/\W+/).includes(term)) {
      score += 2
    } else if (desc.includes(term)) {
      score += 1
    }
  }
  return score
}

export const ToolSearchTool = buildTool({
  name: 'tool_search',
  description:
    'Search for available tools by keyword. Use "select:<tool_name>" for direct tool activation, or keywords to search by name/description. Use when you need a tool but are not sure if it exists or how it is named.',
  searchHint: 'find tools discover tools search tools what tools are available',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search keywords (e.g., "file read"), or "select:<tool_name>" to directly activate a tool by name.',
      },
    },
    required: ['query'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <ToolSearchUseUI input={input as { query: string }} />
  ),
  renderToolResult: (result) => <ToolSearchResultUI result={result} />,
  async call(input, context) {
    const { query } = input as { query: string }

    // select:<name> — direct tool lookup by exact name
    const selectMatch = query.match(/^select:(.*)$/i)
    if (selectMatch) {
      const name = selectMatch[1]!.trim()
      if (!name) return { data: 'ERROR: select: requires a tool name.' }
      const found = context.tools.find(
        (t) => t.name === name && t.isEnabled(),
      )
      if (!found) return { data: `No tool named "${name}" found.` }
      return { data: `Tool activated: **${found.name}** — ${found.description}` }
    }

    // keyword search with scoring
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const scored = context.tools
      .filter((t) => t.isEnabled())
      .map((t) => ({ tool: t, score: scoreToolForQuery(t, terms) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    if (scored.length === 0) {
      return { data: `No tools matched '${query}'.` }
    }

    return {
      data: scored
        .map(({ tool }) => `- **${tool.name}**: ${tool.description}`)
        .join('\n'),
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (data.startsWith('ERROR:')) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `<error>${data}</error>\n\nProvide a tool name after 'select:' (e.g., "select:bash").`,
        is_error: true,
      }
    }

    if (data.includes('No tool named')) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `${data}\n\nThe tool does not exist or is not enabled. Try a keyword search instead.`,
      }
    }

    if (data.includes('No tools matched')) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `${data}\n\nTry different keywords or use 'select:toolname' for exact tool lookup.`,
      }
    }

    if (data.includes('Tool activated:')) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `${data}\n\nYou can now use this tool in your workflow.`,
      }
    }

    const toolCount = data.split('\n').length
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `${data}\n\nFound ${toolCount} matching tool${toolCount > 1 ? 's' : ''}. Use 'select:toolname' to activate a specific tool.`,
    }
  },
})
