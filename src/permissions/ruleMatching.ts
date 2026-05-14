// src/permissions/ruleMatching.ts
// Rule string parsing and matching -- ref Claude Code src/utils/permissions/permissionRuleParser.ts

import type { PermissionRuleSource, PermissionRuleValue, PermissionRule } from './types.js'

const RULE_SOURCES: readonly PermissionRuleSource[] = [
  'userSettings',
  'projectSettings',
  'session',
]

/**
 * Convert a PermissionRuleValue to its string representation.
 *
 * Examples:
 *   { toolName: 'Read' }                                     -> 'Read'
 *   { toolName: 'Investment', ruleContent: 'manage_cash:*' } -> 'Investment(manage_cash:*)'
 */
export function ruleValueToString(value: PermissionRuleValue): string {
  if (value.ruleContent) {
    return `${value.toolName}(${value.ruleContent})`
  }
  return value.toolName
}

/**
 * Parse a rule string back into a PermissionRuleValue.
 *
 * Examples:
 *   'Read'                                -> { toolName: 'Read' }
 *   'Investment(manage_portfolio:add)'    -> { toolName: 'Investment', ruleContent: 'manage_portfolio:add' }
 */
export function ruleValueFromString(ruleString: string): PermissionRuleValue {
  const parenStart = ruleString.indexOf('(')
  if (parenStart === -1) {
    return { toolName: ruleString }
  }

  const toolName = ruleString.slice(0, parenStart)
  const content = ruleString.slice(parenStart + 1, -1) // strip '(' and ')'

  if (!content) {
    return { toolName }
  }

  return { toolName, ruleContent: content }
}

/**
 * Check if a rule string matches a specific tool use.
 *
 * Matching rules:
 * - 'ToolName' matches any use of that tool
 * - 'ToolName(exact:content)' matches only that exact content
 * - 'ToolName(prefix:*)' matches any content starting with 'prefix:'
 */
export function ruleMatchesToolUse(
  ruleString: string,
  toolName: string,
  contentString?: string,
): boolean {
  const rule = ruleValueFromString(ruleString)

  // Tool name must match
  if (rule.toolName !== toolName) {
    return false
  }

  // No content in rule -> matches any use of this tool
  if (!rule.ruleContent) {
    return true
  }

  // No content on the tool use but rule requires content -> no match
  if (!contentString) {
    return false
  }

  // Wildcard matching: 'prefix:*' matches 'prefix:anything'
  if (rule.ruleContent.endsWith(':*')) {
    const prefix = rule.ruleContent.slice(0, -1) // keep the ':'
    return contentString.startsWith(prefix)
  }

  // Exact match
  return rule.ruleContent === contentString
}

/**
 * Find the first rule that matches the given tool use across all sources.
 * Sources are checked in order: userSettings -> projectSettings -> session.
 */
export function findMatchingRule(
  rules: Record<PermissionRuleSource, string[]>,
  toolName: string,
  contentString?: string,
): PermissionRule | null {
  for (const source of RULE_SOURCES) {
    const sourceRules = rules[source]
    for (const ruleString of sourceRules) {
      if (ruleMatchesToolUse(ruleString, toolName, contentString)) {
        return {
          source,
          behavior: 'allow', // caller knows which behavior bucket this came from
          value: ruleValueFromString(ruleString),
        }
      }
    }
  }
  return null
}
