import { describe, it, expect } from 'vitest'
import { validateToolInput } from '../validateToolInput.js'

describe('validateToolInput', () => {
  it('should pass valid input', () => {
    const schema = {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    }

    const result = validateToolInput(
      { path: '/tmp/test.txt', content: 'hello' },
      schema,
    )

    expect(result.valid).toBe(true)
  })

  it('should fail when required field is missing', () => {
    const schema = {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    }

    const result = validateToolInput({ path: '/tmp/test.txt' }, schema)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.includes('content'))).toBe(true)
    }
  })

  it('should fail when input is empty object', () => {
    const schema = {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    }

    const result = validateToolInput({}, schema)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('should fail when field type is wrong', () => {
    const schema = {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    }

    const result = validateToolInput(
      { path: 123, content: 'hello' },
      schema,
    )

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes('path'))).toBe(true)
    }
  })
})
