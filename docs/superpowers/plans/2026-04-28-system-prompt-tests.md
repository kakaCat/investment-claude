# System Prompt Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit test coverage for the section registry (`systemPromptSections.ts`) and all five context loaders (`envContext`, `workspaceContext`, `gitContext`, `claudeMdContext`, `memoryContext`).

**Architecture:** Registry tests use real in-memory calls (no mocks needed — pure logic). Context loader tests mock their I/O dependencies (`child_process`, `fs`, `os`) via `vi.mock()` so tests are deterministic and don't touch disk or git.

**Tech Stack:** Vitest, TypeScript (ESM), `vi.mock` / `vi.fn` / `vi.mocked`

---

## File Structure

| Action | Path |
|--------|------|
| Modify | `package.json` — add `"test"` script |
| Create | `src/constants/__tests__/systemPromptSections.test.ts` |
| Create | `src/context/__tests__/envContext.test.ts` |
| Create | `src/context/__tests__/workspaceContext.test.ts` |
| Create | `src/context/__tests__/gitContext.test.ts` |
| Create | `src/context/__tests__/claudeMdContext.test.ts` |
| Create | `src/context/__tests__/memoryContext.test.ts` |

---

## Task 1: Add test script + systemPromptSections tests

**Files:**
- Modify: `package.json`
- Create: `src/constants/__tests__/systemPromptSections.test.ts`

- [ ] **Step 1: Add "test" script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

Full scripts block after edit:

```json
"scripts": {
  "dev": "tsx src/entrypoints/cli.tsx",
  "build": "tsc",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
}
```

- [ ] **Step 2: Write systemPromptSections.test.ts**

Create `src/constants/__tests__/systemPromptSections.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSectionCache,
  registerSection,
  registerVolatileSection,
  resolveSystemPrompt,
  _resetRegistry,
  type SectionContext,
} from '../systemPromptSections.js'

const ctx: SectionContext = {
  cwd: '/test/project',
  sessionId: 'test-session-id',
  workspaceDir: '/test/project/.pi/sessions/test-session-id/workspace',
  isPlanMode: false,
}

beforeEach(() => {
  _resetRegistry()
})

describe('registerSection + resolveSystemPrompt', () => {
  it('includes section content in result', async () => {
    registerSection('foo', async () => 'hello world')
    const result = await resolveSystemPrompt(ctx)
    expect(result).toContain('hello world')
  })

  it('filters out null sections', async () => {
    registerSection('visible', async () => 'visible text')
    registerSection('empty', async () => null)
    const result = await resolveSystemPrompt(ctx)
    expect(result).toContain('visible text')
    expect(result).not.toContain('null')
  })

  it('joins multiple sections with --- separator in registration order', async () => {
    registerSection('a', async () => 'section A')
    registerSection('b', async () => 'section B')
    const result = await resolveSystemPrompt(ctx)
    expect(result).toBe('section A\n\n---\n\nsection B')
  })

  it('cached section loader is called only once across two resolves', async () => {
    const loader = vi.fn().mockResolvedValue('cached content')
    registerSection('cached', loader)
    await resolveSystemPrompt(ctx)
    await resolveSystemPrompt(ctx)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('volatile section loader is called on every resolve', async () => {
    const loader = vi.fn().mockResolvedValue('volatile content')
    registerVolatileSection('volatile', loader)
    await resolveSystemPrompt(ctx)
    await resolveSystemPrompt(ctx)
    expect(loader).toHaveBeenCalledTimes(2)
  })
})

describe('clearSectionCache', () => {
  it('causes cached loader to be re-called after clear', async () => {
    const loader = vi.fn().mockResolvedValue('content')
    registerSection('cached', loader)
    await resolveSystemPrompt(ctx)
    clearSectionCache()
    await resolveSystemPrompt(ctx)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('does not change volatile loader call frequency', async () => {
    const loader = vi.fn().mockResolvedValue('volatile')
    registerVolatileSection('volatile', loader)
    await resolveSystemPrompt(ctx)
    clearSectionCache()
    await resolveSystemPrompt(ctx)
    // volatile is always called each resolve — clearSectionCache doesn't affect this
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 3: Run tests and verify they pass**

```bash
npx vitest run src/constants/__tests__/systemPromptSections.test.ts
```

Expected output: 7 tests pass, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add package.json src/constants/__tests__/systemPromptSections.test.ts
git commit -m "test(prompt): add section registry unit tests"
```

---

## Task 2: envContext tests

**Files:**
- Create: `src/context/__tests__/envContext.test.ts`

- [ ] **Step 1: Write envContext.test.ts**

Create `src/context/__tests__/envContext.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'

vi.mock('os', () => ({
  platform: vi.fn().mockReturnValue('darwin'),
  release: vi.fn().mockReturnValue('24.0.0'),
  homedir: vi.fn().mockReturnValue('/Users/test'),
}))

import { loadEnvInfo } from '../envContext.js'
import type { SectionContext } from '../../constants/systemPromptSections.js'

const ctx: SectionContext = {
  cwd: '/Users/test/my-project',
  sessionId: 'abc-123',
  workspaceDir: '/Users/test/my-project/.pi/sessions/abc-123/workspace',
  isPlanMode: false,
}

describe('loadEnvInfo', () => {
  it('includes # User Environment Info header', async () => {
    const result = await loadEnvInfo(ctx)
    expect(result).toContain('# User Environment Info')
  })

  it('includes ctx.cwd', async () => {
    const result = await loadEnvInfo(ctx)
    expect(result).toContain('/Users/test/my-project')
  })

  it('includes ctx.sessionId', async () => {
    const result = await loadEnvInfo(ctx)
    expect(result).toContain('abc-123')
  })

  it('includes today\'s date in YYYY-MM-DD format', async () => {
    const result = await loadEnvInfo(ctx)
    const today = new Date().toISOString().slice(0, 10)
    expect(result).toContain(today)
  })

  it('includes OS platform from mock', async () => {
    const result = await loadEnvInfo(ctx)
    expect(result).toContain('darwin')
  })
})
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npx vitest run src/context/__tests__/envContext.test.ts
```

Expected output: 5 tests pass, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add src/context/__tests__/envContext.test.ts
git commit -m "test(prompt): add envContext unit tests"
```

---

## Task 3: workspaceContext tests

**Files:**
- Create: `src/context/__tests__/workspaceContext.test.ts`

- [ ] **Step 1: Write workspaceContext.test.ts**

Create `src/context/__tests__/workspaceContext.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
}))

import { mkdirSync } from 'fs'
import { loadWorkspaceSection } from '../workspaceContext.js'
import type { SectionContext } from '../../constants/systemPromptSections.js'

const mkdirSyncMock = vi.mocked(mkdirSync)

const ctx: SectionContext = {
  cwd: '/Users/test/my-project',
  sessionId: 'abc-123',
  workspaceDir: '/Users/test/my-project/.pi/sessions/abc-123/workspace',
  isPlanMode: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadWorkspaceSection', () => {
  it('calls mkdirSync with workspaceDir and { recursive: true }', async () => {
    await loadWorkspaceSection(ctx)
    expect(mkdirSyncMock).toHaveBeenCalledWith(ctx.workspaceDir, { recursive: true })
  })

  it('returns string containing # Workspace header', async () => {
    const result = await loadWorkspaceSection(ctx)
    expect(result).toContain('# Workspace')
  })

  it('returns string containing workspaceDir path', async () => {
    const result = await loadWorkspaceSection(ctx)
    expect(result).toContain(ctx.workspaceDir)
  })

  it('does not throw when mkdirSync throws, still returns workspace string', async () => {
    mkdirSyncMock.mockImplementation(() => {
      throw new Error('EEXIST: file already exists')
    })
    await expect(loadWorkspaceSection(ctx)).resolves.toContain('# Workspace')
  })
})
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npx vitest run src/context/__tests__/workspaceContext.test.ts
```

Expected output: 4 tests pass, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add src/context/__tests__/workspaceContext.test.ts
git commit -m "test(prompt): add workspaceContext unit tests"
```

---

## Task 4: gitContext tests

**Files:**
- Create: `src/context/__tests__/gitContext.test.ts`

- [ ] **Step 1: Write gitContext.test.ts**

Create `src/context/__tests__/gitContext.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

import { execSync } from 'child_process'
import { loadGitStatus } from '../gitContext.js'

const execSyncMock = vi.mocked(execSync)

/** Set up execSync to respond to git commands like a real repo. */
function mockGitRepo(overrides: Partial<Record<string, string>> = {}) {
  const defaults: Record<string, string> = {
    'git rev-parse --show-toplevel': '/project',
    'git rev-parse --abbrev-ref HEAD': 'main',
    'git rev-parse --abbrev-ref origin/HEAD': 'origin/main',
    'git config user.name': 'Test User',
    'git log --oneline -5': 'abc1234 feat: add feature\ndef5678 fix: fix bug',
    'git status --short': '',
  }
  const map = { ...defaults, ...overrides }
  execSyncMock.mockImplementation((cmd: string) => {
    for (const [key, val] of Object.entries(map)) {
      if (cmd.includes(key)) return val
    }
    return ''
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadGitStatus', () => {
  it('returns null when not in a git repo', async () => {
    // execSync throwing causes run() to return '', which triggers the null guard
    execSyncMock.mockImplementation(() => {
      throw new Error('fatal: not a git repository')
    })
    const result = await loadGitStatus('/not-a-repo')
    expect(result).toBeNull()
  })

  it('includes # Git Status header for a valid repo', async () => {
    mockGitRepo()
    const result = await loadGitStatus('/project')
    expect(result).toContain('# Git Status')
  })

  it('includes the current branch name', async () => {
    mockGitRepo()
    const result = await loadGitStatus('/project')
    expect(result).toContain('Current branch: main')
  })

  it('does not include Changed files section when git status is empty', async () => {
    mockGitRepo({ 'git status --short': '' })
    const result = await loadGitStatus('/project')
    expect(result).not.toContain('Changed files:')
  })

  it('includes Changed files section when status has content', async () => {
    mockGitRepo({ 'git status --short': 'M src/foo.ts\n?? src/bar.ts' })
    const result = await loadGitStatus('/project')
    expect(result).toContain('Changed files:')
    expect(result).toContain('M src/foo.ts')
  })

  it('truncates output exceeding 2000 characters and appends (truncated)', async () => {
    const longLog = 'a'.repeat(2100)
    mockGitRepo({ 'git log --oneline -5': longLog })
    const result = await loadGitStatus('/project')
    expect(result!.length).toBeLessThanOrEqual(2030)
    expect(result).toContain('...(truncated)')
  })
})
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npx vitest run src/context/__tests__/gitContext.test.ts
```

Expected output: 6 tests pass, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add src/context/__tests__/gitContext.test.ts
git commit -m "test(prompt): add gitContext unit tests"
```

---

## Task 5: claudeMdContext tests

**Files:**
- Create: `src/context/__tests__/claudeMdContext.test.ts`

- [ ] **Step 1: Write claudeMdContext.test.ts**

The function traverses from `cwd` upward until it hits `homedir()`, then checks `~/.claude/CLAUDE.md`. Use cwd = `/Users/test/project` and home = `/Users/test` so only one directory is checked in the traversal before hitting home.

Create `src/context/__tests__/claudeMdContext.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/Users/test'),
  platform: vi.fn().mockReturnValue('darwin'),
  release: vi.fn().mockReturnValue('24.0.0'),
}))

import { existsSync, readFileSync } from 'fs'
import { loadClaudeMd } from '../claudeMdContext.js'

const existsSyncMock = vi.mocked(existsSync)
const readFileSyncMock = vi.mocked(readFileSync)

// cwd one level below home — traversal checks only /Users/test/project/CLAUDE.md
const CWD = '/Users/test/project'
const CWD_CLAUDE_MD = '/Users/test/project/CLAUDE.md'
const GLOBAL_CLAUDE_MD = '/Users/test/.claude/CLAUDE.md'

beforeEach(() => {
  vi.clearAllMocks()
  existsSyncMock.mockReturnValue(false)
})

describe('loadClaudeMd', () => {
  it('returns null when no CLAUDE.md files exist', async () => {
    const result = await loadClaudeMd(CWD)
    expect(result).toBeNull()
  })

  it('returns project CLAUDE.md content when only cwd file exists', async () => {
    existsSyncMock.mockImplementation((p) => p === CWD_CLAUDE_MD)
    readFileSyncMock.mockReturnValue('project config content')
    const result = await loadClaudeMd(CWD)
    expect(result).toContain(CWD_CLAUDE_MD)
    expect(result).toContain('project config content')
  })

  it('returns global CLAUDE.md content when only global file exists', async () => {
    existsSyncMock.mockImplementation((p) => p === GLOBAL_CLAUDE_MD)
    readFileSyncMock.mockReturnValue('global config content')
    const result = await loadClaudeMd(CWD)
    expect(result).toContain('~/.claude/CLAUDE.md')
    expect(result).toContain('global config content')
  })

  it('includes both files with project section before global when both exist', async () => {
    existsSyncMock.mockImplementation(
      (p) => p === CWD_CLAUDE_MD || p === GLOBAL_CLAUDE_MD,
    )
    readFileSyncMock.mockImplementation((p: unknown) => {
      if (p === CWD_CLAUDE_MD) return 'project content'
      if (p === GLOBAL_CLAUDE_MD) return 'global content'
      return ''
    })
    const result = await loadClaudeMd(CWD)
    const projectIdx = result!.indexOf('project content')
    const globalIdx = result!.indexOf('global content')
    expect(projectIdx).toBeGreaterThanOrEqual(0)
    expect(globalIdx).toBeGreaterThanOrEqual(0)
    expect(projectIdx).toBeLessThan(globalIdx)
  })
})
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npx vitest run src/context/__tests__/claudeMdContext.test.ts
```

Expected output: 4 tests pass, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add src/context/__tests__/claudeMdContext.test.ts
git commit -m "test(prompt): add claudeMdContext unit tests"
```

---

## Task 6: memoryContext tests

**Files:**
- Create: `src/context/__tests__/memoryContext.test.ts`

- [ ] **Step 1: Write memoryContext.test.ts**

The memory path is: `~/.claude/projects/{cwd.replace(/\//g, '-')}/memory/MEMORY.md`.
For cwd `/Users/test/project`, the encoded path is `-Users-test-project`, so the full path is `/Users/test/.claude/projects/-Users-test-project/memory/MEMORY.md`.

Create `src/context/__tests__/memoryContext.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/Users/test'),
  platform: vi.fn().mockReturnValue('darwin'),
  release: vi.fn().mockReturnValue('24.0.0'),
}))

import { existsSync, readFileSync } from 'fs'
import { loadMemory } from '../memoryContext.js'

const existsSyncMock = vi.mocked(existsSync)
const readFileSyncMock = vi.mocked(readFileSync)

const CWD = '/Users/test/project'
// cwd.replace(/\//g, '-') = '-Users-test-project'
const MEMORY_PATH = '/Users/test/.claude/projects/-Users-test-project/memory/MEMORY.md'

beforeEach(() => {
  vi.clearAllMocks()
  existsSyncMock.mockReturnValue(false)
})

describe('loadMemory', () => {
  it('returns null when memory file does not exist', async () => {
    const result = await loadMemory(CWD)
    expect(result).toBeNull()
  })

  it('returns # Memory section with file content when file exists', async () => {
    existsSyncMock.mockImplementation((p) => p === MEMORY_PATH)
    readFileSyncMock.mockReturnValue('- [Note](note.md) — some memory entry')
    const result = await loadMemory(CWD)
    expect(result).toContain('# Memory')
    expect(result).toContain('some memory entry')
  })

  it('returns null when memory file exists but is empty', async () => {
    existsSyncMock.mockImplementation((p) => p === MEMORY_PATH)
    readFileSyncMock.mockReturnValue('   ')  // whitespace only
    const result = await loadMemory(CWD)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npx vitest run src/context/__tests__/memoryContext.test.ts
```

Expected output: 3 tests pass, 0 failures.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All tests across the project pass (existing + new). Total should be 29+ tests.

- [ ] **Step 4: Commit**

```bash
git add src/context/__tests__/memoryContext.test.ts
git commit -m "test(prompt): add memoryContext unit tests"
```

---

## Verification

After all tasks complete:

```bash
npm test
```

New tests added: 7 + 5 + 4 + 6 + 4 + 3 = **29 tests** across 6 new files.
