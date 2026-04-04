import React from 'react'
import { Box, Text } from 'ink'

import type { CommandItem } from '../utils/commandSuggestions.js'

const MAX_VISIBLE_ITEMS = 6
const HALF_WINDOW = 3

type Props = {
  items: CommandItem[]
  selectedIndex: number
  argumentHint?: string
}

function getSourceIcon(source: CommandItem['source']): { color: 'gray' | 'magenta' | 'blue'; icon: string } {
  switch (source) {
    case 'skill-user':
      return { color: 'magenta', icon: '◆' }
    case 'skill-project':
      return { color: 'blue', icon: '◆' }
    case 'builtin':
    default:
      return { color: 'gray', icon: '/' }
  }
}

export function PromptInputSuggestions({ items, selectedIndex, argumentHint }: Props) {
  if (items.length === 0) {
    return null
  }

  let start = Math.max(0, selectedIndex - HALF_WINDOW)
  const end = Math.min(items.length, start + MAX_VISIBLE_ITEMS)
  start = Math.max(0, end - MAX_VISIBLE_ITEMS)
  const visibleItems = items.slice(start, end)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      {visibleItems.map((item, index) => {
        const itemIndex = start + index
        const isSelected = itemIndex === selectedIndex
        const { color, icon } = getSourceIcon(item.source)

        return (
          <Box key={item.id}>
            <Text>
              <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
                {isSelected ? '▶ ' : '  '}
              </Text>
              <Text color={color}>{icon}</Text>
              <Text color={isSelected ? 'white' : 'gray'} bold={isSelected} dimColor={!isSelected}>
                {item.label}
              </Text>
              <Text color="gray" dimColor={!isSelected}>
                {'  '}
                {item.description}
              </Text>
              {isSelected && argumentHint ? <Text color="yellow">{`  ${argumentHint}`}</Text> : null}
            </Text>
          </Box>
        )
      })}

      {items.length > MAX_VISIBLE_ITEMS ? (
        <Text color="gray" dimColor>
          {`  … ${items.length} total`}
        </Text>
      ) : null}

      <Text color="gray" dimColor>
        {'  ↑↓ navigate   Tab fill   Enter execute   Esc cancel'}
      </Text>
    </Box>
  )
}

export type { Props as PromptInputSuggestionsProps }
