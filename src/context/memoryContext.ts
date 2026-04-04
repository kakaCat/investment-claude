import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export async function loadMemory(cwd: string): Promise<string | null> {
  // 对标 Claude Code 的 memory 路径：~/.claude/projects/{encoded-path}/memory/MEMORY.md
  const encoded = cwd.replace(/\//g, '-')
  const memoryPath = join(homedir(), '.claude', 'projects', encoded, 'memory', 'MEMORY.md')

  try {
    if (!existsSync(memoryPath)) return null
    const content = readFileSync(memoryPath, 'utf8').trim()
    return content ? `# Memory\n\n${content}` : null
  } catch {
    return null
  }
}
