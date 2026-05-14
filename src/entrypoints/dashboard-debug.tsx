#!/usr/bin/env tsx
// Debug version to test keyboard input
import React, { useState } from 'react'
import { render, Box, Text, useInput } from 'ink'

function DebugDashboard() {
  const [keys, setKeys] = useState<string[]>([])
  const [commandMode, setCommandMode] = useState(false)

  useInput((input, key) => {
    const keyInfo = `input="${input}" code=${input.charCodeAt(0)} commandMode=${commandMode}`
    setKeys(prev => [...prev.slice(-10), keyInfo])

    if (input === ':') {
      setCommandMode(true)
    } else if (input === 'q') {
      process.exit(0)
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Dashboard Debug Mode</Text>
      <Text>按 : 键进入命令模式（按 q 退出）</Text>
      <Text>---</Text>
      <Text>Command Mode: {commandMode ? 'YES' : 'NO'}</Text>
      <Text>---</Text>
      <Text>最近按键：</Text>
      {keys.map((k, i) => (
        <Text key={i}>{k}</Text>
      ))}
      {commandMode && (
        <Box borderStyle="single" borderColor="cyan" marginTop={1}>
          <Text color="cyan">命令模式已激活！按 Esc 退出</Text>
        </Box>
      )}
    </Box>
  )
}

const { waitUntilExit } = render(<DebugDashboard />)
await waitUntilExit()
