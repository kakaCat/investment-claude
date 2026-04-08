# Harness 日志设计

**日期**: 2026-04-29
**状态**: 待实现
**参考**: Claude Code `src/utils/debug.ts`, `src/utils/diagLogs.ts`

---

## 概述

为 pi 实现两套系统级日志，覆盖 harness 自身的运行状态：

1. **Debug 日志** — 始终写入，文本格式，供开发者调试
2. **Harness 诊断日志** — JSONL 格式，PII-free，供系统监控

这两套日志与现有的 AI 可观察日志（`observability/`）和用户历史（`history.ts`）是独立的，各有不同的消费者和目的。

---

## 文件职责分工

| | Debug 日志 | Harness 诊断日志 |
|---|---|---|
| **路径** | `~/.pi/debug/{sessionId}.txt` | `~/.pi/diagnostics/{sessionId}.jsonl`（默认）|
| **覆盖** | 无 | `PI_DIAGNOSTICS_FILE` 环境变量 |
| **格式** | 文本：`{timestamp} [LEVEL] message\n` | JSONL：`{timestamp, level, event, data}\n` |
| **触发** | 始终写入 | 始终写入（除非磁盘不可用） |
| **内容** | 详细信息，可含 stdout/stderr | PII-free，只含事件名和耗时 |
| **symlink** | `~/.pi/debug/latest` | 无 |
| **写入方式** | 异步 append | 同步 appendFileSync |

---

## Debug 日志：src/utils/debug.ts

### API

```ts
export type DebugLogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error'

// 写入一条 debug 日志
export function logForDebugging(
  message: string,
  options?: { level?: DebugLogLevel },
): void

// 返回当前 session 的 debug 日志路径
export function getDebugLogPath(): string
```

### 实现要点

- 日志格式：`2026-04-29T12:00:00.000Z [DEBUG] message\n`
- 懒初始化：首次调用时创建目录 `~/.pi/debug/` 和文件
- 异步写入：`appendFile`，通过 `pendingWrite` Promise 链串行写入（避免并发乱序）
- 进程退出前 flush：调用 `registerCleanup` 等待 `pendingWrite` 完成
- 启动时创建 symlink：`~/.pi/debug/latest` → 当前 session 日志文件
  - 先 `unlink` 再 `symlink`，失败静默忽略

### 简化说明（相较于 CC）

CC 的 debug.ts 移除以下功能（pi 不需要）：
- BufferedWriter（单进程，简单 Promise 链足够）
- `ant` / `USER_TYPE` 区分
- `--debug` / `--debug=pattern` / `--debug-file` 命令行标志
- DebugFilter 子串匹配

---

## Harness 诊断日志：src/utils/diagLogs.ts

### API

```ts
export type DiagnosticLogLevel = 'debug' | 'info' | 'warn' | 'error'

// PII-free 系统事件日志（同步写入）
export function logForDiagnosticsNoPII(
  level: DiagnosticLogLevel,
  event: string,
  data?: Record<string, unknown>,
): void

// 包装异步函数，自动记录 started/completed/failed + duration_ms
export async function withDiagnosticsTiming<T>(
  event: string,
  fn: () => Promise<T>,
  getData?: (result: T) => Record<string, unknown>,
): Promise<T>
```

### 日志格式（JSONL）

```json
{"timestamp":"2026-04-29T12:00:00.000Z","level":"info","event":"hook_completed","data":{"hook":"UserPromptSubmit","duration_ms":12,"outcome":"success"}}
```

### 默认路径逻辑

```ts
function getDiagnosticLogFile(): string {
  return process.env.PI_DIAGNOSTICS_FILE
    ?? join(homedir(), '.pi', 'diagnostics', `${getSessionId()}.jsonl`)
}
```

### 实现要点（完全对标 CC）

- 同步写入（`appendFileSync`），因为常从同步上下文调用
- 写入失败时先尝试 `mkdirSync` 创建目录，再重试
- 两次都失败则静默忽略（logging non-critical）

---

## 记录事件列表

### hooks/executor.ts 新增

| 事件 | hook 类型 | debug 内容 | diag 事件 |
|---|---|---|---|
| hook 开始 | command | `hook {name} started` | `hook_started {hook, type}` |
| hook 完成 | command | `hook {name} exit={code} stdout={...}` | `hook_completed {hook, duration_ms, outcome}` |
| hook 超时 | command | `hook {name} timed out after {n}ms` | `hook_failed {hook, duration_ms, reason: "timeout"}` |
| hook 失败 | command | `hook {name} error: {msg}` | `hook_failed {hook, duration_ms}` |
| function hook | function | `hook {name} fn called` | 仅 debug，不写 diag（function hook 是内部代码，非外部进程）|

### cli.tsx 新增

| 事件 | debug 内容 | diag 事件 |
|---|---|---|
| 进程启动 | `pi started pid={pid}` | `cli_entry` |

### REPL.tsx 新增

| 事件 | 触发条件 | debug 内容 | diag 事件 |
|---|---|---|---|
| compact 触发 | `/compact` 命令 | `compact triggered` | `compact_triggered` |
| session 结束 | exit/Ctrl+C | `session ended reason={reason}` | `session_end {reason}` |
| stream 超时警告 | query 耗时 > 30s | `streaming idle {n}ms` | `streaming_idle_warning {duration_ms}` |

---

## 文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/utils/debug.ts` | 新增 | Debug 日志（简化版 CC） |
| `src/utils/diagLogs.ts` | 新增 | Harness 诊断日志（完全对标 CC） |
| `src/hooks/executor.ts` | 修改 | command hook 执行前后写两个日志 |
| `src/entrypoints/cli.tsx` | 修改 | `cli_entry` 事件 |
| `src/screens/REPL.tsx` | 修改 | compact、session_end、streaming_idle_warning |

---

## 约束与边界

- debug.ts **不依赖** diagLogs.ts，反之亦然（独立模块）
- 两个日志都依赖 `registerCleanup`（已有）和 `getSessionId()`（已有）
- diagLogs.ts 不记录任何文件路径、prompt 内容、用户输入（PII-free 严格执行）
- function hook 的执行只写 debug 日志（不写 diag），因为 function hook 是内部 TypeScript 函数，无 exit code 和 stdout
- stream 超时检测：query loop 中用 `Date.now()` 计时，超过 30s 无新 token 则触发警告（在 REPL.tsx 的 query 循环中实现）
