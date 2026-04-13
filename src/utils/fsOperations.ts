import { open } from 'fs/promises'

export async function* readLinesReverse(
  path: string,
): AsyncGenerator<string, void, undefined> {
  const CHUNK_SIZE = 1024 * 4
  const fileHandle = await open(path, 'r')
  try {
    const stats = await fileHandle.stat()
    let position = stats.size
    let remainder = Buffer.alloc(0)
    const buffer = Buffer.alloc(CHUNK_SIZE)

    while (position > 0) {
      const currentChunkSize = Math.min(CHUNK_SIZE, position)
      position -= currentChunkSize

      await fileHandle.read(buffer, 0, currentChunkSize, position)
      const combined = Buffer.concat([
        buffer.subarray(0, currentChunkSize),
        remainder,
      ])

      const firstNewline = combined.indexOf(0x0a)
      if (firstNewline === -1) {
        remainder = combined
        continue
      }

      remainder = Buffer.from(combined.subarray(0, firstNewline))
      const lines = combined.toString('utf8', firstNewline + 1).split('\n')

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]!
        if (line) {
          yield line
        }
      }
    }

    if (remainder.length > 0) {
      yield remainder.toString('utf8')
    }
  } finally {
    await fileHandle.close()
  }
}
