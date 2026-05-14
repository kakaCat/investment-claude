// src/utils/teammate.ts

/**
 * Check if the current agent is a teammate (part of a team/swarm)
 * TODO: Implement actual teammate detection logic
 */
export function isTeammate(): boolean {
  // Check if running in a team context
  return process.env.AGENT_TEAM_NAME !== undefined
}
