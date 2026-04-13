import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const playwrightMocks = vi.hoisted(() => ({
  connectOverCDP: vi.fn(),
  launch: vi.fn(),
}))

vi.mock('playwright', () => ({
  chromium: {
    connectOverCDP: playwrightMocks.connectOverCDP,
    launch: playwrightMocks.launch,
  },
}))

type BrowserModule = typeof import('../browser.js')

function createPage(title = 'Mock Page') {
  return {
    title: vi.fn().mockResolvedValue(title),
    isClosed: vi.fn().mockReturnValue(false),
  }
}

function createContext({
  pages = [],
  newPage = createPage(),
}: {
  pages?: ReturnType<typeof createPage>[]
  newPage?: ReturnType<typeof createPage>
} = {}) {
  return {
    pages: vi.fn().mockReturnValue(pages),
    newPage: vi.fn().mockResolvedValue(newPage),
    addInitScript: vi.fn().mockResolvedValue(undefined),
  }
}

function createBrowser({
  contexts = [],
  newContext = createContext(),
}: {
  contexts?: ReturnType<typeof createContext>[]
  newContext?: ReturnType<typeof createContext>
} = {}) {
  return {
    contexts: vi.fn().mockReturnValue(contexts),
    newContext: vi.fn().mockResolvedValue(newContext),
    close: vi.fn().mockResolvedValue(undefined),
  }
}

async function loadBrowserModule(): Promise<BrowserModule> {
  return import('../browser.js')
}

describe('BrowserTool browser state', () => {
  let browserModule: BrowserModule | null = null

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    playwrightMocks.connectOverCDP.mockReset()
    playwrightMocks.launch.mockReset()
    browserModule = null
  })

  afterEach(async () => {
    if (browserModule) {
      await browserModule.closeAll()
    }
    vi.restoreAllMocks()
  })

  it("returns 'none' for the initial connection mode", async () => {
    browserModule = await loadBrowserModule()

    expect(browserModule.getConnectionMode()).toBe('none')
  })

  it("returns 'cdp' after a successful connectCDP call", async () => {
    const page = createPage('Connected Tab')
    const context = createContext({ pages: [page] })
    const browser = createBrowser({ contexts: [context] })
    playwrightMocks.connectOverCDP.mockResolvedValue(browser)

    browserModule = await loadBrowserModule()

    await expect(browserModule.connectCDP()).resolves.toContain('Connected')
    expect(browserModule.getConnectionMode()).toBe('cdp')
    expect(playwrightMocks.connectOverCDP).toHaveBeenCalledWith('http://localhost:9222')
  })

  it("throws a failed-to-connect error and resets mode on connectCDP failure", async () => {
    playwrightMocks.connectOverCDP.mockRejectedValue(new Error('socket refused'))

    browserModule = await loadBrowserModule()

    await expect(browserModule.connectCDP('http://localhost:9223')).rejects.toThrow(
      /Failed to connect/,
    )
    expect(browserModule.getConnectionMode()).toBe('none')
  })

  it("returns 'none' after closeAll", async () => {
    const page = createPage('Connected Tab')
    const context = createContext({ pages: [page] })
    const browser = createBrowser({ contexts: [context] })
    playwrightMocks.connectOverCDP.mockResolvedValue(browser)

    browserModule = await loadBrowserModule()
    await browserModule.connectCDP()
    await browserModule.closeAll()

    expect(browserModule.getConnectionMode()).toBe('none')
    expect(browser.close).toHaveBeenCalledTimes(1)
  })

  it("auto-launches a browser in getPage and returns 'launched' mode", async () => {
    const page = createPage('Launched Tab')
    const context = createContext({ newPage: page })
    const browser = createBrowser({ newContext: context })
    playwrightMocks.launch.mockResolvedValue(browser)

    browserModule = await loadBrowserModule()

    await expect(browserModule.getPage()).resolves.toBe(page)
    expect(browserModule.getConnectionMode()).toBe('launched')
    expect(playwrightMocks.launch).toHaveBeenCalledOnce()
    expect(context.addInitScript).toHaveBeenCalledOnce()
  })

  it('closes the browser after connection health times out', async () => {
    const page = createPage('Launched Tab')
    const context = createContext({ newPage: page })
    const browser = createBrowser({ newContext: context })
    const nowSpy = vi.spyOn(Date, 'now')
    playwrightMocks.launch.mockResolvedValue(browser)

    nowSpy.mockReturnValue(1_000)
    browserModule = await loadBrowserModule()
    await browserModule.getPage()

    nowSpy.mockReturnValue(1_000 + 5 * 60 * 1000 + 1)
    await browserModule.checkConnectionHealth()

    expect(browser.close).toHaveBeenCalledTimes(1)
    expect(browserModule.getConnectionMode()).toBe('none')
  })
})
