import React from 'react'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { FileEditToolUseUI, FileEditToolResultUI, FileEditToolResultMessageUI } from './UI.js'

type FileEditResult = {
  success: boolean
  path: string
  oldLength: number
  newLength: number
  error?: string
}

export const FileEditTool = buildTool<
  { path: string; old_string: string; new_string: string },
  FileEditResult
>({
  name: 'edit_file',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to edit (absolute or relative to cwd)' },
      old_string: { type: 'string', description: 'Exact string to find and replace' },
      new_string: { type: 'string', description: 'Replacement string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => (
    <FileEditToolUseUI
      input={input as { path: string; old_string: string; new_string: string }}
    />
  ),
  renderToolResult: (result) => <FileEditToolResultUI result={result} />,
  renderToolResultMessage: (output) => <FileEditToolResultMessageUI output={output} />,
  async call(input, context) {
    const { path, old_string, new_string } = input as {
      path: string
      old_string: string
      new_string: string
    }
    const absPath = resolve(context.cwd, path)

    let content: string
    try {
      content = await readFile(absPath, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        data: {
          success: false,
          path,
          oldLength: 0,
          newLength: 0,
          error: `Error reading file: ${msg}`,
        },
      }
    }

    const count = content.split(old_string).length - 1
    if (count === 0) {
      return {
        data: {
          success: false,
          path,
          oldLength: 0,
          newLength: 0,
          error: `old_string not found in ${path}`,
        },
      }
    }
    if (count > 1) {
      return {
        data: {
          success: false,
          path,
          oldLength: 0,
          newLength: 0,
          error: `old_string appears ${count} times in ${path} — must be unique`,
        },
      }
    }

    const updated = content.replace(old_string, new_string)
    try {
      await writeFile(absPath, updated, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        data: {
          success: false,
          path,
          oldLength: old_string.length,
          newLength: new_string.length,
          error: `Error writing file: ${msg}`,
        },
      }
    }

    return {
      data: {
        success: true,
        path,
        oldLength: old_string.length,
        newLength: new_string.length,
      },
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (!data.success) {
      const errorMsg = data.error || 'Unknown error'

      // Add helpful guidance for common errors
      let guidance = ''
      if (errorMsg.includes('must be unique')) {
        guidance = '\n\nTip: The old_string you provided matches multiple locations in the file. To fix this, provide more surrounding context in old_string to make it unique, or use a more specific string that only appears once.'
      } else if (errorMsg.includes('not found')) {
        guidance = '\n\nTip: The old_string was not found in the file. Make sure you copied the exact text including whitespace and indentation. Use the Read tool to verify the current file contents.'
      } else if (errorMsg.includes('permission') || errorMsg.includes('EACCES')) {
        guidance = '\n\nTip: Permission denied. Check if the file is writable or if you need elevated permissions.'
      }

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `<error>${errorMsg}</error>${guidance}`,
        is_error: true,
      }
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `The file ${data.path} has been edited successfully. Replaced ${data.oldLength} characters with ${data.newLength} characters.`,
    }
  },
})
