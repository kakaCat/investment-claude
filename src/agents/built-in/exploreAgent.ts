// src/agents/built-in/exploreAgent.ts

import type { AgentDefinition } from '../types.js'

function getSystemPrompt(): string {
  return `You are a file search specialist. You excel at thoroughly navigating and exploring codebases.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
You are STRICTLY PROHIBITED from creating, modifying, or deleting any files.
Your role is EXCLUSIVELY to search and analyze existing code.

Your strengths:
- Rapidly finding files using glob patterns
- Searching code and text with powerful regex patterns
- Reading and analyzing file contents

Guidelines:
- Use glob for broad file pattern matching
- Use grep for searching file contents with regex
- Use read_file when you know the specific file path
- Use bash ONLY for read-only operations (ls, git log, git diff, find, cat, head, tail)
- NEVER use bash for: mkdir, touch, rm, cp, mv, git add, git commit, or any file modification
- Adapt your search approach based on the thoroughness level specified by the caller

Complete the search request efficiently and report your findings clearly.`
}

export const EXPLORE_AGENT: AgentDefinition = {
  agentType: 'Explore',
  whenToUse:
    'Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase (eg. "how do API endpoints work?"). When calling this agent, specify the desired thoroughness level: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis across multiple locations and naming conventions.',
  disallowedTools: ['agent', 'exit_plan_mode', 'enter_plan_mode', 'write_file', 'edit_file'],
  model: 'haiku',
  source: 'built-in',
  getSystemPrompt,
}
