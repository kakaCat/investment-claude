export const DESCRIPTION = `List all available skills (slash commands)

Skills are Markdown instruction files in ~/.claude/commands/ or .claude/commands/. Use this before calling the Skill tool to know what skills exist.

## When to Use This Tool

- When you need to discover what skills are available in the current environment
- Before invoking Skill tool if you're unsure of exact skill names
- When the user asks "what skills do we have?" or similar

## Output

Returns a list of available skills with:
- skill name
- description
- usage guidance (if available)

Use the Skill tool with a specific skill name to execute it.`

export const SEARCH_HINT = 'discover list skills commands available slash'
