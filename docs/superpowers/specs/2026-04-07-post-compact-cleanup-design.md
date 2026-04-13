# 设计：压缩后重载文件（Post-Compact Cleanup）

**日期**: 2026-04-07
**对标**: CC `src/services/compact/postCompactCleanup.ts`

---

## 问题

compact 完成后，系统提示词各段（`claude_md`、`workspace`、`env_info`）的缓存仍然有效。下一轮 `getSystemPrompt` 直接命中旧缓存，不会重新读取 CLAUDE.md 等文件。这意味着用户在 compact 后修改的 CLAUDE.md 不会生效，workspace 信息也不会刷新。

CC 通过 `runPostCompactCleanup()` 集中处理这个问题，在所有 compact 路径都调用。

---

## 设计

### 新增文件：`src/compact/postCompactCleanup.ts`

```ts
import { clearSectionCache } from '../constants/prompts.js'

/**
 * 压缩后清理 — 对标 CC src/services/compact/postCompactCleanup.ts
 *
 * 清除系统提示词缓存，让下一轮重新加载 CLAUDE.md、workspace、env_info 等段。
 * 在所有 compact 路径（auto、manual、partial）完成后调用。
 */
export function runPostCompactCleanup(): void {
  clearSectionCache()
}
```

**为什么只有 `clearSectionCache()`？**

CC 的 `runPostCompactCleanup` 还清理了：
- `resetGetMemoryFilesCache` — pi 用 MemorySearchTool 替代，无此缓存
- `clearClassifierApprovals` / `clearSpeculativeChecks` — pi 无权限分类器
- `clearSessionMessagesCache` — pi 无此缓存
- `resetMicrocompactState` — pi 的 microcompact 无模块级状态

所以 pi 只需要 `clearSectionCache()`，其余是 CC 特有的。

---

### 调用点（4处）

#### 1. `src/query.ts` — auto-compact 路径

```ts
// 现有代码（约 443 行）
if (compactResult.wasCompacted && compactResult.result) {
  messagesForQuery = compactResult.result.newMessages
  yield { type: 'compact_start' }
  yield { type: 'compact_done', ... }
  runPostCompactCleanup()   // ← 新增
}
```

#### 2. `src/screens/REPL.tsx` — `runCompact`（手动 /compact）

```ts
const result = await compactConversation(...)
conversationRef.current = result.newMessages
runPostCompactCleanup()   // ← 新增
history.appendUserMessage(...)
```

#### 3 & 4. `src/screens/REPL.tsx` — partial compact from / up-to（两处）

```ts
const result = await partialCompactConversation(...)
conversationRef.current = result.newMessages
runPostCompactCleanup()   // ← 新增
history.appendUserMessage(...)
```

**注意**：`/compact` 命令走 `ctx.runCompact()`，所以 REPL 里的 `runCompact` 已覆盖命令路径，`commands/compact.ts` 不需要改动。

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/compact/postCompactCleanup.ts` | 新建 |
| `src/query.ts` | 修改：auto-compact 成功后调用 |
| `src/screens/REPL.tsx` | 修改：runCompact + 2处 partial compact 后调用 |
