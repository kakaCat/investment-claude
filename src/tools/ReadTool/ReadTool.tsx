import React from 'react'
import { readFile, stat } from 'fs/promises'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { ReadToolUseUI, ReadToolResultUI } from './UI.js'

const MAX_CHARS = 20_000

type ReadResult = {
  content: string
  path: string
  size: number
  lines: number
  truncated: boolean
  error?: string
}

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
  renderToolResultMessage: (output: ReadResult) => (
    <ReadToolResultUI
      content={output.content}
      path={output.path}
      size={output.size}
      lines={output.lines}
      truncated={output.truncated}
      error={output.error}
    />
  ),
  async call(input, context) {
    const { path } = input as { path: string }
    const absPath = resolve(context.cwd, path)

    let content: string
    let fileSize: number

    try {
      const stats = await stat(absPath)
      fileSize = stats.size
      content = await readFile(absPath, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        data: {
          content: '',
          path,
          size: 0,
          lines: 0,
          truncated: false,
          error: msg,
        },
      }
    }

    const lines = content.split('\n').length
    const truncated = content.length > MAX_CHARS

    if (truncated) {
      content = content.slice(0, MAX_CHARS)
    }

    return {
      data: {
        content,
        path,
        size: fileSize,
        lines,
        truncated,
      },
    }
  },
  mapToolResultToToolResultBlockParam(data: ReadResult, toolUseId) {
    if (data.error) {
      let guidance = ''
      if (data.error.includes('ENOENT') || data.error.includes('no such file')) {
        guidance = '\n\nTip: The file does not exist. Use the Glob tool to find files matching a pattern, or verify the file path is correct.'
      } else if (data.error.includes('EACCES') || data.error.includes('permission')) {
        guidance = '\n\nTip: Permission denied. Check if you have read access to this file.'
      } else if (data.error.includes('EISDIR')) {
        guidance = '\n\nTip: This is a directory, not a file. Use the Bash tool with "ls" to list directory contents.'
      }

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `<error>Error reading file: ${data.error}</error>${guidance}`,
        is_error: true,
      }
    }

    let content = data.content
    if (data.truncated) {
      content += `\n\n<warning>File truncated: showing first ${data.content.length} characters of ${data.size} total (${data.lines} lines). The file is too large to display completely. Consider using Grep to search for specific content, or read specific line ranges if you need to see more.</warning>`
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content,
    }
  },
})
