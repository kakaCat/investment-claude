import React from 'react'
import { readFile } from 'fs/promises'
import { resolve, relative } from 'path'
import fg from 'fast-glob'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { GrepToolUseUI, GrepToolResultUI } from './UI.js'

const MAX_RESULTS = 100

export const GrepTool = buildTool({
  name: 'grep',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  maxResultSizeChars: Infinity, // 自己管理截断（MAX_RESULTS = 100）
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regular expression to search for' },
      path: { type: 'string', description: 'Directory or file to search in (default: cwd)' },
      glob: { type: 'string', description: 'Glob filter for files (e.g. "*.ts"). Default: all files' },
    },
    required: ['pattern'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <GrepToolUseUI input={input as { pattern: string; path?: string; glob?: string }} />
  ),
  renderToolResult: (result) => <GrepToolResultUI result={result} />,
  async call(input, context) {
    const { pattern, path, glob = '**/*' } = input as {
      pattern: string
      path?: string
      glob?: string
    }

    let regex: RegExp
    try {
      regex = new RegExp(pattern)
    } catch {
      return `Error: invalid regex "${pattern}"`
    }

    const searchDir = resolve(context.cwd, path ?? '.')
    let files: string[]
    try {
      files = await fg(glob, {
        cwd: searchDir,
        dot: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
        absolute: true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error listing files: ${msg}`
    }

    const results: string[] = []
    for (const file of files) {
      if (context.abortSignal.aborted) break
      if (results.length >= MAX_RESULTS) break
      let content: string
      try {
        content = await readFile(file, 'utf-8')
      } catch {
        continue // skip binary / unreadable files
      }
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const rel = relative(searchDir, file)
          results.push(`${rel}:${i + 1}: ${lines[i].trim()}`)
          if (results.length >= MAX_RESULTS) break
        }
      }
    }

    if (results.length === 0) {
      return `No matches for /${pattern}/`
    }
    const suffix = results.length >= MAX_RESULTS ? `\n[...limited to ${MAX_RESULTS} results]` : ''
    return results.join('\n') + suffix
  },
})
