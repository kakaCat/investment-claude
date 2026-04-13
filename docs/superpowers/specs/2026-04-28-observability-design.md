# Pi Observability — Session Trace & HTML Report

**Date**: 2026-04-28
**Status**: Approved
**Goal**: 记录 agent 每次 session 的完整执行链路，事后生成静态 HTML 报告，用于调试和优化代码与提示词。

---

## 1. 目标

- **事后回放**：session 结束后能完整查看：用户输入 → 模型思考 → 工具调用链 → 工具结果 → 模型回复
- **性能感知**：每轮耗时、token 消耗、最慢步骤一目了然
- **零干扰**：不影响 agent 正常运行，不需要同步服务
- **零依赖**：输出单一 `.html` 文件，双击浏览器打开，无需服务器

---

## 2. 架构

### 数据流

```
Pi 运行时
  FunctionHook: SessionStart    → logger.append(session_start)
  FunctionHook: UserPromptSubmit → logger.append(user_prompt)
  FunctionHook: PreToolUse      → logger.append(tool_call + timestamp)
  FunctionHook: PostToolUse     → logger.append(tool_result + duration_ms)
  FunctionHook: PostToolUseFailure → logger.append(tool_error + duration_ms)
  FunctionHook: Stop            → logger.append(session_end + messages[])
                                   → htmlReport.generate() → session-<id>.html
```

### 文件输出

```
.pi/logs/
  session-<session_id>.jsonl   ← 运行时追加，每行一个事件
  session-<session_id>.html    ← session 结束时生成
```

`.pi/` 目录在项目根目录下，加入 `.gitignore`。

### 新增模块

```
src/observability/
  logger.ts        — 写 JSONL，管理当前 session 文件路径
  htmlReport.ts    — 读 JSONL → 生成自包含 HTML（内联 CSS + JS）
  tokenCount.ts    — 基于 roughTokenCount 统计每轮 token 数
  index.ts         — 导出 initObservability()，注册所有 FunctionHooks
```

---

## 3. JSONL 事件格式

每行一个 JSON 对象，`event` 字段区分类型：

```jsonl
{"event":"session_start","session_id":"abc123","cwd":"/proj","system_prompt":"You are Claude...","ts":1000}
{"event":"user_prompt","prompt":"帮我写排序函数","ts":1001}
{"event":"tool_call","tool":"Read","input":{"file_path":"src/utils.ts"},"ts":1005}
{"event":"tool_result","tool":"Read","result":"export function...","duration_ms":45,"ts":1006}
{"event":"tool_call","tool":"Write","input":{"file_path":"src/utils.ts","content":"..."},"ts":1008}
{"event":"tool_result","tool":"Write","result":"File written successfully","duration_ms":12,"ts":1009}
{"event":"tool_call","tool":"Bash","input":{"command":"npm test"},"ts":1015}
{"event":"tool_error","tool":"Bash","error":"Command failed: exit 1","duration_ms":8000,"ts":1023}
{"event":"session_end","stop_reason":"done","messages":[...],"ts":1025}
```

`session_end` 事件包含完整的 `messages[]` 数组，用于提取模型回复文本和思考内容。

### 事件字段说明

| 事件 | 必填字段 | 说明 |
|------|---------|------|
| `session_start` | `session_id`, `cwd`, `system_prompt`, `ts` | session 初始化，捕获系统提示词 |
| `user_prompt` | `prompt`, `ts` | 用户每次提交 |
| `tool_call` | `tool`, `input`, `ts` | 工具调用前 |
| `tool_result` | `tool`, `result`, `duration_ms`, `ts` | 工具成功 |
| `tool_error` | `tool`, `error`, `duration_ms`, `ts` | 工具失败 |
| `session_end` | `stop_reason`, `messages[]`, `ts` | session 结束 |

`tool_input` 和 `tool_result`/`tool_error` 截断至 **2000 字符**存储（避免 JSONL 过大）。HTML 报告中默认显示 200 字符，点击展开完整内容。

---

## 4. HTML 报告结构

报告为单一自包含 HTML 文件（内联所有 CSS 和 JS），分三个区域：

### 4.1 Header

```
Session ID · 时间 · 工作目录
状态(完成/失败) · 总耗时 · 总 tokens · 轮数 · 工具调用次数
```

### 4.2 流程图（Turn 概览，可点击查看 LLM 详情）

水平排列的节点图，连接所有 Turn：

```
[开始] → [Turn 1: 帮我写排序函数 | 🔧×2 | 12s | 4.2k tok]
       → [Turn 2: 加上单元测试   | 🔧×3 |  8s | 3.1k tok]
       → [Turn 3: 帮我跑测试 ⚠  | 🔧×3 | 25s | 5.1k tok]
       → [✓ 完成]
```

节点下方有**时间轴色块**，宽度按实际耗时比例渲染。慢 Turn（耗时 > 平均值 2 倍）标 ⚠。

**点击 Turn 节点**打开 LLM 详情面板（侧边抽屉或模态框），显示：

- **系统提示词**（可折叠，默认折叠，点击展开完整内容）
- **发送给 API 的 messages**（列出本轮所有 messages，新增消息高亮标注）
- **LLM 输出**：思考文本（thinking block，紫色左边框）+ 最终回复文本

LLM 详情数据来源：从 `session_end.messages[]` 重建每轮的输入/输出：
- 本轮**输入** = 本轮用户消息之前的所有 messages（即发给 API 的上下文）+ 本轮用户消息
- 本轮**输出** = 本轮 assistant message（含 thinking block 和 text block）
- Turn 边界通过 `user_prompt` 事件时间戳与 `messages[]` 中 user 消息匹配确定

### 4.3 Turn 详情列表

每个 Turn 可折叠/展开，默认展开第一个。展开内容：

```
👤 用户输入（蓝色背景）
🤖 思考文本（紫色左边框，从 messages 中提取 thinking block）
  🔧 工具名  耗时
     input: ... (默认截断，点击展开)
     result: ... (默认截断，点击展开)
🤖 最终回复（深色背景）
```

### 4.4 Footer 摘要

```
总耗时 · 总 tokens · 最慢步骤 · 工具调用次数
```

---

## 5. Token 统计

使用现有的 `roughTokenCount`（`src/sessionMemory/utils.ts`）估算。

计算策略：
- **每轮 input tokens**：本轮之前所有 messages 的 token 数之和（即发给 API 的上下文大小）
- **每轮 output tokens**：本轮 assistant message 的 token 数
- **总 tokens**：最后一轮 input tokens + 所有轮次 output tokens 之和

标注为"估算"（`~`），不是 API 返回的精确值。

---

## 6. 集成方式

在 `src/screens/REPL.tsx` 的初始化 `useEffect` 中，与 `initSessionMemory()` 并列调用：

```ts
useEffect(() => {
  if (!smInitializedRef.current) {
    smInitializedRef.current = true
    initSessionMemory()
    initObservability()   // ← 新增这一行
  }
  // ... SessionStart hook ...
}, [])
```

`initObservability()` 内部注册所有 FunctionHooks，一次注册，全 session 生效。

---

## 7. 错误处理

- 所有 hook 内部 try/catch，失败静默忽略，不影响 agent 运行
- JSONL 写入失败（磁盘满、权限问题）：忽略，不写日志
- HTML 生成失败：忽略，JSONL 文件保留供手动分析
- `.pi/logs/` 目录不存在时自动创建（`mkdir -p`）

---

## 8. 不在范围内

- 实时观察（当前 session 进行中的可视化）
- 多 session 对比视图
- 远程/云端日志收集
- OTEL 集成
- 精确 token 计数（需 API 返回值）
- thinking block 提取（需 API 开启 extended thinking）
