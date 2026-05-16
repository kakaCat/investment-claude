// 工具注册表 — 对标 Claude Code src/tools.ts
// getAllTools: 所有工具（含 deferLoading），供 ToolSearchTool 搜索
// getActiveTools: 传给模型的工具（isEnabled() && !deferLoading）

import type { Tool } from '../Tool.js'
import { BashTool } from './BashTool/BashTool.js'
import { ReadTool } from './ReadTool/ReadTool.js'
import { FileWriteTool } from './FileWriteTool/FileWriteTool.js'
import { FileEditTool } from './FileEditTool/FileEditTool.js'
import { GlobTool } from './GlobTool/GlobTool.js'
import { GrepTool } from './GrepTool/GrepTool.js'
import { AskUserQuestionTool } from './AskUserQuestionTool/AskUserQuestionTool.js'
import { SendUserFileTool } from './SendUserFileTool/SendUserFileTool.js'
import { EnterPlanModeTool } from './EnterPlanModeTool/EnterPlanModeTool.js'
import { ExitPlanModeTool } from './ExitPlanModeTool/ExitPlanModeTool.js'
import { VerifyPlanExecutionTool } from './VerifyPlanExecutionTool/VerifyPlanExecutionTool.js'
import { ToolSearchTool } from './ToolSearchTool/ToolSearchTool.js'
import { MemorySearchTool } from './MemorySearchTool/MemorySearchTool.js'
import { TodoWriteTool } from './TodoWriteTool/TodoWriteTool.js'
import { TaskCreateTool } from './TaskCreateTool/TaskCreateTool.js'
import { TaskGetTool } from './TaskGetTool/TaskGetTool.js'
import { TaskListTool } from './TaskListTool/TaskListTool.js'
import { TaskUpdateTool } from './TaskUpdateTool/TaskUpdateTool.js'
import { TaskStopTool } from './TaskStopTool/TaskStopTool.js'
import { TaskOutputTool } from './TaskOutputTool/TaskOutputTool.js'
import { CronCreateTool } from './ScheduleCronTool/CronCreateTool.js'
import { CronDeleteTool } from './ScheduleCronTool/CronDeleteTool.js'
import { CronListTool } from './ScheduleCronTool/CronListTool.js'
import { SkillTool } from './SkillTool/SkillTool.js'
import { DiscoverSkillsTool } from './DiscoverSkillsTool/DiscoverSkillsTool.js'
import { AgentTool } from './AgentTool/AgentTool.js'
import { ExitTool } from './ExitTool/ExitTool.js'
import { WebFetchTool } from './WebFetchTool/WebFetchTool.js'
import { SnipTool } from './SnipTool/SnipTool.js'
import { BrowserTool } from './BrowserTool/BrowserTool.js'
import { allInvestTools } from './InvestTools/InvestTools.js'
import { QuantTool } from './QuantTool/QuantTool.js'
import { TradeLogTool } from './TradeLogTool/TradeLogTool.js'
import { ExperienceQueryTool } from './ExperienceQueryTool/ExperienceQueryTool.js'
import { EvolutionRunTool } from './EvolutionRunTool/EvolutionRunTool.js'
import { SystemPromptTool } from './SystemPromptTool/SystemPromptTool.js'
import { RestartTool } from './RestartTool/RestartTool.js'

// 内置工具静态列表 — 新增工具在此 import + 加入数组
const BUILTIN_TOOLS: Tool[] = [
  SnipTool,
  AgentTool,
  ExitTool,
  ...allInvestTools,
  QuantTool,
  TradeLogTool,
  ExperienceQueryTool,
  EvolutionRunTool,
  SystemPromptTool,
  RestartTool,
  BashTool,
  ReadTool,
  FileWriteTool,
  FileEditTool,
  GlobTool,
  GrepTool,
  WebFetchTool,
  BrowserTool,
  AskUserQuestionTool,
  SendUserFileTool,
  EnterPlanModeTool,
  ExitPlanModeTool,
  VerifyPlanExecutionTool,
  ToolSearchTool,
  MemorySearchTool,
  TodoWriteTool,
  TaskCreateTool,
  TaskGetTool,
  TaskListTool,
  TaskUpdateTool,
  TaskStopTool,
  TaskOutputTool,
  CronCreateTool,
  CronDeleteTool,
  CronListTool,
  SkillTool,
  DiscoverSkillsTool,
]

/** 所有工具（含 isEnabled=false 和 deferLoading=true），供 ToolSearchTool 搜索 */
export function getAllTools(pluginTools: Tool[] = []): Tool[] {
  return [...BUILTIN_TOOLS, ...pluginTools]
}

/**
 * 传给模型的激活工具：isEnabled() 且 deferLoading=false。
 * deferLoading 工具不在初始 context 里，等 ToolSearchTool 激活后模型才能调用。
 */
export function getActiveTools(pluginTools: Tool[] = []): Tool[] {
  return getAllTools(pluginTools).filter((t) => t.isEnabled() && !t.deferLoading)
}

export function findTool(name: string, tools: Tool[]): Tool | undefined {
  return tools.find((t) => t.name === name)
}
