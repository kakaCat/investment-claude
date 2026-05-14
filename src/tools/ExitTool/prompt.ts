export const DESCRIPTION = `Exit the current session gracefully

Use this tool when the user asks to quit, exit, or end the session, or when the task is fully complete and no further interaction is needed.

## When to Use This Tool

- User explicitly asks to quit, exit, close, or end the session
- User says "goodbye", "that's all", "we're done"
- The task is fully complete and you've confirmed no further work is needed
- IMPORTANT: Do NOT use this proactively - only when the user clearly indicates they want to end the session

## Usage Notes

- This gracefully terminates the current Claude session
- Any unsaved work should be saved before calling this tool
- The user will need to start a new session to continue working`

export const SEARCH_HINT = 'exit quit close end session terminate'
