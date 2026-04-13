# Post-Compact Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在所有 compact 路径完成后调用 `runPostCompactCleanup()`，清除系统提示词缓存，让下一轮重新加载 CLAUDE.md 等文件。

**Architecture:** 新建 `src/compact/postCompactCleanup.ts` 作为集中清理入口，内部调用 `clearSectionCache()`。在 auto-compact（`src/query.ts`）和手动/partial compact（`src/screens/REPL.tsx`）的成功路径上各插入一次调用。

**Tech Stack:** TypeScript, 无新依赖

---

## File Map

| 文件 | 操作 |
|------|------|
| `src/compact/postCompactCleanup.ts` | 新建 |
| `src/query.ts` | 修改第 443-452 行：auto-compact 成功后调用 |
| `src/screens/REPL.tsx` | 修改第 178-196 行（runCompact）+ 第 478 行（partial from）+ 第 504 行（partial up-to） |

---

## Task 1: 新建 `postCompactCleanup.ts`

**Files:**
- Create: `src/compact/postCompactCleanup.ts`

- [ ] **Step 1: 创建文件**

```ts
// src/compact/postCompactCleanup.ts
// 压缩后清理 — 对标 CC src/services/compact/postCompactCleanup.ts

import { clearSectionCache } from '../constants/prompts.js'

/**
 * 压缩后清理缓存，让下一轮重新加载 CLAUDE.md、workspace、env_info 等段。
 * 在所有 compact 路径（auto、manual、partial）成功后调用。
 */
export function runPostCompactCleanup(): void {
  clearSectionCache()
}
```

- [ ] **Step 2: 确认编译无报错**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npx tsc --noEmit 2>&1 | head -20
```

Expected: 无输出（无错误）

- [ ] **Step 3: Commit**

```bash
git add src/compact/postCompactCleanup.ts
git commit -m "feat(compact): add runPostCompactCleanup"
```

---

## Task 2: 接入 auto-compact 路径（`src/query.ts`）

**Files:**
- Modify: `src/query.ts:443-452`

- [ ] **Step 1: 在 import 区加入 `runPostCompactCleanup`**

在 `src/query.ts` 顶部找到 compact 相关 import（约第 16-20 行），加入：

```ts
import { runPostCompactCleanup } from './compact/postCompactCleanup.js'
```

- [ ] **Step 2: 在 auto-compact 成功后调用**

找到第 443-452 行：

```ts
    if (compactResult.wasCompacted && compactResult.result) {
      messagesForQuery = compactResult.result.newMessages
      yield { type: 'compact_start' }
      yield {
        type: 'compact_done',
        savedTokens: compactResult.result.savedTokens,
        summaryLength: compactResult.result.summaryLength,
        newMessages: compactResult.result.newMessages,
      }
    }
```

替换为：

```ts
    if (compactResult.wasCompacted && compactResult.result) {
      messagesForQuery = compactResult.result.newMessages
      runPostCompactCleanup()
      yield { type: 'compact_start' }
      yield {
        type: 'compact_done',
        savedTokens: compactResult.result.savedTokens,
        summaryLength: compactResult.result.summaryLength,
        newMessages: compactResult.result.newMessages,
      }
    }
```

- [ ] **Step 3: 确认编译无报错**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npx tsc --noEmit 2>&1 | head -20
```

Expected: 无输出

- [ ] **Step 4: Commit**

```bash
git add src/query.ts
git commit -m "feat(compact): call runPostCompactCleanup after auto-compact"
```

---

## Task 3: 接入手动 compact 路径（`src/screens/REPL.tsx` `runCompact`）

**Files:**
- Modify: `src/screens/REPL.tsx:175-196`

- [ ] **Step 1: 在 import 区加入 `runPostCompactCleanup`**

在 `src/screens/REPL.tsx` 顶部找到 compact 相关 import（约第 24 行），加入：

```ts
import { runPostCompactCleanup } from '../compact/postCompactCleanup.js'
```

- [ ] **Step 2: 在 `runCompact` 成功后调用**

找到第 175-196 行的 `runCompact`：

```ts
  const runCompact = useCallback(async (sessionId: string) => {
    emitCompactTriggeredLog()
    setIsLoading(true)
    isLoadingRef.current = true
    try {
      const result = await compactConversation(conversationRef.current, {
        suppressFollowUpQuestions: false,
        sessionId,
      })
      conversationRef.current = result.newMessages
      history.appendUserMessage(
        `[System: Conversation compacted. Saved ~${result.savedTokens.toLocaleString()} tokens]`,
      )
    } catch (err) {
      history.appendUserMessage(
        `[System: Compact failed — ${err instanceof Error ? err.message : String(err)}]`,
      )
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
    }
  }, [history])
```

替换为：

```ts
  const runCompact = useCallback(async (sessionId: string) => {
    emitCompactTriggeredLog()
    setIsLoading(true)
    isLoadingRef.current = true
    try {
      const result = await compactConversation(conversationRef.current, {
        suppressFollowUpQuestions: false,
        sessionId,
      })
      conversationRef.current = result.newMessages
      runPostCompactCleanup()
      history.appendUserMessage(
        `[System: Conversation compacted. Saved ~${result.savedTokens.toLocaleString()} tokens]`,
      )
    } catch (err) {
      history.appendUserMessage(
        `[System: Compact failed — ${err instanceof Error ? err.message : String(err)}]`,
      )
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
    }
  }, [history])
```

- [ ] **Step 3: 确认编译无报错**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npx tsc --noEmit 2>&1 | head -20
```

Expected: 无输出

- [ ] **Step 4: Commit**

```bash
git add src/screens/REPL.tsx
git commit -m "feat(compact): call runPostCompactCleanup after manual compact"
```

---

## Task 4: 接入 partial compact 路径（`src/screens/REPL.tsx` 两处）

**Files:**
- Modify: `src/screens/REPL.tsx:472-490` (partial from) 和 `src/screens/REPL.tsx:498-516` (partial up-to)

- [ ] **Step 1: partial compact from — 成功后调用**

找到第 472-490 行（`input === 'f'` 分支）：

```ts
                const result = await partialCompactConversation(
                  conversationRef.current,
                  partialSelectedIndex,
                  'from',
                  { sessionId: sessionIdRef.current },
                )
                conversationRef.current = result.newMessages
                history.appendUserMessage(
                  `[System: Partial compact (from). Saved ~${result.savedTokens.toLocaleString()} tokens]`,
                )
```

替换为：

```ts
                const result = await partialCompactConversation(
                  conversationRef.current,
                  partialSelectedIndex,
                  'from',
                  { sessionId: sessionIdRef.current },
                )
                conversationRef.current = result.newMessages
                runPostCompactCleanup()
                history.appendUserMessage(
                  `[System: Partial compact (from). Saved ~${result.savedTokens.toLocaleString()} tokens]`,
                )
```

- [ ] **Step 2: partial compact up-to — 成功后调用**

找到第 498-516 行（`input === 'u'` 分支）：

```ts
                const result = await partialCompactConversation(
                  conversationRef.current,
                  partialSelectedIndex,
                  'up_to',
                  { sessionId: sessionIdRef.current },
                )
                conversationRef.current = result.newMessages
                history.appendUserMessage(
                  `[System: Partial compact (up to). Saved ~${result.savedTokens.toLocaleString()} tokens]`,
                )
```

替换为：

```ts
                const result = await partialCompactConversation(
                  conversationRef.current,
                  partialSelectedIndex,
                  'up_to',
                  { sessionId: sessionIdRef.current },
                )
                conversationRef.current = result.newMessages
                runPostCompactCleanup()
                history.appendUserMessage(
                  `[System: Partial compact (up to). Saved ~${result.savedTokens.toLocaleString()} tokens]`,
                )
```

- [ ] **Step 3: 确认编译无报错**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npx tsc --noEmit 2>&1 | head -20
```

Expected: 无输出

- [ ] **Step 4: Commit**

```bash
git add src/screens/REPL.tsx
git commit -m "feat(compact): call runPostCompactCleanup after partial compact"
```

---

## Task 5: 验证

**Files:**
- Read: `src/compact/__tests__/autoCompact.test.ts`

- [ ] **Step 1: 运行现有测试，确认全部通过**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npx vitest run src/compact/__tests__/autoCompact.test.ts 2>&1 | tail -20
```

Expected: 所有测试 PASS，无 FAIL

- [ ] **Step 2: 运行全量测试，确认无回归**

```bash
cd /Users/mac/Documents/ai/pi-claude-code && npx vitest run 2>&1 | tail -20
```

Expected: 所有测试 PASS

- [ ] **Step 3: 最终 commit（如有未提交改动）**

```bash
git status
# 若有未提交文件：
git add -A && git commit -m "chore: post-compact cleanup complete"
```
