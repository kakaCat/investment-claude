import { chromium, type Browser, type Page } from 'playwright'

// 进程级单例
let _cdpBrowser: Browser | null = null      // connect 模式
let _launchedBrowser: Browser | null = null // 自启动模式
let _page: Page | null = null

/**
 * 连接用户已有 Chrome（CDP 模式）。
 * 用户需先以 --remote-debugging-port=9222 启动 Chrome。
 */
export async function connectCDP(url = 'http://localhost:9222'): Promise<string> {
  await closeAll()
  _cdpBrowser = await chromium.connectOverCDP(url)
  const contexts = _cdpBrowser.contexts()
  const pages = contexts.flatMap(ctx => ctx.pages())
  _page = pages[0] ?? await contexts[0]?.newPage() ?? null
  const title = _page ? await _page.title() : '(no page)'
  return `Connected to Chrome via CDP at ${url}. Current page: ${title}`
}

/**
 * 获取当前 page，不存在时自启动 playwright 浏览器（备选模式）。
 */
export async function getPage(): Promise<Page> {
  if (_page && !_page.isClosed()) return _page

  if (!_launchedBrowser) {
    _launchedBrowser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
    })
    // 注入反检测脚本
    const ctx = await _launchedBrowser.newContext()
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      // @ts-ignore
      window.chrome = { runtime: {} }
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] })
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] })
    })
    _page = await ctx.newPage()
  } else {
    const ctx = _launchedBrowser.contexts()[0]
    if (!ctx) throw new Error('Browser context lost')
    _page = await ctx.newPage()
  }

  return _page
}

/** 断开所有连接，重置状态 */
export async function closeAll(): Promise<void> {
  _page = null
  if (_cdpBrowser) {
    await _cdpBrowser.close().catch(() => {})
    _cdpBrowser = null
  }
  if (_launchedBrowser) {
    await _launchedBrowser.close().catch(() => {})
    _launchedBrowser = null
  }
}

/** 当前连接模式 */
export function getConnectionMode(): 'cdp' | 'launched' | 'none' {
  if (_cdpBrowser) return 'cdp'
  if (_launchedBrowser) return 'launched'
  return 'none'
}
