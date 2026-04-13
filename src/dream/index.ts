// src/dream/index.ts
//
// "做梦" — 离线记忆整合 agent
//
// 读取 sessionMemory/notes.md（碎片短期记忆）+ 现有 memdir 长期记忆，
// 调 API 做整合/去重/升华，把有价值的内容写回 memdir 对应类型文件。

import { join } from 'path'
import { createAnthropicClient } from '../anthropic.js'
import { getSessionMemoryContent } from '../sessionMemory/utils.js'
import { isSessionMemoryEmpty } from '../sessionMemory/prompts.js'
import { LocalFSBackend } from '../memdir/backends/LocalFSBackend.js'
import { MemoryTypeRegistry } from '../memdir/typeRegistry.js'

// ── 进度回调 ──────────────────────────────────────────────────────────────────

export type DreamProgress = (msg: string) => void

// ── 结果 ──────────────────────────────────────────────────────────────────────

export type DreamResult = {
  written: string[]   // 写入/更新的文件名列表
  skipped: string     // 跳过原因（空字符串表示正常完成）
}

// ── 系统提示词 ────────────────────────────────────────────────────────────────

function buildDreamSystemPrompt(
  sessionNotes: string,
  existingMemories: string,
  memoryDir: string,
  typeList: string,
): string {
  return `You are a memory consolidation agent. Your job is to extract durable, reusable knowledge from short-term session notes and merge it into the long-term memory store.

## Memory directory
${memoryDir}

## Available memory types
${typeList}

## Existing long-term memories
${existingMemories || '(none yet)'}

## Session notes to consolidate
${sessionNotes}

## Instructions

Analyze the session notes and identify facts worth preserving long-term. For each fact:

1. Decide which memory type it belongs to (user / feedback / project / reference).
2. Check if an existing memory file already covers this — if so, update it; otherwise create a new file.
3. Call write_memory for each file to create or update.

Memory file format (frontmatter + body):
\`\`\`
---
name: <short title>
description: <one-line summary — used for search relevance>
type: <user|feedback|project|reference>
---

<body content>
\`\`\`

Rules:
- Only write facts that are genuinely durable (not session-specific state like "currently working on X").
- For feedback type: lead with the rule, then **Why:** and **How to apply:** lines.
- For project type: lead with the fact/decision, then **Why:** and **How to apply:** lines.
- Keep each file focused on one topic. Split if needed.
- Do NOT duplicate content already in existing memories.
- If nothing is worth preserving, call done() immediately.
- After all write_memory calls, call done().`
}

// ── Tool 定义 ─────────────────────────────────────────────────────────────────

function buildTools(backend: LocalFSBackend) {
  return [
    {
      name: 'write_memory',
      description: 'Write or update a memory file in the long-term memory store.',
      input_schema: {
        type: 'object' as const,
        properties: {
          filename: {
            type: 'string',
            description: 'Filename without path, e.g. "feedback_testing.md"',
          },
          content: {
            type: 'string',
            description: 'Full file content including frontmatter',
          },
        },
        required: ['filename', 'content'],
      },
    },
    {
      name: 'done',
      description: 'Signal that consolidation is complete.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ]
}

// ── 主函数 ────────────────────────────────────────────────────────────────────

export async function runDream(
  cwd: string,
  onProgress: DreamProgress,
  signal: AbortSignal,
): Promise<DreamResult> {
  // 1. 读取 sessionMemory
  const sessionNotes = await getSessionMemoryContent()
  if (!sessionNotes || isSessionMemoryEmpty(sessionNotes)) {
    return { written: [], skipped: 'Session memory is empty — nothing to consolidate.' }
  }

  // 2. 读取现有 memdir
  const backend = new LocalFSBackend(cwd)
  const registry = new MemoryTypeRegistry()
  const metas = await backend.scanFiles(signal)

  const existingMemories = (
    await Promise.all(
      metas.map(async (meta) => {
        const content = await backend.readFile(meta.filePath)
        return `### ${meta.name} [${meta.type}] — ${meta.filePath}\n${content}`
      }),
    )
  ).join('\n\n---\n\n')

  const typeList = registry
    .getTree()
    .filter((n) => n.parent === null)
    .map((n) => `- **${n.name}**: ${n.description}`)
    .join('\n')

  const systemPrompt = buildDreamSystemPrompt(
    sessionNotes,
    existingMemories,
    backend.memoryDir,
    typeList,
  )

  // 3. 调 API
  onProgress('Consolidating memories...')
  const client = createAnthropicClient()
  const tools = buildTools(backend)
  const written: string[] = []

  const messages: { role: 'user' | 'assistant'; content: any }[] = [
    { role: 'user', content: 'Please consolidate the session notes into long-term memory now.' },
  ]

  // agentic loop — 最多 10 轮防止失控
  for (let turn = 0; turn < 10; turn++) {
    if (signal.aborted) break

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    })

    // 收集 assistant 消息
    messages.push({ role: 'assistant', content: response.content })

    // 处理工具调用
    const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use')
    if (toolUseBlocks.length === 0) break

    const toolResults: any[] = []
    let isDone = false

    for (const block of toolUseBlocks) {
      if (block.type !== 'tool_use') continue

      if (block.name === 'done') {
        isDone = true
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'ok' })
        continue
      }

      if (block.name === 'write_memory') {
        const { filename, content } = block.input as { filename: string; content: string }
        const filePath = join(backend.memoryDir, filename)
        try {
          await backend.writeFile(filePath, content)
          written.push(filename)
          onProgress(`Wrote ${filename}`)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Written: ${filePath}` })
        } catch (err) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          })
        }
      }
    }

    if (isDone || response.stop_reason === 'end_turn') break

    messages.push({ role: 'user', content: toolResults })
  }

  return { written, skipped: '' }
}
