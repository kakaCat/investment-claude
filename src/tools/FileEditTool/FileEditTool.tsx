import React from 'react'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { FileEditToolUseUI, FileEditToolResultUI } from './UI.js'

export const FileEditTool = buildTool({
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
      return `Error reading file: ${msg}`
    }

    const count = content.split(old_string).length - 1
    if (count === 0) {
      return `Error: old_string not found in ${path}`
    }
    if (count > 1) {
      return `Error: old_string appears ${count} times in ${path} — must be unique`
    }

    const updated = content.replace(old_string, new_string)
    try {
      await writeFile(absPath, updated, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error writing file: ${msg}`
    }

    return `Edited ${path}: replaced ${old_string.length} chars with ${new_string.length} chars`
  },
})
