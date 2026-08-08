import sharp from 'sharp'

/**
 * 将任意可解码的参考图规范为 PNG。
 *
 * 上游的图像编辑网关对 WebP、动图或带有浏览器专有色彩配置的图片兼容性并不一致；
 * 统一解码并重新编码能同时验证输入内容，避免将 HTML、损坏文件或不兼容编码直接转发。
 */
export const normalizeReferenceImageToPng = async (source: Blob) => {
  const sourceBuffer = Buffer.from(await source.arrayBuffer())
  if (!sourceBuffer.byteLength) {
    throw new Error('参考图为空，请重新上传 PNG、JPG 或 WEBP 格式的图片。')
  }

  try {
    const pngBuffer = await sharp(sourceBuffer, {
      animated: false,
      failOn: 'error',
      limitInputPixels: 100_000_000,
    })
      .rotate()
      .png({ compressionLevel: 9 })
      .toBuffer()

    if (!pngBuffer.byteLength) {
      throw new Error('empty output')
    }

    return new Blob([pngBuffer], { type: 'image/png' })
  } catch (error) {
    console.warn('[generation] reference image normalization failed', {
      message: error instanceof Error ? error.message : String(error),
      sourceType: source.type || 'unknown',
      sourceSize: sourceBuffer.byteLength,
    })
    throw new Error('参考图无法读取，请重新上传 PNG、JPG 或 WEBP 格式的有效图片。')
  }
}
