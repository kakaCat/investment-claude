// STUB: ReadTool — 读取文件内容
// 当前返回 "not implemented"，后续实现真实文件读取

import type { Tool } from '../../Tool.js'

export const ReadTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file at the given path.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file path to read',
      },
    },
    required: ['path'],
  },
  async call(input: unknown): Promise<string> {
    // TODO: 实现真实文件读取
    const { path } = input as { path: string }
    return `[ReadTool stub] would read: ${path}`
  },
}
