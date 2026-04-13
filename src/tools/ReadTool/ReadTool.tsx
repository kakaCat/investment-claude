import React from 'react'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { ReadToolUseUI, ReadToolResultUI } from './UI.js'

const MAX_CHARS = 20_000

export const ReadTool = buildTool({
  name: 'read_file',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  maxResultSizeChars: Infinity, // 自己管理截断（MAX_CHARS = 20_000）
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The file path to read (absolute or relative to cwd)' },
    },
    required: ['path'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <ReadToolUseUI input={input as { path: string }} />
  ),
  renderToolResult: (result) => <ReadToolResultUI result={result} />,
  async call(input, context) {
    const { path } = input as { path: string }
    const absPath = resolve(context.cwd, path)
    let content: string
    try {
      content = await readFile(absPath, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        data: `Error reading file: ${msg}`,
      }
    }
    if (content.length > MAX_CHARS) {
      return {
        data: content.slice(0, MAX_CHARS) + `\n\n[...truncated, file is ${content.length} chars total]`,
      }
    }
    return {
      data: content,
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
