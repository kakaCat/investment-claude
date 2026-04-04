export const DESCRIPTION = `Fetches a URL and answers a question about the page content.

Fetches the given URL, converts HTML to Markdown, then uses a fast model to answer your prompt based on the page content.

Usage notes:
- Only http:// and https:// URLs are supported
- The page content is summarized by a secondary model before being returned
- For very large pages, content is truncated to 100,000 characters`

export const SEARCH_HINT = 'web fetch url browse internet page html markdown'
