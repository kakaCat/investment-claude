// src/permissions/settingsLoader.ts
// Load/persist permission rules from settings.json — ref Claude Code permissionsLoader.ts

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import {
  PERMISSION_MODES,
  createEmptyPermissionContext,
  type PermissionBehavior,
  type PermissionMode,
  type PermissionRuleSource,
  type PermissionUpdate,
  type ToolPermissionContext,
} from './types.js'
import { ruleValueToString } from './ruleMatching.js'

// ── Settings file reading/writing ─────────────────────────────────────────────

type PermissionSettings = {
  defaultMode?: string
  allow?: string[]
  deny?: string[]
  ask?: string[]
}

type SettingsFile = {
  hooks?: unknown
  permissions?: PermissionSettings
  [key: string]: unknown
}

function readSettingsFile(path: string): SettingsFile | null {
  try {
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content) as SettingsFile
  } catch {
    return null
  }
}

function writeSettingsFile(path: string, settings: SettingsFile): void {
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
}

function isValidMode(mode: unknown): mode is PermissionMode {
  return typeof mode === 'string' && (PERMISSION_MODES as readonly string[]).includes(mode)
}

// ── Load ──────────────────────────────────────────────────────────────────────

/**
 * Load permission config from user and project settings.json files.
 * Project-level defaultMode overrides user-level.
 */
export function loadPermissionSettings(): ToolPermissionContext {
  const sources: Array<{ path: string; source: PermissionRuleSource }> = [
    { path: join(homedir(), '.pi', 'settings.json'), source: 'userSettings' },
    { path: join(process.cwd(), '.pi', 'settings.json'), source: 'projectSettings' },
  ]

  const context = createEmptyPermissionContext()

  for (const { path, source } of sources) {
    const settings = readSettingsFile(path)
    if (!settings?.permissions) continue

    if (isValidMode(settings.permissions.defaultMode)) {
      context.mode = settings.permissions.defaultMode
    }

    if (Array.isArray(settings.permissions.allow)) {
      context.allowRules[source] = settings.permissions.allow
    }
    if (Array.isArray(settings.permissions.deny)) {
      context.denyRules[source] = settings.permissions.deny
    }
    if (Array.isArray(settings.permissions.ask)) {
      context.askRules[source] = settings.permissions.ask
    }
  }

  return context
}

// ── Apply (pure, in-memory) ───────────────────────────────────────────────────

function getBehaviorBucket(
  ctx: ToolPermissionContext,
  behavior: PermissionBehavior,
): Record<PermissionRuleSource, string[]> {
  switch (behavior) {
    case 'allow': return ctx.allowRules
    case 'deny': return ctx.denyRules
    case 'ask': return ctx.askRules
  }
}

/**
 * Apply a permission update to the in-memory context. Pure function.
 */
export function applyPermissionUpdate(
  ctx: ToolPermissionContext,
  update: PermissionUpdate,
): ToolPermissionContext {
  const bucket = getBehaviorBucket(ctx, update.behavior)
  const existing = bucket[update.destination] ?? []
  const newRuleStrings = update.rules.map(ruleValueToString)

  let updated: string[]
  if (update.type === 'addRules') {
    const set = new Set(existing)
    for (const r of newRuleStrings) set.add(r)
    updated = [...set]
  } else {
    // removeRules
    const toRemove = new Set(newRuleStrings)
    updated = existing.filter(r => !toRemove.has(r))
  }

  const newBucket = { ...bucket, [update.destination]: updated }

  return {
    ...ctx,
    allowRules: update.behavior === 'allow' ? newBucket : ctx.allowRules,
    denyRules: update.behavior === 'deny' ? newBucket : ctx.denyRules,
    askRules: update.behavior === 'ask' ? newBucket : ctx.askRules,
  }
}

// ── Persist (to disk) ─────────────────────────────────────────────────────────

/**
 * Persist a permission update to the appropriate settings.json file.
 * Session-scoped updates are not persisted.
 */
export function persistPermissionUpdate(update: PermissionUpdate): void {
  if (update.destination === 'session') return

  const settingsPath = update.destination === 'userSettings'
    ? join(homedir(), '.pi', 'settings.json')
    : join(process.cwd(), '.pi', 'settings.json')

  const settings = readSettingsFile(settingsPath) ?? {}
  settings.permissions ??= {}

  const key = update.behavior as 'allow' | 'deny' | 'ask'
  const existing: string[] = (settings.permissions as PermissionSettings)[key] ?? []
  const newRuleStrings = update.rules.map(ruleValueToString)

  if (update.type === 'addRules') {
    const set = new Set(existing)
    for (const r of newRuleStrings) set.add(r)
    ;(settings.permissions as PermissionSettings)[key] = [...set]
  } else {
    const toRemove = new Set(newRuleStrings)
    ;(settings.permissions as PermissionSettings)[key] = existing.filter(r => !toRemove.has(r))
  }

  writeSettingsFile(settingsPath, settings)
}
