// CLI 入口 — 对标 Claude Code src/entrypoints/cli.tsx
// 解析参数 → render Ink App → 启动 REPL

import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'
import { render } from 'ink'
import { App } from '../components/App.js'
import { REPL } from '../screens/REPL.js'
import { logForDebugging } from '../utils/debug.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'

// 加载 .env 文件（如果存在）
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (key && !(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // .env 不存在时忽略
  }
}

async function main() {
  loadEnv()

  logForDebugging(`pi started pid=${process.pid}`)
  logForDiagnosticsNoPII('info', 'cli_entry', { pid: process.pid })

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
