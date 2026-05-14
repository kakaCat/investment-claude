import React from 'react'
import { spawn } from 'child_process'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { BashToolUseUI, BashToolResultUI } from './UI.js'

type BashResult = {
  stdout: string
  stderr: string
  exitCode: number
  command: string
}

function runBash(command: string, signal: AbortSignal): Promise<BashResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', ['-c', command], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    const onAbort = () => {
      proc.kill('SIGTERM')
      reject(new Error('BashTool: aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })

    proc.on('close', (code) => {
      signal.removeEventListener('abort', onAbort)
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
        command,
      })
    })

    proc.on('error', (err) => {
      signal.removeEventListener('abort', onAbort)
      reject(err)
    })
  })
}

export const BashTool = buildTool({
  name: 'bash',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The bash command to run' },
    },
    required: ['command'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => (
    <BashToolUseUI input={input as { command: string }} />
  ),
  renderToolResult: (result) => <BashToolResultUI result={result} />,
  renderToolResultMessage: (output: BashResult) => (
    <BashToolResultUI
      stdout={output.stdout}
      stderr={output.stderr}
      exitCode={output.exitCode}
    />
  ),
  async call(input, context) {
    const { command } = input as { command: string }
    return { data: await runBash(command, context.abortSignal) }
  },
  mapToolResultToToolResultBlockParam(output: BashResult, toolUseId) {
    const parts: string[] = []

    // Exit code information with guidance
    if (output.exitCode !== 0) {
      parts.push(`<error>Command failed with exit code ${output.exitCode}</error>`)

      // Provide helpful context for common exit codes
      if (output.exitCode === 127) {
        parts.push('Note: Exit code 127 typically means "command not found". Check if the command is installed and in PATH.')
      } else if (output.exitCode === 126) {
        parts.push('Note: Exit code 126 typically means "permission denied". Check file permissions or use sudo if appropriate.')
      } else if (output.exitCode === 130) {
        parts.push('Note: Exit code 130 means the command was interrupted (Ctrl+C).')
      } else if (output.exitCode === 1) {
        parts.push('Note: Exit code 1 is a general error. Check the stderr output below for details.')
      }
    }

    // Stderr with context
    if (output.stderr) {
      parts.push(output.stderr)
    }

    // Stdout
    if (output.stdout) {
      parts.push(output.stdout)
    }

    // Helpful message if no output
    if (!output.stdout && !output.stderr && output.exitCode === 0) {
      parts.push('(command completed successfully with no output)')
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: parts.join('\n') || '(no output)',
      is_error: output.exitCode !== 0,
    }
  },
})
