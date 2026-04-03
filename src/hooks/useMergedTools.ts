// 工具注册表 hook — 预留 plugin 注入点
// 对标 Claude Code src/hooks/useMergedTools.ts

import { useMemo } from 'react'
import type { Tool } from '../Tool.js'
import { getTools } from '../tools/index.js'
import { getPluginTools } from '../plugins/index.js'

export function useMergedTools(): Tool[] {
  return useMemo(() => {
    const pluginTools = getPluginTools()
    return getTools(pluginTools)
  }, [])
}
