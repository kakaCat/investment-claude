import React from 'react'
import { join } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { createAnthropicClient } from '../../anthropic.js'
import TurndownService from 'turndown'
import { buildTool } from '../../Tool.js'
import { getSessionId } from '../../bootstrap/state.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { WebFetchToolUseUI, WebFetchToolResultUI, WebFetchToolResultMessageUI } from './UI.js'

const MAX_BODY_BYTES = 10 * 1024 * 1024  // 10 MB
const MAX_MD_CHARS = 100_000
const FETCH_TIMEOUT = 60_000             // 60 seconds
const PREVIEW_LENGTH = 500               // 预览字符数

type WebFetchResult = {
  success: boolean
  url: string
  content: string
  contentLength: number
  truncated: boolean
  savedPath?: string  // 保存的文件路径
  error?: string
}

function getWebFetchDir(): string {
  return join(process.cwd(), '.pi', 'sessions', getSessionId(), 'web_fetch')
}

// Lazy singleton — turndown is ~1.4 MB, only load when first used
let _turndown: TurndownService | null = null
function getTurndown(): TurndownService {
  if (!_turndown) _turndown = new TurndownService()
  return _turndown
}

async function fetchPage(url: string): Promise<{ markdown: string; contentLength: number; truncated: boolean; error?: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { markdown: '', contentLength: 0, truncated: false, error: 'Error: invalid URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { markdown: '', contentLength: 0, truncated: false, error: 'Error: invalid URL - must start with http:// or https://' }
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
      return { markdown: '', contentLength: 0, truncated: false, error: 'Error: fetch timed out after 60s' }
    }
    return { markdown: '', contentLength: 0, truncated: false, error: `Error: ${msg}` }
  }

  if (!response.ok) {
    return { markdown: '', contentLength: 0, truncated: false, error: `Error: HTTP ${response.status} ${response.statusText}` }
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

  const originalLength = markdown.length
  let truncated = false

  // Truncate
  if (markdown.length > MAX_MD_CHARS) {
    markdown = markdown.slice(0, MAX_MD_CHARS) + '\n...(truncated)'
    truncated = true
  }

  return { markdown, contentLength: originalLength, truncated }
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

export const WebFetchTool = buildTool<
  { url: string; prompt: string },
  WebFetchResult
>({
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
  renderToolResultMessage: (output) => <WebFetchToolResultMessageUI output={output} />,
  async call(input, _context) {
    const { url, prompt } = input as { url: string; prompt: string }
    const { markdown, contentLength, truncated, error } = await fetchPage(url)

    if (error) {
      return {
        data: {
          success: false,
          url,
          content: '',
          contentLength: 0,
          truncated: false,
          error,
        },
      }
    }

    const content = await applyPrompt(url, markdown, prompt)

    // 保存完整内容到文件
    const dir = getWebFetchDir()
    await mkdir(dir, { recursive: true })
    const timestamp = Date.now()
    const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)
    const filepath = join(dir, `fetch-${timestamp}-${sanitizedUrl}.txt`)
    await writeFile(filepath, content, 'utf-8')

    return {
      data: {
        success: true,
        url,
        content,
        contentLength,
        truncated,
        savedPath: filepath,
      },
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (!data.success) {
      const error = data.error || 'Unknown error'

      // 分析错误类型并提供诊断
      let errorType = 'UNKNOWN'
      let diagnosis = ''
      let suggestions: string[] = []
      let retryable = false

      if (error.includes('invalid URL')) {
        errorType = 'INVALID_URL'
        diagnosis = 'The URL format is incorrect or uses an unsupported protocol.'
        suggestions = [
          'Verify the URL is correctly formatted (e.g., https://example.com)',
          'Check for typos in the URL',
          'Ensure the URL starts with http:// or https://',
        ]
      } else if (error.includes('timed out')) {
        errorType = 'TIMEOUT'
        diagnosis = 'The server took longer than 60 seconds to respond.'
        retryable = true
        suggestions = [
          'The website may be slow or experiencing high traffic',
          'You could try again in a few moments',
          'Try alternative sources for the same information',
          'The URL might be incorrect (check for typos)',
        ]
      } else if (error.includes('HTTP 404')) {
        errorType = 'NOT_FOUND'
        diagnosis = 'The requested page does not exist at this URL.'
        suggestions = [
          'The URL may be incorrect or outdated',
          'The page may have been moved or deleted',
          'Check for typos in the URL',
          'Try searching for alternative sources',
          'Do NOT retry the same URL - it will not work',
        ]

        // 针对投资场景的特定建议
        if (data.url.includes('eastmoney.com')) {
          suggestions.push('For stock data, try: Sina Finance, Xueqiu, or use get_stock_news/get_announcements tools')
        } else if (data.url.includes('guba.eastmoney.com')) {
          suggestions.push('For stock discussions, try: Xueqiu (xueqiu.com/S/[symbol])')
        }
      } else if (error.includes('HTTP 403')) {
        errorType = 'FORBIDDEN'
        diagnosis = 'Access to this page is denied (authentication or permission required).'
        suggestions = [
          'This page requires login or special permissions',
          'The website may be blocking automated access',
          'Try alternative public sources for the same information',
        ]
      } else if (error.includes('HTTP 5')) {
        errorType = 'SERVER_ERROR'
        diagnosis = 'The server encountered an error (5xx status code).'
        retryable = true
        suggestions = [
          'The website is experiencing technical issues',
          'This is usually temporary - you could try again later',
          'Try alternative sources for the same information',
        ]
      } else if (error.includes('DNS') || error.includes('ENOTFOUND') || error.includes('getaddrinfo')) {
        errorType = 'DNS_ERROR'
        diagnosis = 'Unable to resolve the domain name.'
        suggestions = [
          'The domain may not exist or is misspelled',
          'Check the URL for typos',
          'The website may be down or no longer exists',
        ]
      } else if (error.includes('ECONNREFUSED') || error.includes('connection refused')) {
        errorType = 'CONNECTION_REFUSED'
        diagnosis = 'The server refused the connection.'
        retryable = true
        suggestions = [
          'The website may be down or blocking requests',
          'Try alternative sources',
        ]
      } else {
        // 通用网络错误
        diagnosis = 'An unexpected network or connection error occurred.'
        retryable = true
        suggestions = [
          'Check if the URL is correct',
          'The website may be temporarily unavailable',
          'Try alternative sources for the same information',
        ]
      }

      const content = `WebFetch failed for: ${data.url}

Error Type: ${errorType}
Error: ${error}
Retryable: ${retryable ? 'Yes (may succeed if tried again later)' : 'No (will fail again with same URL)'}

Diagnosis:
${diagnosis}

Suggested Actions:
${suggestions.map(s => `- ${s}`).join('\n')}

Important:
- Inform the user that this data source is unavailable
- Mark this data dimension as "unavailable" in your analysis
- Continue with available data from other sources
- Do NOT fabricate or assume the content of the failed fetch`

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content,
        is_error: true,
      }
    }

    // 成功情况：返回文件路径和预览
    const preview = data.content.slice(0, PREVIEW_LENGTH)
    const resultContent = `Fetched: ${data.url}
Content saved to: ${data.savedPath}

Preview (first ${PREVIEW_LENGTH} chars):
${preview}${data.content.length > PREVIEW_LENGTH ? '\n...' : ''}

Total: ${data.content.length} chars
${data.truncated ? 'Note: Original content was truncated during fetch\n' : ''}
To view full content, use the Read tool: Read("${data.savedPath}")`

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: resultContent,
    }
  },
})
