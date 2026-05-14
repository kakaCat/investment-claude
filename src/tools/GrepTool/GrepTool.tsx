import React from 'react'
import { readFile } from 'fs/promises'
import { resolve, relative } from 'path'
import fg from 'fast-glob'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { GrepToolUseUI, GrepToolResultUI } from './UI.js'

const MAX_RESULTS = 100

type GrepMatch = {
  file: string
  line: number
  content: string
}

type GrepResult = {
  matches: GrepMatch[]
  totalMatches: number
  totalFiles: number
  pattern: string
  truncated: boolean
}

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
  renderToolResultMessage: (output: GrepResult) => (
    <GrepToolResultUI
      matches={output.matches}
      totalMatches={output.totalMatches}
      totalFiles={output.totalFiles}
      pattern={output.pattern}
      truncated={output.truncated}
    />
  ),
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
      return {
        data: {
          matches: [],
          totalMatches: 0,
          totalFiles: 0,
          pattern,
          truncated: false,
        },
      }
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
      return {
        data: {
          matches: [],
          totalMatches: 0,
          totalFiles: 0,
          pattern,
          truncated: false,
        },
      }
    }

    const matches: GrepMatch[] = []
    const filesWithMatches = new Set<string>()

    for (const file of files) {
      if (context.abortSignal.aborted) break
      if (matches.length >= MAX_RESULTS) break
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
          matches.push({
            file: rel,
            line: i + 1,
            content: lines[i].trim(),
          })
          filesWithMatches.add(rel)
          if (matches.length >= MAX_RESULTS) break
        }
      }
    }

    return {
      data: {
        matches,
        totalMatches: matches.length,
        totalFiles: filesWithMatches.size,
        pattern,
        truncated: matches.length >= MAX_RESULTS,
      },
    }
  },
  mapToolResultToToolResultBlockParam(data: GrepResult, toolUseId) {
    if (data.totalMatches === 0) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `No matches found for pattern: /${data.pattern}/\n\nTip: If you expected matches, try:\n- Using a simpler or more general pattern\n- Checking if the pattern is case-sensitive (use (?i) for case-insensitive)\n- Verifying you're searching in the correct directory\n- Using the Glob tool first to verify files exist`,
      }
    }

    const lines = data.matches.map(m => `${m.file}:${m.line}: ${m.content}`)
    let result = `Found ${data.totalMatches} match${data.totalMatches === 1 ? '' : 'es'} in ${data.totalFiles} file${data.totalFiles === 1 ? '' : 's'}:\n\n${lines.join('\n')}`

    if (data.truncated) {
      result += `\n\n<warning>Results limited to ${MAX_RESULTS} matches. There may be more matches not shown. Consider refining your search pattern to be more specific.</warning>`
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: result,
    }
  },
})
