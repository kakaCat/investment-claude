import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { HOOK_EVENTS, type HookCommand, type HookEvent, type HookMatcher, type HooksSettings } from './types.js'

const HOOK_COMMAND_TYPES = new Set<HookCommand['type']>(['command', 'function', 'prompt', 'http'])
const HOOK_EVENT_SET = new Set<HookEvent>(HOOK_EVENTS)

export function loadHooksSettings(): HooksSettings {
  const sources = [
    join(homedir(), '.claude', 'settings.json'),
    join(process.cwd(), '.claude', 'settings.json'),
    join(process.cwd(), '.claude', 'settings.local.json'),
  ]

  const merged: HooksSettings = {}

  for (const path of sources) {
    try {
      const content = readFileSync(path, 'utf-8')
      const parsed = JSON.parse(content) as { hooks?: unknown }

      if (!parsed.hooks || typeof parsed.hooks !== 'object') {
        continue
      }

      for (const [event, matchers] of Object.entries(parsed.hooks)) {
        if (!HOOK_EVENT_SET.has(event as HookEvent) || !Array.isArray(matchers)) {
          continue
        }

        const validMatchers = matchers.filter(isValidHookMatcher)

        if (validMatchers.length === 0) {
          continue
        }

        const hookEvent = event as HookEvent
        const existingMatchers = merged[hookEvent] ?? []
        existingMatchers.push(...validMatchers)
        merged[hookEvent] = existingMatchers
      }
    } catch {
      // Missing files and malformed JSON are both best-effort inputs.
    }
  }

  return merged
}

function isValidHookMatcher(matcher: unknown): matcher is HookMatcher {
  if (!matcher || typeof matcher !== 'object') {
    return false
  }

  const candidate = matcher as Record<string, unknown>

  if ('matcher' in candidate && candidate.matcher != null && typeof candidate.matcher !== 'string') {
    return false
  }

  if (!Array.isArray(candidate.hooks)) {
    return false
  }

  return candidate.hooks.every(isValidHookCommand)
}

function isValidHookCommand(command: unknown): command is HookCommand {
  if (!command || typeof command !== 'object') {
    return false
  }

  const candidate = command as Record<string, unknown>

  return typeof candidate.type === 'string' && HOOK_COMMAND_TYPES.has(candidate.type as HookCommand['type'])
}
