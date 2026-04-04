import { describe, expect, it, vi } from 'vitest'

import type { Skill } from '../../skills/index.js'
import type { SkillUsageRecord } from '../skillUsage.js'
import {
  BUILTIN_COMMANDS,
  applySelection,
  buildCommandList,
  generateSuggestions,
  type CommandItem,
} from '../commandSuggestions.js'

describe('buildCommandList', () => {
  it('appends skills after builtin commands with skill-user source', () => {
    const skills: Skill[] = [
      {
        name: 'commit',
        description: 'Commit staged changes',
        filePath: '/tmp/commit.md',
      },
      {
        name: 'review',
        description: 'Review a diff',
        filePath: '/tmp/review.md',
      },
    ]

    expect(buildCommandList(skills)).toEqual([
      ...BUILTIN_COMMANDS,
      {
        id: 'skill-user:commit',
        command: '/commit',
        label: 'commit',
        description: 'Commit staged changes',
        source: 'skill-user',
      },
      {
        id: 'skill-user:review',
        command: '/review',
        label: 'review',
        description: 'Review a diff',
        source: 'skill-user',
      },
    ])
  })
})

describe('generateSuggestions', () => {
  it('shows recent skills, then builtin commands, then unused skills when input is only slash', () => {
    const skills: Skill[] = [
      { name: 'commit', description: 'Commit staged changes', filePath: '/tmp/commit.md' },
      { name: 'review', description: 'Review a diff', filePath: '/tmp/review.md' },
      { name: 'deploy', description: 'Deploy the app', filePath: '/tmp/deploy.md' },
      { name: 'lint', description: 'Run linters', filePath: '/tmp/lint.md' },
      { name: 'test', description: 'Run tests', filePath: '/tmp/test.md' },
      { name: 'alpha', description: 'Alphabetical fallback', filePath: '/tmp/alpha.md' },
      { name: 'beta', description: 'Alphabetical fallback', filePath: '/tmp/beta.md' },
    ]
    const usageMap: SkillUsageRecord = {
      lint: { count: 1, lastUsed: 10 },
      commit: { count: 3, lastUsed: 50 },
      review: { count: 2, lastUsed: 30 },
      deploy: { count: 1, lastUsed: 40 },
      test: { count: 1, lastUsed: 20 },
      alpha: { count: 0, lastUsed: 999 },
    }

    const suggestions = generateSuggestions('/', buildCommandList(skills), usageMap)

    expect(suggestions.map(item => item.label)).toEqual([
      'commit',
      'deploy',
      'review',
      'test',
      'lint',
      'help',
      'clear',
      'compact',
      'compact partial',
      'exit',
      'alpha',
      'beta',
    ])
  })

  it('prioritizes exact prefixes before fuzzy matches and removes duplicates by id', () => {
    const allCommands: CommandItem[] = [
      ...BUILTIN_COMMANDS,
      {
        id: 'skill-user:cla',
        command: '/cla',
        label: 'cla',
        description: 'Short exact prefix',
        source: 'skill-user',
      },
      {
        id: 'skill-user:clarify',
        command: '/clarify',
        label: 'clarify',
        description: 'Longer exact prefix',
        source: 'skill-user',
      },
      {
        id: 'skill-user:planner',
        command: '/planner',
        label: 'planner',
        description: 'Clarify a project plan',
        source: 'skill-user',
      },
    ]

    const suggestions = generateSuggestions('/cl', allCommands, {})

    expect(suggestions.slice(0, 3).map(item => item.id)).toEqual([
      'skill-user:cla',
      'builtin:clear',
      'skill-user:clarify',
    ])
    expect(new Set(suggestions.map(item => item.id)).size).toBe(suggestions.length)
    expect(suggestions.at(-1)?.id).toBe('skill-user:planner')
  })
})

describe('applySelection', () => {
  it('submits the command and records usage for non-builtin commands', () => {
    const onInputChange = vi.fn()
    const onSubmit = vi.fn()
    const recordUsage = vi.fn()

    applySelection(
      {
        id: 'skill-user:commit',
        command: '/commit',
        label: 'commit',
        description: 'Commit staged changes',
        source: 'skill-user',
      },
      true,
      onInputChange,
      onSubmit,
      recordUsage,
    )

    expect(onSubmit).toHaveBeenCalledWith('/commit')
    expect(recordUsage).toHaveBeenCalledWith('commit')
    expect(onInputChange).not.toHaveBeenCalled()
  })

  it('fills the input and appends a trailing space when an argument hint exists', () => {
    const onInputChange = vi.fn()
    const onSubmit = vi.fn()
    const recordUsage = vi.fn()

    applySelection(
      {
        id: 'builtin:compact-partial',
        command: '/compact partial',
        label: 'compact partial',
        description: 'Select pivot for partial compact',
        source: 'builtin',
        argumentHint: '<pivot>',
      },
      false,
      onInputChange,
      onSubmit,
      recordUsage,
    )

    expect(onInputChange).toHaveBeenCalledWith('/compact partial ')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(recordUsage).not.toHaveBeenCalled()
  })
})
