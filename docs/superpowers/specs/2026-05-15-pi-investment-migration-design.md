# PI-Investment 功能迁移指南

> 生成时间: 2026-05-15
> 目标: 将 pi-investment 的工具系统和 Evolution 进化能力迁移到 investment-claude
> 遵循: investment-claude 架构规范

---

## 1. 概述

### 1.1 文档目的

本文档提供将 pi-investment 项目的核心能力迁移到 investment-claude 的完整指南，包括：

- **工具系统扩展**: 新增 15+ 个专业投资工具
- **Evolution 进化系统**: 自我优化和性能分析能力
- **架构适配**: 遵循 investment-claude 的 Tool 接口和权限系统
- **实施路线图**: 分阶段迁移计划和代码示例

### 1.2 架构规范对比

| 维度 | pi-investment | investment-claude | 迁移策略 |
|------|--------------|-------------------|---------|
| **框架** | piagent (@mariozechner/pi-*) | Claude Agent SDK | 适配接口层 |
| **工具定义** | `ToolDefinition` + TypeBox | `buildTool()` + `ToolDef` | 使用 buildTool 工厂 |
| **工具注册** | `allCustomTools` 数组 | `BUILTIN_TOOLS` + `getAllTools()` | 添加到 src/tools/index.ts |
| **权限管理** | 无独立权限层 | `checkPermissions()` + PermissionDecision | 为写操作添加权限检查 |
| **Python 桥接** | `python-bridge.ts` | `callPython()` 统一接口 | 复用现有实现 |
| **UI 渲染** | piagent TUI | Ink React 组件 | 实现 renderToolResultMessage |
| **数据存储** | `.pi-invest/` JSON 文件 | `.pi/` JSON 文件 | 统一到 .pi/ 目录 |
| **Session 管理** | piagent Session | AppState + ToolUseContext | 适配到 AppState |

### 1.3 迁移价值

**工具生态扩展**
- 交易日志管理（创建/更新/追加记录）
- 挂单管理（创建/撤销/查看/自动成交）
- 行业轮动分析（板块资金流向）
- 止损检查（自动触发提醒）
- 市场情绪分析（综合指标）
- 经验查询（历史决策库）

**Evolution 进化能力**
- 自动分析投资表现（收益率、胜率、归因分析）
- 生成优化建议（工具调整、参数优化、经验更新）
- 自动应用改进（代码生成、沙箱验证、Git 分支管理）
- 历史学习机制（评估进化效果、避免重复错误）
- 工具效能评估（ROI、Token 消耗、5 星评级）

**决策质量提升**
- Session 分析（工具调用链路、决策质量评估）
- 经验库（成功模式、反模式、经验规律）
- 模式识别（从历史中提取可复用规律）

### 1.4 迁移范围

**Phase 1: 工具扩展（2-3 周）**
- 新增 15+ 个专业工具
- 适配到 buildTool 模式
- 添加权限检查和 UI 渲染
- 测试覆盖

**Phase 2: Evolution 核心（3-4 周）**
- 移植 10 个核心模块
- 适配到 Tool 接口
- 实现 Session 分析
- 经验库管理

**Phase 3: 自动化集成（1-2 周）**
- 集成 CronTool 触发进化
- Git 分支管理
- 进化报告生成
- 端到端测试

---

## 2. 工具系统对比

### 2.1 当前工具清单（investment-claude）

**基础工具（Claude Agent SDK 内置）**
- BashTool, ReadTool, FileWriteTool, FileEditTool
- GlobTool, GrepTool, WebFetchTool, BrowserTool
- AskUserQuestionTool, TodoWriteTool
- TaskCreateTool, TaskGetTool, TaskListTool, TaskUpdateTool
- CronCreateTool, CronDeleteTool, CronListTool
- SkillTool, AgentTool

**投资工具（已实现）**
- 股票数据: get_stock_price, get_stock_info, get_stock_history
- 财务分析: get_financial_indicators, get_balance_sheet, get_income_statement
- 技术分析: calculate_technical_indicators, analyze_price_action
- 估值分析: get_stock_valuation, get_pe_percentile, get_quality_score
- 市场数据: get_market_overview, get_sector_fund_flow, get_north_flow
- 新闻资讯: get_stock_news, get_market_news
- 股票筛选: screen_stocks_by_sector, screen_stocks_quality
- 持仓管理: manage_portfolio
- 量化工具: QuantTool（ML 预测、回测）

**工具总数**: ~40 个（含内置工具）

### 2.2 参考工具清单（pi-investment）

**核心工作流工具**
- planTool: 任务规划
- clarifyTool: 需求澄清
- reflectTool: 决策反思
- taskCreateTool, taskUpdateTool, taskListTool, taskGetTool
- taskExecuteAsyncTool: 异步并行执行
- taskCheckBackgroundTool: 后台任务检查

**投资工具（26+ 个）**
- 基础数据: 与 investment-claude 类似
- **新增专业工具**:
  - queryExperienceTool: 查询历史经验库
  - analyzeSectorRotationTool: 行业轮动分析
  - checkStopLossTriggerTool: 止损检查
  - checkPendingOrdersTool: 挂单检查（自动成交）
  - manageOrdersTool: 挂单管理（创建/撤销/查看/成交）
  - tradeLogTool: 交易日志管理（创建/更新/追加记录）
  - testMarketSentimentTool: 市场情绪分析

**监控工具**
- monitorTools: 实时盯盘（价格监控、止损触发）

**进化工具**
- evolutionRunTool: 运行进化分析

**记忆工具**
- memoryWriteTool, memorySearchTool

**专用工具**
- compactTool: 上下文压缩
- browserTool: 浏览器自动化
- readTool: 文件读取（增强版）

**工具总数**: ~50 个

### 2.3 缺失功能分析

**高优先级（P0 - 核心能力）**
1. **evolutionRunTool** - 进化分析工具
2. **queryExperienceTool** - 经验查询
3. **tradeLogTool** - 交易日志管理
4. **manageOrdersTool** - 挂单管理

**中优先级（P1 - 重要增强）**
5. **analyzeSectorRotationTool** - 行业轮动分析
6. **checkStopLossTriggerTool** - 止损检查
7. **checkPendingOrdersTool** - 挂单自动成交
8. **testMarketSentimentTool** - 市场情绪分析

**低优先级（P2 - 锦上添花）**
9. **taskExecuteAsyncTool** - 异步并行执行
10. **taskCheckBackgroundTool** - 后台任务检查
11. **monitorTools** - 实时监控工具

---

## 3. Evolution 系统详解

### 3.1 系统架构

Evolution 系统是 pi-investment 的核心创新，实现了 Agent 的自我进化能力。

**核心组件（10 个模块）**

```
┌─────────────────────────────────────────────────────────────┐
│                    Evolution Service                         │
│                   (evolution-service.ts)                     │
│                      主协调器                                 │
└──────────────┬──────────────────────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌─────────────┐  ┌─────────────┐
│  Comparator │  │ Attributor  │
│  (减法器)    │  │  (归因器)    │
│  计算差距    │  │  分析原因    │
└─────────────┘  └─────────────┘
       │               │
       └───────┬───────┘
               ▼
       ┌─────────────┐
       │ Compensator │
       │  (补偿器)    │
       │  生成建议    │
       └──────┬──────┘
              │
              ▼
       ┌─────────────┐
       │  Executor   │
       │  (执行器)    │
       │  应用变更    │
       └──────┬──────┘
              │
       ┌──────┴──────┬──────────┬──────────┐
       ▼             ▼          ▼          ▼
┌────────────┐ ┌──────────┐ ┌──────┐ ┌──────┐
│Code        │ │Sandbox   │ │Branch│ │Session│
│Generator   │ │Validator │ │Manager│ │Analyzer│
└────────────┘ └──────────┘ └──────┘ └──────┘
```

**数据流**

```
输入数据源
├── portfolio.json (持仓)
├── trades.json (交易记录)
├── reviews/*.md (复盘报告)
└── sessions/*.jsonl (Session 日志)
         │
         ▼
    数据处理层
    ├── 过滤交易窗口
    ├── 计算已实现收益
    ├── 分析 Session 日志
    └── 提取决策质量
         │
         ▼
    分析层
    ├── 计算性能差距
    ├── 归因分析
    ├── 工具效能评估
    └── 模式识别
         │
         ▼
    决策层
    ├── 确定优化策略
    ├── 生成优化建议
    └── 参考历史经验
         │
         ▼
    执行层
    ├── 生成代码
    ├── 沙箱验证
    ├── Git 分支管理
    └── 自动合并
         │
         ▼
    输出
    ├── evolution-{date}.md (进化报告)
    ├── execution-{date}.json (执行结果)
    ├── evolution-history.json (历史记录)
    └── experience-summary.json (经验总结)
```

### 3.2 核心模块说明

**1. Evolution Service (主入口)**
- 文件: `src/services/intelligence/evolution-service.ts`
- 职责: 协调整个进化流程
- 关键流程:
  1. 加载配置和数据（交易、持仓、复盘）
  2. 计算已实现收益和胜率
  3. 评估上次进化效果
  4. 执行 Session 分析计算工具效能
  5. 调用补偿器生成优化建议
  6. 执行优化建议
  7. 保存进化历史和经验总结

**2. Comparator (减法器)**
- 文件: `src/services/intelligence/comparator.ts`
- 职责: 计算性能差距和归因分析
- 关键算法:
  - 计算目标收益 vs 实际收益的差距
  - 归因分析（能力不足/执行偏差/市场因素）
  - 决策质量评估（从复盘报告提取）

**3. Compensator (补偿器)**
- 文件: `src/services/intelligence/compensator.ts`
- 职责: 根据性能差距生成优化建议
- 策略级别:
  - `minor`: gap < 3% → 微调参数
  - `moderate`: 3% ≤ gap < 10% → 调整工具 + 更新经验
  - `major`: gap ≥ 10% → 全面优化（新增工具 + 修改代码）
- 建议类型:
  - `add_tool`: 生成新工具（能力缺失）
  - `remove_tool`: 移除低效工具
  - `update_experience`: 更新经验库
  - `update_prompt`: 修改提示词
  - `update_code`: 修改代码
  - `adjust_parameter`: 调整参数

**4. Executor (执行器)**
- 文件: `src/services/intelligence/evolution-executor.ts`
- 职责: 自动应用优化建议
- 执行流程:
  1. 遍历所有建议
  2. 根据类型分发到对应执行器
  3. 记录执行日志
  4. 保存回滚数据
  5. 生成执行报告

**5. Code Generator (代码生成器)**
- 文件: `src/services/intelligence/code-generator.ts`
- 职责: 使用 Agent 自身能力生成工具代码
- 生成流程:
  1. 读取现有工具作为参考示例
  2. 构造详细的生成提示词
  3. 调用 Agent Session 生成代码
  4. 提取代码块（工具实现 + 单元测试）

**6. Sandbox Validator (沙箱验证器)**
- 文件: `src/services/intelligence/sandbox-validator.ts`
- 职责: 三级验证生成的代码
- 验证级别:
  1. 编译验证: TypeScript 类型检查
  2. 单元测试: Jest 测试执行
  3. 集成测试: 动态加载工具，验证结构

**7. Session Analyzer (Session 分析器)**
- 文件: `src/services/intelligence/session-analyzer.ts`
- 职责: 解析 Session 日志，计算工具效能
- 工具效能指标:
  - call_count: 调用次数
  - win_rate: 胜率
  - avg_return: 平均收益
  - avg_tokens: 平均 Token 消耗
  - roi: ROI = avg_return / cost_per_call
  - rating: 1-5 星评级

**8. Experience Manager (经验管理器)**
- 文件: `src/services/intelligence/experience-manager.ts`
- 职责: 经验库管理，版本控制+备份
- 经验结构:
  ```typescript
  {
    scenario: string,           // 场景描述
    pattern: {
      conditions: string[],     // 触发条件
      action: 'buy'|'sell'|'hold'
    },
    outcomes: {
      total_cases: number,      // 总案例数
      win_rate: number,         // 胜率
      avg_return: number        // 平均收益
    },
    recommendation: string,     // 建议
    confidence: number          // 置信度
  }
  ```

**9. Evolution History (历史记录)**
- 文件: `src/services/intelligence/evolution-history.ts`
- 职责: 历史记录管理，评分系统
- 评分系统: 0-100 分，评估每次进化效果

**10. Branch Manager (分支管理器)**
- 文件: `src/services/intelligence/evolution-branch-manager.ts`
- 职责: Git 分支管理器
- 流程:
  1. 创建进化分支 `evolution/{date}`
  2. 提交变更到分支
  3. 自动合并到 `main`
  4. 失败时回滚到原分支

### 3.3 关键文件清单

**核心模块（10 个）**
- evolution-service.ts (577 行) - 主服务
- evolution-executor.ts - 执行器
- compensator.ts - 补偿器
- code-generator.ts - 代码生成器
- sandbox-validator.ts - 沙箱验证器
- session-analyzer.ts - Session 分析器
- experience-query.ts - 经验查询服务
- comparator.ts (184 行) - 减法器
- evolution-history.ts (355 行) - 历史记录
- evolution-branch-manager.ts (220 行) - Git 分支管理

**支撑模块（6 个）**
- evolution-reporter.ts (272 行) - 报告生成器
- experience-manager.ts (420 行) - 经验库管理
- experience-learner.ts (260+ 行) - 经验学习器
- types/evolution.ts - 类型定义

**工具层（1 个）**
- evolution-tool.ts - evolutionRunTool 工具定义

---

## 4. 迁移路线图

### Phase 1: 工具扩展（2-3 周）

**目标**: 新增 15+ 个专业工具，适配到 investment-claude 架构

**任务清单**:
1. 创建工具目录结构
2. 实现交易日志工具
3. 实现挂单管理工具
4. 实现行业轮动分析工具
5. 实现止损检查工具
6. 实现市场情绪分析工具
7. 实现经验查询工具
8. 添加权限检查
9. 实现 UI 渲染
10. 编写单元测试

**详细实施计划**: 见第 5 节

### Phase 2: Evolution 核心（3-4 周）

**目标**: 移植 Evolution 系统的 10 个核心模块

**任务清单**:
1. 创建 services/intelligence 目录
2. 移植 Comparator（减法器）
3. 移植 Compensator（补偿器）
4. 移植 Session Analyzer
5. 移植 Experience Manager
6. 移植 Evolution Service（主入口）
7. 移植 Code Generator
8. 移植 Sandbox Validator
9. 移植 Evolution Executor
10. 移植 Branch Manager
11. 适配到 AppState 和 ToolUseContext
12. 编写集成测试

**详细实施计划**: 见第 6 节

### Phase 3: 自动化集成（1-2 周）

**目标**: 集成 CronTool，实现自动化进化

**任务清单**:
1. 创建 evolutionRunTool
2. 配置 CRON 定时任务
3. 实现进化报告生成
4. 实现 Git 分支管理
5. 端到端测试
6. 文档编写

**详细实施计划**: 见第 7 节

---

## 5. Phase 1 实施细节：工具扩展

### 5.1 工具目录结构

```
src/tools/
├── TradeLogTool/
│   ├── TradeLogTool.tsx
│   ├── UI.tsx
│   └── prompt.ts
├── OrderManagementTool/
│   ├── OrderManagementTool.tsx
│   ├── UI.tsx
│   └── prompt.ts
├── SectorRotationTool/
│   ├── SectorRotationTool.tsx
│   ├── UI.tsx
│   └── prompt.ts
├── StopLossCheckTool/
│   ├── StopLossCheckTool.tsx
│   ├── UI.tsx
│   └── prompt.ts
├── MarketSentimentTool/
│   ├── MarketSentimentTool.tsx
│   ├── UI.tsx
│   └── prompt.ts
└── ExperienceQueryTool/
    ├── ExperienceQueryTool.tsx
    ├── UI.tsx
    └── prompt.ts
```

### 5.2 工具实现模板

以 TradeLogTool 为例，展示如何适配到 investment-claude 架构：

**TradeLogTool.tsx**
```typescript
import { buildTool, type ToolDef, type ToolResult } from '../../Tool.js'
import type { PermissionDecision } from '../../permissions/types.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// 输入输出类型
type TradeLogInput = {
  action: 'create' | 'append' | 'get' | 'list'
  symbol?: string
  name?: string
  entry_price?: number
  entry_date?: string
  notes?: string
  log_id?: string
  record?: {
    date: string
    event: string
    price?: number
    notes?: string
  }
}

type TradeLogOutput = {
  success: boolean
  data?: any
  error?: string
}

// 工具定义
const tradeLogToolDef: ToolDef<TradeLogInput, TradeLogOutput> = {
  name: 'TradeLog',
  description: `Manage trading logs for tracking decision-making process and performance analysis.

Actions:
- create: Create a new trade log for a stock
- append: Add a record to an existing trade log
- get: Get a specific trade log
- list: List all trade logs

Example:
{
  "action": "create",
  "symbol": "600519",
  "name": "贵州茅台",
  "entry_price": 1650.00,
  "entry_date": "2026-05-15",
  "notes": "基本面优秀，估值合理"
}`,

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform: create, append, get, list',
      },
      symbol: {
        type: 'string',
        description: 'Stock symbol (required for create/get)',
      },
      name: {
        type: 'string',
        description: 'Stock name (required for create)',
      },
      entry_price: {
        type: 'number',
        description: 'Entry price (required for create)',
      },
      entry_date: {
        type: 'string',
        description: 'Entry date YYYY-MM-DD (required for create)',
      },
      notes: {
        type: 'string',
        description: 'Initial notes (optional for create)',
      },
      log_id: {
        type: 'string',
        description: 'Log ID (required for append)',
      },
      record: {
        type: 'object',
        description: 'Record to append (required for append)',
      },
    },
    required: ['action'],
  },

  isReadOnly: () => false,

  checkPermissions(input: TradeLogInput): PermissionDecision {
    if (input.action === 'create') {
      return {
        behavior: 'ask',
        message: `确认创建交易日志：${input.name}(${input.symbol}) 入场价¥${input.entry_price}？`,
        suggestions: [{
          type: 'addRules',
          destination: 'projectSettings',
          rules: [{ toolName: 'TradeLog', ruleContent: 'create' }],
          behavior: 'allow',
        }],
      }
    }
    if (input.action === 'append') {
      return {
        behavior: 'ask',
        message: `确认追加交易记录到日志 ${input.log_id}？`,
      }
    }
    return { behavior: 'allow' }
  },

  async call(input: TradeLogInput): Promise<ToolResult<TradeLogOutput>> {
    const tradeLogDir = join(process.cwd(), '.pi', 'trade-log')

    try {
      if (!existsSync(tradeLogDir)) {
        mkdirSync(tradeLogDir, { recursive: true })
      }

      switch (input.action) {
        case 'create': {
          if (!input.symbol || !input.name || !input.entry_price || !input.entry_date) {
            return {
              data: {
                success: false,
                error: 'Missing required fields: symbol, name, entry_price, entry_date',
              },
            }
          }

          const logId = `${input.symbol}-${Date.now()}`
          const logPath = join(tradeLogDir, `${logId}.json`)

          const log = {
            id: logId,
            symbol: input.symbol,
            name: input.name,
            entry_price: input.entry_price,
            entry_date: input.entry_date,
            created_at: new Date().toISOString(),
            records: input.notes ? [{
              date: input.entry_date,
              event: 'entry',
              price: input.entry_price,
              notes: input.notes,
            }] : [],
          }

          writeFileSync(logPath, JSON.stringify(log, null, 2))

          return {
            data: {
              success: true,
              data: { log_id: logId, log },
            },
          }
        }

        case 'append': {
          if (!input.log_id || !input.record) {
            return {
              data: {
                success: false,
                error: 'Missing required fields: log_id, record',
              },
            }
          }

          const logPath = join(tradeLogDir, `${input.log_id}.json`)
          if (!existsSync(logPath)) {
            return {
              data: {
                success: false,
                error: `Trade log not found: ${input.log_id}`,
              },
            }
          }

          const log = JSON.parse(readFileSync(logPath, 'utf-8'))
          log.records.push({
            ...input.record,
            timestamp: new Date().toISOString(),
          })
          log.updated_at = new Date().toISOString()

          writeFileSync(logPath, JSON.stringify(log, null, 2))

          return {
            data: {
              success: true,
              data: log,
            },
          }
        }

        case 'get': {
          if (!input.log_id) {
            return {
              data: {
                success: false,
                error: 'Missing required field: log_id',
              },
            }
          }

          const logPath = join(tradeLogDir, `${input.log_id}.json`)
          if (!existsSync(logPath)) {
            return {
              data: {
                success: false,
                error: `Trade log not found: ${input.log_id}`,
              },
            }
          }

          const log = JSON.parse(readFileSync(logPath, 'utf-8'))
          return {
            data: {
              success: true,
              data: log,
            },
          }
        }

        case 'list': {
          const files = existsSync(tradeLogDir)
            ? require('fs').readdirSync(tradeLogDir).filter((f: string) => f.endsWith('.json'))
            : []

          const logs = files.map((f: string) => {
            const log = JSON.parse(readFileSync(join(tradeLogDir, f), 'utf-8'))
            return {
              id: log.id,
              symbol: log.symbol,
              name: log.name,
              entry_price: log.entry_price,
              entry_date: log.entry_date,
              record_count: log.records.length,
            }
          })

          return {
            data: {
              success: true,
              data: logs,
            },
          }
        }

        default:
          return {
            data: {
              success: false,
              error: `Unknown action: ${input.action}`,
            },
          }
      }
    } catch (error) {
      return {
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }
  },

  mapToolResultToToolResultBlockParam(data: TradeLogOutput, toolUseId: string) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: JSON.stringify(data, null, 2),
    }
  },

  renderToolResultMessage(data: TradeLogOutput) {
    if (!data.success) {
      return <Text color="red">❌ {data.error}</Text>
    }

    if (data.data?.log_id) {
      return (
        <Box flexDirection="column">
          <Text color="green">✅ 交易日志已创建</Text>
          <Text>日志ID: {data.data.log_id}</Text>
        </Box>
      )
    }

    if (Array.isArray(data.data)) {
      return (
        <Box flexDirection="column">
          <Text color="green">📋 交易日志列表 ({data.data.length})</Text>
          {data.data.map((log: any) => (
            <Text key={log.id}>
              • {log.name}({log.symbol}) - 入场¥{log.entry_price} - {log.record_count}条记录
            </Text>
          ))}
        </Box>
      )
    }

    return <Text color="green">✅ 操作成功</Text>
  },
}

export const TradeLogTool = buildTool(tradeLogToolDef)
```

### 5.3 工具注册

在 `src/tools/index.ts` 中注册新工具：

```typescript
import { TradeLogTool } from './TradeLogTool/TradeLogTool.js'
import { OrderManagementTool } from './OrderManagementTool/OrderManagementTool.js'
import { SectorRotationTool } from './SectorRotationTool/SectorRotationTool.js'
import { StopLossCheckTool } from './StopLossCheckTool/StopLossCheckTool.js'
import { MarketSentimentTool } from './MarketSentimentTool/MarketSentimentTool.js'
import { ExperienceQueryTool } from './ExperienceQueryTool/ExperienceQueryTool.js'

const BUILTIN_TOOLS: Tool[] = [
  // ... 现有工具
  TradeLogTool,
  OrderManagementTool,
  SectorRotationTool,
  StopLossCheckTool,
  MarketSentimentTool,
  ExperienceQueryTool,
]
```

### 5.4 数据目录结构

```
.pi/
├── trade-log/              # 交易日志
│   ├── 600519-1234567890.json
│   └── 000001-1234567891.json
├── orders/                 # 挂单管理
│   └── orders.json
├── experience/             # 经验库
│   └── experience-summary.json
└── evolution/              # 进化记录
    ├── evolution-2026-05-15.md
    └── execution-2026-05-15.json
```

### 5.5 测试用例

**tests/tools/TradeLogTool.test.ts**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TradeLogTool } from '../../src/tools/TradeLogTool/TradeLogTool.js'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'

describe('TradeLogTool', () => {
  const testDir = join(process.cwd(), '.pi', 'trade-log')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  it('should create a new trade log', async () => {
    const result = await TradeLogTool.call({
      action: 'create',
      symbol: '600519',
      name: '贵州茅台',
      entry_price: 1650.00,
      entry_date: '2026-05-15',
      notes: '基本面优秀',
    }, {} as any)

    expect(result.data.success).toBe(true)
    expect(result.data.data.log_id).toMatch(/^600519-\d+$/)
  })

  it('should append a record to existing log', async () => {
    // Create log first
    const createResult = await TradeLogTool.call({
      action: 'create',
      symbol: '600519',
      name: '贵州茅台',
      entry_price: 1650.00,
      entry_date: '2026-05-15',
    }, {} as any)

    const logId = createResult.data.data.log_id

    // Append record
    const appendResult = await TradeLogTool.call({
      action: 'append',
      log_id: logId,
      record: {
        date: '2026-05-16',
        event: 'observation',
        price: 1680.00,
        notes: '价格上涨，持续观察',
      },
    }, {} as any)

    expect(appendResult.data.success).toBe(true)
    expect(appendResult.data.data.records).toHaveLength(1)
  })

  it('should list all trade logs', async () => {
    // Create two logs
    await TradeLogTool.call({
      action: 'create',
      symbol: '600519',
      name: '贵州茅台',
      entry_price: 1650.00,
      entry_date: '2026-05-15',
    }, {} as any)

    await TradeLogTool.call({
      action: 'create',
      symbol: '000001',
      name: '平安银行',
      entry_price: 12.50,
      entry_date: '2026-05-15',
    }, {} as any)

    // List logs
    const listResult = await TradeLogTool.call({
      action: 'list',
    }, {} as any)

    expect(listResult.data.success).toBe(true)
    expect(listResult.data.data).toHaveLength(2)
  })
})
```

---

## 6. Phase 2 实施细节：Evolution 核心

### 6.1 目录结构

```
src/
├── services/
│   └── intelligence/
│       ├── evolution-service.ts          # 主入口
│       ├── comparator.ts                 # 减法器
│       ├── compensator.ts                # 补偿器
│       ├── evolution-executor.ts         # 执行器
│       ├── code-generator.ts             # 代码生成器
│       ├── sandbox-validator.ts          # 沙箱验证器
│       ├── session-analyzer.ts           # Session 分析器
│       ├── experience-manager.ts         # 经验管理器
│       ├── experience-learner.ts         # 经验学习器
│       ├── experience-query.ts           # 经验查询
│       ├── evolution-reporter.ts         # 报告生成器
│       ├── evolution-history.ts          # 历史记录
│       └── evolution-branch-manager.ts   # Git 分支管理
└── types/
    └── evolution.ts                      # 类型定义
```

### 6.2 架构适配要点

**1. 数据存储适配**

pi-investment 使用 `.pi-invest/`，需要适配到 `.pi/`：

```typescript
// pi-investment
const PI_DIR = path.join(process.cwd(), '.pi-invest')

// investment-claude
const PI_DIR = path.join(process.cwd(), '.pi')
```

**2. Session 分析适配**

pi-investment 使用 piagent Session，需要适配到 AppState：

```typescript
// pi-investment: 从 .pi-invest/sessions/*.jsonl 读取
function analyzeSessionsAndCalculateEfficiency(sessionDir: string) {
  const files = readdirSync(sessionDir).filter(f => f.endsWith('.jsonl'))
  // ...
}

// investment-claude: 从 AppState 读取对话历史
function analyzeConversationHistory(context: ToolUseContext) {
  const state = context.getAppState()
  const messages = state.messages
  // 分析工具调用链路
  const toolCalls = messages.filter(m => m.role === 'assistant' && m.content.some(c => c.type === 'tool_use'))
  // ...
}
```

**3. 工具注册适配**

pi-investment 使用 piagent ToolDefinition，需要适配到 buildTool：

```typescript
// pi-investment
export const evolutionRunTool: ToolDefinition = {
  name: "evolution_run",
  label: "运行进化分析",
  description: "...",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params: any) => {
    // ...
  },
}

// investment-claude
const evolutionRunToolDef: ToolDef = {
  name: 'EvolutionRun',
  description: '...',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  isReadOnly: () => false,
  async call(input, context): Promise<ToolResult> {
    // ...
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },
  renderToolResultMessage(data) {
    return <Text>{data}</Text>
  },
}

export const EvolutionRunTool = buildTool(evolutionRunToolDef)
```

**4. 代码生成适配**

pi-investment 使用 Codex (GPT-5.4)，investment-claude 使用 AgentTool：

```typescript
// pi-investment: 调用 Codex
import { exec } from 'child_process'
const result = await new Promise((resolve) => {
  exec(`codex exec --ephemeral "${prompt}"`, (err, stdout) => {
    resolve(stdout)
  })
})

// investment-claude: 使用 AgentTool
import { AgentTool } from '../../tools/AgentTool/AgentTool.js'
const result = await AgentTool.call({
  description: 'Generate tool code',
  prompt: `Generate a new tool with the following specification:\n${spec}`,
  subagent_type: 'general-purpose',
}, context)
```

由于文档较长，我将创建一个补充文档来完成剩余部分。

---
