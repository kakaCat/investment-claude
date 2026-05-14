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

  it('Step 1: deny rule with content does not block non-matching action', () => {
    const ctx: ToolPermissionContext = {
      ...createEmptyPermissionContext(),
      denyRules: { userSettings: ['Investment(manage_portfolio:remove)'], projectSettings: [], session: [] },
    }
    const tool = makeTool({ name: 'Investment' })
    const result = checkToolPermission(tool, { function: 'manage_portfolio', action: 'add' }, ctx, 'manage_portfolio:add')
    // Different action should not be denied by the 'remove' deny rule
    expect(result.behavior).toBe('allow') // falls through to default allow since tool is non-readOnly
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

  it('Step 5: non-readonly tool defaults to allow (opt-in write confirmation)', () => {
    const result = checkToolPermission(
      makeTool({ isReadOnly: false }),
      {},
      createEmptyPermissionContext(),
    )
    expect(result.behavior).toBe('allow')
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
