import { describe, it, expect } from 'vitest'
import { FileWriteTool } from '../FileWriteTool.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { readFile, rm } from 'fs/promises'
import type { ToolUseContext } from '../../../Tool.js'

describe('FileWriteTool parameter validation', () => {
  const testDir = join(tmpdir(), 'pi-test-write-validation')

  const createMockContext = (): ToolUseContext => ({
    cwd: testDir,
    abortSignal: new AbortController().signal,
    tools: [],
    getAppState: () => ({ todos: [] } as any),
    setAppState: () => {},
  })

  it('should reject empty input object', async () => {
    const result = await FileWriteTool.call({} as any, createMockContext())

    expect(result.data.success).toBe(false)
    expect(result.data.error).toContain('path')
  })

  it('should reject missing path', async () => {
    const result = await FileWriteTool.call({ content: 'test' } as any, createMockContext())

    expect(result.data.success).toBe(false)
    expect(result.data.error).toContain('path')
  })

  it('should reject missing content', async () => {
    const result = await FileWriteTool.call({ path: 'test.txt' } as any, createMockContext())

    expect(result.data.success).toBe(false)
    expect(result.data.error).toContain('content')
  })

  it('should reject invalid path type', async () => {
    const result = await FileWriteTool.call(
      { path: 123, content: 'test' } as any,
      createMockContext(),
    )

    expect(result.data.success).toBe(false)
    expect(result.data.error).toContain('path')
  })

  it('should accept valid input', async () => {
    const testFile = join(testDir, 'valid-test.txt')

    const result = await FileWriteTool.call(
      { path: testFile, content: 'hello world' },
      createMockContext(),
    )

    expect(result.data.success).toBe(true)
    expect(result.data.size).toBe(11)

    // Verify file was written
    const content = await readFile(testFile, 'utf-8')
    expect(content).toBe('hello world')

    // Cleanup
    await rm(testFile, { force: true })
  })
})
