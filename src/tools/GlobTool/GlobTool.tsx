import React from 'react'
import fg from 'fast-glob'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { GlobToolUseUI, GlobToolResultUI } from './UI.js'

export const GlobTool = buildTool({
  name: 'glob',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  maxResultSizeChars: Infinity, // 文件列表天然有界
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. "src/**/*.ts")' },
      cwd: { type: 'string', description: 'Directory to search in (default: current working directory)' },
    },
    required: ['pattern'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <GlobToolUseUI input={input as { pattern: string; cwd?: string }} />
  ),
  renderToolResult: (result) => <GlobToolResultUI result={result} />,
  async call(input, context) {
    const { pattern, cwd } = input as { pattern: string; cwd?: string }
    const searchDir = resolve(context.cwd, cwd ?? '.')
    let matches: string[]
    try {
      matches = await fg(pattern, {
        cwd: searchDir,
        dot: false,
        ignore: ['**/node_modules/**', '**/.git/**'],
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        data: `Error: ${msg}`,
      }
    }
    if (matches.length === 0) {
      return {
        data: `No files matched "${pattern}"`,
      }
    }
    return {
      data: matches.sort().join('\n'),
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },
})
