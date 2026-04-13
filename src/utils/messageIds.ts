// Short message ID utilities — used by SnipTool to let the model reference messages

// shortId → uuid reverse mapping (per-session)
const idMap = new Map<string, string>()

/**
 * Derives a stable 6-char base36 short ID from a UUID.
 * Deterministic: same UUID always produces the same short ID.
 */
export function deriveShortMessageId(uuid: string): string {
  const hex = uuid.replace(/-/g, '').slice(0, 10)
  return parseInt(hex, 16).toString(36).slice(0, 6)
}

/** Register a uuid and return its short ID */
export function registerMessageId(uuid: string): string {
  const shortId = deriveShortMessageId(uuid)
  idMap.set(shortId, uuid)
  return shortId
}

/** Resolve a short ID back to its full uuid */
export function resolveShortId(shortId: string): string | undefined {
  return idMap.get(shortId)
}

export function clearMessageIds(): void {
  idMap.clear()
}
