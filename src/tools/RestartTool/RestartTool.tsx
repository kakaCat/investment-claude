import React from 'react'
import { Text, Box } from 'ink'
import { buildTool } from '../../Tool.js'
import type { ToolResult } from '../../Tool.js'
import { performRestart } from '../../utils/restart.js'

interface RestartInput {
  preserve_context?: boolean
}

interface RestartOutput {
  message: string
  preserve_context: boolean
  estimated_time: string
  new_pid?: number
}

export const RestartTool = buildTool<RestartInput, RestartOutput>({
  name: 'restart_agent',
  description:
    'Restart the entire agent process without leaving the terminal. ' +
    'Use when: (1) new tools have been added to the codebase and need to take effect, ' +
    '(2) performance degradation after long-running session, ' +
    '(3) general cleanup or error recovery. ' +
    'The conversation context will be saved and restored after restart by default. ' +
    'Note: there will be a ~10-30 second delay while the new process starts up.',
  inputSchema: {
    type: 'object',
    properties: {
      preserve_context: {
        type: 'boolean',
        description:
          'Whether to save and restore the current conversation context. ' +
          'Default: true. Set to false for a completely clean restart.'
      }
    }
  },

  async call(input: RestartInput): Promise<ToolResult<RestartOutput>> {
    const preserveContext = input.preserve_context !== false

    await performRestart(preserveContext)

    return {
      data: {
        message: '🔄 Agent 重启中...',
        preserve_context: preserveContext,
        estimated_time: '10-30秒'
      }
    }
  },

  mapToolResultToToolResultBlockParam(output: RestartOutput, toolUseId: string) {
    const text =
      `## ${output.message}\n\n` +
      `新进程已启动，当前进程即将退出。\n` +
      (output.preserve_context
        ? `✅ 对话上下文已保存，重启后将恢复。\n`
        : `🆕 干净重启，不保留上下文。\n`) +
      `⏱ 预计 ${output.estimated_time} 后新 agent 可用。\n\n` +
      `**新工具将在重启后生效。**`

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseId,
      content: text
    }
  },

  renderToolUse(input: RestartInput) {
    const preserveContext = input.preserve_context !== false
    return (
      <Box flexDirection="column">
        <Text color="cyan">🔄 重启 Agent</Text>
        <Text color="gray">
          {preserveContext ? '保留上下文' : '清空上下文'}
        </Text>
      </Box>
    )
  },

  renderToolResultMessage(output: RestartOutput) {
    return (
      <Box flexDirection="column">
        <Text color="green">{output.message}</Text>
        <Text color="gray">
          {output.preserve_context ? '✅ 上下文已保存' : '🆕 干净重启'}
        </Text>
        <Text color="gray">⏱ 预计 {output.estimated_time}</Text>
      </Box>
    )
  }
})
