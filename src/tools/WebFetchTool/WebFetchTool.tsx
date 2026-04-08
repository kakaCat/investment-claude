import React from 'react'
import { createAnthropicClient } from '../../anthropic.js'
import TurndownService from 'turndown'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { WebFetchToolUseUI, WebFetchToolResultUI } from './UI.js'

const MAX_BODY_BYTES = 10 * 1024 * 1024  // 10 MB
const MAX_MD_CHARS = 100_000
const FETCH_TIMEOUT = 60_000             // 60 seconds

// Lazy singleton — turndown is ~1.4 MB, only load when first used
let _turndown: TurndownService | null = null
function getTurndown(): TurndownService {
  if (!_turndown) _turndown = new TurndownService()
  return _turndown
}

async function fetchPage(url: string): Promise<{ markdown: string; error?: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { markdown: '', error: 'Error: invalid URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { markdown: '', error: 'Error: invalid URL - must start with http:// or https://' }
  }

  // Upgrade http to https
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:'
    url = parsed.toString()
  }

  let response: Response
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: {
        'User-Agent': 'pi-agent/0.1',
        'Accept': 'text/html, text/markdown, */*',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('timed out') || msg.includes('TimeoutError')) {
      return { markdown: '', error: 'Error: fetch timed out after 60s' }
    }
    return { markdown: '', error: `Error: ${msg}` }
  }

  if (!response.ok) {
    return { markdown: '', error: `Error: HTTP ${response.status} ${response.statusText}` }
  }

  // Read body, truncate at 10 MB
  const buffer = await response.arrayBuffer()
  const slice = buffer.byteLength > MAX_BODY_BYTES ? buffer.slice(0, MAX_BODY_BYTES) : buffer
  const text = new TextDecoder().decode(slice)

  // HTML → Markdown
  const contentType = response.headers.get('content-type') ?? ''
  let markdown: string
  if (contentType.includes('text/html')) {
    markdown = getTurndown().turndown(text)
  } else {
    markdown = text
  }

  // Truncate
  if (markdown.length > MAX_MD_CHARS) {
    markdown = markdown.slice(0, MAX_MD_CHARS) + '\n...(truncated)'
  }

  return { markdown }
}

async function applyPrompt(url: string, markdown: string, prompt: string): Promise<string> {
  const client = createAnthropicClient()

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: "You are a helpful assistant. Answer the user's question based on the fetched web page content.",
      messages: [
        {
          role: 'user',
          content: `<page url="${url}">\n${markdown}\n</page>\n\n${prompt}`,
        },
      ],
    })

    const block = response.content[0]
    return block.type === 'text' ? block.text : markdown
  } catch {
    // Degrade gracefully — return raw markdown if secondary model fails
    return markdown
  }
}

export const WebFetchTool = buildTool({
  name: 'web_fetch',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  maxResultSizeChars: Infinity, // 自己管理截断（MAX_MD_CHARS）
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch. Must be http:// or https://.',
      },
      prompt: {
        type: 'string',
        description: 'What to extract or answer from the page content.',
      },
    },
    required: ['url', 'prompt'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <WebFetchToolUseUI input={input as { url: string; prompt: string }} />
  ),
  renderToolResult: (result) => <WebFetchToolResultUI result={result} />,
  async call(input, _context) {
    const { url, prompt } = input as { url: string; prompt: string }
    const { markdown, error } = await fetchPage(url)
    if (error) return error
    return applyPrompt(url, markdown, prompt)
  },
})
