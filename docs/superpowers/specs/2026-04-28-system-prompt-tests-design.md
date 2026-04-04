# System Prompt Tests Design

**日期**: 2026-04-28
**状态**: 待实现
**关联实现**: `src/constants/systemPromptSections.ts`, `src/context/`

---

## 背景

系统提示词架构（feat/system-prompt）已合并到 master，但无自动化测试覆盖。本设计补充单元测试，覆盖 section registry 的核心缓存逻辑和所有 context loaders。

---

## 策略：混合 mock

| 模块 | 策略 | 原因 |
|------|------|------|
| `systemPromptSections.ts` | 真实调用（无 mock） | 纯内存逻辑，无 I/O |
| `envContext.ts` | `vi.mock('os')` | `platform()`/`release()` 有平台差异 |
| `workspaceContext.ts` | `vi.mock('fs')` | 避免真实写磁盘 |
| `gitContext.ts` | `vi.mock('child_process')` | 避免依赖本地 git 状态 |
| `claudeMdContext.ts` | `vi.mock('fs')` | 避免读真实文件系统 |
| `memoryContext.ts` | `vi.mock('fs')` | 避免读真实文件系统 |

---

## 文件结构

```
src/
├── constants/__tests__/
│   └── systemPromptSections.test.ts
└── context/__tests__/
    ├── envContext.test.ts
    ├── workspaceContext.test.ts
    ├── gitContext.test.ts
    ├── claudeMdContext.test.ts
    └── memoryContext.test.ts
```

---

## 各文件覆盖点

### `systemPromptSections.test.ts`

每个 `it` 前调用 `_resetRegistry()` 清空注册表。

| # | 测试描述 |
|---|---------|
| 1 | `registerSection` loader 返回字符串 → `resolveSystemPrompt` 包含该字符串 |
| 2 | loader 返回 null → 该段被过滤，不出现在结果中 |
| 3 | 多段按注册顺序拼接，用 `\n\n---\n\n` 分隔 |
| 4 | cached section loader 在两次 resolve 中只被调用一次 |
| 5 | volatile section loader 在每次 resolve 都被调用 |
| 6 | `clearSectionCache` 后，cached loader 下次 resolve 重新执行 |
| 7 | `clearSectionCache` 不影响 volatile section 的行为（仍每次执行） |

### `envContext.test.ts`

`vi.mock('os')` mock `platform` 返回 `'darwin'`，`release` 返回 `'24.0.0'`。

| # | 测试描述 |
|---|---------|
| 1 | 返回值包含 `# User Environment Info` |
| 2 | 包含 `ctx.cwd` |
| 3 | 包含 `ctx.sessionId` |
| 4 | 包含当天日期（`new Date().toISOString().slice(0, 10)`） |
| 5 | 包含 mock 的 OS 平台 `darwin` |

### `workspaceContext.test.ts`

`vi.mock('fs')` mock `mkdirSync`。

| # | 测试描述 |
|---|---------|
| 1 | `mkdirSync` 以 `{ recursive: true }` 被调用，路径为 `ctx.workspaceDir` |
| 2 | 返回值包含 `# Workspace` |
| 3 | 返回值包含 `ctx.workspaceDir` 路径 |
| 4 | `mkdirSync` 抛出异常时不崩溃，仍返回正常字符串 |

### `gitContext.test.ts`

`vi.mock('child_process')` mock `execSync`。通过 mock 返回值控制各命令输出。

| # | 测试描述 |
|---|---------|
| 1 | `rev-parse --show-toplevel` 返回空字符串 → 函数返回 `null` |
| 2 | 正常 git 仓库 → 输出包含 `# Git Status` |
| 3 | 正常 git 仓库 → 输出包含 branch 名称 |
| 4 | `git status --short` 返回空 → 输出不含 `Changed files:` |
| 5 | `git status --short` 有内容 → 输出含 `Changed files:` 和文件列表 |
| 6 | 输出超过 2000 字符 → 截断并以 `...(truncated)` 结尾 |

### `claudeMdContext.test.ts`

`vi.mock('fs')` mock `existsSync` / `readFileSync`。`vi.mock('os')` mock `homedir` 返回固定路径。

| # | 测试描述 |
|---|---------|
| 1 | 所有 `existsSync` 返回 false → 返回 `null` |
| 2 | 仅 cwd 下有 CLAUDE.md → 返回包含该路径的字符串 |
| 3 | 仅全局 `~/.claude/CLAUDE.md` 存在 → 返回包含 `~/.claude/CLAUDE.md` 的字符串 |
| 4 | cwd 和全局都有 → 两段都出现，cwd 段在全局段之前 |

### `memoryContext.test.ts`

`vi.mock('fs')` mock `existsSync` / `readFileSync`。`vi.mock('os')` mock `homedir`。

| # | 测试描述 |
|---|---------|
| 1 | 文件不存在 → 返回 `null` |
| 2 | 文件存在且有内容 → 返回 `# Memory\n\n{content}` |
| 3 | 文件存在但内容为空字符串 → 返回 `null` |

---

## 不在范围内

- `prompts.ts` 集成测试（initSystemPrompt + 所有 loader 组合）
- `bootstrap/state.ts`（简单 getter，无逻辑）
- `promptSections.ts`（纯常量，无逻辑）
