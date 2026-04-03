// STUB: 未实现 — Plugin 系统
// 对标 Claude Code plugin 系统
// 功能：运行时加载第三方工具和命令

import type { Tool } from '../Tool.js'

export type Plugin = {
  name: string
  version: string
  tools?: Tool[]
}

/** 返回所有已加载 plugin 提供的工具，当前返回空数组 */
export function getPluginTools(): Tool[] {
  // TODO: 加载并返回 plugin 工具
  return []
}
