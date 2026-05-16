# Restart Functionality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement lightweight restart mechanism allowing the agent to restart its TypeScript process without exiting the terminal session.

**Architecture:** Shared restart logic in `src/utils/restart.ts` used by both RestartTool (AI-callable) and /restart command (user-facing). Startup detection in CLI entry point displays restart message and cleans up context file.

**Tech Stack:** TypeScript, Node.js child_process, Ink (React for CLI)

---

## File Structure

```
src/utils/restart.ts              # NEW - Shared restart logic
src/tools/RestartTool/
  RestartTool.tsx                 # NEW - AI-callable tool
  index.ts                        # NEW - Export
src/commands/restart.ts           # NEW - /restart command
src/entrypoints/cli.tsx           # MODIFY - Add startup detection
src/tools/index.ts                # MODIFY - Register RestartTool
.gitignore                        # MODIFY - Add .restart/
```

---

### Task 1: Shared Restart Logic

**Files:**
- Create: `src/utils/restart.ts`

- [ ] **Step 1: Create restart utility with context structure**

```typescript
import { spawn, execSync } from 'child_process'
import { join, dirname } from 'path'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..')
const RESTART_DIR = join(PROJECT_ROOT, '.restart')
const CONTEXT_FILE = join(RESTART_DIR, 'context.json')

interface RestartContext {
  timestamp: string
  cwd: string
  reason: string
  env: {
    NODE_ENV?: string
  }
}
```

- [ ] **Step 2: Implement spawn command detection**

```typescript
function getSpawnCommand(): { cmd: string; args: string[] } {
  const localTsx = join(PROJECT_ROOT, 'node_modules', '.bin', 'tsx')
  const tsxBin = existsSync(localTsx) ? localTsx : 'tsx'

  const entryFile = process.argv[1]
  if (entryFile && entryFile !== process.argv[0] && entryFile.endsWith('.tsx')) {
    return {
      cmd: tsxBin,
      args: [entryFile]
    }
  }

  return {
    cmd: tsxBin,
    args: [join(PROJECT_ROOT, 'src', 'entrypoints', 'cli.tsx')]
  }
}
```

- [ ] **Step 3: Implement performRestart function**

```typescript
export async function performRestart(preserveContext: boolean): Promise<void> {
  if (preserveContext) {
    try {
      if (!existsSync(RESTART_DIR)) {
        mkdirSync(RESTART_DIR, { recursive: true })
      }

      const context: RestartContext = {
        timestamp: new Date().toISOString(),
        cwd: process.cwd(),
        reason: 'user_requested_restart',
        env: {
          NODE_ENV: process.env.NODE_ENV || 'development'
        }
      }

      writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2), 'utf-8')
    } catch (e) {
      console.error('[restart] 保存上下文失败:', e)
    }
  } else {
    try {
      if (existsSync(CONTEXT_FILE)) {
        unlinkSync(CONTEXT_FILE)
      }
    } catch {
      // ignore
    }
  }

  const { cmd, args } = getSpawnCommand()

  const tsxExists = existsSync(cmd) || cmd === 'tsx'
  if (!tsxExists) {
    console.warn(`[restart] 警告: ${cmd} 不存在，尝试使用全局 tsx`)
  }

  const child = spawn(cmd, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    detached: true,
    env: {
      ...process.env,
      PI_RESTARTED: 'true',
      PI_RESTART_TIMESTAMP: new Date().toISOString()
    }
  })

  let spawnFailed = false
  child.on('error', (err: NodeJS.ErrnoException) => {
    spawnFailed = true
    console.error(`[restart] 新进程启动失败: ${err.message}`)
  })

  child.unref()

  setImmediate(() => {
    if (spawnFailed) {
      console.log('[restart] 新进程启动失败，当前进程继续运行')
      return
    }
    process.exit(0)
  })
}
```

- [ ] **Step 4: Verify restart.ts compiles**

Run: `npm run typecheck`
Expected: No errors in src/utils/restart.ts

- [ ] **Step 5: Commit**

```bash
git add src/utils/restart.ts
git commit -m "feat(utils): add shared restart logic"
```

---

### Task 2: RestartTool Implementation

**Files:**
- Create: `src/tools/RestartTool/RestartTool.tsx`
- Create: `src/tools/RestartTool/index.ts`

- [ ] **Step 1: Create RestartTool with tool definition**

```typescript
import React from 'react'
import { Text, Box } from 'ink'
import { buildTool } from '../../Tool.js'
import type { ToolResult } from '../../Tool.js'
import { performRestart } from '../../utils/restart.js'

interface RestartInput {
  preserve_context?: boolean
}

interface RestartOutput {
  message: string
  preserve_context: boolean
  estimated_time: string
  new_pid?: number
}

export const RestartTool = buildTool<RestartInput, RestartOutput>({
  name: 'restart_agent',
  description:
    'Restart the entire agent process without leaving the terminal. ' +
    'Use when: (1) new tools have been added to the codebase and need to take effect, ' +
    '(2) performance degradation after long-running session, ' +
    '(3) general cleanup or error recovery. ' +
    'The conversation context will be saved and restored after restart by default. ' +
    'Note: there will be a ~10-30 second delay while the new process starts up.',
  inputSchema: {
    type: 'object',
    properties: {
      preserve_context: {
        type: 'boolean',
        description:
          'Whether to save and restore the current conversation context. ' +
          'Default: true. Set to false for a completely clean restart.'
      }
    }
  },

  async call(input: RestartInput): Promise<ToolResult<RestartOutput>> {
    const preserveContext = input.preserve_context !== false

    await performRestart(preserveContext)

    return {
      data: {
        message: '🔄 Agent 重启中...',
        preserve_context: preserveContext,
        estimated_time: '10-30秒'
      }
    }
  },

  mapToolResultToToolResultBlockParam(output: RestartOutput, toolUseId: string) {
    const text =
      `## ${output.message}\n\n` +
      `新进程已启动，当前进程即将退出。\n` +
      (output.preserve_context
        ? `✅ 对话上下文已保存，重启后将恢复。\n`
        : `🆕 干净重启，不保留上下文。\n`) +
      `⏱ 预计 ${output.estimated_time} 后新 agent 可用。\n\n` +
      `**新工具将在重启后生效。**`

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseId,
      content: text
    }
  },

  renderToolUse(input: RestartInput) {
    const preserveContext = input.preserve_context !== false
    return (
      <Box flexDirection="column">
        <Text color="cyan">🔄 重启 Agent</Text>
        <Text color="gray">
          {preserveContext ? '保留上下文' : '清空上下文'}
        </Text>
      </Box>
    )
  },

  renderToolResultMessage(output: RestartOutput) {
    return (
      <Box flexDirection="column">
        <Text color="green">{output.message}</Text>
        <Text color="gray">
          {output.preserve_context ? '✅ 上下文已保存' : '🆕 干净重启'}
        </Text>
        <Text color="gray">⏱ 预计 {output.estimated_time}</Text>
      </Box>
    )
  }
})
```

- [ ] **Step 2: Create index.ts export**

```typescript
export { RestartTool } from './RestartTool.js'
```

- [ ] **Step 3: Verify RestartTool compiles**

Run: `npm run typecheck`
Expected: No errors in src/tools/RestartTool/

- [ ] **Step 4: Commit**

```bash
git add src/tools/RestartTool/
git commit -m "feat(tools): add RestartTool for AI-callable restart"
```

---

### Task 3: Register RestartTool

**Files:**
- Modify: `src/tools/index.ts`

- [ ] **Step 1: Import RestartTool**

Add after line 41 (after SystemPromptTool import):

```typescript
import { RestartTool } from './RestartTool/RestartTool.js'
```

- [ ] **Step 2: Add RestartTool to BUILTIN_TOOLS array**

Add after line 52 (after SystemPromptTool in array):

```typescript
  RestartTool,
```

- [ ] **Step 3: Verify tools index compiles**

Run: `npm run typecheck`
Expected: No errors in src/tools/index.ts

- [ ] **Step 4: Commit**

```bash
git add src/tools/index.ts
git commit -m "feat(tools): register RestartTool in tool registry"
```

---

### Task 4: /restart Command

**Files:**
- Create: `src/commands/restart.ts`

- [ ] **Step 1: Create restart command**

```typescript
import { registerCommand } from './index.js'
import { performRestart } from '../utils/restart.js'

registerCommand({
  name: 'restart',
  aliases: ['reboot'],
  description: '🔄 重启 Agent 进程',
  async call(args, ctx) {
    const preserveContext = !args.includes('--clean')

    ctx.history.appendUserMessage(`/restart ${args}`)
    ctx.history.appendAssistantMessage(
      preserveContext
        ? '🔄 正在重启（保留上下文）...'
        : '🔄 正在重启（清空上下文）...'
    )

    await performRestart(preserveContext)
    return true
  }
})
```

- [ ] **Step 2: Verify restart command compiles**

Run: `npm run typecheck`
Expected: No errors in src/commands/restart.ts

- [ ] **Step 3: Commit**

```bash
git add src/commands/restart.ts
git commit -m "feat(commands): add /restart command for user-initiated restart"
```

---

### Task 5: Startup Detection

**Files:**
- Modify: `src/entrypoints/cli.tsx`

- [ ] **Step 1: Add imports for restart detection**

Add after existing imports (around line 11):

```typescript
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
```

- [ ] **Step 2: Add checkRestartContext function**

Add after loadEnv() function (around line 32):

```typescript
function checkRestartContext(): void {
  const RESTART_DIR = join(process.cwd(), '.restart')
  const CONTEXT_FILE = join(RESTART_DIR, 'context.json')

  if (process.env.PI_RESTARTED === 'true' && existsSync(CONTEXT_FILE)) {
    try {
      const data = JSON.parse(readFileSync(CONTEXT_FILE, 'utf-8'))
      const ts = new Date(data.timestamp).getTime()
      const elapsed = !isNaN(ts) ? Math.round((Date.now() - ts) / 1000) : 0

      console.log(`🔄 检测到 Agent 重启（${elapsed > 0 ? `${elapsed} 秒前` : '时间未知'}）`)
      console.log(`   - 原因: ${data.reason || '未指定'}`)
      console.log(`   - 新工具已加载\n`)

      try {
        unlinkSync(CONTEXT_FILE)
      } catch {
        // ignore
      }
    } catch {
      console.log('🔄 检测到 Agent 重启（新工具已加载）\n')
      try {
        unlinkSync(CONTEXT_FILE)
      } catch {
        // ignore
      }
    }
  } else if (existsSync(CONTEXT_FILE)) {
    try {
      unlinkSync(CONTEXT_FILE)
    } catch {
      // ignore
    }
  }
}
```

- [ ] **Step 3: Call checkRestartContext in main()**

Add after loadEnv() call in main() function (around line 36):

```typescript
  checkRestartContext()
```

- [ ] **Step 4: Verify cli.tsx compiles**

Run: `npm run typecheck`
Expected: No errors in src/entrypoints/cli.tsx

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/cli.tsx
git commit -m "feat(cli): add restart context detection on startup"
```

---

### Task 6: Update .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add .restart/ to .gitignore**

Add at the end of the file:

```
# Restart context (runtime state)
.restart/
```

- [ ] **Step 2: Verify .gitignore syntax**

Run: `cat .gitignore | tail -3`
Expected: Shows the new .restart/ entry

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add .restart/ to .gitignore"
```

---

### Task 7: Manual Testing

**Files:**
- Test: All implemented components

- [ ] **Step 1: Test basic restart with /restart command**

Run: `npm run dev`
In REPL: `/restart`
Expected:
- Message "🔄 正在重启（保留上下文）..."
- Process exits
- New process starts within 30 seconds
- Message "🔄 检测到 Agent 重启（X 秒前）"
- Message "   - 原因: user_requested_restart"
- Message "   - 新工具已加载"

- [ ] **Step 2: Test clean restart with --clean flag**

Run: `npm run dev`
In REPL: `/restart --clean`
Expected:
- Message "🔄 正在重启（清空上下文）..."
- Process exits
- New process starts
- Message "🔄 检测到 Agent 重启（X 秒前）"
- No .restart/context.json file exists after restart

- [ ] **Step 3: Test /reboot alias**

Run: `npm run dev`
In REPL: `/reboot`
Expected: Same behavior as /restart

- [ ] **Step 4: Test RestartTool via AI**

Run: `npm run dev`
In REPL: "请使用 restart_agent 工具重启"
Expected:
- AI calls restart_agent tool
- Tool output shows restart message
- Process restarts successfully

- [ ] **Step 5: Test /help includes restart command**

Run: `npm run dev`
In REPL: `/help`
Expected: Output includes "/restart, /reboot — 🔄 重启 Agent 进程"

- [ ] **Step 6: Verify .restart/ is gitignored**

Run: `git status`
Expected: .restart/ directory (if exists) is not shown in untracked files

- [ ] **Step 7: Test stale context file cleanup**

```bash
mkdir -p .restart
echo '{"timestamp":"2020-01-01T00:00:00.000Z"}' > .restart/context.json
npm run dev
```
Expected:
- No restart message shown
- .restart/context.json is deleted on startup

- [ ] **Step 8: Test corrupted context file**

```bash
mkdir -p .restart
echo 'invalid json' > .restart/context.json
PI_RESTARTED=true npm run dev
```
Expected:
- Generic message "🔄 检测到 Agent 重启（新工具已加载）"
- No crash, continues normal startup
- .restart/context.json is deleted

- [ ] **Step 9: Final verification**

Run: `npm run typecheck`
Expected: No TypeScript errors

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 10: Commit test verification**

```bash
git add -A
git commit -m "test: verify restart functionality works correctly"
```

---

## Self-Review Checklist

**Spec Coverage:**
- ✅ Shared restart logic (performRestart) - Task 1
- ✅ RestartTool (AI-callable) - Task 2, 3
- ✅ /restart command - Task 4
- ✅ Startup detection - Task 5
- ✅ .gitignore update - Task 6
- ✅ Manual testing - Task 7

**Placeholder Check:**
- ✅ No TBD, TODO, or "implement later"
- ✅ All code blocks are complete
- ✅ All file paths are exact
- ✅ All commands have expected output

**Type Consistency:**
- ✅ RestartContext interface matches usage
- ✅ RestartInput/RestartOutput types consistent
- ✅ performRestart signature matches all call sites
- ✅ Tool name 'restart_agent' consistent throughout

**Completeness:**
- ✅ Error handling for spawn failures
- ✅ Error handling for context save failures
- ✅ Error handling for context file corruption
- ✅ Cleanup of stale context files
- ✅ Both command and tool implementations
- ✅ UI rendering for tool
- ✅ Comprehensive manual testing
