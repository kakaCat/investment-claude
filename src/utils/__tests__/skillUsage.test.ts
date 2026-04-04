import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { homedir, tmpdir } from 'os'
import { join } from 'path'

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os')
  return {
    ...actual,
    homedir: vi.fn(),
  }
})

import { readUsage, recordUsage } from '../skillUsage.js'

const homedirMock = vi.mocked(homedir)

let homeDir: string

function getUsagePath(): string {
  return join(homeDir, '.claude', 'skill-usage.json')
}

beforeEach(async () => {
  vi.clearAllMocks()
  homeDir = await mkdtemp(join(tmpdir(), 'skill-usage-test-'))
  homedirMock.mockReturnValue(homeDir)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(homeDir, { recursive: true, force: true })
})

describe('readUsage', () => {
  it('returns an empty object when the usage file does not exist', async () => {
    await expect(readUsage()).resolves.toEqual({})
  })

  it('returns an empty object when the usage file contains invalid JSON', async () => {
    await mkdir(join(homeDir, '.claude'), { recursive: true })
    await writeFile(getUsagePath(), '{ invalid json', 'utf-8')

    await expect(readUsage()).resolves.toEqual({})
  })
})

describe('recordUsage', () => {
  it('creates the parent directory and writes the first usage record', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000)

    await recordUsage('planner')

    const content = await readFile(getUsagePath(), 'utf-8')
    expect(JSON.parse(content)).toEqual({
      planner: {
        count: 1,
        lastUsed: 1710000000000,
      },
    })
  })

  it('increments count and updates lastUsed for an existing skill', async () => {
    await mkdir(join(homeDir, '.claude'), { recursive: true })
    await writeFile(
      getUsagePath(),
      JSON.stringify(
        {
          planner: {
            count: 2,
            lastUsed: 1700000000000,
          },
        },
        null,
        2,
      ),
      'utf-8',
    )
    vi.spyOn(Date, 'now').mockReturnValue(1720000000000)

    await recordUsage('planner')

    const content = await readFile(getUsagePath(), 'utf-8')
    expect(JSON.parse(content)).toEqual({
      planner: {
        count: 3,
        lastUsed: 1720000000000,
      },
    })
  })
})
