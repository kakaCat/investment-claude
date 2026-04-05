import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  symlink: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/cleanupRegistry.js', () => ({
  registerCleanup: vi.fn(),
}))

vi.mock('../../tasks/sessionId.js', () => ({
  getSessionId: vi.fn().mockReturnValue('test-session-123'),
}))

describe('debug logger', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('logForDebugging writes formatted line to debug file', async () => {
    const { logForDebugging } = await import('../debug.js')
    const { appendFile } = await import('fs/promises')

    logForDebugging('hello world')

    await new Promise(r => setTimeout(r, 10))

    expect(appendFile).toHaveBeenCalledWith(
      expect.stringContaining('test-session-123.txt'),
      expect.stringMatching(/\d{4}-\d{2}-\d{2}T.*\[DEBUG\] hello world\n/),
      'utf-8',
    )
  })

  it('getDebugLogPath returns path with sessionId', async () => {
    const { getDebugLogPath } = await import('../debug.js')
    expect(getDebugLogPath()).toContain('test-session-123.txt')
    expect(getDebugLogPath()).toContain('.pi/debug')
  })

  it('logForDebugging respects level in output', async () => {
    const { logForDebugging } = await import('../debug.js')
    const { appendFile } = await import('fs/promises')
    vi.mocked(appendFile).mockClear()

    logForDebugging('warn message', { level: 'warn' })
    await new Promise(r => setTimeout(r, 10))

    expect(appendFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('[WARN]'),
      'utf-8',
    )
  })
})
