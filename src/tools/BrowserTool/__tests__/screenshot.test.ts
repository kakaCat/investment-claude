import { describe, it, expect } from 'vitest'
import { normalizeBrowserScreenshot } from '../screenshot.js'
import sharp from 'sharp'

describe('normalizeBrowserScreenshot', () => {
  it('returns small PNG unchanged', async () => {
    // 1x1 PNG
    const buf = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
      .png().toBuffer()
    const result = await normalizeBrowserScreenshot(buf)
    expect(result.contentType).toBeUndefined()
    expect(result.buffer.length).toBeLessThanOrEqual(buf.length + 100)
  })

  it('resizes large image to max 2000px side', async () => {
    const buf = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#fff' } })
      .png().toBuffer()
    const result = await normalizeBrowserScreenshot(buf)
    const meta = await sharp(result.buffer).metadata()
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(2000)
  })
})
