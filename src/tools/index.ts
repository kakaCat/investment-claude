// 工具注册表 — 对标 Claude Code src/tools.ts
// getAllTools: 所有工具（含 deferLoading），供 ToolSearchTool 搜索
// getActiveTools: 传给模型的工具（isEnabled() && !deferLoading）

import type { Tool } from '../Tool.js'
import { BashTool } from './BashTool/BashTool.js'
import { ReadTool } from './ReadTool/ReadTool.js'
import { ToolSearchTool } from './ToolSearchTool/ToolSearchTool.js'

// 内置工具静态列表 — 新增工具在此 import + 加入数组
const BUILTIN_TOOLS: Tool[] = [BashTool, ReadTool, ToolSearchTool]

/** 所有工具（含 isEnabled=false 和 deferLoading=true），供 ToolSearchTool 搜索 */
export function getAllTools(pluginTools: Tool[] = []): Tool[] {
  return [...BUILTIN_TOOLS, ...pluginTools]
}

/**
 * 传给模型的激活工具：isEnabled() 且 deferLoading=false。
 * deferLoading 工具不在初始 context 里，等 ToolSearchTool 激活后模型才能调用。
 */
export function getActiveTools(pluginTools: Tool[] = []): Tool[] {
  return getAllTools(pluginTools).filter((t) => t.isEnabled() && !t.deferLoading)
}

export function findTool(name: string, tools: Tool[]): Tool | undefined {
  return tools.find((t) => t.name === name)
}
