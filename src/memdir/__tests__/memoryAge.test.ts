import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getMemoryAge, buildMemoryAgeWarning } from '../memoryAge.js'
import type { MemoryTypeHandler } from '../Memory.js'

const mockHandler: MemoryTypeHandler = {
  name: 'project',
  description: '',
  defaultWeight: 5,
  ageWarningDays: 7,
  formatForInjection: (m) => m.content,
}

describe('getMemoryAge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'))
  })

  afterEach(() => vi.useRealTimers())

  it('returns "今天" for same-day mtime', () => {
    const mtime = new Date('2026-04-29T01:00:00Z').getTime()
    expect(getMemoryAge(mtime)).toBe('今天')
  })

  it('returns "昨天" for yesterday mtime', () => {
    const mtime = new Date('2026-04-28T10:00:00Z').getTime()
    expect(getMemoryAge(mtime)).toBe('昨天')
  })

  it('returns "N 天前" for older mtime', () => {
    const mtime = new Date('2026-04-23T10:00:00Z').getTime()
    expect(getMemoryAge(mtime)).toBe('6 天前')
  })
})

describe('buildMemoryAgeWarning', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'))
  })

  afterEach(() => vi.useRealTimers())

  it('returns null when within ageWarningDays', () => {
    const mtime = new Date('2026-04-25T10:00:00Z').getTime()
    expect(buildMemoryAgeWarning(mtime, mockHandler)).toBeNull()
  })

  it('returns warning string when older than ageWarningDays', () => {
    const mtime = new Date('2026-04-19T10:00:00Z').getTime()
    const warning = buildMemoryAgeWarning(mtime, mockHandler)
    expect(warning).not.toBeNull()
    expect(warning).toContain('10 天前')
    expect(warning).toContain('过时')
  })
})
