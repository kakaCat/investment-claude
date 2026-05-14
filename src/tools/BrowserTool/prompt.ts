export const BROWSER_DESCRIPTION = `Control a web browser to navigate pages, interact with elements, take screenshots, and extract content.

Supports two connection modes:
- CDP mode (recommended): connect to user's existing Chrome with real cookies/login state, bypasses anti-bot protection
- Launched mode (fallback): auto-launch a Chromium browser with basic anti-detection

## Actions

**Connection:**
- connect: Connect to existing Chrome via CDP (start Chrome with --remote-debugging-port=9222)
- close: Disconnect and reset

**Navigation:**
- navigate: Go to a URL, returns page title + text preview
- wait: Wait for text/selector/URL/load state

**Page Inspection:**
- snapshot: Get page accessibility tree (aria snapshot) — best for understanding page structure
- screenshot: Take screenshot, returns image to model + saves to session dir
- getText: Extract text from element or page
- getHTML: Get full page HTML, saved to session file

**Interaction:**
- click: Click an element (supports doubleClick, right-click, modifier keys)
- fill: Set input value directly (fast)
- type: Type text character by character (for sites that need keyboard events)
- pressKey: Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)
- hover: Hover over an element
- scroll: Scroll element into view

**Advanced:**
- evaluate: Execute JavaScript in page context
- search: Quick Bing search

## When to Use This Tool

- Automating web interactions (form filling, clicking buttons)
- Scraping dynamic content that requires JavaScript
- Testing web applications
- Taking screenshots of web pages
- Extracting structured data from websites

## Usage Notes

- CDP mode requires Chrome to be started with --remote-debugging-port=9222
- Use snapshot to understand page structure before interacting
- Use fill for simple inputs, type for inputs that need keyboard events
- Screenshots are automatically saved and shown to the model
- For simple page fetching without interaction, use WebFetch instead`

export const BROWSER_SEARCH_HINT =
  'browser web navigate click screenshot scrape automation playwright CDP chrome'
