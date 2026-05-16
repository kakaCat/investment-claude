import { useState, useCallback, useEffect, useRef, memo } from 'react'
import { Box, Text, useInput } from 'ink'
import { getHistory } from '../history.js'
import type { HistoryEntry } from '../history.js'
import type { Skill } from '../skills/index.js'
import { useHistorySearch } from '../hooks/useHistorySearch.js'
import { useTypeahead } from '../hooks/useTypeahead.js'
import { PromptInputSuggestions } from './PromptInputSuggestions.js'
import {
  moveCursorLeft,
  moveCursorRight,
  moveCursorHome,
  moveCursorEnd,
  insertAtCursor,
  deleteBeforeCursor,
  deleteAtCursor,
} from './cursorInput.js'

type Props = {
  onSubmit: (input: string) => void
  isLoading: boolean
  disabled?: boolean
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

export const PromptInput = memo(function PromptInput({ onSubmit, isLoading, disabled = false, onExit, onCancel, skills = [] }: Props) {
  const [value, setValue] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [historyCache, setHistoryCache] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [savedInput, setSavedInput] = useState('')

  const valueRef = useRef(value)
  const cursorPosRef = useRef(cursorPos)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    cursorPosRef.current = cursorPos
  }, [cursorPos])

  // 同步设置 value 和 cursorPos 的辅助函数
  const setValueAndCursor = useCallback((newValue: string, newCursor: number) => {
    setValue(newValue)
    setCursorPos(newCursor)
  }, [])

  const resetHistoryNavigation = useCallback(() => {
    setHistoryIndex(-1)
    setHistoryCache([])
    setSavedInput('')
  }, [])

  const handleInputChange = useCallback((input: string) => {
    setValue(input)
    setCursorPos(input.length)
  }, [])

  const handleSubmitValue = useCallback(
    (input: string) => {
      const nextValue = input.trim()
      if (!nextValue) {
        return
      }

      onSubmit(nextValue)
      setValue('')
      setCursorPos(0)
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
      setCursorPos(nextState.nextValue.length)
    }
  }, [historyCache, historyIndex, savedInput])

  const handleDownArrow = useCallback(() => {
    const nextState = getNextHistoryDownState({ historyIndex, historyCache, savedInput })

    setHistoryIndex(nextState.historyIndex)
    setHistoryCache(nextState.historyCache)
    setSavedInput(nextState.savedInput)

    if (nextState.nextValue !== undefined) {
      setValue(nextState.nextValue)
      setCursorPos(nextState.nextValue.length)
    }
  }, [historyCache, historyIndex, savedInput])

  useInput((input, key) => {
    if (disabled || isLoading) return

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
        setCursorPos(0)
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

    // ← 左移光标
    if (key.leftArrow) {
      const next = moveCursorLeft({ value, cursorPos })
      setCursorPos(next.cursorPos)
      return
    }

    // → 右移光标
    if (key.rightArrow) {
      const next = moveCursorRight({ value, cursorPos })
      setCursorPos(next.cursorPos)
      return
    }

    // Ctrl+A → 行首
    if (key.ctrl && input === 'a') {
      const next = moveCursorHome({ value, cursorPos })
      setCursorPos(next.cursorPos)
      return
    }

    // Ctrl+E → 行尾
    if (key.ctrl && input === 'e') {
      const next = moveCursorEnd({ value, cursorPos })
      setCursorPos(next.cursorPos)
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

    // Backspace / Delete：
    // 大多数终端（macOS Terminal、iTerm2）按 Backspace 发送 \x7f，
    // ink 将 \x7f 解析为 key.delete，将 \x08(Ctrl+H) 解析为 key.backspace。
    // 因此两者都需要执行"删除光标前一个字符"的逻辑。
    if (key.backspace || key.delete) {
      setHistoryIndex(-1)
      const next = deleteBeforeCursor({ value, cursorPos })
      setValueAndCursor(next.value, next.cursorPos)
      return
    }

    if (!key.ctrl && !key.meta && input) {
      setHistoryIndex(-1)
      const next = insertAtCursor({ value, cursorPos }, input)
      setValueAndCursor(next.value, next.cursorPos)
    }
  }, { isActive: !isSearching && !disabled && !isLoading })

  return (
    <Box flexDirection="column" gap={1}>
      {isOpen && !disabled && (
        <PromptInputSuggestions
          items={suggestions.items}
          selectedIndex={suggestions.selectedIndex}
          argumentHint={suggestions.argumentHint}
        />
      )}
      {isSearching && !disabled && (
        <Text>{formatHistorySearchStatus(historyQuery, historyMatch, historyFailedMatch)}</Text>
      )}

      {/* 输入行 — 对标 tui-redesign.html */}
      <Box gap={1}>
        <Text color={disabled || isLoading ? 'gray' : 'blue'} bold>
          {'❯'}
        </Text>
        {isLoading ? (
          <Text color="gray" italic>
            Pi is thinking…
          </Text>
        ) : (
          <Box>
            <Text dimColor={disabled}>{value.slice(0, cursorPos)}</Text>
            <Text color={disabled ? 'gray' : 'cyan'}>▊</Text>
            <Text dimColor={disabled}>{value.slice(cursorPos)}</Text>
          </Box>
        )}
      </Box>

      {/* 分隔线 */}
      <Box>
        <Text color="gray" dimColor>{'─'.repeat(80)}</Text>
      </Box>

      {/* 快捷键提示行 — 始终显示 */}
      <Box gap={2} paddingLeft={2}>
        <Text color="gray" dimColor>
          <Text color="gray" bold>Enter</Text> submit
        </Text>
        <Text color="gray" dimColor>
          <Text color="gray" bold>↑↓</Text> history
        </Text>
        <Text color="gray" dimColor>
          <Text color="gray" bold>Ctrl+↑↓</Text> scroll
        </Text>
        <Text color="gray" dimColor>
          <Text color="gray" bold>Esc</Text> cancel
        </Text>
      </Box>
    </Box>
  )
})
