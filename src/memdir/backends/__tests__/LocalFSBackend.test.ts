import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
}))

vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/Users/test'),
}))

import { readdir } from 'fs/promises'
import { LocalFSBackend } from '../LocalFSBackend.js'

const readdirMock = vi.mocked(readdir)

function getMemoryDir(backend: LocalFSBackend): string {
  return backend.memoryDir
}

describe('LocalFSBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readdirMock.mockResolvedValue([])
  })

  it('encodes cwd into the Claude memory directory path', () => {
    const backend = new LocalFSBackend('/Users/test/project')

    expect(getMemoryDir(backend)).toBe(
      '/Users/test/.claude/projects/-Users-test-project/memory',
    )
  })

  it('returns an empty list when the memory directory does not exist', async () => {
    const backend = new LocalFSBackend('/Users/test/project')
    readdirMock.mockRejectedValueOnce(new Error('ENOENT'))

    await expect(backend.scanFiles(new AbortController().signal)).resolves.toEqual([])
    expect(readdirMock).toHaveBeenCalledWith(
      '/Users/test/.claude/projects/-Users-test-project/memory',
    )
  })
})
