import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { generateReport } from '../htmlReport.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'obs-html-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

function makeFixtureJsonl(): string {
  const events = [
    { event: 'session_start', session_id: 'test-123', cwd: '/proj', system_prompt: 'You are Pi.', ts: 1000 },
    { event: 'user_prompt', prompt: 'Write a sort function', ts: 1001 },
    { event: 'tool_call', tool: 'Read', input: '{"file_path":"src/utils.ts"}', ts: 1005 },
    { event: 'tool_result', tool: 'Read', result: 'export function...', duration_ms: 45, ts: 1050 },
    { event: 'tool_call', tool: 'Write', input: '{"file_path":"src/utils.ts"}', ts: 1060 },
    { event: 'tool_result', tool: 'Write', result: 'ok', duration_ms: 12, ts: 1072 },
    {
      event: 'session_end',
      stop_reason: 'done',
      messages: [
        { type: 'user', content: [{ type: 'text', text: 'Write a sort function' }] },
        { type: 'assistant', content: [{ type: 'text', text: 'Done! I added quickSort to src/utils.ts.' }] },
      ],
      ts: 1100,
    },
  ]
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n'
}

describe('generateReport', () => {
  it('creates an HTML file at the specified path', async () => {
    const jsonlPath = join(tmpDir, 'session-test-123.jsonl')
    const htmlPath = join(tmpDir, 'session-test-123.html')
    await writeFile(jsonlPath, makeFixtureJsonl(), 'utf-8')

    await generateReport(jsonlPath, htmlPath)

    const html = await readFile(htmlPath, 'utf-8')
    expect(html.length).toBeGreaterThan(1000)
  })

  it('includes session ID in the output', async () => {
    const jsonlPath = join(tmpDir, 'session.jsonl')
    const htmlPath = join(tmpDir, 'session.html')
    await writeFile(jsonlPath, makeFixtureJsonl(), 'utf-8')
    await generateReport(jsonlPath, htmlPath)
    const html = await readFile(htmlPath, 'utf-8')
    expect(html).toContain('test-123')
  })

  it('includes user prompt text in the output', async () => {
    const jsonlPath = join(tmpDir, 'session.jsonl')
    const htmlPath = join(tmpDir, 'session.html')
    await writeFile(jsonlPath, makeFixtureJsonl(), 'utf-8')
    await generateReport(jsonlPath, htmlPath)
    const html = await readFile(htmlPath, 'utf-8')
    expect(html).toContain('Write a sort function')
  })

  it('includes tool names in the output', async () => {
    const jsonlPath = join(tmpDir, 'session.jsonl')
    const htmlPath = join(tmpDir, 'session.html')
    await writeFile(jsonlPath, makeFixtureJsonl(), 'utf-8')
    await generateReport(jsonlPath, htmlPath)
    const html = await readFile(htmlPath, 'utf-8')
    expect(html).toContain('Read')
    expect(html).toContain('Write')
  })

  it('does not throw when JSONL path does not exist', async () => {
    const htmlPath = join(tmpDir, 'out.html')
    await expect(generateReport('/no/such/file.jsonl', htmlPath)).resolves.not.toThrow()
  })
})
