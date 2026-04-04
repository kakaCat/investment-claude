import { randomUUID } from 'crypto'
import { loadHooksSettings } from './settings.js'
import type { CommandHook, FunctionHook, HookCommand, HookEvent, HookMatcher } from './types.js'

const sessionHooks = new Map<HookEvent, HookMatcher[]>()
const functionHooks = new Map<HookEvent, Map<string, FunctionHook>>()

let functionHookCounter = 0

export function registerFunctionHook(
  event: HookEvent,
  fn: FunctionHook['callback'],
  options?: { id?: string; timeout?: number },
): string {
  const id = options?.id ?? createFunctionHookId()
  const hooksForEvent = getOrCreateFunctionHooks(event)

  hooksForEvent.set(id, {
    type: 'function',
    id,
    callback: fn,
    timeout: options?.timeout,
  })

  return id
}

export function removeFunctionHook(event: HookEvent, id: string): void {
  functionHooks.get(event)?.delete(id)
}

export function addSessionHook(
  event: HookEvent,
  matcher: string,
  hook: CommandHook,
): void {
  const existingMatchers = sessionHooks.get(event) ?? []
  const existingEntry = existingMatchers.find((entry) => entry.matcher === matcher)

  if (existingEntry) {
    existingEntry.hooks.push(hook)
  } else {
    existingMatchers.push({
      matcher,
      hooks: [hook],
    })
  }

  sessionHooks.set(event, existingMatchers)
}

export function getMatchingHooks(
  event: HookEvent,
  matcherQuery?: string,
): HookCommand[] {
  const settingsHooks = getMatchingMatcherHooks(loadHooksSettings()[event] ?? [], matcherQuery)
  const runtimeSessionHooks = getMatchingMatcherHooks(sessionHooks.get(event) ?? [], matcherQuery)
  const runtimeFunctionHooks = Array.from(functionHooks.get(event)?.values() ?? [])

  return [...settingsHooks, ...runtimeSessionHooks, ...runtimeFunctionHooks]
}

export function clearAllHooks(): void {
  sessionHooks.clear()
  functionHooks.clear()
  functionHookCounter = 0
}

function getMatchingMatcherHooks(matchers: HookMatcher[], matcherQuery?: string): HookCommand[] {
  return matchers
    .filter((entry) => matchesMatcher(entry.matcher, matcherQuery))
    .flatMap((entry) => entry.hooks)
}

function matchesMatcher(matcher: string | undefined, matcherQuery?: string): boolean {
  if (matcher == null || matcher === '') {
    return true
  }

  if (!matcherQuery) {
    return false
  }

  return matcherQuery.toLowerCase().includes(matcher.toLowerCase())
}

function getOrCreateFunctionHooks(event: HookEvent): Map<string, FunctionHook> {
  const existing = functionHooks.get(event)

  if (existing) {
    return existing
  }

  const created = new Map<string, FunctionHook>()
  functionHooks.set(event, created)
  return created
}

function createFunctionHookId(): string {
  try {
    return randomUUID()
  } catch {
    functionHookCounter += 1
    return `function-hook-${functionHookCounter}`
  }
}
