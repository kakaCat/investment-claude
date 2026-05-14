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
      const error = output.error || 'Unknown error'
      const funcName = output.function

      // 分析错误类型
      let errorType = 'UNKNOWN'
      let diagnosis = ''
      let suggestions: string[] = []

      if (error.includes('ModuleNotFoundError') || error.includes('No module named')) {
        errorType = 'MISSING_DEPENDENCY'
        const moduleName = error.match(/No module named '([^']+)'/)?.[1] || 'unknown'
        diagnosis = `Python module "${moduleName}" is not installed.`
        suggestions = [
          `Install the missing module: pip install ${moduleName}`,
          'Check if the Python environment is properly set up',
          'Verify requirements.txt includes all necessary dependencies',
        ]
      } else if (error.includes('FileNotFoundError') || error.includes('No such file')) {
        errorType = 'FILE_NOT_FOUND'
        diagnosis = 'A required file or data source is missing.'
        suggestions = [
          'Check if the data file exists at the expected location',
          'Verify the file path is correct',
          'The data may need to be initialized or downloaded first',
        ]
      } else if (error.includes('KeyError') || error.includes('key not found')) {
        errorType = 'INVALID_PARAMETER'
        diagnosis = 'A required parameter is missing or has an invalid key.'
        suggestions = [
          'Check the function signature and required parameters',
          'Verify all required fields are provided',
          'Review the tool description for correct parameter names',
        ]
      } else if (error.includes('ValueError') || error.includes('invalid literal')) {
        errorType = 'INVALID_VALUE'
        diagnosis = 'A parameter has an invalid value or format.'
        suggestions = [
          'Check parameter types (e.g., numbers should be numeric, not strings)',
          'Verify date formats are correct',
          'Ensure stock symbols are in the correct format',
        ]
      } else if (error.includes('ConnectionError') || error.includes('timeout') || error.includes('Network')) {
        errorType = 'NETWORK_ERROR'
        diagnosis = 'Failed to connect to external data source.'
        suggestions = [
          'The data provider may be temporarily unavailable',
          'Check network connectivity',
          'Try again in a few moments',
          'Consider using alternative data sources',
        ]
      } else if (error.includes('symbol') && error.includes('not found')) {
        errorType = 'SYMBOL_NOT_FOUND'
        diagnosis = 'The stock symbol was not found or is invalid.'
        suggestions = [
          'Verify the stock symbol is correct (e.g., 600519 for 贵州茅台)',
          'Check if the symbol format matches the market (A-share: 6-digit, HK: 5-digit with leading 0)',
          'The stock may be delisted or suspended',
        ]
      } else if (error.includes('Traceback') || error.includes('line ')) {
        errorType = 'PYTHON_RUNTIME_ERROR'
        diagnosis = 'A Python runtime error occurred in the investment tool.'
        suggestions = [
          'This may be a bug in the Python script',
          'Check the error traceback for details',
          'Try with different parameters to isolate the issue',
        ]
      } else {
        diagnosis = 'An unexpected error occurred in the investment tool.'
        suggestions = [
          'Check if the function name is correct',
          'Verify all parameters are valid',
          'Review the error message for specific details',
        ]
      }

      const content = `Investment tool error (${funcName}):

Error Type: ${errorType}
Error: ${error}

Diagnosis:
${diagnosis}

Suggested Actions:
${suggestions.map(s => `- ${s}`).join('\n')}

Important:
- Inform the user that this investment function failed
- Do NOT fabricate or assume the result data
- Consider using alternative functions or data sources if available
- If this is a data retrieval error, mark the data as "unavailable" in your analysis`

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content,
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
