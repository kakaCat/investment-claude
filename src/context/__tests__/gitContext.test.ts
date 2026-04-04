import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

import { execSync } from 'child_process'
import { loadGitStatus } from '../gitContext.js'

const execSyncMock = vi.mocked(execSync)

/** Set up execSync to respond to git commands like a real repo. */
function mockGitRepo(overrides: Partial<Record<string, string>> = {}) {
  const defaults: Record<string, string> = {
    'git rev-parse --show-toplevel': '/project',
    'git rev-parse --abbrev-ref HEAD': 'main',
    'git rev-parse --abbrev-ref origin/HEAD': 'origin/main',
    'git config user.name': 'Test User',
    'git log --oneline -5': 'abc1234 feat: add feature\ndef5678 fix: fix bug',
    'git status --short': '',
  }
  const map = { ...defaults, ...overrides }
  execSyncMock.mockImplementation((cmd: string) => {
    for (const [key, val] of Object.entries(map)) {
      if (cmd.includes(key)) return val
    }
    return ''
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadGitStatus', () => {
  it('returns null when not in a git repo', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('fatal: not a git repository')
    })
    const result = await loadGitStatus('/not-a-repo')
    expect(result).toBeNull()
  })

  it('includes # Git Status header for a valid repo', async () => {
    mockGitRepo()
    const result = await loadGitStatus('/project')
    expect(result).toContain('# Git Status')
  })

  it('includes the current branch name', async () => {
    mockGitRepo()
    const result = await loadGitStatus('/project')
    expect(result).toContain('Current branch: main')
  })

  it('does not include Changed files section when git status is empty', async () => {
    mockGitRepo({ 'git status --short': '' })
    const result = await loadGitStatus('/project')
    expect(result).not.toContain('Changed files:')
  })

  it('includes Changed files section when status has content', async () => {
    mockGitRepo({ 'git status --short': 'M src/foo.ts\n?? src/bar.ts' })
    const result = await loadGitStatus('/project')
    expect(result).toContain('Changed files:')
    expect(result).toContain('M src/foo.ts')
  })

  it('truncates output exceeding 2000 characters and appends (truncated)', async () => {
    const longLog = 'a'.repeat(2100)
    mockGitRepo({ 'git log --oneline -5': longLog })
    const result = await loadGitStatus('/project')
    expect(result!.length).toBeLessThanOrEqual(2030)
    expect(result).toContain('...(truncated)')
  })
})
