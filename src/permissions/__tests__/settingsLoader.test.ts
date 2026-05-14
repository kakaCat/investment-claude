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
