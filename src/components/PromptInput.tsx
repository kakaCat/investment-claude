import { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Text, useInput } from 'ink'
import { getHistory } from '../history.js'
import type { HistoryEntry } from '../history.js'
import type { Skill } from '../skills/index.js'
import { useHistorySearch } from '../hooks/useHistorySearch.js'
import { useTypeahead } from '../hooks/useTypeahead.js'
import { PromptInputSuggestions } from './PromptInputSuggestions.js'

type Props = {
  onSubmit: (input: string) => void
  isLoading: boolean
  onExit?: () => Promise<void>
  onCancel?: () => void
  skills?: Skill[]
}

export type PromptHistoryState = {
  historyIndex: number
  historyCache: string[]
  savedInput: string
}

type PromptHistoryTransition = PromptHistoryState & {
  nextValue?: string
}

export function getNextHistoryUpState(
  state: PromptHistoryState,
  currentValue: string,
  loadedItems: string[],
): PromptHistoryTransition {
  if (state.historyCache.length === 0) {
    if (loadedItems.length === 0) {
      return state
    }

    return {
      historyIndex: 0,
      historyCache: loadedItems,
      savedInput: state.savedInput === '' ? currentValue : state.savedInput,
      nextValue: loadedItems[0],
    }
  }

  const nextIndex = Math.min(state.historyIndex + 1, state.historyCache.length - 1)
  return {
    ...state,
    historyIndex: nextIndex,
    nextValue: state.historyCache[nextIndex],
  }
}

export function getNextHistoryDownState(state: PromptHistoryState): PromptHistoryTransition {
  if (state.historyIndex > 0) {
    const nextIndex = state.historyIndex - 1
    return {
      ...state,
      historyIndex: nextIndex,
      nextValue: state.historyCache[nextIndex],
    }
  }

  if (state.historyIndex === 0) {
    return {
      historyIndex: -1,
      historyCache: [],
      savedInput: state.savedInput,
      nextValue: state.savedInput,
    }
  }

  return state
}

export function formatHistorySearchStatus(
  historyQuery: string,
  historyMatch: HistoryEntry | undefined,
  historyFailedMatch: boolean,
): string {
  return `${historyFailedMatch ? '(failed reverse-i-search)' : '(reverse-i-search)'}'${historyQuery}': ${historyMatch?.display ?? ''}`
}

export function PromptInput({ onSubmit, isLoading, onExit, onCancel, skills = [] }: Props) {
  const [value, setValue] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [historyCache, setHistoryCache] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [savedInput, setSavedInput] = useState('')

  const valueRef = useRef(value)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const resetHistoryNavigation = useCallback(() => {
    setHistoryIndex(-1)
    setHistoryCache([])
    setSavedInput('')
  }, [])

  const handleInputChange = useCallback((input: string) => {
    setValue(input)
  }, [])

  const handleSubmitValue = useCallback(
    (input: string) => {
      const nextValue = input.trim()
      if (!nextValue) {
        return
      }

      onSubmit(nextValue)
      setValue('')
      resetHistoryNavigation()
    },
    [onSubmit, resetHistoryNavigation],
  )

  const { suggestions, isOpen, handleKeyDown } = useTypeahead({
    value,
    onInputChange: handleInputChange,
    onSubmit: handleSubmitValue,
    skills,
  })

  const { historyQuery, historyMatch, historyFailedMatch, startSearch } = useHistorySearch(
    (entry: HistoryEntry) => {
      setValue(entry.display)
    },
    value,
    handleInputChange,
    isSearching,
    setIsSearching,
  )

  const handleUpArrow = useCallback(async () => {
    let loadedItems = historyCache

    if (historyCache.length === 0) {
      loadedItems = []
      const gen = getHistory()

      try {
        let result = await gen.next()
        while (!result.done && loadedItems.length < 100) {
          loadedItems.push(result.value.display)
          result = await gen.next()
        }
      } finally {
        await gen.return?.(undefined)
      }
    }

    const nextState = getNextHistoryUpState(
      { historyIndex, historyCache, savedInput },
      valueRef.current,
      loadedItems,
    )

    setHistoryIndex(nextState.historyIndex)
    setHistoryCache(nextState.historyCache)
    setSavedInput(nextState.savedInput)

    if (nextState.nextValue !== undefined) {
      setValue(nextState.nextValue)
    }
  }, [historyCache, historyIndex, savedInput])

  const handleDownArrow = useCallback(() => {
    const nextState = getNextHistoryDownState({ historyIndex, historyCache, savedInput })

    setHistoryIndex(nextState.historyIndex)
    setHistoryCache(nextState.historyCache)
    setSavedInput(nextState.savedInput)

    if (nextState.nextValue !== undefined) {
      setValue(nextState.nextValue)
    }
  }, [historyCache, historyIndex, savedInput])

  useInput((input, key) => {
    if (isLoading) return
    if (key.ctrl && input === 'c') {
      if (onExit) {
        void onExit()
      } else {
        process.exit(0)
      }
      return
    }

    // ESC：有内容则清空（对标 CC chat:cancel 输入中行为），无内容则透传给父级
    if (key.escape) {
      if (value.length > 0) {
        setValue('')
        resetHistoryNavigation()
      } else {
        onCancel?.()
      }
      return
    }

    if (isSearching) return
    if (handleKeyDown(input, key)) return

    if (key.upArrow) {
      void handleUpArrow()
      return
    }

    if (key.downArrow) {
      handleDownArrow()
      return
    }

    if (key.ctrl && input === 'r') {
      setSavedInput(valueRef.current)
      startSearch()
      return
    }

    if (key.return) {
      handleSubmitValue(value)
      return
    }

    if (key.backspace || key.delete) {
      setHistoryIndex(-1)
      setValue((v) => v.slice(0, -1))
      return
    }

    if (!key.ctrl && !key.meta && input) {
      setHistoryIndex(-1)
      setValue(v => v + input)
    }
  }, { isActive: !isSearching })

  return (
    <Box flexDirection="column">
      {isOpen && (
        <PromptInputSuggestions
          items={suggestions.items}
          selectedIndex={suggestions.selectedIndex}
          argumentHint={suggestions.argumentHint}
        />
      )}
      {isSearching && <Text>{formatHistorySearchStatus(historyQuery, historyMatch, historyFailedMatch)}</Text>}
      <Box>
        <Text color="green" bold>
          {'> '}
        </Text>
        <Text>{value}</Text>
        {!isLoading && <Text color="gray">█</Text>}
      </Box>
    </Box>
  )
}
