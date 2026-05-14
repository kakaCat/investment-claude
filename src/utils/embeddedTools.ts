// src/utils/embeddedTools.ts

/**
 * Check if embedded search tools (bfs/ugrep) are available
 * Ant-native builds use embedded tools instead of separate Glob/Grep tools
 */
export function hasEmbeddedSearchTools(): boolean {
  // For now, always return false (use dedicated Glob/Grep tools)
  // Can be enabled via env var for testing
  return process.env.USE_EMBEDDED_SEARCH_TOOLS === 'true'
}
