# Tool Testing Guide

**项目**: pi-claude-code  
**更新**: 2026-04-14

工具测试目前全部为手动测试——启动 REPL，向模型发送指令，观察工具调用行为。本文档列出每类工具的测试场景和预期结果。

---

## 启动环境

```bash
cd /Users/mac/Documents/ai/pi-claude-code
cp .env.example .env       # 填入 API key
npm run dev                # 启动 REPL
```

环境变量（`.env`）：

```
PI_MODEL=deepseek-chat          # 主模型
PI_API_KEY=sk-...               # API key
PI_BASE_URL=https://...         # 可选，自定义 endpoint
PI_MODEL_HAIKU=...              # AgentTool haiku 别名（可选）
PI_MODEL_SONNET=...             # AgentTool sonnet 别名（可选）
```

---

## 工具分类

| 类别 | 工具 |
|------|------|
| 文件系统 | `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `bash` |
| 用户交互 | `ask_user_question`, `send_user_file` |
| 计划模式 | `enter_plan_mode`, `exit_plan_mode`, `verify_plan_execution` |
| 工具发现 | `tool_search`, `discover_skills` |
| 任务管理 | `todo_write`, `task_create`, `task_get`, `task_list`, `task_update`, `task_stop`, `task_output` |
| 定时任务 | `cron_create`, `cron_delete`, `cron_list` |
| 技能 | `skill` |
| Agent | `agent` |

---

## 文件系统工具

### read_file

```
读取 src/Tool.tsx 这个文件，告诉我 ToolUseContext 有哪些字段
```

预期：模型调用 `read_file`，返回文件内容摘要，包含 `abortSignal`、`cwd`、`tools`、`askUser` 等字段。

---

### write_file / edit_file

```
在 /tmp/test-pi.txt 写入 "hello pi"，然后读取它确认内容
```

预期：先调用 `write_file` 写入，再调用 `read_file` 读取，输出 "hello pi"。

---

### glob

```
找出 src/tools/ 下所有 UI.tsx 文件
```

预期：调用 `glob`，返回类似 `src/tools/AgentTool/UI.tsx`, `src/tools/SkillTool/UI.tsx` 等路径列表。

---

### grep

```
在 src/ 下搜索所有引用了 buildTool 的文件
```

预期：调用 `grep`，返回包含 `buildTool` 的文件列表（工具定义文件）。

---

### bash

```
列出 src/agents/ 目录下的文件
```

预期：调用 `bash` 执行 `ls src/agents/`，返回 `types.ts`, `resolveModel.ts` 等文件名。

---

## 工具发现

### tool_search

```
搜索和文件读取相关的工具
```

预期：调用 `tool_search`，返回 `read_file`、`glob`、`grep` 等工具及其描述。

```
搜索 select:agent
```

预期：直接返回 `agent` 工具的激活确认。

```
搜索 select:不存在的工具名
```

预期：返回 `No tool named "不存在的工具名" found.`

---

### discover_skills

```
有哪些可用的 skill？
```

预期：调用 `discover_skills`，列出 `~/.claude/skills/` 和 `.claude/skills/` 下的 skill 文件。

---

## 计划模式

### 完整计划流程

```
我想给这个项目加一个新工具 EchoTool，帮我规划一下
```

预期流程：
1. 模型调用 `enter_plan_mode`
2. REPL 进入计划模式，模型探索代码库（read、glob、grep）
3. 模型调用 `exit_plan_mode`，提交计划文本
4. 用户审批（approve/reject）
5. 模型根据审批结果继续或停止

---

## 任务管理

### todo_write

```
帮我记录三件事：1.写测试 2.更新文档 3.做 code review
```

预期：调用 `todo_write`，创建三个 pending 状态的 todo，UI 显示任务列表。

---

### task_create / task_list / task_update / task_stop / task_output

```
创建一个后台任务：运行 sleep 10 并返回结果
```

预期流程：
1. 调用 `task_create`，返回 task_id
2. 调用 `task_list`，列出任务及状态（running）
3. 等待后调用 `task_output`，返回任务输出
4. 或调用 `task_stop` 提前终止，返回已停止确认

---

## 定时任务

### cron_create / cron_list / cron_delete

```
每分钟打印一次当前时间，运行 3 次后删掉
```

预期：
1. 调用 `cron_create`，返回 job_id
2. 调用 `cron_list`，看到刚创建的任务
3. 调用 `cron_delete`，确认删除

---

## 技能工具

### skill

先确认有可用的 skill（如 `commit`），然后：

```
执行 skill: commit
```

预期：调用 `skill`，加载对应的 skill 文件内容并返回给模型执行。

```
执行一个不存在的 skill: foobar
```

预期：返回 `ERROR: Unknown skill 'foobar'. Use discover_skills to list available skills.`

---

## AgentTool

AgentTool 是最复杂的工具，建议按以下顺序测试。

### 基础：general-purpose agent

```
用 agent 工具帮我搜索 src/ 下所有导出了 buildTool 的文件
```

预期：
- UI 显示 `agent(general-purpose) 搜索 buildTool 导出文件`
- 子 agent 调用 `grep`/`glob` 完成搜索
- 返回文件列表字符串

---

### Explore agent（只读模式）

```
用 Explore agent 找出 src/tools/ 下所有 index.ts 或 index.tsx 文件
```

预期：
- UI 显示 `agent(Explore) ...`
- 子 agent 只调用 glob/grep/read_file，不调用写文件类工具
- 返回文件路径列表

**验证只读约束**：

```
用 Explore agent 在 /tmp/test.txt 写入 "test"
```

预期：子 agent 的工具池中没有 `write_file`/`edit_file`，返回类似"工具不可用"的错误或拒绝执行。

---

### Plan agent（只读 + 无法派生子 agent）

```
用 Plan agent 为 EchoTool 设计实现方案
```

预期：
- 子 agent 使用 `read_file`/`glob`/`grep`/`bash` 探索代码库
- 返回结构化的实现计划
- 不会再次调用 `agent` 工具（`disallowedTools: ['agent']`）

---

### 未知 agent 类型

```
用 agent 工具，subagent_type 设为 "nonexistent"，让它做任何事
```

预期：立即返回 `ERROR: Unknown agent type 'nonexistent'. Available: general-purpose, Explore, Plan`，不调用 query。

---

### 自定义 agent（.claude/agents/ 目录）

1. 创建文件 `.claude/agents/summarizer.md`：

```markdown
---
description: Summarizes files into bullet points
tools: [read_file, glob]
model: haiku
maxTurns: 5
---

You summarize files into concise bullet points. Read the requested files and return a bulleted summary.
```

2. 重启 REPL（loadAgents 在每次 call 时加载）

3. 测试：

```
用 subagent_type=summarizer 的 agent 总结 src/agents/types.ts
```

预期：
- agent 加载自定义定义，tool pool 只有 `read_file` 和 `glob`
- 返回 `types.ts` 的要点摘要

4. 验证覆盖内置 agent：将文件命名为 `general-purpose.md`，重新测试，应该用自定义版本替代内置。

---

## 用户交互工具

### ask_user_question

```
问我今天想做什么，给我三个选项：写代码、写文档、休息
```

预期：
- 调用 `ask_user_question`
- REPL 显示带选项的交互 UI
- 用户选择后模型继续

---

### send_user_file

```
在 /tmp/pi-test-output.txt 写入 "测试内容"，然后发给我
```

预期：
- 先调用 `write_file` 写入文件
- 再调用 `send_user_file`，REPL 显示文件路径供用户点击/查看

---

## 边界情况

| 场景 | 预期 |
|------|------|
| 模型传入无效 JSON schema 的参数 | 工具返回有意义的 ERROR 字符串，不崩溃 |
| 读取不存在的文件 | `read_file` 返回文件不存在的错误 |
| bash 执行超时命令 | bash 工具返回超时错误 |
| AgentTool abort（Ctrl+C） | 子 agent 中断，父 agent 收到 AbortSignal |
| Explore agent 尝试写文件 | 因 tool pool 过滤，工具不存在，模型报告无法完成 |
| cron job 触发时 REPL 忙 | job 排队，REPL 空闲时执行 |

---

## 添加单元测试

目前项目没有配置测试框架。如需添加：

```bash
npm install -D vitest @vitest/ui
```

在 `package.json` 加入：

```json
"scripts": {
  "test": "vitest run",
  "test:ui": "vitest --ui"
}
```

适合单元测试的模块（纯函数，无副作用）：

| 文件 | 可测试的函数 |
|------|-------------|
| `src/agents/resolveModel.ts` | `resolveModel()` 各种输入 |
| `src/agents/assembleToolPool.ts` | `assembleToolPool()` 白名单/黑名单逻辑 |
| `src/agents/loadAgents.ts` | `parseAgentFile()` 各种 frontmatter 格式 |
| `src/tools/ToolSearchTool/ToolSearchTool.tsx` | `scoreToolForQuery()` 评分逻辑 |
