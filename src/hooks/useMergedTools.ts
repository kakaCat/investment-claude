// 工具注册表 hook — 返回激活工具（isEnabled() && !deferLoading）
// 对标 Claude Code src/hooks/useMergedTools.ts

import { useMemo } from 'react'
import type { Tool } from '../Tool.js'
import { getActiveTools } from '../tools/index.js'
import { getPluginTools } from '../plugins/index.js'

export function useMergedTools(): Tool[] {
  return useMemo(() => {
    const pluginTools = getPluginTools()
    return getActiveTools(pluginTools)
  }, [])
}
