import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('fs', () => ({
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

vi.mock('../../tasks/sessionId.js', () => ({
  getSessionId: vi.fn().mockReturnValue('test-session-456'),
}))

describe('diagLogs', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.PI_DIAGNOSTICS_FILE
  })

  it('logForDiagnosticsNoPII writes JSONL to default path', async () => {
    const { logForDiagnosticsNoPII } = await import('../diagLogs.js')
    const fs = await import('fs')

    logForDiagnosticsNoPII('info', 'cli_entry')

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('test-session-456.jsonl'),
      expect.stringMatching(/"event":"cli_entry"/),
    )
  })

  it('uses PI_DIAGNOSTICS_FILE env var when set', async () => {
    process.env.PI_DIAGNOSTICS_FILE = '/tmp/test-diag.jsonl'
    const { logForDiagnosticsNoPII } = await import('../diagLogs.js')
    const fs = await import('fs')

    logForDiagnosticsNoPII('info', 'test_event')

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      '/tmp/test-diag.jsonl',
      expect.any(String),
    )
  })

  it('withDiagnosticsTiming logs started and completed events', async () => {
    const { withDiagnosticsTiming } = await import('../diagLogs.js')
    const fs = await import('fs')
    vi.mocked(fs.appendFileSync).mockClear()

    const result = await withDiagnosticsTiming('test_op', async () => 42)

    expect(result).toBe(42)
    const calls = vi.mocked(fs.appendFileSync).mock.calls.map(c => c[1] as string)
    expect(calls.some(c => c.includes('test_op_started'))).toBe(true)
    expect(calls.some(c => c.includes('test_op_completed'))).toBe(true)
    expect(calls.some(c => c.includes('duration_ms'))).toBe(true)
  })

  it('withDiagnosticsTiming logs failed on error', async () => {
    const { withDiagnosticsTiming } = await import('../diagLogs.js')
    const fs = await import('fs')
    vi.mocked(fs.appendFileSync).mockClear()

    await expect(
      withDiagnosticsTiming('fail_op', async () => {
        throw new Error('oops')
      }),
    ).rejects.toThrow('oops')

    const calls = vi.mocked(fs.appendFileSync).mock.calls.map(c => c[1] as string)
    expect(calls.some(c => c.includes('fail_op_failed'))).toBe(true)
  })
})
