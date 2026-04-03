// Tool 接口 — 对标 Claude Code src/Tool.ts

export interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
  call(input: unknown): Promise<string>
}
