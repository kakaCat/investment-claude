import { describe, it, expect, vi } from 'vitest'

const scanFiles = vi.fn().mockResolvedValue([
  {
    filePath: '/memory/feedback_testing.md',
    name: 'feedback_testing',
    description: 'Do not mock the database',
    type: 'feedback',
    searchHint: 'database mock test',
    mtimeMs: Date.now(),
  },
  {
    filePath: '/memory/user_role.md',
    name: 'user_role',
    description: 'User is a data scientist',
    type: 'user',
    searchHint: 'data science ML',
    mtimeMs: Date.now(),
  },
])

const readFile = vi
  .fn()
  .mockResolvedValue(
    '---\nname: feedback_testing\ndescription: test\ntype: feedback\n---\n\nDo not mock the database.',
  )

vi.mock('../../../memdir/backends/LocalFSBackend.js', () => ({
  LocalFSBackend: class MockLocalFSBackend {
    name = 'localfs'

    constructor(_cwd: string) {}

    scanFiles = scanFiles
    readFile = readFile
  },
}))

import { MemorySearchTool } from '../MemorySearchTool.js'

const ctx = {
  cwd: '/test/project',
  tools: [],
  abortController: new AbortController(),
}

describe('MemorySearchTool', () => {
  it('has correct name', () => {
    expect(MemorySearchTool.name).toBe('memory_search')
  })

  it('search: returns matching memories', async () => {
    const result = await MemorySearchTool.call({ query: 'search:database' }, ctx as never)
    expect(result).toContain('feedback_testing')
    expect(result).toContain('database')
  })

  it('type:feedback lists feedback memories', async () => {
    const result = await MemorySearchTool.call({ query: 'type:feedback' }, ctx as never)
    expect(result).toContain('feedback_testing')
    expect(result).not.toContain('user_role')
  })

  it('type:user lists user memories', async () => {
    const result = await MemorySearchTool.call({ query: 'type:user' }, ctx as never)
    expect(result).toContain('user_role')
    expect(result).not.toContain('feedback_testing')
  })

  it('select:<filename> reads full file content', async () => {
    const result = await MemorySearchTool.call(
      { query: 'select:feedback_testing.md' },
      ctx as never,
    )
    expect(result).toContain('Do not mock the database')
  })

  it('types query returns type tree', async () => {
    const result = await MemorySearchTool.call({ query: 'types' }, ctx as never)
    expect(result).toContain('user')
    expect(result).toContain('feedback')
    expect(result).toContain('project')
    expect(result).toContain('reference')
  })

  it('returns no match message when no results', async () => {
    const result = await MemorySearchTool.call({ query: 'search:xyzzy99999' }, ctx as never)
    expect(result).toContain('No memories')
  })
})
