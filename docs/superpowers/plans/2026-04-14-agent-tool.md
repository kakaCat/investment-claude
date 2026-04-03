# AgentTool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement AgentTool for pi-claude-code so the model can spawn synchronous sub-agents with isolated tool pools.

**Architecture:** Layered design mirroring Claude Code's structure — `src/agents/` owns the definition types, loading, and tool pool assembly; `src/tools/AgentTool/` owns the tool entry point and sub-agent execution. `runSubAgent()` wraps the existing `query()` generator and is the future extension point for background/fork/worktree modes.

**Tech Stack:** TypeScript ESM, React/Ink 5, Anthropic SDK, Node.js `fs/promises`, no new dependencies.

---

## File Map

**Create:**
- `src/agents/types.ts` — `AgentDefinition` type
- `src/agents/resolveModel.ts` — model alias → actual model name
- `src/agents/assembleToolPool.ts` — filter tool pool by agent def
- `src/agents/built-in/generalPurposeAgent.ts` — general-purpose agent
- `src/agents/built-in/exploreAgent.ts` — read-only explorer agent
- `src/agents/built-in/planAgent.ts` — read-only planning agent
- `src/agents/loadAgents.ts` — load built-ins + scan `.claude/agents/` dirs
- `src/tools/AgentTool/prompt.ts` — description + searchHint
- `src/tools/AgentTool/UI.tsx` — renderToolUse + renderToolResult
- `src/tools/AgentTool/runSubAgent.ts` — execute sub-agent via `query()`
- `src/tools/AgentTool/AgentTool.tsx` — tool entry point

**Modify:**
- `src/tools/index.ts` — register AgentTool
- `src/Tool.tsx` — add design comment to `ToolUseContext`

---

## Task 1: AgentDefinition Type

**Files:**
- Create: `src/agents/types.ts`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/agents/types.ts
git commit -m "feat: add AgentDefinition type"
```

---

## Task 2: Model Resolution

**Files:**
- Create: `src/agents/resolveModel.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/agents/resolveModel.ts

const MODEL_ALIASES: Record<string, string> = {
  haiku:  process.env.PI_MODEL_HAIKU  ?? 'claude-haiku-4-5',
  sonnet: process.env.PI_MODEL_SONNET ?? 'claude-sonnet-4-5',
  opus:   process.env.PI_MODEL_OPUS   ?? 'claude-opus-4-5',
}

/**
 * Resolves an agent's model field to an actual model name.
 * - undefined / 'inherit' → PI_MODEL env var (same model as parent agent)
 * - 'haiku' / 'sonnet' / 'opus' → alias lookup with env override
 * - any other string → returned as-is (full model name)
 */
export function resolveModel(model?: string): string {
  const defaultModel = process.env.PI_MODEL ?? 'deepseek-chat'
  if (!model || model === 'inherit') return defaultModel
  return MODEL_ALIASES[model] ?? model
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/agents/resolveModel.ts
git commit -m "feat: add resolveModel for agent model alias resolution"
```

---

## Task 3: Tool Pool Assembly

**Files:**
- Create: `src/agents/assembleToolPool.ts`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/agents/assembleToolPool.ts
git commit -m "feat: add assembleToolPool for sub-agent tool filtering"
```

---

## Task 4: Built-in Agent — general-purpose

**Files:**
- Create: `src/agents/built-in/generalPurposeAgent.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/agents/built-in/generalPurposeAgent.ts

import type { AgentDefinition } from '../types.js'

function getSystemPrompt(): string {
  return `You are a general-purpose agent. Given the user's task, use the tools available to complete it fully. When done, respond with a concise report of what was done and any key findings — the caller will relay this to the user.

Your strengths:
- Searching for code, configurations, and patterns across large codebases
- Analyzing multiple files to understand system architecture
- Investigating complex questions that require exploring many files
- Performing multi-step research and implementation tasks

Guidelines:
- Be thorough: check multiple locations, consider different naming conventions.
- NEVER create files unless absolutely necessary. ALWAYS prefer editing existing files.
- NEVER proactively create documentation files (*.md) or README files unless explicitly asked.`
}

export const GENERAL_PURPOSE_AGENT: AgentDefinition = {
  agentType: 'general-purpose',
  whenToUse:
    'General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you.',
  tools: ['*'],
  source: 'built-in',
  getSystemPrompt,
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/agents/built-in/generalPurposeAgent.ts
git commit -m "feat: add general-purpose built-in agent"
```

---

## Task 5: Built-in Agent — Explore

**Files:**
- Create: `src/agents/built-in/exploreAgent.ts`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/agents/built-in/exploreAgent.ts
git commit -m "feat: add Explore built-in agent (read-only codebase search)"
```

---

## Task 6: Built-in Agent — Plan

**Files:**
- Create: `src/agents/built-in/planAgent.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/agents/built-in/planAgent.ts

import type { AgentDefinition } from '../types.js'

function getSystemPrompt(): string {
  return `You are a software architect and planning specialist. Your role is to explore the codebase and design implementation plans.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
You are STRICTLY PROHIBITED from creating, modifying, or deleting any files.
Your role is EXCLUSIVELY to explore the codebase and design implementation plans.

## Your Process

1. **Understand Requirements**: Read and fully understand the provided requirements.

2. **Explore Thoroughly**:
   - Find existing patterns using glob, grep, and read_file
   - Understand the current architecture
   - Identify similar features as reference
   - Use bash ONLY for read-only operations (ls, git log, git diff, find, cat, head, tail)

3. **Design Solution**:
   - Create a clear implementation approach
   - Consider trade-offs and architectural decisions
   - Follow existing patterns where appropriate

4. **Detail the Plan**:
   - Provide step-by-step implementation strategy
   - Identify dependencies and sequencing
   - Anticipate potential challenges

Return a structured plan the caller can execute.`
}

export const PLAN_AGENT: AgentDefinition = {
  agentType: 'Plan',
  whenToUse:
    'Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs.',
  tools: ['read_file', 'glob', 'grep', 'bash'],
  source: 'built-in',
  getSystemPrompt,
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/agents/built-in/planAgent.ts
git commit -m "feat: add Plan built-in agent (read-only architecture planning)"
```

---

## Task 7: Agent Loader

**Files:**
- Create: `src/agents/loadAgents.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/agents/loadAgents.ts

import { readdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { AgentDefinition } from './types.js'
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js'
import { EXPLORE_AGENT } from './built-in/exploreAgent.js'
import { PLAN_AGENT } from './built-in/planAgent.js'

const BUILT_IN_AGENTS: AgentDefinition[] = [
  GENERAL_PURPOSE_AGENT,
  EXPLORE_AGENT,
  PLAN_AGENT,
]

/**
 * Parses a simple inline YAML array like "[a, b, c]" into string[].
 * Returns undefined if the value doesn't look like an array.
 */
function parseYamlArray(value: string): string[] | undefined {
  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return undefined
  return trimmed
    .slice(1, -1)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * Parses YAML frontmatter and body from a .md file.
 * Supports: description, tools, disallowedTools, model, maxTurns.
 */
function parseAgentFile(
  content: string,
  filename: string,
): AgentDefinition | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!fmMatch) return null

  const frontmatter = fmMatch[1]!
  const body = fmMatch[2]!.trim()

  const get = (key: string): string | undefined => {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
    return m?.[1]?.trim()
  }

  const description = get('description')
  if (!description) return null  // description is required

  const toolsRaw = get('tools')
  const tools = toolsRaw ? (parseYamlArray(toolsRaw) ?? [toolsRaw]) : undefined

  const disallowedRaw = get('disallowedTools')
  const disallowedTools = disallowedRaw
    ? (parseYamlArray(disallowedRaw) ?? [disallowedRaw])
    : undefined

  const model = get('model')
  const maxTurnsRaw = get('maxTurns')
  const maxTurns = maxTurnsRaw ? parseInt(maxTurnsRaw, 10) : undefined

  const agentType = basename(filename, '.md')
  const systemPrompt = body

  return {
    agentType,
    whenToUse: description,
    tools,
    disallowedTools,
    model,
    maxTurns: Number.isNaN(maxTurns ?? NaN) ? undefined : maxTurns,
    getSystemPrompt: () => systemPrompt,
    source: 'custom',
  }
}

/**
 * Returns directories that may contain agent .md files, in load order.
 * Later entries override earlier ones by agentType.
 */
function getAgentDirs(cwd: string): string[] {
  return [
    join(homedir(), '.claude', 'agents'),
    join(cwd, '.claude', 'agents'),
  ].filter(d => existsSync(d))
}

/**
 * Loads all agents: built-ins first, then custom from directories.
 * Custom agents with the same agentType as a built-in override it.
 * Later directories override earlier directories.
 */
export async function loadAgents(cwd: string): Promise<AgentDefinition[]> {
  const byType = new Map<string, AgentDefinition>()

  // Register built-ins first (lowest priority)
  for (const agent of BUILT_IN_AGENTS) {
    byType.set(agent.agentType, agent)
  }

  // Load custom agents (higher priority, later dirs win)
  for (const dir of getAgentDirs(cwd)) {
    const files = await readdir(dir).catch(() => [] as string[])
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const content = await readFile(join(dir, file), 'utf-8').catch(() => '')
      if (!content) continue
      const agent = parseAgentFile(content, file)
      if (agent) byType.set(agent.agentType, agent)
    }
  }

  return Array.from(byType.values())
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/agents/
git commit -m "feat: add agent loader (built-ins + .claude/agents/ directory)"
```

---

## Task 8: AgentTool UI & Prompt

**Files:**
- Create: `src/tools/AgentTool/prompt.ts`
- Create: `src/tools/AgentTool/UI.tsx`

- [ ] **Step 1: Create prompt.ts**

```typescript
// src/tools/AgentTool/prompt.ts

export const SEARCH_HINT = 'spawn agent subagent delegate task worker'

export const DESCRIPTION = `Launch a new agent to handle complex, multi-step tasks autonomously.

Available agent types and the tools they have access to:
- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks.
- Explore: Fast agent specialized for exploring codebases. Use for finding files by patterns, searching code for keywords, or answering questions about the codebase.
- Plan: Software architect agent for designing implementation plans. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs.

When calling this agent, provide a clear, complete prompt with all context needed — the agent starts with no prior conversation history.`
```

- [ ] **Step 2: Create UI.tsx**

```tsx
// src/tools/AgentTool/UI.tsx

import React from 'react'
import { Box, Text } from 'ink'

export function AgentToolUseUI({
  input,
}: {
  input: { description: string; subagent_type?: string }
}) {
  return (
    <Box>
      <Text color="magenta" bold>
        agent({input.subagent_type ?? 'general-purpose'}){' '}
      </Text>
      <Text color="gray">{input.description}</Text>
    </Box>
  )
}

export function AgentToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('ERROR:')
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box borderStyle="single" borderColor={isError ? 'red' : 'gray'} paddingX={1}>
      <Text color={isError ? 'red' : 'gray'}>{display}</Text>
    </Box>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/tools/AgentTool/prompt.ts src/tools/AgentTool/UI.tsx
git commit -m "feat: add AgentTool prompt and UI components"
```

---

## Task 9: runSubAgent

**Files:**
- Create: `src/tools/AgentTool/runSubAgent.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/tools/AgentTool/runSubAgent.ts

import type { Tool } from '../../Tool.js'
import type { AgentDefinition } from '../../agents/types.js'
import { assembleToolPool } from '../../agents/assembleToolPool.js'
import { resolveModel } from '../../agents/resolveModel.js'
import { query } from '../../query.js'

export type SubAgentContext = {
  allTools: Tool[]
  abortSignal: AbortSignal
  cwd: string
}

/**
 * Executes a sub-agent synchronously: assembles the tool pool, calls query(),
 * collects all streamed text, and returns the final result string.
 *
 * Extension points (add when needed):
 * - TODO(background): wrap in async task, return task ID immediately
 * - TODO(fork): accept parent messages to prepend (fork mode)
 * - TODO(worktree): create isolated git worktree, override cwd
 */
export async function runSubAgent(
  agentDef: AgentDefinition,
  prompt: string,
  parentContext: SubAgentContext,
): Promise<string> {
  const toolPool = assembleToolPool(parentContext.allTools, agentDef)
  const model = resolveModel(agentDef.model)

  const messages = [
    {
      type: 'user' as const,
      content: [{ type: 'text' as const, text: prompt }],
    },
  ]

  let result = ''

  const gen = query({
    messages,
    tools: toolPool,
    allTools: toolPool,
    systemPrompt: agentDef.getSystemPrompt(),
    model,
    maxTurns: agentDef.maxTurns ?? 10,
    abortSignal: parentContext.abortSignal,
    // Sub-agent has full permission within its assembled tool pool
    canUseTool: () => Promise.resolve('allow' as const),
  })

  for await (const event of gen) {
    if (event.type === 'text_delta') result += event.delta
    if (event.type === 'error') throw event.error
  }

  return result.trim() || '(no output)'
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/AgentTool/runSubAgent.ts
git commit -m "feat: add runSubAgent — synchronous sub-agent executor"
```

---

## Task 10: AgentTool Entry Point

**Files:**
- Create: `src/tools/AgentTool/AgentTool.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/tools/AgentTool/AgentTool.tsx

import React from 'react'
import { buildTool } from '../../Tool.js'
import { loadAgents } from '../../agents/loadAgents.js'
import { runSubAgent } from './runSubAgent.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { AgentToolUseUI, AgentToolResultUI } from './UI.js'

export const AgentTool = buildTool({
  name: 'agent',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'A short (3-5 word) description of the task',
      },
      prompt: {
        type: 'string',
        description:
          'The task for the agent to perform. Be complete — the agent has no prior conversation history.',
      },
      subagent_type: {
        type: 'string',
        description:
          'The type of specialized agent to use. Omit to use general-purpose.',
      },
      // Schema only — not yet implemented. Reserved for future background execution.
      run_in_background: {
        type: 'boolean',
        description:
          'Set to true to run this agent in the background (not yet supported — reserved for future use).',
      },
    },
    required: ['description', 'prompt'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => (
    <AgentToolUseUI input={input as { description: string; subagent_type?: string }} />
  ),
  renderToolResult: (result) => <AgentToolResultUI result={result} />,
  async call(input, context) {
    const { prompt, subagent_type } =
      input as { prompt: string; description: string; subagent_type?: string }

    const agents = await loadAgents(context.cwd)
    const type = subagent_type ?? 'general-purpose'
    const agentDef = agents.find(a => a.agentType === type)

    if (!agentDef) {
      const available = agents.map(a => a.agentType).join(', ')
      return `ERROR: Unknown agent type '${type}'. Available: ${available}`
    }

    // TODO(background): if run_in_background === true, wrap in async task
    // TODO(fork): if !subagent_type && forkGateEnabled, use buildForkedMessages
    // TODO(worktree): if isolation === 'worktree', createAgentWorktree first

    return runSubAgent(agentDef, prompt, {
      allTools: context.tools,
      abortSignal: context.abortSignal,
      cwd: context.cwd,
    })
  },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/AgentTool/AgentTool.tsx
git commit -m "feat: add AgentTool entry point"
```

---

## Task 11: Wire Up

**Files:**
- Modify: `src/tools/index.ts`
- Modify: `src/Tool.tsx`

- [ ] **Step 1: Register AgentTool in src/tools/index.ts**

Add import after the existing imports (before the `BUILTIN_TOOLS` array):

```typescript
import { AgentTool } from './AgentTool/AgentTool.js'
```

Add `AgentTool` as the **first** entry in `BUILTIN_TOOLS` (so it appears first in the tool list):

```typescript
const BUILTIN_TOOLS: Tool[] = [
  AgentTool,
  BashTool,
  // ... rest unchanged
]
```

- [ ] **Step 2: Add design comment to ToolUseContext in src/Tool.tsx**

In `src/Tool.tsx`, find the `ToolUseContext` type definition and add the design comment after the `tools` field:

```typescript
export type ToolUseContext = {
  abortSignal: AbortSignal
  cwd: string
  /** All tools (including deferLoading), for ToolSearchTool to traverse */
  tools: Tool[]
  // Design note: agent definitions are NOT stored in ToolUseContext.
  // AgentTool loads them directly from disk + built-in registry.
  // Rationale: context = execution environment; agent registry = AgentTool's concern.
  // If multiple tools ever need agent access, follow Claude Code's pattern of
  // a toolUseContext.options bag rather than polluting the core context fields.
  /** Delegate a question to the REPL UI, wait for user selection */
  askUser?: (
    question: string,
    options: ReadonlyArray<{ label: string; description?: string }>,
  ) => Promise<string>
  // ... rest unchanged
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/tools/index.ts src/Tool.tsx
git commit -m "feat: register AgentTool and add ToolUseContext design comment"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| AgentDefinition type | Task 1 |
| resolveModel (alias → model name) | Task 2 |
| assembleToolPool (whitelist + blacklist) | Task 3 |
| general-purpose built-in agent | Task 4 |
| Explore built-in agent | Task 5 |
| Plan built-in agent | Task 6 |
| Load from `~/.claude/agents/` and `{cwd}/.claude/agents/` | Task 7 |
| YAML frontmatter parsing (description, tools, model, maxTurns) | Task 7 |
| Later dirs override earlier by agentType | Task 7 |
| AgentTool input schema (description, prompt, subagent_type, run_in_background) | Task 10 |
| ERROR on unknown agent type with available list | Task 10 |
| runSubAgent wraps query() | Task 9 |
| Sub-agent canUseTool always allow within pool | Task 9 |
| TODO comments for background/fork/worktree | Task 9, 10 |
| Register in tools/index.ts | Task 11 |
| ToolUseContext design comment | Task 11 |

All spec requirements covered. ✅
