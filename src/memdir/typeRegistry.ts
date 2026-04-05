import type { CustomTypeDefinition, MemoryTypeHandler } from './Memory.js'
import { userTypeHandler } from './types/user.js'
import { feedbackTypeHandler } from './types/feedback.js'
import { projectTypeHandler } from './types/project.js'
import { referenceTypeHandler } from './types/reference.js'

interface TypeNode {
  name: string
  handler: MemoryTypeHandler
  parent: string | null
  children: string[]
}

export interface TypeTreeEntry {
  name: string
  description: string
  parent: string | null
  children: string[]
}

export class MemoryTypeRegistry {
  private nodes = new Map<string, TypeNode>()

  constructor() {
    for (const h of [userTypeHandler, feedbackTypeHandler, projectTypeHandler, referenceTypeHandler]) {
      this.nodes.set(h.name, { name: h.name, handler: h, parent: null, children: [] })
    }
  }

  getHandler(typeName: string): MemoryTypeHandler {
    return this.nodes.get(typeName)?.handler ?? userTypeHandler
  }

  getSubtree(typeName: string): string[] {
    const node = this.nodes.get(typeName)
    if (!node) return [typeName]

    const result: string[] = [typeName]
    for (const child of node.children) {
      result.push(...this.getSubtree(child))
    }
    return result
  }

  listAll(): string[] {
    return Array.from(this.nodes.keys())
  }

  getTree(): TypeTreeEntry[] {
    return Array.from(this.nodes.values()).map((n) => ({
      name: n.name,
      description: n.handler.description,
      parent: n.parent,
      children: n.children,
    }))
  }

  registerCustomType(def: CustomTypeDefinition): void {
    const handler: MemoryTypeHandler = {
      name: def.name,
      description: def.description,
      defaultWeight: def.defaultWeight ?? 3,
      ageWarningDays: def.ageWarningDays ?? 30,
      formatForInjection(memory) {
        return `## [${def.name}] ${memory.name}\n\n${memory.content}`
      },
    }

    this.nodes.set(def.name, {
      name: def.name,
      handler,
      parent: def.parent ?? null,
      children: [],
    })

    if (def.parent) {
      const parent = this.nodes.get(def.parent)
      if (parent && !parent.children.includes(def.name)) {
        parent.children.push(def.name)
      }
    }
  }
}
