import React from 'react'
import { Text, Box } from 'ink'
import type { InvestmentInput, InvestmentOutput } from './InvestmentTool.js'

/**
 * 渲染工具调用消息（工具执行前显示）
 */
export function renderToolUseMessage(
  input: Partial<InvestmentInput>,
  { verbose }: { verbose: boolean }
): React.ReactNode {
  const { function: funcName, ...params } = input as InvestmentInput

  if (!funcName) {
    return null
  }

  // 非详细模式：只显示函数名
  if (!verbose) {
    return <Text>{funcName}</Text>
  }

  // 详细模式：显示函数名和参数
  const paramStr = Object.keys(params).length > 0
    ? JSON.stringify(params, null, 2)
    : 'No parameters'

  return (
    <Box flexDirection="column">
      <Text color="cyan">📊 Investment Tool</Text>
      <Text color="gray">Function: {funcName}</Text>
      {Object.keys(params).length > 0 && (
        <Text color="gray">Params: {paramStr}</Text>
      )}
    </Box>
  )
}

/**
 * 渲染工具执行进度消息（执行中显示）
 */
export function renderToolUseProgressMessage(): React.ReactNode {
  return (
    <Box>
      <Text dimColor>Fetching data…</Text>
    </Box>
  )
}

/**
 * 渲染工具排队消息（等待执行时显示）
 */
export function renderToolUseQueuedMessage(): React.ReactNode {
  return (
    <Box>
      <Text dimColor>Waiting…</Text>
    </Box>
  )
}

/**
 * 渲染工具结果消息（执行完成后显示）
 */
export function renderToolResultMessage(
  output: InvestmentOutput,
  { verbose }: { verbose: boolean }
): React.ReactNode {
  const funcName = output.function || 'unknown'

  // 错误情况
  if (!output.success) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> {funcName}</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="red"> Error: {output.error}</Text>
        </Box>
      </Box>
    )
  }

  // 成功情况 - 格式化数据预览
  const dataStr = output.data ? JSON.stringify(output.data, null, 2) : 'No data'
  const preview = dataStr.length > 500 ? dataStr.slice(0, 500) + '…' : dataStr
  const lines = preview.split('\n')

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text backgroundColor="gray" color="black"> IN </Text>
        <Text> {funcName}</Text>
      </Box>
      <Box marginTop={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green"> ✓ Success</Text>
      </Box>
      <Box paddingLeft={5} marginTop={1} flexDirection="column">
        {lines.slice(0, 10).map((line, i) => (
          <Text key={i} color="gray">{line}</Text>
        ))}
        {lines.length > 10 && <Text color="gray" dimColor>... ({dataStr.length} chars total)</Text>}
      </Box>
    </Box>
  )
}

/**
 * 渲染工具错误消息（执行失败时显示）
 */
export function renderToolUseErrorMessage(
  error: string,
  { verbose }: { verbose: boolean }
): React.ReactNode {
  if (!verbose) {
    return <Text color="red">Error: {error.slice(0, 100)}</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color="red">❌ Investment Tool Error</Text>
      <Text color="red">{error}</Text>
    </Box>
  )
}
