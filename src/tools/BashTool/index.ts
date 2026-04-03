// STUB: BashTool — 执行 bash 命令
// 当前返回 "not implemented"，后续实现真实 shell 执行

import type { Tool } from '../../Tool.js'

export const BashTool: Tool = {
  name: 'bash',
  description: 'Execute a bash command and return the output.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
      },
    },
    required: ['command'],
  },
  async call(input: unknown): Promise<string> {
    // TODO: 实现真实 bash 执行
    const { command } = input as { command: string }
    return `[BashTool stub] would run: ${command}`
  },
}
