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
      if (code === 'ENOENT') return { data: `Error: file not found: ${absPath}` }
      return { data: `Error: cannot access file: ${absPath} (${code ?? String(err)})` }
    }
    return { data: absPath }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (data.startsWith('Error:')) {
      let errorMsg = `<error>${data}</error>\n\n`

      if (data.includes('file not found')) {
        errorMsg += `The file does not exist at the specified path. Verify the path is correct and the file exists.`
      } else if (data.includes('cannot access file')) {
        errorMsg += `The file exists but cannot be accessed. This may be due to:\n- Insufficient permissions\n- File is locked by another process\n- File system error`
      }

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: errorMsg,
        is_error: true,
      }
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `File sent to user: ${data}\n\nThe user can now download or view this file.`,
    }
  },
})
