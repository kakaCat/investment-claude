import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/Users/test'),
  platform: vi.fn().mockReturnValue('darwin'),
  release: vi.fn().mockReturnValue('24.0.0'),
}))

import { existsSync, readFileSync } from 'fs'
import { loadMemory } from '../memoryContext.js'

const existsSyncMock = vi.mocked(existsSync)
const readFileSyncMock = vi.mocked(readFileSync)

const CWD = '/Users/test/project'
// cwd.replace(/\//g, '-') = '-Users-test-project'
const MEMORY_PATH = '/Users/test/.claude/projects/-Users-test-project/memory/MEMORY.md'

beforeEach(() => {
  vi.clearAllMocks()
  existsSyncMock.mockReturnValue(false)
})

describe('loadMemory', () => {
  it('returns null when memory file does not exist', async () => {
    const result = await loadMemory(CWD)
    expect(result).toBeNull()
  })

  it('returns # Memory section with file content when file exists', async () => {
    existsSyncMock.mockImplementation((p) => p === MEMORY_PATH)
    readFileSyncMock.mockReturnValue('- [Note](note.md) — some memory entry')
    const result = await loadMemory(CWD)
    expect(result).toContain('# Memory')
    expect(result).toContain('some memory entry')
  })

  it('returns null when memory file exists but is empty', async () => {
    existsSyncMock.mockImplementation((p) => p === MEMORY_PATH)
    readFileSyncMock.mockReturnValue('   ')
    const result = await loadMemory(CWD)
    expect(result).toBeNull()
  })
})
