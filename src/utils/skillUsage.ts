import { mkdir, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export type SkillUsageRecord = {
  [skillName: string]: {
    count: number
    lastUsed: number
  }
}

function getSkillUsageDir(): string {
  return join(homedir(), '.claude')
}

function getSkillUsagePath(): string {
  return join(getSkillUsageDir(), 'skill-usage.json')
}

export async function readUsage(): Promise<SkillUsageRecord> {
  try {
    const content = await readFile(getSkillUsagePath(), 'utf-8')
    const parsed: unknown = JSON.parse(content)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed as SkillUsageRecord
  } catch {
    return {}
  }
}

export async function recordUsage(skillName: string): Promise<void> {
  const usage = await readUsage()
  const current = usage[skillName]

  usage[skillName] = {
    count: (current?.count ?? 0) + 1,
    lastUsed: Date.now(),
  }

  await mkdir(getSkillUsageDir(), { recursive: true })
  await writeFile(getSkillUsagePath(), JSON.stringify(usage, null, 2), 'utf-8')
}
