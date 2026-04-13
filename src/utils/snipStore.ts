// Per-session snip store — tracks message uuids marked for deletion by SnipTool

const snippedIds = new Set<string>()

export function markSnipped(uuids: string[]): void {
  for (const id of uuids) snippedIds.add(id)
}

export function isSnipped(uuid: string): boolean {
  return snippedIds.has(uuid)
}

export function clearSnipStore(): void {
  snippedIds.clear()
}
