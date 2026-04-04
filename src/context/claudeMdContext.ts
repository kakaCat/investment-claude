import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'

function readFile(filePath: string): string | null {
  try {
    return existsSync(filePath) ? readFileSync(filePath, 'utf8').trim() : null
  } catch {
    return null
  }
}

export async function loadClaudeMd(cwd: string): Promise<string | null> {
  const home = homedir()
  const parts: string[] = []

  // 从 cwd 向上遍历到 home，收集所有 CLAUDE.md
  let dir = cwd
  while (dir !== home && dir !== dirname(dir)) {
    const candidate = join(dir, 'CLAUDE.md')
    const content = readFile(candidate)
    if (content) parts.push(`# From: ${candidate}\n\n${content}`)
    dir = dirname(dir)
  }

  // 全局配置
  const globalConfig = readFile(join(home, '.claude', 'CLAUDE.md'))
  if (globalConfig) parts.push(`# From: ~/.claude/CLAUDE.md\n\n${globalConfig}`)

  return parts.length > 0 ? parts.join('\n\n') : null
}
