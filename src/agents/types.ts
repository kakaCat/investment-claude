// src/agents/types.ts

export type AgentDefinition = {
  /** Unique identifier, e.g. 'general-purpose', 'Explore' */
  agentType: string
  /** Shown in tool description so the model knows when to use this agent */
  whenToUse: string
  /**
   * Allowed tool names. ['*'] or undefined = full parent pool.
   * A specific list = whitelist filter.
   */
  tools?: string[]
  /** Tool names to exclude from the pool (applied after whitelist) */
  disallowedTools?: string[]
  /** 'haiku' | 'sonnet' | 'opus' | 'inherit' | undefined → inherit */
  model?: string
  /** Max agentic turns. Default: 10 */
  maxTurns?: number
  /** Returns the system prompt for this agent */
  getSystemPrompt(): string
  source: 'built-in' | 'custom'
}
