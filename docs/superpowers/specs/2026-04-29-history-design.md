# 项目日志（History）设计

**日期**: 2026-04-29  
**状态**: 待实现  
**参考**: Claude Code `src/history.ts`, `src/hooks/useHistorySearch.ts`

---

## 概述

为 pi 实现持久化的用户输入历史，支持：
- 跨 session、按项目隔离的历史记录
- ↑/↓ 箭头翻历史
- Ctrl+R 内联模糊搜索（reverse-i-search 风格）

完全对标 CC 方案（方案 A），包含文件锁、pending buffer、paste store。

---

## 存储层

### 存储文件

```
~/.pi/history.jsonl       # 历史主文件（JSONL，一行一条）
~/.pi/paste-cache/        # 大粘贴内容（>1024 bytes）的内容寻址存储
```

### LogEntry（磁盘格式）

```ts
type StoredPastedContent = {
  id: number
  type: 'text' | 'image'
  content?: string        // 小内容，inline 存储
  contentHash?: string    // 大内容，SHA256 引用到 paste-cache/
  mediaType?: string
  filename?: string
}

type LogEntry = {
  display: string                              // 用户输入文本
  pastedContents: Record<number, StoredPastedContent>
  timestamp: number                            // Date.now()
  project: string                              // getProjectRoot()
  sessionId?: string                           // getSessionId()
}
```

### HistoryEntry（内存格式，供 UI 使用）

```ts
type PastedContent = {
  id: number
  type: 'text' | 'image'
  content: string
  mediaType?: string
  filename?: string
}

type HistoryEntry = {
  display: string
  pastedContents: Record<number, PastedContent>
}
```

### 粘贴内容分流规则

- `content.length ≤ 1024` → inline 存入 LogEntry.pastedContents
- `content.length > 1024` → SHA256 hash 存为引用，内容异步写到 `~/.pi/paste-cache/{hash}.txt`
- 图片类型（type === 'image'）→ 直接跳过，不存入历史

### 写入机制

```
addToHistory(input)
  └─→ 构造 LogEntry（含 timestamp、project、sessionId）
  └─→ push 到 pendingEntries[]
  └─→ 异步触发 flushPromptHistory(retries=0)
        └─→ 获取 proper-lockfile 锁
        └─→ appendFile(historyPath, jsonLines)
        └─→ 释放锁
        └─→ 如果还有 pending，sleep(500ms) 后重试（最多 5 次）

进程退出（registerCleanup）:
  └─→ 等待 currentFlushPromise
  └─→ 如果还有 pending → immediateFlushHistory()
```

### removeLastFromHistory()

用于 Esc 撤销最近一次提交时：
- **fast path**：entry 还在 pendingEntries → 直接 splice 删除
- **slow path**：entry 已 flush → 将 timestamp 加入 `skippedTimestamps` Set
  - 读取时跳过该 timestamp 的条目（仅当前 session 生效）

---

## 读取层

### getHistory() — ↑/↓ 用

```
async function* getHistory(): AsyncGenerator<HistoryEntry>
```

- 先从 `pendingEntries`（内存）逆序出，再从磁盘逆序读
- 过滤：`entry.project === getProjectRoot()`
- 当前 session 条目优先，其他 session 条目排后
- 跳过 `skippedTimestamps` 中的条目
- 最多 100 条（`MAX_HISTORY_ITEMS = 100`）

### makeHistoryReader() — Ctrl+R 用

```
async function* makeHistoryReader(): AsyncGenerator<HistoryEntry>
```

- 不过滤 project（全量，由 useHistorySearch 自行过滤）
- 同样先 pending 后磁盘，跳过 skippedTimestamps
- 调用方需显式调用 `.return()` 关闭（防 fd 泄漏）

### getTimestampedHistory() — 备用

```
async function* getTimestampedHistory(): AsyncGenerator<TimestampedHistoryEntry>
```

- 当前项目去重（按 display），最新在前
- 返回 `{ display, timestamp, resolve: () => Promise<HistoryEntry> }`
- 粘贴内容懒加载（调用 resolve() 才从 paste-cache 读取）

### readLinesReverse(filePath)

从文件末尾往前逐行读，避免把整个文件加载到内存。实现方式：
- 分块读取（8KB 块），从文件末尾向前移动读指针
- 拼接跨块的行
- 使用 try/finally 确保文件句柄关闭

---

## 工具层

### src/utils/lockfile.ts

懒加载 `proper-lockfile`，避免影响启动时间：

```ts
export function lock(file: string, options?: LockOptions): Promise<() => Promise<void>>
export function unlock(file: string, options?: UnlockOptions): Promise<void>
```

### src/utils/pasteStore.ts

内容寻址存储：

```ts
export function hashPastedText(content: string): string  // SHA256，取前16位
export async function storePastedText(hash: string, content: string): Promise<void>
export async function retrievePastedText(hash: string): Promise<string | null>
export async function cleanupOldPastes(cutoffDate: Date): Promise<void>
```

存储路径：`~/.pi/paste-cache/{hash}.txt`

### src/utils/cleanupRegistry.ts

进程退出时的异步 cleanup 注册表：

```ts
export function registerCleanup(fn: () => Promise<void>): void
// 在 process 'exit' / 'SIGTERM' / 'SIGINT' 时依次执行注册的 cleanup 函数
```

---

## UI 层

### src/hooks/useHistorySearch.ts

对标 CC 的 `useHistorySearch`，简化版（无 inputModes、无 keybinding 系统）：

```ts
export function useHistorySearch(
  onAcceptHistory: (entry: HistoryEntry) => void,
  currentInput: string,
  onInputChange: (input: string) => void,
  isSearching: boolean,
  setIsSearching: (v: boolean) => void,
): {
  historyQuery: string
  setHistoryQuery: (q: string) => void
  historyMatch: HistoryEntry | undefined
  historyFailedMatch: boolean
}
```

内部逻辑：
- `isSearching` 开启时，监听键盘输入更新 `historyQuery`
- `historyQuery` 变化时，从头重新搜索（`makeHistoryReader()`）
- Ctrl+R（再次按）→ resume 搜索下一个匹配
- `display.lastIndexOf(query)` 子串匹配
- 匹配到 → `onInputChange(match.display)`
- `Enter` → `onAcceptHistory(match)`，退出搜索
- `Escape` / `Ctrl+G` → 恢复原始输入，退出搜索
- `Backspace`（query 为空）→ 取消搜索

### src/components/PromptInput.tsx 变更

新增状态：
```ts
const [historyIndex, setHistoryIndex] = useState(-1)     // -1 = 未在翻历史
const [historyCache, setHistoryCache] = useState<string[]>([])
const [isSearching, setIsSearching] = useState(false)
const [savedInput, setSavedInput] = useState('')         // 翻历史前保存的原始输入
```

键盘处理新增：
```
key.upArrow（非搜索模式）:
  → 如果 historyCache 未加载，从 getHistory() 加载至 string[]
  → historyIndex + 1，填入对应条目

key.downArrow（非搜索模式）:
  → historyIndex - 1
  → 到 -1 时恢复 savedInput

ctrl+r（非搜索模式）:
  → 保存当前 input 到 savedInput
  → setIsSearching(true)

ctrl+r（搜索模式）:
  → 找下一个匹配（resume）
```

搜索状态下的 UI（输入框上方添加一行）：
```
(reverse-i-search)'<query>': <match>
```

失败时显示：
```
(failed reverse-i-search)'<query>': <last-match>
```

---

## 集成点

### src/screens/REPL.tsx

在 `handleSubmit` 中，跳过 slash commands 后、调用 `query()` 前：

```ts
import { addToHistory } from '../history.js'

// 在用户提交普通输入时（非 slash command）:
addToHistory(input)
```

### package.json

```json
"proper-lockfile": "^4.1.2"
```

---

## 文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/history.ts` | 新增 | 存储层核心 |
| `src/utils/lockfile.ts` | 新增 | proper-lockfile 懒加载封装 |
| `src/utils/fsOperations.ts` | 新增 | readLinesReverse |
| `src/utils/pasteStore.ts` | 新增 | paste-cache 读写 |
| `src/utils/cleanupRegistry.ts` | 新增 | 进程退出 cleanup |
| `src/hooks/useHistorySearch.ts` | 新增 | Ctrl+R 搜索 hook |
| `src/components/PromptInput.tsx` | 修改 | ↑/↓ + Ctrl+R 集成 |
| `src/screens/REPL.tsx` | 修改 | addToHistory 调用 |
| `package.json` | 修改 | proper-lockfile 依赖 |

---

## 约束与边界

- pi 是单进程，文件锁是为了与未来多进程场景兼容，当前不会实际竞争
- 粘贴内容（pastedContents）当前 pi 没有粘贴 UI，`addToHistory` 调用时传空 `{}`，架构预留
- `removeLastFromHistory` 当前 pi 没有 Esc 撤销功能，不在本次实现范围内，但 `history.ts` 中保留该函数
- MAX_HISTORY_ITEMS = 100
- MAX_PASTED_CONTENT_LENGTH = 1024
