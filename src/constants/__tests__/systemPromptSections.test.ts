import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSectionCache,
  registerSection,
  registerVolatileSection,
  resolveSystemPrompt,
  _resetRegistry,
  type SectionContext,
} from '../systemPromptSections.js'

const ctx: SectionContext = {
  cwd: '/test/project',
  sessionId: 'test-session-id',
  workspaceDir: '/test/project/.pi/sessions/test-session-id/workspace',
  isPlanMode: false,
}

beforeEach(() => {
  _resetRegistry()
})

describe('registerSection + resolveSystemPrompt', () => {
  it('includes section content in result', async () => {
    registerSection('foo', async () => 'hello world')
    const result = await resolveSystemPrompt(ctx)
    expect(result).toContain('hello world')
  })

  it('filters out null sections', async () => {
    registerSection('visible', async () => 'visible text')
    registerSection('empty', async () => null)
    const result = await resolveSystemPrompt(ctx)
    expect(result).toContain('visible text')
    expect(result).not.toContain('null')
  })

  it('joins multiple sections with --- separator in registration order', async () => {
    registerSection('a', async () => 'section A')
    registerSection('b', async () => 'section B')
    const result = await resolveSystemPrompt(ctx)
    expect(result).toBe('section A\n\n---\n\nsection B')
  })

  it('cached section loader is called only once across two resolves', async () => {
    const loader = vi.fn().mockResolvedValue('cached content')
    registerSection('cached', loader)
    await resolveSystemPrompt(ctx)
    await resolveSystemPrompt(ctx)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('volatile section loader is called on every resolve', async () => {
    const loader = vi.fn().mockResolvedValue('volatile content')
    registerVolatileSection('volatile', loader)
    await resolveSystemPrompt(ctx)
    await resolveSystemPrompt(ctx)
    expect(loader).toHaveBeenCalledTimes(2)
  })
})

describe('clearSectionCache', () => {
  it('causes cached loader to be re-called after clear', async () => {
    const loader = vi.fn().mockResolvedValue('content')
    registerSection('cached', loader)
    await resolveSystemPrompt(ctx)
    clearSectionCache()
    await resolveSystemPrompt(ctx)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('does not change volatile loader call frequency', async () => {
    const loader = vi.fn().mockResolvedValue('volatile')
    registerVolatileSection('volatile', loader)
    await resolveSystemPrompt(ctx)
    clearSectionCache()
    await resolveSystemPrompt(ctx)
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
