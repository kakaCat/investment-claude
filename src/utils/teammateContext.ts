// src/utils/teammateContext.ts

/**
 * Check if the current agent is an in-process teammate
 * In-process teammates have restrictions on spawning other agents
 */
export function isInProcessTeammate(): boolean {
  // Check if running as an in-process teammate
  return process.env.AGENT_IN_PROCESS === 'true'
}
