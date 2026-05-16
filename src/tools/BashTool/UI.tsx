import React from 'react'
import { Box, Text } from 'ink'

export function BashToolUseUI({ input }: { input: { command: string; description?: string } }) {
  return (
    <Text color="gray" dimColor>
      {input.description || input.command}
    </Text>
  )
}

export function BashToolResultUI({
  result,
  stdout,
  stderr,
  exitCode,
  command,
  isExpanded = true,
}: {
  result?: string
  stdout?: string
  stderr?: string
  exitCode?: number
  command?: string
  isExpanded?: boolean
}) {
  const MAX_LINES = 10
  const MAX_CHARS = 1000

  const truncateOutput = (text: string): { display: string; isTruncated: boolean; totalLines: number } => {
    const lines = text.split('\n')
    const totalLines = lines.length

    if (isExpanded) {
      return { display: text, isTruncated: false, totalLines }
    }

    // 未展开时：显示前 MAX_LINES 行或 MAX_CHARS 字符
    if (lines.length > MAX_LINES) {
      const truncated = lines.slice(0, MAX_LINES).join('\n')
      return { display: truncated, isTruncated: true, totalLines }
    }

    if (text.length > MAX_CHARS) {
      return { display: text.slice(0, MAX_CHARS), isTruncated: true, totalLines }
    }

    return { display: text, isTruncated: false, totalLines }
  }

  // 如果传入了结构化数据，使用 IN/OUT 样式
  if (command !== undefined || stdout !== undefined || stderr !== undefined) {
    const stdoutData = stdout ? truncateOutput(stdout) : null
    const stderrData = stderr ? truncateOutput(stderr) : null

    return (
      <Box flexDirection="column" paddingLeft={2} gap={0}>
        {/* IN 标签 + 命令 */}
        {command && (
          <Box gap={1}>
            <Text backgroundColor="gray" color="black"> IN  </Text>
            <Text color="gray">{command}</Text>
          </Box>
        )}

        {/* OUT 标签 + 输出 */}
        {(stdout || stderr || exitCode !== undefined) && (
          <Box gap={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Box flexDirection="column">
              {exitCode !== undefined && exitCode !== 0 && (
                <Text color="red">Exit code: {exitCode}</Text>
              )}
              {stdoutData && (
                <>
                  <Text color="green">{stdoutData.display}</Text>
                  {stdoutData.isTruncated && (
                    <Text color="gray" dimColor>
                      ... (还有 {stdoutData.totalLines - MAX_LINES} 行) {isExpanded ? '▲' : '▼'}
                    </Text>
                  )}
                </>
              )}
              {stderrData && (
                <>
                  <Text color="red">{stderrData.display}</Text>
                  {stderrData.isTruncated && (
                    <Text color="gray" dimColor>
                      ... (还有 {stderrData.totalLines - MAX_LINES} 行) {isExpanded ? '▲' : '▼'}
                    </Text>
                  )}
                </>
              )}
              {!stdout && !stderr && exitCode === 0 && (
                <Text dimColor>(no output)</Text>
              )}
            </Box>
          </Box>
        )}
      </Box>
    )
  }

  // Fallback: 使用旧的字符串渲染
  const resultData = result ? truncateOutput(result) : null
  return (
    <>
      <Text wrap="wrap">{resultData?.display || ''}</Text>
      {resultData?.isTruncated && (
        <Text color="gray" dimColor>
          ... (还有 {resultData.totalLines - MAX_LINES} 行) {isExpanded ? '▲' : '▼'}
        </Text>
      )}
    </>
  )
}
