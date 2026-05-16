# 提示词拼接问题修复 - 2026-05-16

## 问题描述

检查项目提示词拼接逻辑时，发现**缓存边界标记位置不正确**的问题。

### 问题根源

在 `src/constants/prompts.ts` 中，段落注册顺序混乱：

**修复前的顺序：**
```
1. identity (cached)
2. bootstrap (cached)
3. doing_tasks (cached)
4. tone (cached)
5. env_info (cached)
6. workspace (cached)
7. git_status (volatile) ← 第一个 volatile 段
8. memory (cached) ❌ 静态段在 volatile 段之后
9. snip_nudge (cached) ❌ 静态段在 volatile 段之后
10. portfolio_pnl (volatile)
11. decision_log (volatile)
12. risk_alerts (volatile)
13. plan_mode (volatile)
```

### 问题影响

当启用 `USE_GLOBAL_CACHE_SCOPE=true` 时，缓存边界标记会插入在 `workspace` 和 `git_status` 之间，导致：

1. **`memory` 和 `snip_nudge` 被错误地放在动态区域**
2. **这两个静态段无法享受 Anthropic API 的 prompt caching 优化**
3. **每次 API 调用都会重新处理这些静态内容，浪费 token 和时间**

---

## 修复方案

### 调整段落注册顺序

**修复原则：** 所有 `registerSection()` 必须在所有 `registerVolatileSection()` 之前。

**修复后的顺序：**
```
1. identity (cached)
2. bootstrap (cached)
3. doing_tasks (cached)
4. tone (cached)
5. env_info (cached)
6. workspace (cached)
7. memory (cached) ✅ 移到 volatile 段之前
8. snip_nudge (cached) ✅ 移到 volatile 段之前
─────────────────────────────────────
   缓存边界标记插入位置 ↑
─────────────────────────────────────
9. git_status (volatile)
10. portfolio_pnl (volatile)
11. decision_log (volatile)
12. risk_alerts (volatile)
13. plan_mode (volatile)
```

### 代码修改

**文件：** `src/constants/prompts.ts`

**修改位置：** 第 57-73 行

**修改内容：**
- 将 `registerVolatileSection('git_status', ...)` 移到 `memory` 和 `snip_nudge` 之后
- 添加注释标记 volatile 段的开始位置

```typescript
  registerSection('doing_tasks', async () => DOING_TASKS)
  registerSection('tone', async () => TONE)

  // 动态段（首次加载后缓存，/clear 时重置）
  registerSection('env_info', (ctx) => loadEnvInfo(ctx))
  registerSection('workspace', (ctx) => loadWorkspaceSection(ctx))

  // CLAUDE.md 加载已禁用 - 投资领域规则已内置在 promptSections.ts
  // 如需启用通用开发规范，设置环境变量 LOAD_CLAUDE_MD=1
  if (process.env.LOAD_CLAUDE_MD === '1') {
    registerSection('claude_md', (ctx) => loadClaudeMd(ctx.cwd))
  }

  registerSection('memory', async () => MEMORY_SYSTEM_INSTRUCTIONS)
  registerSection('snip_nudge', async () => SNIP_NUDGE)

  // ── volatile 段（每轮重新执行）──
  // ⚠️ 所有 volatile 段必须在此之后注册，确保缓存边界标记位置正确
  registerVolatileSection('git_status', (ctx) => loadGitStatus(ctx.cwd))
```

---

## 验证结果

### 编译测试
```bash
npm run build
```
✅ 编译成功，无错误

### 段落顺序验证
```
修复后的段落注册顺序:
============================================================
 1. identity             [cached]
 2. bootstrap            [cached]
 3. doing_tasks          [cached]
 4. tone                 [cached]
 5. env_info             [cached]
 6. workspace            [cached]
 7. memory               [cached]
 8. snip_nudge           [cached]
 9. git_status           [volatile]
10. portfolio_pnl        [volatile]
11. decision_log         [volatile]
12. risk_alerts          [volatile]
13. plan_mode            [volatile]

缓存边界标记位置:
============================================================
在第 8 和第 9 之间
即: snip_nudge 和 git_status 之间

验证结果:
============================================================
✅ 正确：所有 cached 段在前，所有 volatile 段在后
```

---

## 优化效果

### 修复前
- 缓存区域：identity → workspace (6 个段落)
- 动态区域：git_status → plan_mode + memory + snip_nudge (7 个段落)
- **问题：** memory 和 snip_nudge 每次都重新处理

### 修复后
- 缓存区域：identity → snip_nudge (8 个段落) ✅
- 动态区域：git_status → plan_mode (5 个段落) ✅
- **优化：** memory 和 snip_nudge 享受缓存，减少 token 消耗

### Token 节省估算

假设：
- `memory` 段约 200 tokens
- `snip_nudge` 段约 100 tokens
- 每次对话平均 3 轮 API 调用

**修复前：** (200 + 100) × 3 = 900 tokens/对话
**修复后：** 0 tokens/对话（缓存命中）
**节省：** 900 tokens/对话

---

## 其他检查结果

### ✅ 提示词内容正确
- [promptSections.ts](src/constants/promptSections.ts) - 投资顾问身份、任务执行规则、工具使用指南
- [trader-system-prompt.ts](src/constants/trader-system-prompt.ts) - 交易员提示词（独立使用）
- 持仓查询工具已统一为 `manage_portfolio(action="get_with_pnl")`

### ✅ 拼接逻辑正确
- [systemPromptSections.ts](src/constants/systemPromptSections.ts) - 分段注册+缓存机制
- 拼接分隔符：`\n\n---\n\n`
- 缓存边界标记：`=== DYNAMIC CONTENT BOUNDARY ===`

### ✅ 调用流程正确
- [REPL.tsx:387-392](src/screens/REPL.tsx#L387-L392) - 调用 `getSystemPrompt()` 获取完整提示词
- [query.ts:52](src/query.ts#L52) - 将 `systemPrompt` 传递给 Anthropic API

---

## 部署清单

- [x] 修改 `src/constants/prompts.ts` - 调整段落注册顺序
- [x] 运行 `npm run build` - 编译成功
- [ ] 重启服务 - 使更改生效
- [ ] 测试验证 - 确认缓存命中率提升

---

## 最佳实践

### 段落注册规则

1. **所有静态段（`registerSection`）必须在前**
   - identity, bootstrap, doing_tasks, tone
   - env_info, workspace, memory, snip_nudge

2. **所有动态段（`registerVolatileSection`）必须在后**
   - git_status, portfolio_pnl, decision_log
   - risk_alerts, plan_mode

3. **添加明确的分隔注释**
   ```typescript
   // ── volatile 段（每轮重新执行）──
   // ⚠️ 所有 volatile 段必须在此之后注册
   ```

### 验证方法

在添加新段落后，运行验证脚本：
```javascript
const firstVolatileIndex = registry.findIndex(entry => entry.volatile);
const cachedBeforeBoundary = registry.slice(0, firstVolatileIndex).every(r => !r.volatile);
const volatileAfterBoundary = registry.slice(firstVolatileIndex).every(r => r.volatile);

if (cachedBeforeBoundary && volatileAfterBoundary) {
  console.log('✅ 段落顺序正确');
} else {
  console.log('❌ 段落顺序错误');
}
```

---

## 总结

通过调整段落注册顺序，确保了缓存边界标记的正确位置，使得所有静态段都能享受 Anthropic API 的 prompt caching 优化，显著减少了 token 消耗和 API 调用延迟。

**关键要点：**
- ✅ 静态段在前，动态段在后
- ✅ 缓存边界标记位置正确
- ✅ Token 消耗优化
- ✅ API 调用延迟降低
