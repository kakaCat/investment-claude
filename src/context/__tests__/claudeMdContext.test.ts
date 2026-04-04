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
import { loadClaudeMd } from '../claudeMdContext.js'

const existsSyncMock = vi.mocked(existsSync)
const readFileSyncMock = vi.mocked(readFileSync)

// cwd one level below home — traversal checks only /Users/test/project/CLAUDE.md
const CWD = '/Users/test/project'
const CWD_CLAUDE_MD = '/Users/test/project/CLAUDE.md'
const GLOBAL_CLAUDE_MD = '/Users/test/.claude/CLAUDE.md'

beforeEach(() => {
  vi.clearAllMocks()
  existsSyncMock.mockReturnValue(false)
})

describe('loadClaudeMd', () => {
  it('returns null when no CLAUDE.md files exist', async () => {
    const result = await loadClaudeMd(CWD)
    expect(result).toBeNull()
  })

  it('returns project CLAUDE.md content when only cwd file exists', async () => {
    existsSyncMock.mockImplementation((p) => p === CWD_CLAUDE_MD)
    readFileSyncMock.mockReturnValue('project config content')
    const result = await loadClaudeMd(CWD)
    expect(result).toContain(CWD_CLAUDE_MD)
    expect(result).toContain('project config content')
  })

  it('returns global CLAUDE.md content when only global file exists', async () => {
    existsSyncMock.mockImplementation((p) => p === GLOBAL_CLAUDE_MD)
    readFileSyncMock.mockReturnValue('global config content')
    const result = await loadClaudeMd(CWD)
    expect(result).toContain('~/.claude/CLAUDE.md')
    expect(result).toContain('global config content')
  })

  it('includes both files with project section before global when both exist', async () => {
    existsSyncMock.mockImplementation(
      (p) => p === CWD_CLAUDE_MD || p === GLOBAL_CLAUDE_MD,
    )
    readFileSyncMock.mockImplementation((p: unknown) => {
      if (p === CWD_CLAUDE_MD) return 'project content'
      if (p === GLOBAL_CLAUDE_MD) return 'global content'
      return ''
    })
    const result = await loadClaudeMd(CWD)
    const projectIdx = result!.indexOf('project content')
    const globalIdx = result!.indexOf('global content')
    expect(projectIdx).toBeGreaterThanOrEqual(0)
    expect(globalIdx).toBeGreaterThanOrEqual(0)
    expect(projectIdx).toBeLessThan(globalIdx)
  })
})
