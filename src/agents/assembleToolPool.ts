// src/agents/assembleToolPool.ts

import type { Tool } from '../Tool.js'
import type { AgentDefinition } from './types.js'

/**
 * Builds the tool pool for a sub-agent based on its definition.
 *
 * Logic:
 * 1. Start with all enabled, non-deferred tools from the parent pool.
 * 2. If agentDef.tools is set and does NOT contain '*', apply as whitelist.
 * 3. Remove any tools in agentDef.disallowedTools.
 */
export function assembleToolPool(
  allTools: Tool[],
  agentDef: AgentDefinition,
): Tool[] {
  let pool = allTools.filter(t => t.isEnabled() && !t.deferLoading)

  if (agentDef.tools && !agentDef.tools.includes('*')) {
    pool = pool.filter(t => agentDef.tools!.includes(t.name))
  }

  if (agentDef.disallowedTools?.length) {
    pool = pool.filter(t => !agentDef.disallowedTools!.includes(t.name))
  }

  return pool
}
