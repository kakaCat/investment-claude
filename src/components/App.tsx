// 顶层 Providers — 对标 Claude Code src/components/App.tsx
// 当前阶段：只是透传 children，为未来 Context 预留位置

import React from 'react'

type Props = {
  children: React.ReactNode
}

export function App({ children }: Props) {
  return <>{children}</>
}
