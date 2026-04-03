import { readdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'

export type Skill = {
  name: string
  description: string
  filePath: string
}

/** Returns directories that may contain skill .md files, filtered to those that exist */
export function getSkillDirs(cwd: string): string[] {
  const candidates = [
    join(homedir(), '.claude', 'commands'),
    join(cwd, '.claude', 'commands'),
  ]
  return candidates.filter(d => existsSync(d))
}

/** List all skills from all skill directories. Later dirs override earlier ones by name. */
export async function listSkills(cwd: string): Promise<Skill[]> {
  const dirs = getSkillDirs(cwd)
  const byName = new Map<string, Skill>()
  for (const dir of dirs) {
    const files = await readdir(dir).catch(() => [] as string[])
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const name = basename(file, '.md')
      const filePath = join(dir, file)
      const content = await readFile(filePath, 'utf-8').catch(() => '')
      const description = extractDescription(content)
      byName.set(name, { name, description, filePath })
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/** Find a skill by name (strips leading slash). Returns null if not found. */
export async function findSkill(name: string, cwd: string): Promise<Skill | null> {
  const normalized = name.startsWith('/') ? name.slice(1) : name
  const skills = await listSkills(cwd)
  return skills.find(s => s.name.toLowerCase() === normalized.toLowerCase()) ?? null
}

/** Load and return the raw content of a skill file */
export async function loadSkillContent(skill: Skill): Promise<string> {
  return readFile(skill.filePath, 'utf-8')
}

/** Extract a short description from skill content: frontmatter description, first heading, or first non-empty line */
function extractDescription(content: string): string {
  // Try to extract description from YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1]!
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
    if (descMatch) return descMatch[1]!.trim()
  }
  // Strip YAML frontmatter and look for first heading
  const stripped = content.replace(/^---\n[\s\S]*?\n---\n/, '')
  const headingMatch = stripped.match(/^#{1,3}\s+(.+)/m)
  if (headingMatch) return headingMatch[1]!.trim()
  const firstLine = stripped.split('\n').find(l => l.trim())
  return firstLine?.trim().slice(0, 100) ?? ''
}
