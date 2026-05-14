// QuantTool - 量化分析工具
import React from 'react'
import { Text, Box } from 'ink'
import { buildTool, type ToolDef } from '../../Tool.js'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../..')

// ── 输入输出类型 ────────────────────────────────────────────────────────────

type QuantInput = {
  function: 'predict_signal' | 'train_model' | 'evaluate_model'
  symbol?: string  // predict_signal 需要
}

type QuantOutput = {
  success: boolean
  result?: string
  error?: string
}

// ── 工具定义 ────────────────────────────────────────────────────────────────

const quantToolDef: ToolDef<QuantInput, QuantOutput> = {
  name: 'Quant',
  description: `Quantitative analysis tool for stock prediction and model training.

Available functions:

**predict_signal** - Predict stock price movement probability (5-day forecast)
  - Params: {function: "predict_signal", symbol: "600519"}
  - Returns: Probability of price increase and buy/hold signal
  - Example: 上涨概率: 68.5%, 信号: 买入

**train_model** - Train/retrain the ML prediction model
  - Params: {function: "train_model"}
  - Returns: Training results (train_score, test_score, n_samples)
  - Note: Takes 1-2 minutes, only use when model needs updating

**evaluate_model** - Evaluate model performance on test data
  - Params: {function: "evaluate_model"}
  - Returns: Accuracy, Precision, Recall, F1 score

Usage examples:
- Predict stock: {function: "predict_signal", symbol: "600519"}
- Train model: {function: "train_model"}
- Evaluate: {function: "evaluate_model"}`,

  inputSchema: {
    type: 'object',
    properties: {
      function: {
        type: 'string',
        enum: ['predict_signal', 'train_model', 'evaluate_model'],
        description: 'Function to execute',
      },
      symbol: {
        type: 'string',
        description: 'Stock symbol (required for predict_signal)',
      },
    },
    required: ['function'],
  },

  async call(input, context) {
    const { function: func, symbol } = input

    try {
      let command = ''
      const mlPipeline = path.join(projectRoot, 'python/quant/ml_pipeline.py')

      switch (func) {
        case 'predict_signal':
          if (!symbol) {
            return {
              data: {
                success: false,
                error: 'symbol is required for predict_signal',
              },
            }
          }
          command = `python ${mlPipeline} predict --symbol ${symbol}`
          break

        case 'train_model':
          command = `python ${mlPipeline} train`
          break

        case 'evaluate_model':
          command = `python ${mlPipeline} evaluate`
          break

        default:
          return {
            data: {
              success: false,
              error: `Unknown function: ${func}`,
            },
          }
      }

      // 执行命令
      const result = execSync(command, {
        encoding: 'utf-8',
        cwd: projectRoot,
        maxBuffer: 10 * 1024 * 1024,
      })

      return {
        data: {
          success: true,
          result: result.trim(),
        },
      }
    } catch (error: any) {
      return {
        data: {
          success: false,
          error: error.message,
          result: error.stdout || error.stderr,
        },
      }
    }
  },

  mapToolResultToToolResultBlockParam(result, toolUseId) {
    if (!result.success) {
      const error = result.error || 'Unknown error'

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
          'Common quant libraries: pandas, numpy, matplotlib, scipy, scikit-learn',
          'Check if the Python environment is properly set up',
        ]
      } else if (error.includes('SyntaxError') || error.includes('IndentationError')) {
        errorType = 'SYNTAX_ERROR'
        diagnosis = 'The Python code has syntax errors.'
        suggestions = [
          'Check the code for syntax errors (missing colons, parentheses, etc.)',
          'Verify indentation is consistent (use spaces, not tabs)',
          'Review the error message for the specific line number',
        ]
      } else if (error.includes('NameError') || error.includes('not defined')) {
        errorType = 'UNDEFINED_VARIABLE'
        diagnosis = 'A variable or function is used before being defined.'
        suggestions = [
          'Check if all variables are defined before use',
          'Verify function names are spelled correctly',
          'Ensure required imports are included',
        ]
      } else if (error.includes('ValueError') || error.includes('invalid literal')) {
        errorType = 'INVALID_VALUE'
        diagnosis = 'A parameter or calculation has an invalid value.'
        suggestions = [
          'Check data types (e.g., converting string to number)',
          'Verify input data is in the expected format',
          'Check for NaN or infinite values in calculations',
        ]
      } else if (error.includes('KeyError') || error.includes('IndexError')) {
        errorType = 'DATA_ACCESS_ERROR'
        diagnosis = 'Attempted to access data that does not exist.'
        suggestions = [
          'Check if the data structure has the expected keys/indices',
          'Verify the data was loaded correctly',
          'Check for empty DataFrames or lists',
        ]
      } else if (error.includes('ZeroDivisionError')) {
        errorType = 'DIVISION_BY_ZERO'
        diagnosis = 'Attempted to divide by zero.'
        suggestions = [
          'Add checks to prevent division by zero',
          'Verify input data does not contain zero values where unexpected',
          'Use conditional logic to handle edge cases',
        ]
      } else if (error.includes('MemoryError') || error.includes('out of memory')) {
        errorType = 'MEMORY_ERROR'
        diagnosis = 'The operation ran out of memory.'
        suggestions = [
          'Reduce the data size or time range',
          'Process data in smaller chunks',
          'Optimize the algorithm to use less memory',
        ]
      } else if (error.includes('FileNotFoundError') || error.includes('No such file')) {
        errorType = 'FILE_NOT_FOUND'
        diagnosis = 'A required file is missing (model file, data file, etc.).'
        suggestions = [
          'If predicting: train the model first using train_model',
          'Check if required data files exist',
          'Verify file paths are correct',
        ]
      } else if (error.includes('symbol') && error.includes('required')) {
        errorType = 'MISSING_PARAMETER'
        diagnosis = 'The symbol parameter is required for predict_signal.'
        suggestions = [
          'Provide a stock symbol: {function: "predict_signal", symbol: "600519"}',
          'Verify the symbol format is correct',
        ]
      } else if (error.includes('Traceback') || error.includes('line ')) {
        errorType = 'RUNTIME_ERROR'
        diagnosis = 'A Python runtime error occurred during execution.'
        suggestions = [
          'Review the error traceback for details',
          'Check the specific line mentioned in the error',
          'Verify all inputs are valid',
        ]
      } else {
        diagnosis = 'An unexpected error occurred during quantitative analysis.'
        suggestions = [
          'Review the error message for specific details',
          'Check if the code logic is correct',
          'Verify all required data is available',
        ]
      }

      const content = `❌ 量化分析失败

Error Type: ${errorType}
Error: ${error}

Diagnosis:
${diagnosis}

Suggested Actions:
${suggestions.map(s => `- ${s}`).join('\n')}

${result.result ? `\nPartial Output:\n${result.result}` : ''}

Important:
- Inform the user that the quantitative analysis failed
- Do NOT fabricate or assume the analysis results
- Consider simplifying the analysis or using alternative approaches`

      return {
        type: 'tool_result' as const,
        tool_use_id: toolUseId,
        content,
        is_error: true,
      }
    }

    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseId,
      content: result.result || '执行成功',
    }
  },

  renderToolResultMessage(result) {
    if (!result.success) {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Text color="red">❌ 量化分析失败</Text>
          <Text color="red">{result.error}</Text>
          {result.result && <Text dimColor>{result.result}</Text>}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color="green">✅ 量化分析完成</Text>
        <Text>{result.result}</Text>
      </Box>
    )
  },
}

// ── 导出 ────────────────────────────────────────────────────────────────────

export const QuantTool = buildTool(quantToolDef)
