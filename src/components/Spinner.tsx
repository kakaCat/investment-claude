// 流式加载指示 — 对标 Claude Code src/components/Spinner.tsx

import React from 'react'
import { Text } from 'ink'
import { useEffect, useState } from 'react'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

type Props = {
  label?: string
}

export function Spinner({ label = 'Thinking' }: Props) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text color="cyan">
      {FRAMES[frame]} {label}…
    </Text>
  )
}
