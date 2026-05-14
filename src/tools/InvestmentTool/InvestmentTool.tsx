// 投资工具 - 提供股票查询、筛选、财务分析等功能
import { buildTool, type ToolDef } from '../../Tool.js'
import { callPython } from '../../utils/python-bridge.js'
import { renderToolResultMessage } from './UI.js'
import { INVESTMENT_TOOL_DESCRIPTION, ALL_KNOWN_FUNCTIONS } from './prompt.js'
import type { PermissionDecision } from '../../permissions/types.js'

// 输入输出类型定义

export type InvestmentInput = {
  function: string  // Python 函数名
  [key: string]: any  // 函数参数
}

export type InvestmentOutput = {
  success: boolean
  data?: any
  error?: string
  function: string
}

// askUser 确认提示：将写操作参数格式化为人类可读的确认消息

function formatWriteConfirmation(funcName: string, params: Record<string, any>): string {
  const action = params.action ?? ''
  const symbol = params.symbol ?? ''
  const name = params.name ?? symbol

  switch (funcName) {
    case 'manage_portfolio': {
      if (action === 'add') {
        const qty = params.quantity ?? '?'
        const cost = params.avg_cost ?? '?'
        return `确认添加持仓：${name}(${symbol}) ${qty}股 均价¥${cost}？`
      }
      if (action === 'remove') return `确认删除持仓：${name}(${symbol})？`
      if (action === 'update') return `确认更新持仓：${name}(${symbol})？`
      return `确认执行 ${funcName}.${action}？`
    }
    case 'manage_watchlist': {
      if (action === 'add') return `确认添加关注：${name}(${symbol})？`
      if (action === 'remove') return `确认移除关注：${name}(${symbol})？`
      if (action === 'update') return `确认更新关注：${name}(${symbol})？`
      return `确认执行 ${funcName}.${action}？`
    }
    case 'manage_trade_log': {
      if (action === 'create') return `确认创建交易日志：${name}(${symbol})？`
      if (action === 'append') return `确认追加交易记录：${name}(${symbol})？`
      return `确认执行 ${funcName}.${action}？`
    }
    case 'manage_cash': {
      const amount = params.amount ?? '?'
      return `确认更新可用资金为 ¥${amount}？`
    }
    default:
      return `确认执行 ${funcName}？`
  }
}

// 工具定义

const investmentToolDef: ToolDef<InvestmentInput, InvestmentOutput> = {
  name: 'Investment',
  description: INVESTMENT_TOOL_DESCRIPTION,

  inputSchema: {
    type: 'object',
    properties: {
      function: {
        type: 'string',
        description: 'Python function name to call (e.g., "get_stock_realtime_price")',
        enum: ALL_KNOWN_FUNCTIONS,
      },
    },
    required: ['function'],
  },

  checkPermissions(input: InvestmentInput): PermissionDecision {
    const WRITE_OPS: Record<string, string[]> = {
      manage_portfolio: ['add', 'remove', 'update'],
      manage_watchlist: ['add', 'remove', 'update'],
      manage_trade_log: ['create', 'append'],
      manage_cash: ['update'],
    }

    const { function: funcName, ...params } = input
    const writeActions = WRITE_OPS[funcName]
    if (writeActions && writeActions.includes(params.action)) {
      return {
        behavior: 'ask',
        message: formatWriteConfirmation(funcName, params),
        suggestions: [{
          type: 'addRules',
          destination: 'projectSettings',
          rules: [{ toolName: 'Investment', ruleContent: `${funcName}:${params.action}` }],
          behavior: 'allow',
        }],
      }
    }

    return { behavior: 'allow' }
  },

  isReadOnly() {
    return false
  },

  async call(input, _context) {
    const { function: funcName, ...params } = input

    // 验证函数名
    if (!ALL_KNOWN_FUNCTIONS.includes(funcName)) {
      return {
        data: {
          success: false,
          error: `未知函数: ${funcName}. 可用函数: ${ALL_KNOWN_FUNCTIONS.slice(0, 10).join(', ')}...`,
          function: funcName,
        },
      }
    }

    try {
      const result = await callPython(funcName, params)
      if (result && typeof result === 'object' && 'error' in result) {
        return {
          data: {
            success: false,
            error: result.error,
            function: funcName,
            data: result,
          },
        }
      }
      return {
        data: {
          success: true,
          data: result,
          function: funcName,
        },
      }
    } catch (error) {
      return {
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          function: funcName,
        },
      }
    }
  },

  mapToolResultToToolResultBlockParam(output, toolUseId) {
    if (!output.success) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `Investment tool error (${output.function}):\n${output.error}`,
        is_error: true,
      }
    }

    // 格式化输出数据
    const formatted = JSON.stringify(output.data, null, 2)
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `Investment function "${output.function}" result:\n\n${formatted}`,
    }
  },

  // 使用 UI.tsx 中的渲染函数
  renderToolResultMessage(output, options) {
    return renderToolResultMessage(output, { verbose: options.verbose })
  },
}

export const InvestmentTool = buildTool(investmentToolDef)
