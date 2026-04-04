import { describe, expect, it, vi } from 'vitest'

import type { Key } from 'ink'

import type { CommandItem } from '../../utils/commandSuggestions.js'
import type { Skill } from '../../skills/index.js'
import {
  EMPTY_SUGGESTIONS,
  getSuggestionsState,
  handleTypeaheadKeyEvent,
  type SuggestionsState,
} from '../useTypeahead.js'

function createKey(key: Partial<Key>): Key {
  return key as Key
}

describe('getSuggestionsState', () => {
  it('returns empty suggestions when the input is not a slash command', () => {
    const skills: Skill[] = [{ name: 'commit', description: 'Commit changes', filePath: '/tmp/commit.md' }]

    expect(getSuggestionsState('commit', skills, {})).toEqual(EMPTY_SUGGESTIONS)
  })

  it('selects the first generated command when the input starts with slash', () => {
    const skills: Skill[] = [
      { name: 'commit', description: 'Commit changes', filePath: '/tmp/commit.md' },
      { name: 'review', description: 'Review a diff', filePath: '/tmp/review.md' },
    ]

    const suggestions = getSuggestionsState('/co', skills, {})

    expect(suggestions.items[0]?.label).toBe('commit')
    expect(suggestions.selectedIndex).toBe(0)
    expect(suggestions.argumentHint).toBeUndefined()
  })
})

describe('handleTypeaheadKeyEvent', () => {
  const suggestions: SuggestionsState = {
    items: [
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
        argumentHint: '<pivot>',
      },
      {
        id: 'skill-user:commit',
        command: '/commit',
        label: 'commit',
        description: 'Commit changes',
        source: 'skill-user',
      },
    ],
    selectedIndex: 1,
    argumentHint: '<pivot>',
  }

  function runKey(
    key: Partial<Key>,
    overrides: Partial<{
      state: SuggestionsState
      value: string
      dismissedFor: string | null
      recordUsage: (name: string) => void
    }> = {},
  ) {
    let nextState = overrides.state ?? suggestions
    const dismissedForRef = { current: overrides.dismissedFor ?? null as string | null }
    const onInputChange = vi.fn()
    const onSubmit = vi.fn()
    const recordUsage = vi.fn(overrides.recordUsage)
    const setSuggestions = vi.fn((value: SuggestionsState | ((prev: SuggestionsState) => SuggestionsState)) => {
      nextState = typeof value === 'function' ? value(nextState) : value
    })

    const handled = handleTypeaheadKeyEvent({
      key: createKey(key),
      value: overrides.value ?? '/compact partial',
      suggestions: nextState,
      onInputChange,
      onSubmit,
      recordUsage,
      dismissedForRef,
      setSuggestions,
    })

    return {
      handled,
      nextState,
      dismissedForRef,
      onInputChange,
      onSubmit,
      recordUsage,
      setSuggestions,
    }
  }

  it('returns false when the suggestions panel is closed', () => {
    const result = runKey({ downArrow: true }, { state: EMPTY_SUGGESTIONS })

    expect(result.handled).toBe(false)
    expect(result.setSuggestions).not.toHaveBeenCalled()
  })

  it('moves the selection down and syncs the argument hint', () => {
    const result = runKey({ downArrow: true })

    expect(result.handled).toBe(true)
    expect(result.nextState.selectedIndex).toBe(2)
    expect(result.nextState.argumentHint).toBeUndefined()
  })

  it('moves the selection up without going below zero', () => {
    const result = runKey(
      { upArrow: true },
      {
        state: {
          ...suggestions,
          selectedIndex: 0,
          argumentHint: undefined,
        },
      },
    )

    expect(result.handled).toBe(true)
    expect(result.nextState.selectedIndex).toBe(0)
    expect(result.nextState.argumentHint).toBeUndefined()
  })

  it('applies the selected item on tab and clears suggestions', () => {
    const result = runKey({ tab: true })

    expect(result.handled).toBe(true)
    expect(result.onInputChange).toHaveBeenCalledWith('/compact partial ')
    expect(result.onSubmit).not.toHaveBeenCalled()
    expect(result.nextState).toEqual(EMPTY_SUGGESTIONS)
  })

  it('submits the selected item on enter and records usage for skills', () => {
    const result = runKey(
      { return: true },
      {
        state: {
          items: [suggestions.items[2] as CommandItem],
          selectedIndex: 0,
          argumentHint: undefined,
        },
      },
    )

    expect(result.handled).toBe(true)
    expect(result.onSubmit).toHaveBeenCalledWith('/commit')
    expect(result.recordUsage).toHaveBeenCalledWith('commit')
    expect(result.nextState).toEqual(EMPTY_SUGGESTIONS)
  })

  it('dismisses the panel on escape for the current value', () => {
    const result = runKey({ escape: true }, { value: '/commit' })

    expect(result.handled).toBe(true)
    expect(result.dismissedForRef.current).toBe('/commit')
    expect(result.nextState).toEqual(EMPTY_SUGGESTIONS)
  })

  it('clears dismissal state for other keys and returns false', () => {
    const result = runKey({ leftArrow: true }, { dismissedFor: '/commit' })

    expect(result.handled).toBe(false)
    expect(result.dismissedForRef.current).toBeNull()
    expect(result.setSuggestions).not.toHaveBeenCalled()
  })
})
