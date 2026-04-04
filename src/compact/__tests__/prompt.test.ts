import { describe, it, expect } from 'vitest'
import { formatCompactSummary, getCompactPrompt, getCompactUserSummaryMessage } from '../prompt.js'

describe('formatCompactSummary', () => {
  it('strips <analysis> block', () => {
    const raw = '<analysis>drafting notes</analysis>\n<summary>real content</summary>'
    const result = formatCompactSummary(raw)
    expect(result).not.toContain('<analysis>')
    expect(result).not.toContain('drafting notes')
  })

  it('replaces <summary> tags with "Summary:" header', () => {
    const raw = '<summary>my summary text</summary>'
    const result = formatCompactSummary(raw)
    expect(result).toContain('Summary:')
    expect(result).toContain('my summary text')
    expect(result).not.toContain('<summary>')
  })

  it('returns trimmed plain text when no XML tags', () => {
    const raw = '  plain text  '
    expect(formatCompactSummary(raw)).toBe('plain text')
  })
})

describe('getCompactPrompt', () => {
  it('includes NO_TOOLS_PREAMBLE', () => {
    expect(getCompactPrompt()).toContain('CRITICAL: Respond with TEXT ONLY')
  })

  it('appends custom instructions when provided', () => {
    const prompt = getCompactPrompt('Focus on TypeScript changes')
    expect(prompt).toContain('Focus on TypeScript changes')
  })
})

describe('getCompactUserSummaryMessage', () => {
  it('wraps summary in context message', () => {
    const result = getCompactUserSummaryMessage('my summary')
    expect(result).toContain('continued from a previous conversation')
    expect(result).toContain('my summary')
  })

  it('adds continuation instruction when suppressFollowUpQuestions=true', () => {
    const result = getCompactUserSummaryMessage('summary', true)
    expect(result).toContain('without asking the user any further questions')
  })
})
