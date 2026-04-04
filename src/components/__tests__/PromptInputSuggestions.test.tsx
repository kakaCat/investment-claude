import React from 'react'
import { describe, expect, it } from 'vitest'

import { PromptInputSuggestions } from '../PromptInputSuggestions.js'
import type { CommandItem } from '../../utils/commandSuggestions.js'

function flattenText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') {
    return ''
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(child => flattenText(child)).join('')
  }

  if (React.isValidElement(node)) {
    return flattenText(node.props.children)
  }

  return ''
}

function collectTextLines(node: React.ReactNode): string[] {
  if (!React.isValidElement(node)) {
    return []
  }

  const children = React.Children.toArray(node.props.children)
  return children.map(child => flattenText(child))
}

function createItems(count: number): CommandItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `skill-user:item-${index}`,
    command: `/item-${index}`,
    label: `item-${index}`,
    description: `Description ${index}`,
    source: 'skill-user' as const,
  }))
}

describe('PromptInputSuggestions', () => {
  it('shows a six-item window centered around the selection when possible', () => {
    const element = PromptInputSuggestions({
      items: createItems(10),
      selectedIndex: 5,
    })

    const lines = collectTextLines(element)

    expect(lines).toEqual([
      '  ◆item-2  Description 2',
      '  ◆item-3  Description 3',
      '  ◆item-4  Description 4',
      '▶ ◆item-5  Description 5',
      '  ◆item-6  Description 6',
      '  ◆item-7  Description 7',
      '  … 10 total',
      '  ↑↓ navigate   Tab fill   Enter execute   Esc cancel',
    ])
  })

  it('renders the selected argument hint after the description', () => {
    const element = PromptInputSuggestions({
      items: [
        {
          id: 'builtin:compact-partial',
          command: '/compact partial',
          label: 'compact partial',
          description: 'Select pivot for partial compact',
          source: 'builtin',
        },
      ],
      selectedIndex: 0,
      argumentHint: '<pivot>',
    })

    const lines = collectTextLines(element)

    expect(lines).toEqual([
      '▶ /compact partial  Select pivot for partial compact  <pivot>',
      '  ↑↓ navigate   Tab fill   Enter execute   Esc cancel',
    ])
  })

  it('returns null when there are no items', () => {
    expect(
      PromptInputSuggestions({
        items: [],
        selectedIndex: -1,
      }),
    ).toBeNull()
  })
})
