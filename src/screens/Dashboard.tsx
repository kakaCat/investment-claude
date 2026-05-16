// src/screens/Dashboard.tsx
import React, { useState } from 'react'
import { Box, Text, useInput, useApp } from 'ink'

export function Dashboard() {
  const { exit } = useApp()
  const [commandMode, setCommandMode] = useState(false)
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')

  useInput((char, key) => {
    if (commandMode) {
      if (key.return) {
        if (input === 'quit') exit()
        if (input === 'help') setMsg('Commands: quit, help')
        setInput('')
        setCommandMode(false)
      } else if (key.escape) {
        setInput('')
        setCommandMode(false)
      } else if (key.backspace || key.delete) {
        setInput(prev => prev.slice(0, -1))
      } else if (char && !key.ctrl && !key.meta) {
        setInput(prev => prev + char)
      }
      return
    }

    if (char === ':') {
      setCommandMode(true)
      setMsg('')
    } else if (char === 'q') {
      exit()
    } else if (char === '?') {
      setMsg(': = command  q = quit  ? = help')
    } else if (char === 'h') {
      setMsg('Hello! Press : for commands, q to quit')
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">📊 投资仪表盘 v0.1</Text>
      <Text>按 : 输入命令 | q 退出 | ? 帮助</Text>
      {msg ? <Text color="yellow">{msg}</Text> : null}
      {commandMode ? (
        <Box marginTop={1} borderStyle="double" borderColor="cyan" padding={1}>
          <Text>:</Text>
          <Text backgroundColor="blue" color="white">{input || ' '}</Text>
          <Text color="gray"> [Enter:执行 Esc:取消]</Text>
        </Box>
      ) : null}
    </Box>
  )
}
