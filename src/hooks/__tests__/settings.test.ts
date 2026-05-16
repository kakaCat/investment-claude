import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import { homedir } from 'os'

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}))

vi.mock('os', () => ({
  homedir: vi.fn(),
}))

const readFileSyncMock = vi.mocked(readFileSync)
const homedirMock = vi.mocked(homedir)

describe('loadHooksSettings', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    homedirMock.mockReturnValue('/home/tester')
    vi.spyOn(process, 'cwd').mockReturnValue('/project')
  })

  it('merges hooks from global, project, and local settings in source order', async () => {
    readFileSyncMock.mockImplementation((path) => {
      const filePath = String(path)

      if (filePath === '/home/tester/.pi/settings.json') {
        return JSON.stringify({
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [{ type: 'command', command: 'echo global', timeout: 10 }],
              },
            ],
          },
        })
      }

      if (filePath === '/project/.pi/settings.json') {
        return JSON.stringify({
          hooks: {
            PreToolUse: [
              {
                matcher: 'Edit',
                hooks: [{ type: 'http', url: 'https://example.com/project' }],
              },
            ],
            Stop: [
              {
                hooks: [{ type: 'prompt', prompt: 'project stop' }],
              },
            ],
          },
          theme: 'ignored',
        })
      }

      if (filePath === '/project/.pi/settings.local.json') {
        return JSON.stringify({
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [{ type: 'command', command: 'echo local' }],
              },
            ],
          },
        })
      }

      throw new Error(`ENOENT: ${filePath}`)
    })

    const { loadHooksSettings } = await import('../settings.js')

    expect(loadHooksSettings()).toEqual({
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'echo global', timeout: 10 }],
        },
        {
          matcher: 'Edit',
          hooks: [{ type: 'http', url: 'https://example.com/project' }],
        },
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'echo local' }],
        },
      ],
      Stop: [
        {
          hooks: [{ type: 'prompt', prompt: 'project stop' }],
        },
      ],
    })
  })

  it('silently skips missing files and malformed JSON', async () => {
    readFileSyncMock.mockImplementation((path) => {
      const filePath = String(path)

      if (filePath === '/home/tester/.pi/settings.json') {
        throw new Error(`ENOENT: ${filePath}`)
      }

      if (filePath === '/project/.pi/settings.json') {
        return '{ invalid json'
      }

      if (filePath === '/project/.pi/settings.local.json') {
        return JSON.stringify({
          hooks: {
            Stop: [
              {
                hooks: [{ type: 'command', command: 'echo ok' }],
              },
            ],
          },
        })
      }

      throw new Error(`ENOENT: ${filePath}`)
    })

    const { loadHooksSettings } = await import('../settings.js')

    expect(loadHooksSettings()).toEqual({
      Stop: [
        {
          hooks: [{ type: 'command', command: 'echo ok' }],
        },
      ],
    })
  })

  it('drops matchers whose hooks are missing a valid type', async () => {
    readFileSyncMock.mockImplementation((path) => {
      const filePath = String(path)

      if (filePath === '/home/tester/.pi/settings.json') {
        return JSON.stringify({
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [{ command: 'echo missing type' }],
              },
              {
                matcher: 'Edit',
                hooks: [{ type: 'function' }],
              },
            ],
            SessionStart: [
              {
                matcher: 123,
                hooks: [{ type: 'command', command: 'echo invalid matcher' }],
              },
            ],
          },
        })
      }

      throw new Error(`ENOENT: ${filePath}`)
    })

    const { loadHooksSettings } = await import('../settings.js')

    expect(loadHooksSettings()).toEqual({
      PreToolUse: [
        {
          matcher: 'Edit',
          hooks: [{ type: 'function' }],
        },
      ],
    })
  })
})
