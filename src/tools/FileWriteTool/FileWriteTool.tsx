import React from 'react'
import { writeFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { FileWriteToolUseUI, FileWriteToolResultUI, FileWriteToolResultMessageUI } from './UI.js'

type FileWriteResult = {
  success: boolean
  path: string
  size: number
  error?: string
}

export const FileWriteTool = buildTool<
  { path: string; content: string },
  FileWriteResult
>({
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
  renderToolResultMessage: (output) => <FileWriteToolResultMessageUI output={output} />,
  async call(input, context) {
    const { path, content } = input as { path: string; content: string }

    // Validate required parameters
    if (!path || typeof path !== 'string') {
      return {
        data: {
          success: false,
          path: '',
          size: 0,
          error: 'Missing or invalid required parameter: path (must be a non-empty string)',
        },
      }
    }

    if (typeof content !== 'string') {
      return {
        data: {
          success: false,
          path,
          size: 0,
          error: 'Missing or invalid required parameter: content (must be a string)',
        },
      }
    }

    const absPath = resolve(context.cwd, path)
    try {
      await mkdir(dirname(absPath), { recursive: true })
      await writeFile(absPath, content, 'utf-8')
      return {
        data: {
          success: true,
          path: absPath,
          size: content.length,
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        data: {
          success: false,
          path: absPath,
          size: 0,
          error: `Error writing file: ${msg}`,
        },
      }
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (!data.success) {
      const error = data.error || 'Unknown error'

      // 分析错误类型
      let errorType = 'UNKNOWN'
      let diagnosis = ''
      let suggestions: string[] = []

      if (error.includes('EACCES') || error.includes('permission denied')) {
        errorType = 'PERMISSION_DENIED'
        diagnosis = 'You do not have permission to write to this location.'
        suggestions = [
          'Check if the file or directory has write permissions',
          'The file may be owned by another user',
          'Try writing to a different location where you have permissions',
          'On Unix systems, check file permissions with ls -la',
        ]
      } else if (error.includes('ENOENT') || error.includes('no such file')) {
        errorType = 'PATH_NOT_FOUND'
        diagnosis = 'The parent directory does not exist or the path is invalid.'
        suggestions = [
          'Verify the directory path is correct',
          'Check for typos in the path',
          'The parent directory should be created automatically, but may have failed',
        ]
      } else if (error.includes('ENOSPC') || error.includes('no space')) {
        errorType = 'NO_SPACE'
        diagnosis = 'There is no space left on the device.'
        suggestions = [
          'Free up disk space',
          'Check disk usage with df -h',
          'Consider writing to a different location',
        ]
      } else if (error.includes('EISDIR') || error.includes('is a directory')) {
        errorType = 'IS_DIRECTORY'
        diagnosis = 'The path points to a directory, not a file.'
        suggestions = [
          'Specify a file name, not just a directory',
          'Example: use /path/to/file.txt instead of /path/to/',
        ]
      } else if (error.includes('EROFS') || error.includes('read-only')) {
        errorType = 'READ_ONLY'
        diagnosis = 'The file system is mounted as read-only.'
        suggestions = [
          'This location cannot be written to',
          'Try writing to a different location',
        ]
      } else if (error.includes('invalid') || error.includes('parameter')) {
        errorType = 'INVALID_INPUT'
        diagnosis = 'The input parameters are invalid.'
        suggestions = [
          'Ensure path is a non-empty string',
          'Ensure content is a string',
          'Check for special characters in the path',
        ]
      } else {
        diagnosis = 'An unexpected file system error occurred.'
        suggestions = [
          'Check if the path is valid',
          'Verify you have write permissions',
          'Try writing to a different location',
        ]
      }

      const content = `FileWrite failed for: ${data.path || '(no path)'}

Error Type: ${errorType}
Error: ${error}

Diagnosis:
${diagnosis}

Suggested Actions:
${suggestions.map(s => `- ${s}`).join('\n')}

Important:
- Inform the user that the file could not be written
- If this was a critical operation, consider alternative approaches
- Do NOT claim the file was written successfully`

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content,
        is_error: true,
      }
    }
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `Written ${data.size} chars to ${data.path}`,
    }
  },
})
