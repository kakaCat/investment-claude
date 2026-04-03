# Phase 2A: File System + Execution Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real execution logic for BashTool, and create FileWriteTool, FileEditTool, GlobTool, GrepTool as fully functional tools — replacing all stubs with working Node.js implementations.

**Architecture:** Each tool lives in `src/tools/{ToolName}/` with `{ToolName}.tsx` (buildTool), `UI.tsx` (Ink components), and `prompt.ts` (description + searchHint). After implementing each tool, register it in `src/tools/index.ts`. ReadTool gets its real implementation in-place. No new dependencies needed except `fast-glob` for GlobTool.

**Tech Stack:** TypeScript ESM, Node.js `fs/promises`, `child_process.spawn`, `fast-glob`, React 18 + Ink 5.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/tools/BashTool/BashTool.tsx` | Modify | Replace stub `call` with real `child_process.spawn` |
| `src/tools/ReadTool/ReadTool.tsx` | Modify | Replace stub `call` with real `fs.readFile` |
| `src/tools/FileWriteTool/prompt.ts` | Create | Description + searchHint |
| `src/tools/FileWriteTool/UI.tsx` | Create | Ink UI components |
| `src/tools/FileWriteTool/FileWriteTool.tsx` | Create | buildTool with `fs.writeFile` |
| `src/tools/FileEditTool/prompt.ts` | Create | Description + searchHint |
| `src/tools/FileEditTool/UI.tsx` | Create | Ink UI components |
| `src/tools/FileEditTool/FileEditTool.tsx` | Create | buildTool with read→replace→write |
| `src/tools/GlobTool/prompt.ts` | Create | Description + searchHint |
| `src/tools/GlobTool/UI.tsx` | Create | Ink UI components |
| `src/tools/GlobTool/GlobTool.tsx` | Create | buildTool with fast-glob |
| `src/tools/GrepTool/prompt.ts` | Create | Description + searchHint |
| `src/tools/GrepTool/UI.tsx` | Create | Ink UI components |
| `src/tools/GrepTool/GrepTool.tsx` | Create | buildTool with regex file search |
| `src/tools/index.ts` | Modify | Register 4 new tools |
| `package.json` | Modify | Add `fast-glob` dependency |

---

## Task 1: Implement BashTool — real `child_process.spawn`

**Files:**
- Modify: `src/tools/BashTool/BashTool.tsx`

- [ ] **Step 1: Replace the `call` implementation in `src/tools/BashTool/BashTool.tsx`**

Replace the entire file with:

```tsx
import React from 'react'
import { spawn } from 'child_process'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { BashToolUseUI, BashToolResultUI } from './UI.js'

function runBash(command: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', ['-c', command], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    const onAbort = () => {
      proc.kill('SIGTERM')
      reject(new Error('BashTool: aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })

    proc.on('close', (code) => {
      signal.removeEventListener('abort', onAbort)
      const output = (stdout + stderr).trim()
      if (code !== 0) {
        // Include output even on non-zero exit so model sees what went wrong
        resolve(`Exit code ${code}\n${output}`)
      } else {
        resolve(output || '(no output)')
      }
    })

    proc.on('error', (err) => {
      signal.removeEventListener('abort', onAbort)
      reject(err)
    })
  })
}

export const BashTool = buildTool({
  name: 'bash',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The bash command to run' },
    },
    required: ['command'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => (
    <BashToolUseUI input={input as { command: string }} />
  ),
  renderToolResult: (result) => <BashToolResultUI result={result} />,
  async call(input, context) {
    const { command } = input as { command: string }
    return runBash(command, context.abortSignal)
  },
})
```

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm run typecheck 2>&1 | grep "BashTool"
```

Expected: no errors.

- [ ] **Step 3: Smoke test BashTool**

```bash
node -e "
import('./dist/tools/BashTool/BashTool.js').then(async ({ BashTool }) => {
  const ctx = { abortSignal: new AbortController().signal, cwd: process.cwd(), tools: [] }
  const result = await BashTool.call({ command: 'echo hello world' }, ctx)
  console.log('result:', result)
  console.assert(result.trim() === 'hello world', 'Expected: hello world')
  console.log('✅ BashTool OK')
}).catch(e => { console.error(e); process.exit(1) })
" 2>&1
```

Run `npm run build` first, then the test.

Expected output: `result: hello world` and `✅ BashTool OK`

- [ ] **Step 4: Commit**

```bash
git add src/tools/BashTool/BashTool.tsx
git commit -m "feat: BashTool — real child_process.spawn implementation with abort support"
```

---

## Task 2: Implement ReadTool — real `fs.readFile`

**Files:**
- Modify: `src/tools/ReadTool/ReadTool.tsx`

- [ ] **Step 1: Replace the `call` implementation in `src/tools/ReadTool/ReadTool.tsx`**

Replace the entire file with:

```tsx
import React from 'react'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { ReadToolUseUI, ReadToolResultUI } from './UI.js'

const MAX_CHARS = 20_000

export const ReadTool = buildTool({
  name: 'read_file',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The file path to read (absolute or relative to cwd)' },
    },
    required: ['path'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <ReadToolUseUI input={input as { path: string }} />
  ),
  renderToolResult: (result) => <ReadToolResultUI result={result} />,
  async call(input, context) {
    const { path } = input as { path: string }
    const absPath = resolve(context.cwd, path)
    let content: string
    try {
      content = await readFile(absPath, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error reading file: ${msg}`
    }
    if (content.length > MAX_CHARS) {
      return content.slice(0, MAX_CHARS) + `\n\n[...truncated, file is ${content.length} chars total]`
    }
    return content
  },
})
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck 2>&1 | grep "ReadTool"
```

Expected: no errors.

- [ ] **Step 3: Smoke test ReadTool**

```bash
npm run build && node -e "
import('./dist/tools/ReadTool/ReadTool.js').then(async ({ ReadTool }) => {
  const ctx = { abortSignal: new AbortController().signal, cwd: process.cwd(), tools: [] }
  const result = await ReadTool.call({ path: 'package.json' }, ctx)
  console.assert(result.includes('pi'), 'Expected package.json content')
  console.log('✅ ReadTool OK')
}).catch(e => { console.error(e); process.exit(1) })
"
```

Expected: `✅ ReadTool OK`

- [ ] **Step 4: Commit**

```bash
git add src/tools/ReadTool/ReadTool.tsx
git commit -m "feat: ReadTool — real fs.readFile with cwd-relative paths and 20k char truncation"
```

---

## Task 3: Create FileWriteTool

**Files:**
- Create: `src/tools/FileWriteTool/prompt.ts`
- Create: `src/tools/FileWriteTool/UI.tsx`
- Create: `src/tools/FileWriteTool/FileWriteTool.tsx`

- [ ] **Step 1: Create `src/tools/FileWriteTool/prompt.ts`**

```typescript
export const DESCRIPTION =
  'Write content to a file, creating it if it does not exist and overwriting if it does. ' +
  'Creates parent directories automatically.'

export const SEARCH_HINT = 'write file, create file, save file, overwrite'
```

- [ ] **Step 2: Create `src/tools/FileWriteTool/UI.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'

export function FileWriteToolUseUI({ input }: { input: { path: string; content: string } }) {
  const lines = input.content.split('\n').length
  return (
    <Box>
      <Text color="yellow" bold>write </Text>
      <Text color="gray">{input.path}</Text>
      <Text color="gray"> ({lines} lines)</Text>
    </Box>
  )
}

export function FileWriteToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error')
  return (
    <Box>
      <Text color={isError ? 'red' : 'green'}>{result}</Text>
    </Box>
  )
}
```

- [ ] **Step 3: Create `src/tools/FileWriteTool/FileWriteTool.tsx`**

```tsx
import React from 'react'
import { writeFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { FileWriteToolUseUI, FileWriteToolResultUI } from './UI.js'

export const FileWriteTool = buildTool({
  name: 'write_file',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write (absolute or relative to cwd)' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => (
    <FileWriteToolUseUI input={input as { path: string; content: string }} />
  ),
  renderToolResult: (result) => <FileWriteToolResultUI result={result} />,
  async call(input, context) {
    const { path, content } = input as { path: string; content: string }
    const absPath = resolve(context.cwd, path)
    try {
      await mkdir(dirname(absPath), { recursive: true })
      await writeFile(absPath, content, 'utf-8')
      return `Written ${content.length} chars to ${absPath}`
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error writing file: ${msg}`
    }
  },
})
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck 2>&1 | grep "FileWrite"
```

Expected: no errors.

- [ ] **Step 5: Smoke test**

```bash
npm run build && node -e "
import('./dist/tools/FileWriteTool/FileWriteTool.js').then(async ({ FileWriteTool }) => {
  const ctx = { abortSignal: new AbortController().signal, cwd: '/tmp', tools: [] }
  const result = await FileWriteTool.call({ path: 'pi-test.txt', content: 'hello\nworld' }, ctx)
  console.assert(result.includes('Written'), 'Expected write confirmation: ' + result)
  const { readFileSync } = await import('fs')
  const content = readFileSync('/tmp/pi-test.txt', 'utf-8')
  console.assert(content === 'hello\nworld', 'Expected file content')
  console.log('✅ FileWriteTool OK')
}).catch(e => { console.error(e); process.exit(1) })
"
```

Expected: `✅ FileWriteTool OK`

- [ ] **Step 6: Commit**

```bash
git add src/tools/FileWriteTool/
git commit -m "feat: add FileWriteTool — fs.writeFile with mkdir -p and cwd-relative paths"
```

---

## Task 4: Create FileEditTool

**Files:**
- Create: `src/tools/FileEditTool/prompt.ts`
- Create: `src/tools/FileEditTool/UI.tsx`
- Create: `src/tools/FileEditTool/FileEditTool.tsx`

- [ ] **Step 1: Create `src/tools/FileEditTool/prompt.ts`**

```typescript
export const DESCRIPTION =
  'Edit a file by replacing an exact string with new content. ' +
  'The old_string must match exactly (including whitespace and indentation). ' +
  'Fails if old_string is not found or appears more than once.'

export const SEARCH_HINT = 'edit file, replace text, modify file, patch, string replace'
```

- [ ] **Step 2: Create `src/tools/FileEditTool/UI.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'

export function FileEditToolUseUI({
  input,
}: {
  input: { path: string; old_string: string; new_string: string }
}) {
  const preview = input.old_string.slice(0, 40).replace(/\n/g, '↵')
  return (
    <Box>
      <Text color="yellow" bold>edit </Text>
      <Text color="gray">{input.path}</Text>
      <Text color="gray"> "{preview}{input.old_string.length > 40 ? '…' : ''}"</Text>
    </Box>
  )
}

export function FileEditToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error')
  return (
    <Box>
      <Text color={isError ? 'red' : 'green'}>{result}</Text>
    </Box>
  )
}
```

- [ ] **Step 3: Create `src/tools/FileEditTool/FileEditTool.tsx`**

```tsx
import React from 'react'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { FileEditToolUseUI, FileEditToolResultUI } from './UI.js'

export const FileEditTool = buildTool({
  name: 'edit_file',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to edit (absolute or relative to cwd)' },
      old_string: { type: 'string', description: 'Exact string to find and replace' },
      new_string: { type: 'string', description: 'Replacement string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => (
    <FileEditToolUseUI
      input={input as { path: string; old_string: string; new_string: string }}
    />
  ),
  renderToolResult: (result) => <FileEditToolResultUI result={result} />,
  async call(input, context) {
    const { path, old_string, new_string } = input as {
      path: string
      old_string: string
      new_string: string
    }
    const absPath = resolve(context.cwd, path)

    let content: string
    try {
      content = await readFile(absPath, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error reading file: ${msg}`
    }

    const count = content.split(old_string).length - 1
    if (count === 0) {
      return `Error: old_string not found in ${path}`
    }
    if (count > 1) {
      return `Error: old_string appears ${count} times in ${path} — must be unique`
    }

    const updated = content.replace(old_string, new_string)
    try {
      await writeFile(absPath, updated, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error writing file: ${msg}`
    }

    return `Edited ${path}: replaced ${old_string.length} chars with ${new_string.length} chars`
  },
})
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck 2>&1 | grep "FileEdit"
```

Expected: no errors.

- [ ] **Step 5: Smoke test**

```bash
npm run build && node -e "
import { writeFileSync } from 'fs'
writeFileSync('/tmp/pi-edit-test.txt', 'hello world\nfoo bar')

import('./dist/tools/FileEditTool/FileEditTool.js').then(async ({ FileEditTool }) => {
  const ctx = { abortSignal: new AbortController().signal, cwd: '/tmp', tools: [] }

  // Test successful replace
  const r1 = await FileEditTool.call({ path: 'pi-edit-test.txt', old_string: 'hello world', new_string: 'goodbye world' }, ctx)
  console.assert(r1.includes('Edited'), 'Expected edit confirmation: ' + r1)

  // Test not-found error
  const r2 = await FileEditTool.call({ path: 'pi-edit-test.txt', old_string: 'NOTEXIST', new_string: 'x' }, ctx)
  console.assert(r2.includes('not found'), 'Expected not-found error: ' + r2)

  console.log('✅ FileEditTool OK')
}).catch(e => { console.error(e); process.exit(1) })
"
```

Expected: `✅ FileEditTool OK`

- [ ] **Step 6: Commit**

```bash
git add src/tools/FileEditTool/
git commit -m "feat: add FileEditTool — exact string replace with uniqueness check"
```

---

## Task 5: Install fast-glob and create GlobTool

**Files:**
- Modify: `package.json`
- Create: `src/tools/GlobTool/prompt.ts`
- Create: `src/tools/GlobTool/UI.tsx`
- Create: `src/tools/GlobTool/GlobTool.tsx`

- [ ] **Step 1: Install fast-glob**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npm install fast-glob
```

Also install types if needed:
```bash
npm install --save-dev @types/fast-glob 2>/dev/null || true
```

Note: fast-glob ships its own types, so `@types/fast-glob` is not needed.

- [ ] **Step 2: Create `src/tools/GlobTool/prompt.ts`**

```typescript
export const DESCRIPTION =
  'Find files matching a glob pattern (e.g. "src/**/*.ts", "**/*.json"). ' +
  'Returns a list of matching file paths relative to the search directory.'

export const SEARCH_HINT = 'find files, glob pattern, list files, search files, wildcard'
```

- [ ] **Step 3: Create `src/tools/GlobTool/UI.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'

export function GlobToolUseUI({ input }: { input: { pattern: string; cwd?: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>glob </Text>
      <Text color="gray">{input.pattern}</Text>
      {input.cwd && <Text color="gray"> in {input.cwd}</Text>}
    </Box>
  )
}

export function GlobToolResultUI({ result }: { result: string }) {
  const lines = result.split('\n').length
  const preview = result.length > 300 ? result.slice(0, 300) + '\n…' : result
  return (
    <Box flexDirection="column">
      <Text color="gray" dimColor>{lines} match(es)</Text>
      <Text color="gray">{preview}</Text>
    </Box>
  )
}
```

- [ ] **Step 4: Create `src/tools/GlobTool/GlobTool.tsx`**

```tsx
import React from 'react'
import fg from 'fast-glob'
import { resolve } from 'path'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { GlobToolUseUI, GlobToolResultUI } from './UI.js'

export const GlobTool = buildTool({
  name: 'glob',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. "src/**/*.ts")' },
      cwd: { type: 'string', description: 'Directory to search in (default: current working directory)' },
    },
    required: ['pattern'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <GlobToolUseUI input={input as { pattern: string; cwd?: string }} />
  ),
  renderToolResult: (result) => <GlobToolResultUI result={result} />,
  async call(input, context) {
    const { pattern, cwd } = input as { pattern: string; cwd?: string }
    const searchDir = resolve(context.cwd, cwd ?? '.')
    let matches: string[]
    try {
      matches = await fg(pattern, {
        cwd: searchDir,
        dot: false,
        ignore: ['**/node_modules/**', '**/.git/**'],
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error: ${msg}`
    }
    if (matches.length === 0) {
      return `No files matched "${pattern}"`
    }
    return matches.sort().join('\n')
  },
})
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck 2>&1 | grep "GlobTool"
```

Expected: no errors.

- [ ] **Step 6: Smoke test**

```bash
npm run build && node -e "
import('./dist/tools/GlobTool/GlobTool.js').then(async ({ GlobTool }) => {
  const ctx = { abortSignal: new AbortController().signal, cwd: '/Users/mac/Documents/ai/pi-claude-code', tools: [] }
  const result = await GlobTool.call({ pattern: 'src/**/*.ts' }, ctx)
  console.assert(result.includes('query.ts'), 'Expected to find query.ts: ' + result)
  const noMatch = await GlobTool.call({ pattern: '**/*.xyz123' }, ctx)
  console.assert(noMatch.includes('No files matched'), 'Expected no-match: ' + noMatch)
  console.log('✅ GlobTool OK')
}).catch(e => { console.error(e); process.exit(1) })
"
```

Expected: `✅ GlobTool OK`

- [ ] **Step 7: Commit**

```bash
git add src/tools/GlobTool/ package.json package-lock.json
git commit -m "feat: add GlobTool — fast-glob file pattern matching with node_modules exclusion"
```

---

## Task 6: Create GrepTool

**Files:**
- Create: `src/tools/GrepTool/prompt.ts`
- Create: `src/tools/GrepTool/UI.tsx`
- Create: `src/tools/GrepTool/GrepTool.tsx`

- [ ] **Step 1: Create `src/tools/GrepTool/prompt.ts`**

```typescript
export const DESCRIPTION =
  'Search file contents using a regular expression. ' +
  'Returns matching lines with file path and line number. ' +
  'Searches recursively from the given directory.'

export const SEARCH_HINT = 'search content, grep, regex, find text, search in files'
```

- [ ] **Step 2: Create `src/tools/GrepTool/UI.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'

export function GrepToolUseUI({
  input,
}: {
  input: { pattern: string; path?: string; glob?: string }
}) {
  return (
    <Box>
      <Text color="cyan" bold>grep </Text>
      <Text color="gray">/{input.pattern}/</Text>
      {input.path && <Text color="gray"> in {input.path}</Text>}
      {input.glob && <Text color="gray"> [{input.glob}]</Text>}
    </Box>
  )
}

export function GrepToolResultUI({ result }: { result: string }) {
  const preview = result.length > 500 ? result.slice(0, 500) + '\n…' : result
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text color="gray">{preview}</Text>
    </Box>
  )
}
```

- [ ] **Step 3: Create `src/tools/GrepTool/GrepTool.tsx`**

```tsx
import React from 'react'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import fg from 'fast-glob'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { GrepToolUseUI, GrepToolResultUI } from './UI.js'

const MAX_RESULTS = 100

export const GrepTool = buildTool({
  name: 'grep',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regular expression to search for' },
      path: { type: 'string', description: 'Directory or file to search in (default: cwd)' },
      glob: { type: 'string', description: 'Glob filter for files (e.g. "*.ts"). Default: all files' },
    },
    required: ['pattern'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <GrepToolUseUI input={input as { pattern: string; path?: string; glob?: string }} />
  ),
  renderToolResult: (result) => <GrepToolResultUI result={result} />,
  async call(input, context) {
    const { pattern, path, glob = '**/*' } = input as {
      pattern: string
      path?: string
      glob?: string
    }

    let regex: RegExp
    try {
      regex = new RegExp(pattern)
    } catch {
      return `Error: invalid regex "${pattern}"`
    }

    const searchDir = resolve(context.cwd, path ?? '.')
    let files: string[]
    try {
      files = await fg(glob, {
        cwd: searchDir,
        dot: false,
        ignore: ['**/node_modules/**', '**/.git/**'],
        absolute: true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error listing files: ${msg}`
    }

    const results: string[] = []
    for (const file of files) {
      if (results.length >= MAX_RESULTS) break
      let content: string
      try {
        content = await readFile(file, 'utf-8')
      } catch {
        continue // skip binary / unreadable files
      }
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const rel = file.startsWith(searchDir) ? file.slice(searchDir.length + 1) : file
          results.push(`${rel}:${i + 1}: ${lines[i].trim()}`)
          if (results.length >= MAX_RESULTS) break
        }
      }
    }

    if (results.length === 0) {
      return `No matches for /${pattern}/`
    }
    const suffix = results.length >= MAX_RESULTS ? `\n[...limited to ${MAX_RESULTS} results]` : ''
    return results.join('\n') + suffix
  },
})
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck 2>&1 | grep "GrepTool"
```

Expected: no errors.

- [ ] **Step 5: Smoke test**

```bash
npm run build && node -e "
import('./dist/tools/GrepTool/GrepTool.js').then(async ({ GrepTool }) => {
  const ctx = { abortSignal: new AbortController().signal, cwd: '/Users/mac/Documents/ai/pi-claude-code', tools: [] }
  const result = await GrepTool.call({ pattern: 'buildTool', glob: '**/*.tsx' }, ctx)
  console.assert(result.includes('BashTool'), 'Expected to find buildTool usage: ' + result)
  const noMatch = await GrepTool.call({ pattern: 'XYZNOTEXIST999' }, ctx)
  console.assert(noMatch.includes('No matches'), 'Expected no-match: ' + noMatch)
  console.log('✅ GrepTool OK')
}).catch(e => { console.error(e); process.exit(1) })
"
```

Expected: `✅ GrepTool OK`

- [ ] **Step 6: Commit**

```bash
git add src/tools/GrepTool/
git commit -m "feat: add GrepTool — regex search across files with fast-glob and 100 result limit"
```

---

## Task 7: Register all new tools in `src/tools/index.ts`

**Files:**
- Modify: `src/tools/index.ts`

- [ ] **Step 1: Replace `src/tools/index.ts` with updated content**

```typescript
// 工具注册表 — 对标 Claude Code src/tools.ts
// getAllTools: 所有工具（含 deferLoading），供 ToolSearchTool 搜索
// getActiveTools: 传给模型的工具（isEnabled() && !deferLoading）

import type { Tool } from '../Tool.js'
import { BashTool } from './BashTool/BashTool.js'
import { ReadTool } from './ReadTool/ReadTool.js'
import { FileWriteTool } from './FileWriteTool/FileWriteTool.js'
import { FileEditTool } from './FileEditTool/FileEditTool.js'
import { GlobTool } from './GlobTool/GlobTool.js'
import { GrepTool } from './GrepTool/GrepTool.js'
import { ToolSearchTool } from './ToolSearchTool/ToolSearchTool.js'

// 内置工具静态列表 — 新增工具在此 import + 加入数组
const BUILTIN_TOOLS: Tool[] = [
  BashTool,
  ReadTool,
  FileWriteTool,
  FileEditTool,
  GlobTool,
  GrepTool,
  ToolSearchTool,
]

/** 所有工具（含 isEnabled=false 和 deferLoading=true），供 ToolSearchTool 搜索 */
export function getAllTools(pluginTools: Tool[] = []): Tool[] {
  return [...BUILTIN_TOOLS, ...pluginTools]
}

/**
 * 传给模型的激活工具：isEnabled() 且 deferLoading=false。
 */
export function getActiveTools(pluginTools: Tool[] = []): Tool[] {
  return getAllTools(pluginTools).filter((t) => t.isEnabled() && !t.deferLoading)
}

export function findTool(name: string, tools: Tool[]): Tool | undefined {
  return tools.find((t) => t.name === name)
}
```

- [ ] **Step 2: Run full typecheck — expect zero errors**

```bash
npm run typecheck 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 3: Build and verify 7 tools are registered**

```bash
npm run build && node -e "
import('./dist/tools/index.js').then(({ getAllTools }) => {
  const tools = getAllTools()
  console.log('Registered tools:', tools.map(t => t.name))
  console.assert(tools.length === 7, 'Expected 7 tools, got ' + tools.length)
  console.log('✅ Registry OK')
}).catch(e => { console.error(e); process.exit(1) })
"
```

Expected: lists all 7 tools, `✅ Registry OK`

- [ ] **Step 4: Commit**

```bash
git add src/tools/index.ts
git commit -m "feat: register FileWriteTool, FileEditTool, GlobTool, GrepTool in tool registry"
```

---

## Post-Implementation Checklist

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — succeeds
- [ ] All 7 tools registered: `bash`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `tool_search`
- [ ] BashTool: `echo test` returns `test`
- [ ] ReadTool: reads `package.json` successfully
- [ ] FileWriteTool: creates a file and returns byte count
- [ ] FileEditTool: replaces exact string, errors on not-found
- [ ] GlobTool: finds `.tsx` files in `src/`
- [ ] GrepTool: finds pattern in source files
- [ ] `npm run dev` starts without errors
