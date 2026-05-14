import React from 'react'
import fg from 'fast-glob'
import { resolve } from 'path'
import { stat } from 'fs/promises'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { GlobToolUseUI, GlobToolResultUI } from './UI.js'

type GlobResult = {
  files: string[]
  totalFiles: number
  totalSize: number
  pattern: string
  error?: string
}

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
  renderToolResultMessage: (output: GlobResult) => (
    <GlobToolResultUI
      files={output.files}
      totalFiles={output.totalFiles}
      totalSize={output.totalSize}
      pattern={output.pattern}
      error={output.error}
    />
  ),
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
        data: {
          files: [],
          totalFiles: 0,
          totalSize: 0,
          pattern,
          error: msg,
        },
      }
    }

    if (matches.length === 0) {
      return {
        data: {
          files: [],
          totalFiles: 0,
          totalSize: 0,
          pattern,
        },
      }
    }

    // 计算总大小
    let totalSize = 0
    for (const file of matches) {
      try {
        const filePath = resolve(searchDir, file)
        const stats = await stat(filePath)
        totalSize += stats.size
      } catch {
        // 忽略无法访问的文件
      }
    }

    return {
      data: {
        files: matches.sort(),
        totalFiles: matches.length,
        totalSize,
        pattern,
      },
    }
  },
  mapToolResultToToolResultBlockParam(data: GlobResult, toolUseId) {
    if (data.error) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `Error: ${data.error}`,
      }
    }

    if (data.totalFiles === 0) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `No files matched "${data.pattern}"`,
      }
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data.files.join('\n'),
    }
  },
})
