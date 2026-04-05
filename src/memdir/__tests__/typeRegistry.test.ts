import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryTypeRegistry } from '../typeRegistry.js'

describe('MemoryTypeRegistry', () => {
  let registry: MemoryTypeRegistry

  beforeEach(() => {
    registry = new MemoryTypeRegistry()
  })

  it('returns built-in handler for "user"', () => {
    const h = registry.getHandler('user')
    expect(h.name).toBe('user')
    expect(h.defaultWeight).toBe(3)
  })

  it('returns built-in handler for "feedback"', () => {
    const h = registry.getHandler('feedback')
    expect(h.name).toBe('feedback')
    expect(h.defaultWeight).toBe(4)
  })

  it('returns built-in handler for "project"', () => {
    const h = registry.getHandler('project')
    expect(h.defaultWeight).toBe(5)
  })

  it('returns built-in handler for "reference"', () => {
    const h = registry.getHandler('reference')
    expect(h.defaultWeight).toBe(2)
  })

  it('falls back to user handler for unknown type', () => {
    const h = registry.getHandler('unknown-type')
    expect(h.name).toBe('user')
  })

  it('getSubtree returns just itself when no children', () => {
    const subtree = registry.getSubtree('user')
    expect(subtree).toEqual(['user'])
  })

  it('registerCustomType and getHandler finds it', () => {
    registry.registerCustomType({
      name: '数学',
      parent: null,
      description: '数学相关记忆',
    })
    const h = registry.getHandler('数学')
    expect(h.name).toBe('数学')
  })

  it('getSubtree returns parent and all descendants', () => {
    registry.registerCustomType({ name: '数学', parent: null, description: '' })
    registry.registerCustomType({ name: '中学数学', parent: '数学', description: '' })
    registry.registerCustomType({ name: '高中数学', parent: '数学', description: '' })
    const subtree = registry.getSubtree('数学')
    expect(subtree).toContain('数学')
    expect(subtree).toContain('中学数学')
    expect(subtree).toContain('高中数学')
    expect(subtree).toHaveLength(3)
  })

  it('listAll returns all type names including built-ins', () => {
    const all = registry.listAll()
    expect(all).toContain('user')
    expect(all).toContain('feedback')
    expect(all).toContain('project')
    expect(all).toContain('reference')
  })

  it('getTree returns structured tree with built-ins as roots', () => {
    const tree = registry.getTree()
    const names = tree.map((n) => n.name)
    expect(names).toContain('user')
    expect(names).toContain('feedback')
    expect(names).toContain('project')
    expect(names).toContain('reference')
  })
})
