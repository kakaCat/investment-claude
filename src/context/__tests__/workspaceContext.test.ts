import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
}))

import { mkdirSync } from 'fs'
import { loadWorkspaceSection } from '../workspaceContext.js'
import type { SectionContext } from '../../constants/systemPromptSections.js'

const mkdirSyncMock = vi.mocked(mkdirSync)

const ctx: SectionContext = {
  cwd: '/Users/test/my-project',
  sessionId: 'abc-123',
  workspaceDir: '/Users/test/my-project/.pi/sessions/abc-123/workspace',
  isPlanMode: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadWorkspaceSection', () => {
  it('calls mkdirSync with workspaceDir and { recursive: true }', async () => {
    await loadWorkspaceSection(ctx)
    expect(mkdirSyncMock).toHaveBeenCalledWith(ctx.workspaceDir, { recursive: true })
  })

  it('returns string containing # Workspace header', async () => {
    const result = await loadWorkspaceSection(ctx)
    expect(result).toContain('# Workspace')
  })

  it('returns string containing workspaceDir path', async () => {
    const result = await loadWorkspaceSection(ctx)
    expect(result).toContain(ctx.workspaceDir)
  })

  it('does not throw when mkdirSync throws, still returns workspace string', async () => {
    mkdirSyncMock.mockImplementation(() => {
      throw new Error('EEXIST: file already exists')
    })
    await expect(loadWorkspaceSection(ctx)).resolves.toContain('# Workspace')
  })
})
