#!/usr/bin/env tsx
// src/entrypoints/dashboard.tsx
import React from 'react'
import { render } from 'ink'
import { Dashboard } from '../screens/Dashboard.js'

const { unmount, waitUntilExit } = render(<Dashboard />)

// 退出处理
process.on('SIGINT', () => {
  unmount()
  process.exit(0)
})

process.on('SIGTERM', () => {
  unmount()
  process.exit(0)
})

// 等待退出
await waitUntilExit()
