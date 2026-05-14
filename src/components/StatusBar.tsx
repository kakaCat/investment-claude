// 状态栏 — 对标 tui-redesign.html 的 .status-bar
// 简洁一行：左侧消息计数，右侧 streaming 状态

import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  messageCount: number
  isStreaming: boolean
  isPlanMode?: boolean
}

export const StatusBar = React.memo(function StatusBar({ messageCount, isStreaming, isPlanMode }: Props) {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text color="gray" dimColor>messages: {messageCount}</Text>
        {isPlanMode && <Text color="blue" bold>[PLAN]</Text>}
      </Box>
      {isStreaming && <StreamingBadge />}
    </Box>
  )
})

function StreamingBadge() {
  const [frame, setFrame] = React.useState(0)
  const SPINNER = ['◐', '◓', '◑', '◒']

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER.length)
    }, 150)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text color="green" bold>{SPINNER[frame]} streaming</Text>
  )
}
