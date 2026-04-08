import React from 'react'
import { Text } from 'ink'

type BrowserInput = {
  action: string
  url?: string
  selector?: string
  text?: string
  key?: string
  fn?: string
}

export function BrowserToolUseUI({ input }: { input: BrowserInput }) {
  const { action, url, selector, text, key } = input
  const detail = url ?? selector ?? text ?? key ?? ''
  return (
    <Text color="cyan">
      🌐 browser:{action}
      {detail ? <Text color="gray"> {detail.slice(0, 80)}</Text> : null}
    </Text>
  )
}

export function BrowserToolResultUI({ result }: { result: string }) {
  const display = result.length > 300 ? result.slice(0, 300) + '…' : result
  return <Text color="gray">{display}</Text>
}
