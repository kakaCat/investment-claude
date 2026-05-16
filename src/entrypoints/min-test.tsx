#!/usr/bin/env tsx
import React, { useState } from 'react'
import { render, Box, Text, useInput, useApp } from 'ink'

function MinTest() {
  const { exit } = useApp()
  const [cmd, setCmd] = useState(false)
  const [log, setLog] = useState<string[]>([])

  useInput((input, key) => {
    setLog(prev => [...prev.slice(-4), `key: "${input}"`])
    if (input === ':') setCmd(true)
    if (input === 'q') exit()
  })

  return (
    <Box flexDirection="column">
      <Text bold>Minimal Test - press : or q</Text>
      <Text>cmd={String(cmd)}</Text>
      {cmd && <Box borderStyle="round" borderColor="cyan"><Text>CMD ACTIVE</Text></Box>}
      <Text>---</Text>
      {log.map((l, i) => <Text key={i}>{l}</Text>)}
    </Box>
  )
}

const { waitUntilExit } = render(<MinTest />)
await waitUntilExit()
