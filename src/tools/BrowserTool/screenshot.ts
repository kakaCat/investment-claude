import sharp from 'sharp'

const MAX_SIDE = 2000
const MAX_BYTES = 5 * 1024 * 1024

export async function normalizeBrowserScreenshot(
  buffer: Buffer,
): Promise<{ buffer: Buffer; contentType?: 'image/jpeg' }> {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  const maxDim = Math.max(w, h)

  // 尺寸和大小都在限制内，直接返回
  if (buffer.byteLength <= MAX_BYTES && maxDim <= MAX_SIDE) {
    return { buffer }
  }

  // 缩放后尝试 JPEG 压缩
  const qualities = [90, 75, 60, 45]
  for (const quality of qualities) {
    const out = await sharp(buffer)
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer()
    if (out.byteLength <= MAX_BYTES) {
      return { buffer: out, contentType: 'image/jpeg' }
    }
  }

  // 最低质量兜底
  const fallback = await sharp(buffer)
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 30 })
    .toBuffer()
  return { buffer: fallback, contentType: 'image/jpeg' }
}
