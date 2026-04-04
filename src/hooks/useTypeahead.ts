import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Key } from 'ink'

import type { Skill } from '../skills/index.js'
import {
  applySelection,
  buildCommandList,
  generateSuggestions,
  type CommandItem,
} from '../utils/commandSuggestions.js'
import { readUsage, recordUsage, type SkillUsageRecord } from '../utils/skillUsage.js'

export type SuggestionsState = {
  items: CommandItem[]
  selectedIndex: number
  argumentHint?: string
}

export type UseTypeaheadOptions = {
  value: string
  onInputChange: (v: string) => void
  onSubmit: (v: string) => void
  skills: Skill[]
}

export type UseTypeaheadResult = {
  suggestions: SuggestionsState
  isOpen: boolean
  handleKeyDown: (input: string, key: Key) => boolean
}

type HandleTypeaheadKeyEventOptions = {
  key: Key
  value: string
  suggestions: SuggestionsState
  onInputChange: (v: string) => void
  onSubmit: (v: string) => void
  recordUsage: (name: string) => void
  dismissedForRef: { current: string | null }
  setSuggestions: Dispatch<SetStateAction<SuggestionsState>>
}

export const EMPTY_SUGGESTIONS: SuggestionsState = {
  items: [],
  selectedIndex: -1,
}

function createEmptySuggestionsState(): SuggestionsState {
  return { ...EMPTY_SUGGESTIONS }
}

function withSelectedIndex(state: SuggestionsState, selectedIndex: number): SuggestionsState {
  return {
    ...state,
    selectedIndex,
    argumentHint: state.items[selectedIndex]?.argumentHint,
  }
}

export function getSuggestionsState(
  value: string,
  skills: Skill[],
  usageMap: SkillUsageRecord,
): SuggestionsState {
  if (!value.startsWith('/')) {
    return createEmptySuggestionsState()
  }

  const allCommands = buildCommandList(skills)
  const items = generateSuggestions(value, allCommands, usageMap)

  return {
    items,
    selectedIndex: items.length > 0 ? 0 : -1,
    argumentHint: items[0]?.argumentHint,
  }
}

export function handleTypeaheadKeyEvent({
  key,
  value,
  suggestions,
  onInputChange,
  onSubmit,
  recordUsage: recordUsageForItem,
  dismissedForRef,
  setSuggestions,
}: HandleTypeaheadKeyEventOptions): boolean {
  if (suggestions.items.length === 0) {
    return false
  }

  if (key.upArrow) {
    setSuggestions(prev => withSelectedIndex(prev, Math.max(0, prev.selectedIndex - 1)))
    return true
  }

  if (key.downArrow) {
    setSuggestions(prev =>
      withSelectedIndex(prev, Math.min(prev.items.length - 1, prev.selectedIndex + 1)),
    )
    return true
  }

  const selectedItem = suggestions.items[suggestions.selectedIndex]

  if (key.tab && selectedItem) {
    // 设置 dismissedForRef 防止 useEffect 在 value 更新后重新弹出下拉列表
    const filledValue = selectedItem.argumentHint
      ? `${selectedItem.command} `
      : selectedItem.command
    dismissedForRef.current = filledValue
    applySelection(selectedItem, false, onInputChange, onSubmit, recordUsageForItem)
    setSuggestions(createEmptySuggestionsState())
    return true
  }

  if (key.return && selectedItem) {
    applySelection(selectedItem, true, onInputChange, onSubmit, recordUsageForItem)
    setSuggestions(createEmptySuggestionsState())
    return true
  }

  if (key.escape) {
    setSuggestions(createEmptySuggestionsState())
    dismissedForRef.current = value
    return true
  }

  dismissedForRef.current = null
  return false
}

export function useTypeahead({
  value,
  onInputChange,
  onSubmit,
  skills,
}: UseTypeaheadOptions): UseTypeaheadResult {
  const [suggestions, setSuggestions] = useState<SuggestionsState>(createEmptySuggestionsState())
  const [usageMap, setUsageMap] = useState<SkillUsageRecord>({})
  const dismissedForRef = useRef<string | null>(null)

  useEffect(() => {
    readUsage().then(setUsageMap).catch(() => {})
  }, [])

  useEffect(() => {
    if (!value.startsWith('/')) {
      setSuggestions(createEmptySuggestionsState())
      return
    }

    if (dismissedForRef.current === value) {
      return
    }

    setSuggestions(getSuggestionsState(value, skills, usageMap))
  }, [value, skills, usageMap])

  useEffect(() => {
    const item = suggestions.items[suggestions.selectedIndex]

    setSuggestions(prev => {
      const nextArgumentHint = item?.argumentHint

      if (prev.argumentHint === nextArgumentHint) {
        return prev
      }

      return {
        ...prev,
        argumentHint: nextArgumentHint,
      }
    })
  }, [suggestions.items, suggestions.selectedIndex])

  const handleKeyDown = (_input: string, key: Key): boolean =>
    handleTypeaheadKeyEvent({
      key,
      value,
      suggestions,
      onInputChange,
      onSubmit,
      recordUsage: (name: string) => {
        void recordUsage(name).then(() => readUsage().then(setUsageMap).catch(() => {})).catch(() => {})
      },
      dismissedForRef,
      setSuggestions,
    })

  return {
    suggestions,
    isOpen: suggestions.items.length > 0,
    handleKeyDown,
  }
}
