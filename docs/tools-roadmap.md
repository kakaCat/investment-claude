# Pi 工具实现路线图

**更新日期**: 2026-04-03  
**当前状态**: Phase 1 完成，Phase 2 规划中

---

## 已实现工具（3/52）

| 工具 | 状态 | 备注 |
|------|------|------|
| BashTool | ✅ 架构完成，stub | 真实执行待 Phase 2A |
| ReadTool | ✅ 架构完成，stub | 真实读取待 Phase 2A |
| ToolSearchTool | ✅ 完整实现 | 按关键词搜索工具 |

---

## Phase 2A — 文件系统 + 执行工具（优先）

**复杂度**：低  
**依赖**：Node.js `fs`、`child_process`，无需新基础设施

| 工具 | 功能 | 实现要点 |
|------|------|---------|
| BashTool | 执行 shell 命令 | `child_process.spawn`，超时，stderr/stdout 合并 |
| FileReadTool | 读文件（含图片、PDF） | `fs.readFile`，大文件截断，图片 base64 |
| FileWriteTool | 写文件 | `fs.writeFile`，创建父目录 |
| FileEditTool | 字符串替换编辑 | 读 → 替换 → 写，替换不到报错 |
| GlobTool | 文件模式匹配 | `fast-glob` 或 `glob` 库 |
| GrepTool | 正则搜索内容 | ripgrep 子进程 或 Node.js 正则遍历 |
| PowerShellTool | 执行 PowerShell | 同 BashTool，Windows 专用 |

---

## Phase 2B — Task / Todo 存储系统

**复杂度**：中  
**依赖**：需要设计 `~/.pi/tasks/` 文件存储格式  
**注意**：这组工具共享同一个存储后端，必须整体设计

| 工具 | 功能 |
|------|------|
| TodoWriteTool | 写/更新任务清单 |
| TaskCreateTool | 创建单个任务 |
| TaskGetTool | 获取任务详情 |
| TaskListTool | 列出所有任务 |
| TaskUpdateTool | 更新任务状态 |
| TaskStopTool | 停止/取消任务 |
| TaskOutputTool | 获取任务输出 |
| ScheduleCronTool | 定时/周期任务 |

**待设计**：
- 任务存储格式（JSON / SQLite / 纯文件）
- 任务 ID 生成策略
- 任务状态机（pending → running → done / failed / cancelled）
- ScheduleCron 的触发机制（进程内定时器 vs 系统 cron）

---

## Phase 2C — 用户交互工具

**复杂度**：低  
**依赖**：REPL 状态扩展（已有 `permissionRequest` 模式可复用）

| 工具 | 功能 | 实现要点 |
|------|------|---------|
| AskUserQuestionTool | 向用户提问，等待输入 | 复用 REPL 的 permissionRequest 机制 |
| SendUserFileTool | 发送文件路径给用户 | 终端输出可点击路径 |
| ConfigTool | 读写 Pi 配置 | `~/.pi/config.json` |

---

## Phase 2D — Plan 模式工具

**复杂度**：中  
**依赖**：REPL 需要新增 `planMode` 状态机

| 工具 | 功能 |
|------|------|
| EnterPlanModeTool | 进入计划模式（限制工具权限） |
| ExitPlanModeTool | 退出计划模式 |
| VerifyPlanExecutionTool | 验证计划是否按预期执行 |
| WorkflowTool | 工作流定义与执行 |

**待设计**：
- Plan 模式下工具权限限制规则
- 计划文件格式（对标 Claude Code plan mode）
- Workflow 的执行引擎

---

## Phase 3 — Agent 工具

**复杂度**：高  
**依赖**：Phase 3 SubAgent 架构（独立 query 循环 + 生命周期管理）

| 工具 | 功能 |
|------|------|
| AgentTool | 派生子 agent，执行独立任务，返回结果 |
| SendMessageTool | agent 间消息传递 |
| TeamCreateTool | 创建 agent 团队 |
| TeamDeleteTool | 删除团队 |

---

## Phase 6 — MCP 集成

**复杂度**：高  
**依赖**：Model Context Protocol 客户端实现

| 工具 | 功能 |
|------|------|
| MCPTool | 通用 MCP 工具代理 |
| McpAuthTool | MCP 服务认证 |
| ListMcpResourcesTool | 列出 MCP 资源 |
| ReadMcpResourceTool | 读取 MCP 资源内容 |

---

## 不实现 / 低优先级

| 工具 | 原因 |
|------|------|
| LSPTool | 依赖 LSP 服务器集成，复杂度高，暂缓 |
| REPLTool | Pi 本身就是 REPL，意义重叠 |
| WebBrowserTool | 依赖 Playwright/Puppeteer，体积大 |
| TungstenTool | 平台专用，不适用 |
| OverflowTestTool | 测试工具，内部使用 |

---

## 建议实施顺序

```
Phase 2A（文件+执行）→ Phase 2C（用户交互）→ Phase 2B（Task 存储）→ Phase 2D（Plan 模式）→ Phase 3（Agent）→ Phase 6（MCP）
```

每个 Phase 独立设计、独立实现，互不阻塞。
