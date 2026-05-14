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
  // 错误情况
  if (!output.success) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ Investment tool error</Text>
        <Text color="gray">Function: {output.function}</Text>
        <Text color="red">{output.error}</Text>
      </Box>
    )
  }

  // 成功情况 - 非详细模式
  if (!verbose) {
    return (
      <Box>
        <Text color="green">✓ {output.function}</Text>
        {output.data?.symbol && <Text color="gray"> ({output.data.symbol})</Text>}
      </Box>
    )
  }

  // 成功情况 - 详细模式
  return (
    <Box flexDirection="column">
      <Text color="green">✓ Investment function "{output.function}" completed</Text>
      {output.data?.symbol && <Text color="gray">Symbol: {output.data.symbol}</Text>}
      {output.data?.name && <Text color="gray">Name: {output.data.name}</Text>}
      {output.data?.price && <Text color="gray">Price: ¥{output.data.price}</Text>}
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
