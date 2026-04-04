import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

import type { Skill } from '../skills/index.js'
import type { SkillUsageRecord } from './skillUsage.js'

export type CommandSource = 'builtin' | 'skill-user'

export type CommandItem = {
  id: string
  command: string
  label: string
  description: string
  source: CommandSource
  argumentHint?: string
}

export const BUILTIN_COMMANDS: CommandItem[] = [
  {
    id: 'builtin:help',
    command: '/help',
    label: 'help',
    description: 'Show available commands',
    source: 'builtin',
  },
  {
    id: 'builtin:clear',
    command: '/clear',
    label: 'clear',
    description: 'Clear the conversation',
    source: 'builtin',
  },
  {
    id: 'builtin:compact',
    command: '/compact',
    label: 'compact',
    description: 'Compress conversation to save tokens',
    source: 'builtin',
  },
  {
    id: 'builtin:compact-partial',
    command: '/compact partial',
    label: 'compact partial',
    description: 'Select pivot for partial compact',
    source: 'builtin',
  },
  {
    id: 'builtin:exit',
    command: '/exit',
    label: 'exit',
    description: 'Exit the session',
    source: 'builtin',
  },
]

type SearchItem = CommandItem & {
  labelParts: string[]
}

const searchOptions = {
  includeScore: true,
  threshold: 0.4,
  keys: [
    { name: 'label', weight: 3 },
    { name: 'labelParts', weight: 2 },
    { name: 'description', weight: 0.5 },
  ],
} satisfies IFuseOptions<SearchItem>

function compareLabels(a: CommandItem, b: CommandItem): number {
  return a.label.localeCompare(b.label)
}

function splitLabel(label: string): string[] {
  return label
    .split(/[-_:/\s]+/)
    .map(part => part.trim())
    .filter(Boolean)
}

function dedupeById(items: CommandItem[]): CommandItem[] {
  const byId = new Map<string, CommandItem>()

  for (const item of items) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item)
    }
  }

  return Array.from(byId.values())
}

export function buildCommandList(skills: Skill[]): CommandItem[] {
  const skillItems = skills.map<CommandItem>(skill => ({
    id: `skill-user:${skill.name}`,
    command: `/${skill.name}`,
    label: skill.name,
    description: skill.description,
    source: 'skill-user',
  }))

  return [...BUILTIN_COMMANDS, ...skillItems]
}

export function generateSuggestions(
  input: string,
  allCommands: CommandItem[],
  usageMap: SkillUsageRecord,
): CommandItem[] {
  if (!input.startsWith('/')) {
    return []
  }

  if (input.trim() === '/') {
    const skills = allCommands.filter(item => item.source !== 'builtin')
    const recentSkills = skills
      .filter(item => (usageMap[item.label]?.count ?? 0) > 0)
      .sort((a, b) => {
        const lastUsedDiff = (usageMap[b.label]?.lastUsed ?? 0) - (usageMap[a.label]?.lastUsed ?? 0)
        return lastUsedDiff || compareLabels(a, b)
      })
      .slice(0, 5)

    const builtinCommands = allCommands.filter(item => item.source === 'builtin')
    const unusedSkills = skills
      .filter(item => (usageMap[item.label]?.count ?? 0) === 0)
      .sort(compareLabels)

    return [...recentSkills, ...builtinCommands, ...unusedSkills]
  }

  const query = input.slice(1)
  const normalizedQuery = query.toLowerCase()
  const exactPrefixMatches = allCommands
    .filter(item => item.label.toLowerCase().startsWith(normalizedQuery))
    .sort((a, b) => a.label.length - b.label.length || compareLabels(a, b))

  const fuseItems: SearchItem[] = allCommands.map(item => ({
    ...item,
    labelParts: splitLabel(item.label),
  }))
  const fuse = new Fuse(fuseItems, searchOptions)
  const fuzzyMatches = fuse
    .search(query)
    .sort((a, b) => (a.score ?? Number.POSITIVE_INFINITY) - (b.score ?? Number.POSITIVE_INFINITY))
    .map(result => {
      const { labelParts: _labelParts, ...item } = result.item
      return item
    })

  return dedupeById([...exactPrefixMatches, ...fuzzyMatches])
}

export function applySelection(
  item: CommandItem,
  shouldExecute: boolean,
  onInputChange: (value: string) => void,
  onSubmit: (value: string) => void,
  recordUsage: (name: string) => void,
): void {
  if (shouldExecute) {
    onSubmit(item.command)
    if (item.source !== 'builtin') {
      recordUsage(item.label)
    }
    return
  }

  if (item.argumentHint) {
    onInputChange(`${item.command} `)
    return
  }

  onInputChange(item.command)
}
