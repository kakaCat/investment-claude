import { useCallback, useEffect, useRef, useState } from 'react'
import { useInput } from 'ink'
import { makeHistoryReader } from '../history.js'
import type { HistoryEntry } from '../history.js'

export function useHistorySearch(
  onAcceptHistory: (entry: HistoryEntry) => void,
  currentInput: string,
  onInputChange: (input: string) => void,
  isSearching: boolean,
  setIsSearching: (v: boolean) => void,
): {
  historyQuery: string
  setHistoryQuery: (q: string) => void
  historyMatch: HistoryEntry | undefined
  historyFailedMatch: boolean
  startSearch: () => void
} {
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyFailedMatch, setHistoryFailedMatch] = useState(false)
  const [originalInput, setOriginalInput] = useState('')
  const [historyMatch, setHistoryMatch] = useState<HistoryEntry | undefined>(undefined)

  const historyReaderRef = useRef<AsyncGenerator<HistoryEntry> | undefined>(undefined)
  const seenPrompts = useRef<Set<string>>(new Set())
  const searchAbortControllerRef = useRef<AbortController | null>(null)

  const closeHistoryReader = useCallback((): void => {
    if (historyReaderRef.current) {
      void historyReaderRef.current.return(undefined)
      historyReaderRef.current = undefined
    }
  }, [])

  const reset = useCallback((): void => {
    setIsSearching(false)
    setHistoryQuery('')
    setHistoryFailedMatch(false)
    setOriginalInput('')
    setHistoryMatch(undefined)
    closeHistoryReader()
    seenPrompts.current.clear()
  }, [setIsSearching, closeHistoryReader])

  const searchHistory = useCallback(
    async (resume: boolean, signal?: AbortSignal): Promise<void> => {
      if (!isSearching) return

      if (historyQuery.length === 0) {
        closeHistoryReader()
        seenPrompts.current.clear()
        setHistoryMatch(undefined)
        setHistoryFailedMatch(false)
        onInputChange(originalInput)
        return
      }

      if (!resume) {
        closeHistoryReader()
        historyReaderRef.current = makeHistoryReader()
        seenPrompts.current.clear()
      }

      if (!historyReaderRef.current) return

      while (true) {
        if (signal?.aborted) return

        const item = await historyReaderRef.current.next()
        if (item.done) {
          setHistoryFailedMatch(true)
          return
        }

        const display = item.value.display
        const matchPosition = display.lastIndexOf(historyQuery)
        if (matchPosition !== -1 && !seenPrompts.current.has(display)) {
          seenPrompts.current.add(display)
          setHistoryMatch(item.value)
          setHistoryFailedMatch(false)
          onInputChange(display)
          return
        }
      }
    },
    [isSearching, historyQuery, closeHistoryReader, onInputChange, originalInput],
  )

  const startSearch = useCallback(() => {
    setIsSearching(true)
    setOriginalInput(currentInput)
    historyReaderRef.current = makeHistoryReader()
    seenPrompts.current.clear()
  }, [setIsSearching, currentInput])

  const findNext = useCallback(() => {
    void searchHistory(true)
  }, [searchHistory])

  const accept = useCallback(() => {
    if (historyMatch) {
      onInputChange(historyMatch.display)
      onAcceptHistory(historyMatch)
    } else {
      onInputChange(originalInput)
    }
    reset()
  }, [historyMatch, onInputChange, onAcceptHistory, originalInput, reset])

  const cancel = useCallback(() => {
    onInputChange(originalInput)
    reset()
  }, [onInputChange, originalInput, reset])

  useInput(
    (input, key) => {
      if (!isSearching) return

      if (key.return) {
        accept()
        return
      }

      if (key.escape || (key.ctrl && input === 'g')) {
        cancel()
        return
      }

      if (key.ctrl && input === 'r') {
        findNext()
        return
      }

      if (key.backspace || key.delete) {
        if (historyQuery === '') {
          cancel()
        } else {
          setHistoryQuery((q) => q.slice(0, -1))
        }
        return
      }

      if (!key.ctrl && !key.meta && input) {
        setHistoryQuery((q) => q + input)
      }
    },
    { isActive: isSearching },
  )

  const searchHistoryRef = useRef(searchHistory)
  searchHistoryRef.current = searchHistory

  useEffect(() => {
    searchAbortControllerRef.current?.abort()
    const controller = new AbortController()
    searchAbortControllerRef.current = controller
    void searchHistoryRef.current(false, controller.signal)
    return () => {
      controller.abort()
    }
  }, [historyQuery])

  return {
    historyQuery,
    setHistoryQuery,
    historyMatch,
    historyFailedMatch,
    startSearch,
  }
}
