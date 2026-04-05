// src/memdir/backends/LocalFSBackend.ts
import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { homedir } from 'os'
import type { MemoryBackend } from './MemoryBackend.js'
import type { MemoryFileMeta } from '../Memory.js'

function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, content: raw }
  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':')
    if (sep === -1) continue
    const key = line.slice(0, sep).trim()
    const value = line.slice(sep + 1).trim()
    data[key] = value
  }
  return { data, content: match[2] }
}

export class LocalFSBackend implements MemoryBackend {
  name = 'localfs'
  private memoryDir: string

  constructor(cwd: string) {
    const encoded = cwd.replace(/\//g, '-')
    this.memoryDir = join(homedir(), '.claude', 'projects', encoded, 'memory')
  }

  async scanFiles(signal: AbortSignal): Promise<MemoryFileMeta[]> {
    let entries: string[]
    try {
      entries = await readdir(this.memoryDir)
    } catch {
      return []
    }

    const results: MemoryFileMeta[] = []
    for (const entry of entries) {
      if (signal.aborted) break
      if (!entry.endsWith('.md') || entry === 'MEMORY.md') continue
      if (entry.startsWith('.')) continue

      const filePath = join(this.memoryDir, entry)
      try {
        const [raw, stats] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)])
        const { data } = parseFrontmatter(raw)
        if (!data.name || !data.description) continue
        results.push({
          filePath,
          name: data.name,
          description: data.description,
          type: data.type ?? 'user',
          searchHint: data.searchHint,
          mtimeMs: stats.mtimeMs,
        })
      } catch {
        // skip unreadable files
      }
    }
    return results
  }

  async readFile(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8')
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
  }
}
