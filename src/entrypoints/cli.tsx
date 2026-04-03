// CLI 入口 — 对标 Claude Code src/entrypoints/cli.tsx
// 解析参数 → render Ink App → 启动 REPL

import React from 'react'
import { render } from 'ink'
import { App } from '../components/App.js'
import { REPL } from '../screens/REPL.js'

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--version') || args.includes('-v')) {
    console.log('pi 0.1.0')
    process.exit(0)
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`pi — AI coding assistant

Usage:
  pi              Start interactive session
  pi --version    Show version
  pi --help       Show this help`)
    process.exit(0)
  }

  // 检查 ANTHROPIC_API_KEY
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set')
    process.exit(1)
  }

  render(
    <App>
      <REPL />
    </App>,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
