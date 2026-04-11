import React from 'react'
import { buildTool, type ToolUseContext } from '../../Tool.js'
import { LocalFSBackend } from '../../memdir/backends/LocalFSBackend.js'
import type { MemoryBackend } from '../../memdir/backends/MemoryBackend.js'
import { MemoryTypeRegistry } from '../../memdir/typeRegistry.js'
import { formatMemoryManifest, scoreMemoryForQuery } from '../../memdir/memoryScan.js'
import { buildMemoryAgeWarning } from '../../memdir/memoryAge.js'
import type { MemoryFileMeta } from '../../memdir/Memory.js'

export const MemorySearchTool = buildTool({
  name: 'memory_search',
  description:
    'Search or browse the persistent memory system. Use "types" to see all memory type categories, "type:<name>" to list memories of a type, "search:<keywords>" to find relevant memories, "select:<filename>" to read a specific memory file.',
  searchHint: 'memory recall remember past context history notes',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          '"types" | "type:<typeName>" | "search:<keywords>" | "select:<filename>"',
      },
    },
    required: ['query'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <span>memory_search({JSON.stringify(input)})</span>,
  renderToolResult: (result) => <span>{String(result)}</span>,
  async call(input, context) {
    const { query } = input as { query: string }
    const registry = new MemoryTypeRegistry()
    const signal = context.abortSignal

    if (query.trim() === 'types') {
      const tree = registry.getTree()
      const roots = tree.filter((node) => node.parent === null)

      function renderNode(name: string, indent = 0): string {
        const node = tree.find((entry) => entry.name === name)
        if (!node) return ''

        const prefix = '  '.repeat(indent) + (indent > 0 ? '├── ' : '')
        const lines = [`${prefix}**${name}** — ${node.description}`]
        for (const child of node.children) {
          lines.push(renderNode(child, indent + 1))
        }
        return lines.join('\n')
      }

      return { data: roots.map((root) => renderNode(root.name)).filter(Boolean).join('\n') }
    }

    const typeMatch = query.match(/^type:(.+)$/i)
    if (typeMatch) {
      const backend: MemoryBackend = new LocalFSBackend(context.cwd)
      const typeName = typeMatch[1].trim()
      const subtree = registry.getSubtree(typeName)
      const metas = await backend.scanFiles(signal)
      const filtered = metas.filter((meta) => subtree.includes(meta.type))

      if (filtered.length === 0) {
        return { data: `No memories found for type "${typeName}".` }
      }

      const manifestLines = formatMemoryManifest(filtered).split('\n')
      return {
        data: filtered
          .map((meta, index) => {
            const handler = registry.getHandler(meta.type)
            const ageWarn = buildMemoryAgeWarning(meta.mtimeMs, handler)
            const line = manifestLines[index] ?? ''
            return ageWarn ? `${line}\n  ${ageWarn}` : line
          })
          .join('\n'),
      }
    }

    const selectMatch = query.match(/^select:(.+)$/i)
    if (selectMatch) {
      const backend: MemoryBackend = new LocalFSBackend(context.cwd)
      const filename = selectMatch[1].trim()
      const metas = await backend.scanFiles(signal)
      const found = metas.find(
        (meta) =>
          meta.filePath.endsWith(filename) || meta.filePath.endsWith(`/${filename}`),
      )

      if (!found) {
        return { data: `No memory file matching "${filename}" found.` }
      }

      const content = await backend.readFile(found.filePath)
      const handler = registry.getHandler(found.type)
      const ageWarn = buildMemoryAgeWarning(found.mtimeMs, handler)
      return { data: ageWarn ? `${content}\n\n${ageWarn}` : content }
    }

    const searchMatch = query.match(/^search:(.+)$/i)
    const keywords = (searchMatch ? searchMatch[1] : query).trim()
    const terms = keywords.toLowerCase().split(/\s+/).filter(Boolean)
    const backend: MemoryBackend = new LocalFSBackend(context.cwd)
    const metas = await backend.scanFiles(signal)

    const scored = metas
      .map((meta): { meta: MemoryFileMeta; score: number } => {
        const handler = registry.getHandler(meta.type)
        return {
          meta,
          score: scoreMemoryForQuery(meta, terms, handler.defaultWeight),
        }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    if (scored.length === 0) {
      return { data: `No memories matched '${keywords}'.` }
    }

    const lines = await Promise.all(
      scored.map(async ({ meta }) => {
        const handler = registry.getHandler(meta.type)
        const content = await backend.readFile(meta.filePath)
        const ageWarn = buildMemoryAgeWarning(meta.mtimeMs, handler)
        return `### ${meta.name} [${meta.type}]\n${content}${ageWarn ? `\n\n${ageWarn}` : ''}`
      }),
    )

    return { data: lines.join('\n\n---\n\n') }
  },
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: output,
    }
  },
})
