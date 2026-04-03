// 工具注册入口 — 预留 plugin 扩展点
// 对标 Claude Code src/tools.ts

import type { Tool } from '../Tool.js'
import { BashTool } from './BashTool/index.js'
import { ReadTool } from './ReadTool/index.js'

const BUILTIN_TOOLS: Tool[] = [BashTool, ReadTool]

/** 返回所有可用工具（内置 + plugin 提供的） */
export function getTools(pluginTools: Tool[] = []): Tool[] {
  return [...BUILTIN_TOOLS, ...pluginTools]
}

export function findTool(name: string, tools: Tool[]): Tool | undefined {
  return tools.find((t) => t.name === name)
}
