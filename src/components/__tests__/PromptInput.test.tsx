import { describe, expect, it } from 'vitest'

import type { HistoryEntry } from '../../history.js'
import {
  formatHistorySearchStatus,
  getNextHistoryUpState,
  getNextHistoryDownState,
  type PromptHistoryState,
} from '../PromptInput.js'

function createState(overrides: Partial<PromptHistoryState> = {}): PromptHistoryState {
  return {
    historyIndex: -1,
    historyCache: [],
    savedInput: '',
    ...overrides,
  }
}

describe('PromptInput history navigation helpers', () => {
  it('loads the newest history entry and preserves the current input on first up-arrow', () => {
    const result = getNextHistoryUpState(
      createState(),
      'draft prompt',
      ['latest command', 'older command'],
    )

    expect(result).toEqual({
      historyIndex: 0,
      historyCache: ['latest command', 'older command'],
      savedInput: 'draft prompt',
      nextValue: 'latest command',
    })
  })

  it('moves deeper into cached history on repeated up-arrow presses', () => {
    const result = getNextHistoryUpState(
      createState({
        historyIndex: 0,
        historyCache: ['latest command', 'older command'],
        savedInput: 'draft prompt',
      }),
      'latest command',
      ['ignored'],
    )

    expect(result).toEqual({
      historyIndex: 1,
      historyCache: ['latest command', 'older command'],
      savedInput: 'draft prompt',
      nextValue: 'older command',
    })
  })

  it('restores the saved draft and clears the cache when down-arrow exits history mode', () => {
    const result = getNextHistoryDownState(
      createState({
        historyIndex: 0,
        historyCache: ['latest command', 'older command'],
        savedInput: 'draft prompt',
      }),
    )

    expect(result).toEqual({
      historyIndex: -1,
      historyCache: [],
      savedInput: 'draft prompt',
      nextValue: 'draft prompt',
    })
  })
})

describe('formatHistorySearchStatus', () => {
  it('formats the active reverse search line with the matched entry', () => {
    const entry: HistoryEntry = { display: 'git status', pastedContents: {} }

    expect(formatHistorySearchStatus('git', entry, false)).toBe(
      "(reverse-i-search)'git': git status",
    )
  })

  it('formats the failed reverse search line without a match', () => {
    expect(formatHistorySearchStatus('missing', undefined, true)).toBe(
      "(failed reverse-i-search)'missing': ",
    )
  })
})
