# Permission System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Claude Code-style permission system for Pi investment Agent that checks tool permissions via rules, prompts users with allow/deny/always-allow/always-deny options in the terminal, and persists choices to settings.json.

**Architecture:** A 5-layer pipeline: types → rule parsing/matching → settings loader → permission checking → REPL UI integration. The permission context lives in AppState and is initialized from `~/.pi/settings.json` + `.pi/settings.json`. REPL's `canUseTool` callback calls the pipeline; on `ask` decisions it renders a `PermissionPrompt` component. "Always" choices are persisted to disk and applied to the in-memory context.

**Tech Stack:** TypeScript, React (Ink), Vitest

**Spec:** `docs/superpowers/specs/2026-05-13-permission-system-design.md`

---

### Task 1: Permission Types

**Files:**
- Create: `src/permissions/types.ts`

- [ ] **Step 1: Create the types file**

Create `src/permissions/types.ts` with all permission type definitions:

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/permissions/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/permissions/types.ts
git commit -m "feat(permissions): add core type definitions"
```

---

### Task 2: Rule Parsing and Matching

**Files:**
- Create: `src/permissions/__tests__/ruleMatching.test.ts`
- Create: `src/permissions/ruleMatching.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/permissions/__tests__/ruleMatching.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  ruleValueToString,
  ruleValueFromString,
  ruleMatchesToolUse,
  findMatchingRule,
} from '../ruleMatching.js'

describe('ruleValueToString', () => {
  it('converts tool-only rule', () => {
    expect(ruleValueToString({ toolName: 'Read' })).toBe('Read')
  })

  it('converts rule with content', () => {
    expect(
      ruleValueToString({ toolName: 'Investment', ruleContent: 'manage_portfolio:add' }),
    ).toBe('Investment(manage_portfolio:add)')
  })

  it('converts rule with wildcard content', () => {
    expect(
      ruleValueToString({ toolName: 'Investment', ruleContent: 'manage_cash:*' }),
    ).toBe('Investment(manage_cash:*)')
  })
})

describe('ruleValueFromString', () => {
  it('parses tool-only rule', () => {
    expect(ruleValueFromString('Read')).toEqual({ toolName: 'Read' })
  })

  it('parses rule with content', () => {
    expect(ruleValueFromString('Investment(manage_portfolio:add)')).toEqual({
      toolName: 'Investment',
      ruleContent: 'manage_portfolio:add',
    })
  })

  it('parses rule with wildcard', () => {
    expect(ruleValueFromString('Investment(manage_cash:*)')).toEqual({
      toolName: 'Investment',
      ruleContent: 'manage_cash:*',
    })
  })

  it('handles empty parentheses as tool-only', () => {
    expect(ruleValueFromString('Bash()')).toEqual({ toolName: 'Bash' })
  })
})

describe('ruleMatchesToolUse', () => {
  it('matches tool-only rule against any use of that tool', () => {
    expect(ruleMatchesToolUse('Read', 'Read')).toBe(true)
    expect(ruleMatchesToolUse('Read', 'Bash')).toBe(false)
  })

  it('matches exact content rule', () => {
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:add)', 'Investment', 'manage_portfolio:add'),
    ).toBe(true)
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:add)', 'Investment', 'manage_portfolio:remove'),
    ).toBe(false)
  })

  it('matches wildcard content rule', () => {
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:*)', 'Investment', 'manage_portfolio:add'),
    ).toBe(true)
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:*)', 'Investment', 'manage_portfolio:remove'),
    ).toBe(true)
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:*)', 'Investment', 'manage_cash:update'),
    ).toBe(false)
  })

  it('tool-only rule matches even when content is provided', () => {
    expect(
      ruleMatchesToolUse('Investment', 'Investment', 'manage_portfolio:add'),
    ).toBe(true)
  })
})

describe('findMatchingRule', () => {
  it('returns matching rule from any source', () => {
    const rules = {
      userSettings: ['Read'],
      projectSettings: ['Investment(manage_portfolio:add)'],
      session: [],
    }
    const result = findMatchingRule(rules, 'Investment', 'manage_portfolio:add')
    expect(result).not.toBeNull()
    expect(result!.source).toBe('projectSettings')
    expect(result!.value.toolName).toBe('Investment')
  })

  it('returns null when no rule matches', () => {
    const rules = {
      userSettings: ['Read'],
      projectSettings: [],
      session: [],
    }
    expect(findMatchingRule(rules, 'Bash')).toBeNull()
  })

  it('returns first matching rule (userSettings before projectSettings)', () => {
    const rules = {
      userSettings: ['Investment'],
      projectSettings: ['Investment(manage_portfolio:add)'],
      session: [],
    }
    const result = findMatchingRule(rules, 'Investment', 'manage_portfolio:add')
    expect(result!.source).toBe('userSettings')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/permissions/__tests__/ruleMatching.test.ts`
Expected: FAIL — module `../ruleMatching.js` not found

- [ ] **Step 3: Implement ruleMatching.ts**

Create `src/permissions/ruleMatching.ts`:

```typescript
// src/permissions/ruleMatching.ts
// Rule string parsing and matching — ref Claude Code src/utils/permissions/permissionRuleParser.ts

import type { PermissionRuleSource, PermissionRuleValue, PermissionRule } from './types.js'

const RULE_SOURCES: readonly PermissionRuleSource[] = [
  'userSettings',
  'projectSettings',
  'session',
]

/**
 * Convert a PermissionRuleValue to its string representation.
 *
 * Examples:
 *   { toolName: 'Read' }                                     → 'Read'
 *   { toolName: 'Investment', ruleContent: 'manage_cash:*' } → 'Investment(manage_cash:*)'
 */
export function ruleValueToString(value: PermissionRuleValue): string {
  if (value.ruleContent) {
    return `${value.toolName}(${value.ruleContent})`
  }
  return value.toolName
}

/**
 * Parse a rule string back into a PermissionRuleValue.
 *
 * Examples:
 *   'Read'                                → { toolName: 'Read' }
 *   'Investment(manage_portfolio:add)'    → { toolName: 'Investment', ruleContent: 'manage_portfolio:add' }
 */
export function ruleValueFromString(ruleString: string): PermissionRuleValue {
  const parenStart = ruleString.indexOf('(')
  if (parenStart === -1) {
    return { toolName: ruleString }
  }

  const toolName = ruleString.slice(0, parenStart)
  const content = ruleString.slice(parenStart + 1, -1) // strip '(' and ')'

  if (!content) {
    return { toolName }
  }

  return { toolName, ruleContent: content }
}

/**
 * Check if a rule string matches a specific tool use.
 *
 * Matching rules:
 * - 'ToolName' matches any use of that tool
 * - 'ToolName(exact:content)' matches only that exact content
 * - 'ToolName(prefix:*)' matches any content starting with 'prefix:'
 */
export function ruleMatchesToolUse(
  ruleString: string,
  toolName: string,
  contentString?: string,
): boolean {
  const rule = ruleValueFromString(ruleString)

  // Tool name must match
  if (rule.toolName !== toolName) {
    return false
  }

  // No content in rule → matches any use of this tool
  if (!rule.ruleContent) {
    return true
  }

  // No content on the tool use but rule requires content → no match
  if (!contentString) {
    return false
  }

  // Wildcard matching: 'prefix:*' matches 'prefix:anything'
  if (rule.ruleContent.endsWith(':*')) {
    const prefix = rule.ruleContent.slice(0, -1) // keep the ':'
    return contentString.startsWith(prefix)
  }

  // Exact match
  return rule.ruleContent === contentString
}

/**
 * Find the first rule that matches the given tool use across all sources.
 * Sources are checked in order: userSettings → projectSettings → session.
 */
export function findMatchingRule(
  rules: Record<PermissionRuleSource, string[]>,
  toolName: string,
  contentString?: string,
): PermissionRule | null {
  for (const source of RULE_SOURCES) {
    const sourceRules = rules[source]
    for (const ruleString of sourceRules) {
      if (ruleMatchesToolUse(ruleString, toolName, contentString)) {
        return {
          source,
          behavior: 'allow', // caller knows which behavior bucket this came from
          value: ruleValueFromString(ruleString),
        }
      }
    }
  }
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/permissions/__tests__/ruleMatching.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/permissions/ruleMatching.ts src/permissions/__tests__/ruleMatching.test.ts
git commit -m "feat(permissions): add rule parsing and matching with wildcard support"
```

---

### Task 3: Settings Loader (Load + Persist + Apply)

**Files:**
- Create: `src/permissions/__tests__/settingsLoader.test.ts`
- Create: `src/permissions/settingsLoader.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/permissions/__tests__/settingsLoader.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import type { ToolPermissionContext, PermissionUpdate } from '../types.js'

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
}))
vi.mock('os', () => ({
  homedir: vi.fn(),
}))

const readFileSyncMock = vi.mocked(readFileSync)
const writeFileSyncMock = vi.mocked(writeFileSync)
const mkdirSyncMock = vi.mocked(mkdirSync)
const existsSyncMock = vi.mocked(existsSync)
const homedirMock = vi.mocked(homedir)

describe('loadPermissionSettings', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    homedirMock.mockReturnValue('/home/tester')
    vi.spyOn(process, 'cwd').mockReturnValue('/project')
  })

  it('returns default context when no settings files exist', async () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const { loadPermissionSettings } = await import('../settingsLoader.js')
    const ctx = loadPermissionSettings()
    expect(ctx.mode).toBe('default')
    expect(ctx.allowRules.userSettings).toEqual([])
    expect(ctx.denyRules.projectSettings).toEqual([])
  })

  it('loads rules from user settings', async () => {
    readFileSyncMock.mockImplementation((path) => {
      if (String(path).includes('.pi/settings.json') && String(path).includes('home')) {
        return JSON.stringify({
          permissions: {
            defaultMode: 'trust',
            allow: ['Read', 'Investment(manage_portfolio:get)'],
            deny: ['Investment(manage_portfolio:remove)'],
          },
        })
      }
      throw new Error('ENOENT')
    })

    const { loadPermissionSettings } = await import('../settingsLoader.js')
    const ctx = loadPermissionSettings()
    expect(ctx.mode).toBe('trust')
    expect(ctx.allowRules.userSettings).toEqual(['Read', 'Investment(manage_portfolio:get)'])
    expect(ctx.denyRules.userSettings).toEqual(['Investment(manage_portfolio:remove)'])
  })

  it('project settings override user defaultMode', async () => {
    readFileSyncMock.mockImplementation((path) => {
      const p = String(path)
      if (p === '/home/tester/.pi/settings.json') {
        return JSON.stringify({ permissions: { defaultMode: 'trust' } })
      }
      if (p === '/project/.pi/settings.json') {
        return JSON.stringify({ permissions: { defaultMode: 'readonly' } })
      }
      throw new Error('ENOENT')
    })

    const { loadPermissionSettings } = await import('../settingsLoader.js')
    const ctx = loadPermissionSettings()
    expect(ctx.mode).toBe('readonly')
  })

  it('ignores invalid permission modes', async () => {
    readFileSyncMock.mockImplementation((path) => {
      if (String(path).includes('home')) {
        return JSON.stringify({ permissions: { defaultMode: 'invalid_mode' } })
      }
      throw new Error('ENOENT')
    })

    const { loadPermissionSettings } = await import('../settingsLoader.js')
    const ctx = loadPermissionSettings()
    expect(ctx.mode).toBe('default')
  })
})

describe('applyPermissionUpdate', () => {
  let applyPermissionUpdate: (ctx: ToolPermissionContext, update: PermissionUpdate) => ToolPermissionContext

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../settingsLoader.js')
    applyPermissionUpdate = mod.applyPermissionUpdate
  })

  it('adds allow rules to the correct destination', () => {
    const ctx: ToolPermissionContext = {
      mode: 'default',
      allowRules: { userSettings: [], projectSettings: ['Read'], session: [] },
      denyRules: { userSettings: [], projectSettings: [], session: [] },
      askRules: { userSettings: [], projectSettings: [], session: [] },
    }

    const result = applyPermissionUpdate(ctx, {
      type: 'addRules',
      destination: 'projectSettings',
      rules: [{ toolName: 'Investment', ruleContent: 'manage_portfolio:add' }],
      behavior: 'allow',
    })

    expect(result.allowRules.projectSettings).toEqual([
      'Read',
      'Investment(manage_portfolio:add)',
    ])
    // Original not mutated
    expect(ctx.allowRules.projectSettings).toEqual(['Read'])
  })

  it('deduplicates when adding rules', () => {
    const ctx: ToolPermissionContext = {
      mode: 'default',
      allowRules: { userSettings: [], projectSettings: ['Read'], session: [] },
      denyRules: { userSettings: [], projectSettings: [], session: [] },
      askRules: { userSettings: [], projectSettings: [], session: [] },
    }

    const result = applyPermissionUpdate(ctx, {
      type: 'addRules',
      destination: 'projectSettings',
      rules: [{ toolName: 'Read' }],
      behavior: 'allow',
    })

    expect(result.allowRules.projectSettings).toEqual(['Read'])
  })

  it('removes rules from the correct destination', () => {
    const ctx: ToolPermissionContext = {
      mode: 'default',
      allowRules: { userSettings: [], projectSettings: ['Read', 'Bash'], session: [] },
      denyRules: { userSettings: [], projectSettings: [], session: [] },
      askRules: { userSettings: [], projectSettings: [], session: [] },
    }

    const result = applyPermissionUpdate(ctx, {
      type: 'removeRules',
      destination: 'projectSettings',
      rules: [{ toolName: 'Read' }],
      behavior: 'allow',
    })

    expect(result.allowRules.projectSettings).toEqual(['Bash'])
  })
})

describe('persistPermissionUpdate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    homedirMock.mockReturnValue('/home/tester')
    vi.spyOn(process, 'cwd').mockReturnValue('/project')
    existsSyncMock.mockReturnValue(true)
  })

  it('does not write to disk for session rules', async () => {
    const { persistPermissionUpdate } = await import('../settingsLoader.js')
    persistPermissionUpdate({
      type: 'addRules',
      destination: 'session',
      rules: [{ toolName: 'Read' }],
      behavior: 'allow',
    })
    expect(writeFileSyncMock).not.toHaveBeenCalled()
  })

  it('writes to project settings.json for projectSettings destination', async () => {
    readFileSyncMock.mockReturnValue(JSON.stringify({ hooks: {} }))

    const { persistPermissionUpdate } = await import('../settingsLoader.js')
    persistPermissionUpdate({
      type: 'addRules',
      destination: 'projectSettings',
      rules: [{ toolName: 'Investment', ruleContent: 'manage_portfolio:add' }],
      behavior: 'allow',
    })

    expect(writeFileSyncMock).toHaveBeenCalledTimes(1)
    const writtenPath = writeFileSyncMock.mock.calls[0]![0]
    expect(String(writtenPath)).toBe('/project/.pi/settings.json')

    const writtenContent = JSON.parse(writeFileSyncMock.mock.calls[0]![1] as string)
    expect(writtenContent.hooks).toEqual({})
    expect(writtenContent.permissions.allow).toContain('Investment(manage_portfolio:add)')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/permissions/__tests__/settingsLoader.test.ts`
Expected: FAIL — module `../settingsLoader.js` not found

- [ ] **Step 3: Implement settingsLoader.ts**

Create `src/permissions/settingsLoader.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/permissions/__tests__/settingsLoader.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/permissions/settingsLoader.ts src/permissions/__tests__/settingsLoader.test.ts
git commit -m "feat(permissions): add settings loader with load/persist/apply"
```

---

### Task 4: Permission Checking Pipeline

**Files:**
- Create: `src/permissions/__tests__/checkPermissions.test.ts`
- Create: `src/permissions/checkPermissions.ts`
- Modify: `src/Tool.tsx` — add `checkPermissions` to `Tool` interface and `buildTool`

- [ ] **Step 1: Add `checkPermissions` to Tool interface**

In `src/Tool.tsx`, add the optional method to the `Tool` interface (after line 119 `isReadOnly(): boolean`):

```typescript
  /**
   * Tool-level permission check (optional).
   * Return 'allow' to auto-permit, 'deny' to block, 'ask' to prompt the user.
   * Default implementation: readOnly → allow, otherwise → ask.
   */
  checkPermissions?(input: Input): import('./permissions/types.js').PermissionDecision
```

In `src/Tool.tsx`, also add the `checkPermissions` to `ToolDef` type. The current `ToolDef` is a `Pick & Partial<Omit>` pattern, so `checkPermissions` is already included in the `Partial<Omit>` portion. No change needed there.

In the `buildTool` function (line 222-234), add a default `checkPermissions` implementation. Add it before the spread `...def`:

```typescript
export function buildTool<Input = unknown, Output = unknown>(
  def: ToolDef<Input, Output>,
): Tool<Input, Output> {
  return {
    isEnabled: () => true,
    isReadOnly: () => false,
    deferLoading: false,
    maxResultSizeChars: 50_000,
    renderToolUse: (input) => defaultRenderToolUse(def.name, input),
    renderToolResult: (result) => defaultRenderToolResult(result),
    checkPermissions: (_input: Input) => {
      // Default: readOnly tools auto-allow, writable tools ask
      const isRO = def.isReadOnly?.() ?? false
      if (isRO) return { behavior: 'allow' as const }
      return { behavior: 'ask' as const, message: `确认使用 ${def.name}？` }
    },
    ...def,
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/permissions/__tests__/checkPermissions.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { checkToolPermission } from '../checkPermissions.js'
import { createEmptyPermissionContext, type ToolPermissionContext } from '../types.js'

// Minimal tool stubs
function makeTool(overrides: {
  name?: string
  isReadOnly?: boolean
  checkPermissions?: (input: any) => any
} = {}) {
  return {
    name: overrides.name ?? 'TestTool',
    isReadOnly: () => overrides.isReadOnly ?? false,
    checkPermissions: overrides.checkPermissions,
  }
}

describe('checkToolPermission', () => {
  it('Step 1: deny rule blocks the tool', () => {
    const ctx: ToolPermissionContext = {
      ...createEmptyPermissionContext(),
      denyRules: { userSettings: ['TestTool'], projectSettings: [], session: [] },
    }
    const result = checkToolPermission(makeTool(), {}, ctx)
    expect(result.behavior).toBe('deny')
  })

  it('Step 1: deny rule with content matches', () => {
    const ctx: ToolPermissionContext = {
      ...createEmptyPermissionContext(),
      denyRules: { userSettings: ['Investment(manage_portfolio:remove)'], projectSettings: [], session: [] },
    }
    const tool = makeTool({ name: 'Investment' })
    const result = checkToolPermission(tool, { function: 'manage_portfolio', action: 'remove' }, ctx, 'manage_portfolio:remove')
    expect(result.behavior).toBe('deny')
  })

  it('Step 2: tool.checkPermissions deny is respected', () => {
    const tool = makeTool({
      checkPermissions: () => ({ behavior: 'deny', message: 'Tool says no' }),
    })
    const result = checkToolPermission(tool, {}, createEmptyPermissionContext())
    expect(result.behavior).toBe('deny')
    expect((result as { message: string }).message).toBe('Tool says no')
  })

  it('Step 3: trust mode allows everything', () => {
    const ctx: ToolPermissionContext = {
      ...createEmptyPermissionContext(),
      mode: 'trust',
    }
    const result = checkToolPermission(makeTool(), {}, ctx)
    expect(result.behavior).toBe('allow')
  })

  it('Step 3: readonly mode denies non-readonly tools', () => {
    const ctx: ToolPermissionContext = {
      ...createEmptyPermissionContext(),
      mode: 'readonly',
    }
    const result = checkToolPermission(makeTool({ isReadOnly: false }), {}, ctx)
    expect(result.behavior).toBe('deny')
  })

  it('Step 3: readonly mode allows readonly tools', () => {
    const ctx: ToolPermissionContext = {
      ...createEmptyPermissionContext(),
      mode: 'readonly',
    }
    const result = checkToolPermission(makeTool({ isReadOnly: true }), {}, ctx)
    expect(result.behavior).toBe('allow')
  })

  it('Step 4: allow rule permits the tool', () => {
    const ctx: ToolPermissionContext = {
      ...createEmptyPermissionContext(),
      allowRules: { userSettings: ['TestTool'], projectSettings: [], session: [] },
    }
    const result = checkToolPermission(makeTool(), {}, ctx)
    expect(result.behavior).toBe('allow')
  })

  it('Step 5: readonly tool defaults to allow', () => {
    const result = checkToolPermission(
      makeTool({ isReadOnly: true }),
      {},
      createEmptyPermissionContext(),
    )
    expect(result.behavior).toBe('allow')
  })

  it('Step 5: non-readonly tool defaults to ask', () => {
    const result = checkToolPermission(
      makeTool({ isReadOnly: false }),
      {},
      createEmptyPermissionContext(),
    )
    expect(result.behavior).toBe('ask')
  })

  it('tool.checkPermissions ask with suggestions is passed through', () => {
    const suggestion = {
      type: 'addRules' as const,
      destination: 'projectSettings' as const,
      rules: [{ toolName: 'Investment', ruleContent: 'manage_portfolio:add' }],
      behavior: 'allow' as const,
    }
    const tool = makeTool({
      checkPermissions: () => ({
        behavior: 'ask',
        message: 'Confirm?',
        suggestions: [suggestion],
      }),
    })
    const result = checkToolPermission(tool, {}, createEmptyPermissionContext())
    expect(result.behavior).toBe('ask')
    expect((result as any).suggestions).toEqual([suggestion])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/permissions/__tests__/checkPermissions.test.ts`
Expected: FAIL — module `../checkPermissions.js` not found

- [ ] **Step 4: Implement checkPermissions.ts**

Create `src/permissions/checkPermissions.ts`:

```typescript
// src/permissions/checkPermissions.ts
// Permission checking pipeline — ref Claude Code src/utils/permissions/permissions.ts

import type { PermissionDecision, ToolPermissionContext } from './types.js'
import { findMatchingRule } from './ruleMatching.js'

/**
 * Minimal tool shape needed for permission checking.
 * Avoids importing the full Tool type to prevent circular dependencies.
 */
type PermissionCheckTool = {
  name: string
  isReadOnly(): boolean
  checkPermissions?(input: unknown): PermissionDecision
}

/**
 * Main permission checking pipeline.
 *
 * Steps:
 * 1. Deny rules (highest priority)
 * 2. Tool-level checkPermissions
 * 3. Mode-based decision (trust/readonly/default)
 * 4. Allow rules
 * 5. Default: readOnly → allow, else → ask
 *
 * @param contentString Optional content key for rule matching,
 *        e.g. 'manage_portfolio:add' for Investment tool
 */
export function checkToolPermission(
  tool: PermissionCheckTool,
  input: Record<string, unknown>,
  context: ToolPermissionContext,
  contentString?: string,
): PermissionDecision {
  // Step 1: deny rules — highest priority
  const denyRule = findMatchingRule(context.denyRules, tool.name, contentString)
  if (denyRule) {
    return { behavior: 'deny', message: `已被规则禁止: ${tool.name}` }
  }

  // Step 2: tool-level permission check
  const toolResult = tool.checkPermissions?.(input)
  if (toolResult?.behavior === 'deny') {
    return toolResult
  }

  // Step 3: mode-based decision
  if (context.mode === 'trust') {
    return { behavior: 'allow' }
  }
  if (context.mode === 'readonly' && !tool.isReadOnly()) {
    return { behavior: 'deny', message: '只读模式下不允许写入操作' }
  }

  // Step 4: allow rules
  const allowRule = findMatchingRule(context.allowRules, tool.name, contentString)
  if (allowRule) {
    return { behavior: 'allow' }
  }

  // Step 5: tool returned ask with suggestions → pass through
  if (toolResult?.behavior === 'ask') {
    return toolResult
  }

  // Default: readOnly tools auto-allow, else ask
  if (tool.isReadOnly()) {
    return { behavior: 'allow' }
  }
  return { behavior: 'ask', message: `确认使用 ${tool.name}？` }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/permissions/__tests__/checkPermissions.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/permissions/checkPermissions.ts src/permissions/__tests__/checkPermissions.test.ts src/Tool.tsx
git commit -m "feat(permissions): add permission checking pipeline and Tool.checkPermissions"
```

---

### Task 5: Init + Index + AppState

**Files:**
- Create: `src/permissions/init.ts`
- Create: `src/permissions/index.ts`
- Modify: `src/state/AppState.ts`

- [ ] **Step 1: Create init.ts**

Create `src/permissions/init.ts`:

```typescript
// src/permissions/init.ts
// Bootstraps the permission system from settings.json into AppState

import { setAppState } from '../state/AppState.js'
import { loadPermissionSettings } from './settingsLoader.js'

/**
 * Load permission rules from settings.json files and write them
 * into AppState.permissionContext. Call once during REPL startup.
 */
export function initPermissions(): void {
  const permissionContext = loadPermissionSettings()
  setAppState(prev => ({ ...prev, permissionContext }))
}
```

- [ ] **Step 2: Create index.ts**

Create `src/permissions/index.ts`:

```typescript
// src/permissions/index.ts
// Public API for the permission system

export { checkToolPermission } from './checkPermissions.js'
export { loadPermissionSettings, applyPermissionUpdate, persistPermissionUpdate } from './settingsLoader.js'
export { ruleValueToString, ruleValueFromString, findMatchingRule } from './ruleMatching.js'
export { initPermissions } from './init.js'
export {
  createEmptyPermissionContext,
  PERMISSION_MODES,
  type PermissionMode,
  type PermissionBehavior,
  type PermissionRuleSource,
  type PermissionRuleValue,
  type PermissionRule,
  type ToolPermissionContext,
  type PermissionDecision,
  type PermissionUpdate,
  type PermissionUserChoice,
} from './types.js'
```

- [ ] **Step 3: Add permissionContext to AppState**

In `src/state/AppState.ts`, add the import and the new field.

Add import at top (after line 6):

```typescript
import type { ToolPermissionContext } from '../permissions/types.js'
import { createEmptyPermissionContext } from '../permissions/types.js'
```

Add field to `AppState` type (after `nextTaskId`):

```typescript
  /** Permission rules and mode — loaded from settings.json */
  readonly permissionContext: ToolPermissionContext
```

Add initial value in `_state` (after `nextTaskId: 1,`):

```typescript
  permissionContext: createEmptyPermissionContext(),
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/permissions/init.ts src/permissions/index.ts src/state/AppState.ts
git commit -m "feat(permissions): add init, index, and AppState integration"
```

---

### Task 6: InvestmentTool checkPermissions

**Files:**
- Modify: `src/tools/InvestmentTool/InvestmentTool.tsx`

- [ ] **Step 1: Add checkPermissions to InvestmentTool and remove askUser from call()**

In `src/tools/InvestmentTool/InvestmentTool.tsx`, add import at top:

```typescript
import type { PermissionDecision } from '../../permissions/types.js'
```

Add `checkPermissions` to `investmentToolDef` (after `inputSchema`, before `call`):

```typescript
  checkPermissions(input: InvestmentInput): PermissionDecision {
    const WRITE_OPS: Record<string, string[]> = {
      manage_portfolio: ['add', 'remove', 'update'],
      manage_watchlist: ['add', 'remove', 'update'],
      manage_trade_log: ['create', 'append'],
      manage_cash: ['update'],
    }

    const { function: funcName, ...params } = input
    const writeActions = WRITE_OPS[funcName]
    if (writeActions && writeActions.includes(params.action)) {
      return {
        behavior: 'ask',
        message: formatWriteConfirmation(funcName, params),
        suggestions: [{
          type: 'addRules',
          destination: 'projectSettings',
          rules: [{ toolName: 'Investment', ruleContent: `${funcName}:${params.action}` }],
          behavior: 'allow',
        }],
      }
    }

    return { behavior: 'allow' }
  },

  isReadOnly() {
    return false
  },
```

Remove the askUser block from `call()`. Delete lines 91-115 (the entire `WRITE_OPS` block and `askUser` confirmation logic inside `call`). The `call` method should go straight from function name validation to `try { const result = await callPython(...)`.

The updated `call` becomes:

```typescript
  async call(input, _context) {
    const { function: funcName, ...params } = input

    // 验证函数名
    if (!ALL_KNOWN_FUNCTIONS.includes(funcName)) {
      return {
        data: {
          success: false,
          error: `未知函数: ${funcName}. 可用函数: ${ALL_KNOWN_FUNCTIONS.slice(0, 10).join(', ')}...`,
          function: funcName,
        },
      }
    }

    try {
      const result = await callPython(funcName, params)
      if (result && typeof result === 'object' && 'error' in result) {
        return {
          data: {
            success: false,
            error: result.error,
            function: funcName,
            data: result,
          },
        }
      }
      return {
        data: {
          success: true,
          data: result,
          function: funcName,
        },
      }
    } catch (error) {
      return {
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          function: funcName,
        },
      }
    }
  },
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/InvestmentTool/InvestmentTool.tsx
git commit -m "feat(permissions): move InvestmentTool confirmation to checkPermissions"
```

---

### Task 7: Permission Prompt UI Component

**Files:**
- Create: `src/components/PermissionPrompt.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/PermissionPrompt.tsx`:

```tsx
// src/components/PermissionPrompt.tsx
// Terminal permission dialog — ref Claude Code src/components/permissions/PermissionDialog.tsx

import React from 'react'
import { Box, Text } from 'ink'
import type { PermissionDecision, PermissionUserChoice } from '../permissions/types.js'
import { ruleValueToString } from '../permissions/ruleMatching.js'

export type PermissionPromptRequest = {
  toolName: string
  input: unknown
  decision: PermissionDecision & { behavior: 'ask' }
  resolve: (result: PermissionUserChoice) => void
}

type PermissionOption = {
  label: string
  description: string
  action: 'allow' | 'deny'
  persist: boolean
}

const OPTIONS: PermissionOption[] = [
  { label: '✅ 允许',     description: '允许本次操作',           action: 'allow', persist: false },
  { label: '✅ 始终允许', description: '将此操作加入允许规则',   action: 'allow', persist: true },
  { label: '❌ 拒绝',     description: '拒绝本次操作',           action: 'deny',  persist: false },
  { label: '❌ 始终拒绝', description: '将此操作加入拒绝规则',   action: 'deny',  persist: true },
]

type Props = {
  request: PermissionPromptRequest
  selectedIndex: number
}

export function PermissionPrompt({ request, selectedIndex }: Props) {
  const rulePreview = request.decision.suggestions?.[0]?.rules
    ?.map(ruleValueToString)
    .join(', ')

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>
        🔒 {request.toolName} 需要权限
      </Text>
      <Text> </Text>
      <Text>{request.decision.message}</Text>
      <Text> </Text>
      {OPTIONS.map((opt, i) => (
        <Box key={i}>
          <Text color={i === selectedIndex ? 'cyan' : 'gray'} bold={i === selectedIndex}>
            {i === selectedIndex ? '▸ ' : '  '}
            {opt.label}
          </Text>
          <Text color="gray"> — {opt.description}</Text>
        </Box>
      ))}
      {rulePreview && (
        <>
          <Text> </Text>
          <Text color="gray">规则预览: {rulePreview}</Text>
        </>
      )}
      <Text> </Text>
      <Text color="gray" dimColor>
        ↑↓ 选择  Enter 确认
      </Text>
    </Box>
  )
}

export { OPTIONS as PERMISSION_OPTIONS }
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/PermissionPrompt.tsx
git commit -m "feat(permissions): add PermissionPrompt terminal UI component"
```

---

### Task 8: REPL Integration

**Files:**
- Modify: `src/screens/REPL.tsx`

This is the final integration task. It connects the permission pipeline to the REPL's `canUseTool` callback and renders the `PermissionPrompt` component.

- [ ] **Step 1: Add imports**

At the top of `src/screens/REPL.tsx`, add these imports (after existing imports):

```typescript
import { initPermissions, checkToolPermission, applyPermissionUpdate, persistPermissionUpdate } from '../permissions/index.js'
import { PermissionPrompt, PERMISSION_OPTIONS, type PermissionPromptRequest } from '../components/PermissionPrompt.js'
import type { PermissionUserChoice } from '../permissions/types.js'
import { getAppState, setAppState } from '../state/AppState.js'
import { findTool } from '../tools/index.js'
```

Note: `getAppState` and `setAppState` are likely already imported via other paths. Check that there's no duplicate. If `findTool` is already imported, skip that line.

- [ ] **Step 2: Update the PermissionRequest type**

Replace the existing `PermissionRequest` type (around line 47-51) with:

```typescript
type PermissionRequest = PermissionPromptRequest
```

Remove the old `PermissionRequest` type definition entirely.

- [ ] **Step 3: Add permissionSelectedIndex state**

After `const [selectedIndex, setSelectedIndex] = useState(0)` (line 107), add:

```typescript
const [permSelectedIndex, setPermSelectedIndex] = useState(0)
```

- [ ] **Step 4: Rewrite canUseTool**

Replace the `canUseTool` callback (lines 137-145) with:

```typescript
  const canUseTool = useCallback<CanUseTool>(
    async (name, input) => {
      // Plan mode blocks writes (existing behavior preserved)
      if (isPlanModeRef.current && WRITE_TOOLS.has(name)) {
        return 'deny'
      }

      const appState = getAppState()
      const tool = findTool(name, allTools)
      if (!tool) return 'allow'

      // Build content string for rule matching (Investment-specific)
      let contentString: string | undefined
      const inp = input as Record<string, unknown>
      if (name === 'Investment' && inp.function && inp.action) {
        contentString = `${inp.function}:${inp.action}`
      }

      const decision = checkToolPermission(
        tool,
        inp,
        appState.permissionContext,
        contentString,
      )

      if (decision.behavior === 'allow') return 'allow'
      if (decision.behavior === 'deny') return 'deny'

      // behavior === 'ask' → show permission prompt
      const userChoice = await new Promise<PermissionUserChoice>((resolve) => {
        setPermSelectedIndex(0)
        setPermissionRequest({
          toolName: name,
          input,
          decision,
          resolve,
        })
      })

      // Handle persistence
      if (userChoice.persist && decision.suggestions?.length) {
        const baseSuggestion = decision.suggestions[0]!
        const update = {
          ...baseSuggestion,
          behavior: userChoice.action as 'allow' | 'deny',
        }
        persistPermissionUpdate(update)
        setAppState(prev => ({
          ...prev,
          permissionContext: applyPermissionUpdate(prev.permissionContext, update),
        }))
      }

      setPermissionRequest(null)
      return userChoice.action
    },
    [allTools],
  )
```

- [ ] **Step 5: Update keyboard handler for permission prompt**

Replace the existing permission request keyboard section (around lines 571-578):

```typescript
      // 权限确认
      if (permissionRequest) {
        if (input === 'y' || key.return) {
          permissionRequest.resolve('allow')
        } else if (input === 'n' || key.escape) {
          permissionRequest.resolve('deny')
        }
        return
      }
```

With the new 4-option navigation:

```typescript
      // 权限确认 (4-option prompt)
      if (permissionRequest) {
        if (key.upArrow) {
          setPermSelectedIndex(i => Math.max(0, i - 1))
        } else if (key.downArrow) {
          setPermSelectedIndex(i => Math.min(PERMISSION_OPTIONS.length - 1, i + 1))
        } else if (key.return) {
          const opt = PERMISSION_OPTIONS[permSelectedIndex]!
          permissionRequest.resolve({
            action: opt.action,
            persist: opt.persist,
            destination: opt.persist ? 'projectSettings' : undefined,
          })
        } else if (key.escape) {
          permissionRequest.resolve({ action: 'deny', persist: false })
        }
        return
      }
```

- [ ] **Step 6: Update permission prompt rendering**

Replace the existing permission prompt render block (around lines 644-659):

```tsx
      {permissionRequest && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow" bold>
            Allow tool use?
          </Text>
          ...
        </Box>
      )}
```

With:

```tsx
      {permissionRequest && (
        <PermissionPrompt
          request={permissionRequest}
          selectedIndex={permSelectedIndex}
        />
      )}
```

- [ ] **Step 7: Add initPermissions to startup**

In the startup `useEffect` (around line 423-448), add `initPermissions()` call. After `initObservability()` (line 427), add:

```typescript
      initPermissions()
```

- [ ] **Step 8: Verify it compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 9: Run all tests**

Run: `npm test`
Expected: All tests pass (existing + new permission tests)

- [ ] **Step 10: Commit**

```bash
git add src/screens/REPL.tsx
git commit -m "feat(permissions): integrate permission pipeline into REPL with 4-option prompt"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Test manually**

Start the app with `npm run dev` and test the following scenarios:

1. **Read operation** — ask for stock price → should execute without asking
2. **Write operation** — add to portfolio → should show 4-option permission prompt
3. **Always allow** — choose "始终允许" → check `.pi/settings.json` has the allow rule
4. **Subsequent write** — repeat same operation → should execute without asking (rule applied)
5. **Always deny** — for a different operation, choose "始终拒绝" → should be blocked next time

- [ ] **Step 4: Final commit (if any manual fixes needed)**

```bash
git add -A
git commit -m "fix(permissions): manual testing adjustments"
```
