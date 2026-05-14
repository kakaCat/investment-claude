// src/permissions/checkPermissions.ts
// Permission checking pipeline — ref Claude Code src/utils/permissions/permissions.ts

import type { PermissionDecision, ToolPermissionContext } from './types.js'
import { findMatchingRule } from './ruleMatching.js'

/**
 * Minimal tool shape needed for permission checking.
 * Avoids importing the full Tool type to prevent circular dependencies.
 */
type PermissionCheckTool = {
  name: string
  isReadOnly(): boolean
  checkPermissions?(input: unknown): PermissionDecision
}

/**
 * Main permission checking pipeline.
 *
 * Steps:
 * 1. Deny rules (highest priority)
 * 2. Tool-level checkPermissions
 * 3. Mode-based decision (trust/readonly/default)
 * 4. Allow rules
 * 5. Default: readOnly → allow, else → ask
 *
 * @param contentString Optional content key for rule matching,
 *        e.g. 'manage_portfolio:add' for Investment tool
 */
export function checkToolPermission(
  tool: PermissionCheckTool,
  input: Record<string, unknown>,
  context: ToolPermissionContext,
  contentString?: string,
): PermissionDecision {
  // Step 1: deny rules — highest priority
  const denyRule = findMatchingRule(context.denyRules, tool.name, contentString)
  if (denyRule) {
    return { behavior: 'deny', message: `已被规则禁止: ${tool.name}` }
  }

  // Step 2: tool-level permission check
  const toolResult = tool.checkPermissions?.(input)
  if (toolResult?.behavior === 'deny') {
    return toolResult
  }

  // Step 3: mode-based decision
  if (context.mode === 'trust') {
    return { behavior: 'allow' }
  }
  if (context.mode === 'readonly' && !tool.isReadOnly()) {
    return { behavior: 'deny', message: '只读模式下不允许写入操作' }
  }

  // Step 4: allow rules
  const allowRule = findMatchingRule(context.allowRules, tool.name, contentString)
  if (allowRule) {
    return { behavior: 'allow' }
  }

  // Step 5: tool returned ask with suggestions → pass through
  if (toolResult?.behavior === 'ask') {
    return toolResult
  }

  // Default: readOnly tools auto-allow, else ask
  if (tool.isReadOnly()) {
    return { behavior: 'allow' }
  }
  return { behavior: 'ask', message: `确认使用 ${tool.name}？` }
}
