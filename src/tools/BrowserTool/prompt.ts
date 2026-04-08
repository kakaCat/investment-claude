export const BROWSER_DESCRIPTION = `Control a web browser to navigate pages, interact with elements, take screenshots, and extract content.

Supports two connection modes:
- CDP mode (recommended): connect to user's existing Chrome with real cookies/login state, bypasses anti-bot protection
- Launched mode (fallback): auto-launch a Chromium browser with basic anti-detection

Actions:
- connect: Connect to existing Chrome via CDP (start Chrome with --remote-debugging-port=9222)
- navigate: Go to a URL, returns page title + text preview
- snapshot: Get page accessibility tree (aria snapshot) — best for understanding page structure
- screenshot: Take screenshot, returns image to model + saves to session dir
- click: Click an element (supports doubleClick, right-click, modifier keys)
- fill: Set input value directly (fast)
- type: Type text character by character (for sites that need keyboard events)
- pressKey: Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)
- hover: Hover over an element
- scroll: Scroll element into view
- wait: Wait for text/selector/URL/load state
- evaluate: Execute JavaScript in page context
- getText: Extract text from element or page
- getHTML: Get full page HTML, saved to session file
- search: Quick Bing search
- close: Disconnect and reset`

export const BROWSER_SEARCH_HINT =
  'browser web navigate click screenshot scrape automation playwright CDP chrome'
