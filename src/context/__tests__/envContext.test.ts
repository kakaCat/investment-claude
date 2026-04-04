import { describe, expect, it, vi } from 'vitest'

vi.mock('os', () => ({
  platform: vi.fn().mockReturnValue('darwin'),
  release: vi.fn().mockReturnValue('24.0.0'),
  homedir: vi.fn().mockReturnValue('/Users/test'),
}))

import { loadEnvInfo } from '../envContext.js'
import type { SectionContext } from '../../constants/systemPromptSections.js'

const ctx: SectionContext = {
  cwd: '/Users/test/my-project',
  sessionId: 'abc-123',
  workspaceDir: '/Users/test/my-project/.pi/sessions/abc-123/workspace',
  isPlanMode: false,
}

describe('loadEnvInfo', () => {
  it('includes # User Environment Info header', async () => {
    const result = await loadEnvInfo(ctx)
    expect(result).toContain('# User Environment Info')
  })

  it('includes ctx.cwd', async () => {
    const result = await loadEnvInfo(ctx)
    expect(result).toContain('/Users/test/my-project')
  })

  it('includes ctx.sessionId', async () => {
    const result = await loadEnvInfo(ctx)
    expect(result).toContain('abc-123')
  })

  it("includes today's date in YYYY-MM-DD format", async () => {
    const result = await loadEnvInfo(ctx)
    const today = new Date().toISOString().slice(0, 10)
    expect(result).toContain(today)
  })

  it('includes OS platform from mock', async () => {
    const result = await loadEnvInfo(ctx)
    expect(result).toContain('darwin')
  })
})
