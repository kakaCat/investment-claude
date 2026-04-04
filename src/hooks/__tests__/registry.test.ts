import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadHooksSettings } from '../settings.js'

vi.mock('../settings.js', () => ({
  loadHooksSettings: vi.fn(),
}))

const loadHooksSettingsMock = vi.mocked(loadHooksSettings)

describe('hooks registry', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    loadHooksSettingsMock.mockReturnValue({})

    const { clearAllHooks } = await import('../registry.js')
    clearAllHooks()
  })

  it('registerFunctionHook returns an id and exposes the hook via getMatchingHooks', async () => {
    const { getMatchingHooks, registerFunctionHook } = await import('../registry.js')
    const callback = vi.fn()

    const hookId = registerFunctionHook('PreToolUse', callback)
    const hooks = getMatchingHooks('PreToolUse', 'Bash')

    expect(hookId).toEqual(expect.any(String))
    expect(hooks).toHaveLength(1)
    expect(hooks[0]).toMatchObject({
      type: 'function',
      id: hookId,
      callback,
    })
  })

  it('removeFunctionHook removes the hook', async () => {
    const { getMatchingHooks, registerFunctionHook, removeFunctionHook } = await import('../registry.js')

    const hookId = registerFunctionHook('PreToolUse', vi.fn())
    removeFunctionHook('PreToolUse', hookId)

    expect(getMatchingHooks('PreToolUse', 'Bash')).toEqual([])
  })

  it('filters session hooks using case-insensitive substring matcher logic', async () => {
    const { addSessionHook, getMatchingHooks } = await import('../registry.js')

    addSessionHook('PreToolUse', 'Bash', { type: 'command', command: 'echo bash' })

    expect(getMatchingHooks('PreToolUse', 'Bash')).toEqual([
      { type: 'command', command: 'echo bash' },
    ])
    expect(getMatchingHooks('PreToolUse', 'Edit')).toEqual([])
    expect(getMatchingHooks('PreToolUse', 'run-bash-tool')).toEqual([
      { type: 'command', command: 'echo bash' },
    ])
  })

  it('matches hooks without a matcher against any matcher query', async () => {
    const { addSessionHook, getMatchingHooks } = await import('../registry.js')

    addSessionHook('Stop', '', { type: 'command', command: 'echo always' })

    expect(getMatchingHooks('Stop')).toEqual([
      { type: 'command', command: 'echo always' },
    ])
    expect(getMatchingHooks('Stop', 'anything')).toEqual([
      { type: 'command', command: 'echo always' },
    ])
  })

  it('returns hooks in settings, session, then function order', async () => {
    const { addSessionHook, getMatchingHooks, registerFunctionHook } = await import('../registry.js')
    const callback = vi.fn()

    loadHooksSettingsMock.mockReturnValue({
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'echo settings' }],
        },
      ],
    })

    addSessionHook('PreToolUse', 'Bash', { type: 'command', command: 'echo session' })
    registerFunctionHook('PreToolUse', callback, { id: 'function-hook' })

    expect(getMatchingHooks('PreToolUse', 'Bash')).toEqual([
      { type: 'command', command: 'echo settings' },
      { type: 'command', command: 'echo session' },
      { type: 'function', id: 'function-hook', callback },
    ])
  })

  it('clearAllHooks removes session and function hooks but preserves settings hooks', async () => {
    const { addSessionHook, clearAllHooks, getMatchingHooks, registerFunctionHook } = await import('../registry.js')

    loadHooksSettingsMock.mockReturnValue({
      Stop: [
        {
          hooks: [{ type: 'command', command: 'echo settings' }],
        },
      ],
    })

    addSessionHook('Stop', '', { type: 'command', command: 'echo session' })
    registerFunctionHook('Stop', vi.fn(), { id: 'function-hook' })

    clearAllHooks()

    expect(getMatchingHooks('Stop')).toEqual([
      { type: 'command', command: 'echo settings' },
    ])
  })
})
