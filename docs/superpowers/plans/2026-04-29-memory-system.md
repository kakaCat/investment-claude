# Memory System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static MEMORY.md injection with a MemorySearchTool-driven memory system where the model discovers and loads memories on demand, with a pluggable backend and tree-typed memory categories.

**Architecture:** `memoryContext.ts` is deleted entirely. A static `MEMORY_SYSTEM_INSTRUCTIONS` constant tells the model to use `memory_search` tool (same pattern as `tool_search`). The tool is backed by `LocalFSBackend` (CC-compatible path), scans frontmatter, scores results, and includes staleness warnings.

**Tech Stack:** TypeScript, Vitest, `gray-matter` (frontmatter parse), `fs/promises`, existing `buildTool` pattern from `src/Tool.ts`

---

## File Map

**New files:**
- `src/memdir/Memory.ts` — `MemoryFileMeta`, `Memory`, `MemoryTypeHandler` interfaces
- `src/memdir/types/user.ts` — built-in handler, weight=3, ageWarning=30d
- `src/memdir/types/feedback.ts` — built-in handler, weight=4, ageWarning=90d
- `src/memdir/types/project.ts` — built-in handler, weight=5, ageWarning=7d
- `src/memdir/types/reference.ts` — built-in handler, weight=2, ageWarning=180d
- `src/memdir/typeRegistry.ts` — `MemoryTypeRegistry` class (tree queries, custom types)
- `src/memdir/backends/MemoryBackend.ts` — `MemoryBackend` interface
- `src/memdir/backends/LocalFSBackend.ts` — default CC-compatible fs backend
- `src/memdir/memoryScan.ts` — `scanMemoryFiles()`, `scoreMemoryForQuery()`
- `src/memdir/memoryAge.ts` — `getMemoryAge()`, `buildMemoryAgeWarning()`
- `src/tools/MemorySearchTool/MemorySearchTool.tsx` — registered tool
- `src/memdir/__tests__/typeRegistry.test.ts`
- `src/memdir/__tests__/memoryScan.test.ts`
- `src/memdir/__tests__/memoryAge.test.ts`
- `src/tools/MemorySearchTool/__tests__/MemorySearchTool.test.ts`

**Modified files:**
- `src/constants/promptSections.ts` — add `MEMORY_SYSTEM_INSTRUCTIONS`
- `src/constants/prompts.ts` — replace `loadMemory` with static constant
- `src/tools/index.ts` — import + register `MemorySearchTool`

**Deleted files:**
- `src/context/memoryContext.ts`
- `src/context/__tests__/memoryContext.test.ts`

---

### Task 1: Memory interfaces

**Files:**
- Create: `src/memdir/Memory.ts`

- [ ] **Step 1: Write the file**

```typescript
// src/memdir/Memory.ts

/** Frontmatter-parsed metadata (no content, used for scan/search) */
export interface MemoryFileMeta {
  filePath: string
  name: string
  description: string
  /** Leaf type name only, e.g. "中学数学" — registry resolves tree position */
  type: string
  searchHint?: string
  /** File mtime in ms */
  mtimeMs: number
}

/** Full memory object including content and type handler */
export interface Memory extends MemoryFileMeta {
  content: string
  handler: MemoryTypeHandler
}

export interface MemoryTypeHandler {
  name: string
  description: string
  /** Base weight for keyword scoring in MemorySearchTool */
  defaultWeight: number
  /** Days before staleness warning is added to search results */
  ageWarningDays: number
  formatForInjection(memory: Memory): string
}

export interface CustomTypeDefinition {
  name: string
  parent: string | null
  description: string
  defaultWeight?: number
  ageWarningDays?: number
  searchHint?: string
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors related to `src/memdir/Memory.ts`

- [ ] **Step 3: Commit**

```bash
git add src/memdir/Memory.ts
git commit -m "feat(memdir): add Memory interfaces"
```

---

### Task 2: Built-in type handlers

**Files:**
- Create: `src/memdir/types/user.ts`
- Create: `src/memdir/types/feedback.ts`
- Create: `src/memdir/types/project.ts`
- Create: `src/memdir/types/reference.ts`

- [ ] **Step 1: Write user.ts**

```typescript
// src/memdir/types/user.ts
import type { Memory, MemoryTypeHandler } from '../Memory.js'

export const userTypeHandler: MemoryTypeHandler = {
  name: 'user',
  description: 'Information about the user — role, goals, preferences, knowledge',
  defaultWeight: 3,
  ageWarningDays: 30,
  formatForInjection(memory: Memory): string {
    return `## [user] ${memory.name}\n\n${memory.content}`
  },
}
```

- [ ] **Step 2: Write feedback.ts**

```typescript
// src/memdir/types/feedback.ts
import type { Memory, MemoryTypeHandler } from '../Memory.js'

export const feedbackTypeHandler: MemoryTypeHandler = {
  name: 'feedback',
  description: 'Guidance from the user about how to approach work — corrections and confirmations',
  defaultWeight: 4,
  ageWarningDays: 90,
  formatForInjection(memory: Memory): string {
    return `## [feedback] ${memory.name}\n\n${memory.content}`
  },
}
```

- [ ] **Step 3: Write project.ts**

```typescript
// src/memdir/types/project.ts
import type { Memory, MemoryTypeHandler } from '../Memory.js'

export const projectTypeHandler: MemoryTypeHandler = {
  name: 'project',
  description: 'Ongoing work context — goals, decisions, deadlines, bugs',
  defaultWeight: 5,
  ageWarningDays: 7,
  formatForInjection(memory: Memory): string {
    return `## [project] ${memory.name}\n\n${memory.content}`
  },
}
```

- [ ] **Step 4: Write reference.ts**

```typescript
// src/memdir/types/reference.ts
import type { Memory, MemoryTypeHandler } from '../Memory.js'

export const referenceTypeHandler: MemoryTypeHandler = {
  name: 'reference',
  description: 'Pointers to external systems and resources',
  defaultWeight: 2,
  ageWarningDays: 180,
  formatForInjection(memory: Memory): string {
    return `## [reference] ${memory.name}\n\n${memory.content}`
  },
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/memdir/types/
git commit -m "feat(memdir): add 4 built-in type handlers"
```

---

### Task 3: MemoryTypeRegistry

**Files:**
- Create: `src/memdir/typeRegistry.ts`
- Create: `src/memdir/__tests__/typeRegistry.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/memdir/__tests__/typeRegistry.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryTypeRegistry } from '../typeRegistry.js'

describe('MemoryTypeRegistry', () => {
  let registry: MemoryTypeRegistry

  beforeEach(() => {
    registry = new MemoryTypeRegistry()
  })

  it('returns built-in handler for "user"', () => {
    const h = registry.getHandler('user')
    expect(h.name).toBe('user')
    expect(h.defaultWeight).toBe(3)
  })

  it('returns built-in handler for "feedback"', () => {
    const h = registry.getHandler('feedback')
    expect(h.name).toBe('feedback')
    expect(h.defaultWeight).toBe(4)
  })

  it('returns built-in handler for "project"', () => {
    const h = registry.getHandler('project')
    expect(h.defaultWeight).toBe(5)
  })

  it('returns built-in handler for "reference"', () => {
    const h = registry.getHandler('reference')
    expect(h.defaultWeight).toBe(2)
  })

  it('falls back to user handler for unknown type', () => {
    const h = registry.getHandler('unknown-type')
    expect(h.name).toBe('user')
  })

  it('getSubtree returns just itself when no children', () => {
    const subtree = registry.getSubtree('user')
    expect(subtree).toEqual(['user'])
  })

  it('registerCustomType and getHandler finds it', () => {
    registry.registerCustomType({
      name: '数学',
      parent: null,
      description: '数学相关记忆',
    })
    const h = registry.getHandler('数学')
    expect(h.name).toBe('数学')
  })

  it('getSubtree returns parent and all descendants', () => {
    registry.registerCustomType({ name: '数学', parent: null, description: '' })
    registry.registerCustomType({ name: '中学数学', parent: '数学', description: '' })
    registry.registerCustomType({ name: '高中数学', parent: '数学', description: '' })
    const subtree = registry.getSubtree('数学')
    expect(subtree).toContain('数学')
    expect(subtree).toContain('中学数学')
    expect(subtree).toContain('高中数学')
    expect(subtree).toHaveLength(3)
  })

  it('listAll returns all type names including built-ins', () => {
    const all = registry.listAll()
    expect(all).toContain('user')
    expect(all).toContain('feedback')
    expect(all).toContain('project')
    expect(all).toContain('reference')
  })

  it('getTree returns structured tree with built-ins as roots', () => {
    const tree = registry.getTree()
    const names = tree.map((n) => n.name)
    expect(names).toContain('user')
    expect(names).toContain('feedback')
    expect(names).toContain('project')
    expect(names).toContain('reference')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/memdir/__tests__/typeRegistry.test.ts`
Expected: FAIL — "Cannot find module '../typeRegistry.js'"

- [ ] **Step 3: Write MemoryTypeRegistry**

```typescript
// src/memdir/typeRegistry.ts
import type { CustomTypeDefinition, MemoryTypeHandler } from './Memory.js'
import { userTypeHandler } from './types/user.js'
import { feedbackTypeHandler } from './types/feedback.js'
import { projectTypeHandler } from './types/project.js'
import { referenceTypeHandler } from './types/reference.js'

interface TypeNode {
  name: string
  handler: MemoryTypeHandler
  parent: string | null
  children: string[]
}

export interface TypeTreeEntry {
  name: string
  description: string
  parent: string | null
  children: string[]
}

export class MemoryTypeRegistry {
  private nodes = new Map<string, TypeNode>()

  constructor() {
    // Register 4 built-in types as root nodes
    for (const h of [userTypeHandler, feedbackTypeHandler, projectTypeHandler, referenceTypeHandler]) {
      this.nodes.set(h.name, { name: h.name, handler: h, parent: null, children: [] })
    }
  }

  getHandler(typeName: string): MemoryTypeHandler {
    return this.nodes.get(typeName)?.handler ?? userTypeHandler
  }

  /** Returns typeName + all descendant type names */
  getSubtree(typeName: string): string[] {
    const node = this.nodes.get(typeName)
    if (!node) return [typeName]
    const result: string[] = [typeName]
    for (const child of node.children) {
      result.push(...this.getSubtree(child))
    }
    return result
  }

  listAll(): string[] {
    return Array.from(this.nodes.keys())
  }

  /** Returns flat list of all types for display (tree structure via parent/children) */
  getTree(): TypeTreeEntry[] {
    return Array.from(this.nodes.values()).map((n) => ({
      name: n.name,
      description: n.handler.description,
      parent: n.parent,
      children: n.children,
    }))
  }

  registerCustomType(def: CustomTypeDefinition): void {
    const handler: MemoryTypeHandler = {
      name: def.name,
      description: def.description,
      defaultWeight: def.defaultWeight ?? 3,
      ageWarningDays: def.ageWarningDays ?? 30,
      formatForInjection(memory) {
        return `## [${def.name}] ${memory.name}\n\n${memory.content}`
      },
    }
    this.nodes.set(def.name, { name: def.name, handler, parent: def.parent ?? null, children: [] })
    // Register as child of parent
    if (def.parent) {
      const parent = this.nodes.get(def.parent)
      if (parent && !parent.children.includes(def.name)) {
        parent.children.push(def.name)
      }
    }
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/memdir/__tests__/typeRegistry.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/memdir/typeRegistry.ts src/memdir/__tests__/typeRegistry.test.ts
git commit -m "feat(memdir): add MemoryTypeRegistry with tree queries"
```

---

### Task 4: MemoryBackend interface + LocalFSBackend

**Files:**
- Create: `src/memdir/backends/MemoryBackend.ts`
- Create: `src/memdir/backends/LocalFSBackend.ts`

No tests for I/O wrappers — LocalFSBackend is a thin adapter; coverage comes via memoryScan tests.

- [ ] **Step 1: Write MemoryBackend interface**

```typescript
// src/memdir/backends/MemoryBackend.ts
import type { MemoryFileMeta } from '../Memory.js'

export interface MemoryBackend {
  name: string

  /** Returns metadata for all .md files in the memory directory */
  scanFiles(signal: AbortSignal): Promise<MemoryFileMeta[]>

  /** Reads full file content */
  readFile(filePath: string): Promise<string>

  /** Writes file content (creates directories as needed) */
  writeFile(filePath: string, content: string): Promise<void>

  /** Optional: semantic search. Returns null → fall back to keyword scoring */
  semanticSearch?(query: string, topK: number): Promise<MemoryFileMeta[] | null>
}
```

- [ ] **Step 2: Check gray-matter is available**

Run: `node -e "require('gray-matter'); console.log('ok')" 2>/dev/null || echo "missing"`

If missing, install: `npm install gray-matter && npm install --save-dev @types/gray-matter`
Expected: `ok` (it's already a dependency of many tools)

If gray-matter is not available, use a simple inline frontmatter parser:

```typescript
function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { data: {}, content: raw }
  const data: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':')
    if (sep === -1) continue
    const key = line.slice(0, sep).trim()
    const value = line.slice(sep + 1).trim()
    data[key] = value
  }
  return { data, content: match[2] }
}
```

- [ ] **Step 3: Write LocalFSBackend**

```typescript
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
      // Skip .types/ directory files
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
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/memdir/backends/
git commit -m "feat(memdir): add MemoryBackend interface and LocalFSBackend"
```

---

### Task 5: memoryScan — scoring + manifest

**Files:**
- Create: `src/memdir/memoryScan.ts`
- Create: `src/memdir/__tests__/memoryScan.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/memdir/__tests__/memoryScan.test.ts
import { describe, it, expect } from 'vitest'
import { scoreMemoryForQuery, formatMemoryManifest } from '../memoryScan.js'
import type { MemoryFileMeta } from '../Memory.js'

const base: MemoryFileMeta = {
  filePath: '/memory/test.md',
  name: 'test memory',
  description: 'a test memory entry',
  type: 'user',
  mtimeMs: Date.now(),
}

describe('scoreMemoryForQuery', () => {
  it('returns 0 when no terms match', () => {
    expect(scoreMemoryForQuery(base, ['xyz123'], 3)).toBe(0)
  })

  it('name exact match scores highest', () => {
    const score = scoreMemoryForQuery({ ...base, name: 'auth' }, ['auth'], 3)
    expect(score).toBeGreaterThan(10)
  })

  it('name contains scores less than exact match', () => {
    const exact = scoreMemoryForQuery({ ...base, name: 'auth' }, ['auth'], 3)
    const contains = scoreMemoryForQuery({ ...base, name: 'authentication flow' }, ['auth'], 3)
    expect(exact).toBeGreaterThan(contains)
  })

  it('searchHint word boundary match scores 4+weight', () => {
    const score = scoreMemoryForQuery(
      { ...base, searchHint: 'auth login token' },
      ['auth'],
      3,
    )
    // weight(3) + hint word boundary(4) = 7
    expect(score).toBe(7)
  })

  it('description match scores lower than hint match', () => {
    const hint = scoreMemoryForQuery({ ...base, searchHint: 'auth' }, ['auth'], 1)
    const desc = scoreMemoryForQuery({ ...base, description: 'auth related' }, ['auth'], 1)
    expect(hint).toBeGreaterThan(desc)
  })

  it('defaultWeight is added as base score', () => {
    const low = scoreMemoryForQuery({ ...base, name: 'auth' }, ['auth'], 1)
    const high = scoreMemoryForQuery({ ...base, name: 'auth' }, ['auth'], 5)
    expect(high - low).toBe(4) // weight difference
  })
})

describe('formatMemoryManifest', () => {
  it('returns a formatted list of memory entries', () => {
    const metas: MemoryFileMeta[] = [
      { ...base, name: 'Alpha Entry', description: 'first entry', type: 'user' },
      { ...base, name: 'Beta Entry', description: 'second entry', type: 'feedback' },
    ]
    const out = formatMemoryManifest(metas)
    expect(out).toContain('Alpha Entry')
    expect(out).toContain('Beta Entry')
    expect(out).toContain('[user]')
    expect(out).toContain('[feedback]')
  })

  it('returns empty message when no memories', () => {
    const out = formatMemoryManifest([])
    expect(out).toContain('No memories')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/memdir/__tests__/memoryScan.test.ts`
Expected: FAIL — "Cannot find module '../memoryScan.js'"

- [ ] **Step 3: Write memoryScan.ts**

```typescript
// src/memdir/memoryScan.ts
import type { MemoryFileMeta } from './Memory.js'

export function scoreMemoryForQuery(
  meta: MemoryFileMeta,
  terms: string[],
  defaultWeight: number,
): number {
  const name = meta.name.toLowerCase()
  const hint = (meta.searchHint ?? '').toLowerCase()
  const desc = meta.description.toLowerCase()
  let score = 0

  for (const term of terms) {
    if (name === term) {
      score += 10 + defaultWeight
    } else if (name.includes(term)) {
      score += 5 + defaultWeight
    } else if (hint.split(/\W+/).includes(term)) {
      score += 4 + defaultWeight
    } else if (hint.includes(term)) {
      score += 2 + defaultWeight
    } else if (desc.split(/\W+/).includes(term)) {
      score += 2 + defaultWeight
    } else if (desc.includes(term)) {
      score += 1 + defaultWeight
    }
  }
  return score
}

export function formatMemoryManifest(metas: MemoryFileMeta[]): string {
  if (metas.length === 0) return 'No memories found.'
  return metas
    .map((m) => `- **${m.name}** [${m.type}]: ${m.description} — \`${m.filePath}\``)
    .join('\n')
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/memdir/__tests__/memoryScan.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/memdir/memoryScan.ts src/memdir/__tests__/memoryScan.test.ts
git commit -m "feat(memdir): add memoryScan with keyword scoring"
```

---

### Task 6: memoryAge — staleness warnings

**Files:**
- Create: `src/memdir/memoryAge.ts`
- Create: `src/memdir/__tests__/memoryAge.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/memdir/__tests__/memoryAge.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getMemoryAge, buildMemoryAgeWarning } from '../memoryAge.js'
import type { MemoryTypeHandler } from '../Memory.js'

const mockHandler: MemoryTypeHandler = {
  name: 'project',
  description: '',
  defaultWeight: 5,
  ageWarningDays: 7,
  formatForInjection: (m) => m.content,
}

describe('getMemoryAge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns "今天" for same-day mtime', () => {
    const mtime = new Date('2026-04-29T01:00:00Z').getTime()
    expect(getMemoryAge(mtime)).toBe('今天')
  })

  it('returns "昨天" for yesterday mtime', () => {
    const mtime = new Date('2026-04-28T10:00:00Z').getTime()
    expect(getMemoryAge(mtime)).toBe('昨天')
  })

  it('returns "N 天前" for older mtime', () => {
    const mtime = new Date('2026-04-23T10:00:00Z').getTime()
    expect(getMemoryAge(mtime)).toBe('6 天前')
  })
})

describe('buildMemoryAgeWarning', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns null when within ageWarningDays', () => {
    const mtime = new Date('2026-04-25T10:00:00Z').getTime() // 4 days ago
    expect(buildMemoryAgeWarning(mtime, mockHandler)).toBeNull()
  })

  it('returns warning string when older than ageWarningDays', () => {
    const mtime = new Date('2026-04-19T10:00:00Z').getTime() // 10 days ago
    const warning = buildMemoryAgeWarning(mtime, mockHandler)
    expect(warning).not.toBeNull()
    expect(warning).toContain('10 天前')
    expect(warning).toContain('过时')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/memdir/__tests__/memoryAge.test.ts`
Expected: FAIL — "Cannot find module '../memoryAge.js'"

- [ ] **Step 3: Write memoryAge.ts**

```typescript
// src/memdir/memoryAge.ts
import type { MemoryTypeHandler } from './Memory.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getMemoryAge(mtimeMs: number): string {
  const now = Date.now()
  const diffDays = Math.floor((now - mtimeMs) / MS_PER_DAY)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  return `${diffDays} 天前`
}

export function buildMemoryAgeWarning(
  mtimeMs: number,
  handler: MemoryTypeHandler,
): string | null {
  const now = Date.now()
  const diffDays = Math.floor((now - mtimeMs) / MS_PER_DAY)
  if (diffDays <= handler.ageWarningDays) return null
  return `⚠️ 此记忆最后更新于 ${diffDays} 天前，可能已过时（${handler.name} 类型建议 ${handler.ageWarningDays} 天内更新）`
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/memdir/__tests__/memoryAge.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/memdir/memoryAge.ts src/memdir/__tests__/memoryAge.test.ts
git commit -m "feat(memdir): add memoryAge staleness warnings"
```

---

### Task 7: MemorySearchTool

**Files:**
- Create: `src/tools/MemorySearchTool/MemorySearchTool.tsx`
- Create: `src/tools/MemorySearchTool/__tests__/MemorySearchTool.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/tools/MemorySearchTool/__tests__/MemorySearchTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../memdir/backends/LocalFSBackend.js', () => ({
  LocalFSBackend: vi.fn().mockImplementation(() => ({
    scanFiles: vi.fn().mockResolvedValue([
      {
        filePath: '/memory/feedback_testing.md',
        name: 'feedback_testing',
        description: 'Do not mock the database',
        type: 'feedback',
        searchHint: 'database mock test',
        mtimeMs: Date.now(),
      },
      {
        filePath: '/memory/user_role.md',
        name: 'user_role',
        description: 'User is a data scientist',
        type: 'user',
        searchHint: 'data science ML',
        mtimeMs: Date.now(),
      },
    ]),
    readFile: vi.fn().mockResolvedValue('---\nname: feedback_testing\ndescription: test\ntype: feedback\n---\n\nDo not mock the database.'),
  })),
}))

import { MemorySearchTool } from '../MemorySearchTool.js'

const ctx = {
  cwd: '/test/project',
  tools: [],
  abortController: new AbortController(),
}

describe('MemorySearchTool', () => {
  it('has correct name', () => {
    expect(MemorySearchTool.name).toBe('memory_search')
  })

  it('search: returns matching memories', async () => {
    const result = await MemorySearchTool.call({ query: 'search:database' }, ctx)
    expect(result).toContain('feedback_testing')
    expect(result).toContain('database')
  })

  it('type:feedback lists feedback memories', async () => {
    const result = await MemorySearchTool.call({ query: 'type:feedback' }, ctx)
    expect(result).toContain('feedback_testing')
    expect(result).not.toContain('user_role')
  })

  it('type:user lists user memories', async () => {
    const result = await MemorySearchTool.call({ query: 'type:user' }, ctx)
    expect(result).toContain('user_role')
    expect(result).not.toContain('feedback_testing')
  })

  it('select:<filename> reads full file content', async () => {
    const result = await MemorySearchTool.call({ query: 'select:feedback_testing.md' }, ctx)
    expect(result).toContain('Do not mock the database')
  })

  it('types query returns type tree', async () => {
    const result = await MemorySearchTool.call({ query: 'types' }, ctx)
    expect(result).toContain('user')
    expect(result).toContain('feedback')
    expect(result).toContain('project')
    expect(result).toContain('reference')
  })

  it('returns no match message when no results', async () => {
    const result = await MemorySearchTool.call({ query: 'search:xyzzy99999' }, ctx)
    expect(result).toContain('No memories')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/tools/MemorySearchTool/__tests__/MemorySearchTool.test.ts`
Expected: FAIL — "Cannot find module '../MemorySearchTool.js'"

- [ ] **Step 3: Write MemorySearchTool.tsx**

```tsx
// src/tools/MemorySearchTool/MemorySearchTool.tsx
import React from 'react'
import { buildTool } from '../../Tool.js'
import { LocalFSBackend } from '../../memdir/backends/LocalFSBackend.js'
import { MemoryTypeRegistry } from '../../memdir/typeRegistry.js'
import { scoreMemoryForQuery, formatMemoryManifest } from '../../memdir/memoryScan.js'
import { buildMemoryAgeWarning } from '../../memdir/memoryAge.js'
import type { MemoryFileMeta } from '../../memdir/Memory.js'

export const MemorySearchTool = buildTool({
  name: 'memory_search',
  description:
    'Search or browse the persistent memory system. Use "types" to see all memory type categories, "type:<name>" to list memories of a type, "search:<keywords>" to find relevant memories, "select:<filename>" to read a specific memory file.',
  searchHint: 'memory recall remember past context history notes',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          '"types" | "type:<typeName>" | "search:<keywords>" | "select:<filename>"',
      },
    },
    required: ['query'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <span>memory_search({JSON.stringify(input)})</span>
  ),
  renderToolResult: (result) => <span>{String(result)}</span>,

  async call(input, context) {
    const { query } = input as { query: string }
    const registry = new MemoryTypeRegistry()
    const backend = new LocalFSBackend(context.cwd)
    const signal = context.abortController?.signal ?? new AbortController().signal

    // "types" — show full type tree
    if (query.trim() === 'types') {
      const tree = registry.getTree()
      const roots = tree.filter((n) => n.parent === null)
      function renderNode(name: string, indent = 0): string {
        const node = tree.find((n) => n.name === name)!
        const prefix = '  '.repeat(indent) + (indent > 0 ? '├── ' : '')
        const lines = [`${prefix}**${name}** — ${node.description}`]
        for (const child of node.children) {
          lines.push(renderNode(child, indent + 1))
        }
        return lines.join('\n')
      }
      return roots.map((r) => renderNode(r.name)).join('\n')
    }

    // "type:<name>" — list memories of a type (and subtypes)
    const typeMatch = query.match(/^type:(.+)$/i)
    if (typeMatch) {
      const typeName = typeMatch[1].trim()
      const subtree = registry.getSubtree(typeName)
      const metas = await backend.scanFiles(signal)
      const filtered = metas.filter((m) => subtree.includes(m.type))
      if (filtered.length === 0) return `No memories found for type "${typeName}".`
      return filtered
        .map((m) => {
          const handler = registry.getHandler(m.type)
          const ageWarn = buildMemoryAgeWarning(m.mtimeMs, handler)
          const line = `- **${m.name}** [${m.type}]: ${m.description} — \`${m.filePath}\``
          return ageWarn ? `${line}\n  ${ageWarn}` : line
        })
        .join('\n')
    }

    // "select:<filename>" — read full file
    const selectMatch = query.match(/^select:(.+)$/i)
    if (selectMatch) {
      const filename = selectMatch[1].trim()
      const metas = await backend.scanFiles(signal)
      const found = metas.find(
        (m) => m.filePath.endsWith(filename) || m.filePath.endsWith(`/${filename}`),
      )
      if (!found) return `No memory file matching "${filename}" found.`
      const content = await backend.readFile(found.filePath)
      const handler = registry.getHandler(found.type)
      const ageWarn = buildMemoryAgeWarning(found.mtimeMs, handler)
      return ageWarn ? `${content}\n\n${ageWarn}` : content
    }

    // "search:<keywords>" — keyword scoring
    const searchMatch = query.match(/^search:(.+)$/i)
    const keywords = searchMatch ? searchMatch[1] : query
    const terms = keywords.toLowerCase().split(/\s+/).filter(Boolean)
    const metas = await backend.scanFiles(signal)

    const scored = metas
      .map((m): { meta: MemoryFileMeta; score: number } => {
        const handler = registry.getHandler(m.type)
        return { meta: m, score: scoreMemoryForQuery(m, terms, handler.defaultWeight) }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    if (scored.length === 0) return `No memories matched '${keywords}'.`

    const lines = await Promise.all(
      scored.map(async ({ meta }) => {
        const handler = registry.getHandler(meta.type)
        const content = await backend.readFile(meta.filePath)
        const ageWarn = buildMemoryAgeWarning(meta.mtimeMs, handler)
        return `### ${meta.name} [${meta.type}]\n${content}${ageWarn ? `\n\n${ageWarn}` : ''}`
      }),
    )
    return lines.join('\n\n---\n\n')
  },
})
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/tools/MemorySearchTool/__tests__/MemorySearchTool.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/tools/MemorySearchTool/
git commit -m "feat(tools): add MemorySearchTool"
```

---

### Task 8: Wire up — register tool + static system prompt

**Files:**
- Modify: `src/tools/index.ts`
- Modify: `src/constants/promptSections.ts`
- Modify: `src/constants/prompts.ts`
- Delete: `src/context/memoryContext.ts`
- Delete: `src/context/__tests__/memoryContext.test.ts`

- [ ] **Step 1: Register MemorySearchTool in index.ts**

In `src/tools/index.ts`, add import after the ToolSearchTool import:

```typescript
import { MemorySearchTool } from './MemorySearchTool/MemorySearchTool.js'
```

Add `MemorySearchTool` to the `BUILTIN_TOOLS` array right after `ToolSearchTool`:

```typescript
  ToolSearchTool,
  MemorySearchTool,
```

- [ ] **Step 2: Add MEMORY_SYSTEM_INSTRUCTIONS to promptSections.ts**

Append to `src/constants/promptSections.ts`:

```typescript
export const MEMORY_SYSTEM_INSTRUCTIONS = `## Memory System

You have a persistent memory system accessible via the \`memory_search\` tool (same pattern as \`tool_search\`):
- \`memory_search({ query: "types" })\` — view the full memory type tree
- \`memory_search({ query: "search:<keywords>" })\` — search memories by keyword, returns content + staleness info
- \`memory_search({ query: "select:<filename>" })\` — read a specific memory file in full
- \`memory_search({ query: "type:<typeName>" })\` — list all memories of a type (including subtypes)

When you discover information worth remembering, write it to a memory file using \`write_file\` or \`edit_file\`. Memory files use YAML frontmatter with \`name\`, \`description\`, \`type\`, and optional \`searchHint\` fields. Four built-in types: user / feedback / project / reference. Custom types can be created.`
```

- [ ] **Step 3: Replace memory section in prompts.ts**

In `src/constants/prompts.ts`, remove:
```typescript
import { loadMemory } from '../context/memoryContext.js'
```

Change the `registerSection('memory', ...)` call from:
```typescript
  registerSection('memory', (ctx) => loadMemory(ctx.cwd))
```
to:
```typescript
  registerSection('memory', async () => MEMORY_SYSTEM_INSTRUCTIONS)
```

Add import at the top:
```typescript
import { IDENTITY, DOING_TASKS, TONE, PLAN_MODE_SECTION, MEMORY_SYSTEM_INSTRUCTIONS } from './promptSections.js'
```

- [ ] **Step 4: Delete memoryContext files**

```bash
rm src/context/memoryContext.ts
rm src/context/__tests__/memoryContext.test.ts
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors (no remaining references to `loadMemory` or `memoryContext`)

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all pass (no test references deleted files)

- [ ] **Step 7: Commit**

```bash
git add src/tools/index.ts src/constants/promptSections.ts src/constants/prompts.ts
git rm src/context/memoryContext.ts src/context/__tests__/memoryContext.test.ts
git commit -m "feat(memory): replace MEMORY.md injection with MemorySearchTool system"
```

---

## Self-Review

**Spec coverage:**
- ✅ Delete `memoryContext.ts` — Task 8
- ✅ `MEMORY_SYSTEM_INSTRUCTIONS` constant — Task 8
- ✅ `MemoryFileMeta` / `Memory` / `MemoryTypeHandler` interfaces — Task 1
- ✅ 4 built-in type handlers (user/feedback/project/reference) — Task 2
- ✅ `MemoryTypeRegistry` with `getHandler`, `getSubtree`, `listAll`, `getTree`, `registerCustomType` — Task 3
- ✅ `MemoryBackend` interface — Task 4
- ✅ `LocalFSBackend` (CC-compatible path) — Task 4
- ✅ `memoryScan.ts` with `scoreMemoryForQuery` (same pattern as ToolSearchTool) — Task 5
- ✅ `memoryAge.ts` with `getMemoryAge` + `buildMemoryAgeWarning` — Task 6
- ✅ `MemorySearchTool` supporting all 4 query modes — Task 7
- ✅ Register in `src/tools/index.ts` — Task 8
- ✅ `CustomTypeDefinition` interface + `registerCustomType` in registry — Tasks 1 & 3

**Deferred (per spec):**
- ObsidianBackend, VectorDBBackend — Plan 1b or separate plan
- `load()` reading `.types/` directory from filesystem — not in this plan (registerCustomType is in-memory only; persistence is Phase 3 / Forked Agent task)

**Placeholder scan:** None found.

**Type consistency:**
- `MemoryFileMeta.type` = leaf string throughout ✅
- `MemoryTypeRegistry.getHandler(typeName)` called in MemorySearchTool ✅
- `LocalFSBackend` constructor takes `cwd: string` matching MemorySearchTool usage ✅
- `scoreMemoryForQuery(meta, terms, defaultWeight)` — 3-param signature consistent in tests and implementation ✅
