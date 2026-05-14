import { describe, expect, it } from 'vitest'
import {
  moveCursorLeft,
  moveCursorRight,
  moveCursorHome,
  moveCursorEnd,
  insertAtCursor,
  deleteBeforeCursor,
  deleteAtCursor,
  type CursorInputState,
} from '../cursorInput.js'

function state(value: string, cursor: number): CursorInputState {
  return { value, cursorPos: cursor }
}

// ─── 左移 ───────────────────────────────────────────────────────────────────

describe('moveCursorLeft', () => {
  it('moves cursor one position to the left', () => {
    expect(moveCursorLeft(state('hello', 3))).toEqual(state('hello', 2))
  })

  it('stops at position 0 and does not go negative', () => {
    expect(moveCursorLeft(state('hello', 0))).toEqual(state('hello', 0))
  })

  it('works when cursor is at the end', () => {
    expect(moveCursorLeft(state('hi', 2))).toEqual(state('hi', 1))
  })
})

// ─── 右移 ───────────────────────────────────────────────────────────────────

describe('moveCursorRight', () => {
  it('moves cursor one position to the right', () => {
    expect(moveCursorRight(state('hello', 2))).toEqual(state('hello', 3))
  })

  it('stops at end of string and does not exceed it', () => {
    expect(moveCursorRight(state('hello', 5))).toEqual(state('hello', 5))
  })

  it('works when cursor is at the start', () => {
    expect(moveCursorRight(state('hi', 0))).toEqual(state('hi', 1))
  })
})

// ─── Home / End ─────────────────────────────────────────────────────────────

describe('moveCursorHome', () => {
  it('moves cursor to position 0', () => {
    expect(moveCursorHome(state('hello', 3))).toEqual(state('hello', 0))
  })

  it('is a no-op when already at start', () => {
    expect(moveCursorHome(state('hello', 0))).toEqual(state('hello', 0))
  })
})

describe('moveCursorEnd', () => {
  it('moves cursor to end of string', () => {
    expect(moveCursorEnd(state('hello', 1))).toEqual(state('hello', 5))
  })

  it('is a no-op when already at end', () => {
    expect(moveCursorEnd(state('hello', 5))).toEqual(state('hello', 5))
  })
})

// ─── 插入字符 ────────────────────────────────────────────────────────────────

describe('insertAtCursor', () => {
  it('inserts a character at the cursor position', () => {
    expect(insertAtCursor(state('hllo', 1), 'e')).toEqual(state('hello', 2))
  })

  it('inserts at the start when cursor is 0', () => {
    expect(insertAtCursor(state('ello', 0), 'h')).toEqual(state('hello', 1))
  })

  it('appends at the end when cursor is at end', () => {
    expect(insertAtCursor(state('hell', 4), 'o')).toEqual(state('hello', 5))
  })

  it('inserts a multi-char string and advances cursor by its length', () => {
    expect(insertAtCursor(state('hllo', 1), 'e!')).toEqual(state('he!llo', 3))
  })
})

// ─── Backspace（删除光标前一个字符）─────────────────────────────────────────

describe('deleteBeforeCursor', () => {
  it('deletes the character immediately before the cursor', () => {
    expect(deleteBeforeCursor(state('hello', 3))).toEqual(state('helo', 2))
  })

  it('is a no-op when cursor is at position 0', () => {
    expect(deleteBeforeCursor(state('hello', 0))).toEqual(state('hello', 0))
  })

  it('deletes the last character when cursor is at end', () => {
    expect(deleteBeforeCursor(state('hello', 5))).toEqual(state('hell', 4))
  })
})

// ─── Delete（删除光标处字符）────────────────────────────────────────────────

describe('deleteAtCursor', () => {
  it('deletes the character at the cursor position', () => {
    expect(deleteAtCursor(state('hello', 2))).toEqual(state('helo', 2))
  })

  it('is a no-op when cursor is at end of string', () => {
    expect(deleteAtCursor(state('hello', 5))).toEqual(state('hello', 5))
  })

  it('deletes the first character when cursor is at start', () => {
    expect(deleteAtCursor(state('hello', 0))).toEqual(state('ello', 0))
  })
})
