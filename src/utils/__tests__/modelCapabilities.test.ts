import { describe, it, expect } from 'vitest'
import { modelSupportsVision } from '../modelCapabilities.js'

describe('modelSupportsVision', () => {
  it('returns true for claude-3 models', () => {
    expect(modelSupportsVision('claude-3-opus-20240229')).toBe(true)
    expect(modelSupportsVision('claude-3-5-sonnet-20241022')).toBe(true)
    expect(modelSupportsVision('claude-3-haiku-20240307')).toBe(true)
  })
  it('returns true for claude-sonnet-4-6 and similar', () => {
    expect(modelSupportsVision('claude-sonnet-4-6')).toBe(true)
    expect(modelSupportsVision('claude-opus-4-6')).toBe(true)
    expect(modelSupportsVision('claude-haiku-4-5-20251001')).toBe(true)
  })
  it('returns false for unknown models', () => {
    expect(modelSupportsVision('gpt-4')).toBe(false)
    expect(modelSupportsVision('')).toBe(false)
  })
})
