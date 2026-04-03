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
