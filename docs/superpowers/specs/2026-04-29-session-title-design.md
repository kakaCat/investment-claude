# Session Title Generation — Design Spec

**Date**: 2026-04-29  
**Status**: Approved

---

## Overview

After the first real user message, pi fires a one-shot non-streaming call to the primary model to generate a concise session title (3–7 words, sentence-case). The result is stored in React state and written to `process.title` so it appears in the terminal tab.

---

## New File: `src/utils/sessionTitle.ts`

### Responsibility

Standalone utility — no React imports, no side effects other than the API call.

### API

```ts
export async function generateSessionTitle(
  firstMessage: string,
  signal: AbortSignal,
): Promise<string | null>
```

### Implementation Details

- Creates its own `Anthropic` client using `ANTHROPIC_API_KEY` + `PI_BASE_URL` (same config as `query.ts`, so it follows the primary model setup).
- Uses `client.messages.create` (non-streaming, one-shot).
- Model: `process.env.PI_MODEL ?? 'claude-haiku-3-5-20241022'`
- `max_tokens: 64` — title is short, no need for more.
- System prompt (same intent as CC's `SESSION_TITLE_PROMPT`):

  ```
  Generate a concise, sentence-case title (3-7 words) that captures the main
  topic or goal of this coding session. Return JSON: {"title": "..."}.

  Good: {"title": "Fix login button on mobile"}
  Bad (vague): {"title": "Code changes"}
  Bad (too long): {"title": "Investigate and fix the issue where login fails"}
  Bad (wrong case): {"title": "Fix Login Button On Mobile"}
  ```

- Parses the response with `JSON.parse` on the first text content block.
- Any exception (network, parse error, empty title) returns `null` silently — title generation must never break the main flow.

---

## Changes to `src/screens/REPL.tsx`

### New state/ref

```ts
const [sessionTitle, setSessionTitle] = useState<string | undefined>()
const titleAttemptedRef = useRef(false)
```

### Trigger in `handleSubmit`

Inserted after slash-command early returns, before `query()` is called:

```ts
if (!titleAttemptedRef.current && conversationRef.current.length === 0) {
  titleAttemptedRef.current = true
  void generateSessionTitle(input, new AbortController().signal).then(title => {
    if (title) {
      setSessionTitle(title)
      process.title = title
    } else {
      titleAttemptedRef.current = false  // allow retry on next message
    }
  })
}
```

**Trigger condition**: `conversationRef.current.length === 0` — true only on the very first real query. Slash commands return early before this code, so `/help`, `/compact`, etc. never trigger the title call.

### Reset on `/clear`

```ts
titleAttemptedRef.current = false
setSessionTitle(undefined)
process.title = 'pi'
```

### Why `conversationRef` not `history.messages`

`history.messages` can have non-zero length from slash-command display messages. `conversationRef` only grows when an actual API call has been made — it's the reliable "first real turn" signal.

---

## Data Flow

```
User submits first message
  → handleSubmit detects conversationRef.length === 0
  → fire-and-forget: generateSessionTitle(input, signal)
    → Anthropic API call (non-streaming, max_tokens=64)
    → parse {"title": "..."}
    → setSessionTitle(title)
    → process.title = title   ← terminal tab updates
  → query() runs in parallel (unblocked)
```

The title call is fully parallel to the main query — it does not delay the response.

---

## Out of Scope

- Persisting the title to disk (no `~/.pi/sessions.jsonl` yet).
- Showing the title in the Ink UI (reserved for future status bar).
- `/rename` command (separate feature).
