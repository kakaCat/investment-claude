import { describe, it, expect } from 'vitest'
import { scoreMemoryForQuery, formatMemoryManifest } from '../memoryScan.js'
import type { MemoryFileMeta } from '../Memory.js'

const base: MemoryFileMeta = {
  filePath: '/memory/test.md',
  name: 'test memory',
  description: 'a test memory entry',
  type: 'user',
  mtimeMs: Date.now(),
}

describe('scoreMemoryForQuery', () => {
  it('returns 0 when no terms match', () => {
    expect(scoreMemoryForQuery(base, ['xyz123'], 3)).toBe(0)
  })

  it('name exact match scores highest', () => {
    const score = scoreMemoryForQuery({ ...base, name: 'auth' }, ['auth'], 3)
    expect(score).toBeGreaterThan(10)
  })

  it('name contains scores less than exact match', () => {
    const exact = scoreMemoryForQuery({ ...base, name: 'auth' }, ['auth'], 3)
    const contains = scoreMemoryForQuery({ ...base, name: 'authentication flow' }, ['auth'], 3)
    expect(exact).toBeGreaterThan(contains)
  })

  it('searchHint word boundary match scores 4+weight', () => {
    const score = scoreMemoryForQuery(
      { ...base, searchHint: 'auth login token' },
      ['auth'],
      3,
    )
    // weight(3) + hint word boundary(4) = 7
    expect(score).toBe(7)
  })

  it('description match scores lower than hint match', () => {
    const hint = scoreMemoryForQuery({ ...base, searchHint: 'auth' }, ['auth'], 1)
    const desc = scoreMemoryForQuery({ ...base, description: 'auth related' }, ['auth'], 1)
    expect(hint).toBeGreaterThan(desc)
  })

  it('defaultWeight is added as base score', () => {
    const low = scoreMemoryForQuery({ ...base, name: 'auth' }, ['auth'], 1)
    const high = scoreMemoryForQuery({ ...base, name: 'auth' }, ['auth'], 5)
    expect(high - low).toBe(4) // weight difference
  })
})

describe('formatMemoryManifest', () => {
  it('returns a formatted list of memory entries', () => {
    const metas: MemoryFileMeta[] = [
      { ...base, name: 'Alpha Entry', description: 'first entry', type: 'user' },
      { ...base, name: 'Beta Entry', description: 'second entry', type: 'feedback' },
    ]
    const out = formatMemoryManifest(metas)
    expect(out).toContain('Alpha Entry')
    expect(out).toContain('Beta Entry')
    expect(out).toContain('[user]')
    expect(out).toContain('[feedback]')
  })

  it('returns empty message when no memories', () => {
    const out = formatMemoryManifest([])
    expect(out).toContain('No memories')
  })
})
