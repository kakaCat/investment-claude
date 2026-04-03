import React from 'react'
import { access } from 'fs/promises'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { SendUserFileToolUseUI, SendUserFileToolResultUI } from './UI.js'

export const SendUserFileTool = buildTool({
  name: 'send_file',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to present to the user (absolute or relative to cwd)' },
    },
    required: ['path'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <SendUserFileToolUseUI input={input as { path: string }} />,
  renderToolResult: (result) => <SendUserFileToolResultUI result={result} />,
  async call(input, context) {
    const { path } = input as { path: string }
    const absPath = resolve(context.cwd, path)
    try {
      await access(absPath)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return `Error: file not found: ${absPath}`
      return `Error: cannot access file: ${absPath} (${code ?? String(err)})`
    }
    return absPath
  },
})
