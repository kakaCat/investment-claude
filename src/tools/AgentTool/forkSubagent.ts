// src/tools/AgentTool/forkSubagent.ts

/**
 * Check if fork subagent feature is enabled
 * Fork allows agents to spawn copies of themselves with inherited context
 */
export function isForkSubagentEnabled(): boolean {
  // Disabled by default - can be enabled via env var
  return process.env.ENABLE_FORK_SUBAGENT === 'true'
}
