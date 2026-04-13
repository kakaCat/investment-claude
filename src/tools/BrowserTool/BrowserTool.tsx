import React from 'react'
import { join } from 'path'
import { homedir } from 'os'
import { mkdir, writeFile } from 'fs/promises'
import { buildTool } from '../../Tool.js'
import { getSessionId } from '../../bootstrap/state.js'
import type { ToolResultContent } from '../../types/message.js'
import { connectCDP, getPage, closeAll, checkConnectionHealth } from './browser.js'
import { normalizeBrowserScreenshot } from './screenshot.js'
import { BROWSER_DESCRIPTION, BROWSER_SEARCH_HINT } from './prompt.js'
import { BrowserToolUseUI, BrowserToolResultUI } from './UI.js'

const GLOBAL_TIMEOUT_MS = 30_000 // 全局超时 30 秒

function getScreenshotDir(): string {
  return join(homedir(), '.pi', 'sessions', getSessionId(), 'screenshots')
}

function getSessionFileDir(): string {
  return join(homedir(), '.pi', 'sessions', getSessionId(), 'browser')
}

/**
 * 为异步操作添加全局超时保护，防止无限阻塞
 */
function withGlobalTimeout<T>(fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Browser action timed out after ${GLOBAL_TIMEOUT_MS}ms`)), GLOBAL_TIMEOUT_MS),
    ),
  ])
}

async function handleAction(input: Record<string, unknown>): Promise<ToolResultContent['content']> {
  const action = String(input.action ?? '')

  // 检查连接健康状态
  await checkConnectionHealth()

  // ── connect ──────────────────────────────────────────────────────────────────
  if (action === 'connect') {
    const url = input.url ? String(input.url) : 'http://localhost:9222'
    const msg = await connectCDP(url)
    return msg
  }

  // ── close ────────────────────────────────────────────────────────────────────
  if (action === 'close') {
    await closeAll()
    return 'Browser disconnected.'
  }

  // ── navigate ─────────────────────────────────────────────────────────────────
  if (action === 'navigate') {
    const url = String(input.url ?? '')
    if (!url) throw new Error('navigate requires url')
    const page = await getPage()
    try {
      // 等待 networkidle 确保页面完全加载
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
      const title = await page.title()
      const text = await page.evaluate(() => document.body?.innerText ?? '')
      const preview = text.slice(0, 2000)
      return `Title: ${title}\n\n${preview}${text.length > 2000 ? '\n...(truncated)' : ''}`
    } catch (err) {
      throw new Error(`Navigation to "${url}" failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── snapshot ─────────────────────────────────────────────────────────────────
  if (action === 'snapshot') {
    const page = await getPage()
    try {
      const snapshot = await (page as any).accessibility?.snapshot?.()
      if (!snapshot) return 'No accessibility snapshot available.'
      return JSON.stringify(snapshot, null, 2).slice(0, 8000)
    } catch (err) {
      return `Accessibility snapshot not available: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // ── getText ───────────────────────────────────────────────────────────────────
  if (action === 'getText') {
    const page = await getPage()
    const selector = input.selector ? String(input.selector) : null
    const text = selector
      ? await page.locator(selector).first().innerText({ timeout: 8000 })
      : await page.evaluate(() => document.body?.innerText ?? '')
    if (text.length <= 1000) return text
    const dir = getSessionFileDir()
    await mkdir(dir, { recursive: true })
    const filepath = join(dir, `text-${Date.now()}.txt`)
    await writeFile(filepath, text, 'utf-8')
    return `Text saved to: ${filepath}\n\nPreview:\n${text.slice(0, 1000)}\n...(${text.length} chars total)`
  }

  // ── getHTML ───────────────────────────────────────────────────────────────────
  if (action === 'getHTML') {
    const page = await getPage()
    const html = await page.content()
    const dir = getSessionFileDir()
    await mkdir(dir, { recursive: true })
    const filepath = join(dir, `html-${Date.now()}.html`)
    await writeFile(filepath, html, 'utf-8')
    return `HTML saved to: ${filepath}\n\nPreview:\n${html.slice(0, 1000)}\n...(${html.length} chars total)`
  }

  // ── search ────────────────────────────────────────────────────────────────────
  if (action === 'search') {
    const query = String(input.text ?? '')
    if (!query) throw new Error('search requires text')
    const page = await getPage()
    await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' })
    const text = await page.evaluate(() => document.body?.innerText ?? '')
    return text.slice(0, 3000)
  }

  // ── screenshot ────────────────────────────────────────────────────────────────
  if (action === 'screenshot') {
    const page = await getPage()
    const selector = input.selector ? String(input.selector) : null
    const fullPage = Boolean(input.fullPage)
    let rawBuffer: Buffer
    if (selector) {
      rawBuffer = await page.locator(selector).first().screenshot()
    } else {
      rawBuffer = await page.screenshot({ fullPage })
    }
    const { buffer, contentType } = await normalizeBrowserScreenshot(rawBuffer)
    const ext = contentType === 'image/jpeg' ? 'jpg' : 'png'
    const mediaType = (contentType ?? 'image/png') as 'image/png' | 'image/jpeg'
    const dir = getScreenshotDir()
    await mkdir(dir, { recursive: true })
    const filepath = join(dir, `screenshot-${Date.now()}.${ext}`)
    await writeFile(filepath, buffer)
    const base64 = buffer.toString('base64')
    return [
      { type: 'text' as const, text: `Screenshot saved: ${filepath}` },
      { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64 } },
    ]
  }

  // ── click ─────────────────────────────────────────────────────────────────────
  if (action === 'click') {
    const selector = String(input.selector ?? '')
    if (!selector) throw new Error('click requires selector')
    const page = await getPage()
    const locator = page.locator(selector).first()
    const delayMs = typeof input.delayMs === 'number' ? input.delayMs : 0
    const button = (input.button as 'left' | 'right' | 'middle') ?? 'left'
    const modifiers = (input.modifiers as Array<'Alt' | 'Control' | 'ControlOrMeta' | 'Meta' | 'Shift'>) ?? []

    try {
      if (delayMs > 0) {
        await locator.hover({ timeout: 8000 })
        await new Promise(r => setTimeout(r, Math.min(delayMs, 5000)))
      }
      if (input.doubleClick) {
        await locator.dblclick({ timeout: 8000, button, modifiers })
      } else {
        await locator.click({ timeout: 8000, button, modifiers })
      }
      return `Clicked: ${selector}`
    } catch (err) {
      throw new Error(`Click failed on "${selector}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── fill ──────────────────────────────────────────────────────────────────────
  if (action === 'fill') {
    const selector = String(input.selector ?? '')
    const text = String(input.text ?? '')
    if (!selector) throw new Error('fill requires selector')
    const page = await getPage()
    try {
      await page.locator(selector).first().fill(text, { timeout: 8000 })
      return `Filled: ${selector}`
    } catch (err) {
      throw new Error(`Fill failed on "${selector}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── type ──────────────────────────────────────────────────────────────────────
  if (action === 'type') {
    const selector = String(input.selector ?? '')
    const text = String(input.text ?? '')
    if (!selector) throw new Error('type requires selector')
    const page = await getPage()
    try {
      const locator = page.locator(selector).first()
      await locator.click({ timeout: 8000 })
      await locator.pressSequentially(text, { delay: input.slowly ? 80 : 0 })
      return `Typed into: ${selector}`
    } catch (err) {
      throw new Error(`Type failed on "${selector}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── pressKey ──────────────────────────────────────────────────────────────────
  if (action === 'pressKey') {
    const key = String(input.key ?? '')
    if (!key) throw new Error('pressKey requires key')
    const page = await getPage()
    const delayMs = typeof input.delayMs === 'number' ? Math.min(input.delayMs, 5000) : 0
    await page.keyboard.press(key, { delay: delayMs })
    return `Pressed key: ${key}`
  }

  // ── hover ─────────────────────────────────────────────────────────────────────
  if (action === 'hover') {
    const selector = String(input.selector ?? '')
    if (!selector) throw new Error('hover requires selector')
    const page = await getPage()
    try {
      await page.locator(selector).first().hover({ timeout: 8000 })
      return `Hovered: ${selector}`
    } catch (err) {
      throw new Error(`Hover failed on "${selector}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── scroll ────────────────────────────────────────────────────────────────────
  if (action === 'scroll') {
    const selector = String(input.selector ?? '')
    if (!selector) throw new Error('scroll requires selector')
    const page = await getPage()
    try {
      await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 8000 })
      return `Scrolled into view: ${selector}`
    } catch (err) {
      throw new Error(`Scroll failed on "${selector}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── wait ──────────────────────────────────────────────────────────────────────
  if (action === 'wait') {
    const page = await getPage()
    const timeout = 20_000
    try {
      if (typeof input.timeMs === 'number') {
        await page.waitForTimeout(Math.min(input.timeMs, 30_000))
      }
      if (input.text) {
        await page.getByText(String(input.text)).first().waitFor({ state: 'visible', timeout })
      }
      if (input.textGone) {
        await page.getByText(String(input.textGone)).first().waitFor({ state: 'hidden', timeout })
      }
      if (input.selector) {
        await page.locator(String(input.selector)).first().waitFor({ state: 'visible', timeout })
      }
      if (input.url) {
        await page.waitForURL(String(input.url), { timeout })
      }
      if (input.loadState) {
        const state = input.loadState as 'load' | 'domcontentloaded' | 'networkidle'
        await page.waitForLoadState(state, { timeout })
      }
      return 'Wait condition satisfied.'
    } catch (err) {
      throw new Error(`Wait condition failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── evaluate ──────────────────────────────────────────────────────────────────
  if (action === 'evaluate') {
    const fn = String(input.fn ?? '').trim()
    if (!fn) throw new Error('evaluate requires fn')
    const page = await getPage()
    const outerTimeout = 20_000
    const evalTimeout = outerTimeout - 500
    // 使用 Function 构造器替代 eval，注入 Promise.race 超时
    const result = await page.evaluate(
      ({ fnBody, timeoutMs }) => {
        try {
          // 使用 Function 构造器而非 eval，更安全
          const candidate = new Function(`return (${fnBody})`)()
          const ret = typeof candidate === 'function' ? candidate() : candidate
          if (ret && typeof ret.then === 'function') {
            return Promise.race([
              ret,
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`evaluate timed out after ${timeoutMs}ms`)), timeoutMs),
              ),
            ])
          }
          return ret
        } catch (err: any) {
          throw new Error(`Invalid evaluate function: ${err?.message ?? String(err)}`)
        }
      },
      { fnBody: fn, timeoutMs: evalTimeout },
    )
    return JSON.stringify(result, null, 2).slice(0, 5000)
  }

  throw new Error(`Unknown action: ${action}`)
}

export const BrowserTool = buildTool({
  name: 'browser',
  description: BROWSER_DESCRIPTION,
  searchHint: BROWSER_SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['connect', 'navigate', 'snapshot', 'screenshot', 'click', 'fill', 'type',
               'pressKey', 'hover', 'scroll', 'wait', 'evaluate', 'getText', 'getHTML', 'search', 'close'],
        description: 'The browser action to perform',
      },
      url: { type: 'string', description: 'URL for navigate/connect/search actions' },
      selector: { type: 'string', description: 'CSS selector for element actions' },
      text: { type: 'string', description: 'Text for fill/type/search/wait actions' },
      key: { type: 'string', description: 'Key name for pressKey (e.g. Enter, Tab, Escape)' },
      fn: { type: 'string', description: 'JavaScript function body for evaluate' },
      fullPage: { type: 'boolean', description: 'Full page screenshot (default: false)' },
doubleClick: { type: 'boolean', description: 'Double click instead of single click' },
      button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button' },
      modifiers: {
        type: 'array',
        items: { type: 'string', enum: ['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'] },
        description: 'Modifier keys for click',
      },
      delayMs: { type: 'number', description: 'Delay in ms before click or between key presses' },
      slowly: { type: 'boolean', description: 'Type slowly (80ms per char) for type action' },
      textGone: { type: 'string', description: 'Wait for text to disappear' },
      loadState: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle'],
        description: 'Page load state to wait for',
      },
      timeMs: { type: 'number', description: 'Fixed wait time in ms' },
    },
    required: ['action'],
  },
  isReadOnly: () => false,
  async callWithBlocks(input) {
    return withGlobalTimeout(() => handleAction(input as Record<string, unknown>))
  },
  async call(input) {
    const result = await withGlobalTimeout(() => handleAction(input as Record<string, unknown>))
    if (Array.isArray(result)) {
      return {
        data: result
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map(b => b.text)
          .join('\n'),
      }
    }
    return {
      data: result,
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },
  renderToolUse(input) {
    return <BrowserToolUseUI input={input as any} />
  },
  renderToolResult(result) {
    return <BrowserToolResultUI result={result} />
  },
})
