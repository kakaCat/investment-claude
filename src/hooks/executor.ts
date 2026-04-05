import { spawn } from 'child_process'
import { logForDebugging } from '../utils/debug.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'
import { getMatchingHooks } from './registry.js'
import type {
  AggregatedHookResult,
  CommandHook,
  HookInput,
  HookResult,
  HttpHook,
  PromptHook,
} from './types.js'

type ExecuteHooksOptions = {
  signal?: AbortSignal
  matcherQuery?: string
}

type TimedTask<T> = {
  promise: Promise<T>
  onTimeout?: () => void
}

type CommandHookOutput = {
  continue?: boolean
  hookSpecificOutput?: {
    permissionDecision?: HookResult['permissionDecision']
    updatedInput?: HookResult['updatedInput']
  }
}

export async function executeHooks(
  input: HookInput,
  options?: ExecuteHooksOptions,
): Promise<AggregatedHookResult> {
  const hooks = getMatchingHooks(input.hook_event_name, options?.matcherQuery)
  const results: HookResult[] = []

  for (const hook of hooks) {
    if (options?.signal?.aborted) {
      break
    }

    const result = await executeHookSafely(hook, input, options?.signal)

    if (result) {
      results.push(result)
    }
  }

  return aggregateHookResults(results)
}

async function executeHookSafely(
  hook: ReturnType<typeof getMatchingHooks>[number],
  input: HookInput,
  signal?: AbortSignal,
): Promise<HookResult | undefined> {
  try {
    if (hook.type === 'function') {
      logForDebugging(`hook ${input.hook_event_name} fn called`)
      return await withTimeout(
        {
          promise: Promise.resolve(hook.callback(input) as unknown as HookResult | undefined),
        },
        toMilliseconds(hook.timeout ?? 60),
      )
    }

    if (hook.type === 'command') {
      const hookName = input.hook_event_name
      const startTs = Date.now()
      logForDebugging(`hook ${hookName} started (command)`)
      logForDiagnosticsNoPII('info', 'hook_started', { hook: hookName, type: 'command' })

      if (hook.async) {
        executeCommandHookDetached(hook, input, signal)
        return undefined
      }

      try {
        const result = await withTimeout(
          executeCommandHook(hook, input, signal),
          toMilliseconds(hook.timeout ?? 60),
        )
        const duration_ms = Date.now() - startTs
        const outcome = result?.outcome ?? 'success'
        logForDebugging(`hook ${hookName} completed outcome=${outcome} duration=${duration_ms}ms`)
        logForDiagnosticsNoPII('info', 'hook_completed', { hook: hookName, duration_ms, outcome })
        return result
      } catch (err) {
        const duration_ms = Date.now() - startTs
        const isTimeout = err instanceof Error && err.message.includes('timed out')
        if (isTimeout) {
          logForDebugging(`hook ${hookName} timed out after ${duration_ms}ms`, { level: 'warn' })
          logForDiagnosticsNoPII('warn', 'hook_failed', { hook: hookName, duration_ms, reason: 'timeout' })
        } else {
          logForDebugging(`hook ${hookName} error: ${err instanceof Error ? err.message : String(err)}`, {
            level: 'error',
          })
          logForDiagnosticsNoPII('error', 'hook_failed', { hook: hookName, duration_ms })
        }
        return undefined
      }
    }

    if (hook.type === 'prompt') {
      warnSkippedHook(hook)
      return undefined
    }

    warnSkippedHook(hook)
    return undefined
  } catch {
    return undefined
  }
}

async function withTimeout<T>(task: TimedTask<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      task.promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          task.onTimeout?.()
          reject(new Error(`Hook timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function executeCommandHook(
  hook: CommandHook,
  input: HookInput,
  signal?: AbortSignal,
): TimedTask<HookResult | undefined> {
  let child: ReturnType<typeof spawn> | undefined

  const promise = new Promise<HookResult | undefined>((resolve, reject) => {
    child = spawn(hook.command, {
      shell: true,
      signal,
      env: {
        ...process.env,
        HOOK_INPUT: JSON.stringify(input),
      },
    })

    let stdout = ''

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })

    child.on('error', reject)
    child.on('close', () => {
      resolve(parseCommandHookStdout(stdout))
    })
  })

  return {
    promise,
    onTimeout: () => {
      child?.kill()
    },
  }
}

function executeCommandHookDetached(
  hook: CommandHook,
  input: HookInput,
  signal?: AbortSignal,
): void {
  const child = spawn(hook.command, {
    shell: true,
    signal,
    stdio: 'ignore',
    env: {
      ...process.env,
      HOOK_INPUT: JSON.stringify(input),
    },
  })

  child.on('error', () => {})
}

function parseCommandHookStdout(stdout: string): HookResult | undefined {
  const trimmed = stdout.trim()

  if (trimmed.length === 0) {
    return undefined
  }

  try {
    const parsed = JSON.parse(trimmed) as CommandHookOutput
    const result: HookResult = {
      outcome: parsed.continue === false ? 'blocking' : 'success',
    }

    if (parsed.continue === false) {
      result.preventContinuation = true
    }

    if (parsed.hookSpecificOutput?.permissionDecision !== undefined) {
      result.permissionDecision = parsed.hookSpecificOutput.permissionDecision
    }

    if (parsed.hookSpecificOutput?.updatedInput !== undefined) {
      result.updatedInput = parsed.hookSpecificOutput.updatedInput
    }

    return result
  } catch {
    return {
      outcome: 'success',
      additionalContext: trimmed,
    }
  }
}

function aggregateHookResults(results: HookResult[]): AggregatedHookResult {
  const aggregated: AggregatedHookResult = {}

  for (const result of results) {
    if (result.permissionDecision !== undefined) {
      aggregated.permissionDecision = result.permissionDecision
    }

    if (result.updatedInput !== undefined) {
      aggregated.updatedInput = result.updatedInput
    }

    if (result.preventContinuation) {
      aggregated.preventContinuation = true
    }

    if (result.stopReason !== undefined) {
      aggregated.stopReason = result.stopReason
    }

    if (result.additionalContext !== undefined) {
      aggregated.additionalContexts ??= []
      aggregated.additionalContexts.push(result.additionalContext)
    }

    if (result.systemMessage !== undefined) {
      aggregated.systemMessage = result.systemMessage
    }

    if (result.initialUserMessage !== undefined) {
      aggregated.initialUserMessage = result.initialUserMessage
    }

    if (result.watchPaths?.length) {
      aggregated.watchPaths ??= []
      aggregated.watchPaths.push(...result.watchPaths)
    }
  }

  return aggregated
}

function warnSkippedHook(hook: PromptHook | HttpHook): void {
  console.warn(`[hooks] ${hook.type} hooks are not implemented yet; skipping`)
}

function toMilliseconds(seconds: number): number {
  return seconds * 1000
}
