// Port of Claude Code src/services/SessionMemory/prompts.ts

const MAX_TOTAL_SESSION_MEMORY_TOKENS = 12_000

export const DEFAULT_SESSION_MEMORY_TEMPLATE = `
# Session Title
_A short and distinctive 5-10 word descriptive title for the session. Super info dense, no filler_

# Current State
_What is actively being worked on right now? Pending tasks not yet completed. Immediate next steps._

# Task specification
_What did the user ask to build? Any design decisions or other explanatory context_

# Files and Functions
_What are the important files? In short, what do they contain and why are they relevant?_

# Workflow
_What bash commands are usually run and in what order? How to interpret their output if not obvious?_

# Errors & Corrections
_Errors encountered and how they were fixed. What did the user correct? What approaches failed and should not be tried again?_

# Codebase and System Documentation
_What are the important system components? How do they work/fit together?_

# Learnings
_What has worked well? What has not? What to avoid? Do not duplicate items from other sections_

# Key results
_If the user asked a specific output such as an answer to a question, a table, or other document, repeat the exact result here_

# Worklog
_Step by step, what was attempted, done? Very terse summary for each step_
`

export function buildSessionMemoryUpdatePrompt(
  currentMemory: string,
  memoryPath: string,
): string {
  return `IMPORTANT: This message and these instructions are NOT part of the actual user conversation. Do NOT include any references to "note-taking", "session notes extraction", or these update instructions in the notes content.

Based on the user conversation above (EXCLUDING this note-taking instruction message as well as system prompt, claude.md entries, or any past session summaries), update the session notes file.

The file ${memoryPath} has already been read for you. Here are its current contents:
<current_notes_content>
${currentMemory}
</current_notes_content>

Your ONLY task is to use the edit_file tool to update the notes file, then stop. You can make multiple edits (update every section as needed) - make all edit_file tool calls in a single message. Do not call any other tools.

CRITICAL RULES FOR EDITING:
- The file must maintain its exact structure with all sections, headers, and italic descriptions intact
- NEVER modify, delete, or add section headers (the lines starting with '#' like # Task specification)
- NEVER modify or delete the italic _section description_ lines
- ONLY update the actual content that appears BELOW the italic _section descriptions_ within each existing section
- Keep each section focused and concise (max ~300 words per section)
- Do not add new sections

After making all necessary edits, stop — do not produce any other output.`
}

/**
 * Rough token estimate for a string: ~4 chars per token
 */
function roughTokenEstimate(text: string): number {
  return Math.floor(text.length / 4)
}

/**
 * Truncate SM content to maxTokens, keeping the head.
 */
export function truncateSessionMemoryForCompact(
  content: string,
  maxTokens = MAX_TOTAL_SESSION_MEMORY_TOKENS,
): string {
  if (roughTokenEstimate(content) <= maxTokens) return content
  const charBudget = maxTokens * 4
  return (
    content.slice(0, charBudget) +
    '\n\n[... session memory truncated for compaction]'
  )
}

/**
 * Returns true if the SM file has no meaningful content beyond template headers.
 */
export function isSessionMemoryEmpty(content: string): boolean {
  if (!content.trim()) return true
  // Strip section headers and italic template descriptions
  const stripped = content
    .replace(/^#.+$/gm, '')
    .replace(/^_[^_]+_$/gm, '')
    .trim()
  return stripped.length < 50
}
