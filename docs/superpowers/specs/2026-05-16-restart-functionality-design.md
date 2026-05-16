# Restart Functionality Design

**Date**: 2026-05-16
**Status**: Approved
**Reference**: `/Users/mac/Documents/ai/pi-investment` restart implementation

## Overview

Implement a lightweight restart mechanism that allows the agent to restart its TypeScript process without exiting the terminal session. This enables new tools to take effect, recovers from performance degradation, and provides a clean restart option when needed.

## Use Cases

1. **New tool registration** - After adding new tools to the codebase, restart to make them available
2. **Performance recovery** - Long-running sessions can restart to clear memory and restore performance
3. **General cleanup** - User-initiated clean restart when needed
4. **Error recovery** - Recover from stuck states or unexpected errors

## Architecture

### Design Approach

**Lightweight restart** - Simplified implementation suitable for the current architecture:
- Save restart context to `.restart/context.json`
- Spawn new TypeScript process using `child_process.spawn`
- Current process exits
- New process detects context and restores state
- **No Python process management** - Current project uses on-demand Python spawning (not daemon mode)

### Core Components

```
src/utils/restart.ts          # Shared restart logic
src/tools/RestartTool/         # AI-callable tool
src/commands/restart.ts        # User /restart command
src/entrypoints/cli.tsx        # Startup detection (modified)
.restart/context.json          # Restart context (gitignored)
```

## Component Design

### 1. Shared Restart Logic (`src/utils/restart.ts`)

Provides `performRestart(preserveContext: boolean): Promise<void>`

**Responsibilities**:
- Save restart context to `.restart/context.json`
- Detect correct spawn command (tsx binary + entry file)
- Spawn new process with detached mode
- Schedule current process exit

**Context Structure**:
```typescript
{
  timestamp: string,        // ISO timestamp
  cwd: string,             // Working directory
  reason: string,          // Restart reason
  env: {                   // Environment snapshot
    NODE_ENV: string,
    // Other relevant env vars
  }
}
```

**Spawn Command Detection**:
1. Check local `node_modules/.bin/tsx` (preferred)
2. Fallback to global `tsx`
3. Entry file from `process.argv[1]` (tsx runtime entry)
4. Hardcoded fallback: `src/entrypoints/cli.tsx`

**Spawn Configuration**:
```typescript
spawn(cmd, args, {
  cwd: process.cwd(),
  stdio: 'inherit',      // Inherit stdio
  detached: true,        // Independent process
  env: {
    ...process.env,
    PI_RESTARTED: 'true',
    PI_RESTART_TIMESTAMP: new Date().toISOString()
  }
})
```

**Exit Timing**:
```typescript
setImmediate(() => {
  if (!spawnFailed) {
    process.exit(0)
  }
})
```
Ensures tool response returns before process exits.

### 2. RestartTool (`src/tools/RestartTool/RestartTool.tsx`)

AI-callable tool for automated restart scenarios.

**Tool Definition**:
- **Name**: `restart_agent`
- **Description**: Restart the agent process without leaving the terminal. Use when new tools need to take effect, performance degrades, or a clean restart is needed.
- **Parameters**:
  - `preserve_context` (optional, default: `true`) - Whether to save and restore conversation context

**Implementation**:
```typescript
async call(input, context) {
  const preserveContext = input.preserve_context !== false
  await performRestart(preserveContext)

  return {
    data: {
      message: '🔄 Agent 重启中...',
      preserve_context: preserveContext,
      estimated_time: '10-30秒'
    }
  }
}
```

**UI Rendering**:
- Show restart status with emoji indicator
- Display context preservation status
- Show estimated restart time
- Mention that new tools will be available after restart

### 3. /restart Command (`src/commands/restart.ts`)

User-facing slash command for manual restart.

**Command Definition**:
- **Name**: `restart`
- **Aliases**: `reboot`
- **Description**: `🔄 重启 Agent 进程`
- **Usage**:
  - `/restart` - Restart with context preservation
  - `/restart --clean` - Clean restart without context

**Implementation**:
```typescript
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

### 4. Startup Detection (`src/entrypoints/cli.tsx`)

Modify CLI entry point to detect and handle restart context.

**Detection Logic**:
```typescript
function checkRestartContext(): void {
  const RESTART_DIR = join(process.cwd(), '.restart')
  const CONTEXT_FILE = join(RESTART_DIR, 'context.json')

  if (process.env.PI_RESTARTED === 'true' && existsSync(CONTEXT_FILE)) {
    try {
      const data = JSON.parse(readFileSync(CONTEXT_FILE, 'utf-8'))
      const elapsed = Math.round((Date.now() - new Date(data.timestamp).getTime()) / 1000)

      console.log(`🔄 检测到 Agent 重启（${elapsed} 秒前）`)
      console.log(`   - 原因: ${data.reason || '未指定'}`)
      console.log(`   - 新工具已加载\n`)

      unlinkSync(CONTEXT_FILE)
    } catch {
      console.log('🔄 检测到 Agent 重启（新工具已加载）\n')
      try { unlinkSync(CONTEXT_FILE) } catch {}
    }
  } else if (existsSync(CONTEXT_FILE)) {
    // Clean up stale context file
    try { unlinkSync(CONTEXT_FILE) } catch {}
  }
}

// Call early in main()
checkRestartContext()
```

## Data Flow

```
User: /restart
  ↓
restart command
  ↓
performRestart(true)
  ↓
1. Save context to .restart/context.json
2. Spawn new process (detached)
3. Return success message
4. Exit current process (setImmediate)
  ↓
New process starts
  ↓
checkRestartContext()
  ↓
Display restart message
Clean up context file
  ↓
Continue normal operation
```

## Error Handling

### Spawn Failures
- Listen for `child.on('error')` event
- If spawn fails, log error and keep current process running
- User sees error message and can retry

### Context Save Failures
- Log error but continue with restart
- Restart proceeds even if context save fails
- User loses context but gets a working restart

### Context File Corruption
- Catch JSON parse errors during startup
- Display generic restart message
- Clean up corrupted file
- Continue normal startup

## File Structure

```
src/
  utils/
    restart.ts                    # Shared restart logic
  tools/
    RestartTool/
      RestartTool.tsx             # Tool implementation
      index.ts                    # Export
  commands/
    restart.ts                    # /restart command
  entrypoints/
    cli.tsx                       # Modified for detection

.restart/                         # Created at runtime
  context.json                    # Restart context (gitignored)

.gitignore                        # Add .restart/
```

## Testing Strategy

### Manual Testing
1. **Basic restart**: `/restart` → verify new process starts, context preserved
2. **Clean restart**: `/restart --clean` → verify context cleared
3. **Tool call**: AI calls `restart_agent` → verify automated restart works
4. **Spawn failure**: Break tsx path → verify graceful error handling
5. **Context corruption**: Corrupt JSON → verify startup continues

### Edge Cases
- Multiple rapid restart attempts
- Restart during active tool execution
- Restart with no .restart directory
- Restart with stale context file

## Future Enhancements

### Python Daemon Support
If the project migrates to daemon mode for Python bridge:

```typescript
// Add to performRestart()
function killPythonBridge(): boolean {
  try {
    const result = execSync("pgrep -f 'akshare_bridge.py' 2>/dev/null || true", {
      encoding: 'utf-8',
      timeout: 3000
    })
    const pids = result.trim().split('\n').filter(Boolean)
    if (pids.length > 0) {
      execSync(`kill ${pids.join(' ')} 2>/dev/null || true`, { timeout: 3000 })
      return true
    }
    return false
  } catch {
    return false
  }
}
```

### Context Restoration
Currently context is saved but not actively restored. Future enhancement could:
- Restore conversation history
- Restore AppState
- Resume interrupted tasks

### Restart Hooks
Allow tools to register cleanup/restore hooks:
```typescript
registerRestartHook({
  beforeRestart: async () => { /* cleanup */ },
  afterRestart: async () => { /* restore */ }
})
```

## Security Considerations

- `.restart/` directory should be gitignored (contains runtime state)
- Context file should not contain sensitive data (API keys, tokens)
- Spawn command validation to prevent command injection
- File permissions: context file should be user-readable only

## Performance

- Context save: < 10ms (small JSON write)
- Spawn overhead: ~100-200ms
- New process startup: 10-30 seconds (TypeScript compilation + initialization)
- Total user-perceived downtime: 10-30 seconds

## Success Criteria

- ✅ User can restart via `/restart` command
- ✅ AI can restart via `restart_agent` tool
- ✅ New process starts successfully
- ✅ Restart message displays on new process startup
- ✅ Context file is cleaned up after restart
- ✅ Graceful error handling for spawn failures
- ✅ No Python process management (current architecture)
