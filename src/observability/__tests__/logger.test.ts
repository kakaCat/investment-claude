import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { initLogger, appendEvent, getLogFilePath, getHtmlFilePath, resetLogger } from '../logger.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'obs-test-'))
  resetLogger()
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
  resetLogger()
})

describe('initLogger', () => {
  it('sets log and html file paths', () => {
    initLogger('sess-1', tmpDir)
    expect(getLogFilePath()).toBe(join(tmpDir, '.pi', 'logs', 'session-ob-sess-1.jsonl'))
    expect(getHtmlFilePath()).toBe(join(tmpDir, '.pi', 'logs', 'session-ob-sess-1.html'))
  })
})

describe('appendEvent', () => {
  it('writes a valid JSON line to the log file', async () => {
    initLogger('sess-2', tmpDir)
    await appendEvent({ event: 'test', value: 42 })
    const content = await readFile(getLogFilePath()!, 'utf-8')
    const parsed = JSON.parse(content.trim())
    expect(parsed.event).toBe('test')
    expect(parsed.value).toBe(42)
  })

  it('appends multiple events as separate lines', async () => {
    initLogger('sess-3', tmpDir)
    await appendEvent({ event: 'a' })
    await appendEvent({ event: 'b' })
    const content = await readFile(getLogFilePath()!, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).event).toBe('a')
    expect(JSON.parse(lines[1]).event).toBe('b')
  })

  it('is a no-op when logger is not initialized', async () => {
    // Should not throw
    await expect(appendEvent({ event: 'x' })).resolves.not.toThrow()
  })
})
