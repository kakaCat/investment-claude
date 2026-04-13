// src/compact/postCompactCleanup.ts
// 压缩后清理 — 对标 CC src/services/compact/postCompactCleanup.ts

import { clearSectionCache } from '../constants/prompts.js'

/**
 * 压缩后清理缓存，让下一轮重新加载 CLAUDE.md、workspace、env_info 等段。
 * 在所有 compact 路径（auto、manual、partial）成功后调用。
 */
export function runPostCompactCleanup(): void {
  clearSectionCache()
}
