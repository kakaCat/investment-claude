// src/tools/AgentTool/prompt.ts

export const SEARCH_HINT = 'spawn agent subagent delegate task worker'

export const DESCRIPTION = `Launch a new agent to handle complex, multi-step tasks autonomously.

Available agent types and the tools they have access to:
- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks.
- Explore: Fast agent specialized for exploring codebases. Use for finding files by patterns, searching code for keywords, or answering questions about the codebase.
- Plan: Software architect agent for designing implementation plans. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs.

When calling this agent, provide a clear, complete prompt with all context needed — the agent starts with no prior conversation history.`
