# Pi — 项目路线图

**技术栈**: React + Ink（终端 UI）+ @anthropic-ai/sdk  
**参考实现**: Claude Code (`/Users/mac/Documents/ai/learn-claude-code/claude-code`)

---

## 目录结构目标

工作目录、任务目录等地址管理（对标 Claude Code `bootstrap/state.ts`）：

```
~/.pi/
  tasks/      # 任务存储
  sessions/   # 会话记录
  plugins/    # 插件目录
```

---

## 实现阶段

### ✅ Phase 1 — 主循环框架（已完成）

- [x] `query.ts` — 核心 async generator 主循环
  - 流式 API 调用（`streamOneTurn`）
  - 工具执行（`executeTools`）
  - 权限检查（`canUseTool`）
  - AbortController 中止支持
  - maxTurns 上限
- [x] `screens/REPL.tsx` — 交互式终端 REPL
- [x] `components/` — Messages、PromptInput、Spinner、App
- [x] `hooks/` — useAssistantHistory、useMergedTools
- [x] Stub 模块 — compact、ssh、swarm、plugins

---

### 🔲 Phase 2 — 工具实现

优先级从高到低：

- [ ] **基础工具**
  - `BashTool` — 执行 shell 命令
  - `ReadTool` — 读取文件
  - `WriteTool` — 写入文件
  - `EditTool` — 编辑文件（字符串替换）
  - `GlobTool` — 文件模式匹配
  - `GrepTool` — 内容搜索

- [ ] **MCP 工具** — Model Context Protocol 工具集成

- [ ] **AgentTool** — 派生子 agent 执行任务

- [ ] **Skill 工具** — 加载 `.claude/skills/` 目录下的技能

- [ ] **Task 工具** — 任务创建与跟踪

---

### 🔲 Phase 3 — SubAgent

- [ ] 子 agent 派发与生命周期管理
- [ ] 父子 agent 消息通信
- [ ] agent 结果汇聚

---

### 🔲 Phase 4 — 压缩（Compact）

- [ ] 自动检测上下文长度
- [ ] 调用 API 生成对话摘要
- [ ] 压缩边界消息（`compact_boundary`）
- [ ] 压缩后历史重建

---

### 🔲 Phase 5 — 系统提示词

- [ ] 动态系统提示词（注入工作目录、工具列表、项目上下文）
- [ ] Memory 文件加载（`MEMORY.md`）
- [ ] CLAUDE.md / AGENTS.md 读取
- [ ] 用户自定义追加提示词

---

### 🔲 Phase 6 — 观察日志系统

- [ ] 工具调用日志
- [ ] API 请求 / 响应日志
- [ ] token 使用量追踪
- [ ] 会话持久化（transcript）

---

### 🔲 Phase 7 — 项目日志

- [ ] 结构化日志输出
- [ ] 错误日志（`logError`）
- [ ] 调试模式（`--debug`）
- [ ] 日志文件滚动

---

## 已知缺口（Phase 1 遗留）

| 功能 | 对标 Claude Code | 状态 |
|------|-----------------|------|
| thinking block 处理 | `redacted_thinking` content | 跳过，待补 |
| API 错误重试 | `categorizeRetryableAPIError` | 无重试，待补 |
| token 计数 | `tokenCountWithEstimation` | 无，待补 |
| stop_reason 追踪 | `message_delta` | 无，待补 |
| compact 接入 | `autoCompact` | stub，Phase 4 实现 |
