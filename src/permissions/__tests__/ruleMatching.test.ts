import { describe, expect, it } from 'vitest'
import {
  ruleValueToString,
  ruleValueFromString,
  ruleMatchesToolUse,
  findMatchingRule,
} from '../ruleMatching.js'

describe('ruleValueToString', () => {
  it('converts tool-only rule', () => {
    expect(ruleValueToString({ toolName: 'Read' })).toBe('Read')
  })

  it('converts rule with content', () => {
    expect(
      ruleValueToString({ toolName: 'Investment', ruleContent: 'manage_portfolio:add' }),
    ).toBe('Investment(manage_portfolio:add)')
  })

  it('converts rule with wildcard content', () => {
    expect(
      ruleValueToString({ toolName: 'Investment', ruleContent: 'manage_cash:*' }),
    ).toBe('Investment(manage_cash:*)')
  })
})

describe('ruleValueFromString', () => {
  it('parses tool-only rule', () => {
    expect(ruleValueFromString('Read')).toEqual({ toolName: 'Read' })
  })

  it('parses rule with content', () => {
    expect(ruleValueFromString('Investment(manage_portfolio:add)')).toEqual({
      toolName: 'Investment',
      ruleContent: 'manage_portfolio:add',
    })
  })

  it('parses rule with wildcard', () => {
    expect(ruleValueFromString('Investment(manage_cash:*)')).toEqual({
      toolName: 'Investment',
      ruleContent: 'manage_cash:*',
    })
  })

  it('handles empty parentheses as tool-only', () => {
    expect(ruleValueFromString('Bash()')).toEqual({ toolName: 'Bash' })
  })
})

describe('ruleMatchesToolUse', () => {
  it('matches tool-only rule against any use of that tool', () => {
    expect(ruleMatchesToolUse('Read', 'Read')).toBe(true)
    expect(ruleMatchesToolUse('Read', 'Bash')).toBe(false)
  })

  it('matches exact content rule', () => {
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:add)', 'Investment', 'manage_portfolio:add'),
    ).toBe(true)
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:add)', 'Investment', 'manage_portfolio:remove'),
    ).toBe(false)
  })

  it('matches wildcard content rule', () => {
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:*)', 'Investment', 'manage_portfolio:add'),
    ).toBe(true)
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:*)', 'Investment', 'manage_portfolio:remove'),
    ).toBe(true)
    expect(
      ruleMatchesToolUse('Investment(manage_portfolio:*)', 'Investment', 'manage_cash:update'),
    ).toBe(false)
  })

  it('tool-only rule matches even when content is provided', () => {
    expect(
      ruleMatchesToolUse('Investment', 'Investment', 'manage_portfolio:add'),
    ).toBe(true)
  })

  it('content rule does not match when contentString is absent', () => {
    expect(ruleMatchesToolUse('Investment(manage_portfolio:add)', 'Investment')).toBe(false)
  })
})

describe('findMatchingRule', () => {
  it('returns matching rule from any source', () => {
    const rules = {
      userSettings: ['Read'],
      projectSettings: ['Investment(manage_portfolio:add)'],
      session: [],
    }
    const result = findMatchingRule(rules, 'Investment', 'manage_portfolio:add')
    expect(result).not.toBeNull()
    expect(result!.source).toBe('projectSettings')
    expect(result!.value.toolName).toBe('Investment')
  })

  it('returns null when no rule matches', () => {
    const rules = {
      userSettings: ['Read'],
      projectSettings: [],
      session: [],
    }
    expect(findMatchingRule(rules, 'Bash')).toBeNull()
  })

  it('returns first matching rule (userSettings before projectSettings)', () => {
    const rules = {
      userSettings: ['Investment'],
      projectSettings: ['Investment(manage_portfolio:add)'],
      session: [],
    }
    const result = findMatchingRule(rules, 'Investment', 'manage_portfolio:add')
    expect(result!.source).toBe('userSettings')
  })
})
