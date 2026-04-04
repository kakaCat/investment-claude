import { describe, it, expect } from 'vitest'
import {
  isSessionMemoryEmpty,
  truncateSessionMemoryForCompact,
  buildSessionMemoryUpdatePrompt,
  DEFAULT_SESSION_MEMORY_TEMPLATE,
} from '../prompts.js'

describe('isSessionMemoryEmpty', () => {
  it('returns true for blank string', () => {
    expect(isSessionMemoryEmpty('')).toBe(true)
  })

  it('returns true for template-only content', () => {
    expect(isSessionMemoryEmpty(DEFAULT_SESSION_MEMORY_TEMPLATE)).toBe(true)
  })

  it('returns false when content has real data', () => {
    const content = `# Session Title\n_title desc_\nWorking on compact implementation\n\n# Current State\n_state_\nImplementing Task 3`
    expect(isSessionMemoryEmpty(content)).toBe(false)
  })
})

describe('truncateSessionMemoryForCompact', () => {
  it('returns unchanged content when below maxTokens', () => {
    const short = 'hello world'
    expect(truncateSessionMemoryForCompact(short, 1000)).toBe(short)
  })

  it('truncates long content and appends marker', () => {
    const long = 'a'.repeat(50_000)
    const result = truncateSessionMemoryForCompact(long, 100)
    expect(result).toContain('[... session memory truncated')
    expect(result.length).toBeLessThan(long.length)
  })
})

describe('buildSessionMemoryUpdatePrompt', () => {
  it('includes memoryPath and currentMemory', () => {
    const prompt = buildSessionMemoryUpdatePrompt('existing notes', '/tmp/notes.md')
    expect(prompt).toContain('/tmp/notes.md')
    expect(prompt).toContain('existing notes')
  })

  it('instructs to use edit_file tool', () => {
    const prompt = buildSessionMemoryUpdatePrompt('', '/tmp/notes.md')
    expect(prompt).toContain('edit_file')
  })
})
