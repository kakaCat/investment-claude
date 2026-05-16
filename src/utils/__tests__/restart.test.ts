import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { spawn } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'

// Mock process.exit before any other code runs
const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}))

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
  unlinkSync: vi.fn(),
}))

describe('restart utility', () => {
  let mockChild: any
  let originalArgv: string[]
  let originalCwd: string

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    exitSpy.mockClear()

    originalArgv = process.argv
    originalCwd = process.cwd()

    // Mock child process
    mockChild = {
      on: vi.fn((event: string, callback: Function) => {
        // Don't trigger error by default
      }),
      unref: vi.fn(),
    }
    vi.mocked(spawn).mockReturnValue(mockChild as any)
    vi.mocked(existsSync).mockReturnValue(true)
  })

  afterEach(() => {
    process.argv = originalArgv
    process.cwd = () => originalCwd
  })

  it('performRestart spawns new process with tsx', async () => {
    const { performRestart } = await import('../restart.js')

    await performRestart(false)

    // Wait for setImmediate
    await new Promise(resolve => setImmediate(resolve))

    expect(spawn).toHaveBeenCalledWith(
      expect.stringContaining('tsx'),
      expect.arrayContaining([expect.stringContaining('cli.tsx')]),
      expect.objectContaining({
        stdio: 'inherit',
        detached: true,
        env: expect.objectContaining({
          PI_RESTARTED: 'true',
          PI_RESTART_TIMESTAMP: expect.any(String),
        }),
      }),
    )
  })

  it('performRestart preserves context when requested', async () => {
    // Mock existsSync to return false for RESTART_DIR, true for tsx
    vi.mocked(existsSync).mockImplementation((path: any) => {
      if (path.toString().includes('.restart')) {
        return false
      }
      return true
    })

    const { performRestart } = await import('../restart.js')

    await performRestart(true)

    expect(mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.restart'),
      expect.objectContaining({ recursive: true }),
    )

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('context.json'),
      expect.stringContaining('"timestamp"'),
      'utf-8',
    )
  })

  it('performRestart removes context when not preserving', async () => {
    const { performRestart } = await import('../restart.js')

    await performRestart(false)

    expect(unlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('context.json'),
    )
  })

  it('performRestart calls process.exit after spawn', async () => {
    const { performRestart } = await import('../restart.js')

    await performRestart(false)

    // Wait for setImmediate
    await new Promise(resolve => setImmediate(resolve))

    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('performRestart handles spawn errors gracefully', async () => {
    const { performRestart } = await import('../restart.js')

    // Simulate spawn error
    mockChild.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'error') {
        callback(new Error('spawn failed'))
      }
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await performRestart(false)

    // Wait for setImmediate
    await new Promise(resolve => setImmediate(resolve))

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[restart] 新进程启动失败:'),
    )

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[restart] 新进程启动失败，当前进程继续运行'),
    )

    // Should not exit if spawn failed
    expect(exitSpy).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  it('performRestart uses entry file from process.argv if available', async () => {
    process.argv = ['node', '/path/to/custom.tsx', '--some-flag']

    const { performRestart } = await import('../restart.js')

    await performRestart(false)

    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['/path/to/custom.tsx']),
      expect.any(Object),
    )
  })

  it('context includes timestamp, cwd, reason, and env', async () => {
    const { performRestart } = await import('../restart.js')

    await performRestart(true)

    const writeCall = vi.mocked(writeFileSync).mock.calls.find(call =>
      call[0].toString().includes('context.json'),
    )

    expect(writeCall).toBeDefined()
    const contextJson = writeCall![1] as string
    const context = JSON.parse(contextJson)

    expect(context).toMatchObject({
      timestamp: expect.any(String),
      cwd: expect.any(String),
      reason: 'user_requested_restart',
      env: expect.any(Object),
    })
  })
})
