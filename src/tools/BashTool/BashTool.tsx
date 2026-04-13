import React from 'react'
import { spawn } from 'child_process'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { BashToolUseUI, BashToolResultUI } from './UI.js'

function runBash(command: string, signal: AbortSignal): Promise<string> {
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
      const output = (stdout + stderr).trim()
      if (code !== 0) {
        resolve(`Exit code ${code}\n${output}`)
      } else {
        resolve(output || '(no output)')
      }
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
  async call(input, context) {
    const { command } = input as { command: string }
    return { data: await runBash(command, context.abortSignal) }
  },
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: output,
    }
  },
})
