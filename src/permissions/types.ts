// src/permissions/types.ts
// Permission system type definitions — ref Claude Code src/types/permissions.ts

// ── Permission Modes ──────────────────────────────────────────────────────────

export type PermissionMode = 'default' | 'readonly' | 'trust'

export const PERMISSION_MODES: readonly PermissionMode[] = ['default', 'readonly', 'trust']

// ── Permission Behaviors ──────────────────────────────────────────────────────

export type PermissionBehavior = 'allow' | 'deny' | 'ask'

// ── Permission Rules ──────────────────────────────────────────────────────────

export type PermissionRuleSource = 'userSettings' | 'projectSettings' | 'session'

export type PermissionRuleValue = {
  toolName: string
  ruleContent?: string
}

export type PermissionRule = {
  source: PermissionRuleSource
  behavior: PermissionBehavior
  value: PermissionRuleValue
}

// ── Permission Context (stored in AppState) ───────────────────────────────────

export type ToolPermissionContext = {
  mode: PermissionMode
  allowRules: Record<PermissionRuleSource, string[]>
  denyRules: Record<PermissionRuleSource, string[]>
  askRules: Record<PermissionRuleSource, string[]>
}

// ── Permission Decisions ──────────────────────────────────────────────────────

export type PermissionDecision =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message: string }
  | { behavior: 'ask'; message: string; suggestions?: PermissionUpdate[] }

export type PermissionUpdate = {
  type: 'addRules' | 'removeRules'
  destination: PermissionRuleSource
  rules: PermissionRuleValue[]
  behavior: PermissionBehavior
}

// ── Permission User Choice (from terminal UI) ─────────────────────────────────

export type PermissionUserChoice = {
  action: 'allow' | 'deny'
  persist: boolean
  destination?: PermissionRuleSource
}

// ── Factory helper ────────────────────────────────────────────────────────────

export function createEmptyPermissionContext(): ToolPermissionContext {
  return {
    mode: 'default',
    allowRules: { userSettings: [], projectSettings: [], session: [] },
    denyRules: { userSettings: [], projectSettings: [], session: [] },
    askRules: { userSettings: [], projectSettings: [], session: [] },
  }
}
