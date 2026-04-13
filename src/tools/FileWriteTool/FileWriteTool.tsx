import React from 'react'
import { writeFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { FileWriteToolUseUI, FileWriteToolResultUI } from './UI.js'

export const FileWriteTool = buildTool({
  name: 'write_file',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write (absolute or relative to cwd)' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => (
    <FileWriteToolUseUI input={input as { path: string; content: string }} />
  ),
  renderToolResult: (result) => <FileWriteToolResultUI result={result} />,
  async call(input, context) {
    const { path, content } = input as { path: string; content: string }
    const absPath = resolve(context.cwd, path)
    try {
      await mkdir(dirname(absPath), { recursive: true })
      await writeFile(absPath, content, 'utf-8')
      return {

        data: `Written ${content.length} chars to ${absPath}`

      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {

        data: `Error writing file: ${msg}`

      }
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
