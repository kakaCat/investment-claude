export type CursorInputState = {
  value: string
  cursorPos: number
}

export function moveCursorLeft(s: CursorInputState): CursorInputState {
  return { ...s, cursorPos: Math.max(0, s.cursorPos - 1) }
}

export function moveCursorRight(s: CursorInputState): CursorInputState {
  return { ...s, cursorPos: Math.min(s.value.length, s.cursorPos + 1) }
}

export function moveCursorHome(s: CursorInputState): CursorInputState {
  return { ...s, cursorPos: 0 }
}

export function moveCursorEnd(s: CursorInputState): CursorInputState {
  return { ...s, cursorPos: s.value.length }
}

export function insertAtCursor(s: CursorInputState, chars: string): CursorInputState {
  const value = s.value.slice(0, s.cursorPos) + chars + s.value.slice(s.cursorPos)
  return { value, cursorPos: s.cursorPos + chars.length }
}

export function deleteBeforeCursor(s: CursorInputState): CursorInputState {
  if (s.cursorPos === 0) return s
  const value = s.value.slice(0, s.cursorPos - 1) + s.value.slice(s.cursorPos)
  return { value, cursorPos: s.cursorPos - 1 }
}

export function deleteAtCursor(s: CursorInputState): CursorInputState {
  if (s.cursorPos === s.value.length) return s
  const value = s.value.slice(0, s.cursorPos) + s.value.slice(s.cursorPos + 1)
  return { value, cursorPos: s.cursorPos }
}
