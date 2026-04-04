import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMatchingHooks } from '../registry.js'
import { executeHooks } from '../executor.js'
import type { HookCommand, HookInput, HookResult } from '../types.js'

vi.mock('../registry.js', async () => {
  const actual = await vi.importActual('../registry.js')

  return {
    ...actual,
    getMatchingHooks: vi.fn(),
  }
})

const getMatchingHooksMock = vi.mocked(getMatchingHooks)

const input: HookInput = {
  hook_event_name: 'UserPromptSubmit',
  session_id: 'session-1',
  cwd: '/tmp/pi-hooks',
  prompt: 'hello from hook input',
}

function createFunctionHook(
  result?: HookResult,
  callback: (input: HookInput) => unknown = () => result,
): HookCommand {
  return {
    type: 'function',
    callback: callback as unknown as HookCommand & { callback: never }['callback'],
  } as HookCommand
}

describe('executeHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMatchingHooksMock.mockReturnValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls function hooks with the input', async () => {
    const callback = vi.fn()
    getMatchingHooksMock.mockReturnValue([createFunctionHook(undefined, callback)])

    await expect(executeHooks(input)).resolves.toEqual({})

    expect(getMatchingHooksMock).toHaveBeenCalledWith('UserPromptSubmit', undefined)
    expect(callback).toHaveBeenCalledWith(input)
  })

  it('swallows function hook errors and continues executing later hooks', async () => {
    const failingCallback = vi.fn(() => {
      throw new Error('boom')
    })
    const succeedingCallback = vi.fn()

    getMatchingHooksMock.mockReturnValue([
      createFunctionHook(undefined, failingCallback),
      createFunctionHook(undefined, succeedingCallback),
    ])

    await expect(executeHooks(input)).resolves.toEqual({})

    expect(failingCallback).toHaveBeenCalledWith(input)
    expect(succeedingCallback).toHaveBeenCalledWith(input)
  })

  it('runs command hooks with HOOK_INPUT set in the environment', async () => {
    getMatchingHooksMock.mockReturnValue([
      {
        type: 'command',
        command: `node -e "process.stdout.write(JSON.parse(process.env.HOOK_INPUT).prompt)"`,
      },
    ])

    await expect(executeHooks(input)).resolves.toEqual({
      additionalContexts: ['hello from hook input'],
    })
  })

  it('parses command hook JSON output', async () => {
    getMatchingHooksMock.mockReturnValue([
      {
        type: 'command',
        command:
          `node -e "process.stdout.write(JSON.stringify({continue:false,hookSpecificOutput:{permissionDecision:'deny',updatedInput:{approved:false}}}))"`,
      },
    ])

    await expect(executeHooks(input)).resolves.toEqual({
      permissionDecision: 'deny',
      updatedInput: { approved: false },
      preventContinuation: true,
    })
  })

  it('treats non-JSON command stdout as additional context', async () => {
    getMatchingHooksMock.mockReturnValue([
      {
        type: 'command',
        command: `node -e "process.stdout.write('plain text context')"`,
      },
    ])

    await expect(executeHooks(input)).resolves.toEqual({
      additionalContexts: ['plain text context'],
    })
  })

  it('skips prompt hooks without throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    getMatchingHooksMock.mockReturnValue([
      {
        type: 'prompt',
        prompt: 'phase 2 later',
      },
    ])

    await expect(executeHooks(input)).resolves.toEqual({})

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('aggregates multiple hook results', async () => {
    const hookOne = createFunctionHook({
      outcome: 'success',
      permissionDecision: 'allow',
      additionalContext: 'first context',
      systemMessage: 'old system message',
      watchPaths: ['/tmp/a'],
    })
    const hookTwo = createFunctionHook({
      outcome: 'blocking',
      preventContinuation: true,
      stopReason: 'stopped',
      systemMessage: 'new system message',
      initialUserMessage: 'first user message',
      watchPaths: ['/tmp/b'],
    })
    const hookThree = createFunctionHook({
      outcome: 'success',
      permissionDecision: 'deny',
      updatedInput: { rewritten: true },
      additionalContext: 'second context',
      initialUserMessage: 'latest user message',
      watchPaths: ['/tmp/c'],
    })

    getMatchingHooksMock.mockReturnValue([hookOne, hookTwo, hookThree])

    await expect(executeHooks(input)).resolves.toEqual({
      permissionDecision: 'deny',
      updatedInput: { rewritten: true },
      preventContinuation: true,
      stopReason: 'stopped',
      additionalContexts: ['first context', 'second context'],
      systemMessage: 'new system message',
      initialUserMessage: 'latest user message',
      watchPaths: ['/tmp/a', '/tmp/b', '/tmp/c'],
    })
  })

  it('stops executing hooks once the abort signal is aborted', async () => {
    const controller = new AbortController()
    const firstCallback = vi.fn(() => {
      controller.abort()
    })
    const secondCallback = vi.fn()

    getMatchingHooksMock.mockReturnValue([
      createFunctionHook(undefined, firstCallback),
      createFunctionHook(undefined, secondCallback),
    ])

    await expect(executeHooks(input, { signal: controller.signal })).resolves.toEqual({})

    expect(firstCallback).toHaveBeenCalledWith(input)
    expect(secondCallback).not.toHaveBeenCalled()
  })
})
